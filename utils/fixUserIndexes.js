/**
 * One-time migration: fix User collection indexes to support
 * phone-OTP users who have no email (null email must be allowed
 * for multiple documents).
 *
 * Run: node server/utils/fixUserIndexes.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'fundu';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

const conn = await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
const db = conn.connection.db;
const collection = db.collection('users');

try {
  const indexes = await collection.indexes();
  console.log('Current indexes:', indexes.map((i) => `${i.name} (unique=${i.unique}, sparse=${i.sparse})`));

  // Clean up any existing documents with email: null or empty string
  const unsetRes = await collection.updateMany(
    { $or: [{ email: null }, { email: '' }] },
    { $unset: { email: '' } }
  );
  console.log(`✓ Unset null/empty email on ${unsetRes.modifiedCount} documents.`);

  // Drop existing email index
  const emailIdx = indexes.find((i) => i.key?.email !== undefined);
  if (emailIdx) {
    await collection.dropIndex(emailIdx.name);
    console.log(`✓ Dropped email index: ${emailIdx.name}`);
  }

  // Drop existing phone index
  const phoneIdx = indexes.find((i) => i.key?.phone !== undefined);
  if (phoneIdx) {
    await collection.dropIndex(phoneIdx.name);
    console.log(`✓ Dropped phone index: ${phoneIdx.name}`);
  }

  // Create partialFilterExpression unique indexes so null or missing fields never clash
  await collection.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string' } }, background: true }
  );
  console.log('✓ Created unique partial index on email (only applies when email is a string)');

  await collection.createIndex(
    { phone: 1 },
    { unique: true, partialFilterExpression: { phone: { $type: 'string' } }, background: true }
  );
  console.log('✓ Created unique partial index on phone (only applies when phone is a string)');

  const finalIndexes = await collection.indexes();
  console.log('\nFinal indexes:', finalIndexes.map((i) => `${i.name} (unique=${i.unique}, sparse=${i.sparse})`));

  console.log('\n✅ Migration complete. Restart the server.');
} catch (err) {
  console.error('Migration error:', err.message);
} finally {
  await mongoose.disconnect();
}
