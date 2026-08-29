import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/index.js';
import { createHttpError } from '../utils/error.js';
import { normalizeDoc } from '../utils/dbHelpers.js';
import { issueSession, requireAuth } from '../middleware/auth.js';
import { createOtp, verifyOtp as checkOtp, hasActiveOtp, otpTtlSeconds } from '../utils/otpStore.js';
import { sendOtp } from '../services/smsService.js';

const router = Router();
const inMemoryUsers = new Map();

async function safeFindUser(query) {
  if (mongoose.connection.readyState === 1) {
    try {
      const dbUser = await User.findOne(query).maxTimeMS(3000);
      if (dbUser) return dbUser;
    } catch {
      // Fall through to memory store if Mongo times out
    }
  }
  if (query.$or) {
    for (const cond of query.$or) {
      if (cond.email) {
        const found = Array.from(inMemoryUsers.values()).find((u) => u.email === cond.email);
        if (found) return found;
      }
      if (cond.phone) {
        const found = Array.from(inMemoryUsers.values()).find((u) => u.phone === cond.phone);
        if (found) return found;
      }
    }
    return null;
  }
  if (query.email) {
    return Array.from(inMemoryUsers.values()).find((u) => u.email === query.email) || null;
  }
  if (query.phone) {
    return Array.from(inMemoryUsers.values()).find((u) => u.phone === query.phone) || null;
  }
  return null;
}

async function safeCreateUser(doc) {
  if (mongoose.connection.readyState === 1) {
    try {
      return await User.create(doc);
    } catch {
      // Fall through to memory store if Mongo times out
    }
  }
  const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newUser = {
    _id: id,
    id: id,
    ...doc,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  inMemoryUsers.set(id, newUser);
  return newUser;
}

/* ────────────────────────────────────────────────────────────────
   POST /auth/check-email
   Public pre-check to verify if an email is already registered.
   ────────────────────────────────────────────────────────────── */
router.post('/check-email', async (req, res, next) => {
  try {
    const cleanEmail = String(req.body.email || '').toLowerCase().trim();
    if (!cleanEmail) {
      return res.json({ data: { exists: false } });
    }
    const user = await safeFindUser({ email: cleanEmail });
    if (user) {
      return res.json({
        data: {
          exists: true,
          message: `Email address "${cleanEmail}" is ALREADY registered! Please Sign In instead.`,
        },
      });
    }
    res.json({ data: { exists: false } });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   POST /auth/delete-user
   Admin endpoint to delete a user/vendor by ID.
   ────────────────────────────────────────────────────────────── */
router.post('/delete-user', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      throw createHttpError(400, 'User ID is required.');
    }

    if (mongoose.connection.readyState === 1) {
      await User.deleteOne({ $or: [{ _id: userId }, { id: userId }] });
    }
    inMemoryUsers.delete(userId);

    console.log(`🗑️ Deleted user ID: ${userId} by Admin.`);
    res.json({ data: { success: true, message: 'User deleted successfully.' } });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   POST /auth/clean-test-users
   Clears all non-admin test users from MongoDB database.
   ────────────────────────────────────────────────────────────── */
router.post('/clean-test-users', async (req, res, next) => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@fundu.in').toLowerCase().trim();
    const result = await User.deleteMany({
      email: { $ne: adminEmail },
      role: { $ne: 'admin' },
    });
    console.log(`🧹 Cleared ${result.deletedCount} non-admin test users from MongoDB.`);
    res.json({
      data: {
        success: true,
        deletedCount: result.deletedCount,
        message: `Successfully cleared ${result.deletedCount} non-admin test accounts from database.`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   Helper: normalise phone to 10-digit string
   ────────────────────────────────────────────────────────────── */
const normalisePhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  // Strip leading 91 country code if 12 digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
};

const isValidPhone = (phone) => /^\d{10}$/.test(phone);

/* ────────────────────────────────────────────────────────────────
   POST /auth/otp/send
   Body: { phone }
   Rate-limited to once per 60 seconds per number.
   ────────────────────────────────────────────────────────────── */
router.post('/otp/send', async (req, res, next) => {
  try {
    const phone = normalisePhone(req.body.phone);

    if (!isValidPhone(phone)) {
      throw createHttpError(400, 'Please enter a valid 10-digit Indian mobile number.');
    }

    // 60-second resend cooldown (enforced in production only)
    const isDevMode = process.env.OTP_DEV_MODE === 'true' || process.env.SMS_PROVIDER === 'console' || !process.env.SMS_PROVIDER;
    if (!isDevMode && hasActiveOtp(phone)) {
      const ttl = otpTtlSeconds(phone);
      if (ttl > 540) { // OTP was created <60 seconds ago (600 - 60 = 540)
        throw createHttpError(429, `Please wait ${600 - ttl} seconds before requesting a new OTP.`);
      }
    }

    const otp = createOtp(phone);
    const result = await sendOtp(phone, otp);

    if (!result.sent) {
      throw createHttpError(500, `Failed to send OTP: ${result.error || 'Unknown error.'}`);
    }

    const response = { message: `OTP sent to +91 ${phone}.` };

    // In dev mode, expose OTP in response for testing convenience
    if (result.devOtp) {
      response.devOtp = result.devOtp;
    }

    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   POST /auth/otp/verify
   Body: { phone, otp, fullName? }
   Auto-creates account on first login.
   ────────────────────────────────────────────────────────────── */
router.post('/otp/verify', async (req, res, next) => {
  try {
    const phone = normalisePhone(req.body.phone);
    const { otp, fullName } = req.body;

    if (!isValidPhone(phone)) {
      throw createHttpError(400, 'Invalid phone number.');
    }

    if (!otp || String(otp).trim().length !== 6) {
      throw createHttpError(400, 'Please enter the 6-digit OTP.');
    }

    const { valid, reason } = checkOtp(phone, String(otp).trim());
    if (!valid) throw createHttpError(400, reason);

    // Find or create user
    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        phone,
        full_name: fullName ? String(fullName).trim() : null,
        role: 'customer',
        is_verified: true,
      });
    } else if (!user.is_verified) {
      user.is_verified = true;
      await user.save();
    }

    res.json({
      data: {
        session: issueSession(user),
        profile: normalizeDoc(user),
        isNewUser: !user.full_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   POST /auth/register  (kept for backward-compat / email users)
   ────────────────────────────────────────────────────────────── */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, fullName, phone, role, businessName, creditLimit, gstNumber } = req.body;
    if (!email || !password || !fullName) {
      throw createHttpError(400, 'Full name, email, and password are required.');
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanPhone = phone ? normalisePhone(phone) : '';

    if (cleanPhone && !isValidPhone(cleanPhone)) {
      throw createHttpError(400, 'Please enter a valid 10-digit mobile number.');
    }

    const existingEmail = await safeFindUser({ email: cleanEmail });
    if (existingEmail) {
      throw createHttpError(409, 'An account with this email address already exists. Duplicate email is not permitted.');
    }

    if (cleanPhone) {
      const existingPhone = await safeFindUser({ phone: cleanPhone });
      if (existingPhone) {
        throw createHttpError(409, 'An account with this mobile number already exists. Duplicate mobile number is not permitted.');
      }
    }

    const user = await safeCreateUser({
      email: cleanEmail,
      passwordHash: await bcrypt.hash(String(password), 10),
      full_name: String(fullName).trim(),
      phone: cleanPhone || null,
      role: role || 'customer',
      business_name: businessName || null,
      credit_limit: creditLimit ? Number(creditLimit) : 200000,
      gst_number: gstNumber || null,
      is_verified: true,
    });

    res.status(201).json({
      data: {
        session: issueSession(user),
        profile: normalizeDoc(user),
      },
    });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   POST /auth/login  (email+password — kept for admin accounts)
   ────────────────────────────────────────────────────────────── */
router.post('/login', async (req, res, next) => {
  try {
    const rawIdentifier = String(req.body.email || req.body.identifier || req.body.phone || '').trim();
    const password = req.body.password;

    if (!rawIdentifier || !password) {
      throw createHttpError(400, 'Mobile number/email and password are required.');
    }

    const cleanEmail = rawIdentifier.toLowerCase();
    const cleanPhone = normalisePhone(rawIdentifier);

    const queryConditions = [{ email: cleanEmail }];
    if (isValidPhone(cleanPhone)) {
      queryConditions.push({ phone: cleanPhone });
    }

    const user = await safeFindUser({ $or: queryConditions });
    if (!user) {
      throw createHttpError(404, `⚠️ Account Not Found: No registered account with "${rawIdentifier}". Please check details or Create New Account.`);
    }

    if (!user.passwordHash) {
      throw createHttpError(401, 'Account password not set. Please reset your password or contact support.');
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      throw createHttpError(401, `❌ Incorrect Password: The password entered for "${rawIdentifier}" is incorrect. Please try again or click Reset Password.`);
    }

    res.json({
      data: {
        session: issueSession(user),
        profile: normalizeDoc(user),
      },
    });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   POST /auth/reset-password
   Resets password for an existing registered account.
   ────────────────────────────────────────────────────────────── */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, phone, newPassword } = req.body;
    const identifier = String(email || phone || '').toLowerCase().trim();

    if (!identifier || !newPassword) {
      throw createHttpError(400, 'Mobile/Email and new password are required.');
    }

    const cleanPhone = normalisePhone(identifier);
    const queryConditions = [{ email: identifier }];
    if (isValidPhone(cleanPhone)) {
      queryConditions.push({ phone: cleanPhone });
    }

    const user = await safeFindUser({ $or: queryConditions });
    if (!user) {
      throw createHttpError(404, `⚠️ Account Not Found: No registered account with "${identifier}".`);
    }

    const newHash = await bcrypt.hash(String(newPassword), 10);
    if (mongoose.connection.readyState === 1 && user._id) {
      await User.updateOne({ _id: user._id }, { $set: { passwordHash: newHash } });
    }
    user.passwordHash = newHash;

    console.log(`🔑 Reset password successfully for user ${user.email || user.phone}`);
    res.json({
      data: {
        success: true,
        message: `Password reset successfully for ${user.email || user.phone}. Please sign in with your new password.`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────────────────────────────────────────
   GET /auth/me
   ────────────────────────────────────────────────────────────── */
router.get('/me', async (req, res, next) => {
  try {
    requireAuth(req.auth);
    const sub = req.auth?.sub;
    if (!sub) throw createHttpError(401, 'Invalid session token.');

    const isObjId = mongoose.Types.ObjectId.isValid(sub);
    const query = isObjId ? { $or: [{ _id: sub }, { id: sub }] } : { id: sub };

    let user = await safeFindUser(query);
    if (!user && isObjId) {
      try {
        user = await User.findById(sub);
      } catch {
        // Ignore cast error
      }
    }

    if (!user) throw createHttpError(401, 'Session expired. Please sign in again.');

    const normUser = normalizeDoc(user);
    res.json({
      data: {
        session: {
          access_token: req.headers.authorization?.slice(7) || '',
          user: {
            id: normUser.id || user.id || sub,
            email: normUser.email || user.email || '',
            role: normUser.role || user.role || 'customer',
          },
        },
        profile: normUser,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;



