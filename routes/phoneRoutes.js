import { Router } from 'express';
import { MasterPhone, SellPriceConfig } from '../models/index.js';
import { normalizeDoc } from '../utils/dbHelpers.js';
import { INDIAN_MARKET_PHONES_LAST_10_YEARS, ensureMasterPhonesSeeded } from '../config/seedPhones.js';
import {
  extractStorageOptions,
  extractRamOptions,
  formatMobileApiDevice,
  fetchMobileApiSearch,
  fetchMobileApiAutocomplete,
  fetchMobileApiDeviceById,
} from '../utils/mobileApi.js';

const router = Router();


/**
 * Universal Indian Smartphones Search API
 * GET /api/phones/search?query=iphone&brand=Apple&limit=30
 */
router.get('/search', async (req, res) => {
  try {
    const { query = '', brand = '', limit = '50', fetch_remote = 'true' } = req.query;
    const maxResults = Math.min(Number(limit) || 50, 100);

    const filter = {};
    if (brand && brand !== 'All') {
      filter.brand = new RegExp(`^${brand.trim()}$`, 'i');
    }
    if (query && query.trim()) {
      const q = query.trim();
      filter.$or = [
        { model: new RegExp(q, 'i') },
        { brand: new RegExp(q, 'i') },
        { popular_tag: new RegExp(q, 'i') },
        { processor: new RegExp(q, 'i') },
      ];
    }

    let phones = await MasterPhone.find(filter)
      .sort({ release_year: -1, base_resale_value: -1 })
      .limit(maxResults);

    // If local DB or memory catalog matches
    let results = normalizeDoc(phones);

    if (results.length === 0) {
      let filtered = INDIAN_MARKET_PHONES_LAST_10_YEARS;
      if (brand && brand !== 'All') {
        filtered = filtered.filter((p) => p.brand.toLowerCase() === brand.toLowerCase());
      }
      if (query && query.trim()) {
        const q = query.toLowerCase().trim();
        filtered = filtered.filter((p) => `${p.brand} ${p.model} ${p.release_year}`.toLowerCase().includes(q));
      }
      results = filtered;
    }

    // If still no results and user provided a query, query https://mobileapi.dev live!
    if (results.length === 0 && query && fetch_remote !== 'false') {
      const searchRes = await fetchMobileApiSearch(query, brand, 1);
      const remoteDevices = searchRes.devices || [];
      if (remoteDevices.length > 0) {
        return res.json({
          data: remoteDevices.slice(0, maxResults),
          total: remoteDevices.length,
          source: 'https://mobileapi.dev/',
        });
      }
    }

    return res.json({
      data: results.slice(0, maxResults),
      total: results.length,
      source: phones.length > 0 ? 'database' : 'indian_catalog',
    });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Live Autocomplete on https://mobileapi.dev/
 * GET /api/phones/mobileapi/autocomplete?q=iPhone
 */
router.get('/mobileapi/autocomplete', async (req, res) => {
  try {
    const { q = '', limit = '10' } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.json({ data: [], count: 0 });
    }

    const suggestions = await fetchMobileApiAutocomplete(String(q).trim(), Math.min(Number(limit) || 10, 50));
    return res.json({
      data: suggestions,
      count: suggestions.length,
      provider: 'https://mobileapi.dev/',
    });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Direct search on https://mobileapi.dev/
 * GET /api/phones/mobileapi/search?query=Galaxy+S24&brand=Samsung&page=1
 */
router.get('/mobileapi/search', async (req, res) => {
  try {
    const { query = '', brand = '', page = '1' } = req.query;
    if (!query && !brand) {
      return res.status(400).json({ error: { message: 'query or brand parameter required' } });
    }

    const searchRes = await fetchMobileApiSearch(query || brand, brand, Math.max(Number(page) || 1, 1));
    const devices = searchRes.devices || [];

    return res.json({
      data: devices,
      total: searchRes.total || devices.length,
      page: searchRes.page || 1,
      provider: 'https://mobileapi.dev/',
    });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});


/**
 * 1-Click Import a phone from https://mobileapi.dev into Fundu's database
 * POST /api/phones/mobileapi/import
 */
router.post('/mobileapi/import', async (req, res) => {
  try {
    const body = req.body;
    if (!body.brand || !body.model) {
      return res.status(400).json({ error: { message: 'brand and model required' } });
    }

    const payload = {
      brand: body.brand.trim(),
      model: body.model.trim(),
      release_year: Number(body.release_year) || 2024,
      ram_options: Array.isArray(body.ram_options) ? body.ram_options : ['8GB', '12GB'],
      storage_options: Array.isArray(body.storage_options) ? body.storage_options : ['128GB', '256GB'],
      default_mrp: Number(body.default_mrp) || 39999,
      base_resale_value: Number(body.base_resale_value) || 22000,
      popular_tag: body.popular_tag || `${body.brand} 5G Device`,
      processor: body.processor || 'Octa-core Processor',
      camera_spec: body.camera_spec || '50MP OIS Camera',
      battery_spec: body.battery_spec || '5000 mAh Fast Charging',
      display_spec: body.display_spec || '6.7" AMOLED 120Hz',
      image_url: body.image_url || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
      is_5g: body.is_5g !== false,
      is_active: true,
    };

    const doc = await MasterPhone.findOneAndUpdate(
      { brand: payload.brand, model: payload.model },
      { $set: payload },
      { upsert: true, new: true }
    );

    // Also create sell price config rule if not exists
    for (const stg of payload.storage_options) {
      let baseVal = payload.base_resale_value;
      if (stg.includes('256')) baseVal = Math.round(baseVal * 1.08);
      else if (stg.includes('512') || stg.includes('1TB')) baseVal = Math.round(baseVal * 1.18);

      await SellPriceConfig.findOneAndUpdate(
        { brand: payload.brand, model: payload.model, storage: stg },
        {
          $set: {
            brand: payload.brand,
            model: payload.model,
            storage: stg,
            base_price: baseVal,
            excellent_multiplier: 0.80,
            good_multiplier: 0.65,
            fair_multiplier: 0.50,
            box_bonus: 600,
            charger_bonus: 400,
            is_active: true,
          },
        },
        { upsert: true }
      );
    }

    return res.json({
      data: normalizeDoc(doc),
      message: `Successfully imported "${payload.brand} ${payload.model}" from MobileAPI.dev into Fundu database!`,
    });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Get all Indian smartphone models
 * GET /api/phones/all
 */
router.get('/all', async (_req, res) => {
  try {
    const phones = await MasterPhone.find({}).sort({ release_year: -1, brand: 1 });
    if (phones.length > 0) {
      return res.json({ data: normalizeDoc(phones), count: phones.length });
    }
    return res.json({ data: INDIAN_MARKET_PHONES_LAST_10_YEARS, count: INDIAN_MARKET_PHONES_LAST_10_YEARS.length });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Get specs for a specific smartphone
 * GET /api/phones/specs?brand=Samsung&model=Galaxy S24 Ultra
 */
router.get('/specs', async (req, res) => {
  try {
    const { brand, model } = req.query;
    if (!brand || !model) {
      return res.status(400).json({ error: { message: 'brand and model parameters required' } });
    }

    let phone = await MasterPhone.findOne({
      brand: new RegExp(`^${brand.trim()}$`, 'i'),
      model: new RegExp(`^${model.trim()}$`, 'i'),
    });

    if (!phone) {
      phone = INDIAN_MARKET_PHONES_LAST_10_YEARS.find(
        (p) => p.brand.toLowerCase() === brand.toLowerCase() && p.model.toLowerCase() === model.toLowerCase()
      );
    }

    if (!phone) {
      // Try searching mobileapi.dev live
      const searchRes = await fetchMobileApiSearch(model, brand);
      if (searchRes.devices && searchRes.devices.length > 0) {
        phone = searchRes.devices[0];
      }
    }

    if (!phone) {
      phone = {
        brand,
        model,
        release_year: 2024,
        ram_options: ['8GB', '12GB'],
        storage_options: ['128GB', '256GB', '512GB'],
        default_mrp: 34999,
        base_resale_value: 18000,
        popular_tag: 'Indian 5G Smartphone',
        processor: 'High-performance Octa-core 5G',
        camera_spec: '50MP AI Triple Camera with OIS',
        battery_spec: '5000 mAh Fast Charging',
        display_spec: '6.7" AMOLED 120Hz FHD+',
        is_5g: true,
      };
    }

    return res.json({ data: normalizeDoc(phone) });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Add a custom / newly launched Indian smartphone model
 * POST /api/phones/custom
 */
router.post('/custom', async (req, res) => {
  try {
    const body = req.body;
    if (!body.brand || !body.model) {
      return res.status(400).json({ error: { message: 'Brand and Model are required' } });
    }

    const payload = {
      brand: body.brand.trim(),
      model: body.model.trim(),
      release_year: Number(body.release_year) || new Date().getFullYear(),
      ram_options: Array.isArray(body.ram_options) ? body.ram_options : ['8GB', '12GB'],
      storage_options: Array.isArray(body.storage_options) ? body.storage_options : ['128GB', '256GB'],
      default_mrp: Number(body.default_mrp) || 29999,
      base_resale_value: Number(body.base_resale_value) || 16000,
      image_url: body.image_url || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
      popular_tag: body.popular_tag || 'Latest Launch',
      processor: body.processor || 'Octa-core 5G Processor',
      camera_spec: body.camera_spec || '50MP OIS Camera',
      battery_spec: body.battery_spec || '5000 mAh Fast Charging',
      display_spec: body.display_spec || '6.7" AMOLED 120Hz',
      is_5g: body.is_5g !== false,
      is_active: true,
    };

    const doc = await MasterPhone.findOneAndUpdate(
      { brand: payload.brand, model: payload.model },
      { $set: payload },
      { upsert: true, new: true }
    );

    return res.json({ data: normalizeDoc(doc), message: 'Phone model successfully saved to Indian catalog' });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * 1-Click Bulk Seed / Sync all Indian phones into Database
 * POST /api/phones/bulk-sync
 */
router.post('/bulk-sync', async (_req, res) => {
  try {
    await ensureMasterPhonesSeeded();
    const count = await MasterPhone.countDocuments();
    return res.json({ message: 'Catalog synced successfully', count });
  } catch (error) {
    return res.status(500).json({ error: { message: error.message } });
  }
});

export default router;
