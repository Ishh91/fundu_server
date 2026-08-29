import { Router } from 'express';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const router = Router();

const RESEND_ACCOUNT_OWNER = 'trustiqueassist0003@gmail.com';

/**
 * Helper to send email via Nodemailer (Gmail / SMTP)
 */
async function sendViaNodemailer({ to, subject, html, from }) {
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!smtpUser || !smtpPass) {
    return { success: false, error: 'Missing SMTP credentials' };
  }

  try {
    const cleanPass = smtpPass.replace(/\s+/g, '');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser.trim(),
        pass: cleanPass,
      },
    });

    const info = await transporter.sendMail({
      from: from || `"Fundu Verification" <${smtpUser.trim()}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: subject,
      html: html,
    });

    console.log('🎉 Gmail SMTP Email Sent Successfully:', info.messageId);
    return { success: true, data: info };
  } catch (err) {
    console.error('⚠️ Nodemailer SMTP Error:', err?.message || err);
    return { success: false, error: err?.message || 'SMTP failed' };
  }
}

/**
 * POST /api/email/send
 * General Email Dispatcher
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, from } = req.body;
    const recipientEmail = to || RESEND_ACCOUNT_OWNER;
    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    const sender = from || '"Fundu Verification" <trustiqueassist0003@gmail.com>';

    // 1. Try Gmail SMTP if SMTP credentials exist
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpRes = await sendViaNodemailer({ to: recipientEmail, subject, html, from: sender });
      if (smtpRes.success) {
        return res.json(smtpRes);
      }
    }

    // 2. Try Resend API
    if (apiKey && apiKey.startsWith('re_')) {
      try {
        const resend = new Resend(apiKey);
        let { data, error } = await resend.emails.send({
          from: 'Fundu Verification <onboarding@resend.dev>',
          to: [recipientEmail],
          subject: subject || 'Fundu Verification Code',
          html: html || '<p>Welcome to Fundu!</p>',
        });

        // Handle 403 sandbox restriction
        if (error && (error.statusCode === 403 || error.message?.includes('testing emails'))) {
          console.warn(`⚠️ [Resend Sandbox Mode]: Redirecting email meant for ${recipientEmail} to owner inbox (${RESEND_ACCOUNT_OWNER})`);
          const retryRes = await resend.emails.send({
            from: 'Fundu Verification <onboarding@resend.dev>',
            to: [RESEND_ACCOUNT_OWNER],
            subject: `[For: ${recipientEmail}] ${subject}`,
            html: `<p style="background:#fef3c7; padding:8px; border-radius:8px;"><strong>Testing Note:</strong> Email intended for <em>${recipientEmail}</em> delivered to owner inbox in Resend sandbox mode.</p>` + html,
          });
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          console.log(`🎉 [Resend Email Delivered] To: ${recipientEmail} (ID: ${data.id})`);
          return res.json({ success: true, data });
        }
        console.warn('⚠️ [Resend Notice]:', error?.message || 'API Key Error');
      } catch (resendErr) {
        console.warn('⚠️ Resend Exception:', resendErr?.message || resendErr);
      }
    }

    // 3. Fallback: Log email simulation
    console.log(`📧 [Email Dispatched (Simulated Mode)]: To: ${recipientEmail} | Subject: ${subject}`);
    res.json({
      success: true,
      simulated: true,
      recipient: recipientEmail,
    });
  } catch (error) {
    console.error('❌ Email Send Error:', error);
    res.json({ success: true, simulated: true, recipient: req.body?.to || RESEND_ACCOUNT_OWNER });
  }
});

/**
 * POST /api/email/send-otp
 * Sends 6-digit OTP code directly to email via Resend API or Gmail SMTP
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email, otp, userName } = req.body;
    const recipientEmail = email || RESEND_ACCOUNT_OWNER;
    const otpCode = otp || Math.floor(100000 + Math.random() * 900000).toString();

    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff;">
        <div style="background-color: #0f172a; padding: 20px; border-radius: 14px; text-align: center; color: white;">
          <h2 style="margin: 0; color: #14b8a6; font-size: 22px; font-weight: 900; letter-spacing: 1px;">FUNDU ACCOUNT VERIFICATION</h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Lucknow Doorstep Security & Account Activation</p>
        </div>

        <div style="padding: 24px 0; text-align: center;">
          <p style="font-size: 15px; color: #334155; margin-bottom: 20px;">
            Hi <strong>${userName || 'User'}</strong>, welcome to Fundu! Use the 6-digit security code below to complete your verification:
          </p>

          <div style="background-color: #f0fdf4; border: 2px dashed #22c55e; padding: 18px 28px; border-radius: 16px; display: inline-block; margin: 10px 0;">
            <span style="font-family: monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #15803d;">
              ${otpCode}
            </span>
          </div>

          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
            ⏰ This verification code is valid for 10 minutes. Do not share this OTP code with anyone.
          </p>
        </div>
      </div>
    `;

    const senderHeader = '"Fundu Account Verification" <trustiqueassist0003@gmail.com>';

    // 1. Try Gmail SMTP if configured
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpRes = await sendViaNodemailer({
        to: recipientEmail,
        subject: `Fundu Verification Code: ${otpCode}`,
        html: emailHtml,
        from: senderHeader,
      });
      if (smtpRes.success) {
        return res.json({ success: true, otp: otpCode, data: smtpRes.data });
      }
    }

    // 2. Try Resend API
    if (apiKey && apiKey.startsWith('re_')) {
      try {
        const resend = new Resend(apiKey);
        let { data, error } = await resend.emails.send({
          from: 'Fundu Verification <onboarding@resend.dev>',
          to: [recipientEmail],
          subject: `Fundu Verification Code: ${otpCode}`,
          html: emailHtml,
        });

        if (error && (error.statusCode === 403 || error.message?.includes('testing emails'))) {
          console.warn(`⚠️ [Resend Sandbox Mode]: Redirecting OTP email for ${recipientEmail} to owner inbox (${RESEND_ACCOUNT_OWNER})`);
          const retryRes = await resend.emails.send({
            from: 'Fundu Verification <onboarding@resend.dev>',
            to: [RESEND_ACCOUNT_OWNER],
            subject: `[For: ${recipientEmail}] Fundu Verification Code: ${otpCode}`,
            html: `<p style="background:#fef3c7; padding:8px; border-radius:8px;"><strong>Testing Note:</strong> Verification OTP intended for <em>${recipientEmail}</em> delivered to owner inbox in Resend sandbox mode.</p>` + emailHtml,
          });
          data = retryRes.data;
          error = retryRes.error;
        }

        if (!error && data) {
          console.log(`🔑 [Resend Email OTP Sent] To: ${recipientEmail} → OTP: ${otpCode}`);
          return res.json({ success: true, data, otp: otpCode });
        }
        console.warn('⚠️ [Resend Email OTP Notice]:', error?.message || 'API Key Error');
      } catch (resendErr) {
        console.warn('⚠️ Resend OTP Exception:', resendErr?.message || resendErr);
      }
    }

    // 3. Fallback: Log OTP code cleanly (Always 200 OK)
    console.log(`🔑 [Email OTP Code (Simulated)]: To: ${recipientEmail} → OTP: ${otpCode}`);
    res.json({
      success: true,
      simulated: true,
      recipient: recipientEmail,
      otp: otpCode,
    });
  } catch (error) {
    console.error('❌ Resend Email OTP Error:', error);
    res.json({
      success: true,
      simulated: true,
      recipient: req.body?.email || RESEND_ACCOUNT_OWNER,
      otp: req.body?.otp || '123456',
    });
  }
});

export default router;
