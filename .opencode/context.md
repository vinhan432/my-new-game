# Project Context - Dodge Warfare (Phase 6)

## Environment
- **Language**: Vanilla JavaScript (ES6)
- **Runtime**: Browser (HTML5 Canvas 2D API) + Node.js backend
- **Frontend Build**: None - open index.html directly
- **Backend**: Node.js with Express + Socket.IO + SQLite (sql.js)
- **Backend Start**: `cd backend && npm start` (port 3000)
- **Test**: Manual browser testing

## Project Type
- Browser-based top-down shooter game with multiplayer support

## Architecture
### Frontend (7 JS modules, ~3200 lines total)
| File | Lines | Responsibility |
|------|-------|---------------|
| `js/config.js` | 521 | All tunable values (weapons, enemies, waves, HUD, missions, perks) |
| `js/engine.js` | 554 | Utilities, Input, Camera, AudioManager, PersistenceManager, Lighting, Weather |
| `js/world.js` | 736 | TileMap, Building, BrickWall, Car, Truck, SUV, Van, Barrel, Tree, BarbedWire, Sandbag, Crate, Ruins |
| `js/entities.js` | ~2200 | Player, Bullet, EnemyBullet, Enemy base + 9 types, Boss, Pickup |
| `js/systems.js` | 335 | Explosion, ImpactEffect, MuzzleFlashEffect, WaveManager, ScoreManager |
| `js/ui.js` | ~1090 | HUD, Minimap, Crosshair, KillFeed, GameStateManager (full menu system) |
| `js/game.js` | ~913 | Game class - core loop, init, update/render orchestration |

### Backend (2 files)
| File | Responsibility |
|------|---------------|
| `backend/server.js` | Express REST API + Socket.IO room-based multiplayer |
| `backend/db.js` | SQLite via sql.js - leaderboard persistence |

## Game Features (Phase 6)
- **Player**: WASD movement, sprint, dodge roll (with ghost trail), 6 weapons (Pistol/Rifle/Shotgun/Sniper/SMG/Rocket), ammo system, reload, perks system
- **Hip-bobbing**: Organic scale/rotation wobble based on velocity magnitude for Player and all Enemies
- **Weapon Recoil**: Camera shake + player pushback for heavy weapons (Shotgun/Sniper/Rocket)
- **Gun Smoke**: Smoke particles spawn at barrel tip on every shot
- **Muzzle Flash**: Star-shaped polygon flash with bright core on fire
- **Enemies**: 9 types (Grunt, Rusher, Heavy, Sniper, Flanker, Medic, Shield, Drone, Turret) with AI state machines
- **Boss**: "The Commander" with 3 phases, reinforcements, unique attacks
- **Waves**: Progressive difficulty with enemy count/type scaling, slide-in/fade-in announcements
- **Map**: 2800-3500 world with terrain tiles, roads, buildings, cars, trucks, SUVs, vans, barrels, trees, barbed wire, sandbags, crates, ruins
- **Destructibles**: Cars, trucks, SUVs, vans, barrels, crates explode with chain reactions
- **Persistent Debris**: Twisted metal bits from explosions that rotate, scale down, and fade over 5-10 seconds
- **Pickups**: Health, stamina, ammo, perks drops from enemies
- **HUD**: HP/Stamina bars, weapon panel, ammo display, reload bar, wave info, score, combo, perks
- **Debug Overlay**: Sleek terminal-style box with blinking cursor, cyan border glow, organized columns
- **Minimap**: Real-time overview with all entity types including trucks (brown), SUVs (green), vans (gray)
- **Crosshair**: Weapon-reactive with hit pulse
- **Audio**: Procedural Web Audio API sounds + ambient music
- **Menus**: Main menu, mission selection, settings, leaderboard, online play, game over with score submission
- **Menu Polish**: Input boxes with pulsing neon cyan border (#00CCFF) and glow effect
- **Multiplayer**: Room-based (4 players max) via Socket.IO
- **Leaderboard**: Global score submission via REST API
- **Persistence**: localStorage for settings, high scores, player name
- **Dev Cheats**: ` (backtick) toggles dev mode, then G=God, K=Kill all, N=Next wave, M=Ammo, H=Health, B=Spawn boss
- **Graphics Quality**: Low/Medium/High presets affecting particles, shadows, glow, trails
- **Lighting**: Dynamic light sources with darkness overlay
- **Ambient Weather**: Dust, leaves, embers particles

## Rendering Pipeline (18+ layers)
1. Terrain tiles 2. Scorch marks / blood / persistent debris 3. Static obstacles 4. Destructibles 5. Barbed wire
6. Pickups 7. Enemy bullets 8. Player bullets 9. Enemies 10. Remote players
11. Local player (with dodge ghost trails) 12. Effects (smoke, muzzle flash) 13. Lighting overlay
14. Ambient weather 15. Floating numbers 16. HUD 17. Minimap 18. Game state overlay 19. Crosshair 20. Screen flash 21. Debug overlays

## Game States
`menu` → `missions` → `playing` | `paused` | `gameover` | `settings` | `leaderboard` | `online` | `joinRoom` | `waiting`

## Key Classes
- **Game**: Core orchestrator, game loop, map generation, explosion handling
- **Player**: Movement, weapons, dodge (with ghost trails), stamina, collision, hip-bobbing
- **Enemy** (base): AI state machine, separation, LOS, patrol, hip-bobbing
- **EnemyGrunt/Rusher/Heavy/Sniper/Flanker/Medic/Shield/Drone/Turret**: Specialized behaviors
- **EnemyBoss**: Phase transitions, reinforcements, burst attacks
- **WaveManager**: Spawning, wave progression, announcements
- **ScoreManager**: Score tracking, combo system, floating numbers
- **GameStateManager**: Full menu system with keyboard navigation
- **LightingManager**: Dynamic light sources with darkness overlay
- **AmbientWeather**: Environmental particles (dust, leaves, embers)

## Backend API
- `GET /api/health` - Health check
- `GET /api/scores?limit=N&mode=solo|coop` - Top scores
- `POST /api/scores` - Submit score (validated)

## Socket.IO Events
- Room: `createRoom`, `joinRoom`, `leaveRoom`
- State: `stateUpdate`, `playerUpdate`, `playerJoined`, `playerLeft`
- Combat: `playerShoot`, `enemyDamage`, `waveStart`, `pickupCollected`
- Status: `playerDown`, `playerRevive`

## Version
- Config version: `0.5.0`
- Title shows: "Phase 5" (can update to Phase 6)

## Notes
- No build system - pure vanilla JS, loaded via script tags
- No TypeScript, no bundler
- All config values centralized in CONFIG object
- Input lock prevents WASD/shooting when text inputs are active (name/room code)
- Trucks, SUVs, Vans are pushed to both destructibles AND obstacles for collision/LOS
- Dodge trails fade out gradually after dodge ends with decreasing alpha and scale
- Wave announcements use ease-out cubic slide-in animation from above
- Debug overlay uses terminal-style design with blinking cursor and cyan border glow
- Menu input boxes have pulsing neon cyan (#00CCFF) border with shadow glow
