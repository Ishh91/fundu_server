import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const supportTicketSchema = createSchema({
  user_id: { type: String, default: null },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: null },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: 'open' },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);
