'use strict';

const WORLD_THEMES = ['nature','graveyard','winter','desert'];
const WORLD_TIMES  = [180, 210, 240, 270];

const TILE_VARIANTS = {
  nature:    { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
  graveyard: { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
  winter:    { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
  desert:    { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
};

// الأعداء الـ 13 موزّعون على 4 عوالم
// bat1-3: طائر 60x60 | snail1-3: أرضي 60x60 | spikebee1-4: طائر كبير | tuca1-3: أرضي كبير
const WORLD_ENEMIES = {
  nature:    { walker:'snail1', flyer:'bat1',      boss:'tuca1'     },
  graveyard: { walker:'snail2', flyer:'bat2',      boss:'spikebee1' },
  winter:    { walker:'tuca2',  flyer:'spikebee2', boss:'bat3'      },
  desert:    { walker:'tuca3',  flyer:'spikebee3', boss:'snail3'    },
  extra: {
    nature:    ['snail1','bat1','tuca1','spikebee4'],
    graveyard: ['snail2','bat2','spikebee1','tuca1'],
    winter:    ['tuca2','spikebee2','bat3','snail3'],
    desert:    ['tuca3','spikebee3','snail3','bat1'],
  }
};

const WORLD_DECOS = {
  nature:    ['Tree_1.png','Tree_2.png','Tree_3.png','Bush__1_.png','Bush__2_.png','Bush__3_.png',
              'Mushroom_1.png','Mushroom_2.png','Mushroom_3.png','Flower_1.png','Flower_2.png','Flower_3.png',
              'Stone.png','Stone_2.png','Crate.png','Grass_1.png'],
  graveyard: ['Tree.png','Dead_Tree.png','TombStone__1_.png','TombStone__2_.png','TombStone__3_.png',
              'DeadBush.png','Bush__1_.png','Bush__2_.png','Crate.png','Bone.png','Skull.png','Candle.png'],
  winter:    ['Tree_1.png','Tree_2.png','Tree_3.png','SnowMan.png','Stone.png','IceBox.png',
              'Crystal.png','Crystal_2.png','Crate.png','IcePillar.png','Snowflake.png','Bush__1_.png'],
  desert:    ['Cactus__1_.png','Cactus__2_.png','Cactus__3_.png','Tree.png','Dead_Tree.png',
              'Bush__1_.png','Bush__2_.png','Stone.png','Stone_2.png','Crate.png',
              'Skull.png','Barrel.png','Bone.png'],
};

function rng(seed) {
  let s = seed >>> 0;
  const f = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 6; i++) f(); // warm-up
  return f;
}

const G = 9; // GND_TOP: أول صف أرض
const isFlyerType = t => t.startsWith('bat') || t.startsWith('spikebee');

// قيم الخلايا (تطابق T في game.js)
const CELL = { AIR:0, GND:1, PLT:2, SPIKE:8, SPRING:10, CRUMBLE:11 };

// ══════════════════════════════════════════════════════════════
//  قواعد الفيزياء المستخدمة في التصميم (اللاعب 76×100، TS=32)
//  • أقصى ارتفاع قفز ≈ 4.1 بلاطة → درجات التسلق ≤ 3
//  • أقصى مسافة قفز ≈ 5 بلاطات → الفجوات البسيطة ≤ 5
//  • النابض يرفع ≈ 8 بلاطات
//  • كتلة الكسر فوق سطح بالصف S تُوضع في الصف S-5 (لا تعيق المشي)
// ══════════════════════════════════════════════════════════════

// ───────── أدوات مساعدة ─────────
const mk = () => ({ p:[], en:[], co:[], ga:[], br:[], sp:[], spr:[], cr:[], hl:[], am:[], w:30 });
const W_ = (x,k,c,d) => k.en.push({ type:x.W(), c, r:G-1, fly:false, dir:d||(x.rand()<.5?1:-1) });
const F_ = (x,k,c,r,d) => k.en.push({ type:x.F(), c, r, fly:true, dir:d||(x.rand()<.5?1:-1) });
const coinsH = (k,c0,n,r,step) => { for (let i=0;i<n;i++) k.co.push({c:c0+i*(step||1), r}); };
const arc = (k,c0,len,r,h) => { for (let i=0;i<len;i++) k.co.push({c:c0+i, r:r-Math.round(Math.sin(Math.PI*(i+.5)/len)*h)}); };
const plat = (k,c,r,len,coins) => { k.p.push({c,r,len}); if (coins!==false) coinsH(k,c,len,r-1); };
const brk = (k,c,r,heart) => k.br.push({c,r,hasHeart:!!heart});

// ═════════ القطع (chunks) — عرض كل قطعة 30 عموداً ═════════

// أرض مفتوحة + منصة عائمة
function ch_open(x) { const k=mk();
  coinsH(k,2,13,G-1,2);
  const pc=x.ri(6,16), L=x.ri(4,6);
  plat(k,pc,G-3,L); brk(k,pc+1,G-8,x.rand()<.3);
  if (x.diff>=2) W_(x,k,x.ri(10,14));
  if (x.diff>=4) W_(x,k,x.ri(20,26));
  if (x.diff>=6) F_(x,k,x.ri(8,20),G-6);
  return k; }

// فجوة بسيطة بحجم متغير
function ch_gap(x) { const k=mk();
  const sz=x.ri(3,Math.min(5,3+(x.diff>>3))), gc=x.ri(6,12);
  k.ga.push({c:gc,len:sz});
  coinsH(k,2,Math.max(1,(gc-3)>>1),G-1,2);
  arc(k,gc-1,sz+2,G-2,3);
  if (sz>=5) plat(k,gc+(sz>>1)-1,G-3,2,false);
  brk(k,gc+sz+2,G-5,false);
  W_(x,k,gc+sz+x.ri(4,6));
  if (x.diff>=3) F_(x,k,gc+(sz>>1),G-6);
  return k; }

// جبل: درج صاعد ثم هضبة ثم درج نازل
function ch_mountain(x) { const k=mk();
  const hmax=x.diff<4?2:3; let c=x.ri(3,5);
  for (let h=1;h<=hmax;h++){ k.hl.push({c,len:2,h}); coinsH(k,c,2,G-h-1); c+=2; }
  const pl=x.ri(4,6); k.hl.push({c,len:pl,h:hmax}); coinsH(k,c,pl,G-hmax-1);
  brk(k,c+(pl>>1),G-hmax-5,x.rand()<.4);
  if (x.diff>=3) W_(x,k,c+1);
  c+=pl;
  for (let h=hmax-1;h>=1;h--){ k.hl.push({c,len:2,h}); coinsH(k,c,2,G-h-1); c+=2; }
  if (x.diff>=5) F_(x,k,c-pl,G-8);
  if (x.diff>=2) W_(x,k,Math.min(c+3,26));
  return k; }

// أعمدة (مثل الأنابيب) بارتفاعات مختلفة
function ch_pillars(x) { const k=mk();
  let c=x.ri(4,5); const n=x.diff>=8?4:3;
  for (let i=0;i<n&&c<=24;i++){
    const h=x.ri(2,3); k.hl.push({c,len:2,h}); coinsH(k,c,2,G-h-1);
    if (i>0 && x.diff>=2) W_(x,k,c-3);
    c+=2+x.ri(4,5);
  }
  if (x.diff>=5) F_(x,k,x.ri(10,18),G-6);
  brk(k,x.ri(8,20),G-5,x.rand()<.3);
  return k; }

// حفرة عريضة بجزر عائمة متدرجة
function ch_pit(x) { const k=mk();
  const gc=x.ri(4,5), len=x.ri(9,12); k.ga.push({c:gc,len});
  let cur=gc, r=G-2;
  for (;;) {
    const L=x.ri(2,3); plat(k,cur,r,L);
    if (cur+L>=gc+len-2) break;
    cur+=L+x.ri(2,3);
    r=Math.max(G-4,Math.min(G-2,r+x.ri(-1,1)));
  }
  if (x.diff>=3) F_(x,k,gc+(len>>1),G-6);
  W_(x,k,gc+len+x.ri(3,5));
  return k; }

// جسر ينهار عند الوقوف عليه
function ch_crumble(x) { const k=mk();
  const gc=x.ri(4,5), len=x.ri(8,11); k.ga.push({c:gc,len});
  const alt=x.diff>=9 && x.rand()<.6;
  for (let i=0;i<len;i++){ if (alt && i%3===2) continue; k.cr.push({c:gc+i,r:G}); }
  coinsH(k,gc,len,G-2);
  if (x.diff>=4) F_(x,k,gc+(len>>1),G-5);
  W_(x,k,gc+len+x.ri(3,5));
  return k; }

// جزر تنهار فوق حفرة (صعب)
function ch_crumble_islands(x) { const k=mk();
  const gc=4, len=20; k.ga.push({c:gc,len});
  const rows=[G-1,G-2,G-1,G-2];
  for (let i=0;i<4;i++){ const c=gc+1+i*5;
    for (let j=0;j<3;j++) k.cr.push({c:c+j,r:rows[i]});
    coinsH(k,c,3,rows[i]-1);
  }
  F_(x,k,gc+9,G-6);
  W_(x,k,gc+len+3);
  return k; }

// نابض يقذفك إلى منصة عالية
function ch_spring_tower(x) { const k=mk();
  k.spr.push({c:5,r:G-1});
  brk(k,2,G-5,true);
  plat(k,8,G-5,7); plat(k,17,G-4,5);
  coinsH(k,9,5,G-8);
  if (x.diff>=7) for (let c=10;c<=12;c++) k.sp.push({c,r:G-1});
  W_(x,k,x.ri(20,24));
  if (x.diff>=4) F_(x,k,14,G-7);
  return k; }

// جزر في السماء — نابض إجباري للصعود
function ch_sky_islands(x) { const k=mk();
  const gc=5, len=18; k.ga.push({c:gc,len});
  k.spr.push({c:3,r:G-1});
  plat(k,7,G-5,5); plat(k,14,G-4,3); plat(k,19,G-3,3);
  arc(k,12,4,G-8,1);
  if (x.diff>=4) F_(x,k,16,G-7);
  W_(x,k,gc+len+3);
  return k; }

// جنة العملات
function ch_coin_heaven(x) { const k=mk();
  k.spr.push({c:4,r:G-1});
  plat(k,8,G-5,10);
  coinsH(k,9,8,G-7); coinsH(k,10,6,G-8);
  coinsH(k,2,12,G-1,2);
  coinsH(k,20,5,G-1,2);
  if (x.diff>=3) W_(x,k,x.ri(21,25));
  return k; }

// أشواك على الأرض مع أقواس عملات للقفز
function ch_spikes(x) { const k=mk();
  let c=x.ri(5,7); const n=Math.min(4,2+(x.diff>>3));
  for (let i=0;i<n&&c<=23;i++){
    const w=x.ri(2,3); for (let j=0;j<w;j++) k.sp.push({c:c+j,r:G-1});
    arc(k,c-1,w+2,G-2,3);
    if (i<n-1 && x.diff>=3 && x.rand()<.5) W_(x,k,c+w+2);
    c+=w+x.ri(4,5);
  }
  brk(k,x.ri(8,20),G-5,false);
  if (x.diff>=5) F_(x,k,x.ri(10,20),G-6);
  return k; }

// منصة عليا آمنة فوق أرض مليئة بالأشواك
function ch_spike_tunnel(x) { const k=mk();
  plat(k,3,G-3,25);
  for (let c=6;c<=24;c+=5){ k.sp.push({c,r:G-1},{c:c+1,r:G-1}); }
  W_(x,k,9); W_(x,k,20);
  if (x.diff>=6) F_(x,k,12,G-6);
  brk(k,14,G-8,true);
  return k; }

// حشد من الأعداء مع منصات للتهرب
function ch_horde(x) { const k=mk();
  [3,13,23].forEach(c=>plat(k,c,G-3,4));
  const cnt=Math.min(3+(x.diff>>2),6);
  for (let i=0;i<cnt;i++) W_(x,k,5+Math.floor(i*22/cnt),i%2?1:-1);
  if (x.diff>=5) F_(x,k,10,G-5);
  if (x.diff>=9) F_(x,k,22,G-5);
  brk(k,14,G-8,x.rand()<.4);
  k.am.push({c:2,r:G-1});
  return k; }

// كمين طيور على ارتفاعات مختلفة
function ch_flyers(x) { const k=mk();
  const n=Math.min(2+(x.diff>>3),4);
  for (let i=0;i<n;i++) F_(x,k,6+i*6,G-4-(i%3)*1.5|0,i%2?1:-1);
  plat(k,x.ri(8,12),G-3,5);
  arc(k,3,8,G-2,2);
  W_(x,k,x.ri(18,24));
  brk(k,x.ri(14,22),G-5,false);
  return k; }

// جدار كتل قابل للكسر أو القفز
function ch_block_wall(x) { const k=mk();
  k.am.push({c:4,r:G-1});
  const w1=x.ri(10,13);
  for (let r=G-3;r<=G-1;r++) brk(k,w1,r,r===G-3);
  coinsH(k,w1+2,4,G-1);
  const w2=x.ri(20,24);
  for (let r=G-3;r<=G-1;r++) brk(k,w2,r,false);
  arc(k,w2-3,7,G-5,2);
  W_(x,k,w1-4); if (x.diff>=4) W_(x,k,w1+5);
  return k; }

// قبو كتل معلّقة فوق منصة
function ch_vault(x) { const k=mk();
  plat(k,8,G-3,12);
  for (let c=9;c<=18;c++) k.br.push({c,r:G-8,hasHeart:c===12||c===16});
  for (let c=3;c<=6;c+=3) brk(k,c,G-5,false);
  W_(x,k,x.ri(4,6)); W_(x,k,x.ri(22,26));
  if (x.diff>=4) F_(x,k,14,G-6);
  return k; }

// منصات متعرجة بارتفاعات عشوائية
function ch_zigzag(x) { const k=mk();
  let r=G-3;
  for (let i=0;i<5;i++){
    plat(k,2+i*5,r,3);
    r=Math.max(G-5,Math.min(G-2,r+x.ri(-2,2)));
  }
  const gc=x.ri(8,18); if (x.diff>=3 && !k.p.some(p=>gc+3>p.c && gc<p.c+p.len)) k.ga.push({c:gc,len:3});
  W_(x,k,x.ri(4,8)); W_(x,k,x.ri(20,26));
  if (x.diff>=5) F_(x,k,x.ri(10,20),G-7);
  return k; }

// منطقة راحة: ذخيرة وقلوب بلا أعداء
function ch_rest(x) { const k=mk();
  coinsH(k,2,13,G-1,2);
  k.am.push({c:6,r:G-1},{c:22,r:G-1});
  brk(k,10,G-5,true); brk(k,18,G-5,false);
  return k; }

// ساحة الزعيم
function ch_boss(x) { const k=mk();
  plat(k,2,G-3,5); plat(k,12,G-5,7); plat(k,23,G-3,5);
  k.am.push({c:4,r:G-1},{c:26,r:G-1});
  k.en.push({type:x.B,c:14,r:G-8,fly:true,dir:-1});
  if (x.diff>=25) k.en.push({type:x.B,c:22,r:G-8,fly:true,dir:1});
  F_(x,k,5,G-5,1); F_(x,k,24,G-5,-1);
  W_(x,k,3,1); W_(x,k,26,-1); if (x.diff>=10) W_(x,k,14,1);
  k.br.push({c:13,r:G-10+2,hasHeart:true},{c:17,r:G-10+2,hasHeart:true});
  coinsH(k,2,27,G-1,2); coinsH(k,12,7,G-6);
  return k; }

// نهاية: درج نحو العلم
function ch_finale(x) { const k=mk();
  coinsH(k,2,14,G-1,2);
  W_(x,k,10); if (x.diff>=6) W_(x,k,15);
  k.hl.push({c:19,len:2,h:1},{c:21,len:2,h:2},{c:23,len:3,h:3});
  coinsH(k,19,2,G-2); coinsH(k,21,2,G-3); coinsH(k,23,3,G-4);
  return k; }

const CHUNKS = {
  open:ch_open, gap:ch_gap, mountain:ch_mountain, pillars:ch_pillars, pit:ch_pit,
  crumble:ch_crumble, crumble_islands:ch_crumble_islands, spring_tower:ch_spring_tower,
  sky_islands:ch_sky_islands, coin_heaven:ch_coin_heaven, spikes:ch_spikes,
  spike_tunnel:ch_spike_tunnel, horde:ch_horde, flyers:ch_flyers, block_wall:ch_block_wall,
  vault:ch_vault, zigzag:ch_zigzag, rest:ch_rest, boss:ch_boss, finale:ch_finale,
};

// ══════════════════════════════════════════════════════════════
//  أنماط المراحل (Archetypes) — كل مرحلة لها هوية مختلفة
// ══════════════════════════════════════════════════════════════
const ARCH = {
  tutorial: ['open','open','gap','mountain','vault','coin_heaven'],
  classic:  ['open','gap','mountain','horde','spikes','zigzag','pit','flyers'],
  hills:    ['mountain','mountain','pillars','pillars','open','gap','horde','vault'],
  sky:      ['pit','pit','crumble','sky_islands','spring_tower','coin_heaven','flyers'],
  gauntlet: ['spikes','spikes','spike_tunnel','gap','horde','pillars','zigzag'],
  bounce:   ['spring_tower','spring_tower','coin_heaven','sky_islands','open','zigzag'],
  crumble:  ['crumble','crumble','crumble_islands','gap','horde','spikes','mountain'],
  cave:     ['vault','block_wall','block_wall','pillars','spike_tunnel','horde','zigzag'],
  rush:     ['horde','horde','flyers','flyers','open','pillars','gap'],
  treasure: ['coin_heaven','coin_heaven','vault','zigzag','spring_tower','open'],
  mix:      ['open','gap','mountain','pillars','pit','crumble','spring_tower','sky_islands',
             'coin_heaven','spikes','spike_tunnel','horde','flyers','block_wall','vault','zigzag'],
};
const ARCH_ROT = ['classic','hills','sky','gauntlet','bounce','crumble','cave','rush','treasure','mix'];

// نكهة كل عالم (تُضاف لقائمة القطع المحتملة)
const WORLD_BIAS = {
  nature:    ['mountain','spring_tower','coin_heaven'],
  graveyard: ['crumble','spikes','vault'],
  winter:    ['pit','sky_islands','crumble_islands'],
  desert:    ['pillars','spikes','horde','block_wall'],
};

// أقل صعوبة تظهر عندها القطعة
const MIN_DIFF = { crumble_islands:5, spike_tunnel:4, horde:3, flyers:2, spikes:2,
                   crumble:3, pit:3, sky_islands:3, block_wall:2 };
const PITS = new Set(['gap','pit','crumble','crumble_islands','sky_islands']);

function planLevel(n, diff, worldIdx, theme, rand, ri) {
  const arch = diff<=2 ? 'tutorial' : ARCH_ROT[(diff + worldIdx*4) % ARCH_ROT.length];
  const isBoss = diff%5===0;
  let nb = 4 + (diff/3|0) + ri(0,1);
  if (arch==='treasure') nb -= 1;
  if (arch==='rush')     nb += 1;
  const pool = ARCH[arch].concat(arch==='tutorial'?[]:WORLD_BIAS[theme]).filter(t=>(MIN_DIFF[t]||0)<=diff);
  const body=['open']; let p1='open', p2='';
  for (let i=1;i<nb;i++){
    let pick='open';
    for (let t=0;t<14;t++){
      const cand=pool[Math.floor(rand()*pool.length)];
      if (cand===p1 || cand===p2) continue;
      if (PITS.has(cand) && PITS.has(p1)) continue;
      pick=cand; break;
    }
    body.push(pick); p2=p1; p1=pick;
  }
  if (nb>=8) body.splice(body.length>>1,0,'rest');
  if (isBoss){ body.push('rest','boss'); } else body.push('finale');
  return { arch, seq:body, isBoss };
}

// ══════════════════════════════════════════════════════════════
//  توليد المرحلة
// ══════════════════════════════════════════════════════════════
function generateLevel(n) {
  const worldIdx = Math.floor((n-1)/25);
  const theme    = WORLD_THEMES[Math.min(worldIdx,3)];
  const time     = WORLD_TIMES[Math.min(worldIdx,3)];
  const diff     = ((n-1)%25)+1;
  const rand     = rng(n*7919+31337);
  const ri       = (a,b)=>a+Math.floor(rand()*(b-a+1));
  const dl       = WORLD_DECOS[theme];
  const ROWS=14, GND_TOP=G;

  // أنواع الأعداء (تتنوع حسب الصعوبة)
  const baseEt = WORLD_ENEMIES[theme], extra = WORLD_ENEMIES.extra[theme];
  const walkers=[baseEt.walker], flyers=[baseEt.flyer];
  if (diff>=6) for (const t of extra){ if(isFlyerType(t)){ if(!flyers.includes(t)) flyers.push(t); } else if(!walkers.includes(t)) walkers.push(t); }
  const bossPool=[baseEt.boss].concat(extra.filter(t=>t!==baseEt.boss));
  const pick = a=>a[Math.floor(rand()*a.length)];
  const x = {
    diff, rand, ri, theme,
    W:()=>pick(walkers), F:()=>pick(flyers),
    B: diff<=15 ? baseEt.boss : bossPool[Math.floor(diff/8)%bossPool.length],
  };

  const plan   = planLevel(n,diff,worldIdx,theme,rand,ri);
  const chunks = plan.seq.map(t=>(CHUNKS[t]||CHUNKS.open)(x));
  const COLS   = 8 + chunks.reduce((s,c)=>s+c.w,0) + 8;

  const cells=[]; for(let r=0;r<ROWS;r++) cells[r]=new Int8Array(COLS);
  for(let r=GND_TOP;r<ROWS;r++) for(let c=0;c<COLS;c++) cells[r][c]=CELL.GND;
  const groundTop = new Array(COLS).fill(GND_TOP); // صف سطح الأرض لكل عمود (null = فجوة)

  const platforms=[],enemies=[],coins=[],gaps=[],breakables=[],ammos=[],decos=[],spikes=[];
  const inRange = wc => wc>0 && wc<COLS-1;
  const hasBrk  = (c,r) => breakables.some(b=>b.c===c&&b.r===r);
  const place = (v,wc,r,need) => {   // يضع نابضاً/شوكة فوق سطح صلب
    if(!inRange(wc)||r<0||r>=ROWS-1) return false;
    if(cells[r][wc]!==CELL.AIR) return false;
    const below=cells[r+1][wc];
    if(!need.includes(below)) return false;
    cells[r][wc]=v; return true;
  };

  let off=8;
  for (const chunk of chunks){
    const W=chunk.w;
    // 1) فجوات
    for (const g of chunk.ga){
      const a=g.c, b=Math.min(g.c+g.len,W-1);
      for (let gc=a;gc<b;gc++){ for(let r=GND_TOP;r<ROWS;r++) cells[r][off+gc]=CELL.AIR; groundTop[off+gc]=null; }
      gaps.push({c:off+a,len:b-a});
    }
    // 2) تلال/أعمدة (ارتفاع الأرض)
    for (const h of chunk.hl){
      for (let c=h.c;c<Math.min(h.c+h.len,W);c++){
        const wc=off+c; if(groundTop[wc]===null) continue;
        for (let r=GND_TOP-h.h;r<GND_TOP;r++) cells[r][wc]=CELL.GND;
        groundTop[wc]=Math.min(groundTop[wc],GND_TOP-h.h);
      }
    }
    // 3) بلاطات تنهار
    for (const s of chunk.cr){ const wc=off+s.c; if(inRange(wc)){ cells[s.r][wc]=CELL.CRUMBLE; if(s.r===GND_TOP) groundTop[wc]=null; } }
    // 4) منصات
    for (const p of chunk.p){
      for (let c=p.c;c<p.c+p.len;c++){ const wc=off+c; if(inRange(wc)&&cells[p.r][wc]===CELL.AIR) cells[p.r][wc]=CELL.PLT; }
      platforms.push({c:off+p.c,r:p.r,len:p.len});
    }
    // 5) أشواك ونوابض
    for (const s of chunk.sp)  if (place(CELL.SPIKE, off+s.c, s.r, [CELL.GND])) spikes.push({c:off+s.c,r:s.r});
    for (const s of chunk.spr) place(CELL.SPRING, off+s.c, s.r, [CELL.GND,CELL.PLT]);
    // 6) كتل الكسر
    for (const b of chunk.br){
      const wc=off+b.c;
      if (b.r<0||!inRange(wc)||cells[b.r][wc]!==CELL.AIR||hasBrk(wc,b.r)) continue;
      const hasCoin = !b.hasHeart && rand()<0.40;
      breakables.push({c:wc,r:b.r,hasHeart:b.hasHeart,hasCoin});
    }
    // 7) عملات (في الهواء فقط وليس داخل كتلة)
    for (const co of chunk.co){
      const wc=off+co.c;
      if (inRange(wc)&&co.r>=0&&cells[co.r]&&cells[co.r][wc]===CELL.AIR&&!hasBrk(wc,co.r)) coins.push({c:wc,r:co.r});
    }
    // 8) ذخيرة خاصة بالقطعة
    for (const a of chunk.am){ const wc=off+a.c; if(inRange(wc)&&cells[a.r][wc]===CELL.AIR) ammos.push({c:wc,r:a.r}); }
    // 9) الأعداء — الأرضيون يوضعون على سطح مستوٍ فعلي
    const flat = c => groundTop[c]!==null && groundTop[c-1]===groundTop[c] && groundTop[c+1]===groundTop[c] && groundTop[c+2]===groundTop[c];
    for (const e of chunk.en){
      const flyer = isFlyerType(e.type);
      if (flyer && e.fly){ enemies.push({...e,c:off+e.c}); continue; }
      let placed=false;
      for (const d of [0,1,-1,2,-2,3,-3,4,-4]){
        const wc=off+e.c+d;
        if (wc>3 && wc<COLS-6 && flat(wc)){ enemies.push({type:e.type,c:wc,r:groundTop[wc]-1,fly:false,dir:e.dir}); placed=true; break; }
      }
    }
    off+=W;
  }

  // ضمان 3 قلوب بالضبط: أضف كتلاً احتياطية إن قلّت
  const flatAt = c => c>3&&c<COLS-6&&groundTop[c]!==null&&groundTop[c-1]===groundTop[c]&&groundTop[c+1]===groundTop[c];
  for (let c=14;c<COLS-10 && breakables.length<6;c+=11){
    for (const d of [0,1,2,3]){
      const wc=c+d; if(!flatAt(wc)) continue;
      const r=groundTop[wc]-5;
      if (r>=0&&cells[r][wc]===CELL.AIR&&!hasBrk(wc,r)){ breakables.push({c:wc,r,hasHeart:false,hasCoin:rand()<0.4}); break; }
    }
  }
  const heartCount = breakables.filter(b=>b.hasHeart).length;
  if (heartCount<3){
    const cand=breakables.filter(b=>!b.hasHeart);
    let toAdd=3-heartCount; const step=Math.max(1,Math.floor(cand.length/(toAdd+1)));
    for (let i=0;i<cand.length&&toAdd>0;i+=step){ cand[i].hasHeart=true; cand[i].hasCoin=false; toAdd--; }
    for (let i=0;i<cand.length&&toAdd>0;i++){ if(!cand[i].hasHeart){ cand[i].hasHeart=true; cand[i].hasCoin=false; toAdd--; } }
  } else if (heartCount>3){
    let kept=0; for (const b of breakables) if(b.hasHeart){ if(kept<3) kept++; else b.hasHeart=false; }
  }

  // ذخيرة منتظمة (على سطح الأرض الفعلي)
  for (let c=6;c<COLS-4;c+=15){
    if (flatAt(c)&&cells[groundTop[c]-1][c]===CELL.AIR&&!ammos.some(a=>Math.abs(a.c-c)<4))
      ammos.push({c,r:groundTop[c]-1});
  }

  // ديكور على الأرض المستوية فقط
  for (let c=3;c<COLS-3;c+=3){
    if (rand()<0.25) continue;
    const gt=groundTop[c];
    if (gt===null||groundTop[c-1]!==gt||groundTop[c+1]!==gt) continue;
    if (cells[gt-1][c]!==CELL.AIR) continue;
    if (decos.some(d=>Math.abs(d.c-c)<3)) continue;
    decos.push({c,r:gt-1,img:dl[Math.floor(rand()*dl.length)]});
  }

  return {
    world:worldIdx+1, theme, time,
    cols:COLS, rows:ROWS, gndRow:GND_TOP,
    cells, platforms, breakables, coins, gaps, enemies, ammos, decos,
    spikes, springs:[], traps:[],
    goal:{c:COLS-5,r:GND_TOP-1},
    startCol:1, startRow:GND_TOP-1,
    tileSet:TILE_VARIANTS[theme],
    diff, arch:plan.arch, seq:plan.seq,
  };
}

const LEVELS={};
for(let i=1;i<=100;i++) LEVELS[i]=generateLevel(i);
