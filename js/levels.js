'use strict';

// ═══════════════════════════════════════════════════════════════════
//  SUPER COWBOY — js/levels.js
//  A+B: المراحل 1–50 (Nature + Graveyard) — قابلة للتشغيل الآن
//  C (سيأتي لاحقاً): يستبدل خطط 51–100 بالخطط اليدوية + قطع Winter/Desert
// ═══════════════════════════════════════════════════════════════════

const WORLD_THEMES = ['nature','graveyard','winter','desert'];
const WORLD_TIMES  = [180, 210, 240, 270];

const TILE_VARIANTS = {
  nature:    { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
  graveyard: { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
  winter:    { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
  desert:    { gnd_top_left:2,gnd_top_mid:3,gnd_top_right:4,gnd_mid_left:5,gnd_mid_fill:6,gnd_mid_right:7,gnd_bot_left:8,gnd_bot_mid:9,gnd_bot_right:10,plat_left:15,plat_mid:14,plat_right:13,breakable:18 },
};

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
  nature:    ['Tree_1.png','Tree_2.png','Tree_3.png','Bush__1_.png','Bush__2_.png','Bush__3_.png','Mushroom_1.png','Mushroom_2.png','Mushroom_3.png','Flower_1.png','Flower_2.png','Flower_3.png','Stone.png','Stone_2.png','Crate.png','Grass_1.png'],
  graveyard: ['Tree.png','Dead_Tree.png','TombStone__1_.png','TombStone__2_.png','TombStone__3_.png','DeadBush.png','Bush__1_.png','Bush__2_.png','Crate.png','Bone.png','Skull.png','Candle.png'],
  winter:    ['Tree_1.png','Tree_2.png','Tree_3.png','SnowMan.png','Stone.png','IceBox.png','Crystal.png','Crystal_2.png','Crate.png','IcePillar.png','Snowflake.png','Bush__1_.png'],
  desert:    ['Cactus__1_.png','Cactus__2_.png','Cactus__3_.png','Tree.png','Dead_Tree.png','Bush__1_.png','Bush__2_.png','Stone.png','Stone_2.png','Crate.png','Skull.png','Barrel.png','Bone.png'],
};

function rng(seed) {
  let s = seed >>> 0;
  const f = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 6; i++) f();
  return f;
}

const G = 9;
const isFlyerType = t => t.startsWith('bat') || t.startsWith('spikebee');
const CELL = { AIR:0, GND:1, PLT:2, SPIKE:8, SPRING:10, CRUMBLE:11 };

const mk = () => ({ p:[], en:[], co:[], ga:[], br:[], sp:[], spr:[], cr:[], hl:[], am:[], w:30 });
const W_ = (x,k,c,d) => k.en.push({ type:x.W(), c, r:G-1, fly:false, dir:d||(x.rand()<.5?1:-1) });
const F_ = (x,k,c,r,d) => k.en.push({ type:x.F(), c, r, fly:true, dir:d||(x.rand()<.5?1:-1) });
const coinsH = (k,c0,n,r,step) => { for (let i=0;i<n;i++) k.co.push({c:c0+i*(step||1), r}); };
const arc = (k,c0,len,r,h) => { for (let i=0;i<len;i++) k.co.push({c:c0+i, r:r-Math.round(Math.sin(Math.PI*(i+.5)/len)*h)}); };
const plat = (k,c,r,len,coins) => { k.p.push({c,r,len}); if (coins!==false) coinsH(k,c,len,r-1); };
const brk = (k,c,r,heart) => k.br.push({c,r,hasHeart:!!heart});
const spk = (x,k,c) => { const v=(x.spk++%2)+1, w=v===1?3:4; k.sp.push({c,w,v}); return w; };

// ══════════════════════════════════════════════════════════════
//  القطع الأصلية (المرجع — بدون تغيير)
// ══════════════════════════════════════════════════════════════
function ch_open(x) { const k=mk(); coinsH(k,2,13,G-1,2); const pc=x.ri(6,16), L=x.ri(4,6); plat(k,pc,G-3,L); brk(k,pc+1,G-8,x.rand()<.3); if (x.diff>=2) W_(x,k,x.ri(10,14)); if (x.diff>=4) W_(x,k,x.ri(20,26)); if (x.diff>=6) F_(x,k,x.ri(8,20),G-6); return k; }
function ch_gap(x) { const k=mk(); const sz=x.ri(3,Math.min(5,3+(x.diff>>3))), gc=x.ri(6,12); k.ga.push({c:gc,len:sz}); coinsH(k,2,Math.max(1,(gc-3)>>1),G-1,2); arc(k,gc-1,sz+2,G-2,3); if (sz>=5) plat(k,gc+(sz>>1)-1,G-3,2,false); brk(k,gc+sz+2,G-5,false); W_(x,k,gc+sz+x.ri(4,6)); if (x.diff>=3) F_(x,k,gc+(sz>>1),G-6); return k; }
function ch_gap_series(x) { const k=mk(); const maxSz=Math.min(4,2+(x.diff>>3)+(x.diff>=3?1:0)); let c=x.ri(5,6), n=0; while (n<3){ const sz=x.ri(2,maxSz); if (c+sz>26) break; k.ga.push({c,len:sz}); arc(k,c-1,sz+2,G-2,3); c+=sz+x.ri(4,5); n++; } if (x.diff>=2) W_(x,k,x.ri(3,5)+ (k.ga[0]?k.ga[0].c+k.ga[0].len+1:8)); if (x.diff>=5) F_(x,k,x.ri(10,22),G-6); brk(k,x.ri(8,22),G-5,x.rand()<.3); return k; }
function ch_mountain(x) { const k=mk(); const hmax=x.diff<4?2:3; let c=x.ri(3,5); for (let h=1;h<=hmax;h++){ k.hl.push({c,len:2,h}); coinsH(k,c,2,G-h-1); c+=2; } const pl=x.ri(4,6); k.hl.push({c,len:pl,h:hmax}); coinsH(k,c,pl,G-hmax-1); brk(k,c+(pl>>1),G-hmax-5,x.rand()<.4); if (x.diff>=3) W_(x,k,c+1); c+=pl; for (let h=hmax-1;h>=1;h--){ k.hl.push({c,len:2,h}); coinsH(k,c,2,G-h-1); c+=2; } if (x.diff>=5) F_(x,k,c-pl,G-8); if (x.diff>=2) W_(x,k,Math.min(c+3,26)); return k; }
function ch_pillars(x) { const k=mk(); let c=x.ri(4,5); const n=x.diff>=8?4:3; for (let i=0;i<n&&c<=24;i++){ const h=x.ri(2,3); k.hl.push({c,len:2,h}); coinsH(k,c,2,G-h-1); if (i>0 && x.diff>=2) W_(x,k,c-3); c+=2+x.ri(4,5); } if (x.diff>=5) F_(x,k,x.ri(10,18),G-6); brk(k,x.ri(8,20),G-5,x.rand()<.3); return k; }
function ch_pit(x) { const k=mk(); const gc=x.ri(4,5), len=x.ri(9,12); k.ga.push({c:gc,len}); let cur=gc, r=G-2; for (;;) { const L=x.ri(2,3); plat(k,cur,r,L); if (cur+L>=gc+len-2) break; cur+=L+x.ri(2,3); r=Math.max(G-4,Math.min(G-2,r+x.ri(-1,1))); } if (x.diff>=3) F_(x,k,gc+(len>>1),G-6); W_(x,k,gc+len+x.ri(3,5)); return k; }
function ch_crumble(x) { const k=mk(); const gc=x.ri(4,5), len=x.ri(8,11); k.ga.push({c:gc,len}); const alt=x.diff>=9 && x.rand()<.6; for (let i=0;i<len;i++){ if (alt && i%3===2) continue; k.cr.push({c:gc+i,r:G}); } coinsH(k,gc,len,G-2); if (x.diff>=4) F_(x,k,gc+(len>>1),G-5); W_(x,k,gc+len+x.ri(3,5)); return k; }
function ch_crumble_islands(x) { const k=mk(); const gc=4, len=20; k.ga.push({c:gc,len}); const rows=[G-1,G-2,G-1,G-2]; for (let i=0;i<4;i++){ const c=gc+1+i*5; for (let j=0;j<3;j++) k.cr.push({c:c+j,r:rows[i]}); coinsH(k,c,3,rows[i]-1); } F_(x,k,gc+9,G-6); W_(x,k,gc+len+3); return k; }
function ch_spring_tower(x) { const k=mk(); k.spr.push({c:5,r:G-1}); brk(k,2,G-5,true); plat(k,8,G-5,7); plat(k,17,G-4,5); coinsH(k,9,5,G-8); if (x.diff>=7) spk(x,k,10); W_(x,k,x.ri(20,24)); if (x.diff>=4) F_(x,k,14,G-7); return k; }
function ch_sky_islands(x) { const k=mk(); const gc=5, len=18; k.ga.push({c:gc,len}); k.spr.push({c:3,r:G-1}); plat(k,7,G-5,5); plat(k,14,G-4,3); plat(k,19,G-3,3); arc(k,12,4,G-8,1); if (x.diff>=4) F_(x,k,16,G-7); W_(x,k,gc+len+3); return k; }
function ch_coin_heaven(x) { const k=mk(); k.spr.push({c:4,r:G-1}); plat(k,8,G-5,10); coinsH(k,9,8,G-7); coinsH(k,10,6,G-8); coinsH(k,2,12,G-1,2); coinsH(k,20,5,G-1,2); if (x.diff>=3) W_(x,k,x.ri(21,25)); return k; }
function ch_spikes(x) { const k=mk(); let c=x.ri(6,8); for (let i=0;i<3;i++){ const v=(x.spk%2)+1, w=v===1?3:4; if (c+w>24) break; spk(x,k,c); arc(k,c-1,w+2,G-2,3); c+=w+x.ri(6,7); if (i===0 && x.diff>=3 && x.rand()<.5) W_(x,k,c-3); if (x.diff<8 && i>=1) break; } brk(k,x.ri(8,20),G-5,false); if (x.diff>=5) F_(x,k,x.ri(10,20),G-6); return k; }
function ch_spike_tunnel(x) { const k=mk(); plat(k,3,G-3,25); let c=7; while (c+4<=24){ const w=spk(x,k,c); c+=w+x.ri(3,4); } W_(x,k,9); W_(x,k,20); if (x.diff>=6) F_(x,k,12,G-6); brk(k,14,G-8,true); return k; }
function ch_horde(x) { const k=mk(); [3,13,23].forEach(c=>plat(k,c,G-3,4)); const cnt=Math.min(3+(x.diff>>2),6); for (let i=0;i<cnt;i++) W_(x,k,5+Math.floor(i*22/cnt),i%2?1:-1); if (x.diff>=5) F_(x,k,10,G-5); if (x.diff>=9) F_(x,k,22,G-5); brk(k,14,G-8,x.rand()<.4); return k; }
function ch_flyers(x) { const k=mk(); const n=Math.min(2+(x.diff>>3),4); for (let i=0;i<n;i++) F_(x,k,6+i*6,G-4-(i%3)*1.5|0,i%2?1:-1); plat(k,x.ri(8,12),G-3,5); arc(k,3,8,G-2,2); W_(x,k,x.ri(18,24)); brk(k,x.ri(14,22),G-5,false); return k; }
function ch_mesa(x) { const k=mk(); const top=x.diff>=10?5:4; k.hl.push({c:4,len:2,h:2},{c:6,len:2,h:top-1>3?3:top-1},{c:8,len:10,h:top},{c:18,len:2,h:2}); coinsH(k,9,8,G-top-1); if (x.diff>=3) W_(x,k,24); if (x.diff>=6) F_(x,k,13,G-top-3); return k; }
function ch_quiet(x) { const k=mk(); coinsH(k,2,8,G-1,3); return k; }
function ch_block_wall(x) { const k=mk(); k.am.push({c:4,r:G-1}); const w1=x.ri(10,13); for (let r=G-3;r<=G-1;r++) brk(k,w1,r,r===G-3); coinsH(k,w1+2,4,G-1); const w2=x.ri(20,24); for (let r=G-3;r<=G-1;r++) brk(k,w2,r,false); arc(k,w2-3,7,G-5,2); W_(x,k,w1-4); if (x.diff>=4) W_(x,k,w1+5); return k; }
function ch_vault(x) { const k=mk(); plat(k,8,G-3,12); for (let c=9;c<=18;c++) k.br.push({c,r:G-8,hasHeart:c===12||c===16}); for (let c=3;c<=6;c+=3) brk(k,c,G-5,false); W_(x,k,x.ri(4,6)); W_(x,k,x.ri(22,26)); if (x.diff>=4) F_(x,k,14,G-6); return k; }
function ch_zigzag(x) { const k=mk(); let r=G-3; for (let i=0;i<5;i++){ plat(k,2+i*5,r,3); r=Math.max(G-5,Math.min(G-2,r+x.ri(-2,2))); } const gc=x.ri(8,18); if (x.diff>=3 && !k.p.some(p=>gc+3>p.c && gc<p.c+p.len)) k.ga.push({c:gc,len:3}); W_(x,k,x.ri(4,8)); W_(x,k,x.ri(20,26)); if (x.diff>=5) F_(x,k,x.ri(10,20),G-7); return k; }
function ch_rest(x) { const k=mk(); coinsH(k,2,13,G-1,2); k.am.push({c:14,r:G-1}); brk(k,10,G-5,true); brk(k,18,G-5,false); return k; }
function ch_boss(x) { const k=mk(); plat(k,2,G-3,5); plat(k,12,G-5,7); plat(k,23,G-3,5); k.am.push({c:4,r:G-1}); k.en.push({type:x.B,c:14,r:G-8,fly:true,dir:-1}); if (x.diff>=25) k.en.push({type:x.B,c:22,r:G-8,fly:true,dir:1}); F_(x,k,5,G-5,1); F_(x,k,24,G-5,-1); W_(x,k,3,1); W_(x,k,26,-1); if (x.diff>=10) W_(x,k,14,1); k.br.push({c:13,r:G-10+2,hasHeart:true},{c:17,r:G-10+2,hasHeart:true}); coinsH(k,2,27,G-1,2); coinsH(k,12,7,G-6); return k; }
function ch_finale(x) { const k=mk(); coinsH(k,2,14,G-1,2); W_(x,k,10); if (x.diff>=6) W_(x,k,15); k.hl.push({c:19,len:2,h:1},{c:21,len:2,h:2},{c:23,len:3,h:3}); coinsH(k,19,2,G-2); coinsH(k,21,2,G-3); coinsH(k,23,3,G-4); return k; }

// ══════════════════════════════════════════════════════════════
//  11 قطعة Nature جديدة
// ══════════════════════════════════════════════════════════════
function ch_low_arc(x){const k=mk();coinsH(k,2,10,G-1,1);arc(k,4,8,G-2,2);if(x.diff>=3)spk(x,k,14);if(x.diff>=5)W_(x,k,22);return k;}
function ch_double_gap(x){const k=mk();const g1=x.ri(6,8),g2=g1+x.ri(6,7);const w1=Math.min(4,2+(x.diff>>3)),w2=Math.min(5,3+(x.diff>>3));k.ga.push({c:g1,len:w1});k.ga.push({c:g2,len:w2});plat(k,g1+w1+1,G-2,Math.max(2,g2-(g1+w1)-2),true);arc(k,g1-1,w1+2,G-2,2);arc(k,g2-1,w2+2,G-2,2);if(x.diff>=6)F_(x,k,(g1+g2)>>1,G-6);return k;}
function ch_stair_tower(x){const k=mk();const base=x.ri(4,6);const steps=x.diff>=8?4:3;for(let i=0;i<steps;i++){plat(k,base+i*4,G-3-i*2,3);coinsH(k,base+i*4,3,G-4-i*2);}const topC=base+steps*4;k.am.push({c:Math.min(topC,25),r:G-3-steps*2});if(x.diff>=5)F_(x,k,base+(steps*4>>1),G-7);if(x.diff>=3)W_(x,k,Math.min(topC+4,26));return k;}
function ch_stairs_up(x){const k=mk();const hmax=x.diff>=8?4:3;let c=x.ri(3,4);for(let h=1;h<=hmax&&c+2<=24;h++){k.hl.push({c,len:2,h});coinsH(k,c,2,G-h-1);c+=2;}const peak=c;k.hl.push({c:peak,len:3,h:hmax});coinsH(k,peak,3,G-hmax-1);k.am.push({c:peak+1,r:G-hmax-1});c+=3;for(let h=hmax-1;h>=1&&c+2<=26;h--){k.hl.push({c,len:2,h});coinsH(k,c,2,G-h-1);c+=2;}if(x.diff>=4)W_(x,k,Math.min(c+1,26));return k;}
function ch_zig_zig(x){const k=mk();const n=x.diff>=6?5:4;let r=G-3,c=x.ri(2,3);for(let i=0;i<n;i++){const len=3;plat(k,c,r,len);coinsH(k,c,len,r-1);c+=len+x.ri(2,3);r=Math.max(G-5,Math.min(G-2,r+(i%2===0?-1:1)));if(c+len>27)break;}if(x.diff>=4)F_(x,k,14,G-6);if(x.diff>=3)W_(x,k,24);return k;}
function ch_tunnel(x){const k=mk();plat(k,3,G-4,24);coinsH(k,4,22,G-5,2);coinsH(k,5,20,G-2,2);const cnt=Math.min(2+(x.diff>>3),4);for(let i=0;i<cnt;i++)W_(x,k,6+Math.floor(i*18/cnt),i%2?1:-1);if(x.diff>=5)F_(x,k,14,G-6);return k;}
function ch_wall_shoot(x){const k=mk();const c=x.ri(8,12);for(let r=G-3;r<G;r++)brk(k,c,r,r===G-3);k.am.push({c:c-3,r:G-1});k.am.push({c:c+4,r:G-1});coinsH(k,c+2,4,G-1);plat(k,c-1,G-5,3);coinsH(k,c-1,3,G-6);if(x.diff>=4)W_(x,k,c+6);return k;}
function ch_spring_chain(x){const k=mk();k.spr.push({c:5,r:G-1});plat(k,8,G-5,5);coinsH(k,8,5,G-6);k.spr.push({c:15,r:G-1});plat(k,18,G-4,6);coinsH(k,18,6,G-5);if(x.diff>=4)F_(x,k,12,G-8);if(x.diff>=6)W_(x,k,24);return k;}
function ch_spike_field(x){const k=mk();let c=x.ri(7,9);const cnt=x.diff>=8?2:1;for(let i=0;i<cnt&&c+5<=22;i++){const w=spk(x,k,c);arc(k,c-1,w+2,G-2,3);c+=w+6;}if(x.diff>=3)W_(x,k,Math.min(c+2,26));brk(k,4,G-5,false);return k;}
function ch_oasis(x){const k=mk();coinsH(k,2,26,G-1,1);k.am.push({c:8,r:G-1});k.am.push({c:20,r:G-1});brk(k,14,G-5,true);brk(k,5,G-5,false);brk(k,23,G-5,false);plat(k,10,G-3,8,false);return k;}
function ch_pre_finale(x){const k=mk();let c=4;for(let h=1;h<=3;h++){k.hl.push({c,len:2,h});coinsH(k,c,2,G-h-1);c+=2;}k.hl.push({c,len:8,h:3});coinsH(k,c,8,G-4);k.am.push({c:c+3,r:G-4});if(x.diff>=6)F_(x,k,c+4,G-7);if(x.diff>=4)W_(x,k,c+6);k.hl.push({c:c+8,len:2,h:2},{c:c+10,len:2,h:1});return k;}
// ══════════════════════════════════════════════════════════════
//  6 قطع Graveyard جديدة
// ══════════════════════════════════════════════════════════════
function ch_grave_bones(x){const k=mk();const c1=x.ri(7,9);const w1=spk(x,k,c1);arc(k,c1-1,w1+2,G-2,3);const c2=c1+w1+6;if(c2+4<=22){const w2=spk(x,k,c2);arc(k,c2-1,w2+2,G-2,3);}if(x.diff>=3)F_(x,k,c1+4,G-6);if(x.diff>=6)F_(x,k,Math.min(c2+2,26),G-5);coinsH(k,2,8,G-3,2);brk(k,22,G-5,false);return k;}
function ch_grave_crypt(x){const k=mk();plat(k,4,G-5,20);k.hl.push({c:8,len:2,h:2},{c:18,len:2,h:2});coinsH(k,5,18,G-4,2);W_(x,k,6,1);if(x.diff>=4)W_(x,k,13,-1);if(x.diff>=7)W_(x,k,21,1);k.am.push({c:11,r:G-1});if(x.diff>=5)F_(x,k,15,G-6);return k;}
function ch_grave_tomb_pit(x){const k=mk();const gc=x.ri(5,6);const len=x.ri(9,11);k.ga.push({c:gc,len});for(let i=0;i<len;i+=3){k.cr.push({c:gc+i,r:G-1});if(i+1<len)k.cr.push({c:gc+i+1,r:G-1});}arc(k,gc-1,len+2,G-2,3);F_(x,k,gc+(len>>1),G-6);if(x.diff>=6)F_(x,k,gc+2,G-5);return k;}
function ch_grave_bat_corridor(x){const k=mk();plat(k,4,G-3,3);plat(k,12,G-4,3);plat(k,20,G-3,3);const n=Math.min(2+(x.diff>>3),4);for(let i=0;i<n;i++)F_(x,k,5+i*6,G-4-(i%2),i%2?-1:1);coinsH(k,5,4,G-6);coinsH(k,12,3,G-6);if(x.diff>=4)W_(x,k,9);brk(k,16,G-5,false);return k;}
function ch_grave_catacomb(x){const k=mk();plat(k,3,G-5,8);coinsH(k,3,8,G-4);W_(x,k,6);plat(k,13,G-3,3);k.am.push({c:14,r:G-4});plat(k,18,G-5,8);coinsH(k,18,8,G-4);if(x.diff>=4)W_(x,k,22);if(x.diff>=7)F_(x,k,11,G-6);brk(k,16,G-5,false);return k;}
function ch_grave_crumble_bats(x){const k=mk();const gc=x.ri(5,6);const len=x.ri(10,12);k.ga.push({c:gc,len});for(let i=0;i<len;i++){if(i%4===3)continue;k.cr.push({c:gc+i,r:G-1});}for(let i=0;i<len;i+=3)k.co.push({c:gc+i,r:G-2});F_(x,k,gc+3,G-6);if(x.diff>=5)F_(x,k,gc+(len>>1),G-5);if(x.diff>=8)F_(x,k,Math.min(gc+len-3,28),G-6);return k;}

// ══════════════════════════════════════════════════════════════
//  جدول CHUNKS الموحّد
// ══════════════════════════════════════════════════════════════
const CHUNKS = {
  // الأصلية
  open:ch_open, gap:ch_gap, gap_series:ch_gap_series, mountain:ch_mountain, pillars:ch_pillars, pit:ch_pit,
  crumble:ch_crumble, crumble_islands:ch_crumble_islands, spring_tower:ch_spring_tower,
  sky_islands:ch_sky_islands, coin_heaven:ch_coin_heaven, spikes:ch_spikes,
  spike_tunnel:ch_spike_tunnel, horde:ch_horde, flyers:ch_flyers, block_wall:ch_block_wall,
  vault:ch_vault, quiet:ch_quiet, mesa:ch_mesa, zigzag:ch_zigzag, rest:ch_rest, boss:ch_boss, finale:ch_finale,
  // Nature الجديدة
  low_arc:ch_low_arc, double_gap:ch_double_gap, stair_tower:ch_stair_tower,
  stairs_up:ch_stairs_up, zig_zig:ch_zig_zig, tunnel:ch_tunnel, wall_shoot:ch_wall_shoot,
  spring_chain:ch_spring_chain, spike_field:ch_spike_field, oasis:ch_oasis, pre_finale:ch_pre_finale,
  // Graveyard الجديدة
  grave_bones:ch_grave_bones, grave_crypt:ch_grave_crypt, grave_tomb_pit:ch_grave_tomb_pit,
  grave_bat_corridor:ch_grave_bat_corridor, grave_catacomb:ch_grave_catacomb, grave_crumble_bats:ch_grave_crum
