import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const deliveryAgentSchema = createSchema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, default: null, lowercase: true, trim: true },
  status: {
    type: String,
    enum: ['available', 'on_delivery', 'busy', 'offline'],
    default: 'available',
  },
  zones: {
    type: [String],
    default: ['Gomti Nagar', 'Hazratganj', 'Aliganj', 'Indira Nagar', 'Mahanagar', 'Alambagh', 'Charbagh', 'Jankipuram', 'Ashiyana'],
  },
  current_orders_count: { type: Number, default: 0 },
  max_capacity: { type: Number, default: 6 },
  vehicle_type: { type: String, default: 'Bike' },
  vehicle_number: { type: String, default: null },
  rating: { type: Number, default: 4.8 },
  total_completed: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  avatar_url: { type: String, default: null },
  current_locality: { type: String, default: 'Gomti Nagar, Lucknow' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const DeliveryAgent = mongoose.models.DeliveryAgent || mongoose.model('DeliveryAgent', deliveryAgentSchema);
