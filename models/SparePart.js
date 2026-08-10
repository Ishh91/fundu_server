import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const sparePartSchema = createSchema({
  title: { type: String, required: true },
  brand: { type: String, default: null },
  category: { type: String, required: true },
  compatible_models: { type: [String], default: [] },
  price: { type: Number, required: true },
  original_price: { type: Number, default: null },
  stock: { type: Number, default: 1 },
  description: { type: String, default: null },
  images: { type: [String], default: [] },
  seller_id: { type: String, default: null },
  is_approved: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export const SparePart = mongoose.models.SparePart || mongoose.model('SparePart', sparePartSchema);
