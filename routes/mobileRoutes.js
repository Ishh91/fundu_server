import { Router } from 'express';
import { SellPriceConfig } from '../models/index.js';
import { createHttpError } from '../utils/error.js';
import { normalizeDoc } from '../utils/dbHelpers.js';
import {
  DEFAULT_PHONE_BRANDS,
  extractStorageOptions,
  getCachedValue,
  mobileApiRequest,
  setCachedValue,
  fetchMobileApiAutocomplete,
  fetchMobileApiSearch,
  fetchMobileApiDeviceById,
  fetchMobileApiDeviceImages,
  fetchMobileApiManufacturers,
} from '../utils/mobileApi.js';
import {
  fetchCashifyBrands,
  fetchCashifyModels,
  fetchCashifyValuation,
} from '../utils/cashifyApi.js';
import { seedDatabase } from '../config/db.js';

const router = Router();


const FALLBACK_MODELS = {
  apple: [
    { name: 'iPhone 15 Pro Max', storages: ['256GB', '512GB', '1TB'] },
    { name: 'iPhone 15 Pro', storages: ['128GB', '256GB', '512GB', '1TB'] },
    { name: 'iPhone 15 Plus', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 15', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 14 Pro Max', storages: ['128GB', '256GB', '512GB', '1TB'] },
    { name: 'iPhone 14 Pro', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 14 Plus', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 14', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 13 Pro Max', storages: ['128GB', '256GB', '512GB', '1TB'] },
    { name: 'iPhone 13 Pro', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 13', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 13 mini', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 12 Pro Max', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 12 Pro', storages: ['128GB', '256GB', '512GB'] },
    { name: 'iPhone 12', storages: ['64GB', '128GB', '256GB'] },
    { name: 'iPhone 11', storages: ['64GB', '128GB', '256GB'] },
    { name: 'iPhone SE (2022)', storages: ['64GB', '128GB', '256GB'] },
  ],
  samsung: [
    { name: 'Galaxy S24 Ultra', storages: ['256GB', '512GB', '1TB'] },
    { name: 'Galaxy S24+', storages: ['256GB', '512GB'] },
    { name: 'Galaxy S24 5G', storages: ['128GB', '256GB', '512GB'] },
    { name: 'Galaxy S23 Ultra 5G', storages: ['256GB', '512GB', '1TB'] },
    { name: 'Galaxy S23 FE 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy S23 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy S22 Ultra 5G', storages: ['128GB', '256GB', '512GB'] },
    { name: 'Galaxy S22 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy S21 FE 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy Z Fold5', storages: ['256GB', '512GB', '1TB'] },
    { name: 'Galaxy Z Flip5', storages: ['256GB', '512GB'] },
    { name: 'Galaxy Z Fold4', storages: ['256GB', '512GB'] },
    { name: 'Galaxy Z Flip4', storages: ['128GB', '256GB'] },
    { name: 'Galaxy A55 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy A35 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy A54 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy A34 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy A15 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy M55 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy M34 5G', storages: ['128GB', '256GB'] },
    { name: 'Galaxy F54 5G', storages: ['256GB'] },
  ],
  oneplus: [
    { name: 'OnePlus 12', storages: ['256GB', '512GB'] },
    { name: 'OnePlus 12R', storages: ['128GB', '256GB'] },
    { name: 'OnePlus 11 5G', storages: ['128GB', '256GB'] },
    { name: 'OnePlus 11R 5G', storages: ['128GB', '256GB'] },
    { name: 'OnePlus 10 Pro 5G', storages: ['128GB', '256GB'] },
    { name: 'OnePlus 10R 5G', storages: ['128GB', '256GB'] },
    { name: 'OnePlus Nord 4 5G', storages: ['128GB', '256GB'] },
    { name: 'OnePlus Nord CE 4 5G', storages: ['128GB', '256GB'] },
    { name: 'OnePlus Nord 3 5G', storages: ['128GB', '256GB'] },
    { name: 'OnePlus Nord CE 3 5G', storages: ['128GB', '256GB'] },
  ],
  xiaomi: [
    { name: 'Xiaomi 14 Ultra', storages: ['512GB'] },
    { name: 'Xiaomi 14', storages: ['256GB', '512GB'] },
    { name: 'Xiaomi 13 Pro', storages: ['256GB', '512GB'] },
    { name: 'Redmi Note 13 Pro+ 5G', storages: ['256GB', '512GB'] },
    { name: 'Redmi Note 13 Pro 5G', storages: ['128GB', '256GB'] },
    { name: 'Redmi Note 13 5G', storages: ['128GB', '256GB'] },
    { name: 'Redmi Note 12 Pro 5G', storages: ['128GB', '256GB'] },
    { name: 'Poco X6 Pro 5G', storages: ['256GB', '512GB'] },
    { name: 'Poco F6 5G', storages: ['256GB', '512GB'] },
    { name: 'Poco M6 Pro 5G', storages: ['64GB', '128GB'] },
  ],
  vivo: [
    { name: 'Vivo X100 Pro', storages: ['512GB'] },
    { name: 'Vivo V30 Pro 5G', storages: ['256GB', '512GB'] },
    { name: 'Vivo V30 5G', storages: ['128GB', '256GB', '512GB'] },
    { name: 'Vivo V29 5G', storages: ['128GB', '256GB'] },
    { name: 'Vivo V29e 5G', storages: ['128GB', '256GB'] },
    { name: 'Vivo Y200 5G', storages: ['128GB', '256GB'] },
    { name: 'Vivo Y56 5G', storages: ['128GB'] },
  ],
  oppo: [
    { name: 'Oppo Reno 11 Pro 5G', storages: ['256GB'] },
    { name: 'Oppo Reno 11 5G', storages: ['128GB', '256GB'] },
    { name: 'Oppo F25 Pro 5G', storages: ['128GB', '256GB'] },
    { name: 'Oppo F23 5G', storages: ['256GB'] },
    { name: 'Oppo A79 5G', storages: ['128GB'] },
  ],
  realme: [
    { name: 'Realme GT 6 5G', storages: ['256GB', '512GB'] },
    { name: 'Realme 12 Pro+ 5G', storages: ['128GB', '256GB'] },
    { name: 'Realme 12 Pro 5G', storages: ['128GB', '256GB'] },
    { name: 'Realme 12+ 5G', storages: ['128GB', '256GB'] },
    { name: 'Realme 11 Pro+ 5G', storages: ['256GB', '512GB'] },
    { name: 'Realme Narzo 70 Pro 5G', storages: ['128GB', '256GB'] },
  ],
  google: [
    { name: 'Pixel 8a', storages: ['128GB', '256GB'] },
    { name: 'Pixel 8 Pro', storages: ['128GB', '256GB', '512GB'] },
    { name: 'Pixel 8', storages: ['128GB', '256GB'] },
    { name: 'Pixel 7a', storages: ['128GB'] },
    { name: 'Pixel 7 Pro', storages: ['128GB', '256GB'] },
    { name: 'Pixel 7', storages: ['128GB', '256GB'] },
    { name: 'Pixel 6a', storages: ['128GB'] },
  ],
  nothing: [
    { name: 'Nothing Phone (2)', storages: ['128GB', '256GB', '512GB'] },
    { name: 'Nothing Phone (2a)', storages: ['128GB', '256GB'] },
    { name: 'Nothing Phone (1)', storages: ['128GB', '256GB'] },
  ],
  motorola: [
    { name: 'Moto Edge 50 Ultra', storages: ['512GB'] },
    { name: 'Moto Edge 50 Pro 5G', storages: ['256GB', '512GB'] },
    { name: 'Moto Edge 50 Fusion', storages: ['128GB', '256GB'] },
    { name: 'Moto Edge 40 Neo', storages: ['128GB', '256GB'] },
    { name: 'Moto G84 5G', storages: ['256GB'] },
    { name: 'Moto G54 5G', storages: ['128GB', '256GB'] },
  ],
  poco: [
    { name: 'Poco X6 Pro 5G', storages: ['256GB', '512GB'] },
    { name: 'Poco F6 5G', storages: ['256GB', '512GB'] },
    { name: 'Poco X6 5G', storages: ['128GB', '256GB', '512GB'] },
    { name: 'Poco M6 Pro 5G', storages: ['64GB', '128GB'] },
  ],
  iqoo: [
    { name: 'iQOO 12 5G', storages: ['256GB', '512GB'] },
    { name: 'iQOO Neo 9 Pro 5G', storages: ['128GB', '256GB'] },
    { name: 'iQOO Z9 5G', storages: ['128GB', '256GB'] },
    { name: 'iQOO Neo 7 Pro 5G', storages: ['128GB', '256GB'] },
  ],
  infinix: [
    { name: 'Infinix Zero 30 5G', storages: ['256GB'] },
    { name: 'Infinix GT 20 Pro 5G', storages: ['256GB'] },
    { name: 'Infinix Note 40 Pro 5G', storages: ['256GB'] },
  ],
  tecno: [
    { name: 'Tecno Camon 30 5G', storages: ['256GB', '512GB'] },
    { name: 'Tecno Pova 6 Pro 5G', storages: ['128GB', '256GB'] },
  ],
  honor: [
    { name: 'Honor 200 5G', storages: ['256GB', '512GB'] },
    { name: 'Honor 90 5G', storages: ['256GB', '512GB'] },
  ],
};

function getFallbackModels(brand, query) {
  const list = FALLBACK_MODELS[brand.toLowerCase()] ?? [
    { name: `${brand} Phone Model 1`, storages: ['128GB', '256GB'] },
    { name: `${brand} Phone Model 2`, storages: ['128GB', '256GB'] },
  ];

  if (!query) return list;
  return list.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));
}

/**
 * Smart sorting prioritizing popular modern smartphone series
 */
function sortModernModels(models, brand) {
  const curated = FALLBACK_MODELS[brand.toLowerCase()] ?? [];
  const curatedNames = new Set(curated.map(c => c.name.toLowerCase()));

  // Modern series key terms
  const modernTerms = [
    'galaxy', 'iphone', 'oneplus', 'pixel', 'redmi', 'poco', 'vivo', 'reno',
    'realme', 'edge', 'phone', 'iqoo', 'nord', 'narzo', 'zero', 'camon', 'honor',
    'pro', 'ultra', 'max', 'plus', '5g', 'fold', 'flip'
  ];

  const scoreModel = (modelName) => {
    const lower = modelName.toLowerCase();
    let score = 0;

    // Highest priority for curated modern smartphone list
    if (curatedNames.has(lower)) score += 1000;

    // High priority for popular modern series names
    if (modernTerms.some(t => lower.includes(t))) score += 500;

    // Filter out ancient 2G feature phones or single word legacy numbers like "360 H1", "A5 Duo"
    if (/^(360|a\d|b\d|c\d|e\d|f\d|g\d|u\d)\b/i.test(lower)) score -= 200;
    if (/\b(cdma|duos|guru|duo|metro|focus|contour|aviator)\b/i.test(lower)) score -= 300;

    return score;
  };

  return models.sort((a, b) => {
    const scoreA = scoreModel(a.name);
    const scoreB = scoreModel(b.name);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.name.localeCompare(b.name);
  });
}

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.all('/seed', async (_req, res, next) => {
  try {
    await seedDatabase();
    res.json({ message: 'Database seed process completed successfully.' });
  } catch (error) {
    next(error);
  }
});

router.get('/mobile/brands', async (_req, res, next) => {
  try {
    const cacheKey = 'mobile-brands';
    const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 24);
    if (cached) {
      res.json({ data: cached });
      return;
    }

    // Try fetching live manufacturers from mobileapi.dev
    try {
      const liveManufacturers = await fetchMobileApiManufacturers(1);
      if (Array.isArray(liveManufacturers) && liveManufacturers.length > 0) {
        const liveBrandNames = liveManufacturers.map((m) => m.name).filter(Boolean);
        // Combine default top Indian brands with live brands
        const combined = Array.from(new Set([...DEFAULT_PHONE_BRANDS, ...liveBrandNames]));
        res.json({ data: setCachedValue(cacheKey, combined) });
        return;
      }
    } catch (_e) {
      // Fallback seamlessly to default brands
    }

    res.json({ data: setCachedValue(cacheKey, DEFAULT_PHONE_BRANDS) });
  } catch (error) {
    next(error);
  }
});

/**
 * Live Autocomplete for devices from https://mobileapi.dev/devices/autocomplete/
 * GET /api/mobile/autocomplete?q=iPhone&limit=10
 */
router.get('/mobile/autocomplete', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    if (!query || query.length < 2) {
      return res.json({ data: [] });
    }

    const suggestions = await fetchMobileApiAutocomplete(query, limit);
    return res.json({ data: suggestions, count: suggestions.length, provider: 'https://mobileapi.dev/' });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Direct Live Device Search on https://mobileapi.dev/devices/search/
 * GET /api/mobile/search?query=iPhone+15&brand=Apple&page=1
 */
router.get('/mobile/search', async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const page = Math.max(Number(req.query.page) || 1, 1);

    if (!query && !brand) {
      return res.status(400).json({ error: { message: 'query or brand parameter is required' } });
    }

    const result = await fetchMobileApiSearch(query || brand, brand, page);
    return res.json({
      data: result.devices,
      total: result.total,
      page: result.page,
      provider: 'https://mobileapi.dev/',
    });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Get Device by ID from https://mobileapi.dev/devices/{id}/
 * GET /api/mobile/devices/:id
 */
router.get('/mobile/devices/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Device ID required' } });
    }

    const device = await fetchMobileApiDeviceById(id);
    if (!device) {
      return res.status(404).json({ error: { message: 'Device not found on MobileAPI.dev' } });
    }

    return res.json({ data: device, provider: 'https://mobileapi.dev/' });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Get Device Images from https://mobileapi.dev/devices/{id}/images/
 * GET /api/mobile/devices/:id/images
 */
router.get('/mobile/devices/:id/images', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: { message: 'Device ID required' } });
    }

    const images = await fetchMobileApiDeviceImages(id);
    return res.json({ data: images, count: images.length, provider: 'https://mobileapi.dev/' });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Get Manufacturers list from https://mobileapi.dev/manufacturers/
 * GET /api/mobile/manufacturers?page=1
 */
router.get('/mobile/manufacturers', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const manufacturers = await fetchMobileApiManufacturers(page);
    return res.json({ data: manufacturers, count: manufacturers.length, provider: 'https://mobileapi.dev/' });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

router.get('/mobile/models', async (req, res) => {
  const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const provider = typeof req.query.provider === 'string' ? req.query.provider.trim().toLowerCase() : 'auto';

  if (!brand) {
    res.status(400).json({ error: 'brand is required.' });
    return;
  }

  const searchQuery = query.length >= 2 ? query : brand;
  const cacheKey = `model-search:${provider}:${brand.toLowerCase()}:${searchQuery.toLowerCase()}`;
  const cached = getCachedValue(cacheKey, 1000 * 60 * 60 * 12);

  if (cached) {
    res.json({ data: cached });
    return;
  }

  // 1. Try MobileAPI.dev first (api.mobileapi.dev) when mobileapi or auto is requested
  if (provider === 'mobileapi' || provider === 'auto') {
    try {
      const searchRes = await fetchMobileApiSearch(query, brand, 1);
      if (searchRes.devices && searchRes.devices.length > 0) {
        const modelMap = new Map();

        // Seed with curated modern models first
        const curatedList = getFallbackModels(brand, query);
        curatedList.forEach((item) => {
          modelMap.set(item.name.toLowerCase(), { name: item.name, storages: new Set(item.storages) });
        });

        searchRes.devices.forEach((device) => {
          const modelName = String(device.model || device.name || '').trim();
          if (!modelName) return;

          const key = modelName.toLowerCase();
          const existing = modelMap.get(key) ?? { name: modelName, storages: new Set() };
          (device.storage_options || []).forEach((stg) => existing.storages.add(stg));
          modelMap.set(key, existing);
        });

        const rawModels = Array.from(modelMap.values()).map((entry) => ({
          name: entry.name,
          storages: Array.from(entry.storages),
        }));

        const sortedModels = sortModernModels(rawModels, brand);
        if (sortedModels.length > 0) {
          setCachedValue(cacheKey, sortedModels);
          res.json({ data: sortedModels, provider: 'mobileapi' });
          return;
        }
      }
    } catch (_err) {
      // Seamless fallback
    }
  }

  // 2. Try Cashify API if requested or in auto mode
  if (provider === 'cashify' || provider === 'auto') {
    try {
      const cashifyModels = await fetchCashifyModels(brand, query);
      if (Array.isArray(cashifyModels) && cashifyModels.length > 0) {
        const sorted = sortModernModels(cashifyModels, brand);
        setCachedValue(cacheKey, sorted);
        res.json({ data: sorted, provider: 'cashify' });
        return;
      }
    } catch (_e) {
      // Fallback seamlessly to local catalog
    }
  }

  // 3. Fallback to curated local models
  const fallback = sortModernModels(getFallbackModels(brand, query), brand);
  setCachedValue(cacheKey, fallback);
  res.json({ data: fallback, provider: 'local' });
});


router.get('/mobile/cashify/models', async (req, res) => {
  const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';

  if (!brand) {
    res.status(400).json({ error: 'brand is required.' });
    return;
  }

  const models = await fetchCashifyModels(brand, query);
  if (!models || models.length === 0) {
    const fallback = getFallbackModels(brand, query);
    res.json({ data: fallback, provider: 'fallback' });
    return;
  }

  res.json({ data: models, provider: 'cashify' });
});

router.get('/mobile/cashify/estimate', async (req, res, next) => {
  try {
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const model = typeof req.query.model === 'string' ? req.query.model.trim() : '';
    const storage = typeof req.query.storage === 'string' ? req.query.storage.trim() : '';

    if (!brand || !model) {
      res.status(400).json({ error: 'brand and model are required.' });
      return;
    }

    const valuation = await fetchCashifyValuation(brand, model, storage);
    res.json({ data: valuation });
  } catch (error) {
    next(error);
  }
});

router.get('/sell-pricing/config', async (req, res, next) => {
  try {
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';
    const model = typeof req.query.model === 'string' ? req.query.model.trim() : '';
    const storage = typeof req.query.storage === 'string' ? req.query.storage.trim() : '';

    if (!brand || !model) {
      throw createHttpError(400, 'brand and model are required.');
    }

    let config = null;

    if (storage) {
      config = await SellPriceConfig.findOne({
        brand,
        model,
        storage,
        is_active: true,
      });
    }

    if (!config) {
      config = await SellPriceConfig.findOne({
        brand,
        model,
        storage: null,
        is_active: true,
      });
    }

    if (config) {
      res.json({ data: normalizeDoc(config), source: 'admin_database' });
      return;
    }

    // Try Cashify Valuation API if no admin config exists in database
    const cashifyValuation = await fetchCashifyValuation(brand, model, storage);
    if (cashifyValuation && typeof cashifyValuation.base_price === 'number') {
      res.json({
        data: {
          id: `cashify-${brand}-${model}`,
          brand,
          model,
          storage: storage || null,
          base_price: cashifyValuation.base_price,
          excellent_multiplier: cashifyValuation.excellent_multiplier || 0.75,
          good_multiplier: cashifyValuation.good_multiplier || 0.60,
          fair_multiplier: cashifyValuation.fair_multiplier || 0.45,
          box_bonus: cashifyValuation.box_bonus || 600,
          charger_bonus: cashifyValuation.charger_bonus || 400,
          is_active: true,
        },
        source: 'cashify_api',
      });
      return;
    }

    res.json({ data: null, source: 'none' });
  } catch (error) {
    next(error);
  }
});

export default router;
