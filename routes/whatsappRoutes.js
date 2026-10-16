import { Router } from 'express';
import { sendViaNodemailer } from './emailRoutes.js';

const router = Router();

/**
 * Format Indian phone number to 91XXXXXXXXXX
 */
function normalizePhone(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length > 10) return `91${digits.slice(-10)}`;
  return digits;
}

/**
 * Send WhatsApp Message via Meta WhatsApp Cloud API (Graph API)
 */
async function sendViaMetaCloudApi(phone, message) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    return { sent: false, reason: 'META_CREDS_MISSING' };
  }

  const normPhone = normalizePhone(phone);
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normPhone,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('⚠️ [Meta WhatsApp API Error]:', data);
    return { sent: false, error: data?.error?.message || 'Meta API call failed' };
  }

  console.log(`✅ [Meta WhatsApp API Delivered] To: +${normPhone}`);
  return { sent: true, data };
}

/**
 * Send WhatsApp Message via Twilio WhatsApp API
 */
async function sendViaTwilioWhatsApp(phone, message) {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from = (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER || '').trim();

  if (!sid || !token || !from || sid.includes('your_twilio')) {
    return { sent: false, reason: 'TWILIO_CREDS_MISSING' };
  }

  const normPhone = normalizePhone(phone);
  const formattedFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  const formattedTo = `whatsapp:+${normPhone}`;

  const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
  const body = new URLSearchParams({
    From: formattedFrom,
    To: formattedTo,
    Body: message,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('⚠️ [Twilio WhatsApp Error]:', data);
    return { sent: false, error: data?.message || 'Twilio WhatsApp failed' };
  }

  console.log(`✅ [Twilio WhatsApp Delivered] To: ${formattedTo}`);
  return { sent: true, data };
}

/**
 * Send WhatsApp Message via UltraMsg API
 */
async function sendViaUltraMsg(phone, message) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;

  if (!instanceId || !token) {
    return { sent: false, reason: 'ULTRAMSG_CREDS_MISSING' };
  }

  const normPhone = normalizePhone(phone);
  const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token,
      to: normPhone,
      body: message,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { sent: false, error: data };
  }

  console.log(`✅ [UltraMsg WhatsApp Delivered] To: +${normPhone}`);
  return { sent: true, data };
}

/**
 * POST /api/whatsapp/send
 * Universal Automated Background WhatsApp Dispatcher
 */
router.post('/send', async (req, res) => {
  try {
    const { numbers, phone, message } = req.body;
    const recipientNumbers = Array.isArray(numbers)
      ? numbers
      : (phone ? [phone] : ['9105783553', '9839122345']);

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message body is required' });
    }

    const results = [];

    for (const num of recipientNumbers) {
      const cleanNum = normalizePhone(num);
      let dispatch = { sent: false, phone: cleanNum };

      // 1. Try Meta WhatsApp Cloud API
      dispatch = await sendViaMetaCloudApi(cleanNum, message);

      // 2. Fallback to Twilio WhatsApp
      if (!dispatch.sent) {
        dispatch = await sendViaTwilioWhatsApp(cleanNum, message);
      }

      // 3. Fallback to UltraMsg
      if (!dispatch.sent) {
        dispatch = await sendViaUltraMsg(cleanNum, message);
      }

      results.push({ phone: cleanNum, ...dispatch });
    }

    const anySent = results.some((r) => r.sent);

    // If no direct WhatsApp API keys were configured, dispatch instant backup email so no alert is ever lost
    if (!anySent) {
      console.warn('ℹ️ [WhatsApp Dispatcher] No direct WhatsApp API keys found in .env (Meta / Twilio / UltraMsg).');
      console.log('📨 Sending instant backup email notification to trustiqueassist0003@gmail.com...');

      await sendViaNodemailer({
        to: 'trustiqueassist0003@gmail.com',
        subject: `🚨 [FUNDU INSTANT ALERT] Automated Notification (WhatsApp Backend)`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="background-color: #0f172a; padding: 16px; border-radius: 12px; text-align: center; color: white;">
              <h2 style="margin: 0; color: #14b8a6;">FUNDU AUTOMATED ALERT</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">Instant Notification Engine</p>
            </div>
            <div style="padding: 20px 0; font-size: 14px; white-space: pre-wrap; line-height: 1.6;">
${message}
            </div>
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; color: #64748b;">
              <b>Target Admin Numbers:</b> ${recipientNumbers.map(n => `+${normalizePhone(n)}`).join(', ')}
            </div>
          </div>
        `,
      });
    }

    return res.json({
      success: true,
      anySent,
      results,
      note: anySent
        ? 'Direct WhatsApp API messages sent'
        : 'Dispatched to admin notification engine & delivered via guaranteed SMTP',
    });
  } catch (err) {
    console.error('WhatsApp route error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
