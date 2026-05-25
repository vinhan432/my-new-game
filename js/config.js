/**
 * Dodge Warfare - Phase 6
 * Configuration - All tunable values grouped for easy adjustment
 * Rebalanced for faster, punchier combat
 */

const CONFIG = {
    version: '0.6.0',

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

    // Weapon definitions - Phase 7 (2-weapon carry limit, 2 new weapons)
    weapons: [
        {
            name: 'Pistol', magSize: 15, reserveAmmo: 150,
            fireRate: 180, damage: 20, bulletSpeed: 750,
            reloadTime: 1100, spread: 0.04, bulletRadius: 4,
            bulletColor: '#FFD700', muzzleFlash: 10, recoil: 2,
            tier: 0, cost: 0 // Starting weapon
        },
        {
            name: 'Rifle', magSize: 30, reserveAmmo: 180,
            fireRate: 90, damage: 14, bulletSpeed: 850,
            reloadTime: 1600, spread: 0.07, bulletRadius: 3,
            bulletColor: '#FFCC00', muzzleFlash: 8, recoil: 1.5,
            tier: 1, cost: 150
        },
        {
            name: 'Shotgun', magSize: 6, reserveAmmo: 48,
            fireRate: 550, damage: 10, bulletSpeed: 650,
            reloadTime: 1800, spread: 0.28, pellets: 7, bulletRadius: 3,
            bulletColor: '#FF8800', muzzleFlash: 18, recoil: 5,
            tier: 1, cost: 180
        },
        {
            name: 'Sniper', magSize: 5, reserveAmmo: 30,
            fireRate: 1000, damage: 70, bulletSpeed: 1400,
            reloadTime: 2200, spread: 0.008, bulletRadius: 5,
            bulletColor: '#00CCFF', muzzleFlash: 14, recoil: 8,
            tier: 2, cost: 250
        },
        {
            name: 'SMG', magSize: 40, reserveAmmo: 240,
            fireRate: 65, damage: 10, bulletSpeed: 700,
            reloadTime: 1400, spread: 0.1, bulletRadius: 3,
            bulletColor: '#FF6644', muzzleFlash: 6, recoil: 1,
            tier: 1, cost: 120
        },
        {
            name: 'Rocket', magSize: 1, reserveAmmo: 8,
            fireRate: 1500, damage: 120, bulletSpeed: 400,
            reloadTime: 2500, spread: 0.02, bulletRadius: 8,
            bulletColor: '#FF4400', muzzleFlash: 25, recoil: 12,
            explosive: true, explosionRadius: 120, explosionDamage: 80,
            tier: 3, cost: 400
        },
        {
            name: 'Dual Pistol', magSize: 24, reserveAmmo: 200,
            fireRate: 120, damage: 16, bulletSpeed: 720,
            reloadTime: 1300, spread: 0.06, bulletRadius: 3,
            bulletColor: '#FFAA44', muzzleFlash: 8, recoil: 1.5,
            dualWield: true, tier: 2, cost: 200
        },
        {
            name: 'Flamethrower', magSize: 100, reserveAmmo: 500,
            fireRate: 50, damage: 8, bulletSpeed: 0,
            reloadTime: 3000, spread: 0.18, bulletRadius: 0,
            bulletColor: '#FF4400', muzzleFlash: 12, recoil: 0.2,
            isFlame: true, streamRange: 200,
            tier: 2, cost: 300
        },
        {
            name: 'LMG', magSize: 60, reserveAmmo: 300,
            fireRate: 70, damage: 12, bulletSpeed: 780,
            reloadTime: 2500, spread: 0.12, bulletRadius: 3,
            bulletColor: '#FF8800', muzzleFlash: 10, recoil: 1.2,
            tier: 2, cost: 280
        },
        {
            name: 'Crossbow', magSize: 1, reserveAmmo: 20,
            fireRate: 1500, damage: 90, bulletSpeed: 1200,
            reloadTime: 1500, spread: 0.005, bulletRadius: 4,
            bulletColor: '#88CCFF', muzzleFlash: 6, recoil: 4,
            silent: true, piercing: true, pierceCount: 3,
            tier: 3, cost: 350
        }
    ],

    // Weapon carry system
    weaponCarry: {
        maxWeapons: 2, // Player can only carry 2 weapons
        dropKey: 'KeyG', // Hold to drop current weapon
        swapKey: 'KeyT', // Quick swap between carried weapons
        shopKey: 'KeyP', // Open weapon shop between waves
    },

    // Active abilities - Phase 7
    abilities: {
        grenade: {
            key: 'KeyQ', cooldown: 12000, throwSpeed: 500, throwRange: 400,
            radius: 120, damage: 80, fuseTime: 1500, bounces: 2,
            icon: 'G', name: 'Grenade'
        },
        shield: {
            key: 'KeyE', cooldown: 15000, duration: 2000,
            width: 120, blockAngle: Math.PI * 0.6, // Frontal 108 degrees
            icon: 'S', name: 'Tactical Shield'
        },
        adrenaline: {
            key: 'KeyF', cooldown: 20000, duration: 3000,
            slowFactor: 0.5, // Enemies move at 50% speed
            icon: 'A', name: 'Adrenaline Rush'
        }
    },

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

    // Enemies - Phase 7 rebalance (more enemies, smarter, variants)
    enemy: {
        grunt: {
            hp: 22, speed: 155, fireRate: 1400, bulletSpeed: 420,
            damage: 8, radius: 14, color: '#8B0000', score: 100,
            detectionRange: 420, attackRange: 320,
            bodyColor: '#6B3A2A', gunColor: '#333',
            variants: [
                { name: 'Standard', bodyColor: '#6B3A2A', helmetColor: '#4A5D23', hp: 22, speed: 155, damage: 8, skill: null },
                { name: 'Veteran', bodyColor: '#4A5A3A', helmetColor: '#3A4A2A', hp: 30, speed: 170, damage: 10, skill: 'burstFire' },
                { name: 'Scout', bodyColor: '#8B7355', helmetColor: '#6B5335', hp: 16, speed: 200, damage: 7, skill: 'smokeGrenade' },
                { name: 'Heavy', bodyColor: '#3A2A1A', helmetColor: '#2A1A0A', hp: 35, speed: 120, damage: 11, skill: 'armorPlating' },
                { name: 'Pyro', bodyColor: '#6B3A1A', helmetColor: '#8B4A2A', hp: 20, speed: 145, damage: 9, skill: 'explosiveDeath' }
            ]
        },
        rusher: {
            hp: 16, speed: 360, damage: 12, radius: 12, color: '#D2691E',
            score: 150, detectionRange: 520, meleeRange: 32, attackCooldown: 900,
            bodyColor: '#A0522D',
            variants: [
                { name: 'Standard', bodyColor: '#A0522D', hp: 16, speed: 360, damage: 12, skill: null },
                { name: 'Berserker', bodyColor: '#C03030', hp: 20, speed: 400, damage: 16, skill: 'dashAttack' },
                { name: 'Shadow', bodyColor: '#3A2A3A', hp: 12, speed: 420, damage: 10, skill: 'stealthRush' },
                { name: 'Brute', bodyColor: '#6A4A2A', hp: 25, speed: 300, damage: 18, skill: 'knockback' }
            ]
        },
        heavy: {
            hp: 75, speed: 85, fireRate: 2200, burstCooldown: 2200,
            burstShotInterval: 120, burstCount: 3, bulletSpeed: 370,
            damage: 7, radius: 20, color: '#2C2C2C', score: 300,
            detectionRange: 470, attackRange: 370,
            bodyColor: '#1A1A1A', gunColor: '#444',
            variants: [
                { name: 'Standard', bodyColor: '#1A1A1A', hp: 75, speed: 85, damage: 7, skill: null },
                { name: 'Juggernaut', bodyColor: '#2A1A0A', hp: 100, speed: 70, damage: 9, skill: 'armorPlating' },
                { name: 'Gunner', bodyColor: '#1A2A1A', hp: 60, speed: 95, damage: 8, skill: 'burstFire' },
                { name: 'Flame Heavy', bodyColor: '#3A1A0A', hp: 70, speed: 80, damage: 10, skill: 'explosiveDeath' }
            ]
        },
        sniper: {
            hp: 20, speed: 105, fireRate: 2800, bulletSpeed: 950,
            damage: 30, radius: 13, color: '#2E4A2E', score: 250,
            detectionRange: 720, attackRange: 620,
            bodyColor: '#3A5A3A', gunColor: '#222',
            laserWarningTime: 450, retreatDistance: 420,
            variants: [
                { name: 'Standard', bodyColor: '#3A5A3A', hp: 20, speed: 105, damage: 30, skill: null },
                { name: 'Marksman', bodyColor: '#4A6A4A', hp: 25, speed: 100, damage: 40, skill: 'piercingShot' },
                { name: 'Ghost', bodyColor: '#2A3A2A', hp: 15, speed: 130, damage: 25, skill: 'stealthShot' },
                { name: 'Anti-Material', bodyColor: '#3A3A2A', hp: 28, speed: 90, damage: 50, skill: 'explosiveShot' }
            ]
        },
        flanker: {
            hp: 18, speed: 280, fireRate: 800, bulletSpeed: 400,
            damage: 10, radius: 12, color: '#4A0E4A', score: 200,
            detectionRange: 500, attackRange: 280,
            bodyColor: '#6A2E6A', gunColor: '#555',
            variants: [
                { name: 'Standard', bodyColor: '#6A2E6A', hp: 18, speed: 280, damage: 10, skill: null },
                { name: 'Infiltrator', bodyColor: '#4A2A6A', hp: 15, speed: 320, damage: 12, skill: 'stealthRush' },
                { name: 'Hitman', bodyColor: '#5A3A5A', hp: 22, speed: 260, damage: 14, skill: 'piercingShot' },
                { name: 'Saboteur', bodyColor: '#3A2A4A', hp: 20, speed: 290, damage: 11, skill: 'smokeGrenade' }
            ]
        },
        medic: {
            hp: 25, speed: 140, fireRate: 1200, bulletSpeed: 400,
            damage: 8, radius: 14, color: '#8B0000', score: 200,
            detectionRange: 450, attackRange: 300,
            bodyColor: '#6B3A3A', gunColor: '#444',
            healRange: 200, healAmount: 15, healCooldown: 3000,
            variants: [
                { name: 'Standard', bodyColor: '#6B3A3A', hp: 25, speed: 140, damage: 8, skill: null },
                { name: 'Combat Medic', bodyColor: '#5A3A4A', hp: 30, speed: 160, damage: 10, skill: 'combatHeal' },
                { name: 'Plague Doctor', bodyColor: '#3A3A2A', hp: 20, speed: 130, damage: 12, skill: 'poisonCloud' },
                { name: 'Lifeline', bodyColor: '#4A5A3A', hp: 35, speed: 120, damage: 6, skill: 'healingAura' }
            ]
        },
        shield: {
            hp: 60, speed: 90, fireRate: 1500, bulletSpeed: 350,
            damage: 10, radius: 18, color: '#2A2A4A', score: 250,
            detectionRange: 400, attackRange: 250,
            bodyColor: '#1A1A3A', gunColor: '#555',
            variants: [
                { name: 'Standard', bodyColor: '#1A1A3A', hp: 60, speed: 90, damage: 10, skill: null },
                { name: 'Phalanx', bodyColor: '#2A2A5A', hp: 80, speed: 75, damage: 8, skill: 'reflectiveShield' },
                { name: 'Shock Trooper', bodyColor: '#3A2A2A', hp: 50, speed: 110, damage: 14, skill: 'dashAttack' },
                { name: 'Bastion', bodyColor: '#1A2A3A', hp: 100, speed: 60, damage: 6, skill: 'armorPlating' }
            ]
        },
        drone: {
            hp: 12, speed: 250, fireRate: 600, bulletSpeed: 500,
            damage: 6, radius: 10, color: '#4A4A4A', score: 150,
            detectionRange: 550, attackRange: 350,
            bodyColor: '#3A3A3A',
            variants: [
                { name: 'Standard', bodyColor: '#3A3A3A', hp: 12, speed: 250, damage: 6, skill: null },
                { name: 'Kamikaze', bodyColor: '#5A2A2A', hp: 8, speed: 350, damage: 15, skill: 'explosiveDeath' },
                { name: 'EMP', bodyColor: '#2A3A5A', hp: 15, speed: 200, damage: 4, skill: 'empBlast' },
                { name: 'Swarm', bodyColor: '#4A4A3A', hp: 8, speed: 320, damage: 5, skill: 'callReinforcements' }
            ]
        },
        turret: {
            hp: 80, speed: 0, fireRate: 400, bulletSpeed: 600,
            damage: 15, radius: 20, color: '#3A3A3A', score: 300,
            detectionRange: 500, attackRange: 450,
            bodyColor: '#2A2A2A', rotationSpeed: 0.03,
            variants: [
                { name: 'Standard', bodyColor: '#2A2A2A', hp: 80, damage: 15, skill: null },
                { name: 'Minigun', bodyColor: '#3A3A2A', hp: 70, damage: 10, fireRate: 200, skill: 'burstFire' },
                { name: 'Rocket', bodyColor: '#2A2A3A', hp: 90, damage: 25, fireRate: 1500, skill: 'explosiveShot' },
                { name: 'Tesla', bodyColor: '#2A3A3A', hp: 60, damage: 20, fireRate: 800, skill: 'chainLightning' }
            ]
        },
        bomber: {
            hp: 30, speed: 130, fireRate: 3500, bulletSpeed: 0,
            damage: 0, radius: 15, color: '#8B4513', score: 200,
            detectionRange: 400, attackRange: 250,
            bodyColor: '#6B3410', gunColor: '#444',
            mineRadius: 40, mineDamage: 50, mineLifetime: 15000,
            variants: [
                { name: 'Standard', bodyColor: '#6B3410', hp: 30, damage: 50, skill: null },
                { name: 'Cluster', bodyColor: '#8B5A2A', hp: 25, damage: 35, skill: 'clusterMine' },
                { name: 'Napalm', bodyColor: '#6B2A0A', hp: 35, damage: 40, skill: 'fireMine' },
                { name: 'Demo', bodyColor: '#5B3A2A', hp: 40, damage: 70, skill: 'armorPlating' }
            ]
        },
        ninja: {
            hp: 18, speed: 300, damage: 18, radius: 11, color: '#1A1A2E',
            score: 250, detectionRange: 350, meleeRange: 28, attackCooldown: 600,
            bodyColor: '#0D0D1A', stealthAlpha: 0.15, stealthRevealRange: 120,
            variants: [
                { name: 'Standard', bodyColor: '#0D0D1A', hp: 18, speed: 300, damage: 18, skill: null },
                { name: 'Phantom', bodyColor: '#1A0D2A', hp: 15, speed: 350, damage: 22, skill: 'stealthRush' },
                { name: 'Blademaster', bodyColor: '#1A1A0D', hp: 25, speed: 280, damage: 25, skill: 'dashAttack' },
                { name: 'Shadow', bodyColor: '#0A0A1A', hp: 12, speed: 380, damage: 15, skill: 'callReinforcements' }
            ]
        },
        // === NEW ENEMIES (Phase 7) ===
        grenadier: {
            hp: 28, speed: 120, fireRate: 3000, bulletSpeed: 300,
            damage: 12, radius: 15, color: '#6B4A1A', score: 220,
            detectionRange: 450, attackRange: 350,
            bodyColor: '#5A3A1A', gunColor: '#444',
            grenadeBounces: 2, grenadeFuseTime: 2000, grenadeRadius: 80, grenadeDamage: 40,
            variants: [
                { name: 'Standard', bodyColor: '#5A3A1A', hp: 28, speed: 120, damage: 12, skill: null },
                { name: 'Incendiary', bodyColor: '#6A2A0A', hp: 25, speed: 110, damage: 15, skill: 'fireMine' },
                { name: 'Cluster', bodyColor: '#4A4A2A', hp: 30, speed: 130, damage: 10, skill: 'clusterMine' },
                { name: 'Sapper', bodyColor: '#3A3A1A', hp: 35, speed: 100, damage: 14, skill: 'armorPlating' }
            ]
        },
        psyker: {
            hp: 18, speed: 100, fireRate: 2500, bulletSpeed: 200,
            damage: 15, radius: 13, color: '#4A0E6A', score: 280,
            detectionRange: 500, attackRange: 400,
            bodyColor: '#3A0A5A', gunColor: '#8844CC',
            teleportCooldown: 4000, teleportRange: 200, homingStrength: 0.03,
            variants: [
                { name: 'Standard', bodyColor: '#3A0A5A', hp: 18, speed: 100, damage: 15, skill: null },
                { name: 'Voidwalker', bodyColor: '#2A0A4A', hp: 15, speed: 120, damage: 18, skill: 'stealthRush' },
                { name: 'Archon', bodyColor: '#5A1A7A', hp: 25, speed: 90, damage: 20, skill: 'chainLightning' },
                { name: 'Illusionist', bodyColor: '#4A1A6A', hp: 20, speed: 110, damage: 12, skill: 'callReinforcements' }
            ]
        },
        swarm: {
            hp: 6, speed: 420, damage: 5, radius: 7, color: '#8B0000',
            score: 50, detectionRange: 400, meleeRange: 20, attackCooldown: 500,
            bodyColor: '#6B0000',
            variants: [
                { name: 'Standard', bodyColor: '#6B0000', hp: 6, speed: 420, damage: 5, skill: null },
                { name: 'Exploder', bodyColor: '#8B2020', hp: 4, speed: 480, damage: 8, skill: 'explosiveDeath' },
                { name: 'Brood', bodyColor: '#4B0000', hp: 8, speed: 380, damage: 4, skill: 'callReinforcements' },
                { name: 'Toxic', bodyColor: '#2A4B00', hp: 5, speed: 400, damage: 7, skill: 'poisonCloud' }
            ]
        },
        charger: {
            hp: 55, speed: 100, damage: 35, radius: 22, color: '#6B3A0A',
            score: 350, detectionRange: 500, meleeRange: 35, attackCooldown: 4000,
            bodyColor: '#5A2A0A', gunColor: '#666',
            chargeSpeed: 600, chargeWindup: 1500, chargeDistance: 300,
            variants: [
                { name: 'Standard', bodyColor: '#5A2A0A', hp: 55, speed: 100, damage: 35, skill: null },
                { name: 'Juggernaut', bodyColor: '#7A4A1A', hp: 80, speed: 80, damage: 45, skill: 'armorPlating' },
                { name: 'Berserker', bodyColor: '#8B2A0A', hp: 45, speed: 120, damage: 40, skill: 'dashAttack' },
                { name: 'Stampede', bodyColor: '#4A3A1A', hp: 65, speed: 110, damage: 30, skill: 'knockback' }
            ]
        },
        assassin: {
            hp: 22, speed: 340, damage: 20, radius: 11, color: '#1A1A3A',
            score: 300, detectionRange: 400, meleeRange: 30, attackCooldown: 500,
            bodyColor: '#0D0D2A', stealthAlpha: 0.1, stealthRevealRange: 100,
            shurikenDamage: 12, shurikenRange: 300, dashCount: 3, dashCooldown: 2000,
            variants: [
                { name: 'Standard', bodyColor: '#0D0D2A', hp: 22, speed: 340, damage: 20, skill: null },
                { name: 'Phantom', bodyColor: '#1A0D3A', hp: 18, speed: 380, damage: 25, skill: 'stealthRush' },
                { name: 'Executioner', bodyColor: '#2A0D1A', hp: 30, speed: 300, damage: 30, skill: 'piercingShot' },
                { name: 'Shadow', bodyColor: '#0A0A2A', hp: 15, speed: 400, damage: 18, skill: 'callReinforcements' }
            ]
        },
        summoner: {
            hp: 30, speed: 80, fireRate: 2000, bulletSpeed: 300,
            damage: 10, radius: 16, color: '#4A0E4A', score: 320,
            detectionRange: 500, attackRange: 350,
            bodyColor: '#3A0A3A', gunColor: '#AA44CC',
            summonCooldown: 10000, summonCount: 2, summonTypes: ['grunt', 'grunt', 'rusher'],
            variants: [
                { name: 'Standard', bodyColor: '#3A0A3A', hp: 30, speed: 80, damage: 10, skill: null },
                { name: 'Necromancer', bodyColor: '#2A0A2A', hp: 35, speed: 70, damage: 8, skill: 'healingAura' },
                { name: 'Overlord', bodyColor: '#5A1A5A', hp: 40, speed: 90, damage: 12, skill: 'callReinforcements' },
                { name: 'Witch', bodyColor: '#3A1A4A', hp: 25, speed: 100, damage: 14, skill: 'poisonCloud' }
            ]
        }
    },

    // Variant skills - special abilities for enemy variants
    variantSkills: {
        burstFire: { name: 'Burst Fire', desc: 'Fires 3-round bursts', burstCount: 3, burstInterval: 120 },
        smokeGrenade: { name: 'Smoke Grenade', desc: 'Drops smoke on death', smokeRadius: 120, smokeDuration: 3000 },
        armorPlating: { name: 'Armor Plating', desc: 'Takes 30% less damage from front', damageReduction: 0.3 },
        explosiveDeath: { name: 'Explosive Death', desc: 'Explodes on death', explosionRadius: 80, explosionDamage: 25 },
        dashAttack: { name: 'Dash Attack', desc: 'Can dash forward quickly', dashSpeed: 500, dashDistance: 120, dashCooldown: 3000 },
        reflectiveShield: { name: 'Reflective Shield', desc: '20% chance to reflect bullets', reflectChance: 0.2 },
        callReinforcements: { name: 'Reinforcements', desc: 'Spawns 1 extra enemy on alert', reinforceCount: 1 },
        combatHeal: { name: 'Combat Heal', desc: 'Heals while fighting', healPerSecond: 3 },
        poisonCloud: { name: 'Poison Cloud', desc: 'Leaves poison trail', poisonDamage: 3, poisonDuration: 2000 },
        healingAura: { name: 'Healing Aura', desc: 'Heals all nearby allies', auraRange: 250, auraHeal: 5 },
        piercingShot: { name: 'Piercing Shot', desc: 'Bullets pierce through targets', pierceCount: 2 },
        stealthShot: { name: 'Stealth Shot', desc: 'Invisible between shots', stealthDuration: 1500 },
        explosiveShot: { name: 'Explosive Shot', desc: 'Bullets explode on impact', explosionRadius: 50, explosionDamage: 15 },
        chainLightning: { name: 'Chain Lightning', desc: 'Attack chains to nearby targets', chainCount: 2, chainRange: 100 },
        empBlast: { name: 'EMP Blast', desc: 'Disables player abilities briefly', disableDuration: 2000 },
        clusterMine: { name: 'Cluster Mine', desc: 'Mines split into 3 smaller ones', clusterCount: 3 },
        fireMine: { name: 'Fire Mine', desc: 'Mines leave fire pools', firePoolRadius: 50, firePoolDuration: 3000 },
        stealthRush: { name: 'Stealth Rush', desc: 'Invisible while moving fast', stealthSpeedThreshold: 200 },
        knockback: { name: 'Knockback', desc: 'Attacks push player back', knockbackForce: 150 }
    },

    enemyBullet: { radius: 3, color: '#FF4444', lifetime: 2500, glowColor: 'rgba(255,68,68,0.3)' },

    // Pickups
    pickup: {
        health: { radius: 12, color: '#00FF00', amount: 30, lifetime: 20000, dropChance: 0.12 },
        stamina: { radius: 12, color: '#0088FF', amount: 50, lifetime: 20000, dropChance: 0.08 },
        ammo: { radius: 11, color: '#FFAA00', amount: 0.3, lifetime: 20000, dropChance: 0.18 }  // 30% of reserve
    },

    // Waves - Phase 7 tuning (more enemies, multi-direction)
    wave: {
        initialDelay: 4000,
        betweenWaves: 6000,
        baseEnemyCount: 6,
        countIncrease: 3,
        maxEnemies: 50,
        spawnRadius: 550,
        spawnMargin: 120,
        staggerDelay: 250,
        multiDirWave: 5, // Enemies spawn from 2 directions after wave 5
        multiDirAllWave: 10, // All directions after wave 10
        miniBossInterval: 3, // Mini-boss wave every 3 non-boss waves
        miniBossCount: 2 // Number of elite enemies on mini-boss waves
    },

    // Score
    score: { waveBonusMultiplier: 500, pickupScore: 25, comboWindow: 3000, comboMultiplier: 0.2 },

    // Currency system - Phase 7
    currency: {
        coinsPerKill: { grunt: 5, rusher: 8, heavy: 15, sniper: 12, flanker: 10, medic: 10, shield: 12, drone: 8, turret: 15, bomber: 12, ninja: 15, boss: 50, grenadier: 14, psyker: 18, swarm: 3, charger: 20, assassin: 18, summoner: 22 },
        coinsPerWave: 25,
        coinsPerWaveMultiplier: 1.1
    },

    // Separation
    separation: { radius: 28, strength: 45 },

    // Graphics quality presets
    // Graphics quality presets - optimized for low-end
    graphics: {
        low: { particles: 0.2, shadows: false, glow: false, decals: 0.2, trails: false, terrainDetail: false, weather: 0.3, explosions: 0.3 },
        medium: { particles: 0.45, shadows: true, glow: false, decals: 0.45, trails: false, terrainDetail: false, weather: 0.5, explosions: 0.6 },
        high: { particles: 1.0, shadows: true, glow: true, decals: 1.0, trails: true, terrainDetail: true, weather: 1.0, explosions: 1.0 }
    },

    // Leaderboard
    leaderboard: { url: 'http://localhost:3000', maxNameLength: 20 },

    // Multiplayer
    multiplayer: { url: 'http://localhost:3000', maxPlayers: 4, interpDelay: 100 },

    // Perks system - Phase 7 (ability perks added)
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
            { id: 'vampire', name: 'Vampire', desc: 'Heal 3 HP per kill, -10 max HP', icon: 'VA', effect: (p) => { p.healPerKill += 3; p.maxHP -= 10; if (p.hp > p.maxHP) p.hp = p.maxHP; } },
            { id: 'glassCannon', name: 'Glass Cannon', desc: '+60% damage, -30% HP', icon: 'GC', effect: (p) => { p.weapons.forEach(w => w.damage = Math.ceil(w.damage * 1.6)); p.maxHP = Math.ceil(p.maxHP * 0.7); if (p.hp > p.maxHP) p.hp = p.maxHP; } },
            { id: 'phaseWalk', name: 'Phase Walk', desc: '-50% dodge cooldown', icon: 'PW', effect: (p) => { p.dodgeCooldownBonus = (p.dodgeCooldownBonus || 0) + 0.5; } },
            { id: 'magician', name: 'Magician', desc: 'Auto-reload on weapon switch', icon: 'MG', effect: (p) => { p.autoReloadOnSwitch = true; } },
            // Phase 7 ability perks
            { id: 'explosiveExpert', name: 'Explosive Expert', desc: 'Grenades +50% dmg, +30% radius', icon: 'EE', effect: (p) => { p.grenadeDamageBonus = 1.5; p.grenadeRadiusBonus = 1.3; } },
            { id: 'quickReflexes', name: 'Quick Reflexes', desc: 'Shield cooldown -40%', icon: 'QR', effect: (p) => { p.shieldCooldownBonus = 0.6; } },
            { id: 'adrenalineJunkie', name: 'Adrenaline Junkie', desc: 'Adrenaline +1s, kills heal 3 HP', icon: 'AJ', effect: (p) => { p.adrenalineDurationBonus = 1000; p.adrenalineHealPerKill = 3; } },
            { id: 'ammoScrounger', name: 'Ammo Scrounger', desc: 'Killed enemies drop ammo 30% more', icon: 'AS', effect: (p) => { p.ammoDropBonus = 0.3; } },
        ]
    },

    // Shop system - Phase 6
    shop: {
        upgrades: [
            { id: 'hp_1', name: 'Reinforced Armor', desc: '+20 Max HP', stat: 'maxHP', value: 20, cost: 100, maxLevel: 5, requires: null, icon: 'HP' },
            { id: 'stamina_1', name: 'Endurance', desc: '+20 Max Stamina', stat: 'maxStamina', value: 20, cost: 80, maxLevel: 5, requires: null, icon: 'ST' },
            { id: 'speed_1', name: 'Lightweight Gear', desc: '+5% Speed', stat: 'speedBonus', value: 0.05, cost: 150, maxLevel: 3, requires: null, icon: 'SP' },
            { id: 'heal_1', name: 'Field Medic', desc: '+1 HP per kill', stat: 'healPerKill', value: 1, cost: 200, maxLevel: 3, requires: null, icon: 'MD' },
            { id: 'ammo_1', name: 'Ammo Scrounger', desc: '+25% ammo pickup', stat: 'ammoMultiplier', value: 0.25, cost: 120, maxLevel: 3, requires: null, icon: 'AM' },
            { id: 'explosion_1', name: 'Blast Radius', desc: '+15% explosion dmg', stat: 'explosionMult', value: 0.15, cost: 180, maxLevel: 3, requires: null, icon: 'EX' },
            { id: 'pistol_dmg', name: 'Hollow Points', desc: '+3 Pistol damage', weapon: 'pistol', stat: 'damage', value: 3, cost: 100, maxLevel: 5, requires: null, icon: 'PD' },
            { id: 'rifle_dmg', name: 'AP Rounds', desc: '+2 Rifle damage', weapon: 'rifle', stat: 'damage', value: 2, cost: 120, maxLevel: 5, requires: null, icon: 'RD' },
            { id: 'shotgun_dmg', name: 'Buckshot', desc: '+2 Shotgun damage', weapon: 'shotgun', stat: 'damage', value: 2, cost: 110, maxLevel: 5, requires: null, icon: 'SD' },
            { id: 'sniper_dmg', name: 'Armor Piercing', desc: '+5 Sniper damage', weapon: 'sniper', stat: 'damage', value: 5, cost: 150, maxLevel: 5, requires: null, icon: 'ND' },
            { id: 'smg_dmg', name: 'Hot Rounds', desc: '+2 SMG damage', weapon: 'smg', stat: 'damage', value: 2, cost: 90, maxLevel: 5, requires: null, icon: 'MD' },
            { id: 'rocket_dmg', name: 'Warhead Upgrade', desc: '+10 Rocket damage', weapon: 'rocket', stat: 'damage', value: 10, cost: 200, maxLevel: 3, requires: null, icon: 'RK' },
        ],
        pets: [
            { id: 'pet_heal', name: 'Medic Pup', desc: 'Heals 2 HP every 5s', type: 'heal', cost: 500, color: '#00FF88', icon: '+' },
            { id: 'pet_shield', name: 'Guardian Turtle', desc: 'Blocks 1 bullet every 8s', type: 'shield', cost: 750, color: '#4488FF', icon: 'S' },
            { id: 'pet_loot', name: 'Scavenger Fox', desc: 'Pulls pickups toward you', type: 'loot', cost: 600, color: '#FFAA00', icon: 'L' },
            { id: 'pet_damage', name: 'Attack Hawk', desc: 'Pecks enemies for 5 dmg/s', type: 'damage', cost: 900, color: '#FF4444', icon: 'A' },
        ],
        drones: [
            { id: 'drone_attack', name: 'Attack Drone', desc: 'Shoots nearest enemy', type: 'attack', cost: 800, color: '#FF6600', icon: 'A', bulletDamage: 8, fireRate: 800, bulletSpeed: 500, range: 300 },
            { id: 'drone_shield', name: 'Shield Drone', desc: 'Absorbs enemy bullets', type: 'shield', cost: 1000, color: '#4488FF', icon: 'S', shieldRadius: 60, shieldHP: 50 },
            { id: 'drone_repair', name: 'Repair Drone', desc: 'Heals 1 HP every 3s', type: 'repair', cost: 700, color: '#00FF88', icon: 'R', healAmount: 1, healInterval: 3000 },
            { id: 'drone_scout', name: 'Scout Drone', desc: 'Marks enemies, extends view', type: 'scout', cost: 900, color: '#FFCC00', icon: 'O', range: 200 },
        ],
        teammates: [
            {
                id: 'teammate_rifle', name: 'Rifleman', desc: 'Reliable fighter with rifle', cost: 1500, color: '#4488FF', icon: 'R',
                weapons: [{ name: 'Rifle', damage: 12, fireRate: 120, bulletSpeed: 800, spread: 0.06, bulletRadius: 3, bulletColor: '#00CCFF' }],
                skills: [
                    { id: 'suppression', name: 'Suppression', desc: 'Slows enemies on hit', effect: 'slowOnHit' },
                    { id: 'armorPiercing', name: 'Armor Piercing', desc: 'Ignores shield enemies', effect: 'ignoreShield' }
                ]
            },
            {
                id: 'teammate_sniper', name: 'Sniper', desc: 'Long-range support', cost: 2000, color: '#8844FF', icon: 'S',
                weapons: [{ name: 'Sniper', damage: 40, fireRate: 800, bulletSpeed: 1200, spread: 0.01, bulletRadius: 4, bulletColor: '#00CCFF' }],
                skills: [
                    { id: 'markTarget', name: 'Mark Target', desc: 'Teammates deal +20% to marked enemy', effect: 'markTarget' },
                    { id: 'camouflage', name: 'Camouflage', desc: 'Enemies target sniper less', effect: 'camouflage' }
                ]
            },
            {
                id: 'teammate_med', name: 'Medic', desc: 'Heals player, revives allies', cost: 1800, color: '#00FF88', icon: '+',
                weapons: [{ name: 'SMG', damage: 8, fireRate: 80, bulletSpeed: 700, spread: 0.1, bulletRadius: 3, bulletColor: '#FF6644' }],
                skills: [
                    { id: 'combatMedic', name: 'Combat Medic', desc: 'Revives faster', effect: 'fastRevive' },
                    { id: 'fieldSupplies', name: 'Field Supplies', desc: 'Drops ammo pickups', effect: 'dropAmmo' }
                ]
            },
        ],
        // Weapon shop - appears between waves
        weaponShop: {
            offerCount: 3, // Number of weapons offered per shop visit
            rerollCost: 50, // Cost to reroll shop offers
            upgradeCostMultiplier: 1.5, // Each upgrade level costs more
            upgrades: [
                { id: 'weapon_damage', name: 'Damage+', desc: '+15% damage', stat: 'damage', value: 0.15, cost: 100, maxLevel: 5 },
                { id: 'weapon_mag', name: 'Magazine+', desc: '+20% mag size', stat: 'magSize', value: 0.2, cost: 80, maxLevel: 5 },
                { id: 'weapon_reload', name: 'Reload+', desc: '-15% reload time', stat: 'reloadTime', value: -0.15, cost: 120, maxLevel: 3 },
                { id: 'weapon_spread', name: 'Accuracy+', desc: '-20% spread', stat: 'spread', value: -0.2, cost: 90, maxLevel: 3 }
            ]
        }
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
        },
        storm: {
            base: { type: 'concrete', colors: ['#4A4A5A', '#3A3A4A', '#2A2A3A'] },
            patch1: { type: 'grass', colors: ['#3A5A3A', '#2A4A2A', '#1A3A1A'] },
            patch2: { type: 'dirt', colors: ['#5A5040', '#4A4030', '#3A3020'] },
            road: { colors: ['#3A3A4A', '#2A2A3A', '#1A1A2A'], lineColor: 'rgba(200,200,255,0.2)' }
        },
        snow: {
            base: { type: 'snow', colors: ['#E8E8F0', '#D8D8E0', '#C8C8D0'] },
            patch1: { type: 'ice', colors: ['#B0C4DE', '#A0B4CE', '#90A4BE'] },
            patch2: { type: 'dirt', colors: ['#8B7355', '#7A6548', '#6A5538'] },
            road: { colors: ['#C0C0C8', '#B0B0B8', '#A0A0A8'], lineColor: 'rgba(100,100,150,0.2)' }
        },
        volcano: {
            base: { type: 'lava_rock', colors: ['#2A1A0A', '#3A2A1A', '#1A0A00'] },
            patch1: { type: 'ash', colors: ['#4A4A4A', '#3A3A3A', '#2A2A2A'] },
            patch2: { type: 'lava_glow', colors: ['#8B2500', '#6B1500', '#4B0500'] },
            road: { colors: ['#3A2A1A', '#2A1A0A', '#1A0A00'], lineColor: 'rgba(255,100,0,0.3)' }
        },
        training: {
            base: { type: 'grass', colors: ['#5A8247', '#4A7237', '#3A6227'] },
            patch1: { type: 'concrete', colors: ['#8A8A8A', '#7A7A7A', '#6A6A6A'] },
            patch2: { type: 'grass', colors: ['#6A9257', '#5A8247', '#4A7237'] },
            road: { colors: ['#5A5A5A', '#4A4A4A', '#3A3A3A'], lineColor: 'rgba(255,255,200,0.3)' }
        }
    },

    // Missions
    missions: [
        {
            id: 'urban_siege',
            name: 'Urban Siege',
            description: 'Clear the hostile forces from the city outskirts. Hold the center plaza.',
            difficulty: 'Normal',
            unlockOrder: 1,
            objective: { type: 'defend', x: 1500, y: 1500, radius: 200, duration: 15, reward: 50 },
            extractionPoint: { x: 1500, y: 1200 },
            worldSize: 3000,
            theme: 'urban',
            waves: 8,
            enemyTypes: ['grunt', 'rusher', 'grenadier'],
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
            description: 'Track enemy patrols through dense woodland. Hold the extraction point.',
            difficulty: 'Hard',
            unlockOrder: 2,
            objective: { type: 'rescue', x: 1750, y: 1750, radius: 180, duration: 20, reward: 75 },
            extractionPoint: { x: 1750, y: 1400 },
            worldSize: 3500,
            theme: 'forest',
            waves: 10,
            enemyTypes: ['grunt', 'sniper', 'rusher', 'swarm'],
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
            unlockOrder: 3,
            objective: { type: 'kill', description: 'Eliminate 100 enemies', target: 100, reward: 100 },
            extractionPoint: { x: 1600, y: 1300 },
            worldSize: 3200,
            theme: 'desert',
            waves: 12,
            enemyTypes: ['grunt', 'heavy', 'rusher', 'flanker', 'charger'],
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
            description: 'Fight through factories and warehouses. Tight corridors and deadly ambushes.',
            difficulty: 'Extreme',
            unlockOrder: 4,
            objective: { type: 'defend', x: 1400, y: 1400, radius: 200, duration: 25, reward: 150 },
            extractionPoint: { x: 1400, y: 1100 },
            worldSize: 2800,
            theme: 'industrial',
            waves: 15,
            enemyTypes: ['grunt', 'heavy', 'flanker', 'sniper', 'rusher', 'psyker', 'charger'],
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
        },
        {
id: 'volcano_assault',
            name: 'Volcano Assault',
            description: 'Infiltrate the enemy base near the volcanic region. Watch for magma zones.',
            difficulty: 'Extreme',
            unlockOrder: 5,
            objective: { type: 'kill', description: 'Eliminate 120 enemies', target: 120, reward: 140 },
            extractionPoint: { x: 1400, y: 1100 },
            worldSize: 2800,
            theme: 'forest',
            waves: 14,
            enemyTypes: ['grunt', 'ninja', 'flanker', 'sniper', 'rusher', 'assassin', 'swarm'],
            bossWave: 14,
            playerSpawn: { x: 1400, y: 1400 },
            terrain: {
                roads: [
                    { orientation: 'diagonal', from: { x: 0.2, y: 0.3 }, to: { x: 0.8, y: 0.7 }, width: 1 }
                ],
                patches: [
                    { type: 'grassDark', count: 20, minR: 3, maxR: 7 },
                    { type: 'dirt', count: 10, minR: 2, maxR: 4 }
                ]
            },
            buildings: [
                { x: 300, y: 300, w: 150, h: 110, doors: [{ x: 0, y: 45, w: 12, h: 24 }] },
                { x: 2000, y: 400, w: 160, h: 120, doors: [{ x: 70, y: 0, w: 24, h: 12 }] },
                { x: 500, y: 2000, w: 170, h: 130, doors: [{ x: 80, y: 118, w: 24, h: 12 }] },
                { x: 1800, y: 1800, w: 140, h: 100, doors: [{ x: 0, y: 40, w: 12, h: 24 }] }
            ],
            brickWalls: [
                { x: 900, y: 900, w: 80, h: 16 },
                { x: 1600, y: 1200, w: 16, h: 80 },
                { x: 1200, y: 2000, w: 100, h: 16 }
            ],
            cars: [
                { x: 1000, y: 600, w: 70, h: 36, angle: Math.PI / 4 }
            ],
            trucks: [],
            suvs: [
                { x: 2200, y: 1400, w: 75, h: 38, angle: 0 }
            ],
            vans: [],
            barrels: [
                { x: 600, y: 1000 }, { x: 1800, y: 800 },
                { x: 1200, y: 2200 }, { x: 2400, y: 2000 }
            ],
            trees: { edgeCount: 40, edgeMargin: 300, innerCount: 35, minR: 16, maxR: 26 },
            barbedWire: [
                { x: 700, y: 700, w: 80, h: 60 },
                { x: 1400, y: 1000, w: 60, h: 80 },
                { x: 2000, y: 1800, w: 70, h: 50 },
                { x: 1000, y: 1800, w: 50, h: 70 },
                { x: 1800, y: 600, w: 60, h: 60 }
            ],
            pickups: [
                { x: 1400, y: 1300, type: 'health' },
                { x: 600, y: 800, type: 'ammo' },
                { x: 2200, y: 600, type: 'stamina' },
                { x: 1000, y: 2200, type: 'health' },
                { x: 2400, y: 2200, type: 'ammo' },
                { x: 1800, y: 1600, type: 'health' }
            ]
        },
        {
            id: 'storm_surge', name: 'Storm Surge', description: 'Lightning storms rage across the battlefield. Take cover or get struck.',
            difficulty: 'Hard', unlockOrder: 6, worldSize: 3000, theme: 'urban', waves: 10,
            objective: { type: 'kill', description: 'Eliminate 80 enemies', target: 80, reward: 80 },
            extractionPoint: { x: 1500, y: 1200 },
            enemyTypes: ['grunt', 'rusher', 'drone', 'flanker', 'swarm'], bossWave: 10,
            playerSpawn: { x: 1500, y: 1500 },
            hazard: 'storm',
            terrain: { roads: [{ orientation: 'vertical', centerFrac: 0.5, width: 2 }, { orientation: 'horizontal', centerFrac: 0.5, width: 2 }], patches: [{ type: 'grass', count: 6, minR: 2, maxR: 4 }, { type: 'concrete', count: 4, minR: 2, maxR: 4 }] },
            buildings: [
                { x: 400, y: 400, w: 160, h: 120, doors: [{ x: 0, y: 50, w: 12, h: 24 }] },
                { x: 2000, y: 600, w: 180, h: 130, doors: [{ x: 80, y: 0, w: 24, h: 12 }] },
                { x: 800, y: 2000, w: 170, h: 120, doors: [{ x: 70, y: 108, w: 24, h: 12 }] },
                { x: 2200, y: 2200, w: 160, h: 110, doors: [{ x: 0, y: 45, w: 12, h: 24 }] }
            ],
            brickWalls: [{ x: 1000, y: 800, w: 80, h: 16 }, { x: 1800, y: 1400, w: 16, h: 80 }],
            cars: [{ x: 600, y: 1200, w: 70, h: 36, angle: 0 }, { x: 1800, y: 800, w: 70, h: 36, angle: Math.PI / 3 }],
            trucks: [{ x: 1200, y: 600, w: 90, h: 40, angle: Math.PI / 2 }], suvs: [], vans: [],
            barrels: [{ x: 900, y: 900 }, { x: 2100, y: 600 }, { x: 500, y: 1800 }],
            trees: { edgeCount: 15, edgeMargin: 200, innerCount: 5, minR: 14, maxR: 20 },
            barbedWire: [{ x: 1100, y: 1100, w: 60, h: 40 }],
            pickups: [{ x: 1500, y: 1400, type: 'health' }, { x: 800, y: 500, type: 'ammo' }, { x: 2200, y: 1500, type: 'stamina' }]
        },
        {
            id: 'blizzard_mountain', name: 'Blizzard Mountain', description: 'Freezing winds and icy terrain slow your movement. Hypothermia drains HP over time.',
            difficulty: 'Extreme', unlockOrder: 7, worldSize: 3200, theme: 'forest', waves: 12,
            objective: { type: 'kill', description: 'Eliminate 100 enemies', target: 100, reward: 120 },
            extractionPoint: { x: 1600, y: 2000 },
            enemyTypes: ['grunt', 'rusher', 'heavy', 'sniper', 'ninja', 'charger', 'psyker'], bossWave: 12,
            playerSpawn: { x: 1600, y: 2400 },
            hazard: 'blizzard',
            terrain: { roads: [{ orientation: 'diagonal', from: { x: 0.3, y: 0.8 }, to: { x: 0.7, y: 0.2 }, width: 1 }], patches: [{ type: 'grassDark', count: 15, minR: 3, maxR: 6 }, { type: 'dirt', count: 8, minR: 2, maxR: 4 }] },
            buildings: [
                { x: 500, y: 500, w: 180, h: 140, doors: [{ x: 0, y: 60, w: 12, h: 24 }] },
                { x: 2200, y: 800, w: 160, h: 120, doors: [{ x: 70, y: 0, w: 24, h: 12 }] },
                { x: 1200, y: 1800, w: 200, h: 150, doors: [{ x: 90, y: 138, w: 24, h: 12 }] }
            ],
            brickWalls: [{ x: 1400, y: 1000, w: 100, h: 16 }],
            cars: [{ x: 800, y: 1200, w: 70, h: 36, angle: 0 }],
            trucks: [], suvs: [{ x: 1800, y: 600, w: 75, h: 38, angle: Math.PI / 4 }], vans: [],
            barrels: [{ x: 600, y: 800 }, { x: 2000, y: 1400 }],
            trees: { edgeCount: 40, edgeMargin: 300, innerCount: 30, minR: 16, maxR: 26 },
            barbedWire: [{ x: 1000, y: 1200, w: 60, h: 40 }, { x: 1800, y: 1800, w: 50, h: 50 }],
            pickups: [{ x: 1600, y: 2300, type: 'health' }, { x: 700, y: 700, type: 'ammo' }, { x: 2400, y: 1000, type: 'stamina' }, { x: 1200, y: 1600, type: 'health' }]
        },
        {
            id: 'volcano_caldera', name: 'Volcano Caldera', description: 'Molten lava rains from the sky. Volcanic eruptions create deadly zones.',
            difficulty: 'Extreme', unlockOrder: 8, worldSize: 3000, theme: 'desert', waves: 14,
            objective: { type: 'kill', description: 'Eliminate 120 enemies', target: 120, reward: 150 },
            extractionPoint: { x: 1500, y: 2100 },
            enemyTypes: ['grunt', 'bomber', 'heavy', 'rusher', 'flanker', 'grenadier', 'summoner'], bossWave: 14,
            playerSpawn: { x: 1500, y: 2500 },
            hazard: 'volcano',
            terrain: { roads: [{ orientation: 'horizontal', centerFrac: 0.7, width: 2 }], patches: [{ type: 'rust', count: 20, minR: 2, maxR: 6 }, { type: 'dirt', count: 10, minR: 1, maxR: 3 }] },
            buildings: [
                { x: 400, y: 600, w: 160, h: 120, doors: [{ x: 0, y: 50, w: 12, h: 24 }] },
                { x: 2000, y: 400, w: 180, h: 130, doors: [{ x: 80, y: 0, w: 24, h: 12 }] }
            ],
            brickWalls: [{ x: 1000, y: 1000, w: 100, h: 16 }],
            cars: [{ x: 800, y: 1400, w: 70, h: 36, angle: 0 }],
            trucks: [], suvs: [], vans: [],
            barrels: [{ x: 500, y: 500 }, { x: 700, y: 700 }, { x: 1500, y: 800 }, { x: 2100, y: 900 }, { x: 1200, y: 1800 }, { x: 2400, y: 1200 }, { x: 600, y: 2000 }, { x: 1600, y: 1600 }],
            trees: { edgeCount: 3, edgeMargin: 100, innerCount: 0, minR: 12, maxR: 16 },
            barbedWire: [{ x: 1000, y: 1000, w: 60, h: 40 }],
            pickups: [{ x: 1500, y: 2400, type: 'health' }, { x: 600, y: 800, type: 'ammo' }, { x: 2200, y: 600, type: 'stamina' }, { x: 1200, y: 1200, type: 'health' }]
        },
        {
            id: 'training_ground', name: 'Training Ground', description: 'Practice zone with extra pickups and weaker enemies. Perfect for beginners.',
            difficulty: 'Normal', unlockOrder: 0, worldSize: 2500, theme: 'urban', waves: 5,
            objective: { type: 'kill', description: 'Eliminate 30 enemies', target: 30, reward: 30 },
            extractionPoint: { x: 1250, y: 1050 },
            enemyTypes: ['grunt', 'rusher'], bossWave: -1,
            playerSpawn: { x: 1250, y: 1250 },
            hazard: null,
            terrain: { roads: [{ orientation: 'vertical', centerFrac: 0.5, width: 3 }, { orientation: 'horizontal', centerFrac: 0.5, width: 3 }], patches: [{ type: 'grass', count: 10, minR: 2, maxR: 4 }, { type: 'concrete', count: 8, minR: 2, maxR: 5 }] },
            buildings: [
                { x: 300, y: 300, w: 200, h: 150, doors: [{ x: 90, y: 0, w: 24, h: 12 }, { x: 0, y: 65, w: 12, h: 24 }] },
                { x: 1800, y: 300, w: 200, h: 150, doors: [{ x: 90, y: 138, w: 24, h: 12 }] },
                { x: 300, y: 1800, w: 200, h: 150, doors: [{ x: 188, y: 65, w: 12, h: 24 }] },
                { x: 1800, y: 1800, w: 200, h: 150, doors: [{ x: 0, y: 65, w: 12, h: 24 }] }
            ],
            brickWalls: [],
            cars: [{ x: 1000, y: 600, w: 70, h: 36, angle: 0 }],
            trucks: [], suvs: [], vans: [],
            barrels: [{ x: 800, y: 800 }, { x: 1600, y: 800 }, { x: 800, y: 1600 }, { x: 1600, y: 1600 }],
            trees: { edgeCount: 20, edgeMargin: 200, innerCount: 8, minR: 14, maxR: 20 },
            barbedWire: [],
            pickups: [
                { x: 1250, y: 1150, type: 'health' }, { x: 1250, y: 1350, type: 'ammo' },
                { x: 600, y: 600, type: 'health' }, { x: 1900, y: 600, type: 'ammo' },
                { x: 600, y: 1900, type: 'stamina' }, { x: 1900, y: 1900, type: 'health' },
                { x: 1250, y: 600, type: 'ammo' }, { x: 1250, y: 1900, type: 'health' }
            ]
        }
    ],

    // Daily challenges - random modifiers
    dailyChallenges: [
        { id: 'glass_cannon_run', name: 'Glass Cannon', desc: 'Start with 30 HP. All damage x2.', icon: 'GC', modify: (game) => { game.player.hp = 30; game.player.maxHP = 30; } },
        { id: 'speed_demon_run', name: 'Speed Demon Run', desc: 'Enemies move 50% faster.', icon: 'SD', modify: (game) => { game._challengeSpeedMult = 1.5; } },
        { id: 'ammo_scarcity', name: 'Ammo Scarcity', desc: 'No ammo pickups spawn.', icon: 'AS', modify: (game) => { game._challengeNoAmmo = true; } },
        { id: 'double_trouble', name: 'Double Trouble', desc: '2x enemies per wave.', icon: 'DT', modify: (game) => { game._challengeDoubleEnemies = true; } },
        { id: 'no_heals', name: 'No Healing', desc: 'Health pickups are disabled.', icon: 'NH', modify: (game) => { game._challengeNoHeals = true; } },
        { id: 'one_weapon', name: 'One Gun', desc: 'Only the weapon you start with.', icon: '1G', modify: (game) => { game._challengeOneWeapon = true; } },
        { id: 'fog_of_war', name: 'Fog of War', desc: 'Visibility reduced to 300px.', icon: 'FW', modify: (game) => { game._challengeFogRadius = 300; } },
        { id: 'zombie_mode', name: 'Zombie Mode', desc: 'Enemies only die from headshots (close range).', icon: 'ZM', modify: (game) => { game._challengeZombieMode = true; } }
    ],

    // Endless mode - Phase 7 (faster scaling)
    endless: {
        chunkSize: 2000,
        viewChunks: 2,
        obstacleDensity: 0.5,
        pickupDensity: 0.03,
        enemyBaseRate: 2000,
        enemyMinRate: 300,
        difficultyRamp: 0.025,
        themes: ['urban', 'forest', 'desert', 'industrial'],
        biomeRadius: 4
    },

    // Achievements
    achievements: [
        { id: 'first_blood', name: 'First Blood', desc: 'Kill your first enemy', icon: 'FB', check: (data) => data.totalKills >= 1 },
        { id: 'centurion', name: 'Centurion', desc: 'Kill 100 enemies total', icon: 'C1', check: (data) => data.totalKills >= 100 },
        { id: 'massacre', name: 'Massacre', desc: 'Kill 500 enemies total', icon: 'C5', check: (data) => data.totalKills >= 500 },
        { id: 'wave_5', name: 'Wave 5', desc: 'Reach wave 5', icon: 'W5', check: (data) => data.bestWave >= 5 },
        { id: 'wave_10', name: 'Wave 10', desc: 'Reach wave 10', icon: 'W1', check: (data) => data.bestWave >= 10 },
        { id: 'wave_15', name: 'Wave 15', desc: 'Reach wave 15', icon: 'W1', check: (data) => data.bestWave >= 15 },
        { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a boss', icon: 'BS', check: (data) => data.bossesKilled >= 1 },
        { id: 'high_score_1k', name: 'Score Hunter', desc: 'Score 1,000 points', icon: 'S1', check: (data) => data.highScore >= 1000 },
        { id: 'high_score_10k', name: 'Score Master', desc: 'Score 10,000 points', icon: 'S1', check: (data) => data.highScore >= 10000 },
        { id: 'high_score_50k', name: 'Score Legend', desc: 'Score 50,000 points', icon: 'S5', check: (data) => data.highScore >= 50000 },
        { id: 'coin_collector', name: 'Coin Collector', desc: 'Earn 1,000 coins total', icon: 'CC', check: (data) => data.totalCoinsEarned >= 1000 },
        { id: 'coin_hoarder', name: 'Coin Hoarder', desc: 'Earn 10,000 coins total', icon: 'CH', check: (data) => data.totalCoinsEarned >= 10000 },
        { id: 'shopaholic', name: 'Shopaholic', desc: 'Buy 5 items from the shop', icon: 'SH', check: (data) => (data.purchasedItems || []).length >= 5 },
        { id: 'perk_collector', name: 'Perk Collector', desc: 'Collect all 3 perks in a single run', icon: 'PC', check: (data) => data.maxPerksUsed >= 3 },
        { id: 'survivor', name: 'Survivor', desc: 'Complete a mission without dying', icon: 'SV', check: (data) => data.noDeathRuns >= 1 },
        { id: 'combo_king', name: 'Combo King', desc: 'Reach a 20x combo', icon: 'CK', check: (data) => data.maxCombo >= 20 },
        { id: 'arsenal', name: 'Arsenal', desc: 'Use all 8 weapons in one run', icon: 'AR', check: (data) => data.weaponsUsed >= 8 },
        { id: 'all_missions', name: 'World Tour', desc: 'Play all 10 missions', icon: 'WT', check: (data) => (data.missionsPlayed || []).length >= 10 }
    ]
};
