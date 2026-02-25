// ═══════════════════════════════════════════════════════
//  SUPER PIO - Game Engine
//  Orientation: PORTRAIT device, LANDSCAPE game rotated 90°
//  Player runs RIGHT → progress toward goal
//  Ground = bottom 30% of game canvas
//  Sky    = top 70% of game canvas
// ═══════════════════════════════════════════════════════
'use strict';

// ── CONSTANTS ──
const TS     = 32;          // Tile size in px
const GRAV   = 0.42;
const JSPD   = -10.5;       // Jump velocity
const PSPD   = 3.2;         // Player walk speed
const MAX_VY = 16;

// Tile cell codes
const T = { AIR:0,GND:1,PLT:2,COIN:3,WALKER:4,FLYER:5,AMMO:6,GOAL:7,SPIKE:8,BREAK:9,SPRING:10,CRUMBLE:11,HEART:12 };

// ── SUPABASE CONFIG (Cloud Save) ──
const SUPA_URL = 'https://xwkosqpxfihgprfququw.supabase.co';
const SUPA_KEY = 'sb_publishable_TA1liFGVpi9Sw1HoTJz24Q_lg_3XvHv';

// ── AUDIO SYSTEM ──
// نستخدم AudioContext + XHR للأصوات الحرجة (تشغيل فوري بلا تأخير)
// وpool بسيط للباقي
const SFX = (() => {
  const BASE = 'assets/sounds/';
  const MAP = {
    coin:      'coin.ogg',
    jump:      'jump.ogg',
    shoot:     'trow.ogg',
    hit:       'hit.ogg',
    break:     'two-debris-break.ogg',
    heart:     'heartc.ogg',
    win:       'completed.ogg',
    lose:      'loselife.ogg',
    stomp:     'basho.ogg',
    spring:    'jumper.ogg',
    hurt:      'spike.ogg',
    land:      'afterfall.ogg',
    fall:      'fall.ogg',
    enemy_die: 'wimpact.ogg',
    step:      'step.ogg',
    purchase:  'purchase.ogg',
    timeover:  'timeover.ogg',
    arrival:   'arrival.ogg',
    click:     'click.ogg',
  };

  let _ac = null;
  const acBuffers = {};
  let muted = false;

  function getAC() {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
    if (_ac.state === 'suspended') _ac.resume().catch(()=>{});
    return _ac;
  }

  // تحميل صوت عبر XHR (يعمل على الملفات المحلية في Pi Browser)
  function loadBuffer(name) {
    if (acBuffers[name] || acBuffers[name + '_loading']) return;
    acBuffers[name + '_loading'] = true;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', BASE + MAP[name], true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) { // 0 = local file success
        try {
          getAC().decodeAudioData(xhr.response,
            decoded => { acBuffers[name] = decoded; },
            () => {}
          );
        } catch(e) {}
      }
    };
    xhr.onerror = () => {};
    xhr.send();
  }

  // تشغيل عبر AudioContext (بدون تأخير)
  function playAC(name, vol) {
    const buf = acBuffers[name];
    if (!buf) return false;
    try {
      const ac  = getAC();
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gain = ac.createGain();
      gain.gain.value = Math.min(1, Math.max(0, vol !== undefined ? vol : 0.7));
      src.connect(gain);
      gain.connect(ac.destination);
      src.start(0);
      return true;
    } catch(e) { return false; }
  }

  // Pool بسيط كـ fallback
  const POOL = 3;
  const pools = {};
  Object.entries(MAP).forEach(([k, f]) => {
    const arr = [];
    for (let i = 0; i < POOL; i++) {
      const a = new Audio(BASE + f);
      a.preload = 'auto';
      arr.push(a);
    }
    pools[k] = { arr, i: 0 };
  });

  function playPool(name, vol) {
    const p = pools[name];
    if (!p) return;
    const a = p.arr[p.i];
    p.i = (p.i + 1) % POOL;
    try { a.currentTime = 0; } catch(e) {}
    a.volume = Math.min(1, Math.max(0, vol !== undefined ? vol : 0.7));
    a.play().catch(() => {});
  }

  return {
    play(name, vol) {
      if (muted || !MAP[name]) return;
      // حاول AudioContext أولاً، ثم pool
      if (!playAC(name, vol)) playPool(name, vol);
    },
    mute(v)   { muted = v; },
    isMuted() { return muted; },
    unlock()  {
      // تحميل كل الأصوات في AudioContext بعد أول تفاعل
      Object.keys(MAP).forEach(n => loadBuffer(n));
      // فتح pool
      Object.values(pools).forEach(p =>
        p.arr.forEach(a => { a.play().then(()=>a.pause()).catch(()=>{}); })
      );
    }
  };
})();

// ── GAME STATE ──
const GS = {
  piUser: null,
  curLevel: 1,
  maxUnlocked: 1,  lives: 3,
  coins: 0,
  allWorlds: false,
  speedBoost: false,
  worldProgress: { 1:0, 2:0, 3:0, 4:0 }, // completed levels per world
};

// ── SESSION STATE ──
let lvScore = 0, lvCoins = 0, curAmmo = 5;
let lvTimer = 0, timerInt = null;
let gameStatus = 'idle';   // idle | playing | win | lose
let paused = false;
let raf = null, lastT = 0;
let shopFrom = 'splash';

// ── CHECKPOINT ──
let checkpoint = { x: 0, y: 0 };      // آخر موقع آمن على الأرض
let reviveCheckpoint = { x: 0, y: 0 }; // موقع الموت لاستعادة الشخصية

// ── LEVEL DATA ──
let solidTiles = [];
let pickups    = [];
let enemies    = [];
let bullets    = [];
let particles  = [];
let crumbleTiles = []; // tiles that crumble when stepped on
let player     = {};
let camera     = { x: 0, y: 0 };
const keys = { left:false, right:false };

// ── CANVAS ──
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const wrapper = document.getElementById('gameWrapper');

// ── SPRITES ──
const SPR = {};        // SPR.idle = [Image,Image,...], SPR.bee = Image
const TILE_IMGS = {};  // TILE_IMGS['nature'][1] = Image
const OBJ_IMGS  = {};  // OBJ_IMGS['nature']['Tree_1.png'] = Image
const UI_IMGS   = {};  // UI_IMGS.splash = Image
let allLoaded = false;
let loadedCount = 0;
let totalToLoad = 0;

// ── SETUP ROTATION (portrait device → landscape game) ──
function setupRotation() {
  const dpr = window.devicePixelRatio || 1;
  const sw  = window.innerWidth;   // portrait width  (narrow)
  const sh  = window.innerHeight;  // portrait height (tall)

  // Game runs LANDSCAPE: game width = sh, game height = sw
  const GW = sh;  // game logical width
  const GH = sw;  // game logical height

  // Canvas physical pixels = logical × dpr → sharp on any screen
  canvas.width  = Math.round(GW * dpr);
  canvas.height = Math.round(GH * dpr);
  canvas.style.width  = GW + 'px';
  canvas.style.height = GH + 'px';

  // Scale ctx so all draw calls use logical pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Rotate the wrapper 90° to fill portrait screen
  wrapper.style.width        = GW + 'px';
  wrapper.style.height       = GH + 'px';
  wrapper.style.transformOrigin = '0 0';
  // Place wrapper at left=sw then rotate 90deg → fills portrait screen with zero gaps
  wrapper.style.top  = '0px';
  wrapper.style.left = sw + 'px';
  wrapper.style.transform = 'rotate(90deg)';
}

// ── IMAGE LOADER (نسختان: حرجة وخلفية) ──
function loadImg(src) {
  totalToLoad++;
  return new Promise(res => {
    const img = new Image();
    img.onload  = () => { loadedCount++; updateLoadBar(); res(img); };
    img.onerror = () => { loadedCount++; updateLoadBar(); res(null); };
    img.src = src;
  });
}

// تحميل صامت في الخلفية (لا يؤثر على شريط التحميل)
function loadImgBg(src) {
  return new Promise(res => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function updateLoadBar() {
  const pct = totalToLoad > 0 ? Math.round(loadedCount / totalToLoad * 100) : 100;
  const bar = document.getElementById('ldBar');
  const txt = document.getElementById('ldTxt');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = `Loading... ${pct}%`;
}

// ── التحميل الحرج (العالم 1 فقط = يظهر في شريط التحميل) ──
async function loadCriticalAssets() {
  const proms = [];

  // شخصية اللاعب
  const anims = { idle:10, run:8, jump:10, dead:10, shoot:3 };
  for (const [anim, count] of Object.entries(anims)) {
    SPR[anim] = [];
    for (let i = 1; i <= count; i++) {
      proms.push(loadImg(`assets/character/${anim}${i}.png`).then(img => { SPR[anim][i-1] = img; }));
    }
  }

  // أعداء العالم 1 فقط: snail1, bat1, tuca1
  ['snail1','bat1','tuca1'].forEach(e =>
    proms.push(loadImg(`assets/enemies/${e}.png`).then(img => { SPR[e] = img; }))
  );

  // صور بلاطات العالم 1 (nature) فقط
  TILE_IMGS['nature'] = {};
  for (let i = 1; i <= 18; i++) {
    proms.push(loadImg(`assets/tiles/nature/${i}.png`).then(img => { TILE_IMGS['nature'][i] = img; }));
  }

  // خلفية العالم 1 + UI أساسية
  proms.push(loadImg('assets/bg/nature_bg.png').then(img => { UI_IMGS.bg_nature = img; }));
  proms.push(loadImg('assets/ui/splash_screen.png').then(img => { UI_IMGS.splash = img; }));
  proms.push(loadImg('assets/ui/sky_bg.png').then(img => { UI_IMGS.sky_bg = img; }));
  proms.push(loadImg('assets/ui/world_nature.png').then(img => { UI_IMGS.world_nature = img; }));
  proms.push(loadImg('assets/ui/world_graveyard.png').then(img => { UI_IMGS.world_graveyard = img; }));
  proms.push(loadImg('assets/ui/world_winter.png').then(img => { UI_IMGS.world_winter = img; }));
  proms.push(loadImg('assets/ui/world_desert.png').then(img => { UI_IMGS.world_desert = img; }));

  // أزرار التحكم الأساسية
  ['coin','bullet','banner_win','banner_lose','btn_retry','btn_shoot',
   'btn_left','btn_right','btn_Jumping','Restart_button'].forEach((f,i) => {
    const keys2 = ['coin','bullet','banner_win','banner_lose','btn_retry',
                   'btn_shoot','btn_left','btn_right','btn_jump','restart_btn'];
    const files  = ['coin.png','bullet.png','banner_win.png','banner_lose.png','btn_retry.png',
                    'btn_shoot.png','btn_left.png','btn_right.png','btn_Jumping.png','Restart_button.png'];
    proms.push(loadImg('assets/buttons/' + files[i]).then(img => { UI_IMGS[keys2[i]] = img; }));
  });

  // ديكور العالم 1
  OBJ_IMGS['nature'] = {};
  const nat = ['Tree_1.png','Tree_2.png','Tree_3.png','Bush__1_.png','Bush__2_.png',
               'Bush__3_.png','Mushroom_1.png','Mushroom_2.png','Stone.png','Crate.png'];
  nat.forEach(o => proms.push(loadImg(`assets/objects/nature/${o}`).then(img => { OBJ_IMGS['nature'][o] = img; })));

  // timeout 8 ثوانٍ — إذا لم تُحمَّل الأصول نكمل على أي حال
  const timeout = new Promise(res => setTimeout(res, 8000));
  await Promise.race([Promise.all(proms), timeout]);
}

// ── التحميل في الخلفية (العوالم 2-4 بعد بدء اللعبة) ──
function loadRemainingAssets() {
  // أعداء العوالم 2-4
  ['bat2','bat3','snail2','snail3',
   'spikebee1','spikebee2','spikebee3','spikebee4',
   'tuca2','tuca3'].forEach(e =>
    loadImgBg(`assets/enemies/${e}.png`).then(img => { SPR[e] = img; })
  );

  // بلاطات العوالم 2-4
  const rest = {
    graveyard: { count:16, bones:true },
    winter:    { count:18 },
    desert:    { count:16 },
  };
  for (const [world, cfg] of Object.entries(rest)) {
    TILE_IMGS[world] = {};
    for (let i = 1; i <= cfg.count; i++) {
      loadImgBg(`assets/tiles/${world}/${i}.png`).then(img => { TILE_IMGS[world][i] = img; });
    }
    if (cfg.bones) {
      for (let b = 1; b <= 4; b++) {
        loadImgBg(`assets/tiles/graveyard/bone${b}.png`).then(img => { TILE_IMGS[world]['bone'+b] = img; });
      }
    }
  }

  // خلفيات العوالم 2-4
  loadImgBg('assets/bg/graveyard_bg.png').then(img => { UI_IMGS.bg_graveyard = img; });
  loadImgBg('assets/bg/winter_bg.png').then(img    => { UI_IMGS.bg_winter    = img; });
  loadImgBg('assets/bg/desert_bg.png').then(img    => { UI_IMGS.bg_desert    = img; });

  // صور UI إضافية
  loadImgBg('assets/ui/levels_panel.png').then(img => { UI_IMGS.levels_panel = img; });
  loadImgBg('assets/ui/lock_panel.png').then(img   => { UI_IMGS.lock_panel   = img; });
  loadImgBg('assets/buttons/Picsa8.png').then(img  => {
    if (img) UI_IMGS.picsa8 = img;
    else loadImgBg('assets/buttons/banner_win(Copy).png').then(i => { if(i) UI_IMGS.picsa8 = i; });
  });

  // ديكور العوالم 2-4
  const worldObjs = {
    graveyard: ['Tree.png','TombStone__1_.png','TombStone__2_.png','DeadBush.png','Bush__1_.png','Bush__2_.png','Crate.png','Skeleton.png'],
    winter:    ['Tree_1.png','Tree_2.png','SnowMan.png','Stone.png','IceBox.png','Crystal.png','Crate.png'],
    desert:    ['Cactus__1_.png','Cactus__2_.png','Cactus__3_.png','Tree.png','Bush__1_.png','Stone.png','Crate.png'],
  };
  for (const [world, objs] of Object.entries(worldObjs)) {
    OBJ_IMGS[world] = {};
    for (const o of objs) {
      loadImgBg(`assets/objects/${world}/${o}`).then(img => { OBJ_IMGS[world][o] = img; });
    }
  }
}

function imgOK(img) { return img && img.complete && img.naturalWidth > 0; }

// ── SAVE / LOAD ──
function saveLocal() {
  try {
    localStorage.setItem('spio_v2', JSON.stringify({
      m: GS.maxUnlocked, l: GS.lives, c: GS.coins,
      w: GS.allWorlds, sp: GS.speedBoost,
      wp: GS.worldProgress
    }));
  } catch(e) {}
}

function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem('spio_v2') || '{}');
    GS.maxUnlocked = d.m || 1;
    GS.allWorlds   = d.w || false;
    GS.lives = d.l || 3;
    GS.coins = d.c || 0;
    GS.allWorlds = d.w || false;
    GS.speedBoost = d.sp || false;
    GS.worldProgress = d.wp || { 1:0, 2:0, 3:0, 4:0 };
  } catch(e) {}
}

// ── SUPABASE CLOUD SAVE ──
// ملاحظة: يعمل فقط إذا كان جدول "players" موجوداً في Supabase
// الـ localStorage هو الحفظ الأساسي دائماً

async function cloudSave() {
  if (!GS.piUser) return;
  saveLocal(); // دائماً نحفظ محلياً أولاً
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/players`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        pi_uid:          GS.piUser.uid,
        pi_username:     GS.piUser.username,
        max_level:       GS.maxUnlocked,
        coins:           GS.coins,
        lives:           GS.lives,
        world_progress:  GS.worldProgress,
        updated_at:      new Date().toISOString()
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>'');
      console.warn('[Cloud] Save failed', res.status, txt.slice(0,120));
    }
  } catch(e) {
    console.warn('[Cloud] Save network error:', e.message);
  }
}

async function cloudLoad() {
  if (!GS.piUser) return;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/players?pi_uid=eq.${encodeURIComponent(GS.piUser.uid)}&select=*`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    );
    if (!res.ok) {
      console.warn('[Cloud] Load failed HTTP', res.status, '— using localStorage only');
      return; // لا نوقف اللعبة — البيانات المحلية كافية
    }
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      const d = data[0];
      GS.maxUnlocked   = Math.max(GS.maxUnlocked,  d.max_level       || 1);
      GS.coins         = Math.max(GS.coins,         d.coins           || 0);
      GS.worldProgress = d.world_progress || GS.worldProgress;
      saveLocal();
      console.log('[Cloud] Loaded from Supabase ✓');
    }
  } catch(e) {
    console.warn('[Cloud] Load network error — using localStorage:', e.message);
  }
}

// ══════════════════════════════════════════════════════
//  PI NETWORK — Authentication & Payments
//  approve/complete تمر عبر Vercel Backend
//  لأن Pi API يشترط Server API Key من backend فقط
// ══════════════════════════════════════════════════════

const PI_API      = 'https://api.minepi.com/v2';
const PI_BACKEND  = '/.netlify/functions/pi-payment';
let   _piAccessToken = null;

// ── دفعات غير مكتملة ──
function onIncompletePaymentFound(payment) {
  const paymentId = payment.identifier;
  const txid = payment.transaction ? payment.transaction.txid : null;
  if (txid) _piCompletePayment(paymentId, txid, null);
  else _piCancelPayment(paymentId);
}

// ── تسجيل الدخول بـ Pi ──
async function piAuth() {
  try {
    if (typeof Pi === 'undefined') { playGuest(); return; }
    const auth = await Pi.authenticate(['username', 'payments'], onIncompletePaymentFound);
    _piAccessToken = auth.accessToken;
    GS.piUser = auth.user;
    const badge = document.getElementById('piUserBadge');
    if (badge) { badge.textContent = 'π ' + auth.user.username; badge.style.display = 'block'; }
    await cloudLoad();
    showScreen('splash');
    setSplashBG();
  } catch(e) {
    console.error('[Pi] Auth failed:', e);
    playGuest();
  }
}

// ── اللعب كضيف ──
function playGuest() {
  GS.piUser = null;
  _piAccessToken = null;
  showScreen('splash');
  setSplashBG();
}

// ── مساعد: استدعاء Vercel Backend ──
function _callBackend(action, paymentId, txid) {
  return fetch(PI_BACKEND, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, paymentId, txid }),
  }).then(r => {
    console.log(`[Pi] ${action} → HTTP ${r.status}`);
    return r;
  }).catch(e => {
    console.warn(`[Pi] ${action} network error:`, e.message);
    return null;
  });
}

// ── اعتماد الدفعة: fire & forget لا نُعيق SDK ──
function _piApprovePayment(paymentId) {
  _callBackend('approve', paymentId, null);
  // لا await — Pi SDK لا ينتظر هذه الدالة
}

// ── إكمال الدفعة ──
async function _piCompletePayment(paymentId, txid, onSuccess) {
  await _callBackend('complete', paymentId, txid);
  // نطبّق الشراء دائماً لأن البلوكشين أكّد المعاملة
  if (onSuccess) onSuccess();
}

// ── إلغاء الدفعة ──
function _piCancelPayment(paymentId) {
  _callBackend('cancel', paymentId, null);
}

// ── الشراء من المتجر ──
async function buy(item, amount) {
  if (!GS.piUser) {
    alert('🔐 Please login with Pi Network to purchase!');
    return;
  }

  // ما يحدث بعد نجاح الشراء
  const applyPurchase = {
    ammo:   () => { curAmmo = Math.min(curAmmo + 10, 30); updAmmo(); },
    lives:  () => { GS.lives += 3; updHUD(); },
    speed:  () => { GS.speedBoost = true; updHUD(); },
    worlds: () => { GS.allWorlds = true; buildWorldSelect(); },
    coins:  () => { GS.coins += 1000; updHUD(); },
    mega:   () => { GS.allWorlds = true; GS.lives += 5; curAmmo = Math.min(curAmmo+30,30); updAmmo(); updHUD(); buildWorldSelect(); },
  };

  const memos = {
    ammo:   'Super Pio: Ammo Pack ×10',
    lives:  'Super Pio: Lives ×3',
    speed:  'Super Pio: Speed Boost',
    worlds: 'Super Pio: Unlock All Worlds',
    coins:  'Super Pio: 1000 Coins',
    mega:   'Super Pio: Mega Bundle',
  };

  const paymentData = {
    amount,
    memo:     memos[item] || 'Super Pio Purchase',
    metadata: { item, player: GS.piUser.uid }
  };

  // ── Callbacks حسب التوثيق الرسمي ──
  const paymentCallbacks = {

    // الخطوة 1: الموافقة — يجب أن تكون فورية (بدون await) لمنع timeout
    onReadyForServerApproval: (paymentId) => {
      console.log('[Pi] onReadyForServerApproval:', paymentId);
      _piApprovePayment(paymentId); // fire & forget — لا نُعيق SDK
    },

    // الخطوة 2: الإكمال — نُطبّق الشراء بعد تأكيد البلوكشين
    onReadyForServerCompletion: async (paymentId, txid) => {
      console.log('[Pi] onReadyForServerCompletion:', paymentId, txid);
      await _piCompletePayment(paymentId, txid, () => {
        const action = applyPurchase[item];
        if (action) action();
        SFX.play('purchase');
        saveLocal();
        cloudSave();
        alert('✅ Purchase successful! Enjoy your ' + (memos[item] || item) + '!');
      });
    },

    // الخطوة 3: إلغاء
    onCancel: (paymentId) => {
      console.log('[Pi] Cancelled:', paymentId);
      _piCancelPayment(paymentId);
    },

    // خطأ
    onError: (err, payment) => {
      console.error('[Pi] Error:', err, payment);
      if (payment) _piCancelPayment(payment.identifier);
      alert('❌ Payment error. Please try again.');
    },
  };

  try {
    Pi.createPayment(paymentData, paymentCallbacks);
  } catch(e) {
    console.error('[Pi] createPayment failed:', e);
    alert('❌ Could not start payment. Make sure you are in Pi Browser.');
  }
}

// ── SCREEN MANAGEMENT ──
function showScreen(id) {
  const mains = ['loadingScreen','piLogin','splash','worldSelect','levelSelect','gameScreen'];
  const subs  = ['winScreen','loseScreen','shopScreen'];

  mains.forEach(s => { const el = document.getElementById(s); if(el) el.classList.remove('active'); });
  subs.forEach(s => { const el = document.getElementById(s); if(el) el.classList.remove('active'); });
  document.getElementById('pauseOv').classList.remove('show');

  if (subs.includes(id)) {
    document.getElementById('gameScreen').classList.add('active');
    document.getElementById(id).classList.add('active');
  } else {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }
}

function setSplashBG() {
  const bg = document.getElementById('splashBG');
  if (bg && UI_IMGS.splash) bg.style.backgroundImage = `url(${UI_IMGS.splash.src})`;
}

// ── WORLD SELECT ──
function showWorldSelect() {
  buildWorldGrid();
  // Set sky background
  const sky = document.getElementById('worldsSkyBG');
  if (sky && UI_IMGS.sky_bg) sky.style.backgroundImage = `url(${UI_IMGS.sky_bg.src})`;
  showScreen('worldSelect');
}

const WORLDS = [
  { id:1, name:'Nature',    img:'world_nature',    minLevel:1,  bgKey:'bg_nature'    },
  { id:2, name:'Graveyard', img:'world_graveyard', minLevel:11, bgKey:'bg_graveyard' },
  { id:3, name:'Winter',    img:'world_winter',    minLevel:21, bgKey:'bg_winter'    },
  { id:4, name:'Desert',    img:'world_desert',    minLevel:31, bgKey:'bg_desert'    },
];

function buildWorldGrid() {
  const grid = document.getElementById('worldsGrid');
  grid.innerHTML = '';
  for (const w of WORLDS) {
    const unlocked = GS.allWorlds || GS.maxUnlocked >= w.minLevel;
    const done = GS.worldProgress[w.id] || 0;
    const card = document.createElement('div');
    card.className = 'world-card';

    const img = UI_IMGS[w.img];
    const imgEl = document.createElement('div');
    imgEl.style.cssText = `width:80px;height:80px;border-radius:12px;border:3px solid ${unlocked?'rgba(255,215,0,0.6)':'rgba(255,255,255,0.1)'};position:relative;overflow:hidden;background:#222;`;
    if (imgEl && img) {
      imgEl.style.backgroundImage = `url(${img.src})`;
      imgEl.style.backgroundSize = 'cover';
      imgEl.style.backgroundPosition = 'center';
    }
    if (!unlocked) {
      const lock = document.createElement('div');
      lock.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-size:28px;';
      lock.textContent = '🔒';
      imgEl.appendChild(lock);
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'world-name';
    nameEl.textContent = w.name;
    const progEl = document.createElement('div');
    progEl.className = 'world-prog';
    progEl.textContent = unlocked ? `${done}/10` : 'Locked';

    card.appendChild(imgEl);
    card.appendChild(nameEl);
    card.appendChild(progEl);

    if (unlocked) card.onclick = () => showLevelSelect(w.id);
    grid.appendChild(card);
  }
}

let selectedWorld = 1;

function showLevelSelect(wid) {
  selectedWorld = wid;
  const w = WORLDS[wid - 1];
  document.getElementById('lvlSelTitle').textContent = w.name.toUpperCase() + ' WORLD';

  // Set background
  const bg = document.getElementById('levelBG');
  if (bg && UI_IMGS[w.bgKey]) bg.style.backgroundImage = `url(${UI_IMGS[w.bgKey].src})`;

  buildLevelGrid(wid);
  showScreen('levelSelect');
}

function buildLevelGrid(wid) {
  const grid = document.getElementById('levelsGrid');
  grid.innerHTML = '';
  const startLv = (wid - 1) * 25 + 1;  // كل عالم 25 مرحلة

  for (let i = 0; i < 25; i++) {
    const lv = startLv + i;
    const unlocked = GS.allWorlds || GS.maxUnlocked >= lv;
    const done = GS.maxUnlocked > lv;

    const btn = document.createElement('button');
    btn.className = `lv-btn ${done ? 'done' : unlocked ? 'unlocked' : 'locked'}`;

    if (unlocked) {
      btn.textContent = lv;
      btn.onclick = () => startLevel(lv);
    } else {
      btn.textContent = '🔒';
    }
    grid.appendChild(btn);
  }
}

// ── START LEVEL ──
function startLevel(n) {
  const ld = LEVELS[n];
  if (!ld) return;

  GS.curLevel = n;
  lvScore = 0; lvCoins = 0; curAmmo = 5;
  gameStatus = 'playing';
  paused = false;

  solidTiles = [];
  pickups    = [];
  enemies    = [];
  bullets    = [];
  particles  = [];
  crumbleTiles = [];

  setupRotation();
  buildWorld(ld);
  spawnPlayer(ld);
  // checkpoint يطابق موقع الشخصية الأولي (فوق الأرض مباشرة)
  checkpoint = { x: ld.startCol * TS, y: (ld.gndRow - 1) * TS - 100 };
  reviveCheckpoint = { x: checkpoint.x, y: checkpoint.y };
  camera.x = 0; camera.y = 0;
  startTimer(ld.time);
  updHUD(); updAmmo();
  showScreen('gameScreen');

  cancelAnimationFrame(raf);
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

// ── BUILD WORLD ──
function buildWorld(ld) {
  const { cells, gndRow, cols, rows, breakables, decos, enemies: enDefs, ammos, goal } = ld;

  // Build solid tile objects from cells array
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = cells[r][c];
      const x = c * TS, y = r * TS;
      if (v === T.GND) {
        solidTiles.push({ x, y, w:TS, h:TS, type:T.GND, row:r, col:c });
      } else if (v === T.PLT) {
        // المنصة: حجم كامل مثل بلاطة عادية - one-way يُحسب في collideY
        solidTiles.push({ x, y, w:TS, h:TS, type:T.PLT, row:r, col:c });
      } else if (v === T.COIN) {
        // Coin: centered in tile, pick correct size
        const cs = Math.round(TS * 0.7);
        const off = Math.round((TS - cs) / 2);
        pickups.push({ x:x+off, y:y+off, w:cs, h:cs, type:'coin', done:false });
      } else if (v === T.GOAL) {
        pickups.push({ x, y:y - TS, w:TS, h:TS*2, type:'goal', done:false });
      } else if (v === T.SPIKE) {
        pickups.push({ x:x+2, y:y+Math.round(TS*0.35), w:TS-4, h:Math.round(TS*0.65), type:'spike', done:false });
      } else if (v === T.SPRING) {
        pickups.push({ x:x+2, y:y+Math.round(TS*0.6), w:TS-4, h:Math.round(TS*0.4), type:'spring', done:false });
      } else if (v === T.CRUMBLE) {
        const ct = { x, y, w:TS, h:TS, type:T.GND, row:r, col:c, crumble:true, crumbleT:0, crumbling:false };
        solidTiles.push(ct);
        crumbleTiles.push(ct);
      }
    }
  }

  // Breakable blocks - add to BOTH pickups AND solidTiles
  // Store pickup index reference so bullet hit can find it
  for (const b of breakables) {
    const bx = b.c * TS, by = b.r * TS;
    const pIdx = pickups.length;
    pickups.push({ x:bx, y:by, w:TS, h:TS, type:'breakable', done:false, hasHeart:b.hasHeart, hasCoin:b.hasCoin, col:b.c, row:b.r });
    solidTiles.push({ x:bx, y:by, w:TS, h:TS, type:T.GND, row:b.r, col:b.c, isBreakable:true, pickupIdx:pIdx });
  }

  // Ammo pickups
  const ammoSz = Math.round(TS * 0.55);
  for (const a of ammos) {
    const ax = a.c * TS + Math.round((TS - ammoSz) / 2);
    const ay = a.r * TS + Math.round((TS - ammoSz) / 2);
    pickups.push({ x:ax, y:ay, w:ammoSz, h:ammoSz, type:'ammo', done:false });
  }

  // Goal flag (always visible at end)
  pickups.push({ x:goal.c*TS, y:(goal.r-1)*TS, w:TS, h:TS*2, type:'goal', done:false });

  // Enemies
  for (const e of enDefs) {
    const sprData = getSpriteData(e.type);
    enemies.push({
      x: e.c * TS, y: e.r * TS,
      vx: (e.dir || 1) * (e.fly ? 1.6 : 1.2),
      vy: 0,
      w: sprData.w, h: sprData.h,
      type: e.type,
      fly: !!e.fly,
      dir: e.dir || 1,
      dead: false,
      frame: 0, ft: 0,
      minX: (e.c - 6) * TS,
      maxX: (e.c + 6) * TS,
      onGnd: false,
    });
  }

  // Decorative objects (no collision)
  window._decos = decos;
}

function getSpriteData(type) {
  const sizes = {
    // bat: 60×60 — طائر صغير
    bat1:{ w:60, h:60, fly:true  }, bat2:{ w:60, h:60, fly:true  }, bat3:{ w:60, h:60, fly:true  },
    // snail: 60×60 — أرضي صغير
    snail1:{ w:60, h:60, fly:false }, snail2:{ w:60, h:60, fly:false }, snail3:{ w:60, h:60, fly:false },
    // spikebee: 140×117 → نعرضه 80×67 — طائر كبير
    spikebee1:{ w:80, h:67, fly:true  }, spikebee2:{ w:80, h:67, fly:true  },
    spikebee3:{ w:80, h:67, fly:true  }, spikebee4:{ w:80, h:67, fly:true  },
    // tuca: 140×112 → نعرضه 80×64 — أرضي كبير
    tuca1:{ w:80, h:64, fly:false }, tuca2:{ w:80, h:64, fly:false }, tuca3:{ w:80, h:64, fly:false },
  };
  return sizes[type] || { w:60, h:60, fly:false };
}

function spawnPlayer(ld, cx, cy) {
  // نضع الشخصية مباشرة فوق الأرض (gndRow - 1) لتتصل بالأرض فوراً
  const startX = (cx !== undefined) ? cx : ld.startCol * TS;
  const startY = (cy !== undefined) ? cy : (ld.gndRow - 1) * TS - 100; // h=100 → يجلس مباشرة فوق الأرض
  player = {
    x: startX,
    y: startY,
    vx:0, vy:0,
    w:76, h:100,
    onGnd: true,     // نعتبره على الأرض فوراً
    dir: 1,
    state: 'idle',
    frame: 0, ft: 0,
    dead: false, deadT: 0,
    inv: true, invT: 120,   // حصانة كاملة 2 ثانية
    shootT: 0,
    heartFlash: 0,
    _wasAirborne: false,
    _prevVy: 0,
    _stepT: 0,
    _gapEnabled: false,
    _inGap: false,
    _spawnFrames: 90,       // 90 إطار = 1.5 ثانية حماية مطلقة
  };
}

// ── GAME LOOP ──
function loop(ts) {
  const dt = Math.min((ts - lastT) / 16.67, 3);
  lastT = ts;
  if (!paused && gameStatus === 'playing') update(dt);
  render();
  raf = requestAnimationFrame(loop);
}

function update(dt) {
  updPlayer(dt);
  updEnemies(dt);
  updBullets(dt);
  updCrumbles(dt);
  checkPickups();
  updParticles(dt);
  updCamera();
}

// ── PLAYER UPDATE ──
function updPlayer(dt) {
  if (player.dead) {
    player.deadT -= dt;
    player.vy += GRAV * dt;
    if (player.vy > MAX_VY) player.vy = MAX_VY;
    player.y += player.vy * dt;
    // Dead animation frame
    player.ft += dt;
    if (player.ft >= 6) { player.ft = 0; player.frame = Math.min(player.frame + 1, (SPR.dead?.length || 10) - 1); }
    if (player.deadT <= 0) {
      GS.lives = Math.max(0, GS.lives - 1);
      updHUD(); saveLocal();
      if (GS.lives <= 0) { triggerLose('Out of lives!'); return; }
      spawnPlayer(LEVELS[GS.curLevel], checkpoint.x, checkpoint.y);
    }
    return;
  }

  // Invincibility flash
  if (player.inv) { player.invT -= dt; if (player.invT <= 0) player.inv = false; }
  if (player.shootT > 0) player.shootT -= dt;

  // Movement
  const spd = PSPD * (GS.speedBoost ? 1.4 : 1);
  if (keys.left) {
    player.vx = -spd;
    player.dir = -1;
    if (player.onGnd && player.shootT <= 0) player.state = 'run';
  } else if (keys.right) {
    player.vx = spd;
    player.dir = 1;
    if (player.onGnd && player.shootT <= 0) player.state = 'run';
  } else {
    player.vx *= 0.65;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
    if (player.onGnd && player.shootT <= 0) player.state = 'idle';
  }
  if (player.shootT > 0) player.state = 'shoot';
  if (!player.onGnd && player.shootT <= 0) player.state = 'jump';

  // Gravity + vertical movement
  player.vy += GRAV * dt;
  if (player.vy > MAX_VY) player.vy = MAX_VY;

  // Horizontal movement + collision
  player.x += player.vx * dt;
  collideX(player);
  player.x = Math.max(0, player.x);

  // Vertical movement + collision
  player._prevY = player.y;   // حفظ الموقع قبل التحرك
  player.y += player.vy * dt;
  player.onGnd = false;
  collideY(player);

  // حفظ checkpoint عند الوقوف على الأرض الصلبة (ليس فوق فجوة)
  if (player.onGnd && !player.dead) {
    checkpoint.x = player.x;
    checkpoint.y = player.y;
    player._gapEnabled = true; // تفعيل كشف الفجوة بعد أول لمسة للأرض
    // صوت الهبوط عند الوصول للأرض (فقط إذا كان يسقط بسرعة)
    if (player._wasAirborne && player._prevVy > 3) {
      SFX.play('land', 0.5);
    }
    player._wasAirborne = false;
    player._inGap = false;
    // صوت الخطوات كل 18 إطار
    if (player.state === 'run') {
      player._stepT = (player._stepT || 0) + 1;
      if (player._stepT >= 18) { player._stepT = 0; SFX.play('step', 0.3); }
    }
  } else if (!player.onGnd) {
    player._wasAirborne = true;
  }
  player._prevVy = player.vy;

  // عدّاد الحماية عند البداية
  if (player._spawnFrames > 0) {
    player._spawnFrames -= dt;
    player._gapEnabled = false; // لا كشف فجوة خلال فترة الحماية
  }

  // Fell off map → يعود إلى آخر checkpoint بجانب الفجوة
  const mapH = LEVELS[GS.curLevel].rows * TS;
  const gndY  = LEVELS[GS.curLevel].gndRow * TS;

  // يشغّل صوت السقوط مرة واحدة عند تجاوز سطح الأرض — فقط بعد أول لمسة للأرض
  if (player._gapEnabled && !player._inGap && player.y > gndY) {
    player._inGap = true;
    SFX.play('fall', 0.8);
  }

  if (player._spawnFrames <= 0 && player.y > mapH + 100) {
    // سقط في فجوة → يعود لآخر موقع آمن
    reviveCheckpoint = { x: checkpoint.x, y: checkpoint.y };
    GS.lives = Math.max(0, GS.lives - 1);
    updHUD(); saveLocal();
    if (GS.lives <= 0) { triggerLose('Out of lives!'); return; }
    player.x  = checkpoint.x;
    player.y  = checkpoint.y;
    player.vx = 0;
    player.vy = 0;
    player.inv  = true;
    player.invT = 90;
    player.dead = false;
    player.state = 'idle';
    player._inGap = false;
    player._wasAirborne = false;
    player._prevVy = 0;
    return;
  }

  // Animation frames
  const animRates = { idle:10, run:5, jump:8, shoot:4, dead:6 };
  const animCounts = { idle:10, run:8, jump:10, shoot:3, dead:10 };
  player.ft += dt;
  if (player.ft >= (animRates[player.state] || 10)) {
    player.ft = 0;
    const maxF = animCounts[player.state] || 10;
    player.frame = (player.frame + 1) % maxF;
  }
}

function collideX(obj) {
  for (const t of solidTiles) {
    if (t.type === T.PLT) continue;   // المنصات: لا تمنع الحركة الأفقية أبداً
    if (!overlaps(obj, t)) continue;
    if (obj.vx > 0) obj.x = t.x - obj.w;
    else if (obj.vx < 0) obj.x = t.x + t.w;
    obj.vx = 0;
  }
}

function collideY(obj) {
  for (const t of solidTiles) {
    if (!overlaps(obj, t)) continue;

    if (t.type === T.PLT) {
      // ── ONE-WAY PLATFORM ──
      // يقف فوقها فقط إذا كان يسقط (vy>0) وكانت قدمه فوق سطح المنصة قبل التحرك
      if (obj.vy > 0 && obj._prevY !== undefined && (obj._prevY + obj.h) <= t.y + 2) {
        obj.y  = t.y - obj.h;
        obj.vy = 0;
        obj.onGnd = true;
      }
      continue; // المرور من الأسفل والجوانب دائماً
    }

    // ── بلاطة عادية: تصادم كامل ──
    if (obj.vy > 0) {
      obj.y = t.y - obj.h;
      obj.vy = 0;
      obj.onGnd = true;
      if (t.crumble && !t.crumbling) { t.crumbling = true; t.crumbleT = 60; }
    } else {
      obj.y = t.y + t.h;
      obj.vy = 0;
      if (t.isBreakable) breakBlock(t);
    }
  }
}

function overlaps(a, b, margin = 0) {
  return a.x + margin < b.x + b.w &&
         a.x + a.w - margin > b.x &&
         a.y + margin < b.y + b.h &&
         a.y + a.h - margin > b.y;
}

// ── BREAK BLOCK ──
function breakBlock(tile) {
  // Remove from solidTiles
  const idx = solidTiles.indexOf(tile);
  if (idx !== -1) solidTiles.splice(idx, 1);

  // Find matching pickup via pickupIdx
  const pk = (tile.pickupIdx !== undefined) ? pickups[tile.pickupIdx] : null;
  if (pk && !pk.done) {
    pk.done = true;
    spawnBreakParticles(tile.x + TS/2, tile.y + TS/2, LEVELS[GS.curLevel].theme);
    if (pk.hasHeart) {
      // قلب مخفي
      GS.lives = Math.min(GS.lives + 1, 9);
      updHUD();
      SFX.play('heart');
      spawnHeartPopup(tile.x - camera.x + TS/2, tile.y);
    } else if (pk.hasCoin) {
      // عملة مخفية — تطفو للأعلى ثم تُجمع
      const cs = Math.round(TS * 0.7);
      pickups.push({ x: tile.x + (TS-cs)/2, y: tile.y - TS, w:cs, h:cs, type:'coin', done:false, _vy:-3 });
      SFX.play('coin');
    } else {
      SFX.play('break');
    }
  } else {
    spawnBreakParticles(tile.x + TS/2, tile.y + TS/2, LEVELS[GS.curLevel].theme);
    SFX.play('break');
  }
}

function spawnBreakParticles(x, y, theme) {
  const colors = {
    nature:    ['#8BC34A','#5D4037','#795548','#4CAF50'],
    graveyard: ['#455A64','#607D8B','#37474F','#BDBDBD'],
    winter:    ['#90CAF9','#E3F2FD','#5C6BC0','#fff'],
    desert:    ['#FFA726','#8D6E63','#FFCC80','#FF7043'],
  }[theme] || ['#FFD700','#FF6B00'];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 30 + Math.random() * 20,
      maxLife: 50,
    });
  }
}

// ── CHECK PICKUPS ──
function checkPickups() {
  if (player.dead) return;

  for (const p of pickups) {
    if (p.done) continue;
    if (!overlaps(player, p, 6)) continue;

    if (p.type === 'coin') {
      p.done = true;
      lvCoins++; lvScore += 50;
      GS.coins++;
      SFX.play('coin');
      spawnCoinParticle(p.x - camera.x, p.y);
      updHUD();
    } else if (p.type === 'ammo') {
      p.done = true;
      curAmmo = Math.min(curAmmo + 3, 30);
      updAmmo();
    } else if (p.type === 'goal') {
      triggerWin();
      return;
    } else if (p.type === 'spike') {
      if (!player.inv) { killPlayer('Hit a spike!'); return; }
    } else if (p.type === 'spring') {
      // Spring - bounce
      player.vy = JSPD * 1.4;
      player.onGnd = false;
      SFX.play('spring');
    }
  }

  // Enemy collision
  if (!player.inv) {
    for (const e of enemies) {
      if (e.dead) continue;
      if (!overlaps(player, e, 8)) continue;
      // Jump on top of enemy
      if (player.vy > 0 && player.y + player.h < e.y + e.h * 0.6) {
        e.dead = true;
        lvScore += 100;
        SFX.play('stomp');
        SFX.play('enemy_die', 0.6);
        player.vy = JSPD * 0.6;
        spawnBreakParticles(e.x + e.w/2, e.y + e.h/2, LEVELS[GS.curLevel].theme);
        updHUD();
      } else {
        hurtPlayer();
      }
    }
  }
}

function hurtPlayer() {
  if (player.inv || player.dead) return;
  SFX.play('hurt');
  player.inv  = true;
  player.invT = 120; // 120 frames ≈ 2 ثانية حصانة
  GS.lives = Math.max(0, GS.lives - 1); // لا تنخفض تحت الصفر أبداً
  updHUD();
  saveLocal();
  if (GS.lives <= 0) { killPlayer('No lives left!'); }
}

function killPlayer(reason) {
  if (player.dead) return;
  // حفظ موقع الموت للـ revive
  reviveCheckpoint = { x: player.x, y: player.y };
  player.dead = true;
  player.state = 'dead';
  player.frame = 0;
  player.ft = 0;
  player.vy = JSPD * 0.4;
  player.vx = -player.dir * 2;
  player.deadT = 90;
  window._loseReason = reason;
}

// ── CRUMBLE TILES ──
function updCrumbles(dt) {
  for (const ct of crumbleTiles) {
    if (!ct.crumbling) continue;
    ct.crumbleT -= dt;
    if (ct.crumbleT <= 0) {
      // Remove from solidTiles
      const idx = solidTiles.indexOf(ct);
      if (idx !== -1) solidTiles.splice(idx, 1);
    }
  }
}

// ── ENEMY UPDATE ──
function updEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;

    // Animation
    e.ft += dt;
    if (e.ft >= 8) { e.ft = 0; e.frame = (e.frame + 1) % getEnemyFrameCount(e.type); }

    // Movement
    e.x += e.vx * dt;

    if (!e.fly) {
      // Gravity for walkers
      e.vy += GRAV * 0.5 * dt;
      if (e.vy > MAX_VY) e.vy = MAX_VY;
      e.y += e.vy * dt;
      // Ground collision - walkers only collide with GND tiles (not PLT platforms)
      for (const t of solidTiles) {
        if (t.type === T.PLT) continue; // walkers pass through platforms
        const obj = { x:e.x, y:e.y, w:e.w, h:e.h };
        if (overlaps(obj, t)) {
          if (e.vy > 0) { e.y = t.y - e.h; e.vy = 0; e.onGnd = true; }
          else { e.y = t.y + t.h; e.vy = 0; }
        }
      }
      // Turn at ledge edge (don't fall off) - only check GND tiles
      const testX = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
      const testY = e.y + e.h + 4;
      const hasGround = solidTiles.some(t => {
        if (t.type === T.PLT) return false; // ignore platforms for edge detection
        const p = { x:testX, y:testY, w:2, h:2 };
        return overlaps(p, t);
      });
      if (!hasGround && e.onGnd) { e.vx *= -1; e.dir *= -1; }
    } else {
      // Flying enemies - gentle sine wave, no gravity or platform collision
      e.y += Math.sin(Date.now() * 0.003 + e.x * 0.008) * 0.7;
    }

    // Patrol bounds
    if (e.x <= e.minX || e.x >= e.maxX) { e.vx *= -1; e.dir *= -1; }

    // Wall collision - only for walkers, only GND tiles
    if (!e.fly) {
    for (const t of solidTiles) {
      if (t.type === T.PLT) continue; // flying and walkers both pass through platforms horizontally
      const obj = { x:e.x, y:e.y, w:e.w, h:e.h };
      if (overlaps(obj, t) && t.type !== 'breakable') {
        if (e.vx > 0) { e.x = t.x - e.w; e.vx = Math.abs(e.vx) * -1; e.dir = -1; }
        else { e.x = t.x + t.w; e.vx = Math.abs(e.vx); e.dir = 1; }
        break;
      }
    }
    }
  }
}

function getEnemyFrameCount(type) {
  if (type.startsWith('bat'))      return 25;
  if (type.startsWith('snail'))    return 30;
  if (type.startsWith('spikebee')) return 20;
  if (type.startsWith('tuca'))     return 52;
  return 10;
}

// ── BULLET UPDATE ──
function updBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.life -= dt;
    if (b.life <= 0) { bullets.splice(i, 1); continue; }

    // Bullet rectangle for collision (small hitbox)
    const br = { x: b.x - 8, y: b.y - 5, w: 16, h: 10 };

    let hit = false;
    // Check ALL solid tiles - breakable ones get destroyed
    for (let ti = solidTiles.length - 1; ti >= 0; ti--) {
      const t = solidTiles[ti];
      if (overlaps(br, t)) {
        if (t.isBreakable) {
          breakBlock(t);
        }
        hit = true;
        break;
      }
    }
    if (hit) { bullets.splice(i, 1); continue; }

    // Enemy collision
    for (const e of enemies) {
      if (e.dead) continue;
      const er = { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 8 };
      if (overlaps(br, er)) {
        e.dead = true;
        lvScore += 100;
        SFX.play('hit');
        spawnBreakParticles(e.x + e.w/2, e.y + e.h/2, LEVELS[GS.curLevel].theme);
        bullets.splice(i, 1);
        updHUD();
        hit = true; break;
      }
    }
    if (hit) continue;

    // Small particle trail
    if (Math.random() > 0.5) {
      particles.push({
        x: b.x, y: b.y,
        vx: -b.vx * 0.05 + (Math.random()-0.5),
        vy: (Math.random()-0.5),
        size: 2 + Math.random() * 2,
        color: '#FF6600',
        life: 6, maxLife: 6,
      });
    }
  }
}

// ── PARTICLES ──
function updParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += GRAV * 0.3 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ── CAMERA ──
function updCamera() {
  const W = parseInt(canvas.style.width)  || canvas.width;
  const H = parseInt(canvas.style.height) || canvas.height;
  const ld = LEVELS[GS.curLevel];
  const mapW = ld.cols * TS, mapH = ld.rows * TS;
  camera.x = Math.max(0, Math.min(player.x - W * 0.35, mapW - W));
  camera.y = 0; // اللعبة أفقية فقط — بدون تمرير عمودي
}

// ── RENDER ──
function render() {
  const W = parseInt(canvas.style.width)  || canvas.width;
  const H = parseInt(canvas.style.height) || canvas.height;
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawPits();          // رسم الفجوات بإحداثيات الشاشة (خارج translate)
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawDecos();
  drawTiles();
  drawPickups();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawParticles();
  ctx.restore();
}

function drawBackground() {
  const theme = LEVELS[GS.curLevel]?.theme || 'nature';
  const bgImg = UI_IMGS['bg_' + theme];
  const W = parseInt(canvas.style.width)  || canvas.width;
  const H = parseInt(canvas.style.height) || canvas.height;
  if (imgOK(bgImg)) {
    ctx.drawImage(bgImg, 0, 0, W, H);
  } else {
    // Fallback gradient
    const bgs = {
      nature:    ['#6BC5F0','#9FD8F5','#c5eeb5'],
      graveyard: ['#1a0a2e','#2d1b4e','#0d0d0d'],
      winter:    ['#b0d4f1','#d4ecf7','#8aabcf'],
      desert:    ['#E8923A','#FFB347','#b87040'],
    };
    const c = bgs[theme] || bgs.nature;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c[0]);
    g.addColorStop(0.6, c[1]);
    g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Clouds
    if (theme === 'nature' || theme === 'winter') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const t = Date.now() * 0.00003;
      [[0.1,0.08,80,28],[0.4,0.05,100,32],[0.7,0.11,70,24]].forEach(([rx,ry,rw,rh]) => {
        const cx = ((rx + t) % 1.2 - 0.1) * W - camera.x * 0.05;
        ctx.beginPath(); ctx.ellipse(cx, ry*H, rw, rh, 0, 0, Math.PI*2); ctx.fill();
      });
    }
  }

  // (pits drawn separately in drawPits() inside world-coords translate)
}

// ── DRAW PITS ──
// الحل: قص الجزء السفلي من صورة الخلفية ولصقه مكان الفجوة
// هذا يجعل الفجوة تبدو وكأنها نافذة للخلفية بدلاً من لون أسود
function drawPits() {
  const ld = LEVELS[GS.curLevel];
  if (!ld || !ld.gaps) return;

  const theme    = ld.theme || 'nature';
  const bgImg    = UI_IMGS['bg_' + theme];
  const mapH     = ld.rows * TS;
  const pitTop   = ld.gndRow * TS;
  const pitH     = mapH - pitTop + TS * 4;

  const W = parseInt(canvas.style.width)  || canvas.width;
  const H = parseInt(canvas.style.height) || canvas.height;

  for (const gap of ld.gaps) {
    const gx  = gap.c * TS - camera.x;  // موقع الفجوة على الشاشة
    const gw  = gap.len * TS;

    if (gx + gw < 0 || gx > W) continue; // خارج الشاشة

    if (imgOK(bgImg)) {
      // ── قص الجزء السفلي من الخلفية (50% أسفل) ولصقه مكان الفجوة ──
      // نأخذ الشريحة السفلية من الخلفية التي تتوافق مع موقع الفجوة أفقياً
      const srcX  = (gx / W) * bgImg.naturalWidth;
      const srcW  = (gw / W) * bgImg.naturalWidth;
      // نأخذ النصف الأسفل من الخلفية (يشبه ما تحت الأرض)
      const srcY  = bgImg.naturalHeight * 0.55;
      const srcH  = bgImg.naturalHeight * 0.45;

      // نرسمه في مكان الفجوة على الشاشة (بإحداثيات الشاشة لأننا خارج translate)
      ctx.drawImage(bgImg,
        Math.max(0, srcX), srcY,
        Math.min(srcW, bgImg.naturalWidth - Math.max(0, srcX)), srcH,
        gx, pitTop, gw, pitH
      );

      // تأثير تعتيم خفيف في أسفل الفجوة لإيهام العمق
      const depthGrad = ctx.createLinearGradient(gx, pitTop, gx, pitTop + pitH);
      depthGrad.addColorStop(0, 'rgba(0,0,0,0)');
      depthGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = depthGrad;
      ctx.fillRect(gx, pitTop, gw, pitH);

    } else {
      // Fallback: لون الخلفية الاحتياطي بدل السواد
      const fallbacks = {
        nature: '#6BC5F0', graveyard: '#1a0a2e',
        winter: '#b0d4f1', desert: '#E8923A',
      };
      ctx.fillStyle = fallbacks[theme] || '#6BC5F0';
      ctx.fillRect(gx, pitTop, gw, pitH);
    }

    // ── صورة Picsa8 فوق الفجوة (اختيارية) ──
    const picsaImg = UI_IMGS['picsa8'];
    if (imgOK(picsaImg)) {
      const ph = Math.round(picsaImg.naturalHeight / picsaImg.naturalWidth * gw);
      ctx.drawImage(picsaImg, gx, pitTop - ph + TS * 0.3, gw, ph);
    }
  }
}

// ── DRAW TILES ──
// Uses proper tile variant IDs from Tile.svg analysis
function drawTiles() {
  const theme = LEVELS[GS.curLevel]?.theme || 'nature';
  const tImgs = TILE_IMGS[theme] || {};
  const TV = TILE_VARIANTS[theme] || {};
  const W = parseInt(canvas.style.width)||canvas.width, H = parseInt(canvas.style.height)||canvas.height;

  for (const t of solidTiles) {
    if (t.x - camera.x > W + TS || t.x + t.w - camera.x < -TS) continue;
    if (t.y - camera.y > H + TS || t.y + t.h - camera.y < -TS) continue;

    // Crumble effect
    if (t.crumble && t.crumbling) {
      const alpha = Math.max(0, t.crumbleT / 60);
      ctx.globalAlpha = alpha;
    }

    if (t.isBreakable) {
      const bkImg = tImgs[TV.breakable] || tImgs['bone1'] || tImgs[16];
      if (imgOK(bkImg)) {
        ctx.drawImage(bkImg, t.x, t.y, t.w, t.h);
      } else {
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 2;
        ctx.strokeRect(t.x+2, t.y+2, t.w-4, t.h-4);
        ctx.fillStyle = '#E8C060';
        ctx.fillRect(t.x+8, t.y+8, t.w-16, 4);
      }
    } else if (t.type === T.PLT) {
      // ── منصة: tile 15=حافة يسرى، 14=وسط، 13=حافة يمنى ──
      const ld  = LEVELS[GS.curLevel];
      const c   = t.col, r = t.row;
      const isPlt = (rr, cc) => {
        if (rr < 0 || rr >= ld.rows || cc < 0 || cc >= ld.cols) return false;
        return ld.cells[rr][cc] === T.PLT;
      };
      const hasLeft  = isPlt(r, c - 1);
      const hasRight = isPlt(r, c + 1);

      // 15=يسار، 14=وسط، 13=يمين
      let imgKey;
      if (!hasLeft && !hasRight) imgKey = TV.plat_mid;   // مفردة → 14
      else if (!hasLeft)         imgKey = TV.plat_left;  // حافة يسرى → 15
      else if (!hasRight)        imgKey = TV.plat_right; // حافة يمنى → 13
      else                       imgKey = TV.plat_mid;   // وسط → 14

      const platImg = tImgs[imgKey];
      if (imgOK(platImg)) {
        ctx.drawImage(platImg, t.x, t.y, TS, TS);
      } else {
        const pc = { nature:['#4CAF50','#5D4037'], graveyard:['#607D8B','#263238'], winter:['#5C6BC0','#1A237E'], desert:['#FFA726','#5D4037'] }[theme] || ['#4CAF50','#5D4037'];
        ctx.fillStyle = pc[1]; ctx.fillRect(t.x, t.y, TS, TS);
        ctx.fillStyle = pc[0]; ctx.fillRect(t.x, t.y, TS, TS * 0.4);
      }
    } else {
      const ld = LEVELS[GS.curLevel];
      const tileId = getTileVariant(t, ld, TV, tImgs, theme);
      if (imgOK(tileId.img)) {
        ctx.drawImage(tileId.img, t.x, t.y, t.w, t.h);
      } else {
        drawFallbackTile(t, theme, TV);
      }
    }

    ctx.globalAlpha = 1;
  }
}

function getTileVariant(tile, ld, TV, tImgs, theme) {
  // Look at neighbor tiles to pick right edge variant
  const c = tile.col, r = tile.row;
  const cells = ld.cells;
  const safeGet = (row, col) => {
    if (row < 0 || row >= ld.rows || col < 0 || col >= ld.cols) return 0;
    return cells[row][col];
  };

  const above = safeGet(r-1, c);
  const below = safeGet(r+1, c);
  const left  = safeGet(r, c-1);
  const right = safeGet(r, c+1);

  const isGnd = v => v === T.GND || v === T.PLT;  // PLT counts as solid for neighbor checks

  let variantId;
  if (tile.type === T.PLT) {
    // Platform: check left/right neighbors
    if (!isGnd(left) && !isGnd(right)) variantId = TV.plat_mid; // single tile
    else if (!isGnd(left)) variantId = TV.plat_left;
    else if (!isGnd(right)) variantId = TV.plat_right;
    else variantId = TV.plat_mid;
  } else {
    // Ground: top/middle/bottom, left/center/right
    const topExposed = !isGnd(above);
    const botExposed = !isGnd(below);
    const lftExposed = !isGnd(left);
    const rgtExposed = !isGnd(right);

    if (topExposed && lftExposed && !rgtExposed) variantId = TV.gnd_top_left;
    else if (topExposed && rgtExposed && !lftExposed) variantId = TV.gnd_top_right;
    else if (topExposed) variantId = TV.gnd_top_mid;
    else if (botExposed && lftExposed) variantId = TV.gnd_bot_left;
    else if (botExposed && rgtExposed) variantId = TV.gnd_bot_right;
    else if (botExposed) variantId = TV.gnd_bot_mid;
    else if (lftExposed) variantId = TV.gnd_mid_left;
    else if (rgtExposed) variantId = TV.gnd_mid_right;
    else variantId = TV.gnd_mid_fill;
  }

  return { img: tImgs[variantId], id: variantId };
}

function drawFallbackTile(t, theme, TV) {
  const colors = {
    nature:    { gnd:'#5D4037', top:'#4CAF50', plt:'#8BC34A' },
    graveyard: { gnd:'#37474F', top:'#607D8B', plt:'#455A64' },
    winter:    { gnd:'#5C6BC0', top:'#E3F2FD', plt:'#90CAF9' },
    desert:    { gnd:'#8D6E63', top:'#FFCC80', plt:'#FFA726' },
  }[theme] || {};

  if (t.type === T.PLT) {
    ctx.fillStyle = colors.plt || '#8BC34A';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(t.x + 2, t.y + 2, t.w - 4, 6);
  } else {
    ctx.fillStyle = colors.gnd || '#5D4037';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    // Check if top exposed
    const ld = LEVELS[GS.curLevel];
    const above = (t.row > 0) ? ld.cells[t.row-1][t.col] : 0;
    if (above === 0) {
      ctx.fillStyle = colors.top || '#4CAF50';
      ctx.fillRect(t.x, t.y, t.w, 8);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5;
  ctx.strokeRect(t.x, t.y, t.w, t.h);
}

// ── DRAW PICKUPS ──
function drawPickups() {
  const W = parseInt(canvas.style.width)||canvas.width, H = parseInt(canvas.style.height)||canvas.height;
  for (const p of pickups) {
    if (p.done) continue;
    if (p.x - camera.x > W || p.x + p.w - camera.x < 0) continue;

    const px = p.x, py = p.y;

    if (p.type === 'coin') {
      // Animated spinning coin using actual coin image
      const coinImg = UI_IMGS.coin;
      const t = Date.now() * 0.004 + px * 0.01;
      const scaleX = Math.abs(Math.cos(t)); // spin effect
      const cx = px + p.w / 2, cy = py + p.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scaleX, 1);
      if (imgOK(coinImg)) {
        ctx.drawImage(coinImg, -p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        // Fallback gold circle
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FF8C00'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#FFF176';
        ctx.beginPath(); ctx.arc(-p.w * 0.15, -p.h * 0.1, p.w * 0.15, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (p.type === 'ammo') {
      // Draw bullet image as ammo pickup
      const bImg = UI_IMGS.bullet;
      const aw = 24, ah = 16;
      const ax = px + (p.w - aw) / 2, ay = py + (p.h - ah) / 2;
      if (imgOK(bImg)) {
        ctx.drawImage(bImg, ax, ay, aw, ah);
      } else {
        // Fallback: small orange bullet shape
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.ellipse(px + p.w / 2, py + p.h / 2, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF9900';
        ctx.beginPath();
        ctx.ellipse(px + p.w / 2, py + p.h / 2, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.type === 'goal') {
      // Flag pole + waving flag
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(px + p.w/2 - 3, py, 5, p.h);
      const wave = Math.sin(Date.now() * 0.007) * 4;
      ctx.fillStyle = '#FF1744';
      ctx.beginPath();
      ctx.moveTo(px + p.w/2 + 2, py + wave);
      ctx.lineTo(px + p.w + wave * 2, py + p.h*0.25 + wave);
      ctx.lineTo(px + p.w/2 + 2, py + p.h * 0.5);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(px + p.w/2, py + p.h * 0.82, 10, 0, Math.PI*2);
      ctx.fill();
    } else if (p.type === 'spike') {
      ctx.fillStyle = '#FF1744';
      ctx.beginPath();
      ctx.moveTo(px, py + p.h);
      ctx.lineTo(px + p.w/2, py);
      ctx.lineTo(px + p.w, py + p.h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,100,100,0.3)';
      ctx.beginPath();
      ctx.moveTo(px + p.w*0.2, py + p.h);
      ctx.lineTo(px + p.w*0.45, py + p.h*0.3);
      ctx.lineTo(px + p.w*0.7, py + p.h);
      ctx.closePath(); ctx.fill();
    } else if (p.type === 'spring') {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(px, py, p.w, p.h);
      ctx.fillStyle = '#8BC34A';
      ctx.fillRect(px + 2, py, p.w - 4, p.h/2);
    } else if (p.type === 'breakable') {
      // Already rendered in drawTiles via solidTiles
    }
  }
}

// ── DRAW DECORATIVE OBJECTS ──
// الديكور يُرسم في إحداثيات العالم (world coords) داخل ctx.save/translate
function drawDecos() {
  const decos = window._decos || [];
  const ld    = LEVELS[GS.curLevel];
  const theme = ld?.theme || 'nature';
  const objs  = OBJ_IMGS[theme] || {};
  const W = parseInt(canvas.style.width)||canvas.width;

  for (const d of decos) {
    // إحداثيات عالم حقيقية (camera.x مُطبَّق بالفعل عبر ctx.translate)
    const wx = d.c * TS;
    const wy = d.r * TS; // أعلى الخلية في إحداثيات العالم

    // تقليم: لا نرسم خارج الشاشة
    if (wx - camera.x > W + TS*2 || wx - camera.x < -TS*2) continue;

    const img = objs[d.img];
    if (imgOK(img)) {
      const isTree = /^(Tree_1|Tree_2|Tree_3|Tree|Dead_Tree)\.png$/.test(d.img);
      const dw = TS * (isTree ? 4.8 : 2.4);
      const dh = (img.naturalHeight / img.naturalWidth) * dw;
      ctx.drawImage(img, wx, wy + TS - dh, dw, dh);
    }
  }
}

// ── DRAW ENEMIES ──
function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    const W = parseInt(canvas.style.width)||canvas.width;
    if (e.x - camera.x > W || e.x + e.w - camera.x < 0) continue;

    const img = SPR[e.type];
    if (!imgOK(img)) {
      // Fallback: لون حسب النوع
      const colMap = {
        bat1:'#7E57C2', bat2:'#9575CD', bat3:'#B39DDB',
        snail1:'#7CB342', snail2:'#9CCC65', snail3:'#AED581',
        spikebee1:'#E53935', spikebee2:'#F44336', spikebee3:'#EF5350', spikebee4:'#FF5252',
        tuca1:'#FF7043', tuca2:'#FF8A65', tuca3:'#FFAB91',
      };
      ctx.fillStyle = colMap[e.type] || '#EF5350';
      ctx.beginPath();
      ctx.ellipse(e.x + e.w/2, e.y + e.h/2, e.w/2, e.h/2, 0, 0, Math.PI*2);
      ctx.fill();
      // Eyes
      const ex = e.dir > 0 ? e.x + e.w*0.65 : e.x + e.w*0.35;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, e.y+e.h*0.35, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex+(e.dir>0?1.5:-1.5), e.y+e.h*0.35, 2.5, 0, Math.PI*2); ctx.fill();
      continue;
    }

    // Calculate sprite sheet frame
    const frameData = getEnemyFrame(e);
    ctx.save();
    if (e.dir < 0) {
      ctx.translate(e.x + e.w, e.y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, frameData.sx, frameData.sy, frameData.fw, frameData.fh, 0, 0, e.w, e.h);
    } else {
      ctx.drawImage(img, frameData.sx, frameData.sy, frameData.fw, frameData.fh, e.x, e.y, e.w, e.h);
    }
    ctx.restore();
  }
}

function getEnemyFrame(e) {
  // بيانات من الـ atlas:
  // bat1-3:      60×60  5 في الصف  25 إطار
  // snail1-3:    60×60  5 في الصف  30 إطار
  // spikebee1-4: 140×117 10 في الصف 20 إطار
  // tuca1-3:     140×112 13 في الصف 52 إطار
  let fw, fh, perRow;
  if      (e.type.startsWith('bat'))      { fw=60;  fh=60;  perRow=5;  }
  else if (e.type.startsWith('snail'))    { fw=60;  fh=60;  perRow=5;  }
  else if (e.type.startsWith('spikebee')) { fw=140; fh=117; perRow=10; }
  else if (e.type.startsWith('tuca'))     { fw=140; fh=112; perRow=13; }
  else                                    { fw=60;  fh=60;  perRow=5;  }

  const f = e.frame % getEnemyFrameCount(e.type);
  return {
    sx: (f % perRow) * fw,
    sy: Math.floor(f / perRow) * fh,
    fw, fh
  };
}

// ── DRAW BULLETS ──
function drawBullets() {
  for (const b of bullets) {
    const bImg = UI_IMGS.bullet;
    if (imgOK(bImg)) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.vx < 0) ctx.scale(-1, 1);
      // Bullet image drawn centered, 28×14 px
      ctx.drawImage(bImg, -14, -7, 28, 14);
      ctx.restore();
    } else {
      // Fallback: fiery projectile (orange/red, NOT yellow)
      ctx.save();
      ctx.translate(b.x, b.y);
      // Outer glow
      ctx.fillStyle = 'rgba(255,120,0,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
      // Middle
      ctx.fillStyle = '#FF4400';
      ctx.beginPath();
      const ex = b.vx > 0 ? 3 : -3;
      ctx.ellipse(ex, 0, 7, 4, 0, 0, Math.PI*2); ctx.fill();
      // Core bright
      ctx.fillStyle = '#FF8800';
      ctx.beginPath(); ctx.ellipse(ex, 0, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
}

// ── DRAW PLAYER ──
function drawPlayer() {
  // Invincibility blink
  if (player.inv && Math.floor(player.invT / 5) % 2 === 0) return;

  const anim = player.dead ? 'dead' :
               player.state === 'shoot' ? 'shoot' :
               player.state === 'run' ? 'run' :
               player.state === 'jump' ? 'jump' : 'idle';

  const frames = SPR[anim] || [];
  const fi = Math.min(player.frame, Math.max(0, frames.length - 1));
  const img = frames[fi];

  if (imgOK(img)) {
    // Character sprites are 641×542, we draw at player size
    ctx.save();
    if (player.dir < 0) {
      ctx.translate(player.x + player.w, player.y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, player.w, player.h);
    } else {
      ctx.drawImage(img, player.x, player.y, player.w, player.h);
    }
    ctx.restore();
  } else {
    drawFallbackPlayer();
  }
}

function drawFallbackPlayer() {
  const x = player.x, y = player.y, w = player.w, h = player.h;
  // Body
  ctx.fillStyle = player.dead ? '#FF4444' : '#1565C0';
  ctx.fillRect(x + 4, y + h*0.55, w/2-5, h*0.45);
  ctx.fillRect(x + w/2+1, y + h*0.55, w/2-5, h*0.45);
  ctx.fillStyle = player.dead ? '#CC0000' : '#1976D2';
  ctx.fillRect(x + 3, y + h*0.32, w-6, h*0.28);
  // Head
  ctx.fillStyle = '#FFCC80';
  ctx.beginPath(); ctx.arc(x + w/2, y + h*0.22, h*0.19, 0, Math.PI*2); ctx.fill();
  // Hat
  ctx.fillStyle = '#4E342E';
  ctx.fillRect(x, y + h*0.1, w, h*0.09);
  ctx.fillRect(x+5, y, w-10, h*0.13);
}

// ── DRAW PARTICLES ──
function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ── POPUPS ──
function spawnHeartPopup(screenX, screenY) {
  const el = document.createElement('div');
  el.className = 'heart-popup';
  el.textContent = '❤️ +1';
  el.style.left = (screenX + camera.x) + 'px';
  el.style.top  = (screenY + camera.y) + 'px';
  wrapper.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function spawnCoinParticle(screenX, screenY) {
  const el = document.createElement('div');
  el.className = 'coin-popup';
  el.textContent = '+50';
  el.style.cssText = `position:absolute;left:${screenX+camera.x}px;top:${screenY+camera.y}px;color:#FFD700;font-size:16px;font-weight:900;pointer-events:none;z-index:30;animation:coinPop .8s ease-out forwards;`;
  wrapper.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ── CONTROLS ──
function kd(k, dn) {
  keys[k] = dn;
  const el = document.getElementById(k === 'left' ? 'btnL' : 'btnR');
  if (el) { dn ? el.classList.add('on') : el.classList.remove('on'); }
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') kd('left', true);
  if (e.key === 'ArrowRight' || e.key === 'd') kd('right', true);
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') doJump();
  if (e.key === 'z' || e.key === 'x') doShoot();
  if (e.key === 'Escape') pauseGame();
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') kd('left', false);
  if (e.key === 'ArrowRight' || e.key === 'd') kd('right', false);
});

function doJump() {
  if (gameStatus !== 'playing' || player.dead || paused) return;
  if (player.onGnd) {
    player.vy = JSPD;
    player.onGnd = false;
    player.state = 'jump';
    player.frame = 0;
    SFX.play('jump');
  }
}

function doShoot() {
  if (gameStatus !== 'playing' || player.dead || paused) return;
  if (curAmmo <= 0) return;
  curAmmo--;
  updAmmo();
  SFX.play('shoot');
  player.shootT = 14;
  player.state = 'shoot';
  player.frame = 0;

  // Spawn bullet
  const bx = player.dir > 0 ? player.x + player.w : player.x;
  const by = player.y + player.h * 0.4;
  bullets.push({
    x: bx, y: by,
    vx: player.dir * 10,
    w: 20, h: 10,
    life: 60
  });
}

// ── HUD ──
function updHUD() {
  document.getElementById('hLives').textContent = GS.lives;
  document.getElementById('hScore').textContent = lvScore;
  document.getElementById('hCoins').textContent = GS.coins;
}

function updAmmo() {
  const d = document.getElementById('ammoDots');
  d.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const dot = document.createElement('div');
    dot.className = 'ammo-dot' + (i < Math.min(curAmmo, 5) ? '' : ' empty');
    d.appendChild(dot);
  }
}

function startTimer(sec) {
  lvTimer = sec;
  const el = document.getElementById('hTimer');
  el.textContent = sec;
  el.classList.remove('low');
  clearInterval(timerInt);
  timerInt = setInterval(() => {
    if (paused || gameStatus !== 'playing') return;
    lvTimer--;
    el.textContent = lvTimer;
    if (lvTimer <= 10) el.classList.add('low');
    if (lvTimer <= 0) { clearInterval(timerInt); triggerLose("Time's up!"); }
  }, 1000);
}

// ── WIN / LOSE ──
function triggerWin() {
  if (gameStatus !== 'playing') return;
  gameStatus = 'win';
  SFX.play('arrival');
  SFX.play('win');
  clearInterval(timerInt);
  cancelAnimationFrame(raf);

  const next = GS.curLevel + 1;
  if (next <= 100 && GS.maxUnlocked < next) {
    GS.maxUnlocked = next;
    // Update world progress
    const wid = LEVELS[GS.curLevel].world;
    GS.worldProgress[wid] = Math.min((GS.worldProgress[wid] || 0) + 1, 25);
  }
  saveLocal(); cloudSave();

  const pct = lvTimer / (LEVELS[GS.curLevel].time || 120);
  document.getElementById('winStars').textContent = pct > 0.6 ? '⭐⭐⭐' : pct > 0.3 ? '⭐⭐' : '⭐';
  document.getElementById('winScore').textContent = `Score: ${lvScore}  |  Coins: ${lvCoins}`;

  setTimeout(() => showScreen('winScreen'), 500);
}

function triggerLose(reason) {
  if (gameStatus === 'lose') return;
  gameStatus = 'lose';
  SFX.play('lose');
  clearInterval(timerInt);
  document.getElementById('loseReason').textContent = reason || 'Try again!';
  setTimeout(() => {
    cancelAnimationFrame(raf);
    showScreen('loseScreen');
  }, 800);
}

function nextLevel() {
  const n = GS.curLevel + 1;
  if (n <= 100) startLevel(n);
  else showScreen('worldSelect');
}

function retryLvl() {
  cancelAnimationFrame(raf);
  clearInterval(timerInt);
  gameStatus = 'idle';
  GS.lives = 3;   // reset lives on retry
  setTimeout(() => startLevel(GS.curLevel), 50);
}

// ── REVIVE (100 coins) ──
function revivePlayer() {
  const REVIVE_COST = 100;
  if (GS.coins < REVIVE_COST) {
    // Flash the button to show not enough coins
    const btn = document.getElementById('reviveBtn');
    if (btn) {
      btn.style.background = '#FF4444';
      btn.querySelector('span').textContent = 'Need 100🪙!';
      setTimeout(() => {
        btn.style.background = '';
        btn.querySelector('span').textContent = 'Revive 100🪙';
      }, 1200);
    }
    SFX.play('hurt');
    return;
  }
  GS.coins -= REVIVE_COST;
  GS.lives = 3;
  saveLocal();
  SFX.play('heart');
  // إعادة اللعب من موقع الموت
  cancelAnimationFrame(raf);
  clearInterval(timerInt);
  gameStatus = 'idle';
  setTimeout(() => {
    startLevel(GS.curLevel);
    // بعد بناء المستوى نضع الشخصية في reviveCheckpoint
    setTimeout(() => {
      player.x   = reviveCheckpoint.x;
      player.y   = reviveCheckpoint.y;
      player.vx  = 0;
      player.vy  = 0;
      player.inv  = true;
      player.invT = 120;
      player.dead = false;
    }, 80);
  }, 50);
}

function backToLevels() {
  cancelAnimationFrame(raf);
  clearInterval(timerInt);
  gameStatus = 'idle';
  showScreen('levelSelect');
  buildLevelGrid(selectedWorld);
}

// ── PAUSE ──
function pauseGame() {
  paused = true;
  clearInterval(timerInt);
  document.getElementById('pauseOv').classList.add('show');
}

function resumeGame() {
  paused = false;
  document.getElementById('pauseOv').classList.remove('show');
  lastT = performance.now();
  startTimer(lvTimer); // restart timer from where we left off
}

// ── SHOP ──
function openShop() {
  shopFrom = document.querySelector('.screen.active')?.id || 'splash';
  showScreen('shopScreen');
}
function closeShop() {
  const dest = shopFrom === 'shopScreen' ? 'gameScreen' : shopFrom;
  showScreen(dest);
}

// ── LEADERBOARD ──
// ══════════════════════════════════════════════════════
//  LEADERBOARD — لوحة المتصدرين
// ══════════════════════════════════════════════════════
let _lbCurrentTab = 'level';

function showLeaderboard() {
  const el = document.getElementById('leaderboardScreen');
  if (el) el.classList.add('active');
  _lbCurrentTab = 'level';
  _setLbTabActive('level');
  _loadLeaderboard('level');
  _renderMyRank();
}

function closeLeaderboard() {
  const el = document.getElementById('leaderboardScreen');
  if (el) el.classList.remove('active');
}

function switchLbTab(tab) {
  _lbCurrentTab = tab;
  _setLbTabActive(tab);
  _loadLeaderboard(tab);
}

function _setLbTabActive(tab) {
  ['level','coins'].forEach(t => {
    const el = document.getElementById('lbTab-' + t);
    if (el) el.classList.toggle('active', t === tab);
  });
}

async function _loadLeaderboard(tab) {
  const body = document.getElementById('lbBody');
  if (!body) return;

  // شاشة تحميل
  body.innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div><span>Loading...</span></div>';

  // عمود الترتيب حسب التبويب
  const orderCol = tab === 'level' ? 'max_level' : 'coins';
  const label    = tab === 'level' ? 'Level'      : 'Coins';

  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/players?select=pi_username,max_level,coins&order=${orderCol}.desc&limit=50`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    );

    if (!res.ok) {
      if (res.status === 404) {
        body.innerHTML = `
          <div class="lb-empty">
            ⚙️ Leaderboard not set up yet.<br>
            <small style="color:#555;font-size:10px;line-height:1.8;">
              Run this SQL in Supabase dashboard:<br>
              <code style="color:#FFD700;font-size:9px;">
                CREATE TABLE players (<br>
                &nbsp;pi_uid text PRIMARY KEY,<br>
                &nbsp;pi_username text,<br>
                &nbsp;max_level int DEFAULT 1,<br>
                &nbsp;coins int DEFAULT 0,<br>
                &nbsp;lives int DEFAULT 3,<br>
                &nbsp;world_progress jsonb,<br>
                &nbsp;updated_at timestamptz<br>
                );
              </code>
            </small>
          </div>`;
      } else {
        throw new Error('HTTP ' + res.status);
      }
      return;
    }
    const rows = await res.json();

    if (!rows || rows.length === 0) {
      body.innerHTML = '<div class="lb-empty">🏜️ No players yet.<br>Be the first to login with Pi!</div>';
      return;
    }

    // رمز اللاعب
    const rankSymbol = (i) => {
      if (i === 0) return '<span class="lb-rank gold">🥇</span>';
      if (i === 1) return '<span class="lb-rank silver">🥈</span>';
      if (i === 2) return '<span class="lb-rank bronze">🥉</span>';
      return `<span class="lb-rank">#${i + 1}</span>`;
    };

    const myUid      = GS.piUser?.uid;
    const myUsername = GS.piUser?.username || '';

    const html = rows.map((r, i) => {
      const name   = r.pi_username || 'Unknown';
      const score  = tab === 'level' ? `Lv ${r.max_level || 1}` : `${(r.coins || 0).toLocaleString()} 🪙`;
      const detail = tab === 'level'
        ? `${(r.coins || 0).toLocaleString()} coins`
        : `Max Level ${r.max_level || 1}`;
      const isMe   = myUsername && name === myUsername;
      const initial = name.charAt(0).toUpperCase();
      return `
        <div class="lb-row ${isMe ? 'me' : ''}">
          ${rankSymbol(i)}
          <div class="lb-avatar">${initial}</div>
          <div class="lb-info">
            <div class="lb-name">${name}${isMe ? ' ← You' : ''}</div>
            <div class="lb-detail">${detail}</div>
          </div>
          <div class="lb-score">${score}</div>
        </div>`;
    }).join('');

    body.innerHTML = html;

  } catch(e) {
    body.innerHTML = `<div class="lb-empty">⚠️ Could not load leaderboard.<br><small style="color:#555">${e.message}</small></div>`;
  }
}

function _renderMyRank() {
  const panel = document.getElementById('lbMyRank');
  if (!panel) return;

  if (!GS.piUser) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'flex';
  document.getElementById('lbMyAvatar').textContent = GS.piUser.username.charAt(0).toUpperCase();
  document.getElementById('lbMyName').textContent   = GS.piUser.username;
  document.getElementById('lbMyDetail').textContent = `Level ${GS.maxUnlocked} · ${GS.coins.toLocaleString()} coins`;
  document.getElementById('lbMyScore').textContent  = `Lv ${GS.maxUnlocked}`;

  // جلب ترتيب اللاعب الحالي
  _fetchMyRank();
}

async function _fetchMyRank() {
  if (!GS.piUser) return;
  try {
    // عدد اللاعبين الذين لديهم max_level أعلى
    const res = await fetch(
      `${SUPA_URL}/rest/v1/players?select=pi_username&max_level=gt.${GS.maxUnlocked}`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`,
                   'Prefer': 'count=exact', 'Range': '0-0' } }
    );
    const countHeader = res.headers.get('Content-Range');
    if (countHeader) {
      const total = parseInt(countHeader.split('/')[1]) || 0;
      const el = document.getElementById('lbMyRankNum');
      if (el) el.textContent = `#${total + 1}`;
    }
  } catch(e) {}
}

// ── INIT ──
window.addEventListener('load', async () => {
  const lbg = document.getElementById('loadBG');

  ldProgress(10, 'Initializing Pi...');
  try {
    if (typeof Pi !== 'undefined') Pi.init({ version: '2.0', sandbox: true });
  } catch(e) {}

  ldProgress(20, 'Loading assets...');
  await loadCriticalAssets();   // العالم 1 فقط — سريع

  ldProgress(90, 'Preparing levels...');
  loadLocal();

  if (lbg && UI_IMGS.splash) {
    lbg.style.backgroundImage = `url(${UI_IMGS.splash.src})`;
    lbg.classList.add('show');
  }

  ldProgress(100, 'Ready!');
  setTimeout(() => {
    showScreen('piLogin');
    // تحميل باقي الأصول في الخلفية بعد 2 ثانية من بدء اللعبة
    setTimeout(() => loadRemainingAssets(), 2000);
  }, 600);
});

function ldProgress(p, txt) {
  const bar = document.getElementById('ldBar');
  const t   = document.getElementById('ldTxt');
  if (bar) bar.style.width = p + '%';
  if (t)   t.textContent = txt;
}

// ── PREVENT SCROLL / CONTEXT MENU ──
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => { if (gameStatus === 'playing') setupRotation(); });

// Unlock AudioContext on first user interaction (required by browsers)
const _sfxUnlock = () => { SFX.unlock(); document.removeEventListener('touchstart', _sfxUnlock); document.removeEventListener('mousedown', _sfxUnlock); };
document.addEventListener('touchstart', _sfxUnlock, { once: true });
document.addEventListener('mousedown', _sfxUnlock, { once: true });
