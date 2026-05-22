# Dodge Warfare - Static Code Analysis Report

**Date:** 2026-05-21
**Phase:** 5 (v0.5.0)
**Method:** Full static analysis, zero commands executed

---

## 1. Project Overview

| Attribute | Value |
|-----------|-------|
| Type | Top-down 2D HTML5 Canvas shooter |
| Frontend | Vanilla JS (8 modules), HTML, CSS |
| Backend | Node.js + Express + Socket.IO + sql.js |
| Architecture | Modular script tags (no bundler) |
| Multiplayer | Socket.IO (up to 4 players per room) |
| Persistence | localStorage (client) + SQLite via sql.js (server) |

---

## 2. File Inventory

### Frontend (10 files)
| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 23 | Entry point, script loader |
| `style.css` | 40 | Fullscreen canvas, no-select |
| `js/config.js` | 199 | All tunable constants, weapons, enemies, perks, missions |
| `js/engine.js` | 556 | Utilities, Input, Camera, AudioManager, PersistenceManager, LightingManager, AmbientWeather |
| `js/world.js` | 557 | TileMap, obstacles (Building, BrickWall, Car, Barrel, Tree, BarbedWire, Sandbag, Crate, Ruins) |
| `js/entities.js` | 1262 | Bullet, EnemyBullet, Enemy (base), 5 enemy types, Player, Pickup, EnemyBoss |
| `js/systems.js` | 328 | Explosion, ImpactEffect, MuzzleFlashEffect, WaveManager, ScoreManager |
| `js/ui.js` | 1061 | HUD (with math-nerd debug overlay), Minimap, Crosshair, KillFeed, GameStateManager (menus) |
| `js/network.js` | 184 | LeaderboardClient, NetworkClient (Socket.IO multiplayer) |
| `js/game.js` | 789 | Game class (orchestrator), AudioManagerWrapper, main loop |

### Backend (3 files + node_modules)
| File | Lines | Purpose |
|------|-------|---------|
| `backend/server.js` | 393 | Express + Socket.IO server, REST API, room management |
| `backend/db.js` | 129 | sql.js database layer (leaderboard) |
| `backend/package.json` | 17 | Dependencies |

---

## 3. Architecture Assessment

### Strengths

- **Clean modular separation** — Each file has a clear responsibility (config, engine, world, entities, systems, UI, network, game). This matches the user's preference for modular architecture.
- **No build step required** — Pure vanilla JS with script tags. Just open `index.html` and play (single-player). Zero tooling friction.
- **Graceful degradation** — Socket.IO loaded with `onerror` fallback. Backend is optional for solo play. Audio init deferred to first user interaction (Web Audio API policy compliance).
- **Comprehensive CONFIG object** — All game constants centralized in one place. Easy to tune without touching game logic.
- **Quality tiers** — `low`/`medium`/`high` graphics presets affect rendering paths, allowing performance scaling.
- **Procedural audio** — All sounds generated via Web Audio API oscillators. Zero external audio assets needed.
- **Security-conscious backend** — Uses `helmet`, `cors`, `express-rate-limit`, parameterized SQL queries, input validation with regex and range checks.

### Concerns

- **Global `game` variable** — Set via `game = this` in the `Game` constructor (`js/game.js:8`). Referenced by many entities via `typeof game !== 'undefined' && game && game.soundManager`. This creates tight coupling. If the Game constructor throws before completing, other code may reference a partially-initialized object.
- **`CONFIG.missions` referenced but not defined in config.js** — `CONFIG.missions` is used in `GameStateManager` (line 535) and `Game.loadMission()` (line 136), but `config.js` does not define it. The `TileMap` references `CONFIG.themes` (line 18) which is also missing. This means `config.js` is incomplete — the game will crash on startup with `TypeError: Cannot read properties of undefined`.
- **No `missions` or `themes` in CONFIG** — Two critical config blocks are missing: `CONFIG.missions` (mission definitions with buildings, cars, barrels, trees, etc.) and `CONFIG.themes` (terrain color schemes for TileMap). These are required by `loadMission()` and `TileMap.generate()`.

---

## 4. Critical Bugs (Will Crash)

### 4.1 Missing `CONFIG.missions` — **FATAL**
- **Location:** `js/config.js` — not defined anywhere
- **Used at:** `js/ui.js:535` (`this.missions = CONFIG.missions`), `js/game.js:136` (`CONFIG.missions.find(...)`)
- **Impact:** Game crashes immediately on startup. `GameStateManager` constructor tries to read `CONFIG.missions` which is `undefined`. Even if that were bypassed, `loadMission()` would fail.

### 4.2 Missing `CONFIG.themes` — **FATAL**
- **Location:** `js/config.js` — not defined anywhere
- **Used at:** `js/world.js:18` (`this.themeData = CONFIG.themes[this.theme]`)
- **Impact:** `TileMap` constructor crashes because `CONFIG.themes` is `undefined`.

### 4.3 Missing `AudioManagerWrapper` definition timing
- **Location:** `js/game.js:776-780`
- **Issue:** `AudioManagerWrapper` is defined in `game.js`, but `Game` constructor at line 48 uses `new AudioManagerWrapper(this.audioManager)`. Since `game.js` loads last and `AudioManagerWrapper` is defined later in the same file, this actually works due to hoisting of class declarations. **Not a bug.**

---

## 5. Non-Critical Bugs & Issues

### 5.1 `setTimeout` in game logic — potential desync
- **Location:** `js/entities.js:709` — `setTimeout(() => { ... }, 200)` for auto-reload
- **Issue:** Uses wall-clock `setTimeout` instead of game-time dt. If the game is paused, the reload fires anyway. Could also fire after player death.

### 5.2 `setTimeout` in AudioManager
- **Location:** `js/engine.js:241, 287-288, 293-294, 299-301, 319-320, 339-341, 348-350, 355-356`
- **Issue:** Multiple `setTimeout` calls for sequenced audio notes. These are cosmetic (sound effects) and acceptable, but they won't pause when the game pauses.

### 5.3 `LightingManager` gradient color parsing — fragile
- **Location:** `js/engine.js:462`
- **Issue:** The line `light.color.replace(')', `,${alpha * 0.5})`).replace('rgb', 'rgba').replace('#', '')` attempts to convert hex colors to rgba strings via string replacement. This is fragile and produces incorrect results for hex colors like `#FF6600` (it becomes `rgbaFF6600,alpha`). However, line 464-467 immediately overwrites this stop with a correct hex-to-rgba conversion, so the bad value at stop 0.3 is overwritten. The dead code at line 462 is misleading but not harmful.

### 5.4 `ScoreManager.render` references global `game`
- **Location:** `js/systems.js:317`
- **Issue:** `if (typeof game !== 'undefined' && game && game.persistence && !game.persistence.data.settings.showDamageNumbers) return;` — accesses global `game` directly instead of receiving it as a parameter. Works but fragile.

### 5.5 `EnemyFlanker` references `CONFIG.flanker` instead of `CONFIG.enemy.flanker`
- **Location:** `js/entities.js:533`
- **Issue:** `const cfg = CONFIG.flanker;` — The flanker config is at `CONFIG.flanker` (top-level), not inside `CONFIG.enemy`. This is inconsistent with other enemies (grunt, rusher, heavy, sniper all use `CONFIG.enemy.*`). It works because `CONFIG.flanker` exists at the top level, but it's an inconsistency.

### 5.6 Boss `_pickPatrolTarget` not in base `Enemy` class
- **Location:** `js/entities.js:1085-1093` (EnemyBoss)
- **Issue:** `EnemyBoss._pickPatrolTarget()` is defined on the boss, but the base `Enemy` class at line 108 calls `this._pickPatrolTarget()` in some subclasses' `_ai` methods. The base class itself doesn't define it. All subclasses define their own, so this works, but it's an implicit contract.

### 5.7 Scorch marks array unbounded in practice
- **Location:** `js/game.js:456`
- **Issue:** Capped at 200, which is good. But the cap is only checked once per frame during `_update`, so if many marks are created in one frame (boss explosion + chain reactions), it could temporarily exceed 200.

### 5.8 `resetGame` doesn't reset obstacles/barbedWires
- **Location:** `js/game.js:282-294`
- **Issue:** `resetGame()` resets player, bullets, enemies, effects, pickups, scorchMarks, but does NOT reset `this.obstacles`, `this.barbedWires`, `this.buildings`, `this.cars`, `this.barrels`, `this.trees`. The destructibles are restored (undestroyed), but the arrays aren't cleared. If called from the pause menu after map regeneration, obstacles from multiple waves could accumulate.

---

## 6. Security Analysis

### Backend Security — **Good**
- Helmet middleware for HTTP headers
- CORS enabled
- Rate limiting (100 req/15min on `/api/`)
- Input validation with regex (`/^[a-zA-Z0-9 ]{1,20}$/`)
- Parameterized SQL queries (no injection)
- Score sanity check (`score > 50000 * waveReached`)
- Graceful shutdown handlers (SIGINT, SIGTERM)

### Frontend Security — **Acceptable for a game**
- No user-generated content rendered as HTML
- No `eval()` or `innerHTML` usage
- Canvas-only rendering (no DOM injection vectors)
- localStorage used for persistence (client-side only, no sensitive data)
- Backend URL hardcoded to `localhost:3000` (appropriate for dev)

### Potential Concerns
- **Score submission is client-authoritative** — The client sends score/wave/kills to the server. The server does a basic sanity check (`score > 50000 * waveReached`) but can't verify actual gameplay. A determined cheater could submit fake scores. Acceptable for a casual game, but worth noting.

---

## 7. Performance Analysis

### Potential Hotspots

1. **Enemy separation — O(n²) per frame**
   - `js/entities.js:109-124` — Every enemy checks every other enemy for separation force.
   - At 35 enemies (max), that's 595 pair checks per frame. Manageable but could be optimized with spatial partitioning at higher counts.

2. **Bullet-obstacle collision — O(bullets × obstacles) per frame**
   - `js/game.js:345-354` — Each bullet checks all obstacles.
   - With ~35 obstacles and many bullets, this could be hundreds of checks per frame. Acceptable for the scale.

3. **TileMap rendering — viewport-culled**
   - `js/world.js:82-86` — Only renders visible tiles. Good.

4. **Scorch marks — unbounded until cap**
   - Capped at 200 with simple `arc()` fills. Should be fine.

5. **No object pooling** — Bullets, effects, and enemies are created/destroyed each frame. For the scale of this game (35 max enemies, ~50 bullets), this is fine. GC pressure should be minimal.

### Estimated Performance
- At 1080p with high quality: likely 60fps on modern hardware
- At 4K: may dip during boss fights with many particles
- Low quality mode: should run well on integrated graphics

---

## 8. Code Quality Summary

| Metric | Rating | Notes |
|--------|--------|-------|
| Modularity | Good | Clean file separation, clear responsibilities |
| Readability | Good | Consistent style, well-organized classes |
| Error Handling | Fair | Audio errors caught, but many game errors would crash |
| Type Safety | N/A | Vanilla JS, no TypeScript |
| Test Coverage | None | No tests (expected for a game project) |
| Documentation | Fair | Inline comments at section headers |
| DRY | Fair | Some repeated patterns in enemy AI, but acceptable |
| Configurability | Excellent | CONFIG object is comprehensive |

---

## 9. What Would Break at Runtime

| Severity | Issue | Trigger |
|----------|-------|---------|
| **FATAL** | Missing `CONFIG.missions` | Game start — `new Game()` crashes |
| **FATAL** | Missing `CONFIG.themes` | Game start — `TileMap` constructor crashes |
| Medium | `setTimeout` reload fires during pause | Pause game while reloading |
| Medium | `resetGame` accumulates obstacles | Restart multiple times |
| Low | Boss patrol target before assignment | Boss enters idle state on first frame |

---

## 10. Verdict

**The game is well-architected and feature-rich, but it will not run.** Two critical config blocks (`CONFIG.missions` and `CONFIG.themes`) are missing from `config.js`. The `Game` constructor calls `loadMission()` which reads `CONFIG.missions`, and the `TileMap` constructor reads `CONFIG.themes` — both will throw `TypeError: Cannot read properties of undefined`.

To make this playable, those two config objects need to be added to `config.js`. Everything else — the game loop, entity systems, UI, networking, backend — is structurally sound and ready to go once the config is complete.
