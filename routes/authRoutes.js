import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { createHttpError } from '../utils/error.js';
import { normalizeDoc } from '../utils/dbHelpers.js';
import { issueSession, requireAuth } from '../middleware/auth.js';
import { createOtp, verifyOtp as checkOtp, hasActiveOtp, otpTtlSeconds } from '../utils/otpStore.js';
import { sendOtp } from '../services/smsService.js';

const router = Router();

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

    // 60-second resend cooldown
    if (hasActiveOtp(phone)) {
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
    if (!email || !password || !fullName || !phone) {
      throw createHttpError(400, 'Full name, email, phone, and password are required.');
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanPhone = normalisePhone(phone);

    if (!isValidPhone(cleanPhone)) {
      throw createHttpError(400, 'Please enter a valid 10-digit mobile number.');
    }

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      throw createHttpError(409, 'An account with this email address already exists. Duplicate email is not permitted.');
    }

    const existingPhone = await User.findOne({ phone: cleanPhone });
    if (existingPhone) {
      throw createHttpError(409, 'An account with this mobile number already exists. Duplicate mobile number is not permitted.');
    }

    const user = await User.create({
      email: cleanEmail,
      passwordHash: await bcrypt.hash(String(password), 10),
      full_name: String(fullName).trim(),
      phone: cleanPhone,
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
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    if (!user) throw createHttpError(401, 'Invalid email or password.');

    if (!user.passwordHash) throw createHttpError(401, 'This account uses phone OTP login. Please use your mobile number.');

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) throw createHttpError(401, 'Invalid email or password.');

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
   GET /auth/me
   ────────────────────────────────────────────────────────────── */
router.get('/me', async (req, res, next) => {
  try {
    requireAuth(req.auth);
    const user = await User.findById(req.auth.sub);
    if (!user) throw createHttpError(401, 'Session expired. Please sign in again.');

    res.json({
      data: {
        session: {
          access_token: req.headers.authorization?.slice(7) || '',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
        },
        profile: normalizeDoc(user),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;



