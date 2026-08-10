import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const productSchema = createSchema({
  title: { type: String, required: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  ram: { type: String, default: null },
  storage: { type: String, default: null },
  color: { type: String, default: null },
  condition: { type: String, enum: ['Excellent', 'Good', 'Fair'], required: true },
  price: { type: Number, required: true },
  original_price: { type: Number, default: null },
  discount_percent: { type: Number, default: 0 },
  warranty_months: { type: Number, default: 6 },
  offer_tag: { type: String, default: null },
  description: { type: String, default: null },
  images: { type: [String], default: [] },
  is_approved: { type: Boolean, default: false },
  is_featured: { type: Boolean, default: false },
  stock: { type: Number, default: 1 },
  sold_count: { type: Number, default: 0 },
  seller_id: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
