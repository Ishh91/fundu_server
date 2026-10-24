import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  quotePhone,
  recalculateInspectedQuote,
  lookupResaleBenchmark,
  lookupModelRepairs,
  FUNDU_POLICY,
  FUNDU_SERVICE_LOCALITIES,
  RESALE_BENCHMARKS,
  CONFIGURED_REPAIRS,
} from '../../fundu_phone_quote.mjs';
import { SellRequest } from '../models/SellRequest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const catalogPath = path.join(__dirname, '../config/phonesCatalog.json');

function getCatalogPhone(brand, model) {
  try {
    const raw = fs.readFileSync(catalogPath, 'utf8');
    const catalog = JSON.parse(raw);
    const bNorm = (brand || '').toLowerCase().trim();
    let mNorm = (model || '').toLowerCase().trim();
    mNorm = mNorm
      .replace(/^(sell-old-|old-sell-|sell-|old-|used-)+/g, '')
      .replace(/^(sell\s+|old\s+|used\s+)+/g, '')
      .trim();
    if (bNorm && mNorm.startsWith(bNorm)) {
      mNorm = mNorm.slice(bNorm.length).trim();
    }
    const stripped = mNorm.replace(/[\s-]+/g, '');

    // 1. Exact match first
    let match = catalog.find((p) => {
      const pb = (p.brand || '').toLowerCase().trim();
      if (pb !== bNorm && !bNorm.includes(pb)) return false;
      let pm = (p.model || '').toLowerCase().trim();
      if (pb && pm.startsWith(pb)) pm = pm.slice(pb.length).trim();
      const pStripped = pm.replace(/[\s-]+/g, '');
      return pStripped === stripped || pm === mNorm;
    });

    if (match) return match;

    // 2. Fallback substring match
    return catalog.find((p) => {
      const pb = (p.brand || '').toLowerCase().trim();
      if (pb !== bNorm && !bNorm.includes(pb)) return false;
      let pm = (p.model || '').toLowerCase().trim();
      if (pb && pm.startsWith(pb)) pm = pm.slice(pb.length).trim();
      const pStripped = pm.replace(/[\s-]+/g, '');
      return pStripped.includes(stripped) || stripped.includes(pStripped);
    });
  } catch {
    return null;
  }
}

// In-memory audit registry (and persistent fallback if DB disconnected)
const quoteAuditRegistry = new Map();

/**
 * Service wrapper for creating a validated, audited Fundu phone buyback quote
 */
export async function createPhoneQuote(input, options = {}) {
  // Sanitize model name
  let cleanModel = (input.model || '').trim();
  cleanModel = cleanModel
    .replace(/^(sell-old-|old-sell-|sell-|old-|used-)+/i, '')
    .replace(/^(sell\s+|old\s+|used\s+)+/i, '')
    .trim();
  const bNorm = (input.brand || '').toLowerCase().trim();
  if (bNorm && cleanModel.toLowerCase().startsWith(bNorm)) {
    cleanModel = cleanModel.slice(bNorm.length).trim();
  }

  const catalogItem = getCatalogPhone(input.brand, cleanModel);
  const enrichedOptions = { ...options };
  const enrichedInput = { ...input, model: cleanModel };

  if (catalogItem && (catalogItem.price || catalogItem.base_resale_value)) {
    enrichedOptions.catalogPrice = catalogItem.price || catalogItem.base_resale_value;
    enrichedOptions.isDirectBuybackPrice = true;
    enrichedOptions.cleanedModel = catalogItem.model;
  }

  const result = quotePhone(enrichedInput, enrichedOptions);

  if (result.status === 'quoted' && result._internalAudit) {
    quoteAuditRegistry.set(result.quoteId, result._internalAudit);
  }

  // Strip _internalAudit for the customer response to keep margins & reserves confidential
  const { _internalAudit, ...publicQuote } = result;

  return {
    ...publicQuote,
    // Keep internal audit reference token
    auditRegistered: !!_internalAudit,
  };
}

/**
 * Retrieve the internal audit record for a given quoteId
 */
export function getQuoteAudit(quoteId) {
  return quoteAuditRegistry.get(quoteId) || null;
}

/**
 * Recalculate quote upon physical doorstep inspection
 */
export async function processInspectionMismatch(quoteIdOrAudit, inspectedAnswers, sellRequestId = null) {
  let audit = null;

  if (typeof quoteIdOrAudit === 'string') {
    audit = getQuoteAudit(quoteIdOrAudit);
  } else if (quoteIdOrAudit && typeof quoteIdOrAudit === 'object') {
    audit = quoteIdOrAudit;
  }

  // If audit record not in memory, try finding the SellRequest in MongoDB
  if (!audit && sellRequestId) {
    try {
      const sellDoc = await SellRequest.findById(sellRequestId);
      if (sellDoc) {
        audit = {
          quoteId: sellDoc._id.toString(),
          variant: {
            brand: sellDoc.brand,
            model: sellDoc.model,
            storage: sellDoc.storage || '128 GB',
          },
          conditionAnswers: {
            powers_on: sellDoc.diagnostics?.screen_touch !== false,
            cosmetic_condition: sellDoc.condition?.toLowerCase() || 'good',
            screen_condition: sellDoc.screen_condition || 'flawless',
            body_condition: sellDoc.body_condition || 'flawless',
            battery_health: sellDoc.diagnostics?.battery_health || 'healthy',
            defects: sellDoc.defects || [],
            accessories: sellDoc.accessories || [],
            under_warranty: sellDoc.under_warranty || false,
          },
          economics: {
            finalOfferAmount: sellDoc.estimated_price || sellDoc.valuation_price || 0,
          },
        };
      }
    } catch {
      // Continue
    }
  }

  if (!audit) {
    throw new Error('Initial quote audit record could not be located.');
  }

  const mismatchResult = recalculateInspectedQuote(audit, inspectedAnswers);

  // If linked to a SellRequest and mismatch exists, update the database record
  if (sellRequestId && mismatchResult.hasMismatch) {
    try {
      await SellRequest.findByIdAndUpdate(sellRequestId, {
        $set: {
          vendor_quote_status: 'quoted',
          vendor_quote_price: mismatchResult.revisedOffer,
          vendor_notes: mismatchResult.mismatchExplanations.join('; '),
          status: 'inspection_mismatch',
        },
      });
    } catch (err) {
      console.warn('Notice: Failed to update sell_request for inspection mismatch:', err?.message);
    }
  }

  return mismatchResult;
}

export {
  quotePhone,
  recalculateInspectedQuote,
  lookupResaleBenchmark,
  lookupModelRepairs,
  FUNDU_POLICY,
  FUNDU_SERVICE_LOCALITIES,
  RESALE_BENCHMARKS,
  CONFIGURED_REPAIRS,
};
