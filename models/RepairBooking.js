import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const repairBookingSchema = createSchema({
  user_id: { type: String, required: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  problem: { type: String, required: true },
  problem_detail: { type: String, default: null },
  device_photos: { type: [String], default: [] },
  estimated_cost: { type: Number, default: null },
  final_cost: { type: Number, default: null },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked_up', 'in_repair', 'repaired', 'delivered', 'cancelled'],
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
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const RepairBooking = mongoose.models.RepairBooking || mongoose.model('RepairBooking', repairBookingSchema);
