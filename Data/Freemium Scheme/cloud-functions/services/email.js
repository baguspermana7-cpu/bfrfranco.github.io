/**
 * Email sender using Resend API.
 * Used for: welcome emails, payment receipts, renewal reminders, dunning.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'ResistanceZero <noreply@resistancezero.com>';

/**
 * Send an email via Resend.
 * @param {{ to: string, subject: string, html: string }} opts
 */
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email to', to);
    return { ok: false, error: 'No API key' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send a welcome email after first login.
 */
async function sendWelcome(email, name) {
  return sendEmail({
    to: email,
    subject: 'Welcome to ResistanceZero',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e3a5f;">Welcome to ResistanceZero${name ? ', ' + name : ''}</h2>
        <p style="color:#475569;line-height:1.6;">
          Your account is ready. You can now access our data center infrastructure calculators
          and analysis tools.
        </p>
        <p style="color:#475569;line-height:1.6;">
          Upgrade to <strong>Pro</strong> to unlock advanced features like Monte Carlo simulation,
          sensitivity analysis, PDF exports, and AI-generated narratives.
        </p>
        <a href="https://resistancezero.com/dashboard.html" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:16px;">
          Go to Dashboard
        </a>
        <p style="color:#94a3b8;font-size:0.85rem;margin-top:24px;">
          ResistanceZero // Mission Critical Infrastructure
        </p>
      </div>
    `
  });
}

/**
 * Send a payment receipt.
 */
async function sendPaymentReceipt(email, { invoiceNumber, planName, amount, paidAt }) {
  const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  return sendEmail({
    to: email,
    subject: `Payment Receipt — ${invoiceNumber}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e3a5f;">Payment Received</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#64748b;">Invoice</td><td style="padding:8px 0;font-weight:600;">${invoiceNumber}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Plan</td><td style="padding:8px 0;font-weight:600;">${planName}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Amount</td><td style="padding:8px 0;font-weight:600;">${formattedAmount}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Date</td><td style="padding:8px 0;font-weight:600;">${new Date(paidAt).toLocaleDateString('id-ID')}</td></tr>
        </table>
        <p style="color:#94a3b8;font-size:0.85rem;margin-top:24px;">
          ResistanceZero // Mission Critical Infrastructure
        </p>
      </div>
    `
  });
}

module.exports = { sendEmail, sendWelcome, sendPaymentReceipt };
