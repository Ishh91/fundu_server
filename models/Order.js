import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const orderSchema = createSchema({
  user_id: { type: String, required: true },
  product_id: { type: String, default: null },
  spare_part_id: { type: String, default: null },
  quantity: { type: Number, default: 1 },
  total_amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'packed', 'dispatched', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending',
  },
  payment_method: { type: String, default: 'cod' },
  payment_status: { type: String, default: 'pending' },
  delivery_address: { type: String, default: null },
  delivery_area: { type: String, default: null },
  delivery_name: { type: String, default: null },
  delivery_phone: { type: String, default: null },
  delivery_slot: { type: String, default: null },
  assigned_agent_id: { type: String, default: null },
  delivery_person_name: { type: String, default: null },
  delivery_person_phone: { type: String, default: null },
  estimated_arrival_time: { type: String, default: null },
  tracking_id: {
    type: String,
    default: () => `ORD${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
