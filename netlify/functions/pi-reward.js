// Netlify Function: مكافأة التسجيل (1 Test-Pi) + سحبها بـ App-to-User (A2U)
// Environment variables المطلوبة في Netlify:
//   PI_API_KEY             -> Server API Key من Pi Developer Portal
//   PI_APP_WALLET_SECRET   -> Secret Seed لمحفظة التطبيق (يبدأ بـ S) — Testnet
//   SUPABASE_URL           -> https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY   -> service_role key (سرّي، لا تضعه في الواجهة أبداً)
const StellarSdk = require('stellar-sdk');

const PI_API = 'https://api.minepi.com/v2';
const HORIZON = 'https://api.testnet.minepi.com';
const PASSPHRASE = 'Pi Testnet';
const REWARD_AMOUNT = 1;

const { PI_API_KEY, PI_APP_WALLET_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

const json = (code, body) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── Supabase (service role) ──
const sbHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
});
async function sb(path, method = 'GET', body, prefer) {
  const headers = sbHeaders();
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : [];
}
const getReward = async (uid) =>
  (await sb(`pi_rewards?pi_uid=eq.${encodeURIComponent(uid)}&select=*`))[0] || null;
const patchReward = (uid, extra, patch) =>
  sb(`pi_rewards?pi_uid=eq.${encodeURIComponent(uid)}${extra || ''}`, 'PATCH', patch, 'return=representation');

// ── Pi API (server key) ──
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

// التحقق من هوية اللاعب عبر accessToken (لا نثق بأي uid يأتي من الواجهة)
async function verifyUser(accessToken) {
  if (!accessToken) throw Object.assign(new Error('Missing access token'), { code: 401 });
  const r = await fetch(`${PI_API}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw Object.assign(new Error('Invalid Pi access token'), { code: 401 });
  const me = await r.json();
  if (!me.uid) throw Object.assign(new Error('Invalid Pi user'), { code: 401 });
  return { uid: me.uid, username: me.username || '' };
}

const publicReward = (row) => row && ({
  amount: Number(row.amount), status: row.status, txid: row.txid || null,
});

// ── استرجاع حالة سحب عالقة (pending) ──
async function recoverPending(row) {
  if (!row.payment_id) return patchReward(row.pi_uid, '&status=eq.pending', { status: 'ready' });
  let p;
  try { p = await piServer(`/payments/${row.payment_id}`); }
  catch (e) { return patchReward(row.pi_uid, '&status=eq.pending', { status: 'ready', payment_id: null }); }

  if (p.status && p.status.developer_completed) {
    return patchReward(row.pi_uid, '', {
      status: 'withdrawn', txid: p.transaction?.txid || row.txid, withdrawn_at: new Date().toISOString(),
    });
  }
  const txid = p.transaction?.txid || row.txid;
  if (txid) {
    await piServer(`/payments/${row.payment_id}/complete`, 'POST', { txid });
    return patchReward(row.pi_uid, '', {
      status: 'withdrawn', txid, withdrawn_at: new Date().toISOString(),
    });
  }
  try { await piServer(`/payments/${row.payment_id}/cancel`, 'POST'); } catch (e) {}
  return patchReward(row.pi_uid, '&status=eq.pending', { status: 'ready', payment_id: null });
}

// ── إرسال A2U على Pi Testnet ──
async function sendA2U(user) {
  // 1) إنشاء الدفعة
  const created = await piServer('/payments', 'POST', {
    payment: {
      amount: REWARD_AMOUNT,
      memo: 'Super Pio: welcome reward',
      metadata: { type: 'welcome_reward', uid: user.uid },
      uid: user.uid,
    },
  });
  const paymentId = created.identifier;
  const toAddress = created.to_address;
  await patchReward(user.uid, '&status=eq.pending', { payment_id: paymentId });

  let txid;
  try {
    // 2) تنفيذ المعاملة على البلوكشين
    const server = new StellarSdk.Server(HORIZON);
    const kp = StellarSdk.Keypair.fromSecret(PI_APP_WALLET_SECRET);
    const account = await server.loadAccount(kp.publicKey());
    const fee = await server.fetchBaseFee();
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: String(fee),
      networkPassphrase: PASSPHRASE,
      timebounds: await server.fetchTimebounds(180),
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: toAddress,
        asset: StellarSdk.Asset.native(),
        amount: String(REWARD_AMOUNT),
      }))
      .addMemo(StellarSdk.Memo.text(paymentId))
      .build();
    tx.sign(kp);
    txid = (await server.submitTransaction(tx)).id;
  } catch (e) {
    // فشلت المعاملة قبل الإرسال: نلغي الدفعة ونعيد الرصيد للاعب
    try { await piServer(`/payments/${paymentId}/cancel`, 'POST'); } catch (_) {}
    await patchReward(user.uid, '&status=eq.pending', { status: 'ready', payment_id: null });
    throw new Error('Blockchain transaction failed: ' + e.message);
  }

  // تم الإرسال: نحفظ txid أولاً (حتى لو فشل complete يمكن استرجاعه لاحقاً)
  await patchReward(user.uid, '&status=eq.pending', { txid });
  await piServer(`/payments/${paymentId}/complete`, 'POST', { txid });
  const [done] = await patchReward(user.uid, '', {
    status: 'withdrawn', txid, withdrawn_at: new Date().toISOString(),
  });
  return done;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!PI_API_KEY || !PI_APP_WALLET_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return json(500, { error: 'Server is not configured' });

  try {
    const { action, accessToken } = JSON.parse(event.body || '{}');
    const user = await verifyUser(accessToken);

    // تسجيل اللاعب ومنحه مكافأة 1 Test-Pi (مرة واحدة فقط لكل محفظة/uid)
    if (action === 'register') {
      const inserted = await sb('pi_rewards', 'POST',
        { pi_uid: user.uid, username: user.username, amount: REWARD_AMOUNT },
        'resolution=ignore-duplicates,return=representation');
      const row = await getReward(user.uid);
      return json(200, { newly_granted: inserted.length > 0, reward: publicReward(row) });
    }

    if (action === 'status') {
      return json(200, { reward: publicReward(await getReward(user.uid)) });
    }

    // سحب المكافأة إلى محفظة اللاعب
    if (action === 'withdraw') {
      let row = await getReward(user.uid);
      if (!row) return json(404, { error: 'No reward found' });
      if (row.status === 'withdrawn') return json(409, { error: 'Already withdrawn', reward: publicReward(row) });

      if (row.status === 'pending') {
        await recoverPending(row);
        row = await getReward(user.uid);
        if (row.status === 'withdrawn') return json(200, { reward: publicReward(row) });
      }

      // قفل ذري: فقط طلب واحد ينجح في تحويل ready → pending
      const claimed = await patchReward(user.uid, '&status=eq.ready', { status: 'pending' });
      if (!claimed.length) return json(409, { error: 'Withdrawal already in progress' });

      try {
        const done = await sendA2U(user);
        return json(200, { reward: publicReward(done) });
      } catch (e) {
        // دفعة عالقة من محاولة سابقة؟ ننظّفها ثم يعيد اللاعب المحاولة
        try {
          const inc = await piServer('/payments/incomplete_server_payments');
          for (const p of inc.incomplete_server_payments || []) {
            const t = p.transaction?.txid;
            if (t) await piServer(`/payments/${p.identifier}/complete`, 'POST', { txid: t });
            else await piServer(`/payments/${p.identifier}/cancel`, 'POST');
          }
        } catch (_) {}
        await patchReward(user.uid, '&status=eq.pending&txid=is.null', { status: 'ready', payment_id: null });
        console.error('[withdraw]', e.message);
        return json(502, { error: 'Withdrawal failed, please try again in a moment' });
      }
    }

    return json(400, { error: 'Unknown action' });
  } catch (e) {
    console.error('[pi-reward]', e.message);
    return json(e.code || 500, { error: e.code === 401 ? e.message : 'Server error' });
  }
};
