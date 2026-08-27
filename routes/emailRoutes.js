import { Router } from 'express';
import { Resend } from 'resend';

const router = Router();

/**
 * POST /api/email/send
 * Send email via Resend API (Lazy API key initialization)
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, from } = req.body;
    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    if (!apiKey) {
      console.log('🎉 [Resend Server Log] API key missing in .env, simulated email dispatch to:', to);
      return res.json({ success: true, simulated: true, recipient: to });
    }

    const resend = new Resend(apiKey);

    const data = await resend.emails.send({
      from: from || 'onboarding@resend.dev',
      to: to || 'trustiqueassist0003@gmail.com',
      subject: subject || 'Hello World',
      html: html || '<p>Congrats on sending your <strong>first email</strong>!</p>',
    });

    console.log('🎉 Resend Email Dispatched Successfully:', data);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Resend Email Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send email' });
  }
});

/**
 * POST /api/email/send-otp
 * Body: { email, otp, userName? }
 * Sends 6-digit OTP directly to email via Resend API (Zero DLT)
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
          <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Zero-DLT Resend Email Verification</p>
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

    if (!apiKey) {
      console.log(`🔑 [Email OTP Simulated] To: ${recipientEmail} → OTP: ${otpCode}`);
      return res.json({ success: true, simulated: true, recipient: recipientEmail, otp: otpCode });
    }

    const resend = new Resend(apiKey);
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [recipientEmail],
      subject: `🔑 ${otpCode} is your Fundu Email OTP Code`,
      html: emailHtml,
    });

    console.log(`🔑 [Resend Email OTP Sent] To: ${recipientEmail} → OTP: ${otpCode}`);
    res.json({ success: true, data, otp: otpCode });
  } catch (error) {
    console.error('❌ Resend Email OTP Error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send Email OTP' });
  }
});

export default router;
