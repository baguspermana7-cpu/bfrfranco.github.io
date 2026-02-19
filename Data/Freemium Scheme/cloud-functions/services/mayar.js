/**
 * Mayar payment gateway API wrapper.
 * Handles invoice creation, verification, and transaction lookup.
 *
 * Mayar quirks:
 *   - No webhook signature verification (verify via API)
 *   - Webhook status is boolean, not string
 *   - No payment_method in webhook (fetch via transactions API)
 *   - No refund API (manual via dashboard)
 *   - Rate limit: 20 req/min
 *   - Sandbox: https://api.mayar.club/hl/v1
 *   - Production: https://api.mayar.id/hl/v1
 */

const MAYAR_API_BASE = process.env.MAYAR_API_BASE || 'https://api.mayar.id/hl/v1';
const MAYAR_API_KEY = process.env.MAYAR_API_KEY;

const headers = {
  'Authorization': `Bearer ${MAYAR_API_KEY}`,
  'Content-Type': 'application/json'
};

/**
 * Create a Mayar invoice.
 */
async function createInvoice({ name, email, mobile, redirectUrl, description, expiredAt, items }) {
  const res = await fetch(`${MAYAR_API_BASE}/invoice/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, email, mobile, redirectUrl, description, expiredAt, items })
  });
  return res.json();
}

/**
 * Verify an invoice status via Mayar API.
 * Used instead of webhook signature verification.
 * @returns {{ verified: boolean, status: string|null }}
 */
async function verifyInvoice(mayarInvoiceId) {
  try {
    const res = await fetch(`${MAYAR_API_BASE}/invoice/${mayarInvoiceId}`, { headers });
    const data = await res.json();
    if (data.statusCode === 200 && data.data) {
      const status = data.data.status;
      return { verified: status === 'paid' || status === 'settled', status };
    }
    return { verified: false, status: null };
  } catch (err) {
    console.error('Mayar verification error:', err.message);
    return { verified: true, status: 'unknown' }; // Fallback: trust webhook if API is down
  }
}

/**
 * Try to fetch payment method from recent transactions.
 * Mayar doesn't include payment_method in webhooks.
 */
async function fetchPaymentMethod(mayarInvoiceId) {
  try {
    const res = await fetch(`${MAYAR_API_BASE}/transactions?page=1&pageSize=5`, { headers });
    const data = await res.json();
    if (data.data?.data) {
      const match = data.data.data.find(tx => tx.id === mayarInvoiceId);
      return match?.paymentMethod || null;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch payment method:', err.message);
    return null;
  }
}

module.exports = { createInvoice, verifyInvoice, fetchPaymentMethod, MAYAR_API_BASE };
