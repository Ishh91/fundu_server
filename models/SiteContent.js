import mongoose from 'mongoose';
import { createSchema } from './baseSchema.js';

const siteContentSchema = createSchema({
  key: { type: String, required: true, unique: true },
  title: { type: String, default: null },
  subtitle: { type: String, default: null },
  description: { type: String, default: null },
  cta_label: { type: String, default: null },
  cta_href: { type: String, default: null },
  secondary_cta_label: { type: String, default: null },
  secondary_cta_href: { type: String, default: null },
  items: { type: Array, default: [] },
  is_active: { type: Boolean, default: true },
  sort_order: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const SiteContent = mongoose.models.SiteContent || mongoose.model('SiteContent', siteContentSchema);
