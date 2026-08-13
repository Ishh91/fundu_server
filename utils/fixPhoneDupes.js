/**
 * Fix duplicate phone entries and re-create phone sparse index.
 * Run after fixUserIndexes.js if you hit a duplicate phone error.
 *
 * node server/utils/fixPhoneDupes.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const conn = await mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB_NAME || 'fundu',
});
const db = conn.connection.db;
const collection = db.collection('users');

try {
  // Find all phones that appear more than once
  const dupes = await collection.aggregate([
    { $match: { phone: { $ne: null } } },
    { $group: { _id: '$phone', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  console.log(`Found ${dupes.length} duplicate phone group(s).`);

  for (const { _id: phone, ids } of dupes) {
    // Keep the newest (last) document, delete the rest
    const toDelete = ids.slice(0, ids.length - 1);
    const result = await collection.deleteMany({ _id: { $in: toDelete } });
    console.log(`  Phone ${phone}: deleted ${result.deletedCount} duplicate(s), kept 1.`);
  }

  // Now create the sparse unique phone index
  const existing = await collection.indexes();
  const hasPhoneIndex = existing.some((i) => i.key?.phone !== undefined);
  if (!hasPhoneIndex) {
    await collection.createIndex({ phone: 1 }, { unique: true, sparse: true, background: true });
    console.log('✓ Created sparse unique index on phone');
  } else {
    console.log('✓ Phone index already exists:', existing.find((i) => i.key?.phone !== undefined)?.name);
  }

  const all = await collection.indexes();
  console.log('\nFinal indexes:', all.map((i) => `${i.name} (unique=${i.unique}, sparse=${i.sparse})`));
  console.log('\n✅ Done. Restart the server.');
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await mongoose.disconnect();
}
