import { createHttpError } from './error.js';
import { mobileCache, getCachedValue, setCachedValue } from './mobileApi.js';

export const CASHIFY_BRANDS = [
  'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Realme', 'Vivo', 'Oppo',
  'Motorola', 'Google', 'Nothing', 'Poco', 'Redmi', 'iQOO', 'Asus', 'Nokia', 'Infinix', 'Tecno', 'Lenovo'
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

function sanitizeSlugPart(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractPriceFromHtml(html) {
  const propMatch = html.match(/itemProp="price">([0-9]+)<\/span>/i);
  if (propMatch) return parseInt(propMatch[1], 10);

  const uptoMatch = html.match(/Get Upto<\/div><span[^>]*>₹\s*([0-9,]+)<\/span>/i);
  if (uptoMatch) return parseInt(uptoMatch[1].replace(/,/g, ''), 10);

  return 0;
}

/**
 * Scrapes live official buyback quote directly from cashify.in
 */
async function scrapeCashifyLive(brand, model, storage, ram = '') {
  const b = sanitizeSlugPart(brand);
  let m = sanitizeSlugPart(model);
  if (b && m.startsWith(b + '-')) {
    m = m.slice(b.length + 1);
  }

  const s = sanitizeSlugPart(storage).replace(/gb$/, '-gb').replace(/--+/g, '-');
  const r = sanitizeSlugPart(ram).replace(/gb$/, '-gb').replace(/--+/g, '-');

  const candidateSlugs = new Set();
  
  if (r && s) {
    candidateSlugs.add(`used-${b}-${m}-${r}-${s}`);
    candidateSlugs.add(`used-${m}-${r}-${s}`);
    candidateSlugs.add(`used-${b}-${m}-5g-${r}-${s}`);
    candidateSlugs.add(`used-${m}-5g-${r}-${s}`);
  }
  if (s) {
    candidateSlugs.add(`used-${b}-${m}-${s}`);
    candidateSlugs.add(`used-${m}-${s}`);
    candidateSlugs.add(`used-${b}-${m}-5g-${s}`);
    candidateSlugs.add(`used-${m}-5g-${s}`);
    candidateSlugs.add(`sell-${b}-${m}-${s}`);
    candidateSlugs.add(`sell-${m}-${s}`);
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
  };

  // 1. Direct candidate variant slug check
  for (const slug of candidateSlugs) {
    const url = `https://www.cashify.in/sell-old-mobile-phone/${slug}`;
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const html = await res.text();
        const price = extractPriceFromHtml(html);
        if (price > 0) {
          return { base_price: price, url, source: 'cashify_live_direct' };
        }
      }
    } catch (_e) {}
  }

  // 2. Discover variant via parent model landing page
  const parentSlugs = [
    `used-${b}-${m}`,
    `used-${m}`,
    `used-${b}-${m}-5g`,
    `used-${m}-5g`,
    `sell-${b}-${m}`,
  ];

  const mKeywords = m.split('-').filter(w => w.length >= 2 && w !== 'galaxy' && w !== 'phone');

  for (const pSlug of parentSlugs) {
    const pUrl = `https://www.cashify.in/sell-old-mobile-phone/${pSlug}`;
    try {
      const res = await fetch(pUrl, { headers, signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const html = await res.text();
        const links = [...html.matchAll(/href="(\/sell-old-mobile-phone\/used-[^"]+)"/g)].map(m => m[1]);
        const sMatch = s ? s.replace(/\s+/g, '-') : '';
        
        const matchingLink = links.find(l => {
          if (!sMatch || !l.includes(sMatch)) return false;
          return mKeywords.every(kw => l.includes(kw));
        }) || links.find(l => {
          if (!sMatch || !l.includes(sMatch)) return false;
          return mKeywords.some(kw => l.includes(kw));
        });

        if (matchingLink) {
          const varUrl = `https://www.cashify.in${matchingLink}`;
          const varRes = await fetch(varUrl, { headers, signal: AbortSignal.timeout(3500) });
          if (varRes.ok) {
            const varHtml = await varRes.text();
            const price = extractPriceFromHtml(varHtml);
            if (price > 0) {
              return { base_price: price, url: varUrl, source: 'cashify_live_discovered' };
            }
          }
        }
      }
    } catch (_e) {}
  }

  return null;
}

/**
 * Estimate mobile resale price using Cashify live scraper + internal caching
 */
export const fetchCashifyValuation = async (brand, model, storage, ram = '') => {
  if (!brand || !model) {
    throw createHttpError(400, 'brand and model are required for Cashify valuation.');
  }

  const cacheKey = `cashify:live:${brand.toLowerCase()}:${model.toLowerCase()}:${(storage || '').toLowerCase()}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 6); // 6 hours cache
  if (cached) return cached;

  try {
    const liveResult = await scrapeCashifyLive(brand, model, storage, ram);
    if (liveResult && liveResult.base_price > 0) {
      return setCachedValue(cacheKey, liveResult);
    }
  } catch (_e) {
    // Fallback to null
  }

  return null;
};
