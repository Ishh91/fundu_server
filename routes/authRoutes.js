import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { createHttpError } from '../utils/error.js';
import { normalizeDoc } from '../utils/dbHelpers.js';
import { issueSession, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, fullName, phone } = req.body;
    if (!email || !password || !fullName || !phone) {
      throw createHttpError(400, 'Full name, email, phone, and password are required.');
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) throw createHttpError(409, 'An account with this email already exists.');

    const user = await User.create({
      email: String(email).toLowerCase().trim(),
      passwordHash: await bcrypt.hash(String(password), 10),
      full_name: String(fullName).trim(),
      phone: String(phone).trim(),
      role: 'customer',
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

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) throw createHttpError(401, 'Invalid email or password.');

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
