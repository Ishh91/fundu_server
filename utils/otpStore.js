/**
 * In-memory OTP store.
 * Maps phone → { otp, expiresAt, attempts }
 * TTL: 10 minutes. Max attempts: 5.
 * Clears on server restart — swap to Redis for production persistence.
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const store = new Map();

/** Generate a cryptographically-weak but sufficient 6-digit OTP */
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

/**
 * Save a new OTP for the given phone number.
 * Returns the generated OTP string.
 */
export const createOtp = (phone) => {
  const otp = generateOtp();
  store.set(phone, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
  return otp;
};

/**
 * Verify an OTP for the given phone.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export const verifyOtp = (phone, inputOtp) => {
  const entry = store.get(phone);

  if (!entry) {
    return { valid: false, reason: 'OTP not found. Please request a new one.' };
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return { valid: false, reason: 'OTP has expired. Please request a new one.' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    store.delete(phone);
    return { valid: false, reason: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  if (entry.otp !== String(inputOtp).trim()) {
    entry.attempts += 1;
    return { valid: false, reason: `Incorrect OTP. ${MAX_ATTEMPTS - entry.attempts} attempt(s) remaining.` };
  }

  // Valid — clean up immediately
  store.delete(phone);
  return { valid: true };
};

/** Check if an active (non-expired) OTP already exists for a phone */
export const hasActiveOtp = (phone) => {
  const entry = store.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return false;
  }
  return true;
};

/** Time remaining (in seconds) for an existing OTP, or 0 */
export const otpTtlSeconds = (phone) => {
  const entry = store.get(phone);
  if (!entry) return 0;
  const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
  return Math.max(0, remaining);
};
