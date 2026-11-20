// Netlify Function: سحب مكافأة 1 Test-Pi (App-to-User) — بدون قاعدة بيانات
// المتغيرات المطلوبة في Netlify: PI_API_KEY ، PI_APP_WALLET_SECRET
const crypto = require('crypto');

const PI_API = 'https://api.minepi.com/v2';
const HORIZON = 'https://api.testnet.minepi.com';
const PASSPHRASE = 'Pi Testnet';
const REWARD_AMOUNT = 1;
const { PI_API_KEY, PI_APP_WALLET_SECRET } = process.env;


// ══ Stellar بدون مكتبات: strkey + XDR + توقيع ed25519 ══
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function crc16(buf) {
  let crc = 0;
  for (const b of buf) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}
function strDecode(s) {            // يرجع { ver, data(32) }
  let bits = 0, val = 0; const out = [];
  for (const c of s) {
    const i = B32.indexOf(c); if (i < 0) throw new Error('bad strkey');
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  const raw = Buffer.from(out);
  const body = raw.slice(0, raw.length - 2);
  const sum = raw.readUInt16LE(raw.length - 2);
  if (crc16(body) !== sum) throw new Error('bad strkey checksum');
  return { ver: body[0], data: body.slice(1) };
}
function ed25519FromSeed(seed32) {
  const priv = crypto.createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed32]),
    format: 'der', type: 'pkcs8',
  });
  const pub = crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' }).slice(-32);
  return { priv, pub };
}
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64BE(BigInt(n)); return b; };
const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);

function buildPaymentTx({ srcPub, destPub, seq, fee, amountStroops, memo, maxTime }) {
  return Buffer.concat([
    u32(0), srcPub,                       // source (ED25519)
    u32(fee), i64(seq),                   // fee, sequence
    u32(1), i64(0), i64(maxTime),         // preconditions: timebounds
    u32(1), u32(Buffer.byteLength(memo)), pad4(Buffer.from(memo)),  // memo text
    u32(1),                               // 1 operation
    u32(0),                               // op source: none
    u32(1),                               // PAYMENT
    u32(0), destPub,                      // destination
    u32(0),                               // native asset
    i64(amountStroops),
    u32(0),                               // ext
  ]);
}
function signTx(txBuf, passphrase, kp) {
  const netId = crypto.createHash('sha256').update(passphrase).digest();
  const payload = Buffer.concat([netId, u32(2), txBuf]);
  const hash = crypto.createHash('sha256').update(payload).digest();
  const sig = crypto.sign(null, hash, kp.priv);
  return Buffer.concat([
    u32(2), txBuf,                        // ENVELOPE_TYPE_TX + tx
    u32(1), kp.pub.slice(-4), u32(64), sig, // 1 signature: hint + sig
  ]);
}
async function horizon(path, opts) {
  const r = await fetch(HORIZON + path, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Horizon ${r.status}: ${JSON.stringify(d.extras || d.detail || d).slice(0, 200)}`);
  return d;
}
async function sendStellarPayment(toAddress, amount, memo) {
  const kp = ed25519FromSeed(strDecode(PI_APP_WALLET_SECRET).data);
  const dest = strDecode(toAddress).data;
  // عنوان المحفظة العام (G...) نستخرجه عبر Horizon من المفتاح العام
  const acc = await horizonAccount(kp.pub);
  const fee = 100000;
  const tx = buildPaymentTx({
    srcPub: kp.pub, destPub: dest, seq: BigInt(acc.sequence) + 1n, fee,
    amountStroops: Math.round(amount * 1e7), memo,
    maxTime: Math.floor(Date.now() / 1000) + 180,
  });
  const env = signTx(tx, PASSPHRASE, kp);
  const res = await horizon('/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'tx=' + encodeURIComponent(env.toString('base64')),
  });
  return res.hash || res.id;
}
function strEncodeG(pub) {
  const body = Buffer.concat([Buffer.from([6 << 3]), pub]);
  const crc = Buffer.alloc(2); crc.writeUInt16LE(crc16(body));
  const raw = Buffer.concat([body, crc]);
  let bits = 0, val = 0, out = '';
  for (const b of raw) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
const horizonAccount = (pub) => horizon('/accounts/' + strEncodeG(pub));

const json = (code, body) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function piServer(path, method = 'GET', body) {
  const r = await fetch(`${PI_API}${path}`, {
    method,
    headers: { Authorization: `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Pi API ${r.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// التحقق من هوية اللاعب عبر accessToken
async function verifyUser(accessToken) {
  if (!accessToken) throw Object.assign(new Error('Missing access token'), { code: 401 });
  const r = await fetch(`${PI_API}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw Object.assign(new Error('Invalid Pi access token'), { code: 401 });
  const me = await r.json();
  if (!me.uid) throw Object.assign(new Error('Invalid Pi user'), { code: 401 });
  return me.uid;
}

// تنظيف أي دفعات عالقة من محاولات سابقة
async function clearIncomplete() {
  try {
    const inc = await piServer('/payments/incomplete_server_payments');
    for (const p of inc.incomplete_server_payments || []) {
      const t = p.transaction && p.transaction.txid;
      if (t) await piServer(`/payments/${p.identifier}/complete`, 'POST', { txid: t });
      else await piServer(`/payments/${p.identifier}/cancel`, 'POST');
    }
  } catch (_) {}
}

async function sendA2U(uid) {
  const created = await piServer('/payments', 'POST', {
    payment: {
      amount: REWARD_AMOUNT,
      memo: 'Super Pio: welcome reward',
      metadata: { type: 'welcome_reward', uid },
      uid,
    },
  });
  const paymentId = created.identifier;

  let txid;
  try {
    txid = await sendStellarPayment(created.to_address, REWARD_AMOUNT, paymentId);
  } catch (e) {
    try { await piServer(`/payments/${paymentId}/cancel`, 'POST'); } catch (_) {}
    console.error('[tx]', e.message);
    throw new Error('Blockchain transaction failed: ' + e.message);
  }

  await piServer(`/payments/${paymentId}/complete`, 'POST', { txid });
  return txid;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!PI_API_KEY || !PI_APP_WALLET_SECRET) return json(500, { error: 'Server is not configured' });

  try {
    const { action, accessToken } = JSON.parse(event.body || '{}');
    const uid = await verifyUser(accessToken);
    if (action !== 'withdraw') return json(400, { error: 'Unknown action' });

    await clearIncomplete();
    const txid = await sendA2U(uid);
    return json(200, { txid });
  } catch (e) {
    console.error('[pi-reward]', e.message);
    if (e.code === 401) return json(401, { error: e.message });
    return json(502, { error: 'Withdrawal failed, please try again in a moment' });
  }
};
  
