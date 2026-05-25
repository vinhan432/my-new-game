/**
 * Dodge Warfare - Phase 6
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
                b.explosionDamage = explosionDamage || 0;
                b.trail = [{x,y},{x,y},{x,y},{x,y},{x,y},{x,y}]; b.trailIdx = 0; b.maxTrail = 6;
            }, 80
        );
        this._enemyBulletPool = new ObjectPool(
            () => new EnemyBullet(0, 0, 0, 0, 0),
            (b, x, y, angle, speed, damage) => {
                b.x = x; b.y = y; b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
                b.speed = speed; b.damage = damage; b.lifetime = 4000; b.age = 0; b.active = true;
                b.radius = 4;
                b.trail = [{x,y},{x,y},{x,y},{x,y}]; b.trailIdx = 0; b.maxTrail = 4;
            }, 60
        );

        // Mission state
        this.currentMission = null;
        this.tileMap = null;
        this.camera = new Camera(CONFIG.world.width, CONFIG.world.height);

        // Ensure achievement methods exist
        if (!this.persistence.checkAchievements) {
            this.persistence.checkAchievements = function() { return []; };
        }
        if (!this.persistence.getDailyChallenge) {
            this.persistence.getDailyChallenge = function() { return null; };
        }

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
        // Companions (Phase 6)
        this.pets = []; this.drones = [];
        this.teammates = [];

        // Endless mode
        this.endlessMode = false;
        this.endlessChunks = {};
        this.endlessDistance = 0;
        this.endlessSpawnTimer = 0;
        this.endlessDifficulty = 1;
        this._endlessInitialized = false;

        // Graphics systems
        this.lighting = new LightingManager();
        this.weather = new AmbientWeather();

        // UI
        this.hud = new HUD(); this.crosshair = new Crosshair();
        this.minimap = new Minimap(); this.killFeed = new KillFeed();
        this.waveManager = new WaveManager(); this.scoreManager = new ScoreManager();
        this.gameState = new GameStateManager(); this.soundManager = new AudioManagerWrapper(this.audioManager);
        this.screenFlash = { alpha: 0, color: '#FFF', decay: 3.0 };
        this.activeHazard = null;
        this.bot = new BotController();
        this.antiCheat = new AntiCheat();
        this.events = new GameplayEvents();

        // Dynamic quality & performance scaling
        this.qualityScaler = new QualityScaler();
        this._renderScale = 1.0;
        this._internalCanvas = null;

        // Flamethrower stream system
        this.flameStream = new FlameStream();
        this.firePools = [];

        // Phase 7: New Features
        this.killStreakManager = new KillStreakManager();
        this.headshotSystem = new HeadshotSystem();
        this.meleeSystem = new MeleeSystem();
        this.supplyDropManager = new SupplyDropManager();
        this.trapSystem = new TrapSystem();
        this.ragdollSystem = new RagdollSystem();
        this.weaponMasterySystem = new WeaponMasterySystem();

        // Spatial hash for collision optimization
        this._spatialHash = new SpatialHash(250);

        // Helicopter & mission objectives
        this.helicopter = null;
        this.missionObjective = null;
        this._objectiveComplete = false;
        this._missionCompleted = false;
        this._missionFrozen = false; // When true, only helicopter and player move

        // Map data
        this.buildings = []; this.cars = []; this.barrels = []; this.trees = [];
        this.trucks = []; this.suvs = []; this.vans = [];
        this._dynamicObstacles = []; // Track obstacles added during gameplay (crates, sandbags)

        this.lastTime = 0; this.running = false; this.runTime = 0;
        this.godMode = false; this.devCheats = false;
        this._deathDelay = undefined;
        this._deathDelayDone = false;
        this.graphicsQuality = s.graphicsQuality || 'high';

        this._generateMap();
        this._spawnInitialPickups();
        this._setupNetworkCallbacks();
        this._setupInputHandlers();

        this.running = true; this.lastTime = performance.now();
        requestAnimationFrame((time) => this._loop(time));
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.dpr = dpr;
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        // Reposition mobile joysticks
        if (this.input && this.input.isMobile) {
            this.input._repositionJoysticks(window.innerWidth, window.innerHeight);
            this.input.touchButtons.init(window.innerWidth, window.innerHeight);
        }
    }

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
            // Bot mode toggle (B key — works anytime during gameplay)
            if (e.code === 'KeyB' && !this.devCheats && (this.gameState.state === 'playing' || this.gameState.state === 'paused')) {
                const wasActive = this.bot.active;
                this.bot.toggle();
                if (this.soundManager) this.soundManager.playSound('menuSelect');
            }
            if (e.code === 'Backquote' && this.gameState.state === 'playing') this.devCheats = !this.devCheats;
            if (this.devCheats) {
                if (e.code === 'KeyG') { this.godMode = !this.godMode; console.log('God mode:', this.godMode); }
                if (e.code === 'KeyK') this._killAllEnemies();
                if (e.code === 'KeyN') { this.waveManager.state = 'between'; this.waveManager.timer = 0; }
                if (e.code === 'KeyM') this.player.addAmmo(1.0);
                if (e.code === 'KeyH') this.player.hp = this.player.maxHP;
                if (e.code === 'KeyB') this._spawnBossEnemy();
            }
            // Melee attack (V key)
            if (e.code === 'KeyV' && this.gameState.state === 'playing') {
                this.meleeSystem.tryMeleeAttack(this.player, this);
            }
            // Place trap (X key)
            if (e.code === 'KeyX' && this.gameState.state === 'playing') {
                const trapType = e.shiftKey ? 'claymore' : 'mine';
                this.trapSystem.placeTrap(this.player.x, this.player.y, trapType, this);
            }
            // Use kill streak (K key)
            if (e.code === 'KeyK' && !this.devCheats && this.gameState.state === 'playing') {
                this.killStreakManager.useStreak(this);
            }
            // Init audio on first interaction
            if (!this.audioManager.initialized) this.audioManager.init();
        });
        this.canvas.addEventListener('click', () => {
            if (!this.audioManager.initialized) this.audioManager.init();
            this.audioManager.resume();
        });
        this.canvas.addEventListener('touchstart', () => {
            if (!this.audioManager.initialized) this.audioManager.init();
            this.audioManager.resume();
        }, { passive: true });
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

    startGame(loadoutWeapons, joinDailyChallenge = false) {
        this.runTime = 0;
        this.audioManager.startMusic('combat');
        this.gameState.submitted = false;
        this.gameState.submitResult = null;
        this.antiCheat.init(this.player);
        this.killStreakManager.reset();
        this.isDailyChallenge = joinDailyChallenge;
        if (joinDailyChallenge) {
            this.waveManager.announcementText = 'DAILY CHALLENGE!';
            this.waveManager.announcementTimer = 3000;
        }
        if (loadoutWeapons) {
            this.player.carriedWeaponIndices = [...loadoutWeapons];
            if (!this.player.carriedWeaponIndices.includes(0)) {
                this.player.carriedWeaponIndices[0] = 0;
            }
            const firstValid = this.player.carriedWeaponIndices.find(idx => idx >= 0);
            if (firstValid !== undefined) {
                this.player._switchWeapon(firstValid);
            }
        }
    }

    startEndless(loadoutWeapons, joinDailyChallenge = false) {
        this.endlessMode = true;
        this.endlessChunks = {};
        this.endlessDistance = 0;
        this.endlessSpawnTimer = 0;
        this.endlessDifficulty = 1;
        this._endlessInitialized = false;
        this.currentMission = { id: 'endless', name: 'Endless Run', waves: Infinity, bossWave: -1, theme: 'urban' };
        // Helicopter and objectives not applicable in endless mode
        this.helicopter = null;
        this.missionObjective = null;
        this._objectiveComplete = false;
        this._missionCompleted = false;
        this._missionFrozen = false;
        this._defendZone = null;
        // Large world for camera clamping (but we generate chunks dynamically)
        CONFIG.world.width = 100000; CONFIG.world.height = 100000;
        this.camera = new Camera(100000, 100000);
        // Clear
        this.obstacles = []; this.destructibles = []; this.barbedWires = [];
        this.buildings = []; this.cars = []; this.barrels = []; this.trees = [];
        this.bullets = []; this.enemyBullets = []; this.enemies = [];
        this.effects = []; this.scorchMarks = []; this.pickups = [];
        // Create tilemap for the theme
        this.tileMap = new TileMap(100000, 100000, 'urban');
        this.tileMap.tiles = []; // Lazy generate per chunk
        // Endless mode gets random hazards based on difficulty
        this.activeHazard = null;
        // Player at center
        this.player.x = 50000; this.player.y = 50000;
        this.player.hp = this.player.maxHP; this.player.alive = true;
        this.player.applyUpgrades(this.persistence);
        // Companions
        this.pets = []; this.drones = []; this.teammates = [];
        if (this.persistence.data.equippedPet) {
            const petConfig = CONFIG.shop.pets.find(p => p.id === this.persistence.data.equippedPet);
            if (petConfig) this.pets.push(new Pet(petConfig, this.player));
        }
        if (this.persistence.data.equippedDrone) {
            const droneConfig = CONFIG.shop.drones.find(d => d.id === this.persistence.data.equippedDrone);
            if (droneConfig) this.drones.push(new PlayerDrone(droneConfig, this.player));
        }
        if (this.persistence.data.equippedTeammate) {
            const tmConfig = CONFIG.shop.teammates.find(t => t.id === this.persistence.data.equippedTeammate);
            if (tmConfig) this.teammates.push(new Teammate(tmConfig, this.player));
        }
        // Reset wave manager state
        this.waveManager = new WaveManager();
        this.waveManager.wave = 0;
        this.waveManager.state = 'active'; // Always active in endless
        this.scoreManager.reset();
        this.killFeed = new KillFeed();
        // Generate initial chunks
        this._updateEndlessChunks();
        this.startGame(loadoutWeapons, joinDailyChallenge);
    }

    loadMission(missionId) {
        const mission = CONFIG.missions.find(m => m.id === missionId);
        if (!mission) { console.error('Mission not found:', missionId); return; }
        this.currentMission = mission;
        // Initialize hazard if mission has one
        this.activeHazard = null;
        if (mission.hazard === 'storm') this.activeHazard = new LightningStorm(mission.worldSize, mission.worldSize);
        else if (mission.hazard === 'blizzard') this.activeHazard = new BlizzardHazard(mission.worldSize, mission.worldSize);
        else if (mission.hazard === 'volcano') this.activeHazard = new VolcanicHazard(mission.worldSize, mission.worldSize);
        // Track missions played for achievements
        if (!this.persistence.data.missionsPlayed) this.persistence.data.missionsPlayed = [];
        if (!this.persistence.data.missionsPlayed.includes(missionId)) {
            this.persistence.data.missionsPlayed.push(missionId);
        }
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
        // Apply shop upgrades (Phase 6)
        this.player.applyUpgrades(this.persistence);
        // Spawn equipped companions (Phase 6)
        this.pets = []; this.drones = []; this.teammates = [];
        if (this.persistence.data.equippedPet) {
            const petConfig = CONFIG.shop.pets.find(p => p.id === this.persistence.data.equippedPet);
            if (petConfig) this.pets.push(new Pet(petConfig, this.player));
        }
        if (this.persistence.data.equippedDrone) {
            const droneConfig = CONFIG.shop.drones.find(d => d.id === this.persistence.data.equippedDrone);
            if (droneConfig) this.drones.push(new PlayerDrone(droneConfig, this.player));
        }
        // Spawn AI teammates (singleplayer squad)
        const teammateNames = [
            { name: 'Vasquez', role: 'assault' },
            { name: 'Kim', role: 'medic' },
            { name: 'Okafor', role: 'sniper' },
            { name: 'Reeves', role: 'support' },
        ];
        const squadSize = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < squadSize; i++) {
            const tm = teammateNames[i];
            const angle = (Math.PI * 2 / (squadSize + 1)) * (i + 1);
            const tx = mission.playerSpawn.x + Math.cos(angle) * 80;
            const ty = mission.playerSpawn.y + Math.sin(angle) * 80;
            this.teammates.push(new AITeammate(tx, ty, tm.name, tm.role));
        }
        // Apply daily challenge modifier
        const daily = this.persistence.getDailyChallenge ? this.persistence.getDailyChallenge() : null;
        if (daily && daily.modify) {
            daily.modify(this);
            this._activeDailyChallenge = daily;
        }
        // One weapon challenge: lock to starting weapon
        if (this._challengeOneWeapon) {
            const lockedIndex = this.player.currentWeaponIndex;
            this.player._switchWeapon = function() {};
            this.player.currentWeaponIndex = lockedIndex;
        }
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
        // Initialize mission objective
        this.missionObjective = null;
        this.helicopter = null;
        this._objectiveComplete = false;
        this._missionCompleted = false;
        if (mission.objective) {
            const obj = mission.objective;
            switch (obj.type) {
                case 'kill':
                    this.missionObjective = new KillObjective(obj.target, obj.reward);
                    break;
                case 'survive':
                    this.missionObjective = new SurviveObjective(mission.waves, obj.reward);
                    break;
                case 'boss':
                    this.missionObjective = new BossObjective(obj.reward);
                    break;
                case 'waveclear':
                    this.missionObjective = new WaveClearObjective(mission.waves, obj.reward);
                    break;
                case 'defend':
                    this.missionObjective = new DefendObjective(obj.x, obj.y, obj.radius, obj.duration, obj.reward);
                    break;
                case 'activate':
                    this.missionObjective = new ActivateObjective(obj.x, obj.y, obj.radius, obj.reward);
                    break;
                case 'rescue':
                    this.missionObjective = new RescueObjective(obj.x, obj.y, obj.radius, obj.duration, obj.reward);
                    break;
            }
        }
        // Reset spatial hash
        this._spatialHash.clear();
        // Rebuild spatial hash for static obstacles
        for (const obs of this.obstacles) {
            if (obs.x !== undefined) this._spatialHash.insert(obs);
        }
    }

    _updateEndlessChunks() {
        const cs = CONFIG.endless.chunkSize;
        const viewR = CONFIG.endless.viewChunks;
        const pcx = Math.floor(this.player.x / cs);
        const pcy = Math.floor(this.player.y / cs);
        // Generate nearby chunks
        for (let dy = -viewR; dy <= viewR; dy++) {
            for (let dx = -viewR; dx <= viewR; dx++) {
                const cx = pcx + dx, cy = pcy + dy;
                const key = `${cx}_${cy}`;
                if (!this.endlessChunks[key]) {
                    this.endlessChunks[key] = true;
                    this._generateEndlessChunk(cx * cs, cy * cs, cs);
                }
            }
        }
        // Cleanup far chunks
        for (const key of Object.keys(this.endlessChunks)) {
            const [cx, cy] = key.split('_').map(Number);
            if (Math.abs(cx - pcx) > viewR + 1 || Math.abs(cy - pcy) > viewR + 1) {
                delete this.endlessChunks[key];
                const minX = cx * cs, minY = cy * cs, maxX = minX + cs, maxY = minY + cs;
                this.obstacles = this.obstacles.filter(o => {
                    const ox = o.x + (o.w || 0) / 2;
                    const oy = o.y + (o.h || 0) / 2;
                    return !(ox >= minX && ox <= maxX && oy >= minY && oy <= maxY);
                });
                this.trees = this.trees.filter(t => t.x < minX || t.x > maxX || t.y < minY || t.y > maxY);
                this.barrels = this.barrels.filter(b => b.x < minX || b.x > maxX || b.y < minY || b.y > maxY);
                this.buildings = this.buildings.filter(b => b.x < minX || b.x > maxX || b.y < minY || b.y > maxY);
                this.pickups = this.pickups.filter(p => (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) || p.active);
            }
        }
    }

    _generateEndlessChunk(cx, cy, cs) {
        const diff = this.endlessDifficulty;
        // Determine biome based on chunk position (seeded by position for consistency)
        const biomeHash = Math.abs(Math.sin(cx * 0.001 + cy * 0.0013) * 43758.5453) % 1;
        let biome;
        if (biomeHash < 0.25) biome = 'urban';
        else if (biomeHash < 0.5) biome = 'forest';
        else if (biomeHash < 0.75) biome = 'desert';
        else biome = 'industrial';
        const biomeConfig = CONFIG.biomes[biome];

        // Road through chunk (connects to neighboring chunks via edges)
        const hasRoad = Math.random() < 0.6;
        if (hasRoad) {
            const horizontal = Math.random() < 0.5;
            const roadY = cy + cs * (0.3 + Math.random() * 0.4);
            const roadX = cx + cs * (0.3 + Math.random() * 0.4);
            // Add buildings along road
            const buildingCount = 1 + Math.floor(Math.random() * 3);
            for (let i = 0; i < buildingCount; i++) {
                const bx = horizontal ? cx + 100 + Math.random() * (cs - 200) : roadX + (Math.random() < 0.5 ? -200 : 100) + Math.random() * 100;
                const by = horizontal ? roadY + (Math.random() < 0.5 ? -200 : 100) + Math.random() * 100 : cy + 100 + Math.random() * (cs - 200);
                const bw = 100 + Math.random() * 150, bh = 80 + Math.random() * 120;
                const doors = [{ x: Math.random() * (bw - 20) + 10, y: 0, w: 20, h: 10 }];
                const b = new Building(bx, by, bw, bh, doors);
                this.buildings.push(b); this.obstacles.push(b);
            }
        }

        // Obstacles based on biome
        const numObstacles = Math.floor(CONFIG.endless.obstacleDensity * (cs / 200) * Math.min(diff, 3));
        for (let i = 0; i < numObstacles; i++) {
            const x = cx + 80 + Math.random() * (cs - 160);
            const y = cy + 80 + Math.random() * (cs - 160);
            const type = Math.random();
            if (biome === 'urban' || biome === 'industrial') {
                if (type < 0.25) {
                    const v = new Vehicle(x, y, 60 + Math.random() * 30, 30 + Math.random() * 15, Math.random() * Math.PI, 'car');
                    this.cars.push(v); this.destructibles.push(v); this.obstacles.push(v);
                } else if (type < 0.4) {
                    const b = new Barrel(x, y);
                    this.barrels.push(b); this.destructibles.push(b); this.obstacles.push(b);
                } else if (type < 0.55) {
                    const w = 40 + Math.random() * 80, h = 16 + Math.random() * 20;
                    this.obstacles.push(new Sandbag(x, y, w, h));
                } else if (type < 0.7) {
                    this.obstacles.push(new Crate(x, y, 28 + Math.random() * 12));
                } else if (type < 0.85) {
                    this.barbedWires.push(new BarbedWire(x, y, 40 + Math.random() * 60, 30 + Math.random() * 40));
                }
            } else if (biome === 'forest') {
                if (type < 0.5) {
                    const t = new Tree(x, y, 14 + Math.random() * 18);
                    this.trees.push(t); this.obstacles.push(t);
                } else if (type < 0.65) {
                    const b = new Barrel(x, y);
                    this.barrels.push(b); this.destructibles.push(b); this.obstacles.push(b);
                } else if (type < 0.8) {
                    this.barbedWires.push(new BarbedWire(x, y, 50 + Math.random() * 60, 40 + Math.random() * 40));
                } else if (type < 0.9) {
                    this.obstacles.push(new Crate(x, y, 28 + Math.random() * 12));
                }
            } else { // desert
                if (type < 0.2) {
                    const v = new Vehicle(x, y, 60 + Math.random() * 30, 30 + Math.random() * 15, Math.random() * Math.PI, 'car');
                    this.cars.push(v); this.destructibles.push(v); this.obstacles.push(v);
                } else if (type < 0.4) {
                    const b = new Barrel(x, y);
                    this.barrels.push(b); this.destructibles.push(b); this.obstacles.push(b);
                } else if (type < 0.55) {
                    const t = new Tree(x, y, 10 + Math.random() * 12);
                    this.trees.push(t); this.obstacles.push(t);
                } else if (type < 0.7) {
                    this.obstacles.push(new Crate(x, y, 28 + Math.random() * 12));
                }
            }
        }

        // Pickups (more generous in endless)
        const numPickups = Math.ceil(CONFIG.endless.pickupDensity * (cs / 200));
        for (let i = 0; i < numPickups; i++) {
            const x = cx + 100 + Math.random() * (cs - 200);
            const y = cy + 100 + Math.random() * (cs - 200);
            const r = Math.random();
            const type = r < 0.35 ? 'ammo' : r < 0.65 ? 'health' : 'stamina';
            this.pickups.push(new Pickup(x, y, type));
        }
    }

    _updateEndless(dt) {
        if (!this.endlessMode || !this.player.alive) return;
        // Track distance (skip first frame to establish baseline)
        if (!this._endlessInitialized) {
            this._endlessInitialized = true;
            this._prevEndlessX = this.player.x;
            this._prevEndlessY = this.player.y;
            return;
        }
        const dx = this.player.x - this._prevEndlessX;
        const dy = this.player.y - this._prevEndlessY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.endlessDistance += dist;
        this._prevEndlessX = this.player.x;
        this._prevEndlessY = this.player.y;
        // Update difficulty based on distance
        this.endlessDifficulty = 1 + this.endlessDistance / 1000 * CONFIG.endless.difficultyRamp;

        // Random hazard events in endless mode
        if (this.endlessDifficulty > 1.5 && !this.activeHazard && Math.random() < 0.001) {
            const hazards = ['storm', 'blizzard', 'volcano'];
            const h = hazards[Math.floor(Math.random() * hazards.length)];
            if (h === 'storm') this.activeHazard = new LightningStorm(100000, 100000);
            else if (h === 'blizzard') this.activeHazard = new BlizzardHazard(100000, 100000);
            else this.activeHazard = new VolcanicHazard(100000, 100000);
            this.waveManager.announcementText = h === 'storm' ? 'STORM INCOMING!' : h === 'blizzard' ? 'BLIZZARD APPROACHING!' : 'VOLCANIC ERUPTION!';
            this.waveManager.announcementTimer = 3000;
        }
        // Clear hazard after a while
        if (this.activeHazard && Math.random() < 0.0005) {
            this.activeHazard = null;
        }

        // Enemy spawning
        this.endlessSpawnTimer -= dt * 1000;
        const spawnRate = Math.max(CONFIG.endless.enemyMinRate, CONFIG.endless.enemyBaseRate / this.endlessDifficulty);
        if (this.endlessSpawnTimer <= 0) {
            this.endlessSpawnTimer = spawnRate;
            this._spawnEndlessEnemy();
        }
        // Update chunks
        this._updateEndlessChunks();
    }

    _spawnEndlessEnemy() {
        const diff = this.endlessDifficulty;
        const angle = Math.random() * Math.PI * 2;
        const dist = 600 + Math.random() * 200;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;
        const types = ['grunt'];
        if (diff > 1.2) types.push('rusher');
        if (diff > 1.5) types.push('flanker');
        if (diff > 2) types.push('heavy');
        if (diff > 2.5) types.push('sniper');
        if (diff > 3) types.push('bomber');
        if (diff > 3.5) types.push('ninja');
        if (diff > 4) types.push('drone');
        if (diff > 4.5) types.push('charger', 'grenadier');
        if (diff > 5) types.push('swarm');
        if (diff > 6) types.push('psyker');
        if (diff > 7) types.push('assassin');
        if (diff > 8) types.push('summoner');
        const type = types[Math.floor(Math.random() * types.length)];
        const hpMult = 1 + (diff - 1) * 0.3;
        const dmgMult = 1 + (diff - 1) * 0.2;
        let enemy;
        switch (type) {
            case 'grunt': enemy = new EnemyGrunt(x, y, hpMult, dmgMult); break;
            case 'rusher': enemy = new EnemyRusher(x, y, hpMult, dmgMult); break;
            case 'heavy': enemy = new EnemyHeavy(x, y, hpMult, dmgMult); break;
            case 'sniper': enemy = new EnemySniper(x, y, hpMult, dmgMult); break;
            case 'flanker': enemy = new EnemyFlanker(x, y, hpMult, dmgMult); break;
            case 'bomber': enemy = new EnemyBomber(x, y, hpMult, dmgMult); break;
            case 'ninja': enemy = new EnemyNinja(x, y, hpMult, dmgMult); break;
            case 'drone': enemy = new EnemyDrone(x, y, hpMult, dmgMult); break;
            case 'grenadier': enemy = new EnemyGrenadier(x, y, hpMult, dmgMult); break;
            case 'psyker': enemy = new EnemyPsyker(x, y, hpMult, dmgMult); break;
            case 'swarm': enemy = new EnemySwarm(x, y, hpMult, dmgMult); break;
            case 'charger': enemy = new EnemyCharger(x, y, hpMult, dmgMult); break;
            case 'assassin': enemy = new EnemyAssassin(x, y, hpMult, dmgMult); break;
            case 'summoner': enemy = new EnemySummoner(x, y, hpMult, dmgMult); break;
            default: enemy = new EnemyGrunt(x, y, hpMult, dmgMult);
        }
        enemy._gameRef = this;
        enemy.initVariant(this);
        this.enemies.push(enemy);
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
        this._solidCacheDirty = true;
        this.addScorchMark({ x, y, radius: radius * 0.6, color: 'rgba(20,20,20,0.4)', isBlood: false });

        // Persistent debris: twisted metal / broken bits that fade over 5-10 seconds
        const debrisMult = this.graphicsQuality === 'low' ? 0.3 : this.graphicsQuality === 'medium' ? 0.7 : 1;
        const debrisCount = Math.floor((3 + radius / 30) * debrisMult);
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
        // Damage player (squared distance)
        const radiusSq = radius * radius;
        const pdx = this.player.x - x, pdy = this.player.y - y;
        const pDistSq = pdx * pdx + pdy * pdy;
        if (pDistSq < radiusSq) {
            const pDist = Math.sqrt(pDistSq);
            this.player.takeDamage(damage * (1 - pDist / radius));
        }
        // Damage enemies (squared distance)
        for (let i = 0, eLen = this.enemies.length; i < eLen; i++) {
            const enemy = this.enemies[i];
            if (!enemy.active || enemy.isDying) continue;
            const edx = enemy.x - x, edy = enemy.y - y;
            const eDistSq = edx * edx + edy * edy;
            const eRSum = radius + enemy.radius;
            if (eDistSq < eRSum * eRSum) {
                const eDist = Math.sqrt(eDistSq);
                enemy.takeDamage(damage * (1 - eDist / (radius + enemy.radius)), this);
            }
        }
        // Chain reaction for destructibles
        for (let i = 0, dLen = this.destructibles.length; i < dLen; i++) {
            const d = this.destructibles[i];
            if (d === source || d.destroyed) continue;
            const ddx = (d.x + (d.w || d.radius * 2) / 2) - x;
            const ddy = (d.y + (d.h || d.radius * 2) / 2) - y;
            if (ddx * ddx + ddy * ddy < radiusSq) d.takeDamage(999, this);
        }
    }

    onEnemyKilled(enemy) {
        const score = this.scoreManager.addKill(enemy.score, enemy.x, enemy.y);
        this.killFeed.add(`+${score} ${enemy.type}`);

        // Bot learning: teach bot from every kill
        if (this.bot.active) {
            const dist = distance(this.player.x, this.player.y, enemy.x, enemy.y);
            this.bot.onEnemyKilled(enemy, this.player.weapon, dist, this);
        }

        // Track max combo for achievements
        if (this.scoreManager.combo > (this.persistence.data.maxCombo || 0)) {
            this.persistence.data.maxCombo = this.scoreManager.combo;
        }

        // Combo visual feedback
        const combo = this.scoreManager.combo;
        if (combo >= 5 && combo % 5 === 0) {
            // Combo milestone - screen flash
            this.screenFlash.alpha = 0.15;
            this.screenFlash.color = '#FFD700';
            this.screenFlash.decay = 2.0;
            // Announce combo
            if (combo >= 20) {
                this.killFeed.add(`🔥 ${combo}x COMBO!`);
            } else if (combo >= 10) {
                this.killFeed.add(`⚡ ${combo}x COMBO!`);
            }
        }

        // Kill streak screen effects
        if (combo >= 3) {
            // Small screen shake on multi-kills
            this.camera.triggerShake(100, Math.min(combo * 0.5, 5));
        }

        // Phase 7: Kill streak tracking
        this.killStreakManager.onKill(this);

        // Phase 7: Weapon mastery
        this.weaponMasterySystem.onKill(this.player.currentWeaponIndex, this.player.weapon.name, false);

        // Coin reward (Phase 6)
        const coinReward = (CONFIG.currency.coinsPerKill[enemy.type] || 5);
        this.persistence.data.coins += coinReward;
        this.persistence.data.totalCoinsEarned += coinReward;
        this.scoreManager.floatingNumbers.push({
            x: enemy.x, y: enemy.y - 25, text: `+${coinReward}`,
            age: 0, maxAge: 1200, vy: -45, isCoin: true, color: '#FFD700'
        });

        // Track boss kills for achievements
        if (enemy.type === 'boss') {
            this.persistence.data.bossesKilled = (this.persistence.data.bossesKilled || 0) + 1;
        }

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
            // Big screen flash
            this.screenFlash.alpha = 0.4;
            this.screenFlash.color = '#FF4400';
            this.screenFlash.decay = 1.5;
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
        // Track no-death run if player completed mission
        if (this.player && this.player.alive && this.currentMission && this.waveManager && this.waveManager.wave >= this.currentMission.waves) {
            this.persistence.data.noDeathRuns = (this.persistence.data.noDeathRuns || 0) + 1;
        }
        this._weaponsUsedThisRun = null;
        this.endlessMode = false; this.endlessChunks = {};
        this.activeHazard = null;
        this.helicopter = null;
        this.missionObjective = null;
        this._objectiveComplete = false;
        this._missionCompleted = false;
        this._missionFrozen = false;
        this._defendZone = null;
        this.player = new Player(CONFIG.world.width / 2 + 200, CONFIG.world.height / 2 + 200);
        this.bullets = []; this.enemyBullets = [];
        this.enemies = []; this.effects = []; this.pickups = [];
        this.scorchMarks = [];
        this.pets = []; this.drones = []; this.teammates = [];
        this.firePools = [];
        this.flameStream = new FlameStream();
        this.killFeed = new KillFeed();
        this.waveManager = new WaveManager(); this.scoreManager = new ScoreManager();
        this.godMode = false; this.devCheats = false; this.runTime = 0;
        this._deathDelay = undefined;
        this._deathDelayDone = false;
        this.lighting = new LightingManager();
        this.events = new GameplayEvents();
        // Remove dynamically-added obstacles (crates, sandbags from wave regeneration)
        for (const obs of this._dynamicObstacles) {
            const obsIdx = this.obstacles.indexOf(obs);
            if (obsIdx !== -1) this.obstacles.splice(obsIdx, 1);
            const dIdx = this.destructibles.indexOf(obs);
            if (dIdx !== -1) this.destructibles.splice(dIdx, 1);
        }
        this._dynamicObstacles = [];
        this._solidCacheDirty = true;
        // Reset all remaining destructibles
        for (const d of this.destructibles) { if (d.destroyed) { d.destroyed = false; d.hp = d.maxHp; } }
        this._spawnInitialPickups();
        this.audioManager.stopMusic();
        this._spatialHash.clear();
    }

    _loop(currentTime) {
        if (!this.running) return;
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        this._fps = Math.round(1 / dt);
        this._update(dt);
        this._render();
        this.input.clearJustPressed();
        requestAnimationFrame((time) => this._loop(time));
    }

    _update(dt) {
        this.killStreakManager.update(dt);

        this.gameState.update(dt, this.input, this);

        // Dynamic quality scaling based on FPS
        this.graphicsQuality = this.qualityScaler.update(dt, this._fps);
        this.camera.shakeMultiplier = this.graphicsQuality === 'low' ? 0.3 : this.graphicsQuality === 'medium' ? 0.6 : 1;

        if (this.gameState.state !== 'playing') return;

        // Input lock: freeze all gameplay input when text fields are active
        if (this.gameState.nameInputActive || this.gameState.roomCodeInputActive) {
            this.input.clearJustPressed();
            return;
        }

        this.runTime += dt;

        // Cache solid obstacles (rebuilt only when destructibles change)
        if (!this._cachedSolidObstacles || this._solidCacheDirty) {
            this._cachedSolidObstacles = [...this.obstacles, ...this.destructibles.filter(d => d.isSolid())];
            // Rebuild spatial hash
            this._spatialHash.clear();
            for (const obs of this._cachedSolidObstacles) {
                if (obs.x !== undefined) this._spatialHash.insert(obs);
            }
            this._solidCacheDirty = false;
        }
        const allSolidObstacles = this._cachedSolidObstacles;

        // Bot mode: update bot AI and use virtual input
        const activeInput = this.bot.active ? (() => {
            this.bot.update(dt, this);
            this.bot.virtualInput._applyActions();
            return this.bot.virtualInput;
        })() : this.input;

        this.player.update(dt, activeInput, this.camera.getOffset(), this.canvas.width, this.canvas.height, allSolidObstacles, this.barbedWires);

        // Phase 7: Update new systems
        this.meleeSystem.update(dt, this.player, this);
        this.supplyDropManager.update(dt, this);
        this.trapSystem.update(dt, this);

        // Shooting
        const isFiring = this.bot.active ? activeInput.isMousePressed() : (this.input.mouse.leftDown || (this.input.isMobile && this.input.isTouchFiring()));
        // Track weapons used for achievements
        if (isFiring && !this._weaponsUsedThisRun) this._weaponsUsedThisRun = new Set();
        if (isFiring) this._weaponsUsedThisRun.add(this.player.currentWeaponIndex);
        // Flamethrower: continuous stream weapon
        if (isFiring && this.player.weapon.isFlame && !this.player.isDodging && this.player.alive) {
            const gunTipX = this.player.x + Math.cos(this.player.angle) * (CONFIG.player.gunLength + this.player.radius * 0.5);
            const gunTipY = this.player.y + Math.sin(this.player.angle) * (CONFIG.player.gunLength + this.player.radius * 0.5);
            this.flameStream.fire(dt, gunTipX, gunTipY, this.player.angle, this.enemies, this, this.graphicsQuality);
            // Continuous lighting
            this.lighting.addLight(gunTipX, gunTipY, 120, '#FF6600', 0.6, 100);
            // Fuel consumption (use ammo)
            this.player._flameAmmoTimer = (this.player._flameAmmoTimer || 0) + dt * 1000;
            if (this.player._flameAmmoTimer >= 100) { // Consume ammo every 100ms
                this.player._flameAmmoTimer = 0;
                this.player.currentMag--;
                if (this.player.currentMag <= 0) {
                    if (this.player.weapon.reserveAmmo > 0) {
                        this.player._startReload();
                    }
                }
            }
            // Fire pool creation (every few seconds of firing)
            this.player._flamePoolTimer = (this.player._flamePoolTimer || 0) + dt * 1000;
            if (this.player._flamePoolTimer >= 1500) { // Create fire pool every 1.5s
                this.player._flamePoolTimer = 0;
                const poolDist = 120 + Math.random() * 80;
                const poolX = gunTipX + Math.cos(this.player.angle) * poolDist;
                const poolY = gunTipY + Math.sin(this.player.angle) * poolDist;
                this.firePools.push(new FirePool(poolX, poolY, 40 + Math.random() * 20, 4000 + Math.random() * 2000));
            }
            // Sound loop handled by continuous 'flame' sound
        } else if (isFiring && !this.player.isDodging && this.player.alive) {
            const bullets = this.player.tryShoot();
            if (bullets) {
                this.bullets.push(...bullets);
                // Muzzle flash light
                const w = this.player.weapon;
                const gunTipX = this.player.x + Math.cos(this.player.angle) * (CONFIG.player.gunLength + this.player.radius * 0.5);
                const gunTipY = this.player.y + Math.sin(this.player.angle) * (CONFIG.player.gunLength + this.player.radius * 0.5);
                this.lighting.addLight(gunTipX, gunTipY, 80, '#FFD700', 0.5, 80);

                // Dual wield: second muzzle flash light from the other barrel
                if (w.dualWield) {
                    const dualOffX = gunTipX - Math.sin(this.player.angle) * 8;
                    const dualOffY = gunTipY + Math.cos(this.player.angle) * 8;
                    this.lighting.addLight(dualOffX, dualOffY, 80, '#FFD700', 0.5, 80);
                }

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
                let smokeCount = w.pellets ? 4 : (w.explosive ? 3 : 2);
                if (this.graphicsQuality === 'low') smokeCount = Math.max(1, Math.floor(smokeCount * 0.5));
                else if (this.graphicsQuality === 'medium') smokeCount = Math.max(1, Math.floor(smokeCount * 0.75));
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

                // Dual wield: second muzzle flash polygon from the other barrel
                if (w.dualWield) {
                    const dualFlashX = gunTipX - Math.sin(this.player.angle) * 8;
                    const dualFlashY = gunTipY + Math.cos(this.player.angle) * 8;
                    this.effects.push({
                        x: dualFlashX, y: dualFlashY, angle: this.player.angle,
                        life: 50, age: 0, size: 8 + w.recoil, active: true,
                        update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                        render(ctx, cam) {
                            const a = 1 - this.age / this.life;
                            const sx = this.x - cam.x, sy = this.y - cam.y;
                            ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);
                            ctx.globalAlpha = a;
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
                            ctx.fillStyle = '#FFF';
                            ctx.beginPath(); ctx.arc(0, 0, 3 * a, 0, Math.PI * 2); ctx.fill();
                            ctx.restore(); ctx.globalAlpha = 1;
                        }
                    });
                }
            }
        }

        // Update flame stream
        this.flameStream.update(dt, this.player.x, this.player.y, this.player.angle, this.enemies, this);

        // Update fire pools
        for (let i = this.firePools.length - 1; i >= 0; i--) {
            this.firePools[i].update(dt, this.enemies, this);
            if (!this.firePools[i].active) {
                this.firePools.splice(i, 1);
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

        this.camera.follow(this.player.x, this.player.y, this.screenWidth || this.canvas.width, this.screenHeight || this.canvas.height);
        this.camera.updateShake(dt);

        // Update player bullets
        const enemies = this.enemies;
        const bulletPool = this._bulletPool;
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i]; b.update(dt);
            let hit = false;
            for (let j = 0, oLen = allSolidObstacles.length; j < oLen; j++) {
                const obs = allSolidObstacles[j];
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
                const bx = b.x, by = b.y, br = b.radius;
                for (let j = 0, eLen = enemies.length; j < eLen; j++) {
                    const enemy = enemies[j];
                    if (!enemy.active || enemy.isDying) continue;
                    const rSum = enemy.radius + br;
                    const edx = bx - enemy.x, edy = by - enemy.y;
                    if (edx * edx + edy * edy < rSum * rSum) {
                        // Shield block check
                        if (enemy.type === 'shield' && enemy.isBulletBlocked && enemy.isBulletBlocked(bx, by)) {
                            b.active = false; hit = true;
                            this.effects.push(new ImpactEffect(bx, by));
                            const shieldSparkCount = this.graphicsQuality === 'low' ? 0 : 4;
                            for (let k = 0; k < shieldSparkCount; k++) {
                                const angle = Math.random() * Math.PI * 2;
                                this.effects.push(new Particle(bx, by, Math.cos(angle) * 80, Math.sin(angle) * 80, 200, 2, '#8888FF'));
                            }
                            break;
                        }
                        b.active = false; hit = true;
                        enemy.takeDamage(b.damage, this);
                        this.effects.push(new ImpactEffect(bx, by, false));
                        this.crosshair.onHit();
                        // Rocket explosion
                        if (b.explosive) {
                            const expMult = this.player.explosionMult || 1;
                            this.createExplosion(bx, by, b.explosionRadius || 120, Math.ceil((b.explosionDamage || 80) * expMult), null);
                            this.lighting.addLight(bx, by, 200, '#FF6600', 0.8, 400);
                        }
                        break;
                    }
                }
            }
            if (!b.active) { bulletPool.release(b); this.bullets.splice(i, 1); }
        }

        // Update enemy bullets - skip when mission is frozen
        if (!this._missionFrozen) {
            const eBulletPool = this._enemyBulletPool;
            const px = this.player.x, py = this.player.y, pr = this.player.radius;
            for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
                const b = this.enemyBullets[i]; b.update(dt);
                let hit = false;
                // Player collision (squared distance)
                if (this.player.alive) {
                    const dx = b.x - px, dy = b.y - py;
                    const rSum = pr + b.radius;
                    if (dx * dx + dy * dy < rSum * rSum) {
                        // Phase 7: Shield ability blocks enemy bullets
                        if (this.player.abilities.shield.active) {
                            const angleToBullet = Math.atan2(dy, dx);
                            let relativeAngle = angleToBullet - this.player.angle;
                            while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
                            while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
                            const blockAngle = CONFIG.abilities.shield.blockAngle;
                            const shieldRange = CONFIG.abilities.shield.width;
                            if (Math.abs(relativeAngle) <= blockAngle / 2 && distance(b.x, b.y, px, py) < shieldRange) {
                                b.active = false; hit = true;
                                this.effects.push(new ImpactEffect(b.x, b.y));
                                continue;
                            }
                        }
                        if (this.godMode) { b.active = false; hit = true; }
                        else { this.player.takeDamage(b.damage); b.active = false; hit = true; this.camera.triggerShake(100, 3); }
                    }
                }
                if (!hit) {
                    for (let j = 0, oLen = allSolidObstacles.length; j < oLen; j++) {
                        const obs = allSolidObstacles[j];
                        if (!obs.blocksBullets()) continue;
                        const bounds = obs.getBounds();
                        if (circleRectOverlap(b.x, b.y, b.radius, bounds.x, bounds.y, bounds.w, bounds.h)) {
                            b.active = false; hit = true; this.effects.push(new ImpactEffect(b.x, b.y)); break;
                        }
                    }
                }
                if (!b.active) { eBulletPool.release(b); this.enemyBullets.splice(i, 1); }
            }
        }

        // Apply daily challenge speed modifier to enemies
        if (this._challengeSpeedMult) {
            for (const enemy of this.enemies) {
                if (enemy.active && !enemy.isDying && enemy._origSpeed === undefined) {
                    enemy._origSpeed = enemy.speed;
                    enemy.speed *= this._challengeSpeedMult;
                }
            }
        }

        // Update enemies (skip AI for distant ones to save CPU)
        // When mission is frozen, enemies don't update (they're "defeated")
        if (!this._missionFrozen) {
            const playerPos = this.player;
            // Phase 7: Adrenaline slow effect
            const slowFactor = this.player.getSlowFactor();
            const enemyDt = dt * slowFactor;
            for (const enemy of this.enemies) {
                enemy._gameRef = this;
                const dx = enemy.x - playerPos.x, dy = enemy.y - playerPos.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > 2500000) { // ~1580 units = enemy too far for AI updates
                    enemy.updateBasic(enemyDt);
                } else {
                    enemy.update(enemyDt, this);
                }
            }
            this.enemies = this.enemies.filter(e => e.active);
        }

        // Update companions (Phase 6)
        for (const pet of this.pets) pet.update(dt, this);
        for (const drone of this.drones) drone.update(dt, this);
        for (const teammate of this.teammates) teammate.update(dt, this);

        // Endless mode updates
        if (this.endlessMode) this._updateEndless(dt);

        // Update active hazard
        if (this.activeHazard && this.player.alive) {
            this.activeHazard.update(dt, this.player.x, this.player.y, this);
            const hazardDmg = this.activeHazard.checkDamage(this.player);
            if (hazardDmg > 0 && !this.godMode) {
                this.player.takeDamage(hazardDmg);
            }
        }

        // Wave manager - skip when mission is frozen (no more waves)
        if (!this._missionFrozen) {
            this.waveManager.update(dt, this);
        }

        // Check mission objective completion and spawn helicopter
        // Objective completion means mission is done - helicopter comes immediately
        if (!this.endlessMode && this.missionObjective && !this._objectiveComplete) {
            this.missionObjective.update(this, dt);
            if (this.missionObjective.completed) {
                this._objectiveComplete = true;
                this._spawnHelicopter();
            }
        }

        // Update helicopter
        if (this.helicopter) {
            this.helicopter.update(dt, this);
        }
        // Phase 7: Helicopter streak (kill streak support)
        if (this._helicopterStreak) {
            this._helicopterStreak.update(dt);
            if (!this._helicopterStreak.active) {
                this._helicopterStreak = null;
            }
        }

        // Wave coin bonus (Phase 6) - check if wave just completed
        if (this.waveManager._justCompleted) {
            this.waveManager._justCompleted = false;
            const waveCoins = Math.floor(CONFIG.currency.coinsPerWave * Math.pow(CONFIG.currency.coinsPerWaveMultiplier, this.waveManager.wave));
            this.persistence.data.coins += waveCoins;
            this.persistence.data.totalCoinsEarned += waveCoins;
            this.persistence.save();
        }

        // Phase 7: Weapon shop trigger and close between waves
        if (!this.endlessMode && this.waveManager.state === 'between' && !this.waveManager.isBossWave) {
            if (this.input.justPressed(CONFIG.weaponCarry.shopKey) && !this.gameState.weaponShopOpen) {
                this.gameState.weaponShopOpen = true;
                this.soundManager.playSound('menuSelect');
            }
        }
        // Close weapon shop with Escape
        if (this.gameState.weaponShopOpen && this.input.justPressed('Escape')) {
            this.gameState.weaponShopOpen = false;
            this.soundManager.playSound('menuSelect');
        }
        // Freeze game while weapon shop is open
        if (this.gameState.weaponShopOpen) {
            this.input.clearJustPressed();
            return;
        }

        // Pickups
        for (const pickup of this.pickups) {
            pickup.update(dt);
            if (pickup.collect(this.player)) {
                // Track for objectives
                if (this.events) this.events.onPickupCollected();
                let labelText = '';
                if (pickup.type === 'health') {
                    if (this._challengeNoHeals) continue;
                    this.player.heal(pickup.amount); labelText = `+${Math.round(pickup.amount)} HP`;
                }
                else if (pickup.type === 'stamina') { this.player.restoreStamina(pickup.amount); labelText = `+${Math.round(pickup.amount)} STAM`; }
                else if (pickup.type === 'ammo') {
                    if (this._challengeNoAmmo) continue;
                    this.player.addAmmo(pickup.amount); labelText = `+AMMO`;
                }
                else if (pickup.type === 'perk') {
                    this.player.addPerk(pickup.perk);
                    labelText = `PERK: ${pickup.perk.name}`;
                    // Track max perks for achievements
                    if (this.player.perks.length > (this.persistence.data.maxPerksUsed || 0)) {
                        this.persistence.data.maxPerksUsed = this.player.perks.length;
                    }
                }
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

        // Phase 7: Weapon pickup from ground drops (weapon effects in this.effects array)
        if (this.input.justPressed(CONFIG.weaponCarry.pickupKey)) {
            for (let i = this.effects.length - 1; i >= 0; i--) {
                const eff = this.effects[i];
                if (eff.weaponName && eff.active && distance(this.player.x, this.player.y, eff.x, eff.y) < CONFIG.weaponCarry.pickupRange) {
                    const wpnCfg = CONFIG.weapons.find(w => w.name === eff.weaponName);
                    if (wpnCfg) {
                        const idx = this.player.weapons.findIndex(w => w.name === wpnCfg.name);
                        if (idx >= 0) {
                            this.player.pickupWeapon(idx, this);
                            this.soundManager.playSound('menuSelect');
                            eff.active = false;
                            this.scoreManager.floatingNumbers.push({
                                x: this.player.x, y: this.player.y - 30, text: `+${wpnCfg.name}`,
                                age: 0, maxAge: 1200, vy: -60, isPickup: true, color: wpnCfg.bulletColor || '#FFD700'
                            });
                        }
                    }
                    break;
                }
            }
        }

        // Effects (swap-and-pop removal)
        for (let i = this.effects.length - 1; i >= 0; i--) {
            if (this.effects[i].update) this.effects[i].update(dt);
            if (!this.effects[i].active) {
                const last = this.effects.pop();
                if (i < this.effects.length) this.effects[i] = last;
            }
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

        // Scorch marks: update debris age/rotation, remove expired (swap-and-pop)
        for (let i = this.scorchMarks.length - 1; i >= 0; i--) {
            const mark = this.scorchMarks[i];
            if (mark.isDebris) {
                mark.age += dt * 1000;
                mark.angle += mark.rotSpeed * dt;
                if (mark.age >= mark.life) {
                    const last = this.scorchMarks.pop();
                    if (i < this.scorchMarks.length) this.scorchMarks[i] = last;
                }
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
        this.antiCheat.update(dt, this.player, this.scoreManager, this);
        this.events.update(dt, this);

        if (!this.player.alive) {
            // Death animation delay — show flash for a moment before gameover screen
            if (!this._deathDelayDone) {
                if (this._deathDelay === undefined) {
                    this._deathDelay = 0.6; // seconds
                    // Death screen flash
                    this.screenFlash.alpha = 0.7;
                    this.screenFlash.color = '#FF0000';
                    this.screenFlash.decay = 1.0;
                    this.audioManager.stopMusic();
                    this.soundManager.playSound('gameOver');
                }
                this._deathDelay -= dt;
                if (this._deathDelay > 0) return; // Still showing flash
                this._deathDelayDone = true;
            }

            // Endless mode: use distance as score
            if (this.endlessMode) {
                this.scoreManager.score = Math.max(this.scoreManager.score, Math.floor(this.endlessDistance));
            }
            this.gameState.state = 'gameover';
            this.gameState.submitted = false;
            this.gameState.submitResult = null;
            this.gameState.nameInput = this.persistence.data.playerName;
            this.persistence.updateRunStats(this.scoreManager.score, this.waveManager.wave, this.scoreManager.kills);
            // Update weapons used count
            if (this._weaponsUsedThisRun) {
                this.persistence.data.weaponsUsed = Math.max(this.persistence.data.weaponsUsed || 0, this._weaponsUsedThisRun.size);
            }
            this.persistence.save(); // Persist coins earned
            // Check achievements
            const newAchievements = this.persistence.checkAchievements ? this.persistence.checkAchievements() : [];
            if (newAchievements.length > 0) {
                this.gameState.achievementUnlocks = newAchievements;
            }
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

        // 11b. Companions (Phase 6)
        for (const pet of this.pets) pet.render(ctx, cameraOffset, quality);
        for (const drone of this.drones) drone.render(ctx, cameraOffset, quality);
        for (const teammate of this.teammates) teammate.render(ctx, cameraOffset, quality);

        // 12. Effects
        for (const effect of this.effects) effect.render(ctx, cameraOffset, quality);

        // 12b. Fire pools (render before lighting for glow effect)
        for (const pool of this.firePools) pool.render(ctx, cameraOffset, quality);

        // 12c. Flame stream
        this.flameStream.render(ctx, cameraOffset, quality);

        // Phase 7: Supply drops
        this.supplyDropManager.render(ctx, cameraOffset, this);

        // Phase 7: Traps
        this.trapSystem.render(ctx, cameraOffset);

        // Phase 7: Helicopter streak
        if (this._helicopterStreak) this._helicopterStreak.render(ctx, cameraOffset);

        // 13. Lighting overlay
        this.lighting.render(ctx, cameraOffset, this.canvas.width, this.canvas.height);

        // 14. Ambient weather particles
        this.weather.render(ctx, cameraOffset, quality);

        // 14b. Active hazard effects
        if (this.activeHazard) this.activeHazard.render(ctx, cameraOffset, quality);

        // 14c. Gameplay events
        if (this.events) this.events.render(ctx, this);

        // 14c. Helicopter
        if (this.helicopter) this.helicopter.render(ctx, cameraOffset, quality);

        // 14d. Objective progress display
        if (this.missionObjective && this.gameState.state === 'playing' && !this.endlessMode) {
            const obj = this.missionObjective;
            const pulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.3;
            ctx.font = 'bold 12px "Courier New", monospace';
            ctx.textAlign = 'center';
            const objText = `${obj.description}: ${obj.getStatusText()}`;
            const barWidth = 250;
            const barX = (this.screenWidth || ctx.canvas.width) / 2 - barWidth / 2;
            const barY = 28;
            ctx.fillStyle = `rgba(0,0,0,${0.6 * pulse})`;
            ctx.fillRect(barX - 5, barY - 5, barWidth + 10, 24);
            ctx.strokeStyle = obj.completed ? `rgba(0,255,100,${pulse})` : `rgba(255,200,0,${pulse})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(barX - 5, barY - 5, barWidth + 10, 24);
            ctx.fillStyle = obj.completed ? '#00FF64' : '#FFD700';
            ctx.fillText(objText, (this.screenWidth || ctx.canvas.width) / 2, barY + 12);
        }

        // 14e. Defend/Rescue zone indicator
        if (this._defendZone) {
            const dz = this._defendZone;
            const sx = dz.x - cameraOffset.x;
            const sy = dz.y - cameraOffset.y;
            const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.3;
            // Zone circle
            ctx.strokeStyle = dz.inZone ? `rgba(0,255,100,${pulse})` : `rgba(255,200,0,${pulse * 0.6})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.arc(sx, sy, dz.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            // Fill
            ctx.fillStyle = dz.inZone ? `rgba(0,255,100,${0.1 * pulse})` : `rgba(255,200,0,${0.05 * pulse})`;
            ctx.fill();
            // Progress arc
            const progress = Math.min(1, dz.time / (dz.target * 1000));
            ctx.strokeStyle = `rgba(0,255,100,${pulse})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(sx, sy, dz.radius - 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
            ctx.stroke();
            // Label
            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.fillStyle = dz.inZone ? '#00FF64' : '#FFD700';
            ctx.textAlign = 'center';
            ctx.fillText(dz.inZone ? 'DEFENDING' : 'GET TO ZONE', sx, sy - dz.radius - 15);
        }

        // 15. Floating score/damage numbers
        this.scoreManager.render(ctx, cameraOffset);

        // 14. HUD
        if (this.gameState.state === 'playing' || this.gameState.state === 'paused') {
            this.hud.render(ctx, this.player, this.camera, this.bullets, this.enemyBullets, this.enemies, this.effects, this.scoreManager, this.waveManager, this.killFeed, this.persistence, this.audioManager, this);
        }

        // 15. Minimap
        if (this.persistence.data.settings.showMinimap && (this.gameState.state === 'playing' || this.gameState.state === 'paused')) {
            this.minimap.render(ctx, this.player, this.buildings, this.cars, this.barrels, this.trees, this.enemies, this.pickups, this.trucks, this.suvs, this.vans, this.screenWidth);
        }

        // 16. Endless mode distance display
        if (this.endlessMode && this.gameState.state === 'playing') {
            const sw = this.screenWidth || this.canvas.width;
            ctx.font = 'bold 18px "Courier New", monospace'; ctx.fillStyle = '#00FFCC'; ctx.textAlign = 'center';
            ctx.fillText(`Explored: ${Math.floor(this.endlessDistance)}m`, sw / 2, 70);
            ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#888';
            ctx.fillText(`Difficulty: ${this.endlessDifficulty.toFixed(1)}x | Enemies: ${this.enemies.length}`, sw / 2, 88);
        }

        // 17. Game state overlay
        this.gameState.render(ctx, this);

        // 17. Fog of war challenge overlay
        if (this._challengeFogRadius && this.gameState.state === 'playing') {
            const px = this.player.x - cameraOffset.x, py = this.player.y - cameraOffset.y;
            const fogR = this._challengeFogRadius;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.95)';
            ctx.beginPath();
            ctx.rect(0, 0, this.screenWidth || this.canvas.width, this.screenHeight || this.canvas.height);
            ctx.arc(px, py, fogR, 0, Math.PI * 2, true);
            ctx.fill();
            // Soft edge gradient
            const grad = ctx.createRadialGradient(px, py, fogR * 0.8, px, py, fogR);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.95)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px, py, fogR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 18. Crosshair (always visible during play)
        if (this.gameState.state === 'playing') {
            this.crosshair.render(ctx, this.input.mouse.x, this.input.mouse.y, this.player);
        }

        // 18c. Anti-cheat warnings
        if (this.gameState.state === 'playing') {
            this.antiCheat.render(ctx, this.screenWidth, this.screenHeight);
        }

        // 18b. Mobile touch controls (Phase 6)
        if (this.input.isMobile && this.gameState.state === 'playing') {
            this.input.moveJoystick.render(ctx);
            this.input.aimJoystick.render(ctx);
            this.input.touchButtons.render(ctx);
        }

        // 18. Screen flash overlay (skip during gameover — death flash covers the stats)
        if (this.screenFlash.alpha > 0 && this.gameState.state !== 'gameover') {
            ctx.globalAlpha = this.screenFlash.alpha;
            ctx.fillStyle = this.screenFlash.color;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.globalAlpha = 1;
        }

        // 19. Dev cheat overlay (hidden from normal players)

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
        this._solidCacheDirty = true;
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

    _spawnHelicopter() {
        if (this.helicopter || this.endlessMode) return;
        // Start the survive objective if applicable
        if (this.missionObjective instanceof SurviveObjective) {
            this.missionObjective.start();
        }
        // Get extraction point from mission or default to center
        let ex = CONFIG.world.width / 2;
        let ey = CONFIG.world.height / 2;
        if (this.currentMission && this.currentMission.extractionPoint) {
            ex = this.currentMission.extractionPoint.x;
            ey = this.currentMission.extractionPoint.y;
        }
        this.helicopter = new Helicopter(ex, ey);
        // Clear kill streak helicopter so it doesn't interfere with extraction
        this._helicopterStreak = null;
        this.waveManager.announcementText = 'MISSION COMPLETE! ENTER EXTRACTION ZONE!';
        this.waveManager.announcementTimer = 5000;
        if (this.soundManager) this.soundManager.playSound('waveComplete');
        // Freeze mission - no more enemy spawns, only player and helicopter move
        this._missionFrozen = true;
        // Clear all remaining enemies immediately
        this.enemies = [];
        this.enemyBullets = [];
    }

    _onMissionComplete() {
        if (this._missionCompleted) return;
        this._missionCompleted = true;
        // Calculate completion bonus
        const timeBonus = Math.max(0, Math.floor(100 - this.runTime * 0.5));
        const hpBonus = Math.floor(this.player.hp * 2);
        const totalBonus = timeBonus + hpBonus;
        this.persistence.data.coins += totalBonus;
        this.persistence.data.totalCoinsEarned += totalBonus;
        // Track mission completion
        if (this.currentMission) {
            if (!this.persistence.data.missionsCompleted) this.persistence.data.missionsCompleted = [];
            if (!this.persistence.data.missionsCompleted.includes(this.currentMission.id)) {
                this.persistence.data.missionsCompleted.push(this.currentMission.id);
            }
        }
        // Check achievements
        const newAchievements = this.persistence.checkAchievements ? this.persistence.checkAchievements() : [];
        if (newAchievements.length > 0) {
            this.gameState.achievementUnlocks = newAchievements;
        }
        this.persistence.save();
        // Show completion screen
        this.waveManager.announcementText = 'MISSION COMPLETE!';
        this.waveManager.announcementTimer = 4000;
        if (this.soundManager) this.soundManager.playSound('waveComplete');
        // Delay gameover transition to show helicopter departing
        setTimeout(() => {
            this.gameState.state = 'gameover';
            this.gameState.submitted = false;
            this.gameState.submitResult = null;
            this.gameState.nameInput = this.persistence.data.playerName;
            this.persistence.updateRunStats(this.scoreManager.score, this.waveManager.wave, this.scoreManager.kills);
            if (this._weaponsUsedThisRun) {
                this.persistence.data.weaponsUsed = Math.max(this.persistence.data.weaponsUsed || 0, this._weaponsUsedThisRun.size);
            }
            this.persistence.save();
            this.audioManager.stopMusic();
            this.soundManager.playSound('submitSuccess');
        }, 3000);
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
