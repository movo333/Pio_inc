// ═══════════════════════════════════════════════════════
//  SUPER COWBOY - Game Engine
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

// ── السيرفر (حفظ سحابي + لوحة الصدارة + الدفع) ──
const API_BASE = 'https://superpioar22.netlify.app/.netlify/functions';
const GAME_API = API_BASE + '/pi-game';
async function _gameApi(body) {
  const r = await fetch(GAME_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// ── أصوات بيئية لكل عالم (بدل الموسيقى) — ملفات اختيارية في assets/sounds/ ──
// amb_nature.ogg | amb_graveyard.ogg | amb_winter.ogg | amb_desert.ogg
// إن لم يوجد الملف يستمر اللعب بصمت دون أي خطأ.
const AMB = (() => {
  const FILES = { nature:'amb_nature.ogg', graveyard:'amb_graveyard.ogg', winter:'amb_winter.ogg', desert:'amb_desert.ogg' };
  const VOL = 0.3;
  let el = null;
  function stop() { if (el) { try { el.pause(); } catch (e) {} el = null; } }
  function start(theme) {
    stop();
    const f = FILES[theme]; if (!f) return;
    try { if (SFX.isMuted()) return; } catch (e) {}
    const a = new Audio('assets/sounds/' + f);
    a.loop = true; a.volume = VOL;
    a.addEventListener('error', () => { if (el === a) el = null; });
    el = a;
    const pr = a.play(); if (pr && pr.catch) pr.catch(() => {});
  }
  function pause()  { if (el) try { el.pause(); } catch (e) {} }
  function resume() { if (el) { try { if (SFX.isMuted()) return; } catch (e) {} const pr = el.play(); if (pr && pr.catch) pr.catch(() => {}); } }
  return { start, stop, pause, resume };
})();

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
    spikebee:  'spikebee.ogg',
    spikebee1: 'spikebee1.ogg',
    spikebee2: 'spikebee2.ogg',
    spikebee3: 'spikebee3.ogg',
    spikebee4: 'spikebee4.ogg',
    bat1:      'bat1.ogg',
    bat2:      'bat2.ogg',
    bat3:      'bat3.ogg',
    tuca:      'tuca.ogg',
    tuca1:     'tuca1.ogg',
    tuca2:     'tuca2.ogg',
    tuca3:     'tuca3.ogg',
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

  // Pool بسيط كـ fallback (يُنشأ عند أول استخدام فقط)
  const POOL = 3;
  const pools = {};
  function getPool(name) {
    if (!pools[name] && MAP[name]) {
      const arr = [];
      for (let i = 0; i < POOL; i++) {
        const a = new Audio(BASE + MAP[name]);
        a.preload = 'none';
        arr.push(a);
      }
      pools[name] = { arr, i: 0 };
    }
    return pools[name];
  }

  function playPool(name, vol) {
    const p = getPool(name);
    if (!p) return;
    const a = p.arr[p.i];
    p.i = (p.i + 1) % POOL;
    try { a.currentTime = 0; } catch(e) {}
    a.volume = Math.min(1, Math.max(0, vol !== undefined ? vol : 0.7));
    a.play().catch(() => {});
  }

  function stopAll() {
    // إيقاف كل الأصوات فوراً
    Object.values(pools).forEach(p =>
      p.arr.forEach(a => { try { a.pause(); a.currentTime = 0; } catch(e){} })
    );
    if (_ac) {
      try { _ac.suspend(); } catch(e){}
    }
  }

  // أصوات مولَّدة برمجياً (لا تحتاج ملفات)
  function synth(kind, n) {
    if (muted) return;
    try {
      const ac = getAC(), t0 = ac.currentTime;
      const tone = (f0, f1, st, dur, type, vol) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f0, t0 + st);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + st + dur);
        g.gain.setValueAtTime(0.0001, t0 + st);
        g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + dur);
        o.connect(g); g.connect(ac.destination);
        o.start(t0 + st); o.stop(t0 + st + dur + 0.05);
      };
      if (kind === 'secret')      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0, i * 0.07, 0.25, 'triangle', 0.2));
      else if (kind === 'star')   { [988, 1319, 1568, 1976, 2637].forEach((f, i) => tone(f, 0, i * 0.06, 0.3, 'sine', 0.2)); }
      else if (kind === 'gem')    { tone(1175, 0, 0, 0.12, 'sine', 0.2); tone(1760, 0, 0.09, 0.25, 'sine', 0.2); }
      else if (kind === 'power')  { tone(300, 900, 0, 0.3, 'square', 0.09); tone(600, 1200, 0.12, 0.25, 'triangle', 0.15); }
      else if (kind === 'shield_break') { tone(700, 120, 0, 0.35, 'sawtooth', 0.12); }
      else if (kind === 'combo')  { tone(440 * Math.pow(1.122, Math.min(n || 2, 6)), 0, 0, 0.18, 'square', 0.08); }
    } catch (e) {}
  }

  return {
    synth,
    play(name, vol) {
      if (muted || !MAP[name]) return;
      if (!playAC(name, vol)) playPool(name, vol);
    },
    stopAll,
    mute(v)   { muted = v; },
    isMuted() { return muted; },
    urls() { return Object.values(MAP).map(f => BASE + f); },
    // تحميل كل الأصوات قبل بدء اللعبة (مع مهلة لكل ملف)
    preloadAll() {
      const names = Object.keys(MAP);
      return Promise.all(names.map(n => new Promise(res => {
        loadBuffer(n);
        const t0 = Date.now();
        const iv = setInterval(() => {
          if (acBuffers[n] || Date.now() - t0 > 15000) { clearInterval(iv); res(); }
        }, 100);
      })));
    },
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
  unlockedWorlds: [],  // عوالم مفتوحة بالشراء
  speedBoost: false,
  worldProgress: { 1:0, 2:0, 3:0, 4:0 }, // completed levels per world
  stars: {},   // أفضل نجوم سرية لكل مرحلة (bitmask: 1/2/4)
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
let castle = null;                    // قصر نهاية المرحلة {c} أو null
let reviveCheckpoint = { x: 0, y: 0 }; // موقع الموت لاستعادة الشخصية

// ── LEVEL DATA ──
let solidTiles = [];
let pickups    = [];
let enemies    = [];
let bullets    = [];
let particles  = [];
let crumbleTiles = []; // tiles that crumble when stepped on
let secrets = [];      // مناطق سرية {x,y,w,h,revealed,a,cv}
let movers  = [];      // منصات متحركة (float_platform)
let popups  = [];      // نصوص عائمة (نقاط/كومبو)
let lvStars = [false, false, false]; // النجوم السرية المجموعة في هذه المرحلة
let _powKey = '';
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

// ══════════════════════════════════════════════════════
//  PROPS — صور القصور والأشواك والنوابض (مجلد assets/props/)
//  تُحمَّل هنا مباشرة؛ وإن غاب أي ملف تُرسم بدائل برمجية
// ══════════════════════════════════════════════════════
const PROPS_DIR = 'assets/props/';
const PROPS = {};
const PROP_FILES = [
  'Palace nature.png','Palace Cemetery.png','Ice Palace.png','Palace desert.png',
  'Plant thorns1.png','Plant thorns2.png','ThornsGraveyard1.png','ThornsGraveyard2.png',
  'Ice Thorns1.png','Ice Thorns2.png','Desert Thorns1.png','Desert Thorns2.png',
  'nabid1.png','nabid2.png','nabid3.png','nabid4.png',
  // أجسام جديدة (صور اختيارية — يوجد بديل برمجي لكل منها)
  'star_secret.png','gem.png','magnet.png','shield.png','float_platform.png',
];
function loadProps() {
  for (const f of PROP_FILES) {
    if (PROPS[f]) continue;
    const img = new Image();
    img.src = PROPS_DIR + encodeURIComponent(f);
    PROPS[f] = img;
  }
}
loadProps();

// القصر: ملف الصورة لكل عالم + موضع الباب داخل الصورة (نسب من 0 إلى 1)
//  doorX: مركز الباب أفقياً | doorH: ارتفاع الباب | base: كم يُغرَس أسفل الصورة في الأرض
const CASTLE = {
  nature:    { file:'Palace nature.png',   doorX:0.51,  doorH:0.26, base:0.09  },
  graveyard: { file:'Palace Cemetery.png', doorX:0.506, doorH:0.28, base:0.08  },
  winter:    { file:'Ice Palace.png',      doorX:0.50,  doorH:0.26, base:0.08  },
  desert:    { file:'Palace desert.png',   doorX:0.52,  doorH:0.25, base:0.145 },
};
// الأشواك: صورتان لكل عالم (1 و 2) + أبعادها الأصلية لحساب النسبة
const SPIKE_IMG = {
  nature:    ['Plant thorns1.png','Plant thorns2.png'],
  graveyard: ['ThornsGraveyard1.png','ThornsGraveyard2.png'],
  winter:    ['Ice Thorns1.png','Ice Thorns2.png'],
  desert:    ['Desert Thorns1.png','Desert Thorns2.png'],
};
const SPIKE_ASPECT = {
  'Plant thorns1.png':270/138,  'Plant thorns2.png':473/204,
  'ThornsGraveyard1.png':319/178,'ThornsGraveyard2.png':514/177,
  'Ice Thorns1.png':319/215,    'Ice Thorns2.png':516/211,
  'Desert Thorns1.png':319/179, 'Desert Thorns2.png':516/166,
};
// النابض: إطارات الحركة من الانضغاط إلى الامتداد (الباقي نسخ مكررة)
const SPRING_FRAMES = ['nabid4.png','nabid3.png','nabid2.png','nabid1.png'];
const SPRING_REST   = 'nabid1.png';
const _trimCache = {};
// يقصّ الحواف الشفافة ويقيس عرض القاعدة ليبقى حجم النابض ثابتاً بين الإطارات
function springSprite(file) {
  if (_trimCache[file]) return _trimCache[file];
  const img = PROPS[file];
  if (!imgOK(img)) return null;
  let bb = { x:0, y:0, w:img.naturalWidth, h:img.naturalHeight }, baseW = bb.w;
  try {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, x1 = -1, y0 = cv.height, y1 = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      if (d[(y*cv.width + x)*4 + 3] > 24) { if (x<x0)x0=x; if (x>x1)x1=x; if (y<y0)y0=y; if (y>y1)y1=y; }
    }
    if (x1 >= 0) {
      bb = { x:x0, y:y0, w:x1-x0+1, h:y1-y0+1 };
      // عرض القاعدة = عرض الصف المعتم عند 8% فوق أسفل الصورة
      const ry = Math.max(y0, y1 - Math.round(bb.h * 0.08));
      let a = cv.width, b = -1;
      for (let x = 0; x < cv.width; x++) if (d[(ry*cv.width + x)*4 + 3] > 24) { if (x<a)a=x; if (x>b)b=x; }
      if (b > a) baseW = b - a + 1;
    }
  } catch (e) { /* ملفات محلية: نكتفي بالمقاييس التقريبية */ }
  return (_trimCache[file] = { img, bb, baseW });
}

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

// فتح صفحة التطبيق على X (من متصفح Pi نستخدم متصفح النظام إن توفّر)
function openXPage() {
  const url = 'https://x.com/Supercowboyapp';
  try {
    if (typeof Pi !== 'undefined' && typeof Pi.openUrlInSystemBrowser === 'function') {
      Pi.openUrlInSystemBrowser(url);
      return;
    }
  } catch (e) { /* ننتقل للطريقة العادية */ }
  window.open(url, '_blank', 'noopener');
}

function imgOK(img) { return img && img.complete && img.naturalWidth > 0; }

// ── SAVE / LOAD ──
// ══════════════════════════════════════════════════════
//  SMART SAVE SYSTEM — حفظ ذكي محلي + سحابي
// ══════════════════════════════════════════════════════

const SAVE_KEY     = 'spio_v3';
const SYNCED_KEY   = 'spio_synced'; // هل تمت المزامنة مرة من قبل؟
const SYNC_TS_KEY  = 'spio_sync_ts'; // وقت آخر مزامنة

// ── حفظ محلي فوري ──
function saveLocal() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      m:  GS.maxUnlocked,
      l:  GS.lives,
      c:  GS.coins,
      w:  GS.allWorlds,
      sp: GS.speedBoost,
      wp: GS.worldProgress,
      uw: GS.unlockedWorlds,
      st: GS.stars,
      ts: Date.now()
    }));
  } catch(e) {}
}

// ── تحميل محلي فوري ──
function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    GS.maxUnlocked   = d.m  || 1;
    GS.lives         = d.l  || 3;
    GS.coins         = d.c  || 0;
    GS.allWorlds     = d.w  || false;
    GS.speedBoost    = d.sp || false;
    GS.worldProgress = d.wp || { 1:0, 2:0, 3:0, 4:0 };
    GS.unlockedWorlds= d.uw || [];
    GS.stars         = d.st || {};
    console.log('[Save] Loaded from localStorage ✓');
  } catch(e) {}
}

// ── حفظ سحابي في الخلفية ──
let _cloudSaveTimer = null;
function cloudSave() {
  saveLocal(); // دائماً نحفظ محلياً أولاً
  if (!GS.piUser) return;
  // تأخير 2 ثانية لتجميع التغييرات
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(_doCloudSave, 2000);
}

async function _doCloudSave() {
  if (!GS.piUser) return;
  try {
    if (!_piAccessToken) return;
    const out = await _gameApi({
      action:         'save',
      accessToken:    _piAccessToken,
      max_level:      GS.maxUnlocked,
      coins:          GS.coins,
      lives:          GS.lives,
      world_progress: GS.worldProgress
    });
    if (out && out.ok) {
      localStorage.setItem(SYNC_TS_KEY, Date.now().toString());
      console.log('[Cloud] Saved ✓');
    }
  } catch(e) {
    console.warn('[Cloud] Save failed (offline?) —', e.message);
  }
}

// ── تحميل سحابي ذكي ──
// يُحمَّل مرة واحدة فقط عند أول تسجيل دخول
// بعدها يعتمد على المحلي + مزامنة في الخلفية
async function cloudLoad() {
  if (!GS.piUser) return;

  // دائماً حمّل المحلي فوراً للعب الفوري
  loadLocal();

  const alreadySynced = localStorage.getItem(SYNCED_KEY + '_' + GS.piUser.uid);

  // إذا سبق المزامنة → اكتفِ بالمحلي + مزامنة خلفية
  if (alreadySynced) {
    console.log('[Save] Using cached data ✓');
    _syncInBackground();
    return;
  }

  // أول مرة → حاول السحابة
  if (!navigator.onLine) {
    console.log('[Save] Offline — using localStorage ✓');
    return;
  }

  try {
    if (!_piAccessToken) throw new Error('no token');
    const data = await _gameApi({ action: 'load', accessToken: _piAccessToken });
    {
      if (data && data.player) {
        const d = data.player;
        // خذ أفضل بيانات بين المحلي والسحابي
        const local = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
        GS.maxUnlocked    = Math.max(d.max_level || 1, local.m || 1);
        GS.coins          = Math.max(d.coins || 0,     local.c || 0);
        GS.lives          = Math.max(d.lives || 3,     local.l || 3);
        GS.allWorlds      = d.all_worlds || local.w || false;
        GS.unlockedWorlds = d.unlocked_worlds ? JSON.parse(d.unlocked_worlds) : (local.uw || []);
        GS.worldProgress  = d.world_progress || local.wp || { 1:0, 2:0, 3:0, 4:0 };
        console.log('[Cloud] First sync done ✓');
      }
      saveLocal();
      localStorage.setItem(SYNCED_KEY + '_' + GS.piUser.uid, '1');
    }
  } catch(e) {
    loadLocal();
    console.warn('[Cloud] Load failed — using localStorage:', e.message);
  }
}

// ── مزامنة خلفية صامتة كل 5 دقائق ──
function _syncInBackground() {
  setTimeout(async () => {
    if (!GS.piUser || !navigator.onLine) return;
    try {
      if (_piAccessToken) {
        const r = await _gameApi({ action: 'load', accessToken: _piAccessToken });
        const data = r && r.player ? [r.player] : [];
        if (data[0]) {
          // خذ الأعلى دائماً
          if ((data[0].max_level || 0) > GS.maxUnlocked) {
            GS.maxUnlocked = data[0].max_level;
            saveLocal();
          }
        }
      }
    } catch(e) {}
  }, 300000); // 5 دقائق
}

// ── مزامنة عند العودة للإنترنت ──
window.addEventListener('online', () => {
  console.log('[Net] Back online — syncing...');
  _doCloudSave();
});

// ══════════════════════════════════════════════════════
//  PI NETWORK (MAINNET) — Authentication & Payments
//  approve/complete تمر عبر دالة الخادم (Server API Key في الخادم فقط)
// ══════════════════════════════════════════════════════

const PI_BACKEND = API_BASE + '/pi-payment';
let   _piAccessToken = null;

// المكافآت — المفاتيح يجب أن تطابق buy('<id>', price) في index.html وكتالوج الخادم
const PI_REWARDS = {
  coins:  () => { GS.coins += 1000; updHUD(); },
  speed:  () => { GS.speedBoost = true; updHUD(); },
  hearts: () => { GS.lives = Math.min(99, GS.lives + 20); updHUD(); },      // 0.2π
  level:  () => { unlockNextLevel(); },                                      // 0.2π — المرحلة التالية فقط
  world:  () => { unlockNextWorld(); },                                      // 0.5π — العالم التالي فقط
  worlds: () => { GS.allWorlds = true; buildWorldGrid(); },                  // قديم (للدفعات المعلّقة فقط)
  mega:   () => { GS.allWorlds = true; GS.coins += 1000; updHUD(); buildWorldGrid(); },
};

const PI_MEMOS = {
  coins:  'Super Cowboy: 1000 Coins',
  speed:  'Super Cowboy: Speed Boost',
  hearts: 'Super Cowboy: 20 Hearts',
  level:  'Super Cowboy: Unlock Next Level',
  world:  'Super Cowboy: Unlock Next World',
  worlds: 'Super Cowboy: Unlock All Worlds',
  mega:   'Super Cowboy: Mega Bundle (All Worlds + 1000 Coins)',
};

// فتح المرحلة التالية فقط (+1)
function unlockNextLevel() {
  if (GS.maxUnlocked < 100) GS.maxUnlocked++;
  _refreshUnlockUI();
}
// فتح العالم التالي فقط: أول مرحلة في أقرب عالم مقفل (العوالم التي بعده تبقى مقفلة)
function unlockNextWorld() {
  const w = WORLDS.find(w => w.minLevel > GS.maxUnlocked);
  if (w) GS.maxUnlocked = w.minLevel;
  _refreshUnlockUI();
}
function _refreshUnlockUI() {
  try { buildWorldGrid(); } catch (e) {}
  try { if (typeof selectedWorld !== 'undefined' && selectedWorld) buildLevelGrid(selectedWorld); } catch (e) {}
}

function _applyPiReward(item) {
  const fn = PI_REWARDS[item];
  if (fn) fn();
  try { SFX.play('purchase'); } catch(e) {}
  saveLocal();
  cloudSave();
}

// ── دفعة غير مكتملة من جلسة سابقة ──
function onIncompletePaymentFound(payment) {
  const paymentId = payment.identifier;
  const txid = payment.transaction ? payment.transaction.txid : null;
  const item = payment.metadata ? payment.metadata.item : null;
  if (txid) _piCompletePayment(paymentId, txid, () => _applyPiReward(item));
  else _piCancelPayment(paymentId);
}

// ── واجهة الدخول: الشارة + زر "Login with Pi" للضيوف ──
const BUILD_ID = 'secrets-v10';

// ينشئ العناصر الناقصة بنفسه حتى لو كان index.html نسخة قديمة
function _ensureLoginUI() {
  const splash = document.getElementById('splash');
  if (splash && !document.getElementById('btnPiLoginSplash')) {
    const b = document.createElement('button');
    b.id = 'btnPiLoginSplash';
    b.className = 'pi-btn';
    b.textContent = '🔐 Login with Pi';
    b.style.cssText = 'position:absolute;top:16px;left:14px;z-index:5;padding:7px 14px;font-size:11px;letter-spacing:0;display:none;';
    b.onclick = () => piAuth({ stay: true });
    splash.appendChild(b);
  }
  const login = document.getElementById('piLogin');
  if (login && !document.getElementById('piLoginMsg')) {
    const m = document.createElement('div');
    m.id = 'piLoginMsg';
    m.style.cssText = 'display:none;margin-top:16px;max-width:300px;padding:10px 12px;background:rgba(120,0,0,0.5);border:1px solid #ff6b6b;border-radius:10px;font-size:11px;color:#ffd0d0;text-align:center;line-height:1.5;white-space:pre-wrap;word-break:break-word;';
    login.appendChild(m);
  }
  if (!document.getElementById('buildInfo')) {
    const i = document.createElement('div');
    i.id = 'buildInfo';
    i.style.cssText = 'position:fixed;bottom:3px;left:6px;font-size:9px;color:#888;z-index:10000;pointer-events:none;';
    document.body.appendChild(i);
  }
}

function _updateBuildInfo() {
  const i = document.getElementById('buildInfo');
  const inPiBrowser = /PiBrowser/i.test(navigator.userAgent || '');
  let framed = false; try { framed = window.self !== window.top; } catch(e) { framed = true; }
  if (i) i.textContent = BUILD_ID + ' · v:' + (window.APP_VERSION || '?') + ' · SDK:' + (typeof Pi !== 'undefined' ? 'ok' : 'missing') +
    ' · sandbox:' + _inPiSandbox() + ' · PiBrowser:' + (inPiBrowser ? 'yes' : 'no') +
    ' · init:' + (_piInited ? 'ok' : ('fail' + (_piInitError ? '(' + _piInitError + ')' : ''))) +
    ' · framed:' + (framed ? 'yes' : 'no');
}

function _updatePiUI() {
  _ensureLoginUI();
  _updateBuildInfo();
  const badge = document.getElementById('piUserBadge');
  const btn   = document.getElementById('btnPiLoginSplash');
  if (badge) {
    if (GS.piUser) { badge.textContent = 'π ' + GS.piUser.username; badge.style.display = 'block'; }
    else badge.style.display = 'none';
  }
  if (btn) btn.style.display = GS.piUser ? 'none' : 'block';
}

function _piMsg(text) {
  const el = document.getElementById('piLoginMsg');
  const onLoginScreen = document.getElementById('piLogin')?.classList.contains('active');
  if (el && onLoginScreen) { el.textContent = text; el.style.display = text ? 'block' : 'none'; }
  else if (text) alert(text);
}

function _addModeButton() {
  const box = document.getElementById('piLoginMsg');
  if (!box) return;
  const old = document.getElementById('piModeBtn');
  if (old) old.remove();
  const toSandbox = !_inPiSandbox();
  const b = document.createElement('button');
  b.id = 'piModeBtn';
  b.textContent = toSandbox ? 'Retry in Sandbox mode' : 'Retry in normal mode';
  b.style.cssText = 'display:block;margin:10px auto 0;padding:7px 14px;border:1px solid #fff;border-radius:16px;background:transparent;color:#fff;font-size:11px;cursor:pointer;';
  b.onclick = () => { location.href = location.pathname + '?sandbox=' + (toSandbox ? '1' : '0'); };
  box.appendChild(b);
}

let _piAuthBusy = false;

// ── تسجيل الدخول بـ Pi ──  (stay=true: لا تغيّر الشاشة الحالية، مثل المتجر)
async function piAuth(opts) {
  const stay = !!(opts && opts.stay);
  if (_piAuthBusy) return false;
  _piAuthBusy = true;
  _piMsg('');
  const btns = document.querySelectorAll('.pi-btn, #btnPiLoginSplash');
  btns.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });
  try {
    await _loadPiSdk();
    if (typeof Pi === 'undefined') {
      _piMsg('Pi SDK is not available. Please open the game inside Pi Browser and check your internet connection.');
      return false;
    }
    if (!_initPi()) {
      _piMsg('Pi.init failed: ' + (_piInitError || 'unknown error'));
      return false;
    }

    // مهلة 40 ثانية حتى لا يبقى الزر معلّقاً
    const attempt = () => Promise.race([
      Pi.authenticate(['username', 'payments'], onIncompletePaymentFound),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Login timed out. Please try again.')), 40000))
    ]);
    let auth;
    try {
      auth = await attempt();
    } catch (err) {
      // "SDK was not initialized": نعيد التهيئة مرة واحدة ثم نحاول من جديد
      if (/not initialized/i.test((err && err.message) || '')) {
        if (!_initPi(true)) throw new Error('Pi.init failed: ' + (_piInitError || 'unknown error'));
        auth = await attempt();
      } else {
        throw err;
      }
    }

    _piAccessToken = auth.accessToken;
    GS.piUser = auth.user;
    loadLocal();
    await cloudLoad();
    _updatePiUI();
    if (!stay) { showScreen('splash'); setSplashBG(); }
    return true;
  } catch(e) {
    console.error('[Pi] Auth failed:', e);
    const detail = (e && (e.message || e.toString())) || 'unknown error';
    _piMsg('Pi login failed: ' + detail + '\n(sandbox=' + _inPiSandbox() + ')');
    if (document.getElementById('piLogin')?.classList.contains('active')) _addModeButton();
    return false;       // لا ندخل كضيف تلقائياً — اللاعب يقرر
  } finally {
    _piAuthBusy = false;
    btns.forEach(b => { b.disabled = false; b.style.opacity = ''; });
  }
}

// ── زر Open: دخول مباشر للّعبة دون تسجيل (التسجيل من الزر الجانبي في الشاشة الرئيسية) ──
function enterGame() {
  _updatePiUI();
  showScreen('splash');
  setSplashBG();
}

// ── اللعب كضيف ──
function playGuest() {
  GS.piUser = null;
  _piAccessToken = null;
  _updatePiUI();
  showScreen('splash');
  setSplashBG();
}

function logout() {
  GS.piUser = null;
  _piAccessToken = null;
  _updatePiUI();
  showScreen('piLogin');
}

// ── استدعاء الـ Backend ──
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

function _piApprovePayment(paymentId) { _callBackend('approve', paymentId, null); }   // بدون await
function _piCancelPayment(paymentId)  { _callBackend('cancel',  paymentId, null); }

// ── إكمال الدفعة: المكافأة تُمنح فقط إذا أكّد الخادم ──
async function _piCompletePayment(paymentId, txid, onSuccess) {
  const res = await _callBackend('complete', paymentId, txid);
  if (res && res.ok) {
    if (onSuccess) onSuccess();
    return true;
  }
  alert(i18n('notConf'));
  return false;
}

// ── الشراء من المتجر (Pi الحقيقي) ──
async function buy(item, amount) {
  if (!GS.piUser) {
    const ok = await piAuth({ stay: true });      // يطلب الدخول بحساب Pi ثم يكمل الشراء
    if (!ok || !GS.piUser) return;
  }
  if (!PI_REWARDS[item]) { alert('Unknown item'); return; }
  // لا ندفع مقابل شيء مفتوح أصلاً
  if ((item === 'world' && !WORLDS.some(w => w.minLevel > GS.maxUnlocked)) ||
      (item === 'level' && GS.maxUnlocked >= 100)) { alert(i18n('nothing')); return; }

  const paymentData = {
    amount,
    memo:     PI_MEMOS[item] || 'Super Cowboy Purchase',
    metadata: { item, player: GS.piUser.uid }
  };

  const paymentCallbacks = {
    onReadyForServerApproval: (paymentId) => {
      console.log('[Pi] onReadyForServerApproval:', paymentId);
      _piApprovePayment(paymentId);
    },
    onReadyForServerCompletion: async (paymentId, txid) => {
      console.log('[Pi] onReadyForServerCompletion:', paymentId, txid);
      const ok = await _piCompletePayment(paymentId, txid, () => _applyPiReward(item));
      if (ok) alert(i18n('buyOk'));
    },
    onCancel: (paymentId) => {
      console.log('[Pi] Cancelled:', paymentId);
      _piCancelPayment(paymentId);
    },
    onError: (err, payment) => {
      console.error('[Pi] Error:', err, payment);
      if (payment && payment.identifier) _piCancelPayment(payment.identifier);
      alert(i18n('payErr'));
    },
  };

  try {
    Pi.createPayment(paymentData, paymentCallbacks);
  } catch(e) {
    console.error('[Pi] createPayment failed:', e);
    alert(i18n('openPi'));
  }
}

// ══════════════════════════════════════════════════════
//  SHOP
// ══════════════════════════════════════════════════════

function switchShopTab() { /* single tab: Pi Store */ }

// ══════════════════════════════════════════════════════
//  EXIT DIALOG — تنبيه الخروج
// ══════════════════════════════════════════════════════

function showExitDialog() {
  document.getElementById('exitDialog').classList.add('show');
}

function cancelExit() {
  document.getElementById('exitDialog').classList.remove('show');
}

function confirmExit() {
  window.close();
  history.back();
}

// Intercept back button
window.addEventListener('popstate', (e) => {
  e.preventDefault();
  showExitDialog();
});
window.history.pushState({}, '');

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') showExitDialog();
});

// ── SCREEN MANAGEMENT ──
function showScreen(id) {
  const mains = ['loadingScreen','piLogin','splash','worldSelect','levelSelect','gameScreen'];
  const subs  = ['winScreen','loseScreen','shopScreen'];

  // إيقاف الأصوات عند الخروج من المرحلة
  const wasInGame = document.getElementById('gameScreen')?.classList.contains('active');
  const leavingGame = wasInGame && !['gameScreen','winScreen','loseScreen'].includes(id);
  if (leavingGame) { try { SFX.stopAll(); } catch(e){} try { AMB.stop(); } catch(e){} }

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
  if (bg && UI_IMGS.splash) {
    const splashSrc = window.location.protocol === 'file:'
      ? UI_IMGS.splash.src
      : UI_IMGS.splash.src;
    bg.style.backgroundImage = `url(${splashSrc})`;
  }
}

// ── WORLD SELECT ──
function showWorldSelect() {
  SFX._enabled = true; // تفعيل الصوت عند بدء اللعبة
  buildWorldGrid();
  // Set sky background
  const sky = document.getElementById('worldsSkyBG');
  if (sky && UI_IMGS.sky_bg) sky.style.backgroundImage = `url(${UI_IMGS.sky_bg.src})`;
  showScreen('worldSelect');
}

const WORLDS = [
  { id:1, name:'Nature',    img:'world_nature',    minLevel:1,  bgKey:'bg_nature'    },
  { id:2, name:'Graveyard', img:'world_graveyard', minLevel:26, bgKey:'bg_graveyard' },
  { id:3, name:'Winter',    img:'world_winter',    minLevel:51, bgKey:'bg_winter'    },
  { id:4, name:'Desert',    img:'world_desert',    minLevel:76, bgKey:'bg_desert'    },
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
    nameEl.textContent = i18n('w' + w.id);
    const progEl = document.createElement('div');
    progEl.className = 'world-prog';
    progEl.textContent = unlocked ? `${done}/10` : '🔒';

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
  document.getElementById('lvlSelTitle').textContent = i18n('w' + w.id).toUpperCase();

  // Set background
  const bg = document.getElementById('levelBG');
  if (bg && UI_IMGS[w.bgKey]) bg.style.backgroundImage = `url(${UI_IMGS[w.bgKey].src})`;

  buildLevelGrid(wid);
  showScreen('levelSelect');
}

function buildLevelGrid(wid) {
  const grid = document.getElementById('levelsGrid');
  grid.innerHTML = '';
  const startLv = (wid - 1) * 25 + 1;
  const endLv   = startLv + 24;

  for (let lv = startLv; lv <= endLv; lv++) {
    const worldUnlocked = GS.allWorlds && lv === startLv;
    const unlocked = worldUnlocked || GS.maxUnlocked >= lv;
    const done     = GS.maxUnlocked > lv;

    const btn = document.createElement('button');
    btn.className = `lv-btn ${done ? 'done' : unlocked ? 'unlocked' : 'locked'}`;

    if (unlocked) {
      btn.textContent = lv - startLv + 1;
      const _m = (GS.stars || {})[lv] || 0;
      if (_m) { const sp = document.createElement('span'); sp.className = 'lv-st'; sp.textContent = [1, 2, 4].map(b => (_m & b) ? '★' : '☆').join(''); btn.appendChild(sp); }
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
  secrets = []; movers = []; popups = [];
  lvStars = [false, false, false]; _powKey = '';
  const _hp = document.getElementById('hPow'); if (_hp) _hp.innerHTML = '';

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
  AMB.start(ld.theme);

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
        pickups.push({ x:x+2, y:y+Math.round(TS*0.6), w:TS-4, h:Math.round(TS*0.4), type:'spring', done:false,
                       tileX:x, tileBottom:y+TS, animT:-1, cool:0 });
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
    pickups.push({ x:bx, y:by, w:TS, h:TS, type:'breakable', done:false, hasHeart:b.hasHeart, hasCoin:b.hasCoin, hasItem:b.hasItem, col:b.c, row:b.r });
    solidTiles.push({ x:bx, y:by, w:TS, h:TS, type:T.GND, row:b.r, col:b.c, isBreakable:true, pickupIdx:pIdx });
  }

  // Ammo pickups
  const ammoSz = Math.round(TS * 0.55);
  for (const a of ammos) {
    const ax = a.c * TS + Math.round((TS - ammoSz) / 2);
    const ay = a.r * TS + Math.round((TS - ammoSz) / 2);
    pickups.push({ x:ax, y:ay, w:ammoSz, h:ammoSz, type:'ammo', done:false });
  }

  // Spike groups — صورة واحدة لكل مجموعة (النوع 1 أو 2 بالتناوب) + صندوق تصادم أصغر من الصورة
  for (const sg of (ld.spikeGroups || [])) {
    const file = (SPIKE_IMG[ld.theme] || SPIKE_IMG.nature)[(sg.v || 1) - 1];
    const asp  = SPIKE_ASPECT[file] || 2;
    const dw = sg.w * TS, dh = dw / asp, dx = sg.c * TS, gy = gndRow * TS;
    const hw = dw * 0.48, hh = dh * 0.5;
    pickups.push({ x: dx + (dw - hw) / 2, y: gy - hh, w: hw, h: hh, type:'spike', done:false,
                   file, dx, dy: gy - dh + 3, dw, dh });
  }

  // Goal flag (always visible at end)
  pickups.push({ x:goal.c*TS, y:(goal.r-1)*TS, w:TS, h:TS*2, type:'goal', done:false });
  castle = ld.castle ? { c: ld.castle.c } : null;

  // Enemies - تقليل 25% + إصلاح الطيران
  // حذف ثابت (كل رابع عدو) بدل العشوائي: نفس الأعداء في كل مرة تُعاد فيها المرحلة
  const filteredEnemies = enDefs.filter((e, i) => i === 0 || i % 4 !== 3);
  for (const e of filteredEnemies) {
    const sprData = getSpriteData(e.type);
    const canFly = sprData.fly;
    const actualFly = e.fly && canFly;
    enemies.push({
      x: e.c * TS, y: e.r * TS,
      vx: (e.dir || 1) * (actualFly ? 1.6 : 1.2),
      vy: 0,
      w: sprData.w, h: sprData.h,
      type: e.type,
      fly: actualFly,
      dir: e.dir || 1,
      dead: false,
      frame: 0, ft: 0,
      minX: (e.c - 6) * TS,
      maxX: (e.c + 6) * TS,
      onGnd: false,
      baseY: e.r * TS,
    });
  }

  // ── المناطق السرية + النجوم ──
  secrets = [];
  (ld.secrets || []).forEach((z, i) => {
    secrets.push({ id:i, x:z.c*TS, y:z.r*TS, w:z.w*TS, h:z.h*TS, gc:z.c, gr:z.r, gw:z.w, gh:z.h, revealed:false, a:1, cv:null,
                   seed:(z.c * 131 + i * 977 + ld.cols) >>> 0, theme:ld.theme });
    pickups.push({ x:z.starC*TS + 2, y:z.starR*TS + 2, w:28, h:28, type:'star', zone:i, done:false });
  });
  // ── عناصر (جواهر ...) ──
  for (const it of (ld.items || [])) pickups.push({ x:it.c*TS + 4, y:it.r*TS + 4, w:24, h:24, type:it.type, done:false });
  // ── منصات متحركة ──
  movers = (ld.movers || []).map(m => {
    const x0 = m.c * TS, x1 = (m.c + m.span - m.len) * TS;
    const t = { x:x0, y:m.r*TS, w:m.len*TS, h:TS, type:T.PLT, mover:true, row:m.r, col:m.c, x0, x1, ph:m.phase, sp:m.speed*0.025, dx:0 };
    solidTiles.push(t);
    return t;
  });

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
  const rawDt = (ts - lastT) / 16.67;
  const dt = (rawDt > 5 || lastT === 0) ? 1 : Math.min(rawDt, 3);
  lastT = ts;
  if (!paused) {
    if (gameStatus === 'playing') update(dt);
    else if (gameStatus === 'winwalk') updWinWalk(dt);
  }
  render();
  raf = requestAnimationFrame(loop);
}

function update(dt) {
  updMovers(dt);
  updPlayer(dt);
  updEnemies(dt);
  updBullets(dt);
  updCrumbles(dt);
  checkPickups();
  updSecrets(dt);
  updItems(dt);
  updParticles(dt);
  updCamera();
  updPowHUD();
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
  player._ride = null;
  collideY(player);

  // حفظ checkpoint عند الوقوف على الأرض الصلبة (ليس فوق فجوة)
  if (player.onGnd && !player.dead) {
    player._combo = 0;
    if (isSafeSpot()) { checkpoint.x = player.x; checkpoint.y = player.y; }
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

// موقع آمن للعودة: أرض دائمة (ليست بلاطة تنهار ولا حافة هوة) وبعيداً عن الأشواك
function isSafeSpot() {
  const ld = LEVELS[GS.curLevel];
  if (!ld || !ld.cells) return true;
  const fr = Math.floor((player.y + player.h + 2) / TS);
  if (fr < 0 || fr >= ld.rows) return false;
  const c0 = Math.floor((player.x + 6) / TS) - 1;
  const c1 = Math.floor((player.x + player.w - 6) / TS) + 1;
  for (let c = c0; c <= c1; c++) {
    if (c < 0 || c >= ld.cols) return false;
    const v = ld.cells[fr][c];
    if (v !== T.GND && v !== T.PLT) return false;
  }
  const mid = player.x + player.w / 2;
  for (const p of pickups) {
    if (p.type === 'spike' && !p.done && Math.abs(p.x + p.w / 2 - mid) < TS * 6) return false;
  }
  return true;
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
        obj._ride = t;
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
      GS.lives = Math.min(GS.lives + 1, 99);
      updHUD();
      SFX.play('heart');
      spawnHeartPopup(tile.x - camera.x + TS/2, tile.y);
    } else if (pk.hasItem) {
      // عنصر قوة (درع/مغناطيس) يطفو من الكتلة
      pickups.push({ x: tile.x + 4, y: tile.y, w:24, h:24, type: pk.hasItem, done:false, rise: 34 });
      SFX.synth('power');
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
  for (const p of pickups) if (p.type === 'spring') { if (p.cool > 0) p.cool--; if (p.animT >= 0) p.animT++; }

  // مغناطيس: يجذب العملات القريبة
  if (player.magnet > 0) {
    player.magnet--;
    const mx = player.x + player.w / 2, my = player.y + player.h / 2;
    for (const p of pickups) {
      if (p.done || p.type !== 'coin') continue;
      const dx = mx - (p.x + p.w / 2), dy = my - (p.y + p.h / 2), d = Math.hypot(dx, dy);
      if (d < 190 && d > 1) { p.x += dx / d * 7; p.y += dy / d * 7; }
    }
  }

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
    } else if (p.type === 'star') {
      if (!secrets[p.zone] || !secrets[p.zone].revealed) continue;   // مخفية حتى دخول المنطقة السرية
      p.done = true; collectStar(p);
    } else if (p.type === 'gem') {
      p.done = true; lvCoins += 10; GS.coins += 10; lvScore += 500;
      SFX.synth('gem'); addPopup(p.x + 12, p.y, '+500', '#4DD0E1'); sparkle(p.x + 12, p.y + 12, '#4DD0E1', 10);
      updHUD();
    } else if (p.type === 'magnet') {
      p.done = true; player.magnet = 900;
      SFX.synth('power'); addPopup(p.x + 12, p.y, 'MAGNET!', '#FF5252'); sparkle(p.x + 12, p.y + 12, '#FF5252', 10);
    } else if (p.type === 'shield') {
      p.done = true; player.shield = true;
      SFX.synth('power'); addPopup(p.x + 12, p.y, 'SHIELD!', '#64B5F6'); sparkle(p.x + 12, p.y + 12, '#64B5F6', 10);
    } else if (p.type === 'goal') {
      triggerWin();
      return;
    } else if (p.type === 'spike') {
      if (!player.inv) { spikeDeath(); return; }
    } else if (p.type === 'spring') {
      // Spring - bounce (مع فترة تهدئة حتى لا يتكرر الصوت في كل إطار)
      if (p.cool > 0) continue;
      p.cool = 18; p.animT = 0;
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
        player._combo = (player._combo || 0) + 1;
        const pts = 100 * Math.min(player._combo, 5);
        lvScore += pts;
        addPopup(e.x + e.w / 2, e.y, '+' + pts + (player._combo > 1 ? '  x' + player._combo : ''), player._combo > 1 ? '#FF9800' : '#FFFFFF');
        if (player._combo >= 2) SFX.synth('combo', player._combo);
        SFX.play('stomp');
        SFX.play('enemy_die', 0.6);
        playEnemyDeathSound(e.type);
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
  if (player.shield) { breakShield(); return; }
  SFX.play('hurt');
  player.inv  = true;
  player.invT = 120; // 120 frames ≈ 2 ثانية حصانة
  GS.lives = Math.max(0, GS.lives - 1); // لا تنخفض تحت الصفر أبداً
  updHUD();
  saveLocal();
  if (GS.lives <= 0) { killPlayer('Out of lives!'); }
}

// موت الأشواك: يخصم قلباً ويشغّل صوت الموت (لو بقيت قلوب يعود اللاعب لآخر نقطة)
function spikeDeath() {
  if (player.dead) return;
  if (player.shield) { breakShield(); player.vy = JSPD * 0.9; player.onGnd = false; return; }
  GS.lives = Math.max(0, GS.lives - 1);
  updHUD(); saveLocal();
  SFX.play(GS.lives > 0 ? 'lose' : 'hurt');   // عند 0 قلوب يُشغَّل صوت الخسارة من شاشة النهاية
  killPlayer(GS.lives > 0 ? 'Hit a spike!' : 'Out of lives!');
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

    // أصوات الأعداء أثناء الحركة
    if (!e.soundT) e.soundT = 60 + Math.random() * 120;
    e.soundT -= dt;
    if (e.soundT <= 0 && !e.dead) {
      e.soundT = 80 + Math.random() * 100;
      const screenX = e.x - camera.x;
      if (screenX > -100 && screenX < canvas.width + 100) {
        if (e.type.startsWith('spikebee')) {
          const v = ['spikebee','spikebee1','spikebee2','spikebee3','spikebee4'];
          SFX.play(v[Math.floor(Math.random()*v.length)], 0.4);
        } else if (e.type.startsWith('bat')) {
          const v = ['bat1','bat2','bat3'];
          SFX.play(v[Math.floor(Math.random()*v.length)], 0.4);
        } else if (e.type.startsWith('tuca')) {
          const v = ['tuca','tuca1','tuca2','tuca3'];
          SFX.play(v[Math.floor(Math.random()*v.length)], 0.4);
        }
      }
    }

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
      // Flying enemies - stay at fixed height, never fall into pits
      const targetY = e.baseY + Math.sin(Date.now() * 0.003 + e.x * 0.008) * 18;
      e.y += (targetY - e.y) * 0.08;
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

function playEnemyDeathSound(type) {
  if (type.startsWith('spikebee')) {
    const v = ['spikebee','spikebee1','spikebee2','spikebee3','spikebee4'];
    SFX.play(v[Math.floor(Math.random()*v.length)], 0.7);
  } else if (type.startsWith('bat')) {
    const v = ['bat1','bat2','bat3'];
    SFX.play(v[Math.floor(Math.random()*v.length)], 0.7);
  } else if (type.startsWith('tuca')) {
    const v = ['tuca','tuca1','tuca2','tuca3'];
    SFX.play(v[Math.floor(Math.random()*v.length)], 0.7);
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
    // الطلقة تمرّ فوق الأرض والمنصات؛ تتوقف فقط عند الكتل القابلة للكسر
    for (let ti = solidTiles.length - 1; ti >= 0; ti--) {
      const t = solidTiles[ti];
      if (t.isBreakable && overlaps(br, t)) {
        breakBlock(t);
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
        playEnemyDeathSound(e.type);
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
  // بدون تمرير عمودي، إلا عند الاقتراب من القصر: ننزل الكاميرا ليظهر كاملاً
  let ty = 0;
  if (castle && player.x > (ld.goal.c - 16) * TS) ty = Math.min(0, ld.gndRow * TS - (H - 34));
  camera.y += (ty - camera.y) * 0.06;
  if (Math.abs(ty - camera.y) < 0.5) camera.y = ty;
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
  drawMovers();
  drawPickups();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawSecretCovers();
  drawParticles();
  drawPopups();
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
  const pitTop   = ld.gndRow * TS - camera.y;   // يتبع الكاميرا عند نزولها قرب القصر
  const pitH     = mapH - ld.gndRow * TS + TS * 4;

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
    if (t.mover) continue;   // تُرسم في drawMovers
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
    const topExposed = !(isGnd(above) || secretSolid(r-1, c));
    const botExposed = !(isGnd(below) || secretSolid(r+1, c));
    const lftExposed = !(isGnd(left)  || secretSolid(r, c-1));
    const rgtExposed = !(isGnd(right) || secretSolid(r, c+1));

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
      const sImg = PROPS[p.file];
      if (p.dw && imgOK(sImg)) {
        ctx.drawImage(sImg, p.dx, p.dy, p.dw, p.dh);
      } else {
        // بديل برمجي إن لم تُحمَّل الصورة
        ctx.fillStyle = '#FF1744';
        const n = Math.max(1, Math.round((p.dw || p.w) / TS));
        const x0 = p.dx !== undefined ? p.dx : px, tw = (p.dw || p.w) / n;
        for (let k = 0; k < n; k++) {
          ctx.beginPath();
          ctx.moveTo(x0 + k * tw, p.y + p.h);
          ctx.lineTo(x0 + k * tw + tw / 2, p.y - p.h * 0.3);
          ctx.lineTo(x0 + (k + 1) * tw, p.y + p.h);
          ctx.closePath(); ctx.fill();
        }
      }
    } else if (p.type === 'star' || p.type === 'gem' || p.type === 'magnet' || p.type === 'shield') {
      if (p.type === 'star' && !(secrets[p.zone] && secrets[p.zone].revealed)) continue;
      drawItemPick(p);
    } else if (p.type === 'spring') {
      drawSpring(p);
    } else if (p.type === 'breakable') {
      // Already rendered in drawTiles via solidTiles
    }
  }
}

// ── SPRING (صورة مخصصة + حركة انضغاط/امتداد) ──
function drawSpring(p) {
  let file = SPRING_REST;
  if (p.animT >= 0) {
    const idx = Math.floor(p.animT / 3);
    if (idx < SPRING_FRAMES.length) file = SPRING_FRAMES[idx]; else p.animT = -1;
  }
  const sp = springSprite(file);
  if (!sp) {
    ctx.fillStyle = '#4CAF50'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#8BC34A'; ctx.fillRect(p.x + 2, p.y, p.w - 4, p.h / 2);
    return;
  }
  const sc = (TS * 1.15) / sp.baseW;
  const dw = sp.bb.w * sc, dh = sp.bb.h * sc;
  ctx.drawImage(sp.img, sp.bb.x, sp.bb.y, sp.bb.w, sp.bb.h,
                p.tileX + TS / 2 - dw / 2, p.tileBottom - dh + 2, dw, dh);
}

// ── CASTLE ──
// الباب بحجم الشخصية تقريباً (100px) ما دامت الشاشة تتسع، وإلا يُصغَّر ليبقى القصر كاملاً
function castleMetrics() {
  if (!castle) return null;
  const ld = LEVELS[GS.curLevel];
  const cfg = CASTLE[ld.theme] || CASTLE.nature;
  const img = PROPS[cfg.file];
  const H = parseInt(canvas.style.height) || canvas.height;
  const asp = imgOK(img) ? img.naturalWidth / img.naturalHeight : 1.5;
  const ch = Math.min(100 / cfg.doorH, H - 38);
  const cw = ch * asp;
  const gy = ld.gndRow * TS;
  const doorX = castle.c * TS + TS / 2;
  return { cfg, img, ch, cw, doorX, x: doorX - cw * cfg.doorX, y: gy + ch * cfg.base - ch, gy };
}
function drawCastle() {
  const m = castleMetrics();
  if (!m) return;
  const W = parseInt(canvas.style.width) || canvas.width;
  if (m.x - camera.x > W || m.x + m.cw - camera.x < 0) return;
  if (imgOK(m.img)) {
    ctx.drawImage(m.img, m.x, m.y, m.cw, m.ch);
  } else {
    // بديل برمجي بسيط
    ctx.fillStyle = '#8D6E63'; ctx.fillRect(m.x + m.cw * 0.2, m.y + m.ch * 0.35, m.cw * 0.6, m.ch * 0.65);
    ctx.fillStyle = '#6D4C41'; ctx.fillRect(m.x + m.cw * 0.12, m.y + m.ch * 0.2, m.cw * 0.14, m.ch * 0.8);
    ctx.fillRect(m.x + m.cw * 0.74, m.y + m.ch * 0.2, m.cw * 0.14, m.ch * 0.8);
    ctx.fillStyle = '#212121';
    const dh = m.ch * m.cfg.doorH, dw = dh * 0.6;
    ctx.fillRect(m.doorX - dw / 2, m.gy - dh, dw, dh);
  }
}

// ── DRAW DECORATIVE OBJECTS ──
// الديكور يُرسم في إحداثيات العالم (world coords) داخل ctx.save/translate
function drawDecos() {
  drawCastle();
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
  if (player.alpha !== undefined && player.alpha < 1) {
    ctx.save(); ctx.globalAlpha = Math.max(0, player.alpha);
    _drawPlayerInner();
    ctx.restore();
  } else _drawPlayerInner();
  if (!player.dead) drawShieldBubble();
}
function drawShieldBubble() {
  if (!player.shield) return;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2, t = Date.now() * 0.005;
  const r = 66 + Math.sin(t) * 2.5;
  const g = ctx.createRadialGradient(cx - 14, cy - 20, 8, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.75, 'rgba(100,181,246,0.20)'); g.addColorStop(1, 'rgba(100,181,246,0.55)');
  ctx.save();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(190,225,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function _drawPlayerInner() {
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
  el.style.top  = (screenY - camera.y) + 'px';
  wrapper.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function spawnCoinParticle(screenX, screenY) {
  const el = document.createElement('div');
  el.className = 'coin-popup';
  el.textContent = '+50';
  el.style.cssText = `position:absolute;left:${screenX+camera.x}px;top:${screenY-camera.y}px;color:#FFD700;font-size:16px;font-weight:900;pointer-events:none;z-index:30;animation:coinPop .8s ease-out forwards;`;
  wrapper.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ── CONTROLS ──
// ══════════════════════════════════════════════════════
//  أنظمة جديدة: مناطق سرية • نجوم • جواهر • درع • مغناطيس
//  منصات متحركة • نقاط عائمة • كومبو
// ══════════════════════════════════════════════════════
function addPopup(x, y, text, color) { popups.push({ x, y, text, color: color || '#fff', life: 60 }); }

function sparkle(x, y, color, n) {
  for (let i = 0; i < (n || 10); i++) {
    const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3.5;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, size: 3 + Math.random() * 4,
                     color, life: 28 + Math.random() * 16, maxLife: 44 });
  }
}

function collectStar(p) {
  lvStars[p.zone] = true;
  lvScore += 1000; lvCoins += 10; GS.coins += 10;
  SFX.synth('star');
  addPopup(p.x + 14, p.y - 6, '★ +1000', '#FFEB3B');
  sparkle(p.x + 14, p.y + 14, '#FFEB3B', 18);
  updHUD();
}

function breakShield() {
  player.shield = false; player.inv = true; player.invT = 90;
  SFX.synth('shield_break');
  addPopup(player.x + player.w / 2, player.y - 10, 'BLOCKED!', '#90CAF9');
  sparkle(player.x + player.w / 2, player.y + player.h / 2, '#90CAF9', 16);
}

function updMovers(dt) {
  for (const m of movers) {
    m.ph += m.sp * dt;
    const nx = m.x0 + (m.x1 - m.x0) * (0.5 - 0.5 * Math.cos(m.ph));
    m.dx = nx - m.x;
    m.x = nx;
    if (player._ride === m && !player.dead) player.x += m.dx;   // يحمل اللاعب معه
  }
}

function updSecrets(dt) {
  if (player.dead) return;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  for (const z of secrets) {
    if (!z.revealed) {
      if (cx > z.x && cx < z.x + z.w && cy > z.y && cy < z.y + z.h - 45) {
        z.revealed = true;
        SFX.synth('secret');
        addPopup(cx, player.y - 24, 'SECRET AREA!', '#FFE082');
        for (let i = 0; i < 14; i++) sparkle(z.x + Math.random() * z.w, z.y + Math.random() * z.h, '#FFF59D', 1);
      }
    } else if (z.a > 0) z.a = Math.max(0, z.a - dt / 30);
  }
}

function updItems(dt) {
  for (const p of pickups) if (p.rise > 0 && !p.done) { p.y -= 1.5 * dt; p.rise -= 1.5 * dt; }
  for (let i = popups.length - 1; i >= 0; i--) {
    const q = popups[i]; q.y -= 0.7 * dt; q.life -= dt;
    if (q.life <= 0) popups.splice(i, 1);
  }
}

function updPowHUD() {
  const el = document.getElementById('hPow'); if (!el) return;
  const m = player.magnet > 0 ? Math.ceil(player.magnet / 60) : 0, sh = !!player.shield;
  const key = m + '|' + sh;
  if (key === _powKey) return;
  _powKey = key;
  el.innerHTML = (m ? `<div class="pw">🧲 ${m}s</div>` : '') + (sh ? '<div class="pw">🛡️</div>' : '');
}

// ── رسم الغطاء النباتي للمنطقة السرية (يُرسم مرة واحدة في canvas مؤقت) ──
const COVER_COL = {
  nature:    ['#1B5E20', '#2E7D32', '#66BB6A'],
  graveyard: ['#263238', '#455A64', '#78909C'],
  winter:    ['#5C8FC9', '#A9D1F5', '#F4FAFF'],
  desert:    ['#BF360C', '#E65100', '#FFB74D'],
};
// هل الخلية (صف، عمود) داخل غرفة سرية ما زال غطاؤها ظاهراً؟ (تُعامل كأرض صلبة في الرسم فقط)
function secretSolid(r, c) {
  for (const z of secrets) {
    if (z.a > 0.5 && c >= z.gc && c < z.gc + z.gw && r >= z.gr && r < z.gr + z.gh) return true;
  }
  return false;
}
// الغطاء = نفس بلاطات التراب المحيطة، فيبدو الجدار مصمتاً تماماً حتى يدخله اللاعب
function makeCover(z) {
  const ld = LEVELS[GS.curLevel], theme = ld.theme;
  const tImgs = TILE_IMGS[theme] || {}, TV = TILE_VARIANTS[theme] || {};
  const cv = document.createElement('canvas');
  cv.width = z.w; cv.height = z.h;
  const g = cv.getContext('2d');
  const inZone = (r, c) => c >= z.gc && c < z.gc + z.gw && r >= z.gr && r < z.gr + z.gh;
  const solid = (r, c) => {
    if (inZone(r, c)) return true;
    if (r < 0 || r >= ld.rows || c < 0 || c >= ld.cols) return false;
    const v = ld.cells[r][c];
    return v === T.GND || v === T.PLT;
  };
  const fallback = { nature:'#5D4037', graveyard:'#37474F', winter:'#5C6BC0', desert:'#8D6E63' }[theme] || '#5D4037';
  for (let rr = 0; rr < z.gh; rr++) for (let cc = 0; cc < z.gw; cc++) {
    const r = z.gr + rr, c = z.gc + cc;
    const topE = !solid(r - 1, c), botE = !solid(r + 1, c), lftE = !solid(r, c - 1), rgtE = !solid(r, c + 1);
    let v;
    if (topE && lftE && !rgtE) v = TV.gnd_top_left;
    else if (topE && rgtE && !lftE) v = TV.gnd_top_right;
    else if (topE) v = TV.gnd_top_mid;
    else if (botE && lftE) v = TV.gnd_bot_left;
    else if (botE && rgtE) v = TV.gnd_bot_right;
    else if (botE) v = TV.gnd_bot_mid;
    else if (lftE) v = TV.gnd_mid_left;
    else if (rgtE) v = TV.gnd_mid_right;
    else v = TV.gnd_mid_fill;
    const img = tImgs[v];
    if (imgOK(img)) g.drawImage(img, cc * TS, rr * TS, TS, TS);
    else { g.fillStyle = fallback; g.fillRect(cc * TS, rr * TS, TS, TS); g.strokeStyle = 'rgba(0,0,0,0.1)'; g.strokeRect(cc * TS, rr * TS, TS, TS); }
  }
  z.cv = cv; z.pad = 0;
}
function drawSecretCovers() {
  const W = parseInt(canvas.style.width) || canvas.width;
  const tm = Date.now() * 0.004;
  for (const z of secrets) {
    if (z.a <= 0) continue;
    if (z.x - camera.x > W + 40 || z.x + z.w - camera.x < -40) continue;
    if (!z.cv) makeCover(z);
    ctx.globalAlpha = z.a;
    ctx.drawImage(z.cv, z.x - z.pad, z.y - z.pad);
    // لمعة خفيفة تلمّح بوجود سرّ
    if (!z.revealed) {
      for (let i = 0; i < 2; i++) {
        const k = (Math.sin(tm + z.id * 2 + i * 3) + 1) / 2;
        const gx = z.x + z.w * (0.25 + 0.5 * i), gy = z.y + z.h * (0.35 + 0.25 * i), r = 3 + k * 6;
        ctx.fillStyle = `rgba(255,255,255,${0.2 + k * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(gx, gy - r); ctx.lineTo(gx + r * 0.3, gy - r * 0.3); ctx.lineTo(gx + r, gy); ctx.lineTo(gx + r * 0.3, gy + r * 0.3);
        ctx.lineTo(gx, gy + r); ctx.lineTo(gx - r * 0.3, gy + r * 0.3); ctx.lineTo(gx - r, gy); ctx.lineTo(gx - r * 0.3, gy - r * 0.3);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ── المنصات المتحركة: صورة float_platform.png أو رسم برمجي ──
function drawMovers() {
  const W = parseInt(canvas.style.width) || canvas.width;
  const theme = LEVELS[GS.curLevel]?.theme || 'nature';
  const pc = { nature:['#8D6E63','#4CAF50'], graveyard:['#546E7A','#7E57C2'], winter:['#90CAF9','#E3F2FD'], desert:['#D7A86E','#FF8F00'] }[theme];
  for (const m of movers) {
    if (m.x - camera.x > W + 40 || m.x + m.w - camera.x < -40) continue;
    const img = PROPS['float_platform.png'];
    if (imgOK(img)) {
      ctx.drawImage(img, m.x, m.y - 2, m.w, Math.round(m.w * img.naturalHeight / img.naturalWidth));
    } else {
      ctx.fillStyle = pc[0]; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(m.x, m.y, m.w, 20, 8); else ctx.rect(m.x, m.y, m.w, 20); ctx.fill();
      ctx.fillStyle = pc[1]; ctx.fillRect(m.x + 3, m.y, m.w - 6, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(m.x + 4, m.y + 14, m.w - 8, 4);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#FFD54F'; ctx.beginPath(); ctx.arc(m.x + 14 + i * (m.w - 28) / 2, m.y + 11, 2.5, 0, Math.PI * 2); ctx.fill(); }
      const f = 4 + Math.sin(Date.now() * 0.02) * 2;
      ctx.fillStyle = 'rgba(255,193,7,0.6)'; ctx.fillRect(m.x + m.w / 2 - 6, m.y + 20, 12, f);
    }
  }
}

const ITEM_FILES = { star:'star_secret.png', gem:'gem.png', magnet:'magnet.png', shield:'shield.png' };
function _poly(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
function drawItemPick(p) {
  const tm = Date.now() * 0.004 + p.x * 0.02;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2 + Math.sin(tm) * 3;
  const sz = p.type === 'star' ? 40 : 32;
  const gc = { star:'255,235,59', gem:'77,208,225', magnet:'255,82,82', shield:'100,181,246' }[p.type];
  const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, sz);
  gr.addColorStop(0, `rgba(${gc},0.55)`); gr.addColorStop(1, `rgba(${gc},0)`);
  ctx.fillStyle = gr; ctx.fillRect(cx - sz, cy - sz, sz * 2, sz * 2);
  const img = PROPS[ITEM_FILES[p.type]];
  if (imgOK(img)) { ctx.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz); return; }
  ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  if (p.type === 'star') {
    ctx.rotate(Math.sin(tm) * 0.15);
    const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 8 : 19, a = -Math.PI / 2 + i * Math.PI / 5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    _poly(pts); ctx.fillStyle = '#FFD600'; ctx.fill(); ctx.stroke();
    _poly(pts.map(([x, y]) => [x * 0.5, y * 0.5])); ctx.fillStyle = '#FFF59D'; ctx.fill();
  } else if (p.type === 'gem') {
    ctx.scale(Math.abs(Math.cos(tm * 0.8)) * 0.4 + 0.6, 1);
    _poly([[0, -14], [12, -4], [0, 14], [-12, -4]]); ctx.fillStyle = '#26C6DA'; ctx.fill(); ctx.stroke();
    _poly([[0, -14], [12, -4], [0, -2], [-12, -4]]); ctx.fillStyle = '#B2EBF2'; ctx.fill();
  } else if (p.type === 'magnet') {
    ctx.lineWidth = 7; ctx.lineCap = 'butt';
    ctx.strokeStyle = '#E53935'; ctx.beginPath(); ctx.arc(0, 2, 9, Math.PI, 0); ctx.lineTo(9, 12); ctx.moveTo(-9, 2); ctx.lineTo(-9, 12); ctx.stroke();
    ctx.strokeStyle = '#ECEFF1'; ctx.beginPath(); ctx.moveTo(-9, 12); ctx.lineTo(-9, 16); ctx.moveTo(9, 12); ctx.lineTo(9, 16); ctx.stroke();
  } else {
    _poly([[0, -15], [13, -9], [11, 6], [0, 16], [-11, 6], [-13, -9]]); ctx.fillStyle = '#42A5F5'; ctx.fill(); ctx.stroke();
    _poly([[0, -10], [8, -6], [7, 4], [0, 11]]); ctx.fillStyle = '#BBDEFB'; ctx.fill();
  }
  ctx.restore();
}

function drawPopups() {
  ctx.save(); ctx.font = '800 16px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  for (const q of popups) {
    ctx.globalAlpha = Math.min(1, q.life / 25);
    ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y);
  }
  ctx.restore();
}

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
  for (let i = 0; i < 3; i++) { const e = document.getElementById('hSt' + i); if (e) e.classList.toggle('on', !!lvStars[i]); }
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
// لمس العلم: إن وُجد قصر تمشي الشخصية تلقائياً نحو الباب وتختفي أمامه، ثم تظهر شاشة الفوز
function triggerWin() {
  if (gameStatus !== 'playing') return;
  if (castle) { startWinWalk(); return; }
  finishWin(true);
}

function startWinWalk() {
  gameStatus = 'winwalk';
  SFX.play('arrival');
  clearInterval(timerInt);
  try { AMB.stop(); } catch (e) {}
  bullets = [];
  player.inv = false; player.invT = 0;
  player.dead = false;
  player.alpha = 1;
  player.fading = false;
  keys.left = false; keys.right = false;
}

function updWinWalk(dt) {
  const m = castleMetrics();
  const doorX = m ? m.doorX : player.x + 400;
  const cx = player.x + player.w / 2;
  const spd = PSPD * 0.85;

  if (cx >= doorX - 10) player.fading = true;
  player.dir = 1;
  player.vx = player.fading ? spd * 0.5 : spd;
  player.state = player.onGnd ? 'run' : 'jump';

  player.x += player.vx * dt;
  collideX(player);
  player.vy += GRAV * dt;
  if (player.vy > MAX_VY) player.vy = MAX_VY;
  player._prevY = player.y;
  player.y += player.vy * dt;
  player.onGnd = false;
  collideY(player);

  // حركة الإطارات
  const animRates = { idle:10, run:5, jump:8 };
  const animCounts = { idle:10, run:8, jump:10 };
  player.ft += dt;
  if (player.ft >= (animRates[player.state] || 10)) {
    player.ft = 0;
    player.frame = (player.frame + 1) % (animCounts[player.state] || 10);
  }

  if (player.fading) {
    player.alpha -= 0.035 * dt;
    if (player.alpha <= 0) { player.alpha = 0; finishWin(false); return; }
  }
  updParticles(dt);
  updCamera();
}

function finishWin(playArrival) {
  gameStatus = 'win';
  try { AMB.stop(); } catch (e) {}
  if (playArrival) SFX.play('arrival');
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
  // النجوم السرية: حفظ الأفضل + مكافأة قلب عند جمع الثلاث لأول مرة
  GS.stars = GS.stars || {};
  const _mask = (lvStars[0] ? 1 : 0) | (lvStars[1] ? 2 : 0) | (lvStars[2] ? 4 : 0);
  const _prev = GS.stars[GS.curLevel] || 0;
  GS.stars[GS.curLevel] = _prev | _mask;
  let _bonusTxt = '';
  if ((_prev | _mask) === 7 && _prev !== 7) { GS.lives = Math.min(GS.lives + 1, 99); _bonusTxt = '  |  ❤️ +1'; }
  saveLocal(); cloudSave();

  const pct = lvTimer / (LEVELS[GS.curLevel].time || 120);
  document.getElementById('winStars').textContent = lvStars.map(f => f ? '⭐' : '☆').join('');
  document.getElementById('winScore').textContent = `🏅 ${lvScore}  |  🪙 ${lvCoins}${_bonusTxt}`;

  setTimeout(() => showScreen('winScreen'), 500);
}

function triggerLose(reason) {
  if (gameStatus === 'lose') return;
  gameStatus = 'lose';
  AMB.stop();
  SFX.play('lose');
  clearInterval(timerInt);
  document.getElementById('loseReason').textContent = (reason ? i18nText(reason) : '🔁');
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
  if (GS.lives < 1) GS.lives = 3;   // أعد 3 قلوب فقط إذا نفدت (يحافظ على القلوب المشتراة)
  setTimeout(() => startLevel(GS.curLevel), 50);
}

// ── REVIVE (100 coins) ──
function revivePlayer() {
  const REVIVE_COST = 100;
  if (GS.coins < REVIVE_COST) {
    const btn = document.getElementById('reviveBtn');
    if (btn) {
      btn.style.background = '#FF4444';
      btn.querySelector('span').textContent = '🪙 100 ✖';
      setTimeout(() => {
        btn.style.background = '';
        btn.querySelector('span').textContent = i18n('revive');
      }, 1200);
    }
    SFX.play('hurt');
    return;
  }
  GS.coins -= REVIVE_COST;
  GS.lives = Math.max(GS.lives, 1); // أعطِ قلباً واحداً على الأقل
  updHUD();
  saveLocal();
  SFX.play('heart');

  // أخفِ شاشة الخسارة
  const loseScreen = document.getElementById('loseScreen');
  if (loseScreen) loseScreen.classList.remove('show', 'active');

  // أعد الشخصية في مكان الموت مباشرة بدون إعادة بناء المستوى
  gameStatus = 'playing';
  player.x    = reviveCheckpoint.x;
  player.y    = reviveCheckpoint.y;
  player.vx   = 0;
  player.vy   = 0;
  player.dead  = false;
  player.state = 'idle';
  player.frame = 0;
  player.ft    = 0;
  player.inv   = true;
  player.invT  = 180; // 3 ثوانٍ حصانة بعد الإحياء
  player._spawnFrames = 60;

  // أعد تشغيل حلقة اللعبة إذا توقفت
  lastT = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
  startTimer(lvTimer);
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
  keys.left = false; keys.right = false;   // لا يستمر اللاعب بالجري أثناء/بعد الإيقاف
  AMB.pause();
  clearInterval(timerInt);
  document.getElementById('pauseOv').classList.add('show');
}

function resumeGame() {
  paused = false;
  AMB.resume();
  document.getElementById('pauseOv').classList.remove('show');
  lastT = 0;
  if (player && !player.dead) { player.inv = true; player.invT = 180; }
  startTimer(lvTimer);
}

// ── SHOP ──
function openShop() {
  shopFrom = document.querySelector('.screen.active')?.id || 'splash';
  showScreen('shopScreen');
}
function closeShop() {
  // إذا فتح المتجر من شاشة الخسارة، تحقق هل لديه ما يكفي للإحياء
  if (shopFrom === 'loseScreen') {
    showScreen('loseScreen');
    return;
  }
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
  body.innerHTML = '<div class="lb-loading"><div class="lb-spinner"></div><span>' + i18n('loading0') + '</span></div>';

  // عمود الترتيب حسب التبويب
  const orderCol = tab === 'level' ? 'max_level' : 'coins';
  const label    = tab === 'level' ? 'Level'      : 'Coins';

  try {
    const out = await _gameApi({ action: 'leaderboard', tab });
    const rows = out.rows;

    if (!rows || rows.length === 0) {
      body.innerHTML = '<div class="lb-empty">' + i18n('lbEmpty') + '</div>';
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
  document.getElementById('lbMyDetail').textContent = `Lv ${GS.maxUnlocked} · 🪙 ${GS.coins.toLocaleString()}`;
  document.getElementById('lbMyScore').textContent  = `Lv ${GS.maxUnlocked}`;

  // جلب ترتيب اللاعب الحالي
  _fetchMyRank();
}

async function _fetchMyRank() {
  if (!GS.piUser) return;
  try {
    // عدد اللاعبين الذين لديهم max_level أعلى
    const out = await _gameApi({ action: 'rank', maxLevel: GS.maxUnlocked });
    const el = document.getElementById('lbMyRankNum');
    if (el && out && typeof out.higher === 'number') el.textContent = `#${out.higher + 1}`;
  } catch(e) {}
}

// ── INIT ──
// ── حفظ الأصول على الجهاز (Cache) حتى لا تُحمَّل في كل مرة ──
function _saveAssetsOnDevice() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();   // اطلب عدم حذفها تلقائياً
    if (!('serviceWorker' in navigator)) return;
    const urls = Assets.log().concat(SFX.urls());
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) reg.active.postMessage({ type: 'precache', urls, version: window.ASSETS_VERSION || '' });
    }).catch(() => {});
  } catch (e) {}
}

// Pi SDK يُحمَّل بدون حجب الصفحة (إذا تأخر أو فشل لا تتوقف اللعبة)
let _piInited = false;
let _piSdkPromise = null;

// داخل بيئة الاختبار (sandbox.minepi.com) يجب sandbox:true. للتجربة اليدوية: أضف ?sandbox=1 أو ?sandbox=0 للرابط.
function _inPiSandbox() {
  try {
    const q = new URLSearchParams(window.location.search).get('sandbox');
    if (q === '1' || q === 'true')  return true;
    if (q === '0' || q === 'false') return false;
  } catch(e) {}
  try {
    const a = window.location.ancestorOrigins;
    if (a && a.length) return Array.from(a).some(o => o.indexOf('sandbox.minepi.com') !== -1);
  } catch(e) {}
  return (document.referrer || '').indexOf('sandbox.minepi.com') !== -1;
}

let _piInitError = null;
function _initPi(force) {
  if (typeof Pi === 'undefined') return false;
  if (_piInited && !force) return true;
  try {
    Pi.init({ version: '2.0', sandbox: _inPiSandbox() });
    _piInited = true; _piInitError = null;
    return true;
  } catch(e) {
    _piInited = false;
    _piInitError = (e && e.message) || String(e);
    console.error('[Pi] init failed:', e);
    return false;
  }
}

function _loadPiSdk() {
  if (_piSdkPromise) return _piSdkPromise;
  _piSdkPromise = new Promise(res => {
    if (typeof Pi !== 'undefined') { _initPi(); return res(); }
    const s = document.createElement('script');
    s.src = 'https://sdk.minepi.com/pi-sdk.js';
    s.async = true;
    s.onload  = () => { _initPi(); res(); };
    s.onerror = () => res();
    document.head.appendChild(s);
    setTimeout(res, 8000);            // لا ننتظر أكثر من 8 ثوانٍ
  });
  return _piSdkPromise;
}

// Shows the list of missing REQUIRED files and waits for the player: Retry or Continue.
function _showLoadReport(failed) {
  return new Promise(resolve => {
    const box = document.getElementById('ldReport');
    const list = document.getElementById('ldReportList');
    const title = document.getElementById('ldReportTitle');
    if (!box) return resolve('continue');
    title.textContent = '⚠️ ' + failed.length + ' game file(s) could not be loaded:';
    list.textContent = failed.slice(0, 14).join('\n') + (failed.length > 14 ? '\n… +' + (failed.length - 14) + ' more' : '');
    box.style.display = 'block';
    const done = which => { box.style.display = 'none'; resolve(which); };
    document.getElementById('ldRetry').onclick = () => done('retry');
    document.getElementById('ldContinue').onclick = () => done('continue');
  });
}

async function _boot() {
  const lbg = document.getElementById('loadBG');

  ldProgress(5, 'Starting...');
  _loadPiSdk().then(() => { try { _updateBuildInfo(); } catch(e) {} });   // في الخلفية — لا ننتظره

  // ── تحميل كل الأصول؛ لا تبدأ اللعبة قبل اكتمالها ──
  ldProgress(10, 'Loading assets... 0%');
  const onProgress = (done, total) => {
    const pct = Math.round(done / total * 100);
    ldProgress(10 + pct * 0.8, 'Loading assets... ' + pct + '%');
  };
  let res = await Assets.loadAll(onProgress);
  if (res.failed.length) {                       // محاولة ثانية تلقائية (قد يكون انقطاعاً عابراً)
    ldProgress(10, 'Retrying...');
    res = await Assets.loadAll(onProgress);
  }
  while (res.failed.length) {
    console.warn('[Assets] missing files:', res.failed);
    // صور البلاطات الناقصة لها بديل مرسوم برمجياً → لا نوقف اللاعب بسببها
    const important = res.failed.filter(f => !/(^|\/)assets\/tiles\//.test(f));
    if (!important.length) break;
    const choice = await _showLoadReport(important);
    if (choice === 'continue') break;
    ldProgress(10, 'Retrying...');
    res = await Assets.loadAll(onProgress);
  }

  ldProgress(93, 'Loading sounds...');
  try { await SFX.preloadAll(); } catch(e) {}

  ldProgress(97, 'Preparing levels...');
  loadLocal();

  if (lbg && UI_IMGS.splash) {
    lbg.style.backgroundImage = `url(${UI_IMGS.splash.src})`;
    lbg.classList.add('show');
  }

  ldProgress(100, 'Ready!');
  await new Promise(r => setTimeout(r, 400));

  // الدخول عبر Pi Network (أو اللعب كضيف)
  _updatePiUI();
  showScreen('piLogin');
  _saveAssetsOnDevice();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
else _boot();

function ldProgress(p, txt) {
  const bar = document.getElementById('ldBar');
  const el  = document.getElementById('ldTxt');
  if (bar) bar.style.width = p + '%';
  if (el)  el.textContent = p >= 100 ? i18n('ready') : i18n('loading', { p: Math.round(p) });
}

// ── PREVENT SCROLL / CONTEXT MENU ──
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => { if (gameStatus === 'playing') setupRotation(); });

// Unlock AudioContext on first user interaction (required by browsers)
const _sfxUnlock = () => { SFX.unlock(); document.removeEventListener('touchstart', _sfxUnlock); document.removeEventListener('mousedown', _sfxUnlock); };
document.addEventListener('touchstart', _sfxUnlock, { once: true });
document.addEventListener('mousedown', _sfxUnlock, { once: true });
