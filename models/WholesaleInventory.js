import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const wholesaleInventorySchema = createSchema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  ram: { type: String, default: null },
  storage: { type: String, default: null },
  color: { type: String, default: null },
  condition: { type: String, enum: ['Flawless', 'Grade A', 'Grade B', 'Grade C', 'Excellent', 'Good', 'Fair'], default: 'Grade A' },
  imei: { type: String, default: null },
  wholesale_price: { type: Number, required: true },
  retail_price: { type: Number, default: null },
  stock: { type: Number, default: 1 },
  status: { type: String, enum: ['available', 'reserved', 'sold'], default: 'available' },
  source_sell_request_id: { type: String, default: null },
  device_photos: { type: [String], default: [] },
  diagnostics: {
    screen: { type: String, default: 'Working' },
    battery_health: { type: String, default: '85%+' },
    body_condition: { type: String, default: 'Clean' },
    cameras: { type: String, default: 'Tested OK' },
  },
  notes: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const WholesaleInventory = mongoose.models.WholesaleInventory || mongoose.model('WholesaleInventory', wholesaleInventorySchema);
