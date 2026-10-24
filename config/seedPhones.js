import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MasterPhone } from '../models/MasterPhone.js';
import { SellPriceConfig } from '../models/SellPriceConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const catalogPath = path.join(__dirname, 'phonesCatalog.json');

function loadCatalog() {
  try {
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (err) {
    console.error('[AutoSync] Could not read phonesCatalog.json:', err.message);
    return [];
  }
}

export let INDIAN_MARKET_PHONES_LAST_10_YEARS = loadCatalog();

/**
 * Automatically synchronizes phonesCatalog.json into both:
 * 1. MasterPhone collection (used by customer sell search & catalog)
 * 2. SellPriceConfig collection (used by Admin Sell Pricing dashboard)
 */
export async function ensureMasterPhonesSeeded(force = true) {
  try {
    const currentCatalog = loadCatalog();
    if (!currentCatalog || currentCatalog.length === 0) return;
    INDIAN_MARKET_PHONES_LAST_10_YEARS = currentCatalog;

    console.log(`[AutoSync] Synchronizing ${currentCatalog.length} models into database masterphones & sellpriceconfigs...`);

    // 1. Bulk Upsert into MasterPhone
    const masterBulkOps = currentCatalog.map((phone) => {
      const price = phone.price || phone.base_resale_value || 12000;
      return {
        updateOne: {
          filter: { brand: phone.brand, model: phone.model },
          update: {
            $set: {
              brand: phone.brand,
              model: phone.model,
              release_year: phone.release_year || 2024,
              ram_options: phone.ram_options || ['6GB', '8GB', '12GB'],
              storage_options: phone.storage_options || ['128GB', '256GB'],
              default_mrp: phone.default_mrp || Math.round(price * 1.5),
              base_resale_value: price,
              price: price,
              image_url: phone.image_url || null,
              popular_tag: phone.popular_tag || `${phone.brand} Official Model`,
              processor: phone.processor || 'High-Performance Processor',
              camera_spec: phone.camera_spec || '50MP OIS Camera',
              battery_spec: phone.battery_spec || '5000 mAh Fast Charging',
              display_spec: phone.display_spec || 'AMOLED Display',
              is_5g: phone.is_5g !== false,
              is_active: phone.is_active !== false,
              updated_at: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    for (let i = 0; i < masterBulkOps.length; i += 200) {
      const chunk = masterBulkOps.slice(i, i + 200);
      await MasterPhone.bulkWrite(chunk, { ordered: false });
    }

    // 2. Bulk Upsert into SellPriceConfig (Admin Pricing Rules)
    const configBulkOps = currentCatalog.map((phone) => {
      let cleanModel = (phone.model || '').trim();
      const b = (phone.brand || '').trim();
      if (b && cleanModel.toLowerCase().startsWith(b.toLowerCase())) {
        cleanModel = cleanModel.slice(b.length).trim();
      }
      const stg = (phone.storage_options?.[0] || '128GB').replace(/\s+/g, '');
      const price = phone.price || phone.base_resale_value || 12000;

      return {
        updateOne: {
          filter: { brand: phone.brand, model: cleanModel },
          update: {
            $set: {
              brand: phone.brand,
              model: cleanModel,
              storage: stg,
              base_price: price,
              is_active: phone.is_active !== false,
              updated_at: new Date(),
            },
            $setOnInsert: {
              excellent_multiplier: 0.85,
              good_multiplier: 0.70,
              fair_multiplier: 0.55,
              box_bonus: 500,
              charger_bonus: 400,
              created_at: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    for (let i = 0; i < configBulkOps.length; i += 200) {
      const chunk = configBulkOps.slice(i, i + 200);
      await SellPriceConfig.bulkWrite(chunk, { ordered: false });
    }

    console.log(`[AutoSync] ✅ Master phones & Admin sell price configs automatically synchronized (${currentCatalog.length} models).`);
  } catch (err) {
    console.error(`[AutoSync] Error during catalog auto-sync:`, err.message);
  }
}

// 3. Live File Watcher: Automatically detects any changes to phonesCatalog.json and re-syncs
let isSyncing = false;
let watcherStarted = false;

export function startCatalogAutoWatcher() {
  if (watcherStarted) return;
  if (fs.existsSync(catalogPath)) {
    watcherStarted = true;
    fs.watchFile(catalogPath, { interval: 2500 }, async (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs && !isSyncing) {
        console.log(`[AutoSync] phonesCatalog.json change detected! Running auto-sync into database...`);
        isSyncing = true;
        try {
          await ensureMasterPhonesSeeded(true);
        } catch (e) {
          console.error('[AutoSync] Error:', e.message);
        } finally {
          isSyncing = false;
        }
      }
    });
    console.log('[AutoSync] Active file watcher enabled on phonesCatalog.json (auto-syncs to Admin & DB).');
  }
}
