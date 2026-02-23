# Super Pio v2.0

## Setup Instructions

### 1. Host the game
The game requires a web server (due to asset loading).
- Use VS Code Live Server extension
- Or: `python3 -m http.server 8080` in the project folder
- Or deploy to GitHub Pages / Netlify

### 2. Supabase Database Setup
Run this SQL in your Supabase project:

```sql
CREATE TABLE IF NOT EXISTS players (
  pi_uid TEXT PRIMARY KEY,
  pi_username TEXT,
  max_level INTEGER DEFAULT 1,
  coins INTEGER DEFAULT 0,
  lives INTEGER DEFAULT 3,
  world_progress JSONB DEFAULT '{"1":0,"2":0,"3":0,"4":0}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_id TEXT,
  pi_uid TEXT,
  item TEXT,
  amount NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Pi Network Setup
- Update `SUPA_URL` and `SUPA_KEY` in `js/game.js`
- Register your app on Pi Developer Portal
- Set sandbox mode to false for production

## Features
- 4 Worlds × 10 Levels = **40 levels total**
- World 1 (Nature): 2 min each
- World 2 (Graveyard): 3 min each (Bat enemy exclusive)
- World 3 (Winter): 4 min each
- World 4 (Desert): 5 min each
- **All 4 tilesets** with proper edge variants from Tile.svg
- **Breakable blocks** with 3 hidden hearts per level
- **Traps**: spikes, crumble tiles, gaps
- **5 enemies**: Snail, Bee, Bat (graveyard only), Tuca, SpikeBee
- **15 ammo pickups** per level, gun holds 5 shots
- Pi Network login + Pi Testnet payments
- Cloud save via Supabase
- Portrait mode (game rotated 90° internally)

## Controls
- **Mobile**: On-screen buttons
- **Keyboard**: Arrow keys / WASD, Space/Up to jump, Z/X to shoot
