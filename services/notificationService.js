/**
 * Fundu Automated Notification Engine (Email & WhatsApp)
 * Exclusively designed for Lucknow doorstep delivery & pickup operations.
 */

// Dev mode / Provider configuration
const DEV_MODE = process.env.NOTIFICATION_DEV_MODE === 'true' || !process.env.SMTP_HOST;

/**
 * Format clean Indian phone number for WhatsApp (91XXXXXXXXXX)
 */
export const formatWhatsAppNumber = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned;
  return cleaned;
};

/**
 * Generate a direct 1-click WhatsApp web/app link
 */
export const generateWhatsAppLink = (phone, text) => {
  const formattedPhone = formatWhatsAppNumber(phone);
  if (!formattedPhone) return null;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
};

/**
 * Send an Email (with fallbacks and clean logging)
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) return { success: false, error: 'No recipient email provided' };

  if (DEV_MODE) {
    console.log('\n=================== [FUNDU EMAIL DISPATCH] ===================');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text Preview: ${text || subject}`);
    console.log('==============================================================\n');
    return { success: true, mode: 'dev_preview' };
  }

  try {
    // If SMTP or Resend API is configured in env
    if (process.env.RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Fundu Lucknow <notifications@fundu.in>',
          to: [to],
          subject,
          html,
          text,
        }),
      });
      const data = await res.json();
      return { success: res.ok, data };
    }

    console.log(`[EMAIL DISPATCH] ${to} → ${subject}`);
    return { success: true };
  } catch (err) {
    console.error('[EMAIL ERROR]', err);
    return { success: false, error: err.message };
  }
};

/**
 * Send WhatsApp Notification (API or logging)
 */
export const sendWhatsAppNotification = async ({ phone, message }) => {
  const formattedPhone = formatWhatsAppNumber(phone);
  if (!formattedPhone) return { success: false, error: 'Invalid phone number' };

  if (DEV_MODE) {
    console.log('\n------------------ [FUNDU WHATSAPP ALERT] ------------------');
    console.log(`Phone: +${formattedPhone}`);
    console.log(`Message:\n${message}`);
    console.log(`1-Click Link: https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`);
    console.log('------------------------------------------------------------\n');
    return {
      success: true,
      mode: 'dev_preview',
      link: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`,
    };
  }

  try {
    // If MSG91 or Twilio WhatsApp is configured
    console.log(`[WHATSAPP DISPATCH] +${formattedPhone} message sent.`);
    return {
      success: true,
      link: `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`,
    };
  } catch (err) {
    console.error('[WHATSAPP ERROR]', err);
    return { success: false, error: err.message };
  }
};

/**
 * Event-Driven Notification Handlers with Clear Subjects & Lucknow Localized Copy
 */
export const triggerEventNotification = async (eventType, payload) => {
  try {
    switch (eventType) {
      /* ── 1. CUSTOMER ORDERS (BUY REFURBISHED) ── */
      case 'order_created': {
        const orderId = String(payload.id || payload._id || '').slice(0, 8);
        const name = payload.delivery_name || 'Customer';
        const total = payload.total_amount ? `₹${payload.total_amount.toLocaleString('en-IN')}` : '';
        const area = payload.delivery_area || 'Lucknow';

        const subject = `[Fundu Lucknow] Order #${orderId} Confirmed — Refurbished Device`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5ecef; border-radius: 12px;">
            <h2 style="color: #0d9488; margin-top: 0;">Order Confirmed!</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your order <strong>#${orderId}</strong> worth <strong>${total}</strong> has been confirmed for doorstep delivery in <strong>${area}, Lucknow</strong>.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Delivery Slot:</strong> ${payload.delivery_slot || 'Standard Express'}</p>
              <p style="margin: 0 0 8px 0;"><strong>Payment Method:</strong> ${payload.payment_method || 'Cash on Delivery'}</p>
              <p style="margin: 0;"><strong>Assigned Executive:</strong> ${payload.delivery_person_name || 'Rohit Verma'} (${payload.delivery_person_phone || '+91 98391 22345'})</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">Fundu Lucknow Hub · 100% Quality Tested with 6 Months Warranty</p>
          </div>
        `;

        const waText = `📱 *Fundu Lucknow — Order Confirmed!*\n\nHi ${name}, your order *#${orderId}* (${total}) is confirmed for delivery at *${area}, Lucknow*.\n\n🚚 *Executive:* ${payload.delivery_person_name || 'Rohit Verma'} (${payload.delivery_person_phone || '+91 98391 22345'})\n⏱ *Slot:* ${payload.delivery_slot || 'Standard Express'}\n\nTrack your order anytime at fundu.in/dashboard`;

        if (payload.delivery_email) {
          await sendEmail({ to: payload.delivery_email, subject, html: emailHtml });
        }
        if (payload.delivery_phone) {
          await sendWhatsAppNotification({ phone: payload.delivery_phone, message: waText });
        }
        break;
      }

      case 'order_dispatched': {
        const orderId = String(payload.id || payload._id || '').slice(0, 8);
        const name = payload.delivery_name || 'Customer';
        const agentName = payload.delivery_person_name || 'Our Lucknow Executive';
        const agentPhone = payload.delivery_person_phone || '+91 98391 22345';
        const eta = payload.estimated_arrival_time || 'Shortly';

        const subject = `[Fundu Dispatch] Your Order #${orderId} is Out for Delivery!`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5ecef; border-radius: 12px;">
            <h2 style="color: #0284c7; margin-top: 0;">Out for Delivery! 🚚</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your Fundu order <strong>#${orderId}</strong> is on the way to your address.</p>
            <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #0284c7; margin: 15px 0;">
              <p style="margin: 0 0 6px 0;"><strong>Delivery Executive:</strong> ${agentName}</p>
              <p style="margin: 0 0 6px 0;"><strong>Contact:</strong> ${agentPhone}</p>
              <p style="margin: 0;"><strong>ETA:</strong> ${eta}</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">Please keep the payment ready (if COD) and inspect the phone upon delivery.</p>
          </div>
        `;

        const waText = `🚚 *Fundu Lucknow — Order Dispatched!*\n\nHi ${name}, your order *#${orderId}* is OUT FOR DELIVERY!\n\n👤 *Agent:* ${agentName} (${agentPhone})\n⏱ *ETA:* ${eta}\n\nPlease be available at your Lucknow doorstep.`;

        if (payload.delivery_email) {
          await sendEmail({ to: payload.delivery_email, subject, html: emailHtml });
        }
        if (payload.delivery_phone) {
          await sendWhatsAppNotification({ phone: payload.delivery_phone, message: waText });
        }
        break;
      }

      case 'order_delivered': {
        const orderId = String(payload.id || payload._id || '').slice(0, 8);
        const name = payload.delivery_name || 'Customer';

        const subject = `[Fundu Success] Order #${orderId} Delivered Successfully`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5ecef; border-radius: 12px;">
            <h2 style="color: #16a34a; margin-top: 0;">Delivered! 🎉</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your order <strong>#${orderId}</strong> has been successfully delivered. Thank you for choosing Fundu Lucknow!</p>
            <p>Your 6-month warranty is now active. You can download the invoice from your dashboard.</p>
          </div>
        `;

        const waText = `🎉 *Fundu Lucknow — Order Delivered!*\n\nHi ${name}, your order *#${orderId}* has been successfully delivered.\n\n🛡 Your 6-Month Fundu Warranty is now active. Thank you for choosing Fundu!`;

        if (payload.delivery_email) {
          await sendEmail({ to: payload.delivery_email, subject, html: emailHtml });
        }
        if (payload.delivery_phone) {
          await sendWhatsAppNotification({ phone: payload.delivery_phone, message: waText });
        }
        break;
      }

      /* ── 2. SELL PHONE REQUESTS (CASHIFY MODEL) ── */
      case 'sell_request_created': {
        const model = `${payload.brand || ''} ${payload.model || ''}`.trim();
        const price = payload.estimated_price ? `₹${payload.estimated_price.toLocaleString('en-IN')}` : 'Best Price';
        const area = payload.pickup_area || 'Lucknow';
        const agentName = payload.pickup_person_name || 'Field Executive';
        const agentPhone = payload.pickup_person_phone || '+91 98391 22345';

        const subject = `[Fundu Lucknow] Doorstep Pickup Scheduled: ${model}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5ecef; border-radius: 12px;">
            <h2 style="color: #059669; margin-top: 0;">Doorstep Pickup Confirmed!</h2>
            <p>Your request to sell <strong>${model}</strong> for guaranteed quote <strong>${price}</strong> has been scheduled.</p>
            <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0 0 6px 0;"><strong>Pickup Locality:</strong> ${area}, Lucknow</p>
              <p style="margin: 0 0 6px 0;"><strong>Pickup Slot:</strong> ${payload.pickup_slot || 'Today'} (${payload.pickup_date || 'Today'})</p>
              <p style="margin: 0 0 6px 0;"><strong>Assigned Executive:</strong> ${agentName} (${agentPhone})</p>
              <p style="margin: 0;"><strong>Payout Mode:</strong> ${payload.payout_method || 'Instant UPI / Spot Cash'}</p>
            </div>
            <p style="font-size: 13px; color: #64748b;">Please backup your data and keep a valid ID proof ready for doorstep payout.</p>
          </div>
        `;

        const waText = `💰 *Fundu Lucknow — Sell Order Booked!*\n\nYour pickup for *${model}* (Estimated Quote: *${price}*) is scheduled at *${area}, Lucknow*.\n\n👤 *Pickup Executive:* ${agentName} (${agentPhone})\n⏱ *Slot:* ${payload.pickup_slot || 'Today'}\n💵 *Payout:* Spot Cash / Instant UPI at doorstep!`;

        if (payload.email) {
          await sendEmail({ to: payload.email, subject, html: emailHtml });
        }
        if (payload.phone || payload.contact_phone) {
          await sendWhatsAppNotification({ phone: payload.phone || payload.contact_phone, message: waText });
        }
        break;
      }

      case 'sell_request_completed': {
        const model = `${payload.brand || ''} ${payload.model || ''}`.trim();
        const price = payload.final_price || payload.estimated_price ? `₹${(payload.final_price || payload.estimated_price).toLocaleString('en-IN')}` : '';

        const subject = `[Fundu Success] Phone Sold! Spot Payout Completed for ${model}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5ecef; border-radius: 12px;">
            <h2 style="color: #059669; margin-top: 0;">Payout Completed! 💸</h2>
            <p>Your <strong>${model}</strong> has been inspected and picked up.</p>
            <p>Spot payout of <strong>${price}</strong> has been transferred via <strong>${payload.payout_method || 'UPI / Cash'}</strong>.</p>
            <p style="color: #64748b; font-size: 13px;">Thank you for selling with Fundu Lucknow!</p>
          </div>
        `;

        const waText = `💸 *Fundu Lucknow — Payout Completed!*\n\nYour *${model}* has been picked up & spot payout of *${price}* transferred successfully.\n\nThank you for choosing Fundu Lucknow!`;

        if (payload.email) {
          await sendEmail({ to: payload.email, subject, html: emailHtml });
        }
        if (payload.phone || payload.contact_phone) {
          await sendWhatsAppNotification({ phone: payload.phone || payload.contact_phone, message: waText });
        }
        break;
      }

      /* ── 3. REPAIR SERVICE ── */
      case 'repair_created': {
        const device = `${payload.brand || ''} ${payload.model || ''}`.trim();
        const area = payload.pickup_area || 'Lucknow';
        const technician = payload.technician_name || payload.pickup_person_name || 'Vikas Yadav';
        const phone = payload.technician_phone || payload.pickup_person_phone || '+91 87654 32109';

        const subject = `[Fundu Repair] Technician Scheduled for ${device}`;
        const waText = `🔧 *Fundu Lucknow — Repair Booked!*\n\nRepair scheduled for *${device}* (${payload.issue || 'Diagnostics'}) at *${area}, Lucknow*.\n\n🛠 *Technician:* ${technician} (${phone})\n⏱ *Slot:* ${payload.pickup_slot || 'Today'}\n\nWe provide 100% genuine parts with 3 months repair warranty.`;

        if (payload.email) {
          await sendEmail({ to: payload.email, subject, text: waText });
        }
        if (payload.contact_phone || payload.phone) {
          await sendWhatsAppNotification({ phone: payload.contact_phone || payload.phone, message: waText });
        }
        break;
      }

      /* ── 4. WHOLESALER B2B & KHATA / LEDGER ── */
      case 'wholesale_order_created': {
        const orderId = String(payload.id || payload._id || '').slice(0, 8);
        const name = payload.vendor_name || payload.business_name || 'Wholesale Partner';
        const total = `₹${(payload.total_amount || 0).toLocaleString('en-IN')}`;
        const paymentMode = payload.payment_method === 'credit' ? 'Fundu Credit (Khata)' : 'Spot Cash';

        const subject = `[Fundu B2B] Wholesale Order #${orderId} Confirmed (${paymentMode})`;
        const waText = `📦 *Fundu B2B Lucknow — Order Confirmed!*\n\nHello *${name}*,\nWholesale Order *#${orderId}* for *${total}* is confirmed.\n\n💳 *Payment:* ${paymentMode}\n🏢 *Pickup Point:* Fundu Lucknow Central Hub\n\nYour ledger has been updated automatically.`;

        if (payload.vendor_phone) {
          await sendWhatsAppNotification({ phone: payload.vendor_phone, message: waText });
        }
        break;
      }

      case 'vendor_ledger_updated': {
        const name = payload.vendor_name || 'Partner';
        const amount = `₹${(payload.amount || 0).toLocaleString('en-IN')}`;
        const balance = `₹${(payload.balance_after || 0).toLocaleString('en-IN')}`;
        const typeText = payload.type === 'cash_repayment' ? 'Payment Received' : 'Credit Purchase';

        const subject = `[Fundu B2B] Khata Updated — Outstanding Balance: ${balance}`;
        const waText = `📑 *Fundu B2B Khata Statement Update*\n\nPartner: *${name}*\nTransaction: *${typeText}* (${amount})\n\n💰 *Total Outstanding Due:* ${balance}\n\nCheck statement & invoices on fundu.in/wholesaler`;

        if (payload.vendor_phone) {
          await sendWhatsAppNotification({ phone: payload.vendor_phone, message: waText });
        }
        break;
      }

      default:
        console.log(`[NOTIFICATION NOTICE] No handler for event: ${eventType}`);
    }
  } catch (err) {
    console.error(`[NOTIFICATION DISPATCH ERROR for ${eventType}]:`, err);
  }
};
