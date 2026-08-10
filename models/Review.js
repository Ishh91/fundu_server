import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const reviewSchema = createSchema({
  user_id: { type: String, default: null },
  product_id: { type: String, default: null },
  service_type: { type: String, enum: ['buy', 'sell', 'repair', 'spare_parts', 'general'], default: 'general' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  reviewer_name: { type: String, required: true },
  location: { type: String, default: 'Lucknow' },
  is_approved: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
