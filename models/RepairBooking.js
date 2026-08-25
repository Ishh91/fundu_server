import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const repairBookingSchema = createSchema({
  user_id: { type: String, default: null },
  customer_name: { type: String, default: null },
  customer_phone: { type: String, default: null },
  customer_email: { type: String, default: null },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  problem: { type: String, required: true },
  problem_detail: { type: String, default: null },
  device_photos: { type: [String], default: [] },
  estimated_cost: { type: Number, default: null },
  final_cost: { type: Number, default: null },
  status: {
    type: String,
    default: 'pending',
  },
  pickup_address: { type: String, default: null },
  pickup_area: { type: String, default: null },
  pickup_date: { type: String, default: null },
  pickup_slot: { type: String, default: null },
  assigned_agent_id: { type: String, default: null },
  technician_name: { type: String, default: null },
  technician_phone: { type: String, default: null },
  pickup_person_name: { type: String, default: null },
  pickup_person_phone: { type: String, default: null },
  estimated_arrival_time: { type: String, default: null },
  tracking_id: {
    type: String,
    default: () => `RB${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
  },
  assigned_vendor_id: { type: String, default: null },
  forwarded_to_vendor: { type: Boolean, default: false },
  vendor_quotation_amount: { type: Number, default: null },
  vendor_quotation_details: { type: String, default: null },
  quotation_status: { type: String, default: 'none' }, // 'none', 'pending_quote', 'quoted', 'user_accepted', 'user_rejected', 'paid'
  commission_percent: { type: Number, default: 10 },
  commission_amount: { type: Number, default: null },
  vendor_payout_amount: { type: Number, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const RepairBooking = mongoose.models.RepairBooking || mongoose.model('RepairBooking', repairBookingSchema);
