import { createHttpError } from './error.js';
import { INDIAN_MARKET_PHONES_LAST_10_YEARS } from '../config/seedPhones.js';

export const DEFAULT_PHONE_BRANDS = [
  'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Realme', 'Vivo', 'Oppo',
  'Motorola', 'Google', 'Nothing', 'Poco', 'Redmi', 'iQOO', 'Asus', 'Nokia',
  'Infinix', 'Tecno', 'Honor', 'Lava', 'Micromax',
];

export const mobileCache = new Map();

export const getCachedValue = (key, maxAgeMs = 1000 * 60 * 60 * 24) => {
  const entry = mobileCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > maxAgeMs) {
    mobileCache.delete(key);
    return null;
  }
  return entry.value;
};

export const setCachedValue = (key, value) => {
  mobileCache.set(key, { value, createdAt: Date.now() });
  return value;
};

export const getMobileApiKey = () => {
  return process.env.MOBILE_API_KEY || '6ea85fdde9ef054e9d3cc4458e1b5b601e9a6463';
};

export const getMobileApiBase = () => {
  return (process.env.MOBILE_API_BASE || 'https://api.mobileapi.dev').replace(/\/$/, '');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Smart phone query normalizer
 * e.g. "iphone13" -> "iPhone 13", "vivo v70" -> { brand: "Vivo", model: "v70" }
 */
export const normalizePhoneQuery = (rawName = '', rawBrand = '') => {
  let name = String(rawName || '').trim();
  let brand = String(rawBrand || '').trim();
  if (brand === 'All') brand = '';

  // 1. Detect brand in name if not provided
  for (const b of DEFAULT_PHONE_BRANDS) {
    const brandRegex = new RegExp(`^${b}\\s+`, 'i');
    if (brandRegex.test(name)) {
      if (!brand) brand = b;
      name = name.replace(brandRegex, '').trim();
      break;
    }
  }

  // 2. Separate squished letters and numbers (e.g. iphone13 -> iphone 13, s24 -> s24)
  if (/^([a-zA-Z]+)(\d+)$/.test(name)) {
    const match = name.match(/^([a-zA-Z]+)(\d+)$/);
    if (match && match[1].length > 2) {
      name = `${match[1]} ${match[2]}`;
    }
  }

  return { name, brand };
};

/**
 * Low-level request wrapper for https://mobileapi.dev with auto-retry on 429
 */
export const mobileApiRequest = async (pathname, params = {}, retryCount = 0) => {
  const base = getMobileApiBase();
  const apiKey = getMobileApiKey();

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  searchParams.set('key', apiKey);

  const url = `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      // If 429 rate limited and retry count is 0, backoff and retry once
      if (response.status === 429) {
        const retryAfterSec = Number(payload?.retry_after) || 2;
        if (retryCount === 0 && retryAfterSec <= 4) {
          console.warn(`[MobileAPI] Rate limited (429). Retrying after ${retryAfterSec}s...`);
          await sleep(Math.ceil(retryAfterSec * 1000) + 300);
          return mobileApiRequest(pathname, params, retryCount + 1);
        }
        const error = createHttpError(429, payload?.detail || 'MobileAPI.dev rate limit reached. Using catalog fallback.');
        error.retryAfter = retryAfterSec;
        throw error;
      }
      throw createHttpError(response.status, payload?.detail || payload?.error || payload?.message || 'Mobile API request failed.');
    }

    return payload;
  } catch (err) {
    if (err.status) throw err;
    throw createHttpError(500, `MobileAPI connection error: ${err.message}`);
  }
};

/**
 * Extract clean storage options from device raw data
 */
export const extractStorageOptions = (device) => {
  const rawValues = [];

  if (typeof device?.storage === 'string') {
    rawValues.push(...device.storage.split(','));
  }

  if (Array.isArray(device?.storage_options)) {
    rawValues.push(...device.storage_options);
  }

  const cleaned = Array.from(
    new Set(
      rawValues
        .map((value) => String(value).trim())
        .filter(Boolean)
        .filter((value) => /\d+\s*(GB|TB)/i.test(value))
        .map((value) => value.replace(/\s+/g, ' ').toUpperCase().replace(' GB', 'GB').replace(' TB', 'TB'))
    )
  );

  return cleaned.length > 0 ? cleaned : ['128GB', '256GB'];
};

/**
 * Extract clean RAM options from device hardware string
 */
export const extractRamOptions = (device) => {
  const hw = device?.hardware || '';
  const ramMatch = hw.match(/(\d+(?:\/\d+)*\s*GB\s*RAM)/i);
  if (ramMatch) {
    const list = ramMatch[1].replace(/RAM/i, '').trim().split('/').map((r) => `${r.trim().replace(/\D/g, '')}GB`).filter((r) => r !== 'GB');
    if (list.length > 0) return Array.from(new Set(list));
  }
  return ['8GB', '12GB'];
};

/**
 * Format raw device from https://mobileapi.dev into Fundu standardized smartphone object
 */
export const formatMobileApiDevice = (d, brandFallback = '') => {
  let releaseYear = 2023;
  const yearMatch = (d.release_date || '').match(/\b(20\d\d|19\d\d)\b/);
  if (yearMatch) releaseYear = Number(yearMatch[1]);

  const storages = extractStorageOptions(d);
  const ramOptions = extractRamOptions(d);

  const brand = d.manufacturer_name || d.brand?.name || brandFallback || 'Smartphone';
  const model = d.name || 'Model';

  // Estimate realistic Indian market MRP & resale based on specs and release date
  let defaultMrp = 39999;
  let baseResale = 20000;
  const nameLower = model.toLowerCase();

  if (nameLower.includes('ultra') || nameLower.includes('pro max') || nameLower.includes('fold')) {
    defaultMrp = 129999;
    baseResale = 68000;
  } else if (nameLower.includes('pro') || nameLower.includes('plus') || nameLower.includes('flip')) {
    defaultMrp = 74999;
    baseResale = 42000;
  } else if (releaseYear >= 2024) {
    defaultMrp = 49999;
    baseResale = 26000;
  } else if (releaseYear >= 2022) {
    defaultMrp = 34999;
    baseResale = 18000;
  }

  let imageUrl = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80';
  if (d.image_b64) {
    imageUrl = `data:image/jpeg;base64,${d.image_b64}`;
  } else if (d.image_url) {
    imageUrl = d.image_url;
  }

  return {
    id: `mobileapi-${d.id || Date.now()}`,
    mobileapi_id: d.id,
    brand,
    model,
    release_year: releaseYear,
    ram_options: ramOptions,
    storage_options: storages,
    default_mrp: defaultMrp,
    base_resale_value: baseResale,
    popular_tag: `${brand} 5G Device`,
    processor: d.hardware || 'High-Performance Octa-Core Processor',
    camera_spec: d.camera ? `${d.camera} Camera` : '50MP OIS Camera',
    battery_spec: d.battery_capacity ? `${d.battery_capacity} Battery` : '5000 mAh Fast Charging',
    display_spec: d.screen_resolution ? `${d.screen_resolution} Display` : '6.7" AMOLED 120Hz',
    colors: d.colors || 'Black, Blue, Silver',
    weight: d.weight || '185g',
    thickness: d.thickness || '7.9mm',
    image_url: imageUrl,
    image_b64: d.image_b64 || null,
    model_numbers: d.model_numbers || null,
    is_5g: releaseYear >= 2021,
    is_active: true,
    source: 'https://mobileapi.dev/',
  };
};

/**
 * Local Catalog Fallback Search with resilient brand & keyword matching
 */
const searchLocalIndianCatalog = (name = '', brand = '') => {
  const qLower = (name || '').toLowerCase().trim();
  const bLower = (brand || '').toLowerCase().trim();

  let matches = INDIAN_MARKET_PHONES_LAST_10_YEARS.filter((p) => {
    const brandMatches = !bLower || bLower === 'all' || p.brand.toLowerCase() === bLower;
    if (!brandMatches) return false;
    if (!qLower) return true;
    const fullText = `${p.brand} ${p.model} ${p.processor || ''}`.toLowerCase();
    return fullText.includes(qLower) || qLower.split(' ').every((word) => fullText.includes(word));
  });

  // If specific model query had 0 matches but brand is known, return that brand's popular models
  if (matches.length === 0 && bLower && bLower !== 'all') {
    matches = INDIAN_MARKET_PHONES_LAST_10_YEARS.filter((p) => p.brand.toLowerCase() === bLower);
  }

  // If still 0 matches and query has words, try keyword matching
  if (matches.length === 0 && qLower) {
    const words = qLower.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      matches = INDIAN_MARKET_PHONES_LAST_10_YEARS.filter((p) => {
        const fullText = `${p.brand} ${p.model}`.toLowerCase();
        return words.some((w) => fullText.includes(w));
      });
    }
  }

  return matches.map((p) => ({
    id: `catalog-${p.brand}-${p.model}`.replace(/\s+/g, '-').toLowerCase(),
    brand: p.brand,
    model: p.model,
    release_year: p.release_year,
    ram_options: p.ram_options,
    storage_options: p.storage_options,
    default_mrp: p.default_mrp,
    base_resale_value: p.base_resale_value,
    popular_tag: p.popular_tag || `${p.brand} Verified Phone`,
    processor: p.processor,
    camera_spec: p.camera_spec,
    battery_spec: p.battery_spec,
    display_spec: p.display_spec,
    image_url: p.image_url,
    image_b64: null,
    is_5g: p.is_5g,
    is_active: true,
    source: 'Fundu Verified Catalog',
  }));
};


/**
 * High-level helper: Autocomplete device names from https://mobileapi.dev/devices/autocomplete/
 */
export const fetchMobileApiAutocomplete = async (query, limit = 10) => {
  if (!query || query.trim().length < 2) return [];
  const normalized = normalizePhoneQuery(query);
  const searchTerm = normalized.name || query.trim();

  const cacheKey = `mobileapi:autocomplete:${searchTerm.toLowerCase()}:${limit}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 12);
  if (cached) return cached;

  try {
    const payload = await mobileApiRequest('/devices/autocomplete/', {
      q: searchTerm,
      limit,
    });

    const results = Array.isArray(payload) ? payload : (payload?.value || []);
    if (results.length > 0) {
      setCachedValue(cacheKey, results);
      return results;
    }
  } catch (err) {
    console.warn('[MobileAPI Autocomplete Error]:', err.message);
  }

  // Fallback to local catalog autocomplete
  const local = searchLocalIndianCatalog(query).slice(0, limit).map((p, idx) => ({
    id: 90000 + idx,
    name: p.model,
    brand: p.brand,
    full_name: `${p.brand} ${p.model}`,
  }));

  return local;
};

/**
 * High-level helper: Search devices on https://mobileapi.dev/devices/search/
 */
export const fetchMobileApiSearch = async (rawName, rawBrand = '', page = 1) => {
  const { name, brand } = normalizePhoneQuery(rawName, rawBrand);
  const cacheKey = `mobileapi:search:${(name || '').toLowerCase()}:${(brand || '').toLowerCase()}:${page}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 12);
  if (cached) return cached;

  let devices = [];
  let total = 0;

  try {
    const params = { page };
    if (name) params.name = name;
    if (brand && brand !== 'All') params.manufacturer = brand;

    const payload = await mobileApiRequest('/devices/search/', params);
    devices = (payload?.devices || []).map((d) => formatMobileApiDevice(d, brand));
    total = payload?.total || devices.length;

    // If 0 devices found and raw query had both brand & model (e.g. "vivo v70"), try fallback with just the brand or broad term
    if (devices.length === 0 && brand && page === 1) {
      const fallbackPayload = await mobileApiRequest('/devices/search/', { manufacturer: brand, page: 1 }).catch(() => null);
      if (fallbackPayload?.devices?.length > 0) {
        const fallbackDevices = fallbackPayload.devices.map((d) => formatMobileApiDevice(d, brand));
        devices = fallbackDevices.slice(0, 20);
        total = fallbackDevices.length;
      }
    }
  } catch (err) {
    console.warn('[MobileAPI Search Error]:', err.message);
  }

  // If still 0 devices, fallback to our comprehensive 10-year Indian phone catalog!
  if (devices.length === 0) {
    const localDevices = searchLocalIndianCatalog(name || rawName, brand || rawBrand);
    if (localDevices.length > 0) {
      devices = localDevices.slice(0, 30);
      total = localDevices.length;
    }
  }

  const result = {
    total,
    page,
    devices,
  };

  if (devices.length > 0) {
    setCachedValue(cacheKey, result);
  }

  return result;
};


/**
 * High-level helper: Get full device details by ID from https://mobileapi.dev/devices/{id}/
 */
export const fetchMobileApiDeviceById = async (id) => {
  const cacheKey = `mobileapi:device:${id}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 24);
  if (cached) return cached;

  try {
    const payload = await mobileApiRequest(`/devices/${id}/`);
    const formatted = formatMobileApiDevice(payload);
    setCachedValue(cacheKey, formatted);
    return formatted;
  } catch (err) {
    console.warn(`[MobileAPI Device By ID ${id} Error]:`, err.message);
    return null;
  }
};

/**
 * High-level helper: Get device gallery images from https://mobileapi.dev/devices/{id}/images/
 */
export const fetchMobileApiDeviceImages = async (id) => {
  const cacheKey = `mobileapi:images:${id}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 24);
  if (cached) return cached;

  try {
    const payload = await mobileApiRequest(`/devices/${id}/images/`);
    const images = Array.isArray(payload) ? payload : [];
    setCachedValue(cacheKey, images);
    return images;
  } catch (err) {
    console.warn(`[MobileAPI Device Images ${id} Error]:`, err.message);
    return [];
  }
};

/**
 * High-level helper: Get manufacturers list from https://mobileapi.dev/manufacturers/
 */
export const fetchMobileApiManufacturers = async (page = 1) => {
  const cacheKey = `mobileapi:manufacturers:${page}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 48);
  if (cached) return cached;

  try {
    const payload = await mobileApiRequest('/manufacturers/', { page });
    const manufacturers = payload?.manufacturers || [];
    setCachedValue(cacheKey, manufacturers);
    return manufacturers;
  } catch (err) {
    console.warn('[MobileAPI Manufacturers Error]:', err.message);
    return [];
  }
};

