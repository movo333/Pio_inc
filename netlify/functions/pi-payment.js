// Netlify Function — Pi Payment Proxy
const PI_API_BASE = 'https://api.minepi.com/v2';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'ok' };
  }

  try {
    const { action, paymentId, txid } = JSON.parse(event.body || '{}');
    const API_KEY = process.env.PI_API_KEY;

    if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'PI_API_KEY not set' }) };
    if (!paymentId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'paymentId required' }) };

    let url = `${PI_API_BASE}/payments/${paymentId}/${action}`;
    let body = action === 'complete' ? JSON.stringify({ txid }) : null;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Key ${API_KEY}`, 'Content-Type': 'application/json' },
      body,
    });

    const data = await res.text();
    console.log(`[Pi] ${action} → ${res.status}`);
    return { statusCode: res.status, headers, body: data };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
