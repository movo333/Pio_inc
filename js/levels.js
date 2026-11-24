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
// مجموعة أشواك: صورة واحدة، تتناوب بين النوع 1 (عرض 3) والنوع 2 (عرض 4)
const spk = (x,k,c) => { const v=(x.spk++%2)+1, w=v===1?3:4; k.sp.push({c,w,v}); return w; };

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

// سلسلة هوات صغيرة متتالية (مثل ماريو)
function ch_gap_series(x) { const k=mk();
  const maxSz=Math.min(4,2+(x.diff>>3)+(x.diff>=3?1:0));
  let c=x.ri(5,6), n=0;
  while (n<3){
    const sz=x.ri(2,maxSz);
    if (c+sz>26) break;
    k.ga.push({c,len:sz}); arc(k,c-1,sz+2,G-2,3);
    c+=sz+x.ri(4,5); n++;
  }
  if (x.diff>=2) W_(x,k,x.ri(3,5)+ (k.ga[0]?k.ga[0].c+k.ga[0].len+1:8));
  if (x.diff>=5) F_(x,k,x.ri(10,22),G-6);
  brk(k,x.ri(8,22),G-5,x.rand()<.3);
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
  if (x.diff>=7) spk(x,k,10);
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

// أشواك على الأرض (مجموعة = صورة واحدة) مع أقواس عملات للقفز
function ch_spikes(x) { const k=mk();
  let c=x.ri(6,8);
  for (let i=0;i<3;i++){
    const v=(x.spk%2)+1, w=v===1?3:4;
    if (c+w>24) break;
    spk(x,k,c);
    arc(k,c-1,w+2,G-2,3);
    c+=w+x.ri(6,7);
    if (i===0 && x.diff>=3 && x.rand()<.5) W_(x,k,c-3);
    if (x.diff<8 && i>=1) break;
  }
  brk(k,x.ri(8,20),G-5,false);
  if (x.diff>=5) F_(x,k,x.ri(10,20),G-6);
  return k; }

// منصة عليا آمنة فوق أرض مليئة بالأشواك
function ch_spike_tunnel(x) { const k=mk();
  plat(k,3,G-3,25);
  let c=7;
  while (c+4<=24){ const w=spk(x,k,c); c+=w+x.ri(3,4); }
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

// هضبة بدرجات: صعود 2 ثم 4 ثم سطح مرتفع ثم نزول (تضاريس غير مستوية)
function ch_mesa(x) { const k=mk();
  const top=x.diff>=10?5:4;
  k.hl.push({c:4,len:2,h:2},{c:6,len:2,h:top-1>3?3:top-1},{c:8,len:10,h:top},{c:18,len:2,h:2});
  coinsH(k,9,8,G-top-1);
  if (x.diff>=3) W_(x,k,24);
  if (x.diff>=6) F_(x,k,13,G-top-3);
  return k; }

// قطعة هادئة: أرض مستوية لتتسع للغرف السرية
function ch_quiet(x) { const k=mk(); coinsH(k,2,8,G-1,3); return k; }

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
  k.am.push({c:14,r:G-1});
  brk(k,10,G-5,true); brk(k,18,G-5,false);
  return k; }

// ساحة الزعيم
function ch_boss(x) { const k=mk();
  plat(k,2,G-3,5); plat(k,12,G-5,7); plat(k,23,G-3,5);
  k.am.push({c:4,r:G-1});
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
  open:ch_open, gap:ch_gap, gap_series:ch_gap_series, mountain:ch_mountain, pillars:ch_pillars, pit:ch_pit,
  crumble:ch_crumble, crumble_islands:ch_crumble_islands, spring_tower:ch_spring_tower,
  sky_islands:ch_sky_islands, coin_heaven:ch_coin_heaven, spikes:ch_spikes,
  spike_tunnel:ch_spike_tunnel, horde:ch_horde, flyers:ch_flyers, block_wall:ch_block_wall,
  vault:ch_vault, quiet:ch_quiet, mesa:ch_mesa, zigzag:ch_zigzag, rest:ch_rest, boss:ch_boss, finale:ch_finale,
};

// ══════════════════════════════════════════════════════════════
//  أنماط المراحل (Archetypes) — كل مرحلة لها هوية مختلفة
// ══════════════════════════════════════════════════════════════
const ARCH = {
  tutorial: ['open','gap','gap','mountain','vault','coin_heaven'],
  classic:  ['open','gap','gap_series','mountain','mesa','horde','spikes','zigzag','pit','flyers'],
  hills:    ['mountain','mesa','pillars','mesa','gap','gap_series','horde','vault'],
  sky:      ['pit','pit','crumble','sky_islands','spring_tower','coin_heaven','flyers'],
  gauntlet: ['spikes','spikes','spike_tunnel','gap','gap_series','horde','pillars','zigzag'],
  bounce:   ['spring_tower','spring_tower','coin_heaven','sky_islands','open','zigzag'],
  crumble:  ['crumble','crumble','crumble_islands','gap','gap_series','horde','spikes','mountain'],
  cave:     ['vault','block_wall','block_wall','pillars','spike_tunnel','gap_series','horde','zigzag'],
  rush:     ['horde','horde','flyers','flyers','gap_series','pillars','gap'],
  treasure: ['coin_heaven','mesa','vault','zigzag','gap','spring_tower','gap_series'],
  mix:      ['open','gap','gap_series','gap','mountain','pillars','pit','crumble','spring_tower','sky_islands',
             'coin_heaven','spikes','spike_tunnel','horde','flyers','block_wall','vault','mesa','zigzag'],
};
const ARCH_ROT = ['classic','hills','sky','gauntlet','bounce','crumble','cave','rush','treasure','mix'];

// نكهة كل عالم (تُضاف لقائمة القطع المحتملة)
const WORLD_BIAS = {
  nature:    ['mountain','mesa','spring_tower','coin_heaven','gap_series'],
  graveyard: ['crumble','spikes','vault','gap_series'],
  winter:    ['pit','mesa','sky_islands','crumble_islands'],
  desert:    ['pillars','mesa','spikes','horde','block_wall','gap_series'],
};

// أقل صعوبة تظهر عندها القطعة
const MIN_DIFF = { mesa:2, gap_series:2, crumble_islands:5, spike_tunnel:4, horde:3, flyers:2, spikes:2,
                   crumble:3, pit:3, sky_islands:3, block_wall:2 };
const PITS = new Set(['gap','gap_series','pit','crumble','crumble_islands','sky_islands']);

function planLevel(n, diff, worldIdx, theme, rand, ri, quietN) {
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
  for (let q=0;q<(quietN||0);q++) body.splice(Math.max(1,Math.floor(body.length*(q+1)/((quietN||0)+1))),0,'quiet');
  if (isBoss){ body.push('rest','boss'); } else body.push('finale');
  return { arch, seq:body, isBoss };
}

// ══════════════════════════════════════════════════════════════
//  توليد المرحلة
// ══════════════════════════════════════════════════════════════
// ═══ المرحلة 1 مأخوذة من Level1.tmx (محوَّلة إلى خلايا المحرك) ═══
const TMX_LEVEL1 = {"cols": 269, "rows": [".............................................................................................................................................................................................................................................................................", "..................bqb.................................................................................................q..q...................................................................................................................................................", "..................................====.......................................................................................................................................................................................................................................", "....................................................................................................................==.==.==........................................##.......................................................................................................", "............q...bqbqbqb.......=====.............q.........................q..b........bqbb..........................q..q..q........................................###.......................................................................................................", "..................................................................................................................................................................####.......................................................................................................", "...........................=============.........#########.......................................===.===.===......==.==.==.==......======.......##......#........#####.......................................................................................................", ".................................................#########.....................................................................................###......##......######.......................................................................................................", ".................................................#########....................................................................................####......###############......................................................................................................", "#########################################=======################################..###############...........######################################......###############....##################################################################################################", "#########################################.......################################..###############...........#####################################........####################################################################################################################", "#########################################.......################################..###############...........#####################################........####################################################################################################################", "#########################################.......################################..###############...........#####################################........####################################################################################################################", "#########################################.......################################..###############...........#####################################........####################################################################################################################"], "spikes": [{"c": 38, "w": 2, "v": 1}, {"c": 46, "w": 2, "v": 2}, {"c": 61, "w": 2, "v": 1}], "walkers": [[29, 9], [28, 10], [107, 11], [67, 14], [70, 14], [140, 14], [141, 14]], "flyers": [[121, 0], [19, 4], [87, 4], [119, 4]], "dec": [[4, 91], [6, 73], [8, 186], [9, 187], [10, 55], [11, 55], [13, 91], [18, 186], [19, 187], [21, 55], [22, 55], [23, 73], [28, 55], [30, 55], [31, 91], [39, 55], [48, 186], [49, 187], [58, 135], [63, 91], [64, 91], [66, 55], [67, 186], [68, 134], [68, 187], [69, 135], [69, 55], [70, 73], [76, 55], [77, 43], [77, 55], [78, 91], [83, 91], [84, 186], [85, 187], [86, 55], [88, 73], [89, 55], [90, 186], [91, 187], [112, 91], [113, 73], [116, 186], [117, 187], [118, 91], [120, 55], [121, 186], [122, 187], [124, 91], [125, 55], [127, 55], [128, 55], [131, 91], [133, 186], [134, 187], [135, 55], [136, 55], [171, 186], [172, 187], [174, 91], [175, 91], [178, 73], [179, 186], [180, 187], [182, 91], [183, 13], [184, 91]], "trees": [53, 86, 117, 140, 176], "startCol": 2};

function generateLevel(n, quietN) {
  quietN = quietN || 0;
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
    diff, rand, ri, theme, spk:0,
    W:()=>pick(walkers), F:()=>pick(flyers),
    B: diff<=15 ? baseEt.boss : bossPool[Math.floor(diff/8)%bossPool.length],
  };

  const TMX    = (n===1 && typeof TMX_LEVEL1!=='undefined') ? TMX_LEVEL1 : null;
  const plan   = TMX ? {seq:['tmx'],arch:'tmx'} : planLevel(n,diff,worldIdx,theme,rand,ri,quietN);
  const chunks = TMX ? [] : plan.seq.map(t=>(CHUNKS[t]||CHUNKS.open)(x));
  const COLS   = TMX ? TMX.cols : 8 + chunks.reduce((s,c)=>s+c.w,0) + 26;   // ذيل أطول: مكان للعلم ثم القصر

  const cells=[]; for(let r=0;r<ROWS;r++) cells[r]=new Int8Array(COLS);
  for(let r=GND_TOP;r<ROWS;r++) for(let c=0;c<COLS;c++) cells[r][c]=CELL.GND;
  const groundTop = new Array(COLS).fill(GND_TOP); // صف سطح الأرض لكل عمود (null = فجوة)

  const platforms=[],enemies=[],coins=[],gaps=[],breakables=[],ammos=[],decos=[],spikeGroups=[];
  const nearSpike = (wc,m) => spikeGroups.some(g=>wc>=g.c-(m||0) && wc<g.c+g.w+(m||0));
  const inRange = wc => wc>0 && wc<COLS-1;
  const hasBrk  = (c,r) => breakables.some(b=>b.c===c&&b.r===r);
  const place = (v,wc,r,need) => {   // يضع نابضاً/شوكة فوق سطح صلب
    if(!inRange(wc)||r<0||r>=ROWS-1) return false;
    if(cells[r][wc]!==CELL.AIR) return false;
    const below=cells[r+1][wc];
    if(!need.includes(below)) return false;
    cells[r][wc]=v; return true;
  };

  let off=8, ci=0;
  const movers=[];
  if (TMX){
    // ── الأرض والمنصات وكتل الكسر ──
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
      const ch=TMX.rows[r][c];
      cells[r][c] = ch==='#'?CELL.GND : ch==='='?CELL.PLT : CELL.AIR;
      if (ch==='b'||ch==='q') breakables.push({c,r,hasHeart:false,hasCoin:ch==='q'});
    }
    for (let c=0;c<COLS;c++){ groundTop[c]=null; for (let r=0;r<ROWS;r++) if (cells[r][c]===CELL.GND){ groundTop[c]=r; break; } }
    for (let c=0;c<COLS;){ if (groundTop[c]===null){ let d=c; while(d<COLS&&groundTop[d]===null) d++; gaps.push({c,len:d-c}); c=d; } else c++; }
    const flatC = c => c>3&&c<COLS-24&&groundTop[c]!==null&&groundTop[c-1]===groundTop[c]&&groundTop[c+1]===groundTop[c]&&groundTop[c+2]===groundTop[c];
    // ── الأشواك ──
    for (const s of TMX.spikes){
      let ok=true; for (let wc=s.c;wc<s.c+s.w;wc++) if (groundTop[wc]!==GND_TOP||cells[GND_TOP-1][wc]!==CELL.AIR) ok=false;
      if (ok) spikeGroups.push({c:s.c,w:s.w,v:s.v});
    }
    // ── الأعداء ──
    let lastW=-99;
    for (const [c0] of TMX.walkers){
      if (c0-lastW<5) continue;
      for (const d of [0,1,-1,2,-2,3,-3,4,-4]){ const wc=c0+d;
        if (flatC(wc)&&!nearSpike(wc,2)){ enemies.push({type:x.W(),c:wc,r:groundTop[wc]-1,fly:false,dir:rand()<.5?1:-1}); lastW=c0; break; } }
    }
    for (const [c0,r0] of TMX.flyers) enemies.push({type:x.F(),c:c0,r:Math.max(2,r0),fly:true,dir:rand()<.5?1:-1});
    // ── عملات: أقواس فوق الحفر، وفوق المنصات، وخطوط على الأرض ──
    const addCoin=(c,r)=>{ if(c>0&&c<COLS-1&&r>=0&&r<ROWS&&cells[r][c]===CELL.AIR&&!hasBrk(c,r)&&!coins.some(k=>k.c===c&&k.r===r)&&!(r>=G-2&&nearSpike(c,0))) coins.push({c,r}); };
    for (const g of gaps) if (g.len>=3) for (let i=0;i<g.len;i++) addCoin(g.c+i, GND_TOP-3-Math.round(Math.sin(Math.PI*(i+0.5)/g.len)*2));
    for (let r=1;r<ROWS-1;r++) for (let c=0;c<COLS;){
      if (cells[r][c]===CELL.PLT){ let d=c; while(d<COLS&&cells[r][d]===CELL.PLT) d++; if (d-c>=2&&c<COLS-30) for (let q=c;q<d;q++) addCoin(q,r-1); c=d; } else c++;
    }
    for (let c=7;c<COLS-40;c+=13) if (flatC(c)&&flatC(c+3)&&!nearSpike(c,3)) for (let q=0;q<4;q++) addCoin(c+q,groundTop[c+q]-1);
    // ── ديكور: أشجار وشجيرات من الخريطة الأصلية ──
    const treeImgs=['Tree_1.png','Tree_2.png','Tree_3.png'];
    TMX.trees.forEach((c,i)=>{ if (groundTop[c]!==null&&cells[groundTop[c]-1][c]===CELL.AIR) decos.push({c,r:groundTop[c]-1,img:treeImgs[i%3]}); });
    const decImg={55:'Bush__1_.png',73:'Bush__2_.png',91:'Mushroom_1.png',186:'Flower_1.png',187:'Flower_2.png'};
    for (const [c,g] of TMX.dec){ if (!flatC(c)||decos.some(d=>Math.abs(d.c-c)<3)||cells[groundTop[c]-1][c]!==CELL.AIR) continue;
      decos.push({c,r:groundTop[c]-1,img:decImg[g]||'Grass_1.png'}); }
  }
  for (const chunk of chunks){
    const W=chunk.w;
    const ctype=plan.seq[ci++];
    // 1) فجوات
    for (const g of chunk.ga){
      const a=g.c, b=Math.min(g.c+g.len,W-1);
      for (let gc=a;gc<b;gc++){ for(let r=GND_TOP;r<ROWS;r++) cells[r][off+gc]=CELL.AIR; groundTop[off+gc]=null; }
      gaps.push({c:off+a,len:b-a});
      // عبّارة متحركة تعبر الحفر العريضة (جسم جديد: float_platform)
      if (ctype==='pit' && diff>=3 && b-a>=8) movers.push({c:off+a, len:3, span:b-a, r:G-1, speed:0.9+rand()*0.5, phase:rand()*6.28});
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
    for (const s of chunk.sp){
      // لا تُوضع الأشواك قرب الهوات/التلال: الإطار (الصورة) يجب أن يبقى كله فوق أرض مستوية
      const c0=off+s.c; let ok=c0>14;
      for (let wc=c0-2; ok && wc<=c0+s.w+1; wc++){
        if (!inRange(wc)||groundTop[wc]!==GND_TOP||cells[GND_TOP][wc]!==CELL.GND||cells[GND_TOP-1][wc]!==CELL.AIR) ok=false;
      }
      if (ok && !nearSpike(c0,3) && !nearSpike(c0+s.w-1,3)) spikeGroups.push({c:c0,w:s.w,v:s.v});
    }
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
      if (inRange(wc)&&co.r>=0&&cells[co.r]&&cells[co.r][wc]===CELL.AIR&&!hasBrk(wc,co.r)&&!(co.r>=G-2&&nearSpike(wc,0))) coins.push({c:wc,r:co.r});
    }
    // 8) ذخيرة خاصة بالقطعة
    for (const a of chunk.am){ const wc=off+a.c; if(inRange(wc)&&cells[a.r][wc]===CELL.AIR&&!nearSpike(wc,2)) ammos.push({c:wc,r:a.r}); }
    // 9) الأعداء — الأرضيون يوضعون على سطح مستوٍ فعلي
    const flat = c => groundTop[c]!==null && groundTop[c-1]===groundTop[c] && groundTop[c+1]===groundTop[c] && groundTop[c+2]===groundTop[c];
    for (const e of chunk.en){
      const flyer = isFlyerType(e.type);
      if (flyer && e.fly){ enemies.push({...e,c:off+e.c}); continue; }
      let placed=false;
      for (const d of [0,1,-1,2,-2,3,-3,4,-4]){
        const wc=off+e.c+d;
        if (wc>3 && wc<COLS-24 && flat(wc) && !nearSpike(wc,2)){ enemies.push({type:e.type,c:wc,r:groundTop[wc]-1,fly:false,dir:e.dir}); placed=true; break; }
      }
    }
    off+=W;
  }

  // ═══════ المناطق السرية: غرفة مخفية داخل جدار هضبة (3 نجوم لكل مرحلة) ═══════
  // هضبة بارتفاع 5 بلاطات: درج على جهة، وعلى الجهة الأخرى جدار ترابي "مزيّف" تدخل منه إلى غرفة فيها نجمة
  const secrets=[], items=[];
  const inZone = wc => secrets.some(z=>wc>=z.c0-1&&wc<z.c0+16+1);
  const regionFree=(a,w)=>{
    const b=a+w-1;
    if (a<12||b>COLS-34) return false;
    if (secrets.some(z=>a<z.c0+16+4&&b>z.c0-4)) return false;
    for (let c=a-1;c<=b+1;c++){
      if (groundTop[c]!==GND_TOP||cells[GND_TOP][c]!==CELL.GND) return false;
      for (let r=0;r<GND_TOP;r++) if (cells[r][c]!==CELL.AIR) return false;
      if (nearSpike(c,2)) return false;
    }
    if (breakables.some(k=>k.c>=a-1&&k.c<=b+1)) return false;
    return true;
  };
  const addChamber=(a,dir)=>{
    const id=secrets.length, p0=a+1;
    const colOf=j=>dir>0?p0+j:p0+13-j;                 // j = موضع من جهة الدرج
    for (let j=0;j<14;j++){
      const h=j<2?2:(j<4?4:5), col=colOf(j);
      for (let r=G-h;r<G;r++) cells[r][col]=CELL.GND;
      groundTop[col]=G-h;
    }
    for (let j=6;j<14;j++) for (let r=G-4;r<G;r++) cells[r][colOf(j)]=CELL.AIR;   // الغرفة + الممر المزيّف
    // تنظيف العملات والأعداء من منطقة الهضبة
    const lo=p0-7, hi=p0+13+7;
    for (let q=coins.length-1;q>=0;q--) if (coins[q].c>=p0&&coins[q].c<=p0+13&&coins[q].r>=G-5) coins.splice(q,1);
    for (let q=enemies.length-1;q>=0;q--) if (enemies[q].c>=lo&&enemies[q].c<=hi) enemies.splice(q,1);
    const c6=colOf(6), c13=colOf(13);
    secrets.push({id,kind:'chamber',dir,c0:a,c:Math.min(c6,c13),r:G-4,w:8,h:4,starC:colOf(8),starR:G-2});
    coins.push({c:colOf(7),r:G-2},{c:colOf(9),r:G-2},{c:colOf(11),r:G-2});
    items.push({type:'gem',c:colOf(10),r:G-2});
  };
  {
    const lo=12, hi=COLS-34, seg=(hi-lo)/3;
    if (TMX){
      for (let k=0;k<3;k++){
        const dir=1, tgt=[56,116,166][k]-8;
        const cand=[]; for (let a=lo;a<hi-16;a++) cand.push(a);
        cand.sort((p,q)=>Math.abs(p-tgt)-Math.abs(q-tgt));
        for (const a of cand) if (regionFree(a,16)){ addChamber(a,dir); break; }
      }
    } else
    for (let k=0;k<3;k++){
      const dir=1; let done=false;
      for (let pass=0;pass<2&&!done;pass++){
        const s0=pass===0?Math.floor(lo+seg*k):lo, s1=pass===0?Math.floor(lo+seg*(k+1)):hi;
        const start=s0+ri(0,4);
        for (let a=start;a<s1-16&&!done;a++) if (regionFree(a,16)){ addChamber(a,dir); done=true; }
        for (let a=s0;a<start&&a<s1-16&&!done;a++) if (regionFree(a,16)){ addChamber(a,dir); done=true; }
      }
    }
  }

  // ضمان 3 قلوب بالضبط: أضف كتلاً احتياطية إن قلّت
  const flatAt = c => c>3&&c<COLS-24&&groundTop[c]!==null&&groundTop[c-1]===groundTop[c]&&groundTop[c+1]===groundTop[c];
  for (let c=14;c<COLS-30 && breakables.length<6;c+=11){
    for (const d of [0,1,2,3]){
      const wc=c+d; if(!flatAt(wc)) continue;
      const r=groundTop[wc]-5;
      if (r>=0&&cells[r][wc]===CELL.AIR&&!hasBrk(wc,r)&&!inZone(wc)){ breakables.push({c:wc,r,hasHeart:false,hasCoin:rand()<0.4}); break; }
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

  // عناصر قوة داخل الكتل: درع + مغناطيس (من الصعوبة 2 فما فوق)
  if (diff>=2){
    const plain=breakables.filter(b=>!b.hasHeart);
    const want=['shield','magnet'];
    for (let i=0;i<want.length&&plain.length>0;i++){
      const b=plain.splice(Math.floor(rand()*plain.length),1)[0];
      b.hasItem=want[i]; b.hasCoin=false;
    }
  }

  // ذخيرة منتظمة (على سطح الأرض الفعلي)
  for (let c=18;c<COLS-30;c+=40){
    if (flatAt(c)&&!nearSpike(c,2)&&cells[groundTop[c]-1][c]===CELL.AIR&&!ammos.some(a=>Math.abs(a.c-c)<12))
      ammos.push({c,r:groundTop[c]-1});
  }

  // ديكور على الأرض المستوية فقط
  for (let c=3;c<COLS-24;c+=3){
    if (rand()<0.25) continue;
    const gt=groundTop[c];
    if (gt===null||groundTop[c-1]!==gt||groundTop[c+1]!==gt) continue;
    if (cells[gt-1][c]!==CELL.AIR) continue;
    if (decos.some(d=>Math.abs(d.c-c)<3)) continue;
    decos.push({c,r:gt-1,img:dl[Math.floor(rand()*dl.length)]});
  }

  if (secrets.length<3 && quietN<3) return generateLevel(n, quietN+1);
  return {
    world:worldIdx+1, theme, time,
    cols:COLS, rows:ROWS, gndRow:GND_TOP,
    cells, platforms, breakables, coins, gaps, enemies, ammos, decos,
    spikeGroups, spikes:[], springs:[], traps:[],
    secrets, items, movers,
    goal:{c:COLS-21,r:GND_TOP-1},
    castle:{c:COLS-9},
    startCol:TMX?TMX.startCol:1, startRow:GND_TOP-1,
    tileSet:TILE_VARIANTS[theme],
    diff, arch:plan.arch, seq:plan.seq,
  };
}

const LEVELS={};
for(let i=1;i<=100;i++) LEVELS[i]=generateLevel(i);
