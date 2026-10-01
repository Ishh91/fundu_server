import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const repairServiceItemSchema = createSchema({
  service_id: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  original_price: { type: Number, default: null },
  warranty: { type: String, default: '6 Months Warranty' },
  turnaround_time: { type: String, default: '30 Mins Doorstep' },
  is_available: { type: Boolean, default: true },
}, { _id: false });

const repairPriceCatalogSchema = createSchema({
  product_type: {
    type: String,
    enum: ['smartphone', 'laptop', 'tablet', 'smartwatch', 'audio', 'other'],
    default: 'smartphone',
    index: true,
  },
  brand: { type: String, required: true, trim: true, index: true },
  model: { type: String, required: true, trim: true, index: true },
  device_series: { type: String, default: null, trim: true },
  release_year: { type: Number, default: null },
  image_url: { type: String, default: null },
  base_repair_price: { type: Number, default: 499 },
  services: { type: [repairServiceItemSchema], default: [] },
  is_active: { type: Boolean, default: true, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Compound indexes for high performance querying
repairPriceCatalogSchema.index({ brand: 1, model: 1 });
repairPriceCatalogSchema.index({ product_type: 1, brand: 1, model: 1 });

export const RepairPriceCatalog =
  mongoose.models.RepairPriceCatalog || mongoose.model('RepairPriceCatalog', repairPriceCatalogSchema);
