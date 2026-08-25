import jwt from 'jsonwebtoken';
import { createHttpError } from '../utils/error.js';
import { normalizeDoc } from '../utils/dbHelpers.js';

export const getJwtSecret = () => process.env.JWT_SECRET || 'change-this-jwt-secret';

export const isAdmin = (auth) => auth?.role === 'admin';
export const isVendor = (auth) => auth?.role === 'vendor' || auth?.role === 'wholesaler';
export const isWholesaler = isVendor;

export const requireAuth = (auth) => {
  if (!auth?.sub) {
    throw createHttpError(401, 'Authentication required.');
  }
};

export const issueSession = (user) => {
  const publicUser = normalizeDoc(user);
  const access_token = jwt.sign(
    { sub: publicUser.id, email: publicUser.email, role: publicUser.role },
    getJwtSecret(),
    { expiresIn: '7d' },
  );

  return {
    access_token,
    user: {
      id: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    },
  };
};

export const parseAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    req.auth = null;
    next();
    return;
  }

  try {
    req.auth = jwt.verify(header.slice(7), getJwtSecret());
  } catch {
    req.auth = null;
  }
  next();
};
