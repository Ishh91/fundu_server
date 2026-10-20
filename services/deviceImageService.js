import { mobileApiRequest, getCachedValue, setCachedValue } from '../utils/mobileApi.js';
import { MasterPhone } from '../models/MasterPhone.js';

/**
 * Intelligent Smartphone Studio Image Resolver
 * Primary (Option A): MobileAPI.dev
 * Backup  (Option B): RapidAPI - GSM Arena Specs API
 * Fallback: Verified Studio Family Renders
 */
export async function resolveDeviceImage(brand, model) {
  if (!brand || !model) return null;
  const cleanBrand = String(brand).trim();
  const cleanModel = String(model).trim();
  const cacheKey = `device_img:${cleanBrand.toLowerCase()}:${cleanModel.toLowerCase()}`;

  // 1. Check in-memory cache
  const memCached = getCachedValue(cacheKey, 1000 * 60 * 60 * 24 * 7); // 7 days
  if (memCached) {
    return { imageUrl: memCached, source: 'memory_cache' };
  }

  // 2. Check Database cache (MasterPhone) if DB is connected
  try {
    if (MasterPhone.db && MasterPhone.db.readyState === 1) {
      const dbPhone = await MasterPhone.findOne({
        brand: new RegExp(`^${cleanBrand}$`, 'i'),
        model: new RegExp(`^${cleanModel}$`, 'i'),
        image_url: { $exists: true, $ne: null, $ne: '' }
      });
      if (dbPhone && dbPhone.image_url && !dbPhone.image_url.includes('unsplash.com')) {
        setCachedValue(cacheKey, dbPhone.image_url);
        return { imageUrl: dbPhone.image_url, source: 'db_cache' };
      }
    }
  } catch (err) {
    console.warn('[resolveDeviceImage] DB cache lookup error:', err.message);
  }

  // 3. Option A (Primary): MobileAPI.dev
  try {
    let queryTerm = cleanModel;
    if (!cleanModel.toLowerCase().startsWith(cleanBrand.toLowerCase())) {
      queryTerm = `${cleanBrand} ${cleanModel}`;
    }

    const payload = await mobileApiRequest('/devices/autocomplete/', {
      q: queryTerm,
      limit: 10,
    });

    const results = Array.isArray(payload) ? payload : (payload?.value || []);
    if (results.length > 0) {
      const modelLower = cleanModel.toLowerCase();
      let best = results.find(r => 
        (r.name && r.name.toLowerCase() === modelLower) || 
        (r.full_name && r.full_name.toLowerCase().includes(modelLower))
      );
      if (!best) best = results[0];

      if (best && best.id) {
        const thumbUrl = `https://api.mobileapi.dev/devices/${best.id}/thumb.png`;
        setCachedValue(cacheKey, thumbUrl);

        // Update database in background for permanent persistence
        MasterPhone.updateOne(
          { brand: new RegExp(`^${cleanBrand}$`, 'i'), model: new RegExp(`^${cleanModel}$`, 'i') },
          { $set: { image_url: thumbUrl } }
        ).catch(() => {});

        return { 
          imageUrl: thumbUrl, 
          source: 'option_a_mobileapi', 
          deviceId: best.id, 
          title: best.full_name || best.name 
        };
      }
    }
  } catch (err) {
    console.warn('[resolveDeviceImage] Option A (MobileAPI) failed:', err.message);
  }

  // 4. Option B (Backup): RapidAPI GSM Arena Specs API
  try {
    const rapidKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY || process.env.VITE_RAPIDAPI_KEY;
    if (rapidKey) {
      const searchRes = await fetch(`https://gsmarena4.p.rapidapi.com/search/${encodeURIComponent(cleanBrand + ' ' + cleanModel)}`, {
        headers: {
          'x-rapidapi-key': rapidKey,
          'x-rapidapi-host': 'gsmarena4.p.rapidapi.com'
        }
      });
      if (searchRes.ok) {
        const gsmData = await searchRes.json();
        const firstMatch = gsmData?.data?.[0];
        if (firstMatch && firstMatch.image) {
          const gsmImg = firstMatch.image;
          setCachedValue(cacheKey, gsmImg);
          MasterPhone.updateOne(
            { brand: new RegExp(`^${cleanBrand}$`, 'i'), model: new RegExp(`^${cleanModel}$`, 'i') },
            { $set: { image_url: gsmImg } }
          ).catch(() => {});
          return { 
            imageUrl: gsmImg, 
            source: 'option_b_rapidapi_gsmarena', 
            title: firstMatch.name 
          };
        }
      }
    }
  } catch (err) {
    console.warn('[resolveDeviceImage] Option B (RapidAPI) failed:', err.message);
  }

  // 5. Fallback: Clean Verified Brand/Family Renders
  return null;
}
