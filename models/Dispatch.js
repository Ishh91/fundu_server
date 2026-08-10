import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const dispatchSchema = createSchema({
  order_id: { type: String, required: true },
  delivery_person_name: { type: String, required: true },
  delivery_person_phone: { type: String, required: true },
  status: { type: String, enum: ['dispatched', 'in_transit', 'delivered', 'returned'], default: 'dispatched' },
  notes: { type: String, default: null },
  dispatched_at: { type: String, default: () => new Date().toISOString() },
  delivered_at: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export const Dispatch = mongoose.models.Dispatch || mongoose.model('Dispatch', dispatchSchema);
