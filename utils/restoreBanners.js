import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const defaults = [
    {
      id: 'poster-flagship-buy',
      eyebrow: 'Exclusive Deals',
      title: 'Discover Your Next Flagship at your doorstep',
      description: 'Certified refurbished smartphones with 6 months warranty and doorstep delivery.',
      primaryLabel: 'Shop Now',
      primaryHref: '/buy',
      secondaryLabel: 'Explore Catalog',
      secondaryHref: '/store',
      accent: 'from-[#0a2f32] to-[#86dedd]',
      image: '/assets/posters/poster_flagship_buy.jpg',
      bullets: ['32-Pt Audit Passed', '6 Months Warranty', 'Doorstep Delivery'],
      is_active: true,
      is_full_banner: true,
      sort_order: 1,
    },
    {
      id: 'poster-sell-cash',
      eyebrow: 'Instant Cash',
      title: 'Sell Old Phone Get Instant Cash at your doorstep',
      description: 'Highest valuation, doorstep pickup, and spot cash/UPI payment at your doorstep.',
      primaryLabel: 'Sell Now',
      primaryHref: '/sell',
      secondaryLabel: 'Check Value',
      secondaryHref: '/sell',
      accent: 'from-[#0a2f32] to-[#86dedd]',
      image: '/assets/posters/poster_sell_cash.jpg',
      bullets: ['Instant UPI/Cash', 'Free Doorstep Pickup', 'Top Resale Value'],
      is_active: true,
      is_full_banner: true,
      sort_order: 2,
    },
    {
      id: 'poster-repair-doorstep',
      eyebrow: 'Doorstep Service',
      title: '30-Minute Doorstep Mobile Repair',
      description: 'Certified technicians repair your phone right at your home or office with genuine parts.',
      primaryLabel: 'Book Repair',
      primaryHref: '/repair',
      secondaryLabel: 'Contact Us',
      secondaryHref: '/contact',
      accent: 'from-[#0a2f32] to-[#86dedd]',
      image: '/assets/posters/poster_repair.jpg',
      bullets: ['30-Min Fast Repair', 'Tested Genuine Parts', '6M Repair Warranty'],
      is_active: true,
      is_full_banner: true,
      sort_order: 3,
    },
  ];

  await mongoose.connection.db.collection('sitecontents').updateOne(
    { key: 'hero_slides' },
    { $set: { title: 'Hero Posters Carousel', items: defaults, is_active: true, updated_at: new Date() } },
    { upsert: true }
  );

  console.log('✅ Successfully synced hero slides to MongoDB Atlas');
  process.exit(0);
}

run();
