import { Router } from 'express';
import { Resend } from 'resend';

const router = Router();

// Initialize Resend API client
const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY || 're_KbvdQsQU_4tMuhvtG4yB2xqmPLAfdGCwq';
const resend = new Resend(RESEND_API_KEY);

/**
 * POST /api/email/send
 * Send email via Resend API
 */
router.post('/send', async (req, res) => {
  try {
    const { to, subject, html, from } = req.body;

    const data = await resend.emails.send({
      from: from || 'Fundu Dispatch <onboarding@resend.dev>',
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

export default router;
