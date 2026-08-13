import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const userSchema = createSchema({
  // Email is optional — phone-OTP users will simply not have this field.
  // Sparse unique index allows multiple documents without email.
  // IMPORTANT: do NOT set default: null — sparse indexes skip missing fields,
  // but treat null as an indexed value (causing duplicates on multiple null emails).
  email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    // index managed manually (sparse unique) — see fixUserIndexes.js
  },
  // Null for OTP-only users (no password set)
  passwordHash: { type: String, default: null },
  full_name: { type: String, default: null },
  // Phone is the primary identifier for OTP login
  // IMPORTANT: do NOT set default: null — same sparse index reason as email.
  phone: {
    type: String,
    trim: true,
    // index managed manually (sparse unique) — see fixUserIndexes.js
  },
  role: { type: String, enum: ['customer', 'wholesaler', 'admin'], default: 'customer' },
  business_name: { type: String, default: null },
  gst_number: { type: String, default: null },
  is_verified: { type: Boolean, default: false },
  avatar_url: { type: String, default: null },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  // Disable auto-index: we manage sparse unique indexes manually via fixUserIndexes.js
  // to prevent Mongoose from overwriting sparse indexes with non-sparse ones.
  autoIndex: false,
});

// Force fresh model registration when the module is reloaded (hot-reload safe)
if (mongoose.models.User) {
  delete mongoose.models.User;
}
export const User = mongoose.model('User', userSchema);

