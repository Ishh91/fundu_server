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

export const sendOtp = async (phone, otp) => {
  const isDevMode =
    process.env.OTP_DEV_MODE === 'true' || process.env.SMS_PROVIDER === 'console' || !process.env.SMS_PROVIDER;

  if (isDevMode) {
    console.log(`\n[OTP DEV] Phone: ${phone} → OTP: ${otp}\n`);
    return { sent: true, devOtp: otp };
  }

  const provider = process.env.SMS_PROVIDER;

  if (provider === 'fast2sms') {
    return sendViaFast2SMS(phone, otp);
  }

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
    const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const apiKey = (process.env.TWILIO_API_KEY_SID || process.env.TWILIO_ACCOUNT_SID || '').trim();
    const apiSecret = (process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_AUTH_TOKEN || '').trim();
    const from = (process.env.TWILIO_FROM_NUMBER || '').trim();

    const normalized = String(phone).replace(/\D/g, '');
    const to = normalized.startsWith('91') ? `+${normalized}` : `+91${normalized}`;

    // Graceful fallback if credentials are placeholder
    if (!accountSid || !apiKey || !apiSecret || apiSecret === 'your_twilio_auth_token_here') {
      console.warn(`\n⚠️ [TWILIO] Missing or placeholder TWILIO_AUTH_TOKEN/API_SECRET in .env!`);
      console.log(`🔑 [OTP DEV FALLBACK] Phone: ${to} → OTP: ${otp}\n`);
      return { sent: true, devOtp: otp };
    }

    const params = new URLSearchParams({
      To: to,
      From: from || '+15005550006',
      Body: `Your Fundu OTP is ${otp}. Valid for 10 minutes. Do not share it with anyone.`,
    });

    const creds = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    console.log(`[TWILIO] Sending SMS to ${to} via Key: ${apiKey} (Account: ${accountSid})...`);

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
      console.error(`❌ [TWILIO ERROR] Status ${res.status}: ${data?.message || 'Twilio send failed.'} (Code: ${data?.code})`);
      // If trial account error or authentication failure, log OTP to console for seamless developer experience
      console.log(`🔑 [OTP DEV FALLBACK] Phone: ${to} → OTP: ${otp}\n`);
      return {
        sent: true,
        devOtp: otp,
        warning: data?.message || 'Twilio send failed, used dev fallback.',
      };
    }

    console.log(`✅ [TWILIO] SMS successfully dispatched. SID: ${data?.sid}`);
    return { sent: true, sid: data?.sid };
  } catch (err) {
    console.error(`❌ [TWILIO EXCEPTION]:`, err.message);
    return { sent: true, devOtp: otp };
  }
}

/* ── Fast2SMS (India) ────────────────────────────────────────── */
async function sendViaFast2SMS(phone, otp) {
  try {
    const apiKey = (process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY || '').trim();
    if (!apiKey) {
      console.warn('[Fast2SMS] Missing SMS_API_KEY in .env. Falling back to dev mode.');
      return { sent: true, devOtp: otp };
    }

    const normalized = String(phone).replace(/\D/g, '').slice(-10);

    // 1. Try OTP route (URL Query format - Fast2SMS V2 API standard)
    const otpUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(apiKey)}&route=otp&variables_values=${otp}&numbers=${normalized}`;
    let res = await fetch(otpUrl, { method: 'GET' });
    let data = await res.json().catch(() => null);

    // 2. Try Quick SMS route if OTP route returned false or requires DLT template
    if (!res.ok || data?.return === false) {
      console.log(`[Fast2SMS Notice]: ${data?.message || 'OTP route notice'}, trying Quick SMS route...`);
      const qUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(apiKey)}&route=q&message=${encodeURIComponent(`Your Fundu OTP is ${otp}. Valid for 10 mins.`)}&language=english&flash=0&numbers=${normalized}`;
      res = await fetch(qUrl, { method: 'GET' });
      data = await res.json().catch(() => null);
    }

    if (!res.ok || data?.return === false) {
      console.warn('⚠️ [Fast2SMS API Response Notice]:', data?.message || data || res.statusText);
      console.log(`🔑 [SMS Fallback Log] Phone: +91 ${normalized} → OTP: ${otp}`);
      return { sent: true, devOtp: otp, notice: data?.message };
    }

    console.log(`📱 [Fast2SMS Real SMS Dispatched] To: +91 ${normalized} → OTP: ${otp}`);
    return { sent: true };
  } catch (err) {
    console.error('Fast2SMS Exception:', err);
    return { sent: true, devOtp: otp, notice: err.message };
  }
}
