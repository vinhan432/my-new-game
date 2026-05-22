/**
 * Dodge Warfare - Phase 5
 * Game - Core loop, initialization, orchestration
 */

class Game {
    constructor() {
        game = this; // Global reference
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this._resize();
        window.addEventListener('resize', () => this._resize());

        // Core systems
        this.input = new Input(this.canvas);
        this.audioManager = new AudioManager();
        this.persistence = new PersistenceManager();
        this.leaderboardClient = new LeaderboardClient();
        this.network = new NetworkClient();

        // Object pools for bullets (reduces GC pressure)
        this._bulletPool = new ObjectPool(
            () => new Bullet(0, 0, 0, 0, 0, '', 0),
            (b, x, y, angle, speed, radius, color, damage, explosive, explosionRadius, explosionDamage) => {
                b.x = x; b.y = y; b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
                b.speed = speed; b.radius = radius || 4; b.color = color || '#FFD700';
                b.damage = damage || 20; b.lifetime = 3000; b.age = 0; b.active = true;
                b.explosive = explosive || false; b.explosionRadius = explosionRadius || 0;
                b.explosionDamage = explosionDamage || 0; b.trail = []; b.maxTrail = 6;
            }, 80
        );
        this._enemyBulletPool = new ObjectPool(
            () => new EnemyBullet(0, 0, 0, 0, 0),
            (b, x, y, angle, speed, damage) => {
                b.x = x; b.y = y; b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
                b.speed = speed; b.damage = damage; b.lifetime = 4000; b.age = 0; b.active = true;
                b.radius = 4; b.trail = []; b.maxTrail = 4;
            }, 60
        );

        // Mission state
        this.currentMission = null;
        this.tileMap = null;
        this.camera = new Camera(CONFIG.world.width, CONFIG.world.height);

        // Apply persisted settings
        const s = this.persistence.data.settings;
        this.audioManager.masterVolume = s.masterVolume;
        this.audioManager.sfxVolume = s.sfxVolume;
        this.audioManager.musicVolume = s.musicVolume;
        this.camera.shakeMultiplier = s.screenShakeIntensity;

        // Game entities (will be populated by mission load)
        this.player = new Player(1500, 1500);
        this.bullets = []; this.enemyBullets = [];
        this.obstacles = []; this.destructibles = []; this.barbedWires = [];
        this.enemies = []; this.effects = []; this.scorchMarks = [];
        this.pickups = [];

        // Graphics systems
        this.lighting = new LightingManager();
        this.weather = new AmbientWeather();

        // UI
        this.hud = new HUD(); this.crosshair = new Crosshair();
        this.minimap = new Minimap(); this.killFeed = new KillFeed();
        this.waveManager = new WaveManager(); this.scoreManager = new ScoreManager();
        this.gameState = new GameStateManager(); this.soundManager = new AudioManagerWrapper(this.audioManager);
        this.screenFlash = { alpha: 0, color: '#FFF', decay: 3.0 };

        // Map data
        this.buildings = []; this.cars = []; this.barrels = []; this.trees = [];
        this.trucks = []; this.suvs = []; this.vans = [];
        this._dynamicObstacles = []; // Track obstacles added during gameplay (crates, sandbags)

        this.lastTime = 0; this.running = false; this.runTime = 0;
        this.godMode = false; this.devCheats = false;
        this.graphicsQuality = s.graphicsQuality || 'high';

        this._generateMap();
        this._spawnInitialPickups();
        this._setupNetworkCallbacks();
        this._setupInputHandlers();

        this.running = true; this.lastTime = performance.now();
        requestAnimationFrame((time) => this._loop(time));
    }

    _resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }

    _setupInputHandlers() {
        window.addEventListener('keydown', (e) => {
            // Handle text input for name/room code FIRST (consume all keys)
            if (this.gameState.nameInputActive) {
                if (e.code === 'Enter') { this.gameState.nameInputActive = false; this.persistence.setPlayerName(this.gameState.nameInput); }
                else if (e.code === 'Escape') { this.gameState.nameInputActive = false; }
                else if (e.code === 'Backspace') { this.gameState.nameInput = this.gameState.nameInput.slice(0, -1); }
                else if (e.key.length === 1 && this.gameState.nameInput.length < 20) { this.gameState.nameInput += e.key; }
                this.input.keysJustPressed = {}; // Prevent game loop from processing these keys
                e.preventDefault(); return;
            }
            if (this.gameState.roomCodeInputActive) {
                if (e.code === 'Backspace') { this.gameState.roomCodeInput = this.gameState.roomCodeInput.slice(0, -1); }
                else if (e.key.length === 1 && this.gameState.roomCodeInput.length < 4) { this.gameState.roomCodeInput += e.key.toUpperCase(); }
                this.input.keysJustPressed = {};
                e.preventDefault(); return;
            }
            // Debug and dev cheats (after text input checks)
            if (e.code === 'F3') this.hud.toggleDebug();
            if (e.code === 'Backquote' && this.gameState.state === 'playing') this.devCheats = !this.devCheats;
            if (this.devCheats) {
                if (e.code === 'KeyG') { this.godMode = !this.godMode; console.log('God mode:', this.godMode); }
                if (e.code === 'KeyK') this._killAllEnemies();
                if (e.code === 'KeyN') { this.waveManager.state = 'between'; this.waveManager.timer = 0; }
                if (e.code === 'KeyM') this.player.addAmmo(1.0);
                if (e.code === 'KeyH') this.player.hp = this.player.maxHP;
                if (e.code === 'KeyB') this._spawnBossEnemy();
            }
            // Init audio on first interaction
            if (!this.audioManager.initialized) this.audioManager.init();
        });
        this.canvas.addEventListener('click', () => {
            if (!this.audioManager.initialized) this.audioManager.init();
            this.audioManager.resume();
        });
    }

    _setupNetworkCallbacks() {
        this.network.on('roomCreated', (data) => {
            this.gameState.state = 'waiting';
        });
        this.network.on('roomJoined', (data) => {
            this.gameState.state = 'waiting';
        });
        this.network.on('playerJoined', (data) => {
            this.killFeed.add(`${data.name} joined`);
        });
        this.network.on('playerLeft', (data) => {
            this.killFeed.add(`Player left`);
        });
        this.network.on('remoteShoot', (data) => {
            // Create visual bullet for remote player
            this.bullets.push(new Bullet(data.x, data.y, data.angle, data.speed || 700, 4, '#00CCFF', data.damage || 15));
        });
        this.network.on('remoteGameState', (data) => {
            if (data.type === 'waveStart') { this.waveManager.wave = data.wave - 1; this.waveManager.state = 'between'; this.waveManager.timer = 0; }
        });
    }

    startGame() {
        this.runTime = 0;
        this.audioManager.startMusic('combat');
        this.gameState.submitted = false;
        this.gameState.submitResult = null;
    }

    loadMission(missionId) {
        const mission = CONFIG.missions.find(m => m.id === missionId);
        if (!mission) { console.error('Mission not found:', missionId); return; }
        this.currentMission = mission;
        const ws = mission.worldSize;
        CONFIG.world.width = ws; CONFIG.world.height = ws;
        this.camera = new Camera(ws, ws);
        // Tilemap
        this.tileMap = new TileMap(ws, ws, mission.theme);
        this.tileMap.generate(mission.terrain);
        // Clear all
        this.obstacles = []; this.destructibles = []; this.barbedWires = [];
        this.buildings = []; this.cars = []; this.barrels = []; this.trees = [];
        this.bullets = []; this.enemyBullets = []; this.enemies = [];
        this.effects = []; this.scorchMarks = []; this.pickups = [];
        // Buildings
        this.buildings = mission.buildings.map(d => new Building(d.x, d.y, d.w, d.h, d.doors));
        this.obstacles.push(...this.buildings);
        // Brick walls
        mission.brickWalls.forEach(d => this.obstacles.push(new BrickWall(d.x, d.y, d.w, d.h)));
        // Cars
        this.cars = mission.cars.map(d => new Vehicle(d.x, d.y, d.w, d.h, d.angle, 'car'));
        this.destructibles.push(...this.cars);
        this.obstacles.push(...this.cars);
        // Trucks
        this.trucks = (mission.trucks || []).map(d => new Vehicle(d.x, d.y, d.w, d.h, d.angle, 'truck'));
        this.destructibles.push(...this.trucks);
        this.obstacles.push(...this.trucks);
        this.suvs = (mission.suvs || []).map(d => new Vehicle(d.x, d.y, d.w, d.h, d.angle, 'suv'));
        this.destructibles.push(...this.suvs);
        this.obstacles.push(...this.suvs);
        this.vans = (mission.vans || []).map(d => new Vehicle(d.x, d.y, d.w, d.h, d.angle, 'van'));
        this.destructibles.push(...this.vans);
        this.obstacles.push(...this.vans);
        // Barrels
        this.barrels = mission.barrels.map(d => new Barrel(d.x, d.y));
        this.destructibles.push(...this.barrels);
        // Trees
        const tc = mission.trees;
        const treePositions = [];
        for (let i = 0; i < tc.edgeCount; i++) {
            const side = Math.floor(Math.random() * 4); let x, y;
            switch (side) { case 0: x = Math.random() * tc.edgeMargin; y = Math.random() * ws; break; case 1: x = ws - Math.random() * tc.edgeMargin; y = Math.random() * ws; break; case 2: x = Math.random() * ws; y = Math.random() * tc.edgeMargin; break; case 3: x = Math.random() * ws; y = ws - Math.random() * tc.edgeMargin; break; }
            treePositions.push({ x, y, radius: tc.minR + Math.random() * (tc.maxR - tc.minR) });
        }
        for (let i = 0; i < tc.innerCount; i++) {
            const x = 400 + Math.random() * (ws - 800), y = 400 + Math.random() * (ws - 800);
            treePositions.push({ x, y, radius: tc.minR + Math.random() * (tc.maxR - tc.minR) });
        }
        this.trees = treePositions.map(d => new Tree(d.x, d.y, d.radius));
        this.obstacles.push(...this.trees);
        // Barbed wire
        this.barbedWires = mission.barbedWire.map(d => new BarbedWire(d.x, d.y, d.w, d.h));
        // Pickups
        this.pickups = mission.pickups.map(d => new Pickup(d.x, d.y, d.type));
        // Player spawn
        this.player.x = mission.playerSpawn.x; this.player.y = mission.playerSpawn.y;
        this.player.hp = this.player.maxHP; this.player.alive = true;
        // Wave manager
        this.waveManager = new WaveManager();
        this.waveManager.maxWaves = mission.waves;
        this.waveManager.missionEnemyTypes = mission.enemyTypes;
        this.waveManager.bossWave = mission.bossWave;
        // Reset state
        this.scoreManager = new ScoreManager(); this.killFeed = new KillFeed();
        this.runTime = 0; this.godMode = false; this.devCheats = false;
        this.camera.x = mission.playerSpawn.x - this.canvas.width / 2;
        this.camera.y = mission.playerSpawn.y - this.canvas.height / 2;
    }

    _generateMap() {
        // Fallback: load first mission if none selected
        if (!this.currentMission) this.loadMission(CONFIG.missions[0].id);
    }

    _spawnInitialPickups() {
        // Handled by loadMission
        if (!this.currentMission) {
            this.pickups = [
                new Pickup(400, 400, 'health'), new Pickup(1600, 500, 'health'),
                new Pickup(300, 1600, 'stamina'), new Pickup(2400, 1900, 'ammo')
            ];
        }
    }

    createExplosion(x, y, radius, damage, source) {
        this.effects.push(new Explosion(x, y, radius, damage));
        this.camera.triggerShake();
        this.soundManager.playSound('explosion');
        this.addScorchMark({ x, y, radius: radius * 0.6, color: 'rgba(20,20,20,0.4)', isBlood: false });

        // Persistent debris: twisted metal / broken bits that fade over 5-10 seconds
        const debrisCount = Math.floor(3 + radius / 30);
        for (let i = 0; i < debrisCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * radius * 0.5;
            const debris = {
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                radius: 3 + Math.random() * 6,
                angle: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 2,
                color: ['#444', '#555', '#333', '#666', '#8B4513'][Math.floor(Math.random() * 5)],
                life: 5000 + Math.random() * 5000, // 5-10 seconds
                age: 0,
                isDebris: true
            };
            this.scorchMarks.push(debris);
        }

        // Screen flash for big explosions
        if (radius > 80) {
            this.screenFlash.alpha = Math.min(0.4, radius / 300);
            this.screenFlash.color = '#FF8800';
            this.screenFlash.decay = 2.5;
        }
        // Damage player
        const dist = distance(this.player.x, this.player.y, x, y);
        if (dist < radius) this.player.takeDamage(damage * (1 - dist / radius));
        // Damage enemies
        for (const enemy of this.enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const eDist = distance(enemy.x, enemy.y, x, y);
            if (eDist < radius + enemy.radius) enemy.takeDamage(damage * (1 - eDist / (radius + enemy.radius)), this);
        }
        // Chain reaction for destructibles
        for (const d of this.destructibles) {
            if (d === source || d.destroyed) continue;
            const dDist = distance(d.x + (d.w || d.radius * 2) / 2, d.y + (d.h || d.radius * 2) / 2, x, y);
            if (dDist < radius) d.takeDamage(999, this);
        }
    }

    onEnemyKilled(enemy) {
        const score = this.scoreManager.addKill(enemy.score, enemy.x, enemy.y);
        this.killFeed.add(`+${score} ${enemy.type}`);
        // Combat Medic perk
        if (this.player.healPerKill > 0) {
            this.player.heal(this.player.healPerKill);
        }
        // Boss kill special effects
        if (enemy.type === 'boss') {
            this.camera.triggerShake(600, 12);
            this.waveManager.announcementText = `BOSS DEFEATED!`;
            this.waveManager.announcementTimer = 3000;
            this.soundManager.playSound('waveComplete');
        }
        // Drop pickup
        const r = Math.random();
        let dropType = null;
        if (enemy.type === 'boss') {
            // Boss always drops health + ammo
            this.pickups.push(new Pickup(enemy.x - 20, enemy.y, 'health'));
            this.pickups.push(new Pickup(enemy.x + 20, enemy.y, 'ammo'));
            return;
        }
        if (r < CONFIG.pickup.health.dropChance) dropType = 'health';
        else if (r < CONFIG.pickup.health.dropChance + CONFIG.pickup.stamina.dropChance) dropType = 'stamina';
        else if (r < CONFIG.pickup.health.dropChance + CONFIG.pickup.stamina.dropChance + CONFIG.pickup.ammo.dropChance) dropType = 'ammo';
        if (dropType) this.pickups.push(new Pickup(enemy.x, enemy.y, dropType));
    }

    addDamageNumber(x, y, amount) { this.scoreManager.addDamageNumber(x, y, amount); }
    addEffect(effect) { this.effects.push(effect); }
    addScorchMark(mark) { this.scorchMarks.push(mark); }
    addEnemyBullet(bullet) { this.enemyBullets.push(bullet); }
    createBullet(x, y, angle, speed, radius, color, damage, explosive = false, explosionRadius = 0, explosionDamage = 0) {
        const b = this._bulletPool.get(x, y, angle, speed, radius, color, damage, explosive, explosionRadius, explosionDamage);
        this.bullets.push(b); return b;
    }
    createEnemyBullet(x, y, angle, speed, damage) {
        const b = this._enemyBulletPool.get(x, y, angle, speed, damage);
        this.enemyBullets.push(b); return b;
    }

    _killAllEnemies() { for (const enemy of this.enemies) { if (enemy.active && !enemy.isDying) enemy.die(this); } }
    _spawnBossEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const x = this.player.x + Math.cos(angle) * 400;
        const y = this.player.y + Math.sin(angle) * 400;
        const boss = new EnemyBoss(clamp(x, 100, CONFIG.world.width - 100), clamp(y, 100, CONFIG.world.height - 100), this.waveManager.wave || 5);
        boss._gameRef = this;
        this.enemies.push(boss);
        this.soundManager.playSound('bossWarning');
    }

    resetGame() {
        this.player = new Player(CONFIG.world.width / 2 + 200, CONFIG.world.height / 2 + 200);
        this.bullets = []; this.enemyBullets = [];
        this.enemies = []; this.effects = []; this.pickups = [];
        this.scorchMarks = [];
        this.killFeed = new KillFeed();
        this.waveManager = new WaveManager(); this.scoreManager = new ScoreManager();
        this.godMode = false; this.devCheats = false; this.runTime = 0;
        this.lighting = new LightingManager();
        // Remove dynamically-added obstacles (crates, sandbags from wave regeneration)
        for (const obs of this._dynamicObstacles) {
            const obsIdx = this.obstacles.indexOf(obs);
            if (obsIdx !== -1) this.obstacles.splice(obsIdx, 1);
            const dIdx = this.destructibles.indexOf(obs);
            if (dIdx !== -1) this.destructibles.splice(dIdx, 1);
        }
        this._dynamicObstacles = [];
        // Reset all remaining destructibles
        for (const d of this.destructibles) { if (d.destroyed) { d.destroyed = false; d.hp = d.maxHp; } }
        this._spawnInitialPickups();
        this.audioManager.stopMusic();
    }

    _loop(currentTime) {
        if (!this.running) return;
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        this._update(dt);
        this._render();
        this.input.clearJustPressed();
        requestAnimationFrame((time) => this._loop(time));
    }

    _update(dt) {
        this.gameState.update(dt, this.input, this);
        if (this.gameState.state !== 'playing') return;

        // Input lock: freeze all gameplay input when text fields are active
        if (this.gameState.nameInputActive || this.gameState.roomCodeInputActive) {
            this.input.clearJustPressed();
            return;
        }

        this.runTime += dt;

        const allSolidObstacles = [...this.obstacles, ...this.destructibles.filter(d => d.isSolid())];
        this.player.update(dt, this.input, this.camera.getOffset(), this.canvas.width, this.canvas.height, allSolidObstacles, this.barbedWires);

        // Shooting
        if (this.input.mouse.leftDown && !this.player.isDodging && this.player.alive) {
            const bullets = this.player.tryShoot();
            if (bullets) {
                this.bullets.push(...bullets);
                // Muzzle flash light
                const w = this.player.weapon;
                const gunTipX = this.player.x + Math.cos(this.player.angle) * (CONFIG.player.gunLength + this.player.radius * 0.5);
                const gunTipY = this.player.y + Math.sin(this.player.angle) * (CONFIG.player.gunLength + this.player.radius * 0.5);
                this.lighting.addLight(gunTipX, gunTipY, 80, '#FFD700', 0.5, 80);
                this.network.sendShoot({ x: this.player.x, y: this.player.y, angle: this.player.angle, weaponIndex: this.player.currentWeaponIndex });

                // Weapon recoil: camera shake + player pushback for heavy weapons
                if (w.recoil >= 5) {
                    const shakeIntensity = w.recoil * 1.5;
                    this.camera.triggerShake(150 + w.recoil * 20, shakeIntensity);
                    // Push player back opposite to firing angle
                    const pushBack = w.recoil * 0.8;
                    this.player.x -= Math.cos(this.player.angle) * pushBack;
                    this.player.y -= Math.sin(this.player.angle) * pushBack;
                }

                // Gun smoke particles at barrel tip
                const smokeCount = w.pellets ? 4 : (w.explosive ? 3 : 2);
                for (let i = 0; i < smokeCount; i++) {
                    const spreadAngle = this.player.angle + (Math.random() - 0.5) * 0.5;
                    const spreadDist = 5 + Math.random() * 10;
                    const smokeX = gunTipX + Math.cos(spreadAngle) * spreadDist;
                    const smokeY = gunTipY + Math.sin(spreadAngle) * spreadDist;
                    this.effects.push({
                        x: smokeX, y: smokeY,
                        vx: Math.cos(this.player.angle) * (20 + Math.random() * 30) + (Math.random() - 0.5) * 20,
                        vy: Math.sin(this.player.angle) * (20 + Math.random() * 30) + (Math.random() - 0.5) * 20,
                        life: 200 + Math.random() * 200, age: 0,
                        size: 3 + Math.random() * 5 + (w.recoil * 0.5),
                        color: '#888', active: true, isSmoke: true,
                        update(dt) {
                            this.x += this.vx * dt; this.y += this.vy * dt;
                            this.vx *= 0.96; this.vy *= 0.96;
                            this.age += dt * 1000;
                            if (this.age > this.life) this.active = false;
                        },
                        render(ctx, cam) {
                            const a = (1 - this.age / this.life) * 0.4;
                            const s = this.size * (1 + this.age / this.life * 2);
                            ctx.globalAlpha = a; ctx.fillStyle = this.color;
                            ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, s, 0, Math.PI * 2); ctx.fill();
                            ctx.globalAlpha = 1;
                        }
                    });
                }

                // Muzzle flash polygon (sharp yellow-orange burst)
                this.effects.push({
                    x: gunTipX, y: gunTipY, angle: this.player.angle,
                    life: 50, age: 0, size: 8 + w.recoil, active: true,
                    update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                    render(ctx, cam) {
                        const a = 1 - this.age / this.life;
                        const sx = this.x - cam.x, sy = this.y - cam.y;
                        ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);
                        ctx.globalAlpha = a;
                        // Star-shaped flash
                        ctx.fillStyle = '#FFD700';
                        ctx.beginPath();
                        for (let i = 0; i < 5; i++) {
                            const outerR = this.size * a;
                            const innerR = outerR * 0.4;
                            const outerAngle = (i / 5) * Math.PI * 2 - Math.PI / 2;
                            const innerAngle = outerAngle + Math.PI / 5;
                            if (i === 0) ctx.moveTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
                            else ctx.lineTo(Math.cos(outerAngle) * outerR, Math.sin(outerAngle) * outerR);
                            ctx.lineTo(Math.cos(innerAngle) * innerR, Math.sin(innerAngle) * innerR);
                        }
                        ctx.closePath(); ctx.fill();
                        // Core bright flash
                        ctx.fillStyle = '#FFF';
                        ctx.beginPath(); ctx.arc(0, 0, 3 * a, 0, Math.PI * 2); ctx.fill();
                        ctx.restore(); ctx.globalAlpha = 1;
                    }
                });
            }
        }

        // Send network state
        if (this.network.connected && this.network.roomCode) {
            this.network.sendPlayerState({
                x: this.player.x, y: this.player.y, angle: this.player.angle,
                weaponIndex: this.player.currentWeaponIndex,
                currentMag: this.player.currentMag, isReloading: this.player.isReloading,
                hp: this.player.hp
            });
        }

        this.camera.follow(this.player.x, this.player.y, this.canvas.width, this.canvas.height);
        this.camera.updateShake(dt);

        // Update player bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i]; b.update(dt);
            let hit = false;
            for (const obs of allSolidObstacles) {
                if (!obs.blocksBullets()) continue;
                const bounds = obs.getBounds();
                if (circleRectOverlap(b.x, b.y, b.radius, bounds.x, bounds.y, bounds.w, bounds.h)) {
                    b.active = false; hit = true;
                    this.effects.push(new ImpactEffect(b.x, b.y));
                    if (obs.takeDamage) obs.takeDamage(1, this);
                    break;
                }
            }
            if (!hit) {
                for (const enemy of this.enemies) {
                    if (!enemy.active || enemy.isDying) continue;
                    if (distance(b.x, b.y, enemy.x, enemy.y) < enemy.radius + b.radius) {
                        // Shield block check
                        if (enemy.type === 'shield' && enemy.isBulletBlocked && enemy.isBulletBlocked(b.x, b.y)) {
                            b.active = false; hit = true;
                            this.effects.push(new ImpactEffect(b.x, b.y));
                            for (let j = 0; j < 5; j++) {
                                const angle = Math.random() * Math.PI * 2;
                                this.effects.push(new Particle(b.x, b.y, Math.cos(angle) * 80, Math.sin(angle) * 80, 200, 2, '#8888FF'));
                            }
                            break;
                        }
                        b.active = false; hit = true;
                        enemy.takeDamage(b.damage, this);
                        this.effects.push(new ImpactEffect(b.x, b.y, false));
                        this.crosshair.onHit();
                        // Rocket explosion
                        if (b.explosive) {
                            const expMult = this.player.explosionMult || 1;
                            this.createExplosion(b.x, b.y, b.explosionRadius || 120, Math.ceil((b.explosionDamage || 80) * expMult), null);
                            this.lighting.addLight(b.x, b.y, 200, '#FF6600', 0.8, 400);
                        }
                        break;
                    }
                }
            }
            if (!b.active) { this._bulletPool.release(b); this.bullets.splice(i, 1); }
        }

        // Update enemy bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const b = this.enemyBullets[i]; b.update(dt);
            let hit = false;
            if (this.player.alive && distance(b.x, b.y, this.player.x, this.player.y) < this.player.radius + b.radius) {
                if (this.godMode) { b.active = false; hit = true; }
                else { this.player.takeDamage(b.damage); b.active = false; hit = true; this.camera.triggerShake(100, 3); }
            }
            if (!hit) {
                for (const obs of allSolidObstacles) {
                    if (!obs.blocksBullets()) continue;
                    const bounds = obs.getBounds();
                    if (circleRectOverlap(b.x, b.y, b.radius, bounds.x, bounds.y, bounds.w, bounds.h)) {
                        b.active = false; hit = true; this.effects.push(new ImpactEffect(b.x, b.y)); break;
                    }
                }
            }
            if (!b.active) { this._enemyBulletPool.release(b); this.enemyBullets.splice(i, 1); }
        }

        // Update enemies
        for (const enemy of this.enemies) { enemy._gameRef = this; enemy.update(dt, this); }
        this.enemies = this.enemies.filter(e => e.active);

        // Wave manager
        this.waveManager.update(dt, this);

        // Pickups
        for (const pickup of this.pickups) {
            pickup.update(dt);
            if (pickup.collect(this.player)) {
                let labelText = '';
                if (pickup.type === 'health') { this.player.heal(pickup.amount); labelText = `+${Math.round(pickup.amount)} HP`; }
                else if (pickup.type === 'stamina') { this.player.restoreStamina(pickup.amount); labelText = `+${Math.round(pickup.amount)} STAM`; }
                else if (pickup.type === 'ammo') { this.player.addAmmo(pickup.amount); labelText = `+AMMO`; }
                else if (pickup.type === 'perk') { this.player.addPerk(pickup.perk); labelText = `PERK: ${pickup.perk.name}`; }
                this.scoreManager.addScore(CONFIG.score.pickupScore);
                this.soundManager.playSound('pickup');
                // Floating pickup text
                this.scoreManager.floatingNumbers.push({
                    x: pickup.x, y: pickup.y - 15, text: labelText,
                    age: 0, maxAge: 1000, vy: -70, isPickup: true,
                    color: pickup.type === 'health' ? '#00FF00' : pickup.type === 'stamina' ? '#0088FF' : '#FFAA00'
                });
                // Collection burst effect
                for (let i = 0; i < 8; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 60 + Math.random() * 80;
                    this.addEffect({
                        x: pickup.x, y: pickup.y,
                        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                        life: 300 + Math.random() * 200, age: 0, size: 2 + Math.random() * 3,
                        color: pickup.type === 'health' ? '#00FF00' : pickup.type === 'stamina' ? '#0088FF' : '#FFAA00',
                        active: true,
                        update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.95; this.vy *= 0.95; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                        render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.size * a, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
                    });
                }
            }
        }
        this.pickups = this.pickups.filter(p => p.active);

        // Effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            if (this.effects[i].update) this.effects[i].update(dt);
            if (!this.effects[i].active) this.effects.splice(i, 1);
        }

        // Lighting & weather
        this.lighting.update(dt);
        this.weather.update(dt, this.player.x, this.player.y);

        // Boss lighting
        for (const enemy of this.enemies) {
            if (enemy.active && enemy.type === 'boss') {
                this.lighting.addLight(enemy.x, enemy.y, 150, '#FF4400', 0.3, 300);
            }
        }

        // Scorch marks: update debris age/rotation, remove expired
        for (let i = this.scorchMarks.length - 1; i >= 0; i--) {
            const mark = this.scorchMarks[i];
            if (mark.isDebris) {
                mark.age += dt * 1000;
                mark.angle += mark.rotSpeed * dt;
                if (mark.age >= mark.life) this.scorchMarks.splice(i, 1);
            }
        }
        // Scorch marks limit
        if (this.scorchMarks.length > 200) this.scorchMarks.splice(0, this.scorchMarks.length - 200);

        // Screen flash decay
        if (this.screenFlash.alpha > 0) {
            this.screenFlash.alpha = Math.max(0, this.screenFlash.alpha - this.screenFlash.decay * dt);
        }

        this.scoreManager.update(dt);
        this.killFeed.update(dt);
        this.hud.update(dt);

        if (!this.player.alive) {
            this.gameState.state = 'gameover';
            this.gameState.submitted = false;
            this.gameState.submitResult = null;
            this.gameState.nameInput = this.persistence.data.playerName;
            this.persistence.updateRunStats(this.scoreManager.score, this.waveManager.wave, this.scoreManager.kills);
            this.audioManager.stopMusic();
            this.soundManager.playSound('gameOver');
            // Death screen flash
            this.screenFlash.alpha = 0.7;
            this.screenFlash.color = '#FF0000';
            this.screenFlash.decay = 0.8;
        }
    }

    _render() {
        const ctx = this.ctx, cameraOffset = this.camera.getOffset();
        const quality = this.graphicsQuality;
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Terrain
        this.tileMap.render(ctx, cameraOffset, this.canvas.width, this.canvas.height, quality);

        // 2. Scorch marks / blood decals / persistent debris
        for (let i = 0; i < this.scorchMarks.length; i++) {
            const mark = this.scorchMarks[i];
            const sx = mark.x - cameraOffset.x, sy = mark.y - cameraOffset.y;
            // Viewport culling for scorch marks
            const markMargin = (mark.radius || 10) * 2 + 20;
            if (sx < -markMargin || sx > ctx.canvas.width + markMargin || sy < -markMargin || sy > ctx.canvas.height + markMargin) continue;
            if (mark.isDebris) {
                // Debris: render with fade based on age (update is in _update)
                const lifeRatio = 1 - mark.age / mark.life;
                const scale = lifeRatio;
                const alpha = lifeRatio * 0.6;
                ctx.save(); ctx.translate(sx, sy); ctx.rotate(mark.angle);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = mark.color;
                // Twisted metal shape
                ctx.beginPath();
                ctx.moveTo(-mark.radius * scale, -mark.radius * 0.3 * scale);
                ctx.lineTo(mark.radius * 0.5 * scale, -mark.radius * scale);
                ctx.lineTo(mark.radius * scale, mark.radius * 0.5 * scale);
                ctx.lineTo(-mark.radius * 0.3 * scale, mark.radius * scale);
                ctx.closePath(); ctx.fill();
                ctx.restore(); ctx.globalAlpha = 1;
            } else {
                // Regular scorch mark / blood
                ctx.beginPath(); ctx.arc(sx, sy, mark.radius, 0, Math.PI * 2);
                ctx.fillStyle = mark.color; ctx.fill();
            }
        }

        // 3. Static obstacles
        for (const obs of this.obstacles) obs.render(ctx, cameraOffset, quality);

        // 4. Destructibles
        for (const d of this.destructibles) d.render(ctx, cameraOffset, quality);

        // 5. Barbed wire
        for (const wire of this.barbedWires) wire.render(ctx, cameraOffset, quality);

        // 6. Pickups
        for (const pickup of this.pickups) pickup.render(ctx, cameraOffset, quality);

        // 7. Enemy bullets
        for (const bullet of this.enemyBullets) bullet.render(ctx, cameraOffset, quality);

        // 8. Player bullets
        for (const bullet of this.bullets) bullet.render(ctx, cameraOffset, quality);

        // 9. Enemies
        for (const enemy of this.enemies) { enemy._gameRef = this; enemy.render(ctx, cameraOffset, quality); }

        // 10. Remote players (multiplayer)
        if (this.network.connected) {
            const remotePlayers = this.network.getRemotePlayers();
            for (const [id, p] of Object.entries(remotePlayers)) {
                this._renderRemotePlayer(ctx, cameraOffset, p, quality);
            }
        }

        // 11. Local player
        this.player.render(ctx, cameraOffset, quality);

        // 12. Effects
        for (const effect of this.effects) effect.render(ctx, cameraOffset, quality);

        // 13. Lighting overlay
        this.lighting.render(ctx, cameraOffset, this.canvas.width, this.canvas.height);

        // 14. Ambient weather particles
        this.weather.render(ctx, cameraOffset, quality);

        // 15. Floating score/damage numbers
        this.scoreManager.render(ctx, cameraOffset);

        // 14. HUD
        if (this.gameState.state === 'playing' || this.gameState.state === 'paused') {
            this.hud.render(ctx, this.player, this.camera, this.bullets, this.enemyBullets, this.enemies, this.effects, this.scoreManager, this.waveManager, this.killFeed, this.persistence, this.audioManager, this);
        }

        // 15. Minimap
        if (this.persistence.data.settings.showMinimap && (this.gameState.state === 'playing' || this.gameState.state === 'paused')) {
            this.minimap.render(ctx, this.player, this.buildings, this.cars, this.barrels, this.trees, this.enemies, this.pickups, this.trucks, this.suvs, this.vans);
        }

        // 16. Game state overlay
        this.gameState.render(ctx, this);

        // 17. Crosshair (always visible during play)
        if (this.gameState.state === 'playing') {
            this.crosshair.render(ctx, this.input.mouse.x, this.input.mouse.y, this.player);
        }

        // 18. Screen flash overlay
        if (this.screenFlash.alpha > 0) {
            ctx.globalAlpha = this.screenFlash.alpha;
            ctx.fillStyle = this.screenFlash.color;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.globalAlpha = 1;
        }

        // 19. Dev cheat overlay
        if (this.devCheats && this.gameState.state === 'playing') {
            this._renderDevCheatOverlay(ctx);
        }

        // 20. Debug overlays (detection ranges)
        if (this.hud.showDebug) {
            for (const enemy of this.enemies) {
                if (!enemy.active) continue;
                ctx.beginPath(); ctx.arc(enemy.x - cameraOffset.x, enemy.y - cameraOffset.y, enemy.detectionRange, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0,255,0,0.1)'; ctx.lineWidth = 1; ctx.stroke();
            }
        }
    }

    _renderDevCheatOverlay(ctx) {
        const cheats = [
            ['G', 'God mode'],
            ['K', 'Kill all'],
            ['N', 'Next wave'],
            ['M', 'Max ammo'],
            ['H', 'Full heal'],
            ['B', 'Spawn boss'],
        ];
        const x = 10, startY = 70, lineH = 16, pad = 6;
        const w = 170, h = cheats.length * lineH + pad * 2 + 18;
        ctx.fillStyle = 'rgba(100,0,0,0.75)'; ctx.fillRect(x, startY, w, h);
        ctx.strokeStyle = '#FF4444'; ctx.lineWidth = 1; ctx.strokeRect(x, startY, w, h);
        ctx.font = 'bold 11px "Courier New", monospace'; ctx.fillStyle = '#FF6666'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('DEV CHEATS', x + pad, startY + pad);
        ctx.font = '10px "Courier New", monospace';
        for (let i = 0; i < cheats.length; i++) {
            const [key, label] = cheats[i];
            ctx.fillStyle = '#FF9999'; ctx.fillText(`[${key}]`, x + pad, startY + 18 + pad + i * lineH);
            ctx.fillStyle = '#FFCCCC'; ctx.fillText(label, x + pad + 30, startY + 18 + pad + i * lineH);
        }
        // God mode indicator
        if (this.godMode) {
            ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#FF0000'; ctx.textAlign = 'center';
            ctx.fillText('GOD MODE ACTIVE', x + w / 2, startY + h + 4);
        }
    }

    _renderRemotePlayer(ctx, cameraOffset, playerData, quality) {
        const sx = playerData.x - cameraOffset.x, sy = playerData.y - cameraOffset.y;
        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 4, sy + 5, 14, 10, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
        }
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(playerData.angle || 0);
        // Body (blue tint for remote players)
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#234A6D'; ctx.fill(); ctx.strokeStyle = '#1A3A5A'; ctx.lineWidth = 2; ctx.stroke();
        // Head
        ctx.beginPath(); ctx.arc(5, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#1A3A5A'; ctx.fill();
        // Gun
        ctx.fillStyle = '#2C2C2C'; ctx.fillRect(8, -3, 24, 6);
        ctx.restore();
        // Name
        ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#00CCFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(playerData.name || 'Player', sx, sy - 24);
        // HP bar
        if (playerData.hp !== undefined && playerData.hp < 100) {
            const barW = 30, barH = 3;
            ctx.fillStyle = '#222'; ctx.fillRect(sx - barW / 2, sy - 22, barW, barH);
            ctx.fillStyle = '#4CAF50'; ctx.fillRect(sx - barW / 2, sy - 22, barW * (playerData.hp / 100), barH);
        }
    }

    _regenerateMapForWave(waveNumber) {
        this._regenerateDestructibles(waveNumber);
        this._regeneratePickups(waveNumber);
        this._addWaveElements(waveNumber);
    }

    _regenerateDestructibles(waveNumber) {
        for (const d of this.destructibles) {
            if (d.destroyed) { d.destroyed = false; d.hp = d.maxHp; }
        }
        const newCrateCount = Math.min(Math.floor(waveNumber / 3), 8);
        const cx = CONFIG.world.width / 2, cy = CONFIG.world.height / 2;
        for (let i = 0; i < newCrateCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 200 + Math.random() * 600;
            const x = clamp(cx + Math.cos(angle) * dist, 100, CONFIG.world.width - 100);
            const y = clamp(cy + Math.sin(angle) * dist, 100, CONFIG.world.height - 100);
            if (distance(x, y, this.player.x, this.player.y) < 150) continue;
            const crate = new Crate(x, y, 28 + Math.random() * 12);
            this.destructibles.push(crate);
            this.obstacles.push(crate);
            this._dynamicObstacles.push(crate);
        }
        const newSandbagCount = Math.min(Math.floor(waveNumber / 4), 6);
        for (let i = 0; i < newSandbagCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 300 + Math.random() * 500;
            const x = clamp(cx + Math.cos(angle) * dist, 100, CONFIG.world.width - 100);
            const y = clamp(cy + Math.sin(angle) * dist, 100, CONFIG.world.height - 100);
            if (distance(x, y, this.player.x, this.player.y) < 150) continue;
            const w = 40 + Math.random() * 60;
            const h = 16 + Math.random() * 16;
            const sandbag = new Sandbag(x, y, w, h);
            this.obstacles.push(sandbag);
            this._dynamicObstacles.push(sandbag);
        }
    }

    _regeneratePickups(waveNumber) {
        const healthCount = Math.min(3 + Math.floor(waveNumber / 2), 8);
        const ammoCount = Math.min(2 + Math.floor(waveNumber / 3), 6);
        const staminaCount = Math.min(2 + Math.floor(waveNumber / 4), 5);
        const cx = CONFIG.world.width / 2, cy = CONFIG.world.height / 2;
        for (let i = 0; i < healthCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 200 + Math.random() * 700;
            this.pickups.push(new Pickup(clamp(cx + Math.cos(angle) * dist, 100, CONFIG.world.width - 100), clamp(cy + Math.sin(angle) * dist, 100, CONFIG.world.height - 100), 'health'));
        }
        for (let i = 0; i < ammoCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 200 + Math.random() * 700;
            this.pickups.push(new Pickup(clamp(cx + Math.cos(angle) * dist, 100, CONFIG.world.width - 100), clamp(cy + Math.sin(angle) * dist, 100, CONFIG.world.height - 100), 'ammo'));
        }
        for (let i = 0; i < staminaCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 200 + Math.random() * 700;
            this.pickups.push(new Pickup(clamp(cx + Math.cos(angle) * dist, 100, CONFIG.world.width - 100), clamp(cy + Math.sin(angle) * dist, 100, CONFIG.world.height - 100), 'stamina'));
        }
    }

    _addWaveElements(waveNumber) {
        if (waveNumber > 0 && waveNumber % 3 === 0) {
            const cx = CONFIG.world.width / 2, cy = CONFIG.world.height / 2;
            const angle = Math.random() * Math.PI * 2;
            const dist = 300 + Math.random() * 400;
            const x = clamp(cx + Math.cos(angle) * dist, 200, CONFIG.world.width - 200);
            const y = clamp(cy + Math.sin(angle) * dist, 200, CONFIG.world.height - 200);
            this.effects.push({
                x, y, age: 0, maxAge: 5000, active: true,
                update(dt) { this.age += dt * 1000; if (this.age > this.maxAge) this.active = false; },
                render(ctx, cam) {
                    const sx = this.x - cam.x, sy = this.y - cam.y;
                    const pulse = 0.5 + Math.sin(this.age * 0.005) * 0.5;
                    ctx.strokeStyle = `rgba(0,255,100,${pulse * 0.6})`; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(sx, sy, 30 + pulse * 10, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = `rgba(0,255,100,${pulse * 0.15})`;
                    ctx.beginPath(); ctx.arc(sx, sy, 50, 0, Math.PI * 2); ctx.fill();
                    ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#00FF64'; ctx.textAlign = 'center';
                    ctx.fillText('SUPPLY DROP', sx, sy - 40);
                }
            });
            this.pickups.push(new Pickup(x - 20, y, 'health'));
            this.pickups.push(new Pickup(x + 20, y, 'ammo'));
            this.pickups.push(new Pickup(x, y - 20, 'stamina'));
            this.waveManager.announcementText = 'SUPPLY DROP INCOMING!';
            this.waveManager.announcementTimer = 2500;
        }
    }

    _spawnPerkChoice() {
        const available = CONFIG.perks.list.filter(p => !this.player.perks.find(pp => pp.id === p.id));
        const choices = [];
        const pool = [...available];
        for (let i = 0; i < Math.min(3, pool.length); i++) {
            const idx = Math.floor(Math.random() * pool.length);
            choices.push(pool.splice(idx, 1)[0]);
        }
        const px = this.player.x, py = this.player.y;
        for (let i = 0; i < choices.length; i++) {
            const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
            const dist = 100;
            const perk = choices[i];
            const perkPickup = {
                x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist,
                type: 'perk', perk, active: true, radius: 20, color: '#FF00FF',
                lifetime: 30000, age: 0, bobPhase: Math.random() * Math.PI * 2,
                update(dt) { this.bobPhase += dt * 3; this.age += dt * 1000; if (this.age > this.lifetime) this.active = false; },
                collect(player) {
                    if (!this.active) return false;
                    const d = Math.sqrt((this.x - player.x) ** 2 + (this.y - player.y) ** 2);
                    if (d < this.radius + player.radius) { this.active = false; return true; }
                    return false;
                },
                render(ctx, cameraOffset, quality) {
                    if (!this.active) return;
                    const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
                    const bob = Math.sin(this.bobPhase) * 5;
                    const alpha = this.age > this.lifetime - 2000 ? (this.lifetime - this.age) / 2000 : 1;
                    ctx.save(); ctx.globalAlpha = alpha;
                    const pulse = 0.5 + Math.sin(this.bobPhase * 2) * 0.5;
                    ctx.beginPath(); ctx.arc(sx, sy + bob, this.radius + 12, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,0,255,${0.15 * pulse})`; ctx.fill();
                    ctx.beginPath(); ctx.arc(sx, sy + bob, this.radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#FF00FF'; ctx.fill();
                    ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2; ctx.stroke();
                    ctx.fillStyle = '#FFF'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(this.perk.icon, sx, sy + bob);
                    ctx.font = '10px monospace'; ctx.fillStyle = '#FF88FF';
                    ctx.fillText(this.perk.name, sx, sy + bob + this.radius + 14);
                    ctx.restore(); ctx.globalAlpha = 1;
                }
            };
            this.pickups.push(perkPickup);
        }
        this.waveManager.announcementText = 'CHOOSE A PERK!';
        this.waveManager.announcementTimer = 3000;
    }
}

// ============================================================
// AUDIO MANAGER WRAPPER - Bridges AudioManager to game systems
// ============================================================
class AudioManagerWrapper {
    constructor(audioManager) { this.am = audioManager; }
    playSound(name) { this.am.playSound(name); }
    init() { this.am.init(); }
}

// Global reference for HUD debug
let game = null;

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener('DOMContentLoaded', () => { new Game(); });
