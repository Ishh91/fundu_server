import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const wholesaleOrderSchema = createSchema({
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, required: true },
  vendor_phone: { type: String, required: true },
  business_name: { type: String, default: null },
  items: [{
    inventory_id: { type: String, default: null },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    storage: { type: String, default: null },
    condition: { type: String, default: 'Grade A' },
    quantity: { type: Number, default: 1 },
    unit_price: { type: Number, required: true },
    total_price: { type: Number, required: true },
    imei: { type: String, default: null },
  }],
  total_amount: { type: Number, required: true },
  payment_method: { type: String, enum: ['cash', 'credit', 'bank_transfer', 'upi'], default: 'cash' },
  payment_status: { type: String, enum: ['paid', 'credit_due', 'partially_paid'], default: 'paid' },
  status: { type: String, enum: ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'], default: 'pending' },
  notes: { type: String, default: null },
  delivery_address: { type: String, default: 'Lucknow Hub Pickup' },
  dispatch_details: {
    dispatched_at: { type: String, default: null },
    delivered_at: { type: String, default: null },
    tracking_note: { type: String, default: null },
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const WholesaleOrder = mongoose.models.WholesaleOrder || mongoose.model('WholesaleOrder', wholesaleOrderSchema);
