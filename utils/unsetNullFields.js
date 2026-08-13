/**
 * Remove null email/phone fields so sparse indexes work correctly.
 * node server/utils/unsetNullFields.js
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

await mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB_NAME || 'fundu',
  autoIndex: false,
});

const col = mongoose.connection.db.collection('users');

// Remove the email field entirely (rather than setting to null)
// so the sparse unique index won't reject multiple OTP users
const r1 = await col.updateMany({ email: null }, { $unset: { email: '' } });
console.log('Removed null email field from', r1.modifiedCount, 'documents');

const r2 = await col.updateMany({ phone: null }, { $unset: { phone: '' } });
console.log('Removed null phone field from', r2.modifiedCount, 'documents');

const users = await col.find({}, { projection: { email: 1, phone: 1, role: 1, full_name: 1 } }).toArray();
console.log('\nUsers now:', JSON.stringify(users, null, 2));
console.log('\n✅ Done. Restart the server.');
await mongoose.disconnect();
