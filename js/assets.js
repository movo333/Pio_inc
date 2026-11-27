/* Super Cowboy — Asset loader (written from scratch)
   - ONE manifest lists every image the game needs.
   - Loads 8 files at a time (fast + reliable on mobile data), retries failures, per-file timeout.
   - Never lets the game start with missing REQUIRED files silently: it returns the list of failures
     so the loading screen can show exactly which files are missing in the repository. */
const Assets = (() => {
  'use strict';

  const MAX_PARALLEL = 8;
  const ATTEMPT_TIMEOUT = 45000;      // starts only when the request starts
  const RETRIES = 1;                  // 2 attempts per file

  const log = new Set();              // every URL that loaded OK (used to save them on the device)
  let active = 0;
  const waiting = [];

  function slot() {
    return new Promise(r => { if (active < MAX_PARALLEL) { active++; r(); } else waiting.push(r); });
  }
  function release() {
    const next = waiting.shift();
    if (next) next(); else active--;
  }

  function resolvePath(src) {
    if (!src || /^(https?:|data:|blob:)/.test(src)) return src;
    if (src.startsWith('/assets/')) return src.slice(1);
    if (src.startsWith('assets/')) return src;
    return 'assets/' + src;
  }

  function fetchImage(src, retries) {
    return (async () => {
      for (let tries = 0; tries <= retries; tries++) {
        await slot();
        const img = await new Promise(res => {
          const im = new Image();
          let done = false;
          const finish = v => { if (done) return; done = true; clearTimeout(t); res(v); };
          const t = setTimeout(() => finish(null), ATTEMPT_TIMEOUT);
          im.onload  = () => finish(im);
          im.onerror = () => finish(null);
          im.src = resolvePath(src) + (tries ? '?r=' + tries : '');
        });
        release();
        if (img) {
          try { if (img.decode) await img.decode(); } catch (e) {}
          log.add(resolvePath(src));
          return img;
        }
        if (tries < retries) await new Promise(r => setTimeout(r, 500 * (tries + 1)));
      }
      return null;
    })();
  }

  // Try several paths in order; first one that exists wins.
  async function loadAny(paths) {
    for (const p of paths) {
      const img = await fetchImage(p, RETRIES);
      if (img) return img;
    }
    return null;
  }

  // ───────────── the manifest: everything the game draws ─────────────
  function buildManifest() {
    const jobs = [];
    const add = (paths, set, required) =>
      jobs.push({ paths: [].concat(paths), set, required: !!required });

    // Player
    const anims = { idle: 10, run: 8, jump: 10, dead: 10, shoot: 3 };
    for (const [anim, count] of Object.entries(anims)) {
      SPR[anim] = [];
      for (let i = 1; i <= count; i++)
        add(`assets/character/${anim}${i}.png`, img => { SPR[anim][i - 1] = img; }, true);
    }

    // Enemies
    ['snail1','bat1','tuca1','bat2','bat3','snail2','snail3',
     'spikebee1','spikebee2','spikebee3','spikebee4','tuca2','tuca3']
      .forEach(e => add(`assets/enemies/${e}.png`, img => { SPR[e] = img; }, true));

    // Tiles
    const tiles = { nature: 18, graveyard: 16, winter: 18, desert: 16 };
    for (const [world, count] of Object.entries(tiles)) {
      TILE_IMGS[world] = {};
      for (let i = 1; i <= count; i++)
        add([`assets/tiles/${world}/${i}.png`,
             `assets/tiles/${world[0].toUpperCase() + world.slice(1)}/${i}.png`,
             `assets/tiles/${world}/${i}.PNG`],
            img => { TILE_IMGS[world][i] = img; }, false);   // اختيارية: إن غابت تُرسم بلاطات بديلة داخل اللعبة دون نافذة خطأ
    }
    for (let b = 1; b <= 4; b++)
      add(`assets/tiles/graveyard/bone${b}.png`, img => { TILE_IMGS.graveyard['bone' + b] = img; }, false);

    // Backgrounds
    ['nature','graveyard','winter','desert']
      .forEach(w => add(`assets/bg/${w}_bg.png`, img => { UI_IMGS['bg_' + w] = img; }, true));

    // Screens
    add('assets/ui/splash_screen.png', img => { UI_IMGS.splash = img; }, false);
    add('assets/ui/sky_bg.png',        img => { UI_IMGS.sky_bg = img; }, false);
    ['nature','graveyard','winter','desert']
      .forEach(w => add(`assets/ui/world_${w}.png`, img => { UI_IMGS['world_' + w] = img; }, false));
    add('assets/ui/levels_panel.png', img => { UI_IMGS.levels_panel = img; }, false);
    add('assets/ui/lock_panel.png',   img => { UI_IMGS.lock_panel = img; }, false);

    // Buttons / HUD (assets/buttons/)
    const buttons = {
      coin: 'coin.png', bullet: 'bullet.png', banner_win: 'banner_win.png', banner_lose: 'banner_lose.png',
      btn_retry: 'btn_retry.png', btn_shoot: 'btn_shoot.png', btn_left: 'btn_left.png',
      btn_right: 'btn_right.png', btn_jump: 'btn_Jumping.png', restart_btn: 'Restart_button.png'
    };
    for (const [key, file] of Object.entries(buttons))
      add('assets/buttons/' + file, img => { UI_IMGS[key] = img; }, ['coin','bullet'].includes(key));

    // Optional extras: buttons/ first, then ui/
    ['btn_play.png','heart.png','lock.png','star.png','btn_back.png'].forEach(f => {
      const key = f.replace(/\.[^.]+$/, '');
      add(['assets/buttons/' + f, 'assets/ui/' + f], img => { UI_IMGS[key] = img; }, false);
    });
    add(['assets/buttons/Picsa8.png','assets/ui/Picsa8.png',
         'assets/buttons/banner_win(Copy).png','assets/ui/banner_win(Copy).png'],
        img => { UI_IMGS.picsa8 = img; }, false);

    // Decorations: now loaded by game.js (ensureObjs) from assets/objests/<world>/ — only the current world, downscaled.
    for (const world of ['nature','graveyard','winter','desert']) OBJ_IMGS[world] = OBJ_IMGS[world] || {};
    return jobs;
  }

  /** Loads everything. Resolves { total, failed:[paths of REQUIRED files that are missing] }. */
  async function loadAll(onProgress) {
    const jobs = buildManifest();
    const failed = [];
    let done = 0;
    await Promise.all(jobs.map(async job => {
      const img = await loadAny(job.paths);
      if (img) job.set(img);
      else if (job.required) failed.push(job.paths[0]);
      done++;
      if (onProgress) onProgress(done, jobs.length);
    }));
    return { total: jobs.length, failed };
  }

  return { loadAll, log: () => Array.from(log), resolvePath };
})();
