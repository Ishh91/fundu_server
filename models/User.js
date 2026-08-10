import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const userSchema = createSchema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  full_name: { type: String, default: null },
  phone: { type: String, default: null },
  role: { type: String, enum: ['customer', 'wholesaler', 'admin'], default: 'customer' },
  business_name: { type: String, default: null },
  gst_number: { type: String, default: null },
  is_verified: { type: Boolean, default: false },
  avatar_url: { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
