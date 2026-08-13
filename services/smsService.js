/**
 * SMS Service — OTP delivery abstraction.
 *
 * Dev mode  (OTP_DEV_MODE=true OR SMS_PROVIDER=console):
 *   Logs OTP to server console and returns it in the API response.
 *   No external API calls.
 *
 * Production:
 *   Set SMS_PROVIDER=msg91 or SMS_PROVIDER=twilio in .env
 *   and fill in the corresponding credentials.
 */

const DEV_MODE =
  process.env.OTP_DEV_MODE === 'true' || process.env.SMS_PROVIDER === 'console' || !process.env.SMS_PROVIDER;

/**
 * Send an OTP to the given phone number.
 *
 * @param {string} phone  - E.164 or 10-digit Indian number
 * @param {string} otp    - The 6-digit OTP to send
 * @returns {Promise<{ sent: boolean; devOtp?: string; error?: string }>}
 */
export const sendOtp = async (phone, otp) => {
  if (DEV_MODE) {
    console.log(`\n[OTP DEV] Phone: ${phone} → OTP: ${otp}\n`);
    return { sent: true, devOtp: otp };
  }

  const provider = process.env.SMS_PROVIDER;

  if (provider === 'msg91') {
    return sendViaMSG91(phone, otp);
  }

  if (provider === 'twilio') {
    return sendViaTwilio(phone, otp);
  }

  console.warn(`[SMS] Unknown provider "${provider}". Falling back to dev mode.`);
  console.log(`[OTP FALLBACK] Phone: ${phone} → OTP: ${otp}`);
  return { sent: true, devOtp: otp };
};

/* ── MSG91 ───────────────────────────────────────────────────── */
async function sendViaMSG91(phone, otp) {
  try {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID || 'FUNDU';
    const templateId = process.env.MSG91_TEMPLATE_ID || '';

    // Normalize to 91XXXXXXXXXX
    const normalized = String(phone).replace(/\D/g, '');
    const mobile = normalized.startsWith('91') ? normalized : `91${normalized}`;

    const body = {
      template_id: templateId,
      short_url: '0',
      recipients: [
        {
          mobiles: mobile,
          otp,
        },
      ],
    };

    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        authkey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || data?.type === 'error') {
      return { sent: false, error: data?.message || 'MSG91 send failed.' };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

/* ── Twilio ──────────────────────────────────────────────────── */
async function sendViaTwilio(phone, otp) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    const normalized = String(phone).replace(/\D/g, '');
    const to = normalized.startsWith('91') ? `+${normalized}` : `+91${normalized}`;

    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: `Your Fundu OTP is ${otp}. Valid for 10 minutes. Do not share it with anyone.`,
    });

    const creds = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { sent: false, error: data?.message || 'Twilio send failed.' };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}
