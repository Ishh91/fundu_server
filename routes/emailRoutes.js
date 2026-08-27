import { Router } from 'express';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const router = Router();

/**
 * Helper to send email via Nodemailer (Gmail / SMTP)
 */
async function sendViaNodemailer({ to, subject, html, from }) {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!smtpUser || !smtpPass) {
    return { success: false, error: 'Missing SMTP_USER and SMTP_PASS credentials in .env' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const info = await transporter.sendMail({
    from: from || `"Fundu Dispatch" <${smtpUser}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject: subject,
    html: html,
  });

  console.log('🎉 Gmail SMTP Email Sent Successfully:', info.messageId);
  return { success: true, data: info };
}

/**
 * POST /api/email/send
 * Send email via Resend API or Gmail SMTP fallback
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, from } = req.body;
    const recipientEmail = to || 'trustiqueassist0003@gmail.com';
    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    // 1. Try Gmail SMTP if SMTP credentials exist
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpRes = await sendViaNodemailer({ to: recipientEmail, subject, html, from });
      if (smtpRes.success) {
        return res.json(smtpRes);
      }
    }

    // 2. Try Resend API if API Key exists
    if (apiKey && apiKey.startsWith('re_')) {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: from || 'onboarding@resend.dev',
        to: [recipientEmail],
        subject: subject || 'Hello World',
        html: html || '<p>Congrats on sending your <strong>first email</strong>!</p>',
      });

      if (!error && data) {
        console.log('🎉 Resend Email Dispatched Successfully:', data);
        return res.json({ success: true, data });
      }
      console.warn('⚠️ [Resend Notice]:', error?.message || 'API Key Error');
    }

    // 3. Fallback: Log email simulation (Prevents server crash on invalid key)
    console.log(`📧 [Email Dispatched (Simulated Mode)]: To: ${recipientEmail} | Subject: ${subject}`);
    res.json({
      success: true,
      simulated: true,
      notice: 'Provide a valid Resend API Key in .env',
      recipient: recipientEmail,
    });
  } catch (error) {
    console.error('❌ Resend Email Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send email' });
  }
});

/**
 * POST /api/email/send-otp
 * Sends 6-digit OTP code directly to email via Resend API or Gmail SMTP
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email, otp, userName } = req.body;
    const recipientEmail = email || 'trustiqueassist0003@gmail.com';
    const otpCode = otp || Math.floor(100000 + Math.random() * 900000).toString();

    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff;">
        <div style="background-color: #0f172a; padding: 20px; border-radius: 14px; text-align: center; color: white;">
          <h2 style="margin: 0; color: #14b8a6; font-size: 22px; font-weight: 900;">FUNDU SECURITY CODE</h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Resend / Gmail Email Verification</p>
        </div>

        <div style="padding: 24px 0; text-align: center;">
          <p style="font-size: 15px; color: #334155; margin-bottom: 20px;">
            Hi <strong>${userName || 'User'}</strong>, use the 6-digit verification code below to complete your registration or login:
          </p>

          <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; padding: 18px; border-radius: 16px; display: inline-block; margin: 10px 0;">
            <span style="font-family: monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #15803d;">
              ${otpCode}
            </span>
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
            ⏰ This code is valid for 10 minutes. Do not share this OTP code with anyone.
          </p>
        </div>
      </div>
    `;

    // 1. Try Gmail SMTP if configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpRes = await sendViaNodemailer({
        to: recipientEmail,
        subject: `🔑 ${otpCode} is your Fundu Email OTP Code`,
        html: emailHtml,
      });
      if (smtpRes.success) {
        return res.json({ success: true, otp: otpCode, data: smtpRes.data });
      }
    }

    // 2. Try Resend API if API Key is valid
    if (apiKey && apiKey.startsWith('re_')) {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [recipientEmail],
        subject: `🔑 ${otpCode} is your Fundu Email OTP Code`,
        html: emailHtml,
      });

      if (!error && data) {
        console.log(`🔑 [Resend Email OTP Sent] To: ${recipientEmail} → OTP: ${otpCode}`);
        return res.json({ success: true, data, otp: otpCode });
      }
      console.warn('⚠️ [Resend Email OTP Notice]:', error?.message || 'API Key Error');
    }

    // 3. Fallback: Log OTP code cleanly
    console.log(`🔑 [Email OTP Code (Simulated)]: To: ${recipientEmail} → OTP: ${otpCode}`);
    res.json({
      success: true,
      simulated: true,
      notice: 'Resend API key error. Please check .env settings.',
      recipient: recipientEmail,
      otp: otpCode,
    });
  } catch (error) {
    console.error('❌ Resend Email OTP Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send Email OTP' });
  }
});

export default router;
