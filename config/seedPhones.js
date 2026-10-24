import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MasterPhone } from '../models/MasterPhone.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const catalogPath = path.join(__dirname, 'phonesCatalog.json');

let catalog = [];
try {
  catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
} catch (err) {
  console.error('[Seed] Could not read phonesCatalog.json:', err.message);
  catalog = [];
}

export const INDIAN_MARKET_PHONES_LAST_10_YEARS = catalog;

export async function ensureMasterPhonesSeeded(force = false) {
  try {
    const count = await MasterPhone.countDocuments();
    if (force || count < INDIAN_MARKET_PHONES_LAST_10_YEARS.length) {
      console.log(`[Seed] Syncing Indian Market Master Phones catalog (1,260+ models)...`);
      const bulkOps = INDIAN_MARKET_PHONES_LAST_10_YEARS.map((phone) => ({
        updateOne: {
          filter: { brand: phone.brand, model: phone.model },
          update: { $set: phone },
          upsert: true,
        },
      }));

      // Execute in chunks of 250 for optimal Mongo performance
      const chunkSize = 250;
      for (let i = 0; i < bulkOps.length; i += chunkSize) {
        const chunk = bulkOps.slice(i, i + chunkSize);
        await MasterPhone.bulkWrite(chunk, { ordered: false });
      }

      console.log(`[Seed] Master Phones catalog successfully populated with ${INDIAN_MARKET_PHONES_LAST_10_YEARS.length} models.`);
    }
  } catch (err) {
    console.error(`[Seed] Error seeding master phones catalog:`, err.message);
  }
}
