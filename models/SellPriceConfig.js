import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const sellPriceConfigSchema = createSchema({
  brand: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  storage: { type: String, default: null, trim: true },
  base_price: { type: Number, required: true },
  excellent_multiplier: { type: Number, default: 0.7 },
  good_multiplier: { type: Number, default: 0.55 },
  fair_multiplier: { type: Number, default: 0.4 },
  box_bonus: { type: Number, default: 500 },
  charger_bonus: { type: Number, default: 300 },
  is_active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const SellPriceConfig = mongoose.models.SellPriceConfig || mongoose.model('SellPriceConfig', sellPriceConfigSchema);
