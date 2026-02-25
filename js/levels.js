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
// bat1-3: طائر 60x60 25إطار 5/صف
// snail1-3: أرضي 60x60 30إطار 5/صف
// spikebee1-4: طائر 140x117 20إطار 10/صف
// tuca1-3: أرضي 140x112 52إطار 13/صف

const WORLD_ENEMIES = {
  nature:    { walker:'snail1', flyer:'bat1',      boss:'tuca1'     },
  graveyard: { walker:'snail2', flyer:'bat2',      boss:'spikebee1' },
  winter:    { walker:'tuca2',  flyer:'spikebee2', boss:'bat3'      },
  desert:    { walker:'tuca3',  flyer:'spikebee3', boss:'snail3'    },
  // نسخ إضافية تظهر في المراحل المتقدمة
  extra: {
    nature:    ['snail1','bat1','tuca1','spikebee4'],
    graveyard: ['snail2','bat2','spikebee1','tuca1'],
    winter:    ['tuca2','spikebee2','bat3','snail3'],
    desert:    ['tuca3','spikebee3','snail3','bat1'],
  }
};

// ديكورات كثيرة ومتنوعة لكل عالم
const WORLD_DECOS = {
  nature:    [
    'Tree_1.png','Tree_2.png','Tree_3.png',
    'Bush__1_.png','Bush__2_.png','Bush__3_.png',
    'Mushroom_1.png','Mushroom_2.png','Mushroom_3.png',
    'Flower_1.png','Flower_2.png','Flower_3.png',
    'Stone.png','Stone_2.png','Crate.png','Grass_1.png'
  ],
  graveyard: [
    'Tree.png','Dead_Tree.png',
    'TombStone__1_.png','TombStone__2_.png','TombStone__3_.png',
    'DeadBush.png','Bush__1_.png','Bush__2_.png',
    'Crate.png','Bone.png','Skull.png','Candle.png'
  ],
  winter:    [
    'Tree_1.png','Tree_2.png','Tree_3.png',
    'SnowMan.png','Stone.png','IceBox.png',
    'Crystal.png','Crystal_2.png','Crate.png',
    'IcePillar.png','Snowflake.png','Bush__1_.png'
  ],
  desert:    [
    'Cactus__1_.png','Cactus__2_.png','Cactus__3_.png',
    'Tree.png','Dead_Tree.png',
    'Bush__1_.png','Bush__2_.png',
    'Stone.png','Stone_2.png','Crate.png',
    'Skull.png','Barrel.png','Bone.png'
  ],
};

function rng(seed) {
  let s = seed;
  return () => { s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/0xffffffff; };
}

const G = 9; // GND_TOP row index
const GP = 0; // Platform raise offset (0 = original position)

// ══════════════════════════════════════════════════════════════
//  CHUNK BUILDERS — كل chunk عرضه 30 عمود
//  كل chunk: p=منصات، en=أعداء، co=عملات، ga=فجوات، br=كتل كسر، dc=ديكور
// ══════════════════════════════════════════════════════════════

function C(arr, c, r) { arr.push({c,r}); }  // helper

// chunk مفتوح مع ديكور كثيف وعملات وعدو واحد
function chunk_open(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  for(let c=2;c<29;c+=2) co.push({c,r:G-1});
  const pc=5+Math.floor(diff/2);
  p.push({c:pc,r:G-3,len:5});
  for(let i=0;i<5;i++) co.push({c:pc+i,r:G-4});
  p.push({c:20,r:G-2,len:4});
  // كتل كسر: دائماً صف أعلى من المنصة (r المنصة - 1 على الأقل)
  br.push({c:7,r:G-5,hasHeart:false});
  br.push({c:12,r:G-5,hasHeart:diff>=3});
  br.push({c:22,r:G-4,hasHeart:false});
  en.push({type:et.walker,c:15,r:G-1,fly:false,dir:1});
  en.push({type:et.walker,c:26,r:G-1,fly:false,dir:-1});
  if(diff>=3) en.push({type:et.flyer,c:10,r:G-5,fly:true,dir:1});
  dc.push({c:2,r:G-1,di:0},{c:5,r:G-1,di:1},{c:9,r:G-1,di:2},{c:13,r:G-1,di:3},
          {c:17,r:G-1,di:4},{c:21,r:G-1,di:0},{c:25,r:G-1,di:2},{c:28,r:G-1,di:5});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk فجوة مع منصات وأقواس عملات
function chunk_gap(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  const sz = Math.min(3+Math.floor(diff/2), 7);
  const gc = 8;
  ga.push({c:gc,len:sz});
  for(let c=2;c<gc;c+=2) co.push({c,r:G-1});
  for(let c=gc+sz+1;c<29;c+=2) co.push({c,r:G-1});
  if(sz>=5) { p.push({c:gc+2,r:G-4,len:2}); co.push({c:gc+2,r:G-5},{c:gc+3,r:G-5}); }
  p.push({c:3,r:G-3,len:3});
  // كتل كسر: صف أعلى من المنصة (G-3 → كتل عند G-5 على الأقل)
  br.push({c:4,r:G-5,hasHeart:diff>=2});
  br.push({c:gc+sz+2,r:G-5,hasHeart:false});
  br.push({c:25,r:G-5,hasHeart:false});
  const ae=gc+sz+3;
  if(ae<26) en.push({type:et.walker,c:ae,r:G-1,fly:false,dir:-1});
  if(ae+3<28) en.push({type:et.walker,c:ae+3,r:G-1,fly:false,dir:1});
  if(diff>=2) en.push({type:et.flyer,c:Math.floor(gc+sz/2),r:G-6,fly:true,dir:1});
  dc.push({c:2,r:G-1,di:0},{c:5,r:G-1,di:3},{c:gc-2,r:G-1,di:1},
          {c:gc+sz+2,r:G-1,di:2},{c:26,r:G-1,di:4},{c:28,r:G-1,di:0});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk سلالم صاعدة ونازلة
function chunk_climb(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  const steps=[{c:3,r:G-2,l:4},{c:9,r:G-3,l:4},{c:15,r:G-4,l:4},{c:21,r:G-3,l:4},{c:26,r:G-2,l:3}];
  for(const s of steps) {
    p.push({c:s.c,r:s.r,len:s.l});
    for(let i=0;i<s.l;i++) co.push({c:s.c+i,r:s.r-1});
  }
  // كتل كسر: أعلى من المنصة بصف (r_منصة - 2)
  br.push({c:5,r:G-4,hasHeart:false});   // منصة G-2 → كتلة G-4
  br.push({c:11,r:G-5,hasHeart:true});   // منصة G-3 → كتلة G-5
  br.push({c:17,r:G-6,hasHeart:false});  // منصة G-4 → كتلة G-6
  br.push({c:23,r:G-5,hasHeart:false});
  en.push({type:et.flyer,c:15,r:G-6,fly:true,dir:1});
  en.push({type:et.walker,c:6,r:G-1,fly:false,dir:1});
  en.push({type:et.walker,c:24,r:G-1,fly:false,dir:-1});
  dc.push({c:1,r:G-1,di:0},{c:7,r:G-1,di:1},{c:13,r:G-1,di:2},{c:19,r:G-1,di:3},
          {c:24,r:G-1,di:4},{c:28,r:G-1,di:0});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk أعداء متعددون مع منصات للتهرب
function chunk_enemies(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  const cnt=Math.min(3+Math.floor(diff/2),7);
  p.push({c:3,r:G-3,len:4});
  p.push({c:14,r:G-3,len:4});
  p.push({c:24,r:G-3,len:4});
  for(let i=0;i<4;i++) { co.push({c:3+i,r:G-4}); co.push({c:14+i,r:G-4}); co.push({c:24+i,r:G-4}); }
  // كتل كسر: صفان أعلى من المنصة (G-3 → G-5)
  br.push({c:4,r:G-5,hasHeart:false});
  br.push({c:15,r:G-5,hasHeart:true});
  br.push({c:25,r:G-5,hasHeart:false});
  br.push({c:10,r:G-5,hasHeart:false});
  br.push({c:20,r:G-5,hasHeart:false});
  for(let i=0;i<cnt;i++) {
    const c=3+Math.floor(i*24/cnt);
    en.push({type:et.walker,c,r:G-1,fly:false,dir:i%2?1:-1});
  }
  en.push({type:et.flyer,c:10,r:G-5,fly:true,dir:1});
  if(diff>=4) en.push({type:et.flyer,c:22,r:G-5,fly:true,dir:-1});
  if(diff>=6) en.push({type:et.flyer,c:16,r:G-7,fly:true,dir:1});
  dc.push({c:1,r:G-1,di:5},{c:8,r:G-1,di:1},{c:13,r:G-1,di:2},{c:19,r:G-1,di:3},{c:27,r:G-1,di:0});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk أشواك مع منصة عالية آمنة
function chunk_spikes(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[],sp=[];
  p.push({c:2,r:G-4,len:27});
  for(let c=2;c<29;c++) co.push({c,r:G-5});
  for(let c=2;c<28;c+=2) sp.push({c,r:G-1});
  en.push({type:et.flyer,c:8,r:G-7,fly:true,dir:1});
  en.push({type:et.flyer,c:22,r:G-7,fly:true,dir:-1});
  en.push({type:et.walker,c:5,r:G-1,fly:false,dir:1});
  // كتل كسر: 2 صف فوق المنصة (G-4 → G-6)
  br.push({c:6,r:G-6,hasHeart:false});
  br.push({c:10,r:G-6,hasHeart:false});
  br.push({c:14,r:G-6,hasHeart:true});
  br.push({c:18,r:G-6,hasHeart:false});
  br.push({c:22,r:G-6,hasHeart:false});
  dc.push({c:4,r:G-1,di:2},{c:10,r:G-1,di:0},{c:16,r:G-1,di:3},{c:22,r:G-1,di:1},{c:27,r:G-1,di:4});
  return {p,en,co,ga,br,dc,sp,w:30};
}

// chunk فجوتان مع جسر بينهما
function chunk_doubles(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  const g1=4,l1=3+Math.floor(diff/5);
  const g2=16,l2=3+Math.floor(diff/4);
  ga.push({c:g1,len:l1},{c:g2,len:l2});
  const bs=g1+l1+1, be=g2-1;
  if(be>bs) { p.push({c:bs,r:G-2,len:be-bs}); for(let c=bs;c<be;c++) co.push({c,r:G-3}); }
  p.push({c:2,r:G-3,len:2});
  p.push({c:g2+l2+1,r:G-3,len:3});
  // كتل كسر: صف أعلى من المنصة (G-2 → G-4، G-3 → G-5)
  br.push({c:3,r:G-5,hasHeart:false});
  br.push({c:Math.floor((bs+be)/2),r:G-4,hasHeart:true});
  br.push({c:g2+l2+2,r:G-5,hasHeart:false});
  for(let c=g2+l2+1;c<28;c+=2) co.push({c,r:G-1});
  for(let c=2;c<g1;c+=2) co.push({c,r:G-1});
  en.push({type:et.flyer,c:Math.floor((g1+g2)/2),r:G-5,fly:true,dir:1});
  if(g2+l2+3<28) en.push({type:et.walker,c:g2+l2+3,r:G-1,fly:false,dir:-1});
  en.push({type:et.walker,c:2,r:G-1,fly:false,dir:1});
  if(diff>=3) en.push({type:et.flyer,c:g2+2,r:G-5,fly:true,dir:-1});
  dc.push({c:2,r:G-1,di:1},{c:g1-2,r:G-1,di:3},{c:g2+l2+2,r:G-1,di:0},{c:27,r:G-1,di:2});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk الرئيس الكبير
function chunk_boss(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  p.push({c:2,r:G-3,len:5});
  p.push({c:12,r:G-5,len:7});
  p.push({c:23,r:G-3,len:5});
  en.push({type:et.boss,c:14,r:G-8,fly:true,dir:-1});
  en.push({type:et.flyer,c:5,r:G-4,fly:true,dir:1});
  en.push({type:et.flyer,c:24,r:G-4,fly:true,dir:-1});
  en.push({type:et.walker,c:3,r:G-1,fly:false,dir:1});
  en.push({type:et.walker,c:26,r:G-1,fly:false,dir:-1});
  en.push({type:et.walker,c:14,r:G-1,fly:false,dir:1});
  // كتل كسر: G-3 → G-5، G-5 → G-7
  br.push({c:6,r:G-5,hasHeart:false});
  br.push({c:13,r:G-7,hasHeart:true});
  br.push({c:15,r:G-7,hasHeart:false});
  br.push({c:17,r:G-7,hasHeart:true});
  br.push({c:24,r:G-5,hasHeart:false});
  br.push({c:10,r:G-5,hasHeart:false});
  br.push({c:20,r:G-5,hasHeart:false});
  for(let c=2;c<29;c+=2) co.push({c,r:G-1});
  for(let c=12;c<19;c++) co.push({c,r:G-6});
  dc.push({c:1,r:G-1,di:0},{c:10,r:G-1,di:2},{c:21,r:G-1,di:4},{c:28,r:G-1,di:1});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk كتل قابلة للكسر كثيرة
function chunk_breakables(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  // طبقة أولى مرتفعة عن الأرض
  for(let c=3;c<27;c+=2) br.push({c,r:G-3,hasHeart:c===13||c===21});
  for(let c=5;c<25;c+=3) br.push({c,r:G-5,hasHeart:c===14||c===17});
  for(let c=7;c<22;c+=4) br.push({c,r:G-7,hasHeart:c===11});
  for(let c=3;c<27;c+=2) co.push({c,r:G-4});
  for(let c=5;c<25;c+=3) co.push({c,r:G-6});
  en.push({type:et.walker,c:8,r:G-1,fly:false,dir:1});
  en.push({type:et.walker,c:20,r:G-1,fly:false,dir:-1});
  en.push({type:et.walker,c:14,r:G-1,fly:false,dir:1});
  en.push({type:et.flyer,c:14,r:G-7,fly:true,dir:1});
  if(diff>=5) en.push({type:et.flyer,c:7,r:G-5,fly:true,dir:-1});
  dc.push({c:2,r:G-1,di:0},{c:11,r:G-1,di:3},{c:18,r:G-1,di:1},{c:26,r:G-1,di:5});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk تسلق عمودي — منصات على مستويات متعددة
function chunk_tower(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  const tiers=[
    {c:1, r:G-2,l:6}, {c:11,r:G-2,l:6}, {c:22,r:G-2,l:7},
    {c:4, r:G-4,l:5}, {c:16,r:G-4,l:5},
    {c:8, r:G-6,l:6}, {c:20,r:G-6,l:6},
  ];
  for(const t of tiers) {
    p.push({c:t.c,r:t.r,len:t.l});
    for(let i=0;i<t.l;i++) co.push({c:t.c+i,r:t.r-1});
  }
  // كتل كسر: بين المستويات (لا تحجب المنصات)
  br.push({c:5,r:G-4,hasHeart:false});   // بين G-2 وG-4
  br.push({c:15,r:G-4,hasHeart:false});
  br.push({c:25,r:G-4,hasHeart:false});
  br.push({c:9,r:G-6,hasHeart:true});    // بين G-4 وG-6
  br.push({c:21,r:G-6,hasHeart:false});
  en.push({type:et.flyer,c:9,r:G-4,fly:true,dir:1});
  en.push({type:et.flyer,c:21,r:G-5,fly:true,dir:-1});
  en.push({type:et.walker,c:5,r:G-1,fly:false,dir:1});
  en.push({type:et.walker,c:25,r:G-1,fly:false,dir:-1});
  if(diff>=6) en.push({type:et.boss,c:14,r:G-8,fly:true,dir:1});
  dc.push({c:1,r:G-1,di:0},{c:10,r:G-1,di:2},{c:21,r:G-1,di:3},{c:28,r:G-1,di:1});
  return {p,en,co,ga,br,dc,w:30};
}

// chunk ممر ضيق مع عقبات
function chunk_tunnel(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[],sp=[];
  p.push({c:2,r:G-4,len:27});
  for(let c=2;c<29;c+=2) co.push({c,r:G-2});
  for(let c=4;c<26;c+=5) sp.push({c,r:G-1});
  // كتل كسر: 2 صف فوق المنصة (G-4 → G-6)
  for(let c=5;c<25;c+=4) br.push({c,r:G-6,hasHeart:c===13});
  en.push({type:et.walker,c:8,r:G-1,fly:false,dir:1});
  en.push({type:et.walker,c:20,r:G-1,fly:false,dir:-1});
  en.push({type:et.walker,c:14,r:G-1,fly:false,dir:1});
  en.push({type:et.flyer,c:14,r:G-3,fly:true,dir:1});
  if(diff>=5) en.push({type:et.flyer,c:8,r:G-3,fly:true,dir:-1});
  dc.push({c:2,r:G-1,di:0},{c:8,r:G-1,di:2},{c:16,r:G-1,di:1},{c:24,r:G-1,di:3});
  return {p,en,co,ga,br,dc,sp,w:30};
}

// chunk معقد: فجوة + منصات عائمة متعددة + أعداء
function chunk_complex(et, diff, dl) {
  const p=[],en=[],co=[],ga=[],br=[],dc=[];
  ga.push({c:6,len:3});
  const plats=[{c:2,r:G-3,l:3},{c:9,r:G-4,l:3},{c:14,r:G-2,l:3},{c:20,r:G-5,l:3},{c:25,r:G-3,l:3}];
  for(const s of plats) {
    p.push({c:s.c,r:s.r,len:s.l});
    for(let i=0;i<s.l;i++) co.push({c:s.c+i,r:s.r-1});
  }
  // كتل كسر: صفان أعلى من كل منصة
  br.push({c:3,r:G-5,hasHeart:false});   // منصة G-3 → G-5
  br.push({c:10,r:G-6,hasHeart:true});   // منصة G-4 → G-6
  br.push({c:21,r:G-7,hasHeart:false});  // منصة G-5 → G-7
  br.push({c:26,r:G-5,hasHeart:false});  // منصة G-3 → G-5
  en.push({type:et.flyer,c:12,r:G-6,fly:true,dir:-1});
  en.push({type:et.walker,c:17,r:G-1,fly:false,dir:1});
  en.push({type:et.walker,c:3,r:G-1,fly:false,dir:-1});
  en.push({type:et.walker,c:27,r:G-1,fly:false,dir:1});
  if(diff>=5) en.push({type:et.flyer,c:23,r:G-7,fly:true,dir:1});
  dc.push({c:2,r:G-1,di:1},{c:9,r:G-1,di:0},{c:14,r:G-1,di:3},{c:20,r:G-1,di:2},{c:25,r:G-1,di:4});
  return {p,en,co,ga,br,dc,w:30};
}

// ══════════════════════════════════════════════════════════════
//  تسلسل المراحل — يتدرج الطول والصعوبة
//  المرحلة 1: 5 chunks (150 عمود) — قصيرة جداً
//  المرحلة 10: 20 chunk (600 عمود) — طويلة جداً
// ══════════════════════════════════════════════════════════════

const LEVEL_SEQUENCES = {
  1:  ['open','gap','open','climb'],
  2:  ['open','gap','climb','enemies','open'],
  3:  ['open','gap','enemies','climb','open','gap'],
  4:  ['open','gap','climb','enemies','doubles','spikes'],
  5:  ['open','gap','doubles','enemies','climb','spikes','open'],
  6:  ['open','gap','enemies','climb','doubles','spikes','breakables','enemies'],
  7:  ['open','gap','doubles','enemies','tower','spikes','climb','complex','enemies'],
  8:  ['open','gap','tower','enemies','doubles','spikes','complex','breakables','climb','boss'],
  9:  ['open','gap','tower','complex','enemies','doubles','spikes','boss','breakables','tunnel','enemies','climb'],
  10: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','enemies','boss','gap','spikes','climb','boss'],
  // ── مراحل 11-25: أطول وأصعب تدريجياً ──
  11: ['open','gap','enemies','doubles','climb','tower','spikes','boss','complex'],
  12: ['open','gap','doubles','enemies','tower','spikes','complex','breakables','climb','boss','gap','enemies'],
  13: ['open','gap','tower','complex','enemies','boss','spikes','doubles','breakables','tunnel','climb','enemies','gap'],
  14: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','gap','climb'],
  15: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','gap','complex','spikes'],
  16: ['open','gap','complex','enemies','boss','doubles','spikes','tunnel','breakables','tower','climb','boss','gap','enemies','complex','boss'],
  17: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','gap','complex','tower','spikes','climb','boss'],
  18: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','gap','spikes','climb','boss','enemies','doubles'],
  19: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','gap','spikes','climb','boss','enemies','doubles','boss','complex'],
  20: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','enemies','boss','gap','spikes','climb','boss','doubles','complex','boss','enemies','boss'],
  21: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','gap','boss','doubles','spikes','climb','boss','enemies','complex','gap','tower','boss'],
  22: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','gap','spikes','climb','boss','enemies','doubles','boss','complex','tunnel','gap','tower','boss'],
  23: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','gap','spikes','climb','boss','enemies','doubles','boss','complex','tunnel','gap','boss','spikes','enemies'],
  24: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','gap','spikes','climb','boss','enemies','doubles','boss','complex','tunnel','gap','tower','boss','spikes','enemies','doubles'],
  25: ['open','gap','tower','complex','enemies','boss','doubles','spikes','tunnel','breakables','enemies','boss','tower','complex','enemies','boss','gap','spikes','climb','boss','doubles','complex','boss','enemies','boss','tunnel','spikes','complex','boss','doubles'],
};

function getLevelChunks(diff, et, dl) {
  const seq = LEVEL_SEQUENCES[diff] || LEVEL_SEQUENCES[5];
  const map = {
    open:       ()=>chunk_open(et,diff,dl),
    gap:        ()=>chunk_gap(et,diff,dl),
    climb:      ()=>chunk_climb(et,diff,dl),
    enemies:    ()=>chunk_enemies(et,diff,dl),
    spikes:     ()=>chunk_spikes(et,diff,dl),
    doubles:    ()=>chunk_doubles(et,diff,dl),
    boss:       ()=>chunk_boss(et,diff,dl),
    breakables: ()=>chunk_breakables(et,diff,dl),
    tower:      ()=>chunk_tower(et,diff,dl),
    tunnel:     ()=>chunk_tunnel(et,diff,dl),
    complex:    ()=>chunk_complex(et,diff,dl),
  };
  return seq.map(t=>(map[t]||map.open)());
}

function generateLevel(n) {
  const worldIdx = Math.floor((n-1)/25);          // 0-3 (كل عالم 25 مرحلة)
  const theme    = WORLD_THEMES[Math.min(worldIdx,3)];
  const time     = WORLD_TIMES[Math.min(worldIdx,3)];
  const diff     = ((n-1)%25)+1;                  // 1-25 داخل كل عالم
  const rand     = rng(n*7919+31337);
  const dl       = WORLD_DECOS[theme];
  const ROWS=14, GND_TOP=9;

  // اختيار الأعداء بناءً على الصعوبة — المراحل المتأخرة تضيف أعداء إضافيين
  const baseEt = WORLD_ENEMIES[theme];
  const extraPool = WORLD_ENEMIES.extra[theme];
  // في المراحل 13+ تُضاف أنواع إضافية للـ walker و flyer
  const et = {
    walker: diff <= 12 ? baseEt.walker : extraPool[(diff-13) % extraPool.length] || baseEt.walker,
    flyer:  diff <= 10 ? baseEt.flyer  : (diff <= 18 ? extraPool[1] : extraPool[2]) || baseEt.flyer,
    boss:   diff <= 15 ? baseEt.boss   : extraPool[Math.floor(diff/8) % extraPool.length] || baseEt.boss,
  };

  const seqKey = Math.min(diff, 25);
  const chunks = getLevelChunks(seqKey, et, dl);

  const COLS = 8 + chunks.reduce((s,c)=>s+c.w,0) + 8;

  const cells=[];
  for(let r=0;r<ROWS;r++) cells[r]=new Int8Array(COLS);
  for(let r=GND_TOP;r<ROWS;r++) for(let c=0;c<COLS;c++) cells[r][c]=1;

  const platforms=[],enemies=[],coins=[],gaps=[],breakables=[],ammos=[],decos=[],spikes=[];

  let off=8;
  for(const chunk of chunks){
    const W=chunk.w;

    for(const g of chunk.ga){
      for(let gc=g.c;gc<Math.min(g.c+g.len,W-1);gc++)
        for(let r=GND_TOP;r<ROWS;r++) cells[r][off+gc]=0;
      gaps.push({c:off+g.c,len:g.len});
    }
    for(const p of chunk.p){
      for(let c=p.c;c<p.c+p.len;c++){const wc=off+c;if(wc>0&&wc<COLS-1)cells[p.r][wc]=2;}
      platforms.push({c:off+p.c,r:p.r,len:p.len});
    }
    for(const b of chunk.br) {
      // نسبة 40% للعملة في كتل الكسر (hasHeart=false → coin بنسبة 40%)
      const hasCoin = !b.hasHeart && rand() < 0.40;
      breakables.push({c:off+b.c, r:b.r, hasHeart:b.hasHeart, hasCoin});
    }
    for(const s of (chunk.sp||[])) spikes.push({c:off+s.c,r:s.r});
    for(const co of chunk.co){
      const wc=off+co.c;
      if(wc>0&&wc<COLS-1&&cells[co.r]&&cells[co.r][wc]===0) coins.push({c:wc,r:co.r});
    }
    for(const e of chunk.en) enemies.push({...e,c:off+e.c});

    // ديكور: يُضاف فقط إذا لم يكن فوق فجوة
    for(const d of (chunk.dc||[])){
      const wc=off+d.c;
      if(wc>0&&wc<COLS-2){
        // تحقق أن العمود ليس فوق فجوة
        const onGap = gaps.some(g => wc >= g.c && wc < g.c + g.len);
        if(!onGap){
          const imgName=dl[((d.di||0)+wc)%dl.length];
          decos.push({c:wc,r:d.r!==undefined?d.r:GND_TOP-1,img:imgName});
        }
      }
    }

    off+=W;
  }

  // ضمان 3 قلوب بالضبط في كل مرحلة موزعة على كتل الكسر
  const heartCount = breakables.filter(b => b.hasHeart).length;
  if (heartCount < 3 && breakables.length > 0) {
    // أضف قلوباً إضافية حتى نصل لـ 3
    const noHeart = breakables.filter(b => !b.hasHeart && !b.hasCoin);
    let toAdd = 3 - heartCount;
    // وزّع القلوب على أجزاء مختلفة من المستوى
    const step = Math.max(1, Math.floor(noHeart.length / (toAdd + 1)));
    for (let i = 0; i < noHeart.length && toAdd > 0; i += step) {
      noHeart[i].hasHeart = true;
      toAdd--;
    }
  } else if (heartCount > 3) {
    // احذف القلوب الزائدة — ابق فقط 3 موزعة
    let kept = 0;
    for (const b of breakables) {
      if (b.hasHeart) {
        if (kept < 3) kept++;
        else b.hasHeart = false;
      }
    }
  }

  const inGap=c=>gaps.some(g=>c>=g.c&&c<g.c+g.len);

  // ذخيرة منتظمة
  for(let c=6;c<COLS-4;c+=15){
    if(!inGap(c)&&cells[GND_TOP]&&cells[GND_TOP][c]===1&&cells[GND_TOP-1]&&cells[GND_TOP-1][c]===0)
      ammos.push({c,r:GND_TOP-1});
  }

  // ديكور إضافي كثيف في الفراغات (كل 4 أعمدة)
  // ديكور إضافي كثيف — فقط على الأرض الصلبة وليس فوق منصات
  for(let c=3;c<COLS-3;c+=4){
    const rr=GND_TOP-1; // الصف فوق الأرض مباشرة
    const onSolidGround = cells[GND_TOP]&&cells[GND_TOP][c]===1; // أرض صلبة تحته
    const cellAboveFree = cells[rr]&&cells[rr][c]===0;           // الخلية فارغة (ليس منصة)
    const notOnPlatform = !platforms.some(p=>c>=p.c&&c<p.c+p.len&&p.r===rr); // ليس فوق منصة
    if(!inGap(c)&&onSolidGround&&cellAboveFree&&notOnPlatform){
      const tooClose=decos.some(d=>Math.abs(d.c-c)<3);
      if(!tooClose){
        const imgName=dl[Math.floor(rand()*dl.length)];
        decos.push({c,r:rr,img:imgName});
      }
    }
  }

  return {
    world:worldIdx+1,theme,time,
    cols:COLS,rows:ROWS,gndRow:GND_TOP,
    cells,platforms,breakables,coins,gaps,enemies,ammos,decos,
    spikes,springs:[],traps:[],
    goal:{c:COLS-5,r:GND_TOP-1},
    startCol:1,startRow:GND_TOP-1,
    tileSet:TILE_VARIANTS[theme],
    diff, // نحتفظ بالصعوبة للعرض
  };
}

const LEVELS={};
for(let i=1;i<=100;i++) LEVELS[i]=generateLevel(i);
