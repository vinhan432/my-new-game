/**
 * Dodge Warfare - Phase 5
 * Configuration - All tunable values grouped for easy adjustment
 * Rebalanced for faster, punchier combat
 */

const CONFIG = {
    version: '0.5.0',

    world: { width: 3000, height: 3000 },

    tile: {
        size: 64,
        dirt: '#8B7355', dirtDark: '#7A6548', dirtLight: '#9A8365',
        grass: '#5A7247', grassDark: '#4A6237', grassLight: '#6A8257',
        road: '#4A4A4A', roadEdge: '#5A5A5A', roadDark: '#3A3A3A',
        sand: '#C2B280', sandDark: '#B2A270', sandLight: '#D2C290'
    },

    player: {
        maxHP: 100, baseSpeed: 320, sprintSpeed: 520,
        radius: 16, bodyColor: '#4A5D23', headColor: '#3D4F1C',
        gunColor: '#2C2C2C', gunLength: 28, gunWidth: 6,
        invulnTime: 250, shadowOffsetX: 4, shadowOffsetY: 4
    },

    stamina: { max: 100, drainRate: 30, regenDelay: 0.4, regenRate: 28 },

    dodge: { duration: 0.28, cooldown: 0.9, speedMultiplier: 3.0, trailAlpha: 0.4, trailCount: 4 },

    // Weapon definitions - Phase 5 ammo economy
    weapons: [
        {
            name: 'Pistol', magSize: 15, reserveAmmo: 150,
            fireRate: 180, damage: 20, bulletSpeed: 750,
            reloadTime: 1100, spread: 0.04, bulletRadius: 4,
            bulletColor: '#FFD700', muzzleFlash: 10, recoil: 2
        },
        {
            name: 'Rifle', magSize: 30, reserveAmmo: 180,
            fireRate: 90, damage: 14, bulletSpeed: 850,
            reloadTime: 1600, spread: 0.07, bulletRadius: 3,
            bulletColor: '#FFCC00', muzzleFlash: 8, recoil: 1.5
        },
        {
            name: 'Shotgun', magSize: 6, reserveAmmo: 48,
            fireRate: 550, damage: 10, bulletSpeed: 650,
            reloadTime: 1800, spread: 0.28, pellets: 7, bulletRadius: 3,
            bulletColor: '#FF8800', muzzleFlash: 18, recoil: 5
        },
        {
            name: 'Sniper', magSize: 5, reserveAmmo: 30,
            fireRate: 1000, damage: 70, bulletSpeed: 1400,
            reloadTime: 2200, spread: 0.008, bulletRadius: 5,
            bulletColor: '#00CCFF', muzzleFlash: 14, recoil: 8
        },
        {
            name: 'SMG', magSize: 40, reserveAmmo: 240,
            fireRate: 65, damage: 10, bulletSpeed: 700,
            reloadTime: 1400, spread: 0.1, bulletRadius: 3,
            bulletColor: '#FF6644', muzzleFlash: 6, recoil: 1
        },
        {
            name: 'Rocket', magSize: 1, reserveAmmo: 8,
            fireRate: 1500, damage: 120, bulletSpeed: 400,
            reloadTime: 2500, spread: 0.02, bulletRadius: 8,
            bulletColor: '#FF4400', muzzleFlash: 25, recoil: 12,
            explosive: true, explosionRadius: 120, explosionDamage: 80
        }
    ],

    // Legacy shooting config (used for defaults, weapon-specific values are in weapons[])
    shooting: {
        bulletLifetime: 3000, muzzleFlashRadius: 12, impactRadius: 6
    },

    camera: { lerpFactor: 0.1, shakeDuration: 250, shakeIntensity: 7, maxShakeStack: 3 },

    hud: {
        barWidth: 220, barHeight: 18, barPadding: 4,
        hpColor: '#E74C3C', hpBgColor: '#2C2C2C', hpLowColor: '#FF0000',
        staminaColor: '#F39C12', staminaBgColor: '#2C2C2C',
        ammoColor: '#FFD700', ammoLowColor: '#FF4444', reloadColor: '#00CCFF',
        textColor: '#FFFFFF', labelFont: '12px "Courier New", monospace', margin: 20
    },

    minimap: {
        size: 200, margin: 20, bgColor: 'rgba(0,0,0,0.75)', borderColor: '#555', borderWidth: 2,
        playerColor: '#00FF00', buildingColor: '#888', carColor: '#555',
        barrelColor: '#CC6600', treeColor: '#2D5A1E', roadColor: '#666',
        enemyColor: '#FF0000', bossColor: '#FF00FF',
        pickupHealthColor: '#00FF00', pickupStaminaColor: '#0088FF', pickupAmmoColor: '#FFAA00',
        pickupWeaponColor: '#FF44FF', playerDotSize: 4, enemyDotSize: 2
    },

    barbedWire: { slowFactor: 0.5, damagePerSecond: 5 },

    // Vehicle type definitions
    vehicleTypes: {
        car: { hp: 10, explosionRadius: 110, explosionDamage: 35, colors: ['#2C2C2C', '#1A2A3A', '#3A1A1A', '#1A3A2A', '#2A2A1A'] },
        truck: { hp: 15, explosionRadius: 140, explosionDamage: 45, colors: ['#3A3A2A', '#2A2A3A', '#4A3A2A', '#2A3A2A'] },
        suv: { hp: 12, explosionRadius: 120, explosionDamage: 40, colors: ['#2A3A2A', '#3A2A2A', '#2A2A3A', '#3A3A2A', '#1A2A3A'] },
        van: { hp: 10, explosionRadius: 100, explosionDamage: 30, colors: ['#E8E8E8', '#C0C0C0', '#8B7355', '#4A5A4A', '#3A4A5A'] }
    },

    debug: { font: '12px "Courier New", monospace', color: '#00FF00', bgColor: 'rgba(0,0,0,0.75)', padding: 8 },

    // Enemies - Phase 5 rebalance (lower HP, faster kills)
    enemy: {
        grunt: {
            hp: 22, speed: 155, fireRate: 1400, bulletSpeed: 420,
            damage: 8, radius: 14, color: '#8B0000', score: 100,
            detectionRange: 420, attackRange: 320,
            bodyColor: '#6B3A2A', gunColor: '#333'
        },
        rusher: {
            hp: 16, speed: 360, damage: 12, radius: 12, color: '#D2691E',
            score: 150, detectionRange: 520, meleeRange: 32, attackCooldown: 900,
            bodyColor: '#A0522D'
        },
        heavy: {
            hp: 75, speed: 85, fireRate: 2200, burstCooldown: 2200,
            burstShotInterval: 120, burstCount: 3, bulletSpeed: 370,
            damage: 7, radius: 20, color: '#2C2C2C', score: 300,
            detectionRange: 470, attackRange: 370,
            bodyColor: '#1A1A1A', gunColor: '#444'
        },
        sniper: {
            hp: 20, speed: 105, fireRate: 2800, bulletSpeed: 950,
            damage: 30, radius: 13, color: '#2E4A2E', score: 250,
            detectionRange: 720, attackRange: 620,
            bodyColor: '#3A5A3A', gunColor: '#222',
            laserWarningTime: 450, retreatDistance: 420
        },
        flanker: {
            hp: 18, speed: 280, fireRate: 800, bulletSpeed: 400,
            damage: 10, radius: 12, color: '#4A0E4A', score: 200,
            detectionRange: 500, attackRange: 280,
            bodyColor: '#6A2E6A', gunColor: '#555'
        },
        medic: {
            hp: 25, speed: 140, fireRate: 1200, bulletSpeed: 400,
            damage: 8, radius: 14, color: '#8B0000', score: 200,
            detectionRange: 450, attackRange: 300,
            bodyColor: '#6B3A3A', gunColor: '#444',
            healRange: 200, healAmount: 15, healCooldown: 3000
        },
        shield: {
            hp: 60, speed: 90, fireRate: 1500, bulletSpeed: 350,
            damage: 10, radius: 18, color: '#2A2A4A', score: 250,
            detectionRange: 400, attackRange: 250,
            bodyColor: '#1A1A3A', gunColor: '#555'
        },
        drone: {
            hp: 12, speed: 250, fireRate: 600, bulletSpeed: 500,
            damage: 6, radius: 10, color: '#4A4A4A', score: 150,
            detectionRange: 550, attackRange: 350,
            bodyColor: '#3A3A3A'
        },
        turret: {
            hp: 80, speed: 0, fireRate: 400, bulletSpeed: 600,
            damage: 15, radius: 20, color: '#3A3A3A', score: 300,
            detectionRange: 500, attackRange: 450,
            bodyColor: '#2A2A2A', rotationSpeed: 0.03
        }
    },

    enemyBullet: { radius: 3, color: '#FF4444', lifetime: 2500, glowColor: 'rgba(255,68,68,0.3)' },

    // Pickups
    pickup: {
        health: { radius: 12, color: '#00FF00', amount: 30, lifetime: 20000, dropChance: 0.12 },
        stamina: { radius: 12, color: '#0088FF', amount: 50, lifetime: 20000, dropChance: 0.08 },
        ammo: { radius: 11, color: '#FFAA00', amount: 0.3, lifetime: 20000, dropChance: 0.18 }  // 30% of reserve
    },

    // Waves - Phase 5 tuning
    wave: {
        initialDelay: 4000,
        betweenWaves: 6000,
        baseEnemyCount: 4,
        countIncrease: 2,
        maxEnemies: 35,
        spawnRadius: 550,
        spawnMargin: 120,
        staggerDelay: 350
    },

    // Score
    score: { waveBonusMultiplier: 500, pickupScore: 25, comboWindow: 3000, comboMultiplier: 0.2 },

    // Separation
    separation: { radius: 28, strength: 45 },

    // Graphics quality presets
    graphics: {
        low: { particles: 0.3, shadows: false, glow: false, decals: 0.3, trails: false },
        medium: { particles: 0.6, shadows: true, glow: false, decals: 0.6, trails: true },
        high: { particles: 1.0, shadows: true, glow: true, decals: 1.0, trails: true }
    },

    // Leaderboard
    leaderboard: { url: 'http://localhost:3000', maxNameLength: 20 },

    // Multiplayer
    multiplayer: { url: 'http://localhost:3000', maxPlayers: 4, interpDelay: 100 },

    // Perks system
    perks: {
        maxPerks: 3,
        list: [
            { id: 'quickReload', name: 'Quick Reload', desc: '30% faster reload', icon: 'QR', effect: (p) => { p.weapons.forEach(w => w.reloadTime = Math.ceil(w.reloadTime * 0.7)); } },
            { id: 'extendedMag', name: 'Extended Mags', desc: '+50% magazine size', icon: 'EM', effect: (p) => { p.weapons.forEach(w => { w.magSize = Math.ceil(w.magSize * 1.5); }); } },
            { id: 'combatMedic', name: 'Combat Medic', desc: 'Heal 2 HP per kill', icon: 'CM', effect: (p) => { p.healPerKill = 2; } },
            { id: 'speedDemon', name: 'Speed Demon', desc: '+20% movement speed', icon: 'SD', effect: (p) => { p.speedBonus += 0.2; } },
            { id: 'sharpshooter', name: 'Sharpshooter', desc: '-30% weapon spread', icon: 'SS', effect: (p) => { p.weapons.forEach(w => w.spread *= 0.7); } },
            { id: 'scavenger', name: 'Scavenger', desc: 'Double ammo pickups', icon: 'SC', effect: (p) => { p.ammoMultiplier = 2; } },
            { id: 'lastStand', name: 'Last Stand', desc: 'Survive lethal hit once', icon: 'LS', effect: (p) => { p.lastStand = true; } },
            { id: 'demolition', name: 'Demolition Expert', desc: '+50% explosion damage', icon: 'DE', effect: (p) => { p.explosionMult = 1.5; } },
        ]
    },

    // Biomes
    biomes: {
        urban: { name: 'Urban', tileTypes: ['road', 'dirt'], buildingChance: 0.3, carChance: 0.15, barrelChance: 0.1, treeChance: 0.05, color: '#6A6A6A' },
        forest: { name: 'Forest', tileTypes: ['grass', 'dirt'], buildingChance: 0.05, carChance: 0.02, barrelChance: 0.05, treeChance: 0.4, color: '#2D5A1E' },
        desert: { name: 'Desert', tileTypes: ['sand', 'dirt'], buildingChance: 0.1, carChance: 0.08, barrelChance: 0.15, treeChance: 0.02, color: '#C2B280' },
        industrial: { name: 'Industrial', tileTypes: ['road', 'dirt'], buildingChance: 0.25, carChance: 0.2, barrelChance: 0.3, treeChance: 0.02, color: '#4A4A4A' }
    },


    // Themes - tile visuals per biome
    themes: {
        urban: {
            base: { type: 'dirt', colors: ['#8B7355', '#7A6548', '#6A5538'] },
            patch1: { type: 'concrete', colors: ['#7A7A7A', '#6A6A6A', '#5A5A5A'] },
            patch2: { type: 'grass', colors: ['#5A7247', '#4A6237', '#3A5227'] },
            road: { colors: ['#4A4A4A', '#3A3A3A', '#2A2A2A'], lineColor: 'rgba(255,255,200,0.35)' }
        },
        forest: {
            base: { type: 'grass', colors: ['#5A7247', '#4A6237', '#3A5227'] },
            patch1: { type: 'dirt', colors: ['#8B7355', '#7A6548', '#6A5538'] },
            patch2: { type: 'grassDark', colors: ['#3A5A2A', '#2A4A1A', '#1A3A0A'] },
            road: { colors: ['#5A5040', '#4A4030', '#3A3020'], lineColor: 'rgba(200,200,150,0.2)' }
        },
        desert: {
            base: { type: 'sand', colors: ['#C2B280', '#B2A270', '#A29260'] },
            patch1: { type: 'dirt', colors: ['#A08060', '#907050', '#806040'] },
            patch2: { type: 'rust', colors: ['#8B6040', '#7B5030', '#6B4020'] },
            road: { colors: ['#8A7A5A', '#7A6A4A', '#6A5A3A'], lineColor: 'rgba(255,255,200,0.2)' }
        },
        industrial: {
            base: { type: 'concrete', colors: ['#6A6A6A', '#5A5A5A', '#4A4A4A'] },
            patch1: { type: 'rust', colors: ['#7A5A3A', '#6A4A2A', '#5A3A1A'] },
            patch2: { type: 'dirt', colors: ['#5A5040', '#4A4030', '#3A3020'] },
            road: { colors: ['#3A3A3A', '#2A2A2A', '#1A1A1A'], lineColor: 'rgba(255,200,100,0.3)' }
        }
    },

    // Missions
    missions: [
        {
            id: 'urban_siege',
            name: 'Urban Siege',
            description: 'Clear the hostile forces from the city outskirts. Expect close-quarters combat.',
            difficulty: 'Normal',
            worldSize: 3000,
            theme: 'urban',
            waves: 8,
            enemyTypes: ['grunt', 'rusher'],
            bossWave: 8,
            playerSpawn: { x: 1500, y: 1500 },
            terrain: {
                roads: [
                    { orientation: 'vertical', centerFrac: 0.5, width: 2 },
                    { orientation: 'horizontal', centerFrac: 0.5, width: 2 }
                ],
                patches: [
                    { type: 'grass', count: 8, minR: 2, maxR: 4 },
                    { type: 'concrete', count: 5, minR: 2, maxR: 5 }
                ]
            },
            buildings: [
                { x: 300, y: 300, w: 160, h: 120, doors: [{ x: 0, y: 50, w: 12, h: 24 }] },
                { x: 700, y: 200, w: 200, h: 140, doors: [{ x: 90, y: 0, w: 24, h: 12 }] },
                { x: 2200, y: 400, w: 180, h: 130, doors: [{ x: 168, y: 50, w: 12, h: 24 }] },
                { x: 500, y: 2200, w: 170, h: 120, doors: [{ x: 70, y: 108, w: 24, h: 12 }] },
                { x: 2000, y: 2100, w: 200, h: 150, doors: [{ x: 0, y: 60, w: 12, h: 24 }] },
                { x: 1300, y: 600, w: 140, h: 100, doors: [{ x: 60, y: 0, w: 24, h: 12 }] },
                { x: 1800, y: 1800, w: 160, h: 120, doors: [{ x: 80, y: 108, w: 24, h: 12 }] }
            ],
            brickWalls: [
                { x: 1000, y: 800, w: 80, h: 16 },
                { x: 1900, y: 1200, w: 16, h: 80 }
            ],
            cars: [
                { x: 600, y: 1400, w: 70, h: 36, angle: 0 },
                { x: 1800, y: 700, w: 70, h: 36, angle: Math.PI / 4 },
                { x: 1200, y: 2000, w: 70, h: 36, angle: -Math.PI / 6 }
            ],
            trucks: [
                { x: 1500, y: 800, w: 90, h: 40, angle: Math.PI / 2 },
                { x: 2400, y: 1800, w: 90, h: 40, angle: 0 }
            ],
            suvs: [
                { x: 900, y: 1800, w: 75, h: 38, angle: Math.PI / 3 },
                { x: 2000, y: 1200, w: 75, h: 38, angle: -Math.PI / 4 }
            ],
            vans: [
                { x: 1100, y: 500, w: 80, h: 38, angle: 0 },
                { x: 2600, y: 2200, w: 80, h: 38, angle: Math.PI / 6 }
            ],
            barrels: [
                { x: 900, y: 900 }, { x: 2100, y: 600 },
                { x: 400, y: 1800 }, { x: 2500, y: 2400 }
            ],
            trees: { edgeCount: 25, edgeMargin: 250, innerCount: 10, minR: 16, maxR: 24 },
            barbedWire: [
                { x: 1100, y: 1100, w: 60, h: 40 },
                { x: 1700, y: 1600, w: 50, h: 50 }
            ],
            pickups: [
                { x: 1500, y: 1400, type: 'health' },
                { x: 800, y: 500, type: 'ammo' },
                { x: 2200, y: 1500, type: 'stamina' },
                { x: 1000, y: 2500, type: 'ammo' }
            ]
        },
        {
            id: 'forest_hunt',
            name: 'Forest Hunt',
            description: 'Track enemy patrols through dense woodland. Snipers lurk in the shadows.',
            difficulty: 'Hard',
            worldSize: 3500,
            theme: 'forest',
            waves: 10,
            enemyTypes: ['grunt', 'sniper', 'rusher'],
            bossWave: 10,
            playerSpawn: { x: 1750, y: 1750 },
            terrain: {
                roads: [
                    { orientation: 'diagonal', from: { x: 0.2, y: 0.2 }, to: { x: 0.8, y: 0.8 }, width: 1 }
                ],
                patches: [
                    { type: 'dirt', count: 12, minR: 2, maxR: 5 },
                    { type: 'grassDark', count: 15, minR: 2, maxR: 6 }
                ]
            },
            buildings: [
                { x: 500, y: 500, w: 140, h: 100, doors: [{ x: 0, y: 40, w: 12, h: 20 }] },
                { x: 2500, y: 800, w: 160, h: 120, doors: [{ x: 70, y: 0, w: 24, h: 12 }] },
                { x: 1600, y: 2600, w: 180, h: 130, doors: [{ x: 80, y: 118, w: 24, h: 12 }] }
            ],
            brickWalls: [
                { x: 1200, y: 1000, w: 100, h: 16 },
                { x: 2000, y: 2000, w: 16, h: 100 }
            ],
            cars: [
                { x: 1000, y: 1500, w: 70, h: 36, angle: Math.PI / 3 },
                { x: 2200, y: 2400, w: 70, h: 36, angle: 0 }
            ],
            trucks: [
                { x: 1600, y: 800, w: 90, h: 40, angle: Math.PI / 4 }
            ],
            suvs: [
                { x: 500, y: 2000, w: 75, h: 38, angle: 0 },
                { x: 2800, y: 1200, w: 75, h: 38, angle: -Math.PI / 3 }
            ],
            vans: [
                { x: 1200, y: 2600, w: 80, h: 38, angle: Math.PI / 2 }
            ],
            barrels: [
                { x: 700, y: 1200 }, { x: 2800, y: 600 },
                { x: 1400, y: 2800 }
            ],
            trees: { edgeCount: 50, edgeMargin: 350, innerCount: 40, minR: 18, maxR: 28 },
            barbedWire: [
                { x: 1300, y: 1300, w: 80, h: 40 },
                { x: 2100, y: 1800, w: 60, h: 60 }
            ],
            pickups: [
                { x: 1750, y: 1650, type: 'health' },
                { x: 900, y: 900, type: 'ammo' },
                { x: 2600, y: 1400, type: 'stamina' },
                { x: 500, y: 3000, type: 'ammo' },
                { x: 3000, y: 2000, type: 'health' }
            ]
        },
        {
            id: 'desert_storm',
            name: 'Desert Storm',
            description: 'Open desert warfare. Heavy enemies and explosive barrels. Watch your spacing.',
            difficulty: 'Hard',
            worldSize: 3200,
            theme: 'desert',
            waves: 12,
            enemyTypes: ['grunt', 'heavy', 'rusher', 'flanker'],
            bossWave: 12,
            playerSpawn: { x: 1600, y: 1600 },
            terrain: {
                roads: [
                    { orientation: 'horizontal', centerFrac: 0.35, width: 2 },
                    { orientation: 'vertical', centerFrac: 0.65, width: 2 }
                ],
                patches: [
                    { type: 'dirt', count: 10, minR: 3, maxR: 6 },
                    { type: 'rust', count: 6, minR: 1, maxR: 3 }
                ]
            },
            buildings: [
                { x: 400, y: 800, w: 180, h: 140, doors: [{ x: 0, y: 60, w: 12, h: 24 }] },
                { x: 2200, y: 500, w: 200, h: 160, doors: [{ x: 90, y: 0, w: 24, h: 12 }] },
                { x: 800, y: 2400, w: 160, h: 120, doors: [{ x: 70, y: 108, w: 24, h: 12 }] },
                { x: 2400, y: 2200, w: 170, h: 130, doors: [{ x: 0, y: 55, w: 12, h: 24 }] }
            ],
            brickWalls: [
                { x: 1400, y: 1000, w: 120, h: 16 },
                { x: 1000, y: 2000, w: 16, h: 100 }
            ],
            cars: [
                { x: 1200, y: 600, w: 70, h: 36, angle: 0 },
                { x: 2000, y: 1800, w: 70, h: 36, angle: Math.PI / 2 }
            ],
            trucks: [
                { x: 800, y: 1400, w: 90, h: 40, angle: Math.PI / 6 },
                { x: 2600, y: 1000, w: 90, h: 40, angle: -Math.PI / 4 }
            ],
            suvs: [
                { x: 1600, y: 2400, w: 75, h: 38, angle: 0 }
            ],
            vans: [
                { x: 400, y: 2000, w: 80, h: 38, angle: Math.PI / 3 }
            ],
            barrels: [
                { x: 600, y: 600 }, { x: 1800, y: 400 }, { x: 1000, y: 1800 },
                { x: 2600, y: 1200 }, { x: 1400, y: 2600 }, { x: 2200, y: 2800 }
            ],
            trees: { edgeCount: 10, edgeMargin: 200, innerCount: 3, minR: 14, maxR: 20 },
            barbedWire: [
                { x: 900, y: 1200, w: 80, h: 50 },
                { x: 2000, y: 1000, w: 60, h: 60 },
                { x: 1500, y: 2200, w: 70, h: 40 }
            ],
            pickups: [
                { x: 1600, y: 1500, type: 'health' },
                { x: 700, y: 1000, type: 'ammo' },
                { x: 2500, y: 800, type: 'stamina' },
                { x: 1200, y: 2600, type: 'ammo' },
                { x: 2800, y: 2000, type: 'health' }
            ]
        },
        {
            id: 'industrial_zone',
            name: 'Industrial Zone',
            description: 'Tight corridors and explosive hazards. Flankers patrol the factory floor.',
            difficulty: 'Extreme',
            worldSize: 2800,
            theme: 'industrial',
            waves: 15,
            enemyTypes: ['grunt', 'heavy', 'flanker', 'sniper', 'rusher'],
            bossWave: 15,
            playerSpawn: { x: 1400, y: 1400 },
            terrain: {
                roads: [
                    { orientation: 'vertical', centerFrac: 0.3, width: 2 },
                    { orientation: 'vertical', centerFrac: 0.7, width: 2 },
                    { orientation: 'horizontal', centerFrac: 0.5, width: 1 }
                ],
                patches: [
                    { type: 'rust', count: 10, minR: 2, maxR: 5 },
                    { type: 'dirt', count: 6, minR: 1, maxR: 3 }
                ]
            },
            buildings: [
                { x: 200, y: 200, w: 200, h: 160, doors: [{ x: 90, y: 0, w: 24, h: 12 }, { x: 0, y: 70, w: 12, h: 24 }] },
                { x: 2000, y: 300, w: 180, h: 140, doors: [{ x: 80, y: 128, w: 24, h: 12 }] },
                { x: 400, y: 2000, w: 200, h: 150, doors: [{ x: 188, y: 65, w: 12, h: 24 }] },
                { x: 2000, y: 2000, w: 180, h: 140, doors: [{ x: 80, y: 0, w: 24, h: 12 }] },
                { x: 1200, y: 800, w: 150, h: 110, doors: [{ x: 0, y: 45, w: 12, h: 24 }] },
                { x: 1000, y: 1800, w: 160, h: 120, doors: [{ x: 70, y: 108, w: 24, h: 12 }] }
            ],
            brickWalls: [
                { x: 800, y: 600, w: 100, h: 16 },
                { x: 1600, y: 1200, w: 16, h: 100 },
                { x: 1000, y: 1400, w: 80, h: 16 },
                { x: 1800, y: 800, w: 16, h: 80 }
            ],
            cars: [
                { x: 700, y: 1200, w: 70, h: 36, angle: 0 },
                { x: 1800, y: 1600, w: 70, h: 36, angle: Math.PI / 2 },
                { x: 1200, y: 2200, w: 70, h: 36, angle: -Math.PI / 4 }
            ],
            trucks: [
                { x: 1400, y: 600, w: 90, h: 40, angle: 0 }
            ],
            suvs: [
                { x: 500, y: 1800, w: 75, h: 38, angle: Math.PI / 4 },
                { x: 2400, y: 1400, w: 75, h: 38, angle: -Math.PI / 6 }
            ],
            vans: [
                { x: 1000, y: 1000, w: 80, h: 38, angle: Math.PI / 2 }
            ],
            barrels: [
                { x: 500, y: 500 }, { x: 1600, y: 400 }, { x: 800, y: 1600 },
                { x: 2200, y: 1000 }, { x: 1200, y: 2400 }, { x: 2400, y: 2200 },
                { x: 1400, y: 1000 }
            ],
            trees: { edgeCount: 8, edgeMargin: 180, innerCount: 2, minR: 14, maxR: 20 },
            barbedWire: [
                { x: 600, y: 1000, w: 60, h: 50 },
                { x: 1800, y: 800, w: 70, h: 40 },
                { x: 1000, y: 2200, w: 50, h: 60 },
                { x: 2200, y: 1600, w: 60, h: 50 }
            ],
            pickups: [
                { x: 1400, y: 1300, type: 'health' },
                { x: 400, y: 800, type: 'ammo' },
                { x: 2400, y: 600, type: 'stamina' },
                { x: 800, y: 2200, type: 'ammo' },
                { x: 2200, y: 2400, type: 'health' },
                { x: 1600, y: 600, type: 'ammo' }
            ]
        }
    ]
};
