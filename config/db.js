import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Product, SparePart, SellPriceConfig, User } from '../models/index.js';
import { ensureAgentsSeeded } from '../services/dispatchService.js';
import { ensureMasterPhonesSeeded } from './seedPhones.js';

const seedProducts = [
  {
    title: 'Apple iPhone 13 (128GB) - Midnight',
    brand: 'Apple',
    model: 'iPhone 13',
    ram: '4GB',
    storage: '128GB',
    color: 'Midnight',
    condition: 'Excellent',
    price: 42999,
    original_price: 69900,
    discount_percent: 38,
    warranty_months: 6,
    description: 'Certified refurbished iPhone 13 in excellent condition. 32-point quality check passed, battery health above 88%. Comes with USB-C cable and 6-month Fundu warranty.',
    is_approved: true,
    is_featured: true,
    stock: 5,
    images: [
      'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&q=80&w=800',
    ],
  },
  {
    title: 'Apple iPhone 14 (128GB) - Blue',
    brand: 'Apple',
    model: 'iPhone 14',
    ram: '6GB',
    storage: '128GB',
    color: 'Blue',
    condition: 'Excellent',
    price: 52999,
    original_price: 79900,
    discount_percent: 33,
    warranty_months: 6,
    description: 'Superb condition iPhone 14 with A15 Bionic chip and advanced dual-camera system. Fully tested & certified in Lucknow.',
    is_approved: true,
    is_featured: true,
    stock: 4,
    images: [
      'https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?auto=format&fit=crop&q=80&w=800',
    ],
  },
  {
    title: 'Samsung Galaxy S22 5G (128GB) - Phantom Black',
    brand: 'Samsung',
    model: 'Galaxy S22',
    ram: '8GB',
    storage: '128GB',
    color: 'Phantom Black',
    condition: 'Good',
    price: 29999,
    original_price: 54999,
    discount_percent: 45,
    warranty_months: 6,
    description: 'Refurbished Samsung Galaxy S22 with 120Hz Dynamic AMOLED display. Minor cosmetic scuffs, 100% functional guarantee.',
    is_approved: true,
    is_featured: true,
    stock: 6,
    images: [
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=800',
    ],
  },
  {
    title: 'Samsung Galaxy S23 5G (256GB) - Cream',
    brand: 'Samsung',
    model: 'Galaxy S23',
    ram: '8GB',
    storage: '256GB',
    color: 'Cream',
    condition: 'Excellent',
    price: 46999,
    original_price: 79999,
    discount_percent: 41,
    warranty_months: 12,
    description: 'Mint condition Galaxy S23 featuring Snapdragon 8 Gen 2 for Galaxy. Premium camera performance and extended 1-year warranty.',
    is_approved: true,
    is_featured: true,
    stock: 3,
    images: [
      'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&q=80&w=800',
    ],
  },
  {
    title: 'OnePlus 10 Pro 5G (256GB) - Emerald Forest',
    brand: 'OnePlus',
    model: '10 Pro',
    ram: '12GB',
    storage: '256GB',
    color: 'Emerald Forest',
    condition: 'Excellent',
    price: 34999,
    original_price: 66999,
    discount_percent: 47,
    warranty_months: 12,
    description: 'Flagship OnePlus 10 Pro with 2nd Gen Hasselblad Camera, 80W SuperVOOC charging, and crisp QHD+ Fluid AMOLED display.',
    is_approved: true,
    is_featured: true,
    stock: 4,
    images: [
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&q=80&w=800',
    ],
  },
  {
    title: 'Google Pixel 7 (128GB) - Obsidian',
    brand: 'Google',
    model: 'Pixel 7',
    ram: '8GB',
    storage: '128GB',
    color: 'Obsidian',
    condition: 'Good',
    price: 31999,
    original_price: 59999,
    discount_percent: 46,
    warranty_months: 6,
    description: 'Refurbished Google Pixel 7 driven by Google Tensor G2 processor. Industry-leading AI camera features and stock Android experience.',
    is_approved: true,
    is_featured: false,
    stock: 3,
    images: [
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=800',
    ],
  },
  {
    title: 'Xiaomi Redmi Note 12 Pro+ 5G (256GB)',
    brand: 'Xiaomi',
    model: 'Redmi Note 12 Pro+',
    ram: '8GB',
    storage: '256GB',
    color: 'Obsidian Black',
    condition: 'Good',
    price: 18999,
    original_price: 32999,
    discount_percent: 42,
    warranty_months: 6,
    description: 'Featuring a massive 200MP OIS primary camera and 120W HyperCharge capability. Fast, reliable performance at a budget price.',
    is_approved: true,
    is_featured: false,
    stock: 8,
    images: [
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&q=80&w=800',
    ],
  },
];

const seedSpareParts = [
  {
    title: 'iPhone 13 Original OLED Display Assembly',
    brand: 'Apple',
    category: 'Screens',
    price: 4999,
    original_price: 6999,
    stock: 12,
    description: 'High-grade OEM spec OLED display replacement assembly with touch glass for iPhone 13.',
    is_approved: true,
    images: ['https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&q=80&w=800'],
  },
  {
    title: 'iPhone 14 High-Capacity Battery Pack',
    brand: 'Apple',
    category: 'Battery',
    price: 1899,
    original_price: 2499,
    stock: 15,
    description: 'Replacement 3279mAh lithium-ion battery with zero cycles and thermal protection chip.',
    is_approved: true,
    images: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=800'],
  },
  {
    title: 'Samsung Galaxy S22 Original Battery',
    brand: 'Samsung',
    category: 'Battery',
    price: 1499,
    original_price: 1999,
    stock: 20,
    description: 'Genuine 3700mAh battery replacement for Samsung Galaxy S22 series.',
    is_approved: true,
    images: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=800'],
  },
  {
    title: 'Universal Type-C Fast Charging Flex Cable',
    brand: 'Universal',
    category: 'Charging Ports',
    price: 399,
    original_price: 599,
    stock: 50,
    description: 'Multi-compatible USB Type-C charging port board with microphone module.',
    is_approved: true,
    images: ['https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=800'],
  },
  {
    title: 'OnePlus 10 Pro Glass Back Cover Panel',
    brand: 'OnePlus',
    category: 'Back Glass',
    price: 1299,
    original_price: 1799,
    stock: 8,
    description: 'Factory-matched ceramic feel rear back glass panel for OnePlus 10 Pro with camera lens pre-fitted.',
    is_approved: true,
    images: ['https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&q=80&w=800'],
  },
];

const seedSellConfigs = [
  {
    brand: 'Apple',
    model: 'iPhone 13',
    storage: '128GB',
    base_price: 38000,
    excellent_multiplier: 0.75,
    good_multiplier: 0.60,
    fair_multiplier: 0.45,
    box_bonus: 600,
    charger_bonus: 400,
    is_active: true,
  },
  {
    brand: 'Apple',
    model: 'iPhone 14',
    storage: '128GB',
    base_price: 48000,
    excellent_multiplier: 0.75,
    good_multiplier: 0.60,
    fair_multiplier: 0.45,
    box_bonus: 700,
    charger_bonus: 500,
    is_active: true,
  },
  {
    brand: 'Samsung',
    model: 'Galaxy S22',
    storage: '128GB',
    base_price: 28000,
    excellent_multiplier: 0.70,
    good_multiplier: 0.55,
    fair_multiplier: 0.40,
    box_bonus: 500,
    charger_bonus: 300,
    is_active: true,
  },
  {
    brand: 'OnePlus',
    model: '10 Pro',
    storage: '256GB',
    base_price: 32000,
    excellent_multiplier: 0.72,
    good_multiplier: 0.58,
    fair_multiplier: 0.42,
    box_bonus: 500,
    charger_bonus: 400,
    is_active: true,
  },
];

export const seedDatabase = async () => {
  const [productCount, partCount, configCount] = await Promise.all([
    Product.countDocuments(),
    SparePart.countDocuments(),
    SellPriceConfig.countDocuments(),
  ]);

  if (productCount === 0) {
    await Product.insertMany(seedProducts);
    console.log('Seeded products collection.');
  }

  if (partCount === 0) {
    await SparePart.insertMany(seedSpareParts);
    console.log('Seeded spare parts collection.');
  }

  if (configCount === 0) {
    await SellPriceConfig.insertMany(seedSellConfigs);
    console.log('Seeded sell price configs collection.');
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@fundu.in').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const admin = await User.findOne({ email: adminEmail });

  if (!admin) {
    await User.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      full_name: 'Fundu Admin (Lucknow)',
      phone: '+919876543210',
      role: 'admin',
      is_verified: true,
    });
    console.log(`Created default admin user: ${adminEmail}`);
  }

  const wholesalerEmail = 'wholesaler@fundu.in';
  const wholesaler = await User.findOne({ email: wholesalerEmail });
  if (!wholesaler) {
    await User.create({
      email: wholesalerEmail,
      passwordHash: await bcrypt.hash('Wholesaler@123456', 10),
      full_name: 'Gomti Nagar Mobiles',
      phone: '+919839012345',
      role: 'wholesaler',
      business_name: 'Gomti Nagar Mobile Wholesale Ltd',
      is_verified: true,
    });
    console.log(`Created default wholesaler user: ${wholesalerEmail}`);
  }

  await ensureAgentsSeeded();
  await ensureMasterPhonesSeeded();
};

export const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'fundu';

  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment.');
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
      tls: true,
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB successfully.');
    await seedDatabase();
  } catch (err) {
    console.warn('MongoDB connection notice:', err.message || err);
    console.log('Express server starting in standalone mode...');
  }
};
