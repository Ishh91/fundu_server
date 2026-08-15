import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const sellRequestSchema = createSchema({
  user_id: { type: String, default: null },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  ram: { type: String, default: null },
  storage: { type: String, default: null },
  condition: { type: String, default: 'Good' },
  imei: { type: String, default: null },
  imei_photo: { type: String, default: null },
  device_photos: {
    front: { type: String, default: null },
    back: { type: String, default: null },
    edges: { type: String, default: null },
    bill_box: { type: String, default: null },
  },
  diagnostics: {
    screen_touch: { type: Boolean, default: true },
    cameras: { type: Boolean, default: true },
    battery_health: { type: String, default: null },
    biometrics: { type: Boolean, default: true },
    speaker_mic: { type: Boolean, default: true },
    charging_port: { type: Boolean, default: true },
  },
  accessories: { type: [String], default: [] },
  estimated_price: { type: Number, default: null },
  final_price: { type: Number, default: null },
  status: {
    type: String,
    default: 'pending',
  },
  pickup_address: { type: String, default: null },
  pickup_area: { type: String, default: null },
  pickup_date: { type: String, default: null },
  pickup_slot: { type: String, default: null },
  notes: { type: String, default: null },
  assigned_agent_id: { type: String, default: null },
  pickup_person_name: { type: String, default: null },
  pickup_person_phone: { type: String, default: null },
  estimated_arrival_time: { type: String, default: null },
  payout_method: { type: String, default: 'UPI / Spot Cash' },
  payout_details: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const SellRequest = mongoose.models.SellRequest || mongoose.model('SellRequest', sellRequestSchema);
