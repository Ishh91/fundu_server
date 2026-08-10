import { createHttpError } from './error.js';
import { mobileCache, getCachedValue, setCachedValue } from './mobileApi.js';

export const CASHIFY_BRANDS = [
  'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Realme', 'Vivo', 'Oppo',
  'Motorola', 'Google', 'Nothing', 'Poco', 'Redmi', 'iQOO', 'Asus', 'Nokia', 'Infinix', 'Tecno'
];

/**
 * Fetch phone brands via Cashify API with internal caching
 */
export const fetchCashifyBrands = async () => {
  const cacheKey = 'cashify:brands';
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 24);
  if (cached) return cached;

  const CASHIFY_API_BASE = (process.env.CASHIFY_API_BASE || 'https://api.cashify.in/api/v1').replace(/\/$/, '');
  const CASHIFY_API_KEY = process.env.CASHIFY_API_KEY || '';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (CASHIFY_API_KEY) {
      headers['Authorization'] = `Bearer ${CASHIFY_API_KEY}`;
      headers['x-api-key'] = CASHIFY_API_KEY;
    }

    const res = await fetch(`${CASHIFY_API_BASE}/sell/brands`, { headers, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (Array.isArray(json?.data)) {
        const brandNames = json.data.map((b) => typeof b === 'string' ? b : b.name || b.brand_name).filter(Boolean);
        if (brandNames.length > 0) {
          return setCachedValue(cacheKey, Array.from(new Set(brandNames)));
        }
      }
    }
  } catch (_e) {
    // Return static brand list if API call fails or times out
  }

  return setCachedValue(cacheKey, CASHIFY_BRANDS);
};

/**
 * Fetch phone models for a given brand from Cashify API
 */
export const fetchCashifyModels = async (brand, query = '') => {
  if (!brand) return [];
  const searchQuery = (query || brand).trim().toLowerCase();
  const cacheKey = `cashify:models:${brand.toLowerCase()}:${searchQuery}`;
  
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 12);
  if (cached) return cached;

  const CASHIFY_API_BASE = (process.env.CASHIFY_API_BASE || 'https://api.cashify.in/api/v1').replace(/\/$/, '');
  const CASHIFY_API_KEY = process.env.CASHIFY_API_KEY || '';

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (CASHIFY_API_KEY) {
      headers['Authorization'] = `Bearer ${CASHIFY_API_KEY}`;
      headers['x-api-key'] = CASHIFY_API_KEY;
    }

    const url = `${CASHIFY_API_BASE}/sell/models?brand=${encodeURIComponent(brand)}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (Array.isArray(json?.data) && json.data.length > 0) {
        const formatted = json.data.map((item) => ({
          name: item.name || item.model_name || item.title,
          storages: Array.isArray(item.storages || item.variants) 
            ? item.storages.map(s => typeof s === 'string' ? s : s.name || `${s.size}GB`) 
            : ['64GB', '128GB', '256GB', '512GB'],
          cashify_id: item.id || item.model_id,
        })).filter(item => Boolean(item.name));

        if (formatted.length > 0) {
          return setCachedValue(cacheKey, formatted);
        }
      }
    }
  } catch (_e) {
    // Allow caller to fallback seamlessly
  }

  return null;
};

/**
 * Estimate mobile resale price using Cashify API schema
 */
export const fetchCashifyValuation = async (brand, model, storage) => {
  const CASHIFY_API_BASE = (process.env.CASHIFY_API_BASE || 'https://api.cashify.in/api/v1').replace(/\/$/, '');
  const CASHIFY_API_KEY = process.env.CASHIFY_API_KEY || '';

  if (!brand || !model) {
    throw createHttpError(400, 'brand and model are required for Cashify valuation.');
  }

  const cacheKey = `cashify:valuation:${brand.toLowerCase()}:${model.toLowerCase()}:${(storage || '').toLowerCase()}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 6);
  if (cached) return cached;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (CASHIFY_API_KEY) {
      headers['Authorization'] = `Bearer ${CASHIFY_API_KEY}`;
      headers['x-api-key'] = CASHIFY_API_KEY;
    }

    const res = await fetch(`${CASHIFY_API_BASE}/sell/estimate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ brand, model, storage }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json?.data) {
        return setCachedValue(cacheKey, json.data);
      }
    }
  } catch (_e) {
    // API unavailable
  }

  return null;
};
