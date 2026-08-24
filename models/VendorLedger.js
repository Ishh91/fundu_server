import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const vendorLedgerSchema = createSchema({
  vendor_id: { type: String, required: true },
  vendor_name: { type: String, default: null },
  type: {
    type: String,
    enum: ['credit_purchase', 'cash_repayment', 'credit_limit_set', 'credit_adjustment'],
    required: true,
  },
  amount: { type: Number, required: true },
  balance_before: { type: Number, default: 0 },
  balance_after: { type: Number, required: true },
  reference_order_id: { type: String, default: null },
  payment_mode: { type: String, default: 'Cash' }, // Cash, Bank Transfer, Cheque, UPI
  notes: { type: String, default: null },
  recorded_by: { type: String, default: 'Admin' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const VendorLedger = mongoose.models.VendorLedger || mongoose.model('VendorLedger', vendorLedgerSchema);
