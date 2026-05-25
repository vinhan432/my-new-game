/**
 * Dodge Warfare - Phase 6
 * Systems - WaveManager, ScoreManager, Explosion, Effects, Particles
 */

// ============================================================
// EXPLOSION - Enhanced with debris, rings, and boss variant
// ============================================================
class Explosion {
    constructor(x, y, radius, damage, isBoss = false) {
        this.x = x; this.y = y; this.radius = radius; this.damage = damage; this.isBoss = isBoss;
        this.age = 0; this.maxAge = isBoss ? 1200 : 600; this.active = true; this.particles = [];
        this.rings = [{ radius: 0, maxRadius: radius, alpha: 1 }];
        const qual = typeof game !== 'undefined' && game ? game.graphicsQuality || 'high' : 'high';
        const fireMult = qual === 'low' ? 0.4 : qual === 'medium' ? 0.7 : 1;
        const smokeMult = qual === 'low' ? 0.3 : qual === 'medium' ? 0.6 : 1;
        const debrisMult = qual === 'low' ? 0 : qual === 'medium' ? 0.5 : 1;
        const fireCount = Math.floor((isBoss ? 50 : 20) * fireMult);
        const smokeCount = Math.floor((isBoss ? 20 : 8) * smokeMult);
        const debrisCount = Math.floor((isBoss ? 15 : 0) * debrisMult);
        const fireColors = ['#FF6600', '#FFAA00', '#FF4400', '#FFCC00', '#FF8800'];
        // Fire particles
        for (let i = 0; i < fireCount; i++) {
            const angle = Math.random() * Math.PI * 2, speed = (isBoss ? 60 : 40) + Math.random() * (isBoss ? 300 : 180);
            this.particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
                (isBoss ? 400 : 250) + Math.random() * (isBoss ? 600 : 400),
                2 + Math.random() * (isBoss ? 8 : 5),
                fireColors[Math.floor(Math.random() * 5)], { gravity: -20 + Math.random() * 40, shape: 'circle', shrink: true }));
        }
        // Smoke particles
        for (let i = 0; i < smokeCount; i++) {
            const angle = Math.random() * Math.PI * 2, speed = 20 + Math.random() * (isBoss ? 100 : 60);
            this.particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
                (isBoss ? 600 : 400) + Math.random() * (isBoss ? 500 : 300),
                5 + Math.random() * (isBoss ? 14 : 8),
                isBoss ? '#555' : '#333', { gravity: -40, isSmoke: true }));
        }
        // Boss debris chunks
        for (let i = 0; i < debrisCount; i++) {
            const angle = Math.random() * Math.PI * 2, speed = 100 + Math.random() * 200;
            this.particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
                500 + Math.random() * 400, 4 + Math.random() * 8,
                ['#4A0E0E', '#666', '#888', '#333'][Math.floor(Math.random() * 4)],
                { gravity: 80, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 10 }));
        }
        // Boss shockwave rings
        if (isBoss) {
            this.rings.push({ radius: 0, maxRadius: radius * 1.5, alpha: 0.8 });
            this.rings.push({ radius: 0, maxRadius: radius * 2, alpha: 0.5 });
        }
    }
    update(dt) {
        this.age += dt * 1000; if (this.age > this.maxAge) this.active = false;
        for (const p of this.particles) p.update(dt);
        this.particles = this.particles.filter(p => p.active);
    }
    render(ctx, cameraOffset, quality) {
        const progress = this.age / this.maxAge, sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling — skip offscreen explosions
        const margin = this.radius + 20;
        if (sx < -margin || sx > ctx.canvas.width + margin || sy < -margin || sy > ctx.canvas.height + margin) return;
        // Shockwave ring(s)
        for (const ring of this.rings) {
            const ringProgress = Math.min(1, progress * (this.maxAge / 600));
            const r = ring.maxRadius * ringProgress;
            const a = ring.alpha * (1 - ringProgress);
            if (a > 0.01) {
                ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255,120,0,${a})`; ctx.lineWidth = Math.max(1, 3 * (1 - ringProgress)); ctx.stroke();
            }
        }
        // Inner glow
        if (progress < 0.25) {
            const innerAlpha = (0.25 - progress) * 4;
            const glowSize = this.isBoss ? 0.6 : 0.4;
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * glowSize * (1 - progress), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,220,100,${innerAlpha * 0.7})`; ctx.fill();
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,200,${innerAlpha * 0.5})`; ctx.fill();
            // Boss: extra bright core
            if (this.isBoss) {
                ctx.beginPath(); ctx.arc(sx, sy, this.radius * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${innerAlpha * 0.3})`; ctx.fill();
            }
        }
        // Particles
        const pCount = quality === 'low' ? Math.floor(this.particles.length * 0.4) : this.particles.length;
        for (let i = 0; i < pCount; i++) {
            this.particles[i].render(ctx, cameraOffset);
        }
    }
}

// ============================================================
// IMPACT EFFECT
// ============================================================
class ImpactEffect {
    constructor(x, y, isWall = true) {
        this.x = x; this.y = y; this.age = 0; this.maxAge = 200; this.active = true; this.isWall = isWall;
        this.sparks = [];
        if (isWall) {
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                this.sparks.push(new Particle(x, y, Math.cos(angle) * (80 + Math.random() * 120), Math.sin(angle) * (80 + Math.random() * 120),
                    150 + Math.random() * 100, 2, '#FFD700', { friction: 5 }));
            }
        }
    }
    update(dt) {
        this.age += dt * 1000; if (this.age > this.maxAge) this.active = false;
        for (const s of this.sparks) s.update(dt);
        this.sparks = this.sparks.filter(s => s.active);
    }
    render(ctx, cameraOffset, quality) {
        const progress = this.age / this.maxAge, sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        if (sx < -20 || sx > ctx.canvas.width + 20 || sy < -20 || sy > ctx.canvas.height + 20) return;
        ctx.beginPath(); ctx.arc(sx, sy, 6 * (1 + progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,100,${(1 - progress) * 0.6})`; ctx.fill();
        if (quality !== 'low') {
            for (const s of this.sparks) s.render(ctx, cameraOffset);
        }
    }
}

// ============================================================
// MUZZLE FLASH EFFECT (world-space)
// ============================================================
class MuzzleFlashEffect {
    constructor(x, y, angle) {
        this.x = x; this.y = y; this.angle = angle; this.age = 0; this.maxAge = 60; this.active = true;
    }
    update(dt) { this.age += dt * 1000; if (this.age > this.maxAge) this.active = false; }
    render(ctx, cameraOffset, quality) {
        if (quality === 'low') return;
        const progress = this.age / this.maxAge;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling
        if (sx < -30 || sx > ctx.canvas.width + 30 || sy < -30 || sy > ctx.canvas.height + 30) return;
        const alpha = (1 - progress) * 0.5;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);
        ctx.beginPath(); ctx.arc(10, 0, 8 * (1 - progress), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,50,${alpha})`; ctx.fill();
        ctx.restore();
    }
}

// ============================================================
// WAVE MANAGER - Mission-aware with boss wave support
// ============================================================
class WaveManager {
    constructor() {
        this.wave = 0; this.enemiesSpawned = 0; this.enemiesToSpawn = 0;
        this.state = 'waiting'; this.timer = CONFIG.wave.initialDelay; this.spawnTimer = 0;
        this.announcementTimer = 0; this.announcementText = '';
        this.bossSpawned = false; this.isBossWave = false; this.isMiniBossWave = false;
        this.maxWaves = 999; this.missionEnemyTypes = null; this.bossWave = 5;
        this.bossWarningTimer = 0;
        this._justCompleted = false;
    }
    getEnemiesRemaining(enemies) { let c = 0; for (let i = 0, len = enemies.length; i < len; i++) { if (enemies[i].active && !enemies[i].isDying) c++; } return c; }
    getBossRemaining(enemies) { let c = 0; for (let i = 0, len = enemies.length; i < len; i++) { const e = enemies[i]; if (e.active && !e.isDying && e.type === 'boss') c++; } return c; }
    update(dt, game) {
        this._gameRef = game;
        // Skip wave logic in endless mode
        if (game.endlessMode) return;
        if (this.state === 'waiting') {
            this.timer -= dt * 1000;
            if (this.timer <= 0) this._startWave(game);
        } else if (this.state === 'between') {
            this.timer -= dt * 1000;
            if (this.timer <= 0) this._startWave(game);
        } else if (this.state === 'spawning') {
            this.spawnTimer -= dt * 1000;
            if (this.spawnTimer <= 0 && this.enemiesSpawned < this.enemiesToSpawn) {
                this._spawnEnemy(game); this.enemiesSpawned++; this.spawnTimer = CONFIG.wave.staggerDelay;
            }
            if (this.enemiesSpawned >= this.enemiesToSpawn && !this.isBossWave) this.state = 'active';
            if (this.enemiesSpawned >= this.enemiesToSpawn && this.isBossWave && this.bossSpawned) this.state = 'active';
        } else if (this.state === 'active') {
            if (this.isBossWave) {
                if (this.getBossRemaining(game.enemies) === 0 && this.getEnemiesRemaining(game.enemies) === 0) {
                    this._completeWave(game);
                }
            } else {
                if (this.getEnemiesRemaining(game.enemies) === 0 && this.enemiesSpawned >= this.enemiesToSpawn) {
                    this._completeWave(game);
                }
            }
        }
        if (this.announcementTimer > 0) this.announcementTimer -= dt * 1000;
        if (this.bossWarningTimer > 0) {
            this.bossWarningTimer -= dt * 1000;
            if (this.bossWarningTimer <= 0) {
                this.bossWarningTimer = 0;
                if (game && game.soundManager) game.soundManager.playSound('bossWarning');
            }
        }
    }
    _completeWave(game) {
        this._justCompleted = true;
        this.state = 'between'; this.timer = CONFIG.wave.betweenWaves;
        this.announcementText = `Wave ${this.wave} Complete!`; this.announcementTimer = 3000;
        game.scoreManager.addScore(CONFIG.score.waveBonusMultiplier * this.wave);
        if (game.soundManager) game.soundManager.playSound('waveComplete');
        this.bossSpawned = false; this.isBossWave = false;
        // Regenerate map elements for next wave
        if (game._regenerateMapForWave) game._regenerateMapForWave(this.wave);
        // Every 2 waves, offer perk choice
        if (this.wave > 0 && this.wave % 2 === 0 && game._spawnPerkChoice) game._spawnPerkChoice();
    }
    _startWave(game) {
        this.wave++;
        this.isBossWave = (this.wave === this.bossWave);
        this.isMiniBossWave = !this.isBossWave && this.wave > this.bossWave && ((this.wave - this.bossWave) % CONFIG.wave.miniBossInterval === 0);
        this.bossSpawned = false;
        this.miniBossSpawned = 0;
        if (this.isBossWave) {
            this.enemiesToSpawn = Math.min(3 + Math.floor(this.wave / 5), 8);
        } else if (this.isMiniBossWave) {
            this.enemiesToSpawn = Math.min(CONFIG.wave.miniBossCount, 6) + Math.floor(CONFIG.wave.baseEnemyCount * 0.5);
        } else {
            this.enemiesToSpawn = Math.min(CONFIG.wave.baseEnemyCount + (this.wave - 1) * CONFIG.wave.countIncrease, CONFIG.wave.maxEnemies);
        }
        // Double enemies challenge
        if (this._gameRef && this._gameRef._challengeDoubleEnemies) this.enemiesToSpawn *= 2;
        this.enemiesSpawned = 0; this.state = 'spawning'; this.spawnTimer = 0;
        if (this.isBossWave) {
            this.announcementText = `BOSS WAVE ${this.wave}`;
            this.announcementTimer = 3000;
            if (game.screenFlash) {
                game.screenFlash.alpha = 0.5;
                game.screenFlash.color = '#FF0000';
                game.screenFlash.decay = 1.5;
            }
        } else if (this.isMiniBossWave) {
            this.announcementText = `ELITE WAVE ${this.wave}`;
            this.announcementTimer = 2500;
            if (game.screenFlash) {
                game.screenFlash.alpha = 0.3;
                game.screenFlash.color = '#FF6600';
                game.screenFlash.decay = 1.0;
            }
        } else {
            this.announcementText = `Wave ${this.wave} Incoming!`;
            this.announcementTimer = 2000;
        }
        if (game.soundManager) game.soundManager.playSound('waveStart');
        if (this.isBossWave) {
            // Boss warning plays after a 1-second game-time delay (handled in update via bossWarningTimer)
            this.bossWarningTimer = 1000;
        }
        // Close weapon shop when wave starts
        if (game && game.gameState && game.gameState.weaponShopOpen) {
            game.gameState.weaponShopOpen = false;
        }
    }
    _spawnEnemy(game) {
        const cx = CONFIG.world.width / 2, cy = CONFIG.world.height / 2;
        let x, y, attempts = 0;

        // Phase 7: Multi-direction spawning after certain waves
        const useMultiDir = this.wave >= CONFIG.wave.multiDirWave;
        const useAllDir = this.wave >= CONFIG.wave.multiDirAllWave;

        if (useMultiDir) {
            // Spawn from 2-3 specific directions
            const dirCount = useAllDir ? 4 : 2 + (this.wave % 2);
            const dirIndex = this.enemiesSpawned % dirCount;
            const baseAngle = (Math.PI * 2 / dirCount) * dirIndex + Math.random() * 0.5;
            const dist = CONFIG.wave.spawnRadius + Math.random() * 200;
            x = clamp(cx + Math.cos(baseAngle) * dist, CONFIG.wave.spawnMargin, CONFIG.world.width - CONFIG.wave.spawnMargin);
            y = clamp(cy + Math.sin(baseAngle) * dist, CONFIG.wave.spawnMargin, CONFIG.world.height - CONFIG.wave.spawnMargin);
        } else {
            // Original single-direction spawning
            do {
                const angle = Math.random() * Math.PI * 2;
                const dist = CONFIG.wave.spawnRadius + Math.random() * 300;
                x = clamp(cx + Math.cos(angle) * dist, CONFIG.wave.spawnMargin, CONFIG.world.width - CONFIG.wave.spawnMargin);
                y = clamp(cy + Math.sin(angle) * dist, CONFIG.wave.spawnMargin, CONFIG.world.height - CONFIG.wave.spawnMargin);
                attempts++;
            } while (distance(x, y, game.player.x, game.player.y) < CONFIG.wave.spawnRadius && attempts < 10);
        }

        const hpMult = (1 + (this.wave - 1) * 0.04) * (this.isMiniBossWave ? 1.5 : 1);
        const dmgMult = (1 + (this.wave - 1) * 0.02) * (this.isMiniBossWave ? 1.5 : 1);

        // Mini-boss wave: extra stat boost
        const miniBossBoost = this.isMiniBossWave ? 1.5 : 1;

        // Spawn boss for boss waves (spawn it first, then minions)
        if (this.isBossWave && !this.bossSpawned && this.enemiesSpawned === 0) {
            this.bossSpawned = true;
            const boss = new EnemyBoss(x, y, this.wave);
            boss._gameRef = game;
            game.enemies.push(boss);
            return;
        }

        // Use mission enemy types if available, otherwise default
        let type;
        const allowed = this.missionEnemyTypes && this.missionEnemyTypes.length > 0
            ? this.missionEnemyTypes
            : ['grunt', 'rusher', 'heavy', 'sniper', 'flanker', 'medic', 'shield', 'drone', 'turret', 'bomber', 'ninja',
               'grenadier', 'psyker', 'swarm', 'charger', 'assassin', 'summoner'];
        // Weighted selection: earlier types are more common, unlock higher-tier types by wave
        const tierUnlocks = { grunt: 1, rusher: 3, heavy: 5, sniper: 7, flanker: 9, medic: 6, shield: 8, drone: 10, turret: 12, bomber: 8, ninja: 10,
            grenadier: 10, psyker: 14, swarm: 12, charger: 8, assassin: 16, summoner: 18 };
        const eligible = allowed.filter(t => this.wave >= (tierUnlocks[t] || 1));
        if (eligible.length === 0) {
            type = 'grunt'; // Fallback
        } else {
            // Weight toward earlier (easier) types
            const weights = eligible.map(t => {
                if (this.isMiniBossWave) {
                    if (t === 'summoner' || t === 'assassin' || t === 'psyker') return 3;
                    if (t === 'charger' || t === 'grenadier' || t === 'swarm' || t === 'ninja') return 2;
                    return 1;
                }
                if (t === 'grunt') return 4;
                if (t === 'rusher') return 3;
                if (t === 'heavy' || t === 'sniper') return 2;
                if (t === 'bomber' || t === 'ninja' || t === 'charger') return 1;
                if (t === 'swarm' || t === 'grenadier') return 0.8;
                if (t === 'psyker' || t === 'assassin') return 0.5;
                if (t === 'summoner') return 0.3;
                return 1;
            });
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * totalWeight;
            for (let i = 0; i < eligible.length; i++) {
                r -= weights[i];
                if (r <= 0) { type = eligible[i]; break; }
            }
            if (!type) type = eligible[eligible.length - 1];
        }

        let enemy;
        switch (type) {
            case 'grunt': enemy = new EnemyGrunt(x, y, hpMult, dmgMult); break;
            case 'rusher': enemy = new EnemyRusher(x, y, hpMult, dmgMult); break;
            case 'heavy': enemy = new EnemyHeavy(x, y, hpMult, dmgMult); break;
            case 'sniper': enemy = new EnemySniper(x, y, hpMult, dmgMult); break;
            case 'flanker': enemy = new EnemyFlanker(x, y, hpMult, dmgMult); break;
            case 'medic': enemy = new EnemyMedic(x, y, hpMult, dmgMult); break;
            case 'shield': enemy = new EnemyShield(x, y, hpMult, dmgMult); break;
            case 'drone': enemy = new EnemyDrone(x, y, hpMult, dmgMult); break;
            case 'turret': enemy = new EnemyTurret(x, y, hpMult, dmgMult); break;
            case 'bomber': enemy = new EnemyBomber(x, y, hpMult, dmgMult); break;
            case 'ninja': enemy = new EnemyNinja(x, y, hpMult, dmgMult); break;
            case 'grenadier': enemy = new EnemyGrenadier(x, y, hpMult, dmgMult); break;
            case 'psyker': enemy = new EnemyPsyker(x, y, hpMult, dmgMult); break;
            case 'swarm': enemy = new EnemySwarm(x, y, hpMult, dmgMult); break;
            case 'charger': enemy = new EnemyCharger(x, y, hpMult, dmgMult); break;
            case 'assassin': enemy = new EnemyAssassin(x, y, hpMult, dmgMult); break;
            case 'summoner': enemy = new EnemySummoner(x, y, hpMult, dmgMult); break;
        }
        enemy._gameRef = game;
        enemy.initVariant(game);
        game.enemies.push(enemy);
    }
}

// ============================================================
// SCORE MANAGER - Phase 5 with combo system
// ============================================================
class ScoreManager {
    constructor() {
        this.score = 0; this.kills = 0; this.highScore = 0;
        this.floatingNumbers = []; this.combo = 0; this.comboTimer = 0;
    }
    reset() { this.score = 0; this.kills = 0; this.combo = 0; this.comboTimer = 0; this.floatingNumbers = []; }
    addScore(amount) { this.score += amount; }
    addKill(baseScore, x, y) {
        // Combo
        this.combo++;
        this.comboTimer = CONFIG.score.comboWindow;
        const comboMult = 1 + (this.combo - 1) * CONFIG.score.comboMultiplier;
        const finalScore = Math.ceil(baseScore * comboMult);
        this.score += finalScore; this.kills++;
        const text = this.combo > 1 ? `+${finalScore} x${this.combo}` : `+${finalScore}`;
        this.floatingNumbers.push({ x, y, text, age: 0, maxAge: 1200, vy: -55, isScore: true, color: this.combo > 3 ? '#FF4444' : this.combo > 1 ? '#FF8800' : '#FFD700' });
        return finalScore;
    }
    addDamageNumber(x, y, amount) {
        this.floatingNumbers.push({ x, y, text: `-${amount}`, age: 0, maxAge: 800, vy: -65, isDamage: true, color: '#FF4444' });
    }
    update(dt) {
        if (this.comboTimer > 0) { this.comboTimer -= dt * 1000; if (this.comboTimer <= 0) this.combo = 0; }
        for (let i = this.floatingNumbers.length - 1; i >= 0; i--) {
            const fn = this.floatingNumbers[i];
            fn.y += fn.vy * dt; fn.age += dt * 1000;
            if (fn.age > fn.maxAge) {
                const last = this.floatingNumbers.pop();
                if (i < this.floatingNumbers.length) this.floatingNumbers[i] = last;
            }
        }
    }
    render(ctx, cameraOffset) {
        if (typeof game !== 'undefined' && game && game.persistence && !game.persistence.data.settings.showDamageNumbers) return;
        for (const fn of this.floatingNumbers) {
            const sx = fn.x - cameraOffset.x, sy = fn.y - cameraOffset.y;
            const alpha = 1 - fn.age / fn.maxAge;
            ctx.globalAlpha = alpha;
            ctx.font = fn.isDamage ? 'bold 14px monospace' : 'bold 16px monospace';
            ctx.fillStyle = fn.color || '#FFD700'; ctx.textAlign = 'center';
            ctx.fillText(fn.text, sx, sy); ctx.globalAlpha = 1;
        }
    }
}

// ============================================================
// HAZARD: Lightning Storm
// ============================================================
class LightningStorm {
    constructor(worldWidth, worldHeight) {
        this.worldWidth = worldWidth; this.worldHeight = worldHeight;
        this.strikes = []; this.strikeTimer = 0; this.strikeInterval = 2000;
        this.flashAlpha = 0; this.active = true;
        this.raindrops = [];
        for (let i = 0; i < 150; i++) {
            this.raindrops.push({ x: Math.random() * worldWidth, y: Math.random() * worldHeight, speed: 600 + Math.random() * 400, length: 8 + Math.random() * 12 });
        }
    }
    update(dt, playerX, playerY) {
        // Rain
        for (const drop of this.raindrops) {
            drop.y += drop.speed * dt; drop.x += 80 * dt;
            if (drop.y > playerY + 600) { drop.y = playerY - 600; drop.x = playerX - 800 + Math.random() * 1600; }
            if (drop.x > playerX + 800) drop.x = playerX - 800;
        }
        // Lightning strikes
        this.strikeTimer -= dt * 1000;
        if (this.strikeTimer <= 0) {
            this.strikeTimer = this.strikeInterval * (0.5 + Math.random());
            const sx = playerX + (Math.random() - 0.5) * 800;
            const sy = playerY + (Math.random() - 0.5) * 800;
            this.strikes.push({ x: sx, y: sy, age: 0, maxAge: 400, radius: 60, damage: 25 });
            this.flashAlpha = 0.6;
        }
        // Update strikes
        for (let i = this.strikes.length - 1; i >= 0; i--) {
            this.strikes[i].age += dt * 1000;
            if (this.strikes[i].age > this.strikes[i].maxAge) this.strikes.splice(i, 1);
        }
        if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3);
    }
    checkDamage(player) {
        for (const strike of this.strikes) {
            if (strike.age < 100) {
                const d = distance(player.x, player.y, strike.x, strike.y);
                if (d < strike.radius) return strike.damage;
            }
        }
        return 0;
    }
    render(ctx, cameraOffset, quality) {
        const sw = ctx.canvas.width, sh = ctx.canvas.height;
        // Rain
        if (quality !== 'low') {
            ctx.strokeStyle = 'rgba(150,180,255,0.3)'; ctx.lineWidth = 1;
            for (const drop of this.raindrops) {
                const sx = drop.x - cameraOffset.x, sy = drop.y - cameraOffset.y;
                if (sx < -20 || sx > sw + 20 || sy < -20 || sy > sh + 20) continue;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 3, sy + drop.length); ctx.stroke();
            }
        }
        // Lightning bolt
        for (const strike of this.strikes) {
            const sx = strike.x - cameraOffset.x, sy = strike.y - cameraOffset.y;
            if (sx < -100 || sx > sw + 100 || sy < -100 || sy > sh + 100) continue;
            const progress = strike.age / strike.maxAge;
            if (progress < 0.3) {
                ctx.strokeStyle = `rgba(255,255,200,${1 - progress * 3})`; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(sx, sy - 400);
                let bx = sx, by = sy - 400;
                for (let i = 0; i < 8; i++) { bx += (Math.random() - 0.5) * 40; by += 50; ctx.lineTo(bx, by); }
                ctx.stroke();
            }
            // Impact glow
            const impactAlpha = Math.max(0, 1 - progress * 2);
            const r = strike.radius * (1 + progress);
            ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,200,255,${impactAlpha * 0.3})`; ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${impactAlpha})`; ctx.lineWidth = 2; ctx.stroke();
        }
        // Screen flash
        if (this.flashAlpha > 0) {
            ctx.globalAlpha = this.flashAlpha;
            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, sw, sh);
            ctx.globalAlpha = 1;
        }
    }
}

// ============================================================
// HAZARD: Blizzard
// ============================================================
class BlizzardHazard {
    constructor(worldWidth, worldHeight) {
        this.worldWidth = worldWidth; this.worldHeight = worldHeight;
        this.snowflakes = []; this.active = true;
        this.coldDamageTimer = 0; this.coldDamageInterval = 3000;
        this.windAngle = 0; this.windStrength = 0;
        for (let i = 0; i < 200; i++) {
            this.snowflakes.push({ x: Math.random() * worldWidth, y: Math.random() * worldHeight, size: 1 + Math.random() * 3, speed: 40 + Math.random() * 80, wobble: Math.random() * Math.PI * 2 });
        }
    }
    update(dt, playerX, playerY) {
        this.windAngle += dt * 0.3;
        this.windStrength = 50 + Math.sin(this.windAngle) * 40;
        for (const flake of this.snowflakes) {
            flake.y += flake.speed * dt;
            flake.x += this.windStrength * dt + Math.sin(flake.wobble) * 20 * dt;
            flake.wobble += dt * 2;
            if (flake.y > playerY + 600) { flake.y = playerY - 600; flake.x = playerX - 800 + Math.random() * 1600; }
            if (flake.x > playerX + 800) flake.x = playerX - 800;
            if (flake.x < playerX - 800) flake.x = playerX + 800;
        }
        // Cold damage timer
        this.coldDamageTimer -= dt * 1000;
    }
    checkDamage(player) {
        if (this.coldDamageTimer <= 0) { this.coldDamageTimer = this.coldDamageInterval; return 5; }
        return 0;
    }
    render(ctx, cameraOffset, quality) {
        const sw = ctx.canvas.width, sh = ctx.canvas.height;
        // Snow overlay
        ctx.fillStyle = 'rgba(200,210,230,0.08)'; ctx.fillRect(0, 0, sw, sh);
        // Snowflakes
        const count = quality === 'low' ? 60 : this.snowflakes.length;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < count; i++) {
            const flake = this.snowflakes[i];
            const sx = flake.x - cameraOffset.x, sy = flake.y - cameraOffset.y;
            if (sx < -10 || sx > sw + 10 || sy < -10 || sy > sh + 10) continue;
            ctx.beginPath(); ctx.arc(sx, sy, flake.size, 0, Math.PI * 2); ctx.fill();
        }
        // Fog/vignette for blizzard feel
        const grad = ctx.createRadialGradient(sw / 2, sh / 2, sw * 0.2, sw / 2, sh / 2, sw * 0.7);
        grad.addColorStop(0, 'rgba(200,210,230,0)');
        grad.addColorStop(1, 'rgba(200,210,230,0.25)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, sw, sh);
    }
}

// ============================================================
// HAZARD: Volcanic Eruption
// ============================================================
class VolcanicHazard {
    constructor(worldWidth, worldHeight) {
        this.worldWidth = worldWidth; this.worldHeight = worldHeight;
        this.lavaProjectiles = []; this.eruptionTimer = 0; this.eruptionInterval = 3000;
        this.lavaPools = []; this.active = true; this.heatDistortion = 0;
    }
    update(dt, playerX, playerY, game) {
        this.heatDistortion += dt * 2;
        // Spawn lava projectiles
        this.eruptionTimer -= dt * 1000;
        if (this.eruptionTimer <= 0) {
            this.eruptionTimer = this.eruptionInterval * (0.6 + Math.random() * 0.8);
            const count = 3 + Math.floor(Math.random() * 4);
            for (let i = 0; i < count; i++) {
                const tx = playerX + (Math.random() - 0.5) * 600;
                const ty = playerY + (Math.random() - 0.5) * 600;
                this.lavaProjectiles.push({ x: tx, y: ty - 500, targetX: tx, targetY: ty, vy: 0, speed: 400, age: 0, maxAge: 2000, phase: 'falling' });
            }
        }
        // Update projectiles
        for (let i = this.lavaProjectiles.length - 1; i >= 0; i--) {
            const p = this.lavaProjectiles[i];
            p.age += dt * 1000;
            if (p.phase === 'falling') {
                p.vy += 800 * dt;
                p.y += p.vy * dt;
                if (p.y >= p.targetY) {
                    p.phase = 'impact'; p.y = p.targetY; p.age = 0;
                    this.lavaPools.push({ x: p.targetX, y: p.targetY, radius: 25 + Math.random() * 20, age: 0, maxAge: 8000 });
                }
            }
            if (p.age > p.maxAge) this.lavaProjectiles.splice(i, 1);
        }
        // Update lava pools
        for (let i = this.lavaPools.length - 1; i >= 0; i--) {
            this.lavaPools[i].age += dt * 1000;
            if (this.lavaPools[i].age > this.lavaPools[i].maxAge) this.lavaPools.splice(i, 1);
        }
        // Limit pools
        if (this.lavaPools.length > 20) this.lavaPools.splice(0, this.lavaPools.length - 20);
    }
    checkDamage(player) {
        // Lava projectile impact
        for (const p of this.lavaProjectiles) {
            if (p.phase === 'impact' && p.age < 200) {
                const d = distance(player.x, player.y, p.x, p.y);
                if (d < 40) return 30;
            }
        }
        // Standing in lava pool
        for (const pool of this.lavaPools) {
            const d = distance(player.x, player.y, pool.x, pool.y);
            if (d < pool.radius) return 10;
        }
        return 0;
    }
    render(ctx, cameraOffset, quality) {
        const sw = ctx.canvas.width, sh = ctx.canvas.height;
        // Lava pools
        for (const pool of this.lavaPools) {
            const sx = pool.x - cameraOffset.x, sy = pool.y - cameraOffset.y;
            if (sx < -60 || sx > sw + 60 || sy < -60 || sy > sh + 60) continue;
            const fade = pool.age > pool.maxAge - 2000 ? (pool.maxAge - pool.age) / 2000 : 1;
            const pulse = 0.7 + Math.sin(pool.age * 0.005) * 0.3;
            ctx.beginPath(); ctx.arc(sx, sy, pool.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,60,0,${fade * 0.6 * pulse})`; ctx.fill();
            ctx.beginPath(); ctx.arc(sx, sy, pool.radius * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,120,0,${fade * 0.4})`; ctx.fill();
            // Glow
            if (quality !== 'low') {
                const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, pool.radius * 1.5);
                glow.addColorStop(0, `rgba(255,100,0,${fade * 0.15})`);
                glow.addColorStop(1, 'rgba(255,100,0,0)');
                ctx.beginPath(); ctx.arc(sx, sy, pool.radius * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = glow; ctx.fill();
            }
        }
        // Falling lava projectiles
        for (const p of this.lavaProjectiles) {
            const sx = p.x - cameraOffset.x, sy = p.y - cameraOffset.y;
            if (sx < -20 || sx > sw + 20 || sy < -600 || sy > sh + 20) continue;
            if (p.phase === 'falling') {
                // Shadow on ground
                const shadowY = p.targetY - cameraOffset.y;
                ctx.beginPath(); ctx.ellipse(sx, shadowY, 12, 6, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0,0,0,${0.3 * Math.min(1, (p.targetY - p.y) / 300)})`; ctx.fill();
                // Lava ball
                ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#FF4400'; ctx.fill();
                ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#FF8800'; ctx.fill();
                // Trail
                if (quality !== 'low') {
                    ctx.beginPath(); ctx.arc(sx, sy + 10, 4, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,68,0,0.4)'; ctx.fill();
                }
            }
        }
        // Heat distortion overlay
        if (quality !== 'low') {
            ctx.fillStyle = `rgba(255,80,0,${0.02 + Math.sin(this.heatDistortion) * 0.01})`;
            ctx.fillRect(0, 0, sw, sh);
        }
    }
}

// ============================================================
// FLAME STREAM - Realistic flamethrower continuous stream
// ============================================================
class FlameStream {
    constructor() {
        this.active = false;
        this.age = 0;
        this.particles = [];
        this.maxParticles = 60;
        this.heatLevel = 0; // 0-1, overheats at 1
        this.overheated = false;
        this.overheatCooldown = 0;
    }

    update(dt, playerX, playerY, playerAngle, enemies, game) {
        // Overheat cooldown
        if (this.overheated) {
            this.overheatCooldown -= dt * 1000;
            this.heatLevel = Math.max(0, this.heatLevel - dt * 0.8);
            if (this.overheatCooldown <= 0) {
                this.overheated = false;
            }
            this.active = false;
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.age += dt * 1000;
            p.size *= 1.02; // Expand slightly
            if (p.age > p.life) {
                this.particles.splice(i, 1);
            }
        }

        // Apply burn damage to enemies
        for (const enemy of enemies) {
            if (!enemy.active || enemy.isDying) continue;
            if (enemy._burnTimer > 0) {
                enemy._burnTimer -= dt * 1000;
                enemy._burnTickTimer -= dt * 1000;
                if (enemy._burnTickTimer <= 0) {
                    enemy._burnTickTimer = 500; // Damage every 0.5s
                    const burnDmg = enemy._burnDamage || 3;
                    enemy.takeDamage(burnDmg, game);
                    // Burn particles
                    if (game.graphicsQuality !== 'low') {
                        for (let i = 0; i < 2; i++) {
                            const angle = Math.random() * Math.PI * 2;
                            this.particles.push({
                                x: enemy.x + Math.cos(angle) * enemy.radius * 0.5,
                                y: enemy.y + Math.sin(angle) * enemy.radius * 0.5,
                                vx: Math.cos(angle) * 30,
                                vy: Math.sin(angle) * 30 - 40,
                                life: 300 + Math.random() * 200,
                                age: 0,
                                size: 2 + Math.random() * 2,
                                color: Math.random() > 0.5 ? '#FF4400' : '#FF8800',
                                type: 'flame'
                            });
                        }
                    }
                }
            }
        }
    }

    fire(dt, playerX, playerY, playerAngle, enemies, game, quality) {
        if (this.overheated) return;

        this.active = true;
        this.age += dt * 1000;

        // Heat management
        this.heatLevel = Math.min(1, this.heatLevel + dt * 0.4);
        if (this.heatLevel >= 1) {
            this.overheated = true;
            this.overheatCooldown = 2000; // 2 second cooldown
            return;
        }

        // Flame stream parameters
        const streamLength = 200; // pixels
        const streamWidth = 60;   // pixels at max spread
        const coneAngle = 0.4;    // radians (~23 degrees)

        // Spawn flame particles along stream
        const particleCount = quality === 'low' ? 2 : quality === 'medium' ? 4 : 6;
        for (let i = 0; i < particleCount; i++) {
            const t = Math.random(); // 0-1 along stream
            const spread = (Math.random() - 0.5) * coneAngle * t;
            const angle = playerAngle + spread;
            const dist = t * streamLength;
            const speed = 200 + Math.random() * 150;

            const px = playerX + Math.cos(playerAngle) * 30 + Math.cos(angle) * dist;
            const py = playerY + Math.sin(playerAngle) * 30 + Math.sin(angle) * dist;

            this.particles.push({
                x: px,
                y: py,
                vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 30,
                vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 30,
                life: 200 + Math.random() * 300,
                age: 0,
                size: 4 + Math.random() * 6,
                color: ['#FF2200', '#FF4400', '#FF6600', '#FF8800', '#FFAA00'][Math.floor(Math.random() * 5)],
                type: 'flame'
            });
        }

        // Smoke particles (fewer)
        if (quality !== 'low' && Math.random() > 0.7) {
            const smokeAngle = playerAngle + (Math.random() - 0.5) * coneAngle * 0.5;
            const smokeDist = streamLength * 0.7 + Math.random() * streamLength * 0.3;
            this.particles.push({
                x: playerX + Math.cos(playerAngle) * 30 + Math.cos(smokeAngle) * smokeDist,
                y: playerY + Math.sin(playerAngle) * 30 + Math.sin(smokeAngle) * smokeDist,
                vx: Math.cos(smokeAngle) * 20 + (Math.random() - 0.5) * 15,
                vy: Math.sin(smokeAngle) * 20 - 30,
                life: 400 + Math.random() * 300,
                age: 0,
                size: 8 + Math.random() * 8,
                color: '#555',
                type: 'smoke'
            });
        }

        // Damage enemies in cone
        for (const enemy of enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const dx = enemy.x - playerX;
            const dy = enemy.y - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > streamLength + enemy.radius) continue;

            const angleToEnemy = Math.atan2(dy, dx);
            let angleDiff = angleToEnemy - playerAngle;
            // Normalize angle
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Check if enemy is within cone
            const maxAngle = coneAngle * (dist / streamLength) + Math.atan2(enemy.radius, dist);
            if (Math.abs(angleDiff) < maxAngle) {
                // Direct flame damage (reduces with distance)
                const distFactor = 1 - (dist / (streamLength + enemy.radius));
                const damage = Math.ceil(8 * distFactor); // 8 base damage, reduced by distance
                enemy.takeDamage(damage, game);

                // Apply burn
                enemy._burnTimer = 2000; // 2 seconds of burning
                enemy._burnDamage = 3;   // 3 damage per tick
                enemy._burnTickTimer = 0; // Immediate first tick

                // Knockback
                const knockAngle = Math.atan2(dy, dx);
                enemy.x += Math.cos(knockAngle) * 2;
                enemy.y += Math.sin(knockAngle) * 2;
            }
        }
    }

    render(ctx, cameraOffset, quality) {
        // Render flame particles
        for (const p of this.particles) {
            const sx = p.x - cameraOffset.x;
            const sy = p.y - cameraOffset.y;
            if (sx < -20 || sx > ctx.canvas.width + 20 || sy < -20 || sy > ctx.canvas.height + 20) continue;

            const progress = p.age / p.life;
            let alpha = 1 - progress;
            if (p.type === 'smoke') {
                alpha *= 0.4;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size * (1 - progress * 0.3), 0, Math.PI * 2);
                ctx.fill();
                // Core glow
                if (progress < 0.3 && quality !== 'low') {
                    ctx.globalAlpha = alpha * 0.5;
                    ctx.fillStyle = '#FFDD00';
                    ctx.beginPath();
                    ctx.arc(sx, sy, p.size * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;

        // Heat indicator (near player)
        if (this.heatLevel > 0) {
            const indicatorX = 20;
            const indicatorY = ctx.canvas.height - 40;
            const barWidth = 100;
            const barHeight = 8;

            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(indicatorX, indicatorY, barWidth, barHeight);

            // Heat level
            const heatColor = this.overheated ? '#FF0000' :
                this.heatLevel > 0.7 ? '#FF4400' :
                    this.heatLevel > 0.4 ? '#FF8800' : '#FFAA00';
            ctx.fillStyle = heatColor;
            ctx.fillRect(indicatorX, indicatorY, barWidth * this.heatLevel, barHeight);

            // Border
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1;
            ctx.strokeRect(indicatorX, indicatorY, barWidth, barHeight);

            // Text
            ctx.font = '10px monospace';
            ctx.fillStyle = this.overheated ? '#FF0000' : '#FFF';
            ctx.textAlign = 'center';
            ctx.fillText(this.overheated ? 'OVERHEAT' : 'HEAT', indicatorX + barWidth / 2, indicatorY - 5);
        }
    }
}

// ============================================================
// FIRE POOL - Area denial from flamethrower
// ============================================================
class FirePool {
    constructor(x, y, radius, duration) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.duration = duration; // ms
        this.age = 0;
        this.active = true;
        this.damageTickTimer = 0;
        this.particles = [];
    }

    update(dt, enemies, game) {
        this.age += dt * 1000;
        if (this.age > this.duration) {
            this.active = false;
            return;
        }

        // Damage enemies standing in fire
        this.damageTickTimer -= dt * 1000;
        if (this.damageTickTimer <= 0) {
            this.damageTickTimer = 500; // Damage every 0.5s
            for (const enemy of enemies) {
                if (!enemy.active || enemy.isDying) continue;
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                if (dx * dx + dy * dy < this.radius * this.radius) {
                    enemy.takeDamage(5, game);
                    // Set on fire
                    enemy._burnTimer = Math.max(enemy._burnTimer || 0, 1500);
                    enemy._burnDamage = 2;
                    enemy._burnTickTimer = 0;
                }
            }
        }

        // Spawn fire particles
        if (game.graphicsQuality !== 'low' && Math.random() > 0.8) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.radius * 0.8;
            this.particles.push({
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist,
                vx: (Math.random() - 0.5) * 20,
                vy: -20 - Math.random() * 30,
                life: 300 + Math.random() * 200,
                age: 0,
                size: 3 + Math.random() * 4,
                color: ['#FF2200', '#FF4400', '#FF6600'][Math.floor(Math.random() * 3)]
            });
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.age += dt * 1000;
            if (p.age > p.life) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx, cameraOffset, quality) {
        const sx = this.x - cameraOffset.x;
        const sy = this.y - cameraOffset.y;
        if (sx < -50 || sx > ctx.canvas.width + 50 || sy < -50 || sy > ctx.canvas.height + 50) return;

        const fadeProgress = this.age / this.duration;
        const alpha = fadeProgress > 0.8 ? (1 - fadeProgress) * 5 : 1;

        // Fire pool base
        ctx.globalAlpha = alpha * 0.6;
        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.radius);
        gradient.addColorStop(0, 'rgba(255,100,0,0.8)');
        gradient.addColorStop(0.5, 'rgba(255,50,0,0.4)');
        gradient.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow
        if (quality !== 'low') {
            ctx.globalAlpha = alpha * 0.4;
            const innerGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, this.radius * 0.5);
            innerGradient.addColorStop(0, 'rgba(255,200,50,0.6)');
            innerGradient.addColorStop(1, 'rgba(255,100,0,0)');
            ctx.fillStyle = innerGradient;
            ctx.beginPath();
            ctx.arc(sx, sy, this.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Render particles
        for (const p of this.particles) {
            const px = p.x - cameraOffset.x;
            const py = p.y - cameraOffset.y;
            const progress = p.age / p.life;
            ctx.globalAlpha = (1 - progress) * alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(px, py, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }
}

// ============================================================
// SPATIAL HASH - Grid-based collision optimization
// ============================================================
class SpatialHash {
    constructor(cellSize = 200) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    clear() { this.grid.clear(); }
    _hash(x, y) {
        const cx = Math.floor(x / this.cellSize), cy = Math.floor(y / this.cellSize);
        return `${cx},${cy}`;
    }
    insert(obj) {
        // Use center point for larger objects
        const hashX = obj.w !== undefined ? obj.x + obj.w / 2 : obj.x;
        const hashY = obj.h !== undefined ? obj.y + obj.h / 2 : obj.y;
        const key = this._hash(hashX, hashY);
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(obj);
        // For large objects, also insert into neighboring cells to avoid missed collisions
        if (obj.w !== undefined && obj.h !== undefined) {
            const halfW = obj.w / 2;
            const halfH = obj.h / 2;
            if (halfW > this.cellSize || halfH > this.cellSize) {
                const minCX = Math.floor((hashX - halfW) / this.cellSize);
                const maxCX = Math.floor((hashX + halfW) / this.cellSize);
                const minCY = Math.floor((hashY - halfH) / this.cellSize);
                const maxCY = Math.floor((hashY + halfH) / this.cellSize);
                for (let cx = minCX; cx <= maxCX; cx++) {
                    for (let cy = minCY; cy <= maxCY; cy++) {
                        const k = `${cx},${cy}`;
                        if (k !== key && !this.grid.has(k)) this.grid.set(k, []);
                        if (k !== key) this.grid.get(k).push(obj);
                    }
                }
            }
        }
    }
    query(x, y, radius = 0) {
        const results = [];
        const minCX = Math.floor((x - radius) / this.cellSize);
        const maxCX = Math.floor((x + radius) / this.cellSize);
        const minCY = Math.floor((y - radius) / this.cellSize);
        const maxCY = Math.floor((y + radius) / this.cellSize);
        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                const cell = this.grid.get(`${cx},${cy}`);
                if (cell) for (const obj of cell) results.push(obj);
            }
        }
        return results;
    }
    queryRect(x, y, w, h) {
        // Query for rectangular area
        const results = [];
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        const maxRadius = Math.sqrt(w * w + h * h) / 2;
        const minCX = Math.floor((x) / this.cellSize);
        const maxCX = Math.floor((x + w) / this.cellSize);
        const minCY = Math.floor((y) / this.cellSize);
        const maxCY = Math.floor((y + h) / this.cellSize);
        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                const cell = this.grid.get(`${cx},${cy}`);
                if (cell) for (const obj of cell) results.push(obj);
            }
        }
        return results;
    }
}

// ============================================================
// MISSION OBJECTIVE - Base class
// ============================================================
class MissionObjective {
    constructor(type, description, target, reward) {
        this.type = type;
        this.description = description;
        this.target = target;
        this.progress = 0;
        this.completed = false;
        this.reward = reward || 0;
    }
    update(game) {}
    getProgressText() { return `${this.progress}/${this.target}`; }
    getStatusText() { return this.completed ? 'COMPLETE' : this.getProgressText(); }
}

// Defend objective - stay in an area for a duration
class DefendObjective extends MissionObjective {
    constructor(x, y, radius, duration, reward) {
        super('defend', `Defend area for ${Math.floor(duration)}s`, duration, reward);
        this.defendX = x;
        this.defendY = y;
        this.defendRadius = radius;
        this.elapsedTime = 0;
        this.wasInZone = false;
    }
    update(game, dt) {
        if (this.completed) return;
        const dist = distance(game.player.x, game.player.y, this.defendX, this.defendY);
        const inZone = dist <= this.defendRadius;
        if (inZone) {
            this.elapsedTime += dt * 1000;
        }
        this.progress = Math.min(Math.floor(this.elapsedTime / 1000), this.target);
        // Visual indicator in HUD
        game._defendZone = { x: this.defendX, y: this.defendY, radius: this.defendRadius, inZone, time: this.elapsedTime };
        if (this.progress >= this.target) {
            this.completed = true;
            if (this.reward > 0) {
                game.persistence.data.coins += this.reward;
                game.scoreManager.floatingNumbers.push({
                    x: game.player.x, y: game.player.y - 30,
                    text: `+${this.reward} COINS`, age: 0, maxAge: 2000,
                    vy: -60, isCoin: true, color: '#FFD700'
                });
            }
        }
    }
    getProgressText() {
        const remaining = Math.max(0, this.target - this.progress);
        return `${this.progress}/${this.target}s`;
    }
}

// Activate objective - interact with an object/point
class ActivateObjective extends MissionObjective {
    constructor(x, y, radius, reward) {
        super('activate', 'Activate the device', 1, reward);
        this.activateX = x;
        this.activateY = y;
        this.activateRadius = radius;
        this.activated = false;
    }
    update(game) {
        if (this.completed) return;
        const dist = distance(game.player.x, game.player.y, this.activateX, this.activateY);
        if (dist <= this.activateRadius && game.input.justPressed('KeyE')) {
            this.completed = true;
            this.progress = 1;
            if (this.reward > 0) {
                game.persistence.data.coins += this.reward;
                game.scoreManager.floatingNumbers.push({
                    x: game.player.x, y: game.player.y - 30,
                    text: `+${this.reward} COINS`, age: 0, maxAge: 2000,
                    vy: -60, isCoin: true, color: '#FFD700'
                });
            }
        }
    }
    getProgressText() { return this.activated ? '1/1' : '0/1 (Press E)'; }
}

// Kill objective - eliminate all enemies in the mission
class KillObjective extends MissionObjective {
    constructor(target, reward) {
        super('kill', `Eliminate ${target} enemies`, target, reward);
    }
    update(game) {
        if (this.completed) return;
        this.progress = game.scoreManager.kills;
        if (this.progress >= this.target) {
            this.completed = true;
            if (this.reward > 0) {
                game.persistence.data.coins += this.reward;
                game.scoreManager.floatingNumbers.push({
                    x: game.player.x, y: game.player.y - 30,
                    text: `+${this.reward} COINS`, age: 0, maxAge: 2000,
                    vy: -60, isCoin: true, color: '#FFD700'
                });
            }
        }
    }
}

// Survive objective - complete all waves without dying
class SurviveObjective extends MissionObjective {
    constructor(waves, reward) {
        super('survive', `Survive ${waves} waves`, waves, reward);
        this.started = false;
    }
    update(game) {
        if (this.completed || !this.started) return;
        if (game.waveManager.wave >= this.target && game.waveManager.getEnemiesRemaining(game.enemies) === 0) {
            this.completed = true;
            if (this.reward > 0) {
                game.persistence.data.coins += this.reward;
                game.scoreManager.floatingNumbers.push({
                    x: game.player.x, y: game.player.y - 30,
                    text: `+${this.reward} COINS`, age: 0, maxAge: 2000,
                    vy: -60, isCoin: true, color: '#FFD700'
                });
            }
        }
    }
    start() { this.started = true; }
}

// Rescue objective - reach a point and wait
class RescueObjective extends MissionObjective {
    constructor(x, y, radius, duration, reward) {
        super('rescue', `Rescue zone - stay ${Math.floor(duration)}s`, duration, reward);
        this.rescueX = x;
        this.rescueY = y;
        this.rescueRadius = radius;
        this.elapsedTime = 0;
        this.wasInZone = false;
    }
    update(game, dt) {
        if (this.completed) return;
        const dist = distance(game.player.x, game.player.y, this.rescueX, this.rescueY);
        const inZone = dist <= this.rescueRadius;
        if (inZone) {
            this.elapsedTime += dt * 1000;
            if (!this.wasInZone) {
                game.scoreManager.floatingNumbers.push({
                    x: game.player.x, y: game.player.y - 50,
                    text: 'IN RESCUE ZONE', age: 0, maxAge: 1000,
                    vy: -30, color: '#00FF88'
                });
            }
        }
        this.wasInZone = inZone;
        this.progress = Math.min(Math.floor(this.elapsedTime / 1000), this.target);
        if (this.progress >= this.target) {
            this.completed = true;
            if (this.reward > 0) {
                game.persistence.data.coins += this.reward;
                game.scoreManager.floatingNumbers.push({
                    x: game.player.x, y: game.player.y - 30,
                    text: `+${this.reward} COINS`, age: 0, maxAge: 2000,
                    vy: -60, isCoin: true, color: '#FFD700'
                });
            }
        }
    }
    getProgressText() {
        const remaining = Math.max(0, this.target - this.progress);
        return `${this.progress}/${this.target}s`;
    }
}

// Collect objective - collect a number of items
class CollectObjective extends MissionObjective {
    constructor(type, target, reward) {
        super('collect', `Collect ${target} ${type} pickups`, target, reward);
        this.collectType = type;
        this._collected = 0;
    }
    update(game) {
        if (this.completed) return;
        this._collected = game.pickups.filter(p => !p.active && p.type === this.collectType).length;
        this.progress = Math.min(this._collected, this.target);
        if (this.progress >= this.target) this.completed = true;
    }
    getProgressText() { return `${this.progress}/${this.target}`; }
}

// Boss objective - defeat the boss
class BossObjective extends MissionObjective {
    constructor(reward) {
        super('boss', 'Defeat the boss', 1, reward);
        this.bossSpawned = false;
    }
    update(game) {
        if (this.completed) return;
        // Check if boss was killed
        if (game.waveManager.isBossWave && game.waveManager.getBossRemaining(game.enemies) === 0) {
            const bossKilled = game.enemies.some(e => e.type === 'boss' && !e.active);
            if (bossKilled) {
                this.completed = true;
                if (this.reward > 0) {
                    game.persistence.data.coins += this.reward;
                }
            }
        }
    }
}

// Protect objective - keep something alive (e.g., position)
class ProtectObjective extends MissionObjective {
    constructor(x, y, radius, duration, reward) {
        super('protect', `Defend the area for ${Math.floor(duration / 60)}s`, Math.ceil(duration / 60), reward);
        this.protectX = x;
        this.protectY = y;
        this.protectRadius = radius;
        this.elapsedTime = 0;
        this.lastEnemyCheck = 0;
    }
    update(game, dt) {
        if (this.completed) return;
        // Check if player stayed in zone
        const dist = distance(game.player.x, game.player.y, this.protectX, this.protectY);
        if (dist <= this.protectRadius) {
            this.elapsedTime += dt * 1000;
        }
        this.progress = Math.min(Math.floor(this.elapsedTime / 1000), this.target);
        if (this.progress >= this.target) {
            this.completed = true;
            if (this.reward > 0) game.persistence.data.coins += this.reward;
        }
    }
    getProgressText() {
        const remaining = Math.max(0, this.target - this.progress);
        return `${Math.floor(this.elapsedTime / 1000)}s / ${this.target}s`;
    }
}

// Wave clear objective - clear each wave consecutively
class WaveClearObjective extends MissionObjective {
    constructor(waves, reward) {
        super('waveclear', `Clear ${waves} waves`, waves, reward);
        this.wavesCleared = 0;
        this._waveMgrRef = null;
    }
    update(game) {
        if (this.completed) return;
        // Track current wave progress
        this.progress = game.waveManager ? game.waveManager.wave : 0;
        if (game.waveManager.wave >= this.target &&
            game.waveManager.getEnemiesRemaining(game.enemies) === 0 &&
            game.waveManager.state !== 'spawning') {
            this.completed = true;
            if (this.reward > 0) game.persistence.data.coins += this.reward;
        }
    }
    getProgressText() { return `Wave ${this.progress}/${this.target}`; }
}

// ============================================================
// HELICOPTER - Mission extraction vehicle
// ============================================================
class Helicopter {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.phase = 'approaching'; // approaching, landing, landed, boarding, departing
        this.landingTimer = 0;
        this.landedTimer = 0;
        this.maxLandedTime = 15000;
        this.rotorAngle = 0;
        this.active = true;
        this.radius = 80;
        this.extractionZone = { x: x - 60, y: y - 60, w: 120, h: 120 };
        this._approachAngle = Math.random() * Math.PI * 2;
        this._approachSpeed = 200;
        this._arrived = false;
        this._dustParticles = [];
        this._boardingTimer = 0; // Track boarding time
        this._boardingDelay = 1500; // 1.5 second boarding delay
    }
    update(dt, game) {
        this.rotorAngle += dt * 25;
        // Dust particles when landed
        if (this.phase === 'landed' || this.phase === 'boarding') {
            if (Math.random() < 0.3) {
                const angle = Math.random() * Math.PI * 2;
                this._dustParticles.push({
                    x: this.x + Math.cos(angle) * 50,
                    y: this.y + Math.sin(angle) * 50,
                    vx: (Math.random() - 0.5) * 40,
                    vy: -20 - Math.random() * 30,
                    life: 800 + Math.random() * 400,
                    age: 0,
                    size: 3 + Math.random() * 4
                });
            }
        }
        // Update dust
        for (let i = this._dustParticles.length - 1; i >= 0; i--) {
            const p = this._dustParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.age += dt * 1000;
            if (p.age > p.life) this._dustParticles.splice(i, 1);
        }
        // Phase transitions
        if (this.phase === 'approaching') {
            if (!this._arrived) {
                this.x += Math.cos(this._approachAngle) * this._approachSpeed * dt;
                this.y += Math.sin(this._approachAngle) * this._approachSpeed * dt;
                // Check if close enough to target
                if (distance(this.x, this.y, this.extractionZone.x + 60, this.extractionZone.y + 60) < 100) {
                    this._arrived = true;
                    this.phase = 'landing';
                }
            }
        } else if (this.phase === 'landing') {
            this.landingTimer += dt * 1000;
            if (this.landingTimer >= 2000) {
                this.phase = 'landed';
                this.landedTimer = 0;
                // Screen message
                game.waveManager.announcementText = 'EXTRACTION READY!';
                game.waveManager.announcementTimer = 3000;
                if (game.soundManager) game.soundManager.playSound('waveComplete');
            }
        } else if (this.phase === 'landed') {
            this.landedTimer += dt * 1000;
            // Check if player is boarding
            const px = game.player.x, py = game.player.y;
            if (px >= this.extractionZone.x && px <= this.extractionZone.x + this.extractionZone.w &&
                py >= this.extractionZone.y && py <= this.extractionZone.y + this.extractionZone.h) {
                this.phase = 'boarding';
                // Slow player movement while boarding
                game.player._inExtractionZone = true;
            }
            // Auto-depart if timer runs out
            if (this.landedTimer >= this.maxLandedTime) {
                this.phase = 'departing';
                game.player._inExtractionZone = false;
            }
        } else if (this.phase === 'boarding') {
            // Player is boarding - wait before departing
            this._boardingTimer += dt * 1000;
            // Move player to helicopter center during boarding
            game.player.x = this.x;
            game.player.y = this.y;
            // Transition to departing after delay
            if (this._boardingTimer >= this._boardingDelay) {
                this.phase = 'departing';
                game.player._inExtractionZone = false;
            }
        } else if (this.phase === 'departing') {
            // Player is carried in helicopter - move player with it
            game.player.x = this.x;
            game.player.y = this.y;
            this.y -= 150 * dt;
            if (this.y < -200) {
                this.active = false;
                if (game) game._onMissionComplete();
            }
        }
    }
    render(ctx, cameraOffset, quality) {
        const sx = this.x - cameraOffset.x;
        const sy = this.y - cameraOffset.y;
        const sw = ctx.canvas.width, sh = ctx.canvas.height;
        if (sx < -200 || sx > sw + 200 || sy < -200 || sy > sh + 200) return;
        // Draw extraction zone when landed
        if (this.phase === 'landed' || this.phase === 'boarding') {
            const zx = this.extractionZone.x - cameraOffset.x;
            const zy = this.extractionZone.y - cameraOffset.y;
            const pulse = 0.5 + Math.sin(performance.now() * 0.005) * 0.3;
            ctx.strokeStyle = `rgba(0,255,100,${pulse * 0.8})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 4]);
            ctx.strokeRect(zx, zy, this.extractionZone.w, this.extractionZone.h);
            ctx.setLineDash([]);
            ctx.fillStyle = `rgba(0,255,100,${pulse * 0.1})`;
            ctx.fillRect(zx, zy, this.extractionZone.w, this.extractionZone.h);
            // Text
            ctx.font = 'bold 14px "Courier New", monospace';
            ctx.fillStyle = `rgba(0,255,100,${pulse})`;
            ctx.textAlign = 'center';
            if (this.phase === 'landed') {
                ctx.fillText('BOARD HELICOPTER', sx, sy - 70);
                // Countdown timer
                const remaining = Math.max(0, Math.ceil((this.maxLandedTime - this.landedTimer) / 1000));
                ctx.font = 'bold 18px "Courier New", monospace';
                ctx.fillStyle = remaining <= 5 ? '#FF4444' : '#FFD700';
                ctx.fillText(`${remaining}s`, sx, sy - 50);
            } else if (this.phase === 'boarding') {
                ctx.fillStyle = '#FFD700';
                ctx.fillText('BOARDING...', sx, sy - 70);
            }
        }
        // Dust particles
        for (const p of this._dustParticles) {
            const psx = p.x - cameraOffset.x;
            const psy = p.y - cameraOffset.y;
            const alpha = (1 - p.age / p.life) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#886644';
            ctx.beginPath();
            ctx.arc(psx, psy, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Helicopter body
        ctx.save();
        ctx.translate(sx, sy);
        // Shadow
        if (this.phase !== 'approaching') {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(3, 8, 40, 15, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Main body
        ctx.fillStyle = '#2A3A2A';
        ctx.beginPath();
        ctx.ellipse(0, 0, 35, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        // Cockpit window
        ctx.fillStyle = 'rgba(100,180,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(15, 0, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.fillStyle = '#2A3A2A';
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(-55, -5);
        ctx.lineTo(-55, 5);
        ctx.closePath();
        ctx.fill();
        // Tail rotor
        ctx.fillStyle = 'rgba(100,150,100,0.7)';
        ctx.save();
        ctx.translate(-55, 0);
        ctx.rotate(this.rotorAngle * 3);
        ctx.fillRect(-2, -12, 4, 24);
        ctx.restore();
        // Main rotor
        ctx.fillStyle = 'rgba(80,100,80,0.6)';
        ctx.save();
        ctx.rotate(this.rotorAngle);
        ctx.fillRect(-50, -3, 100, 6);
        ctx.fillRect(-3, -50, 6, 100);
        ctx.restore();
        // Rotor mast
        ctx.fillStyle = '#444';
        ctx.fillRect(-3, -20, 6, 10);
        // Skids
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-25, 15);
        ctx.lineTo(-25, 25);
        ctx.lineTo(25, 25);
        ctx.lineTo(25, 15);
        ctx.stroke();
        // Army star marking
        ctx.fillStyle = '#556B2F';
        ctx.beginPath();
        ctx.arc(0, 5, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Approach indicator
        if (this.phase === 'approaching' && !this._arrived) {
            ctx.save();
            const pulse = 0.5 + Math.sin(performance.now() * 0.008) * 0.3;
            ctx.globalAlpha = pulse;
            ctx.font = 'bold 14px "Courier New", monospace';
            ctx.fillStyle = '#00FFCC';
            ctx.textAlign = 'center';
            ctx.fillText('HELICOPTER INCOMING', sx, sy - 50);
            // Direction arrow pointing to extraction
            const targetX = this.extractionZone.x + 60 - cameraOffset.x;
            const targetY = this.extractionZone.y + 60 - cameraOffset.y;
            const arrowDist = 80;
            const arrowAngle = Math.atan2(targetY - sy, targetX - sx);
            ctx.strokeStyle = '#00FFCC';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy - 30);
            ctx.lineTo(sx + Math.cos(arrowAngle) * arrowDist, sy - 30 + Math.sin(arrowAngle) * arrowDist);
            ctx.stroke();
            // Arrow head
            ctx.fillStyle = '#00FFCC';
            ctx.save();
            ctx.translate(sx + Math.cos(arrowAngle) * arrowDist, sy - 30 + Math.sin(arrowAngle) * arrowDist);
            ctx.rotate(arrowAngle);
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(-4, -5);
            ctx.lineTo(-4, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.restore();
        }
    }
    isPlayerInZone(player) {
        return player.x >= this.extractionZone.x &&
               player.x <= this.extractionZone.x + this.extractionZone.w &&
               player.y >= this.extractionZone.y &&
               player.y <= this.extractionZone.y + this.extractionZone.h;
    }
}

// ============================================================
// GAMEPLAY EVENTS - Random events and mini-objectives
// ============================================================
class GameplayEvents {
    constructor() {
        this.activeEvent = null;
        this.eventTimer = 0;
        this.nextEventIn = 20000 + Math.random() * 25000;
        this.objective = null;
        this.objectiveTimer = 0;
        this.waveModifiers = [];
        this._eventHistory = [];
        this._eventCount = 0;
    }

    reset() {
        this.activeEvent = null;
        this.eventTimer = 0;
        this.nextEventIn = 20000 + Math.random() * 25000;
        this.objective = null;
        this.objectiveTimer = 0;
        this.waveModifiers = [];
        this._eventHistory = [];
        this._eventCount = 0;
    }

    update(dt, game) {
        if (!game || game.gameState.state !== 'playing') return;
        this.eventTimer += dt * 1000;
        if (this.objective) this.objectiveTimer -= dt * 1000;
        if (this.objective && this.objectiveTimer > 0) this._checkObjective(game);
        if (this.objective && this.objectiveTimer <= 0) {
            if (!this.objective.completed) game.killFeed.add('Objective Failed');
            this.objective = null;
        }
        // Events start from wave 1, get more frequent over time
        const minWave = 1;
        const cooldown = Math.max(15000, 35000 - this._eventCount * 1500);
        if (!this.activeEvent && this.eventTimer >= this.nextEventIn && game.waveManager.wave >= minWave) {
            this._triggerRandomEvent(game);
        }
        if (this.activeEvent) {
            this.activeEvent.timer -= dt * 1000;
            this._updateEvent(dt, game);
            if (this.activeEvent.timer <= 0) this._endEvent(game);
        }
    }

    _updateEvent(dt, game) {
        if (!this.activeEvent || !game.player.alive) return;
        const ev = this.activeEvent;
        switch (ev.type) {
            case 'toxic_cloud':
                ev.cloudX += (ev.cloudDriftX || 0) * dt;
                ev.cloudY += (ev.cloudDriftY || 0) * dt;
                { const dx = game.player.x - ev.cloudX, dy = game.player.y - ev.cloudY;
                if (dx * dx + dy * dy < (ev.cloudRadius || 150) ** 2 && !game.godMode) game.player.takeDamage(4 * dt); }
                break;
            case 'lava_geyser':
                ev.geyserTimer -= dt * 1000;
                if (ev.geyserTimer <= 0) {
                    ev.geyserTimer = 2000 + Math.random() * 2000;
                    const gx = game.player.x + (Math.random() - 0.5) * 500;
                    const gy = game.player.y + (Math.random() - 0.5) * 500;
                    ev.geysers.push({ x: gx, y: gy, age: 0, maxAge: 3000 });
                }
                for (const g of ev.geysers) {
                    g.age += dt * 1000;
                    if (g.age > 500 && g.age < 1500) {
                        const dx = game.player.x - g.x, dy = game.player.y - g.y;
                        if (dx * dx + dy * dy < 2500 && !game.godMode) game.player.takeDamage(15 * dt);
                    }
                }
                ev.geysers = ev.geysers.filter(g => g.age < g.maxAge);
                break;
            case 'gravity_well':
                { const dx = ev.wellX - game.player.x, dy = ev.wellY - game.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < ev.wellRadius && dist > 10) {
                    const pull = ev.wellStrength * (1 - dist / ev.wellRadius) * dt;
                    game.player.x += (dx / dist) * pull;
                    game.player.y += (dy / dist) * pull;
                } }
                break;
            case 'shield_bubble':
                // Player gets damage reduction (handled in player.takeDamage)
                break;
            case 'airstrike':
                ev.strikeTimer -= dt * 1000;
                if (ev.strikeTimer <= 0) {
                    ev.strikeTimer = 1200 + Math.random() * 800;
                    const sx = game.player.x + (Math.random() - 0.5) * 500;
                    const sy = game.player.y + (Math.random() - 0.5) * 500;
                    ev.strikes = ev.strikes || [];
                    ev.strikes.push({ x: sx, y: sy, age: 0, maxAge: 2000, radius: 60 });
                    setTimeout(() => {
                        if (!game || !game.player.alive) return;
                        const d = distance(game.player.x, game.player.y, sx, sy);
                        if (d < 60 && !game.godMode) game.player.takeDamage(25);
                        game.createExplosion(sx, sy, 60, 15, null);
                    }, 1200);
                }
                break;
            case 'emp_zone':
                { const dx = game.player.x - ev.empX, dy = game.player.y - ev.empY;
                if (dx * dx + dy * dy < (ev.empRadius || 200) ** 2) {
                    if (!ev._empApplied) { game.killFeed.add('EMP: Movement slowed'); ev._empApplied = true; }
                } }
                break;
            case 'minefield':
                for (const m of ev.mines) {
                    if (m.exploded) continue;
                    const dx = game.player.x - m.x, dy = game.player.y - m.y;
                    if (dx * dx + dy * dy < 900) { // 30 radius
                        m.exploded = true;
                        game.createExplosion(m.x, m.y, 80, 40, null);
                    }
                }
                break;
            case 'healing_aura':
                if (ev.healTimer === undefined) ev.healTimer = 0;
                ev.healTimer += dt * 1000;
                if (ev.healTimer >= 1000) {
                    ev.healTimer = 0;
                    game.player.heal(3);
                }
                break;
            case 'double_score':
                // Handled in score manager
                break;
            case 'bullet_time':
                // Slow enemies
                for (const e of game.enemies) {
                    if (e.active && !e.isDying && !e._bulletTimeApplied) {
                        e.speed *= 0.5;
                        e._bulletTimeApplied = true;
                    }
                }
                break;
            case 'chain_lightning':
                ev.lightningTimer -= dt * 1000;
                if (ev.lightningTimer <= 0) {
                    ev.lightningTimer = 1500;
                    // Strike nearest enemy
                    let nearest = null, nearestDist = 300;
                    for (const e of game.enemies) {
                        if (!e.active || e.isDying) continue;
                        const d = distance(game.player.x, game.player.y, e.x, e.y);
                        if (d < nearestDist) { nearestDist = d; nearest = e; }
                    }
                    if (nearest) {
                        nearest.takeDamage(25, game);
                        ev.lightningTarget = { x: nearest.x, y: nearest.y, age: 0 };
                    }
                }
                if (ev.lightningTarget) ev.lightningTarget.age += dt * 1000;
                break;
            case 'enemy_freeze':
                // Enemies are frozen (handled in _triggerRandomEvent)
                break;
            case 'berserker':
                // No reload needed (handled in player shoot logic)
                break;
            case 'fire_trail':
                // Leave fire behind player
                if (!ev._fireTimer) ev._fireTimer = 0;
                ev._fireTimer += dt * 1000;
                if (ev._fireTimer >= 200) {
                    ev._fireTimer = 0;
                    game.effects.push({
                        x: game.player.x, y: game.player.y, age: 0, maxAge: 3000, active: true, radius: 20,
                        update(dt) { this.age += dt * 1000; if (this.age > this.maxAge) this.active = false; },
                        render(ctx, cam) {
                            const sx = this.x - cam.x, sy = this.y - cam.y;
                            const a = Math.max(0, 1 - this.age / this.maxAge);
                            ctx.fillStyle = `rgba(255,100,0,${a * 0.4})`;
                            ctx.beginPath(); ctx.arc(sx, sy, this.radius * (1 - a * 0.5), 0, Math.PI * 2); ctx.fill();
                        }
                    });
                    // Damage enemies near fire
                    for (const e of game.enemies) {
                        if (!e.active || e.isDying) continue;
                        if (distanceSq(game.player.x, game.player.y, e.x, e.y) < 900) {
                            e.takeDamage(5 * dt, game);
                        }
                    }
                }
                break;
            case 'shockwave':
                if (!ev._pulseTimer) ev._pulseTimer = 0;
                ev._pulseTimer += dt * 1000;
                if (ev._pulseTimer >= 2000) {
                    ev._pulseTimer = 0;
                    // Push all enemies away
                    for (const e of game.enemies) {
                        if (!e.active || e.isDying) continue;
                        const dx = e.x - game.player.x, dy = e.y - game.player.y;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d < 300 && d > 0) {
                            const push = 200 * (1 - d / 300);
                            e.x += (dx / d) * push;
                            e.y += (dy / d) * push;
                            e.takeDamage(10, game);
                        }
                    }
                    // Visual pulse
                    game.effects.push({
                        x: game.player.x, y: game.player.y, age: 0, maxAge: 500, active: true,
                        update(dt) { this.age += dt * 1000; if (this.age > this.maxAge) this.active = false; },
                        render(ctx, cam) {
                            const sx = this.x - cam.x, sy = this.y - cam.y;
                            const pr = this.age / this.maxAge;
                            const r = 300 * pr;
                            const a = 1 - pr;
                            ctx.strokeStyle = `rgba(100,200,255,${a})`; ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
                        }
                    });
                }
                break;
            case 'loot_goblin':
                // Spawn a fast-moving loot enemy
                if (!ev._goblinSpawned) {
                    ev._goblinSpawned = true;
                    const angle = Math.random() * Math.PI * 2;
                    const gx = game.player.x + Math.cos(angle) * 400;
                    const gy = game.player.y + Math.sin(angle) * 400;
                    const goblin = new EnemyRusher(
                        clamp(gx, 100, CONFIG.world.width - 100),
                        clamp(gy, 100, CONFIG.world.height - 100), 0.5, 0
                    );
                    goblin.speed = 400; goblin.score = 500; goblin.hp = 30; goblin.maxHp = 30;
                    goblin.type = 'goblin'; goblin._gameRef = game;
                    game.enemies.push(goblin);
                }
                break;
            case 'mini_boss':
                if (!ev._miniBossSpawned) {
                    ev._miniBossSpawned = true;
                    const angle = Math.random() * Math.PI * 2;
                    const bx = game.player.x + Math.cos(angle) * 500;
                    const by = game.player.y + Math.sin(angle) * 500;
                    const boss = new EnemyHeavy(
                        clamp(bx, 100, CONFIG.world.width - 100),
                        clamp(by, 100, CONFIG.world.height - 100), 2, 1.5
                    );
                    boss._gameRef = game; boss.score = 400;
                    game.enemies.push(boss);
                }
                break;
            case 'vampire_aura':
                // Heal on enemy damage
                if (!ev._vampApplied) {
                    ev._vampApplied = true;
                    this._origOnEnemyKilled = game.onEnemyKilled;
                }
                break;
            case 'phase_walk':
                // Player ignores collisions (handled in player update)
                break;
        }
    }

    _triggerRandomEvent(game) {
        const events = [
            { type: 'supply_drop', name: 'SUPPLY DROP INCOMING', duration: 15000 },
            { type: 'emp_zone', name: 'EMP ZONE DETECTED', duration: 12000 },
            { type: 'airstrike', name: 'AIRSTRIKE INBOUND', duration: 10000 },
            { type: 'enemy_surge', name: 'ENEMY SURGE DETECTED', duration: 10000 },
            { type: 'speed_zone', name: 'SPEED BOOST ACTIVE', duration: 15000 },
            { type: 'toxic_cloud', name: 'TOXIC CLOUD DRIFTING IN', duration: 14000 },
            { type: 'lava_geyser', name: 'VOLCANIC ACTIVITY DETECTED', duration: 16000 },
            { type: 'gravity_well', name: 'GRAVITY ANOMALY', duration: 12000 },
            { type: 'shield_bubble', name: 'SHIELD BUBBLE ACTIVE', duration: 10000 },
            { type: 'minefield', name: 'MINEFIELD DEPLOYED', duration: 20000 },
            { type: 'healing_aura', name: 'HEALING ZONE ACTIVE', duration: 12000 },
            { type: 'double_score', name: 'DOUBLE SCORE ACTIVE', duration: 15000 },
            { type: 'bullet_time', name: 'BULLET TIME', duration: 8000 },
            { type: 'chain_lightning', name: 'CHAIN LIGHTNING ONLINE', duration: 12000 },
            { type: 'rage_mode', name: 'RAGE MODE — DAMAGE x2', duration: 8000 },
            { type: 'mirror_enemies', name: 'MIRROR IMAGE CONFUSION', duration: 10000 },
            // New events
            { type: 'medic_drop', name: 'MEDIC AIRLIFT INBOUND', duration: 8000 },
            { type: 'ammo_rain', name: 'AMMO RAIN', duration: 12000 },
            { type: 'enemy_freeze', name: 'CRYO BLAST — ENEMIES FROZEN', duration: 6000 },
            { type: 'berserker', name: 'BERSERKER MODE — NO RELOAD', duration: 10000 },
            { type: 'radar_ping', name: 'RADAR PING — ALL ENEMIES VISIBLE', duration: 15000 },
            { type: 'fire_trail', name: 'NAPALM TRAIL', duration: 12000 },
            { type: 'shockwave', name: 'SHOCKWAVE PULSE', duration: 8000 },
            { type: 'loot_goblin', name: 'LOOT GOBLIN SPOTTED', duration: 15000 },
            { type: 'mini_boss', name: 'MINI-BOS INCOMING', duration: 20000 },
            { type: 'double_pickups', name: 'DOUBLE PICKUPS', duration: 18000 },
            { type: 'vampire_aura', name: 'VAMPIRE AURA — LIFESTEAL', duration: 12000 },
            { type: 'turret_drone', name: 'TURRET DRONE DEPLOYED', duration: 15000 },
            { type: 'gravity_flip', name: 'GRAVITY SHIFT', duration: 8000 },
            { type: 'phase_walk', name: 'PHASE WALK — NO CLIP', duration: 6000 },
        ];

        const available = events.filter(e => !this._eventHistory.includes(e.type));
        const event = available[Math.floor(Math.random() * available.length)] || events[0];
        this.activeEvent = { ...event, timer: event.duration };
        this._eventHistory.push(event.type);
        if (this._eventHistory.length > 4) this._eventHistory.shift();
        this.eventTimer = 0;
        this._eventCount++;
        this.nextEventIn = Math.max(12000, 30000 - this._eventCount * 1000) + Math.random() * 15000;

        game.waveManager.announcementText = event.name;
        game.waveManager.announcementTimer = 2500;
        game.soundManager.playSound('waveStart');

        switch (event.type) {
            case 'supply_drop': this._spawnSupplyDrop(game); break;
            case 'emp_zone': this._spawnEMPZone(game); break;
            case 'airstrike': this.activeEvent.strikes = []; this.activeEvent.strikeTimer = 0; break;
            case 'enemy_surge': this._spawnEnemySurge(game); break;
            case 'speed_zone': this.activeEvent.speedBoost = true; break;
            case 'toxic_cloud': this._spawnToxicCloud(game); break;
            case 'lava_geyser': this.activeEvent.geysers = []; this.activeEvent.geyserTimer = 0; break;
            case 'gravity_well':
                this.activeEvent.wellX = game.player.x + (Math.random() - 0.5) * 400;
                this.activeEvent.wellY = game.player.y + (Math.random() - 0.5) * 400;
                this.activeEvent.wellRadius = 200;
                this.activeEvent.wellStrength = 150;
                break;
            case 'shield_bubble': this.activeEvent.shieldActive = true; break;
            case 'minefield': this._spawnMinefield(game); break;
            case 'healing_aura': break;
            case 'double_score': break;
            case 'bullet_time': break;
            case 'chain_lightning': this.activeEvent.lightningTimer = 0; break;
            case 'rage_mode': break;
            case 'mirror_enemies': break;
            case 'medic_drop':
                game.player.heal(30);
                game.effects.push(new Particle(game.player.x, game.player.y, 0, -50, 800, 6, '#00FF88'));
                break;
            case 'ammo_rain':
                for (let i = 0; i < 5; i++) {
                    const ax = game.player.x + (Math.random() - 0.5) * 400;
                    const ay = game.player.y + (Math.random() - 0.5) * 400;
                    game.pickups.push(new Pickup(ax, ay, 'ammo'));
                }
                break;
            case 'enemy_freeze':
                for (const e of game.enemies) {
                    if (e.active && !e.isDying) {
                        e._origSpeed = e._origSpeed || e.speed;
                        e.speed = 0;
                    }
                }
                break;
            case 'berserker': break; // Handled in player shoot logic
            case 'radar_ping': break; // Visual only, enemies always visible during this
            case 'fire_trail': break;
            case 'shockwave': this.activeEvent._pulseTimer = 0; break;
            case 'loot_goblin': break;
            case 'mini_boss': break;
            case 'double_pickups':
                // Double pickup drops (handled in onEnemyKilled)
                break;
            case 'vampire_aura': break;
            case 'turret_drone':
                // Spawn a temporary attack drone
                if (game.drones.length < 3) {
                    const droneConfig = CONFIG.shop.drones.find(d => d.id === 'drone_attack');
                    if (droneConfig) {
                        const tempDrone = new PlayerDrone({ ...droneConfig, id: 'temp_drone' }, game.player);
                        game.drones.push(tempDrone);
                        this.activeEvent._tempDrone = tempDrone;
                    }
                }
                break;
            case 'gravity_flip': break;
            case 'phase_walk': break;
        }
        if (Math.random() < 0.5) this._spawnObjective(game);
    }

    _endEvent(game) {
        if (!this.activeEvent) return;
        const ev = this.activeEvent;
        // Clean up bullet time
        if (ev.type === 'bullet_time') {
            for (const e of game.enemies) {
                if (e._bulletTimeApplied) { e.speed *= 2; e._bulletTimeApplied = false; }
            }
        }
        // Clean up enemy freeze
        if (ev.type === 'enemy_freeze') {
            for (const e of game.enemies) {
                if (e._origSpeed !== undefined) { e.speed = e._origSpeed; delete e._origSpeed; }
            }
        }
        // Clean up turret drone
        if (ev.type === 'turret_drone' && ev._tempDrone) {
            ev._tempDrone.active = false;
            ev._tempDrone.hp = 0;
        }
        // Clean up vampire aura
        if (ev.type === 'vampire_aura' && this._origOnEnemyKilled) {
            game.onEnemyKilled = this._origOnEnemyKilled;
        }
        this.activeEvent = null;
    }

    _spawnSupplyDrop(game) {
        const x = clamp(game.player.x + (Math.random() - 0.5) * 600, 200, CONFIG.world.width - 200);
        const y = clamp(game.player.y + (Math.random() - 0.5) * 600, 200, CONFIG.world.height - 200);
        game.pickups.push(new Pickup(x - 20, y, 'health'));
        game.pickups.push(new Pickup(x + 20, y, 'ammo'));
        game.pickups.push(new Pickup(x, y - 20, 'stamina'));
        game.effects.push({
            x, y, age: 0, maxAge: 12000, active: true,
            update(dt) { this.age += dt * 1000; if (this.age > this.maxAge) this.active = false; },
            render(ctx, cam) {
                const sx = this.x - cam.x, sy = this.y - cam.y;
                const p = 0.5 + Math.sin(this.age * 0.005) * 0.5;
                ctx.strokeStyle = `rgba(0,255,100,${p * 0.6})`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, 30 + p * 10, 0, Math.PI * 2); ctx.stroke();
                ctx.font = 'bold 11px monospace'; ctx.fillStyle = '#00FF64'; ctx.textAlign = 'center';
                ctx.fillText('SUPPLY DROP', sx, sy - 35);
            }
        });
    }

    _spawnEMPZone(game) {
        this.activeEvent.empX = clamp(game.player.x + (Math.random() - 0.5) * 400, 200, CONFIG.world.width - 200);
        this.activeEvent.empY = clamp(game.player.y + (Math.random() - 0.5) * 400, 200, CONFIG.world.height - 200);
        this.activeEvent.empRadius = 200;
    }

    _spawnEnemySurge(game) {
        const count = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 400 + Math.random() * 200;
            const x = clamp(game.player.x + Math.cos(angle) * dist, 100, CONFIG.world.width - 100);
            const y = clamp(game.player.y + Math.sin(angle) * dist, 100, CONFIG.world.height - 100);
            const hpMult = 1 + (game.waveManager.wave - 1) * 0.04;
            const dmgMult = 1 + (game.waveManager.wave - 1) * 0.02;
            const types = ['grunt', 'rusher', 'flanker'];
            const type = types[Math.floor(Math.random() * types.length)];
            let enemy;
            switch (type) {
                case 'grunt': enemy = new EnemyGrunt(x, y, hpMult, dmgMult); break;
                case 'rusher': enemy = new EnemyRusher(x, y, hpMult, dmgMult); break;
                case 'flanker': enemy = new EnemyFlanker(x, y, hpMult, dmgMult); break;
            }
            if (enemy) { enemy._gameRef = game; game.enemies.push(enemy); }
        }
    }

    _spawnToxicCloud(game) {
        this.activeEvent.cloudX = clamp(game.player.x + (Math.random() - 0.5) * 500, 200, CONFIG.world.width - 200);
        this.activeEvent.cloudY = clamp(game.player.y + (Math.random() - 0.5) * 500, 200, CONFIG.world.height - 200);
        this.activeEvent.cloudRadius = 150;
        this.activeEvent.cloudDriftX = (Math.random() - 0.5) * 40;
        this.activeEvent.cloudDriftY = (Math.random() - 0.5) * 40;
    }

    _spawnMinefield(game) {
        this.activeEvent.mines = [];
        const count = 8 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i++) {
            this.activeEvent.mines.push({
                x: game.player.x + (Math.random() - 0.5) * 600,
                y: game.player.y + (Math.random() - 0.5) * 600,
                exploded: false
            });
        }
    }

    _spawnObjective(game) {
        const objectives = [
            { type: 'kill_streak', desc: 'Kill 5 enemies in 10 seconds', target: 5, time: 10000, reward: 200 },
            { type: 'kill_streak', desc: 'Kill 8 enemies in 12 seconds', target: 8, time: 12000, reward: 350 },
            { type: 'no_damage', desc: 'Survive 15s without taking damage', target: 15, time: 15000, reward: 300 },
            { type: 'no_damage', desc: 'Survive 20s unscathed', target: 20, time: 20000, reward: 500 },
            { type: 'kill_specific', desc: `Kill 3 enemies with ${game.player.weapon.name}`, target: 3, time: 12000, reward: 250 },
            { type: 'collect_pickups', desc: 'Collect 3 pickups', target: 3, time: 20000, reward: 150 },
            { type: 'kill_streak', desc: 'Kill 10 enemies in 15 seconds', target: 10, time: 15000, reward: 500 },
            { type: 'survive', desc: 'Survive for 30 seconds', target: 30, time: 30000, reward: 400 },
        ];
        const obj = objectives[Math.floor(Math.random() * objectives.length)];
        this.objective = { ...obj, progress: 0, completed: false, startKills: game.scoreManager.kills };
        this.objectiveTimer = obj.time;
        game.killFeed.add(`Objective: ${obj.desc}`);
    }

    _checkObjective(game) {
        if (!this.objective || this.objective.completed) return;
        switch (this.objective.type) {
            case 'kill_streak':
            case 'kill_specific':
                this.objective.progress = game.scoreManager.kills - this.objective.startKills;
                break;
            case 'no_damage':
                if (game.player.hitFlash > 0 && game.player._lastHitCheck !== game.player.hitFlash) {
                    this.objective.progress = 0; game.player._lastHitCheck = game.player.hitFlash;
                } else {
                    this.objective.progress = Math.floor((this.objective.time - this.objectiveTimer) / 1000);
                }
                break;
            case 'survive':
                this.objective.progress = Math.floor((this.objective.time - this.objectiveTimer) / 1000);
                break;
        }
        if (this.objective.progress >= this.objective.target && !this.objective.completed) {
            this.objective.completed = true;
            game.scoreManager.addScore(this.objective.reward);
            game.persistence.data.coins += Math.floor(this.objective.reward / 2);
            game.killFeed.add(`Objective Complete! +${this.objective.reward}`);
            game.soundManager.playSound('waveComplete');
        }
    }

    onPickupCollected() {
        if (this.objective && this.objective.type === 'collect_pickups' && !this.objective.completed) this.objective.progress++;
    }

    getScoreMultiplier() {
        return (this.activeEvent && this.activeEvent.type === 'double_score') ? 2 : 1;
    }
    getSpeedMultiplier() {
        return (this.activeEvent && this.activeEvent.speedBoost) ? 1.4 : 1.0;
    }
    getDamageMultiplier() {
        return (this.activeEvent && this.activeEvent.type === 'rage_mode') ? 2 : 1;
    }
    hasShield() {
        return this.activeEvent && this.activeEvent.type === 'shield_bubble';
    }

    render(ctx, game) {
        if (!game || game.gameState.state !== 'playing') return;
        const cam = game.camera.getOffset();
        const sw = game.screenWidth, sh = game.screenHeight;
        if (this.activeEvent) {
            switch (this.activeEvent.type) {
                case 'emp_zone': this._renderEMPZone(ctx, cam); break;
                case 'airstrike': this._renderAirstrike(ctx, cam); break;
                case 'speed_zone': this._renderSpeedZone(ctx, cam, game); break;
                case 'toxic_cloud': this._renderToxicCloud(ctx, cam); break;
                case 'lava_geyser': this._renderLavaGeysers(ctx, cam); break;
                case 'gravity_well': this._renderGravityWell(ctx, cam); break;
                case 'shield_bubble': this._renderShieldBubble(ctx, cam, game); break;
                case 'minefield': this._renderMinefield(ctx, cam); break;
                case 'healing_aura': this._renderHealingAura(ctx, cam, game); break;
                case 'double_score': this._renderDoubleScore(ctx, cam, game); break;
                case 'bullet_time': this._renderBulletTime(ctx, cam, game); break;
                case 'chain_lightning': this._renderChainLightning(ctx, cam, game); break;
                case 'rage_mode': this._renderRageMode(ctx, cam, game); break;
                case 'enemy_freeze': this._renderEnemyFreeze(ctx, cam, game); break;
                case 'berserker': this._renderBerserker(ctx, cam, game); break;
                case 'radar_ping': this._renderRadarPing(ctx, cam, game); break;
                case 'fire_trail': this._renderFireTrail(ctx, cam, game); break;
                case 'shockwave': this._renderShockwave(ctx, cam, game); break;
                case 'vampire_aura': this._renderVampireAura(ctx, cam, game); break;
                case 'phase_walk': this._renderPhaseWalk(ctx, cam, game); break;
                case 'gravity_flip': this._renderGravityFlip(ctx, cam, game); break;
            }
        }
        if (this.objective && this.objectiveTimer > 0) this._renderObjective(ctx, sw, sh);
    }

    _renderEMPZone(ctx, cam) {
        if (!this.activeEvent) return;
        const sx = this.activeEvent.empX - cam.x, sy = this.activeEvent.empY - cam.y;
        const p = 0.3 + Math.sin(performance.now() * 0.005) * 0.2;
        ctx.strokeStyle = `rgba(0,100,255,${p})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, this.activeEvent.empRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(0,100,255,${p * 0.15})`;
        ctx.beginPath(); ctx.arc(sx, sy, this.activeEvent.empRadius, 0, Math.PI * 2); ctx.fill();
        ctx.font = '10px monospace'; ctx.fillStyle = `rgba(0,150,255,${p})`; ctx.textAlign = 'center';
        ctx.fillText('EMP ZONE', sx, sy - this.activeEvent.empRadius - 8);
    }

    _renderSpeedZone(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.2 + Math.sin(performance.now() * 0.008) * 0.15;
        ctx.strokeStyle = `rgba(0,255,200,${p})`; ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(px, py, 40, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '9px monospace'; ctx.fillStyle = `rgba(0,255,200,${p + 0.2})`; ctx.textAlign = 'center';
        ctx.fillText('SPEED+', px, py - 48);
    }

    _renderToxicCloud(ctx, cam) {
        if (!this.activeEvent) return;
        const sx = this.activeEvent.cloudX - cam.x, sy = this.activeEvent.cloudY - cam.y;
        const r = this.activeEvent.cloudRadius;
        const p = 0.3 + Math.sin(performance.now() * 0.003) * 0.1;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        grad.addColorStop(0, `rgba(100,200,0,${p * 0.3})`);
        grad.addColorStop(0.7, `rgba(80,150,0,${p * 0.15})`);
        grad.addColorStop(1, 'rgba(60,100,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.font = '10px monospace'; ctx.fillStyle = `rgba(150,255,0,${p + 0.2})`; ctx.textAlign = 'center';
        ctx.fillText('TOXIC', sx, sy - r - 8);
    }

    _renderAirstrike(ctx, cam) {
        if (!this.activeEvent || !this.activeEvent.strikes) return;
        for (let i = this.activeEvent.strikes.length - 1; i >= 0; i--) {
            const s = this.activeEvent.strikes[i];
            s.age = (s.age || 0) + 16;
            if (s.age > s.maxAge) { this.activeEvent.strikes.splice(i, 1); continue; }
            const sx = s.x - cam.x, sy = s.y - cam.y;
            const pr = Math.min(1, s.age / (s.maxAge || 2000));
            if (pr < 0.5) {
                const p = 0.5 + Math.sin(s.age * 0.01) * 0.3;
                ctx.strokeStyle = `rgba(255,0,0,${p})`; ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(sx, sy, (s.radius || 60) * (0.5 + pr), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
                ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#FF0000'; ctx.textAlign = 'center';
                ctx.fillText('!', sx, sy + 4);
            }
        }
    }

    _renderLavaGeysers(ctx, cam) {
        if (!this.activeEvent || !this.activeEvent.geysers) return;
        for (const g of this.activeEvent.geysers) {
            const sx = g.x - cam.x, sy = g.y - cam.y;
            const pr = g.age / g.maxAge;
            if (pr < 0.3) {
                const p = 0.5 + Math.sin(g.age * 0.01) * 0.3;
                ctx.strokeStyle = `rgba(255,100,0,${p})`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(sx, sy, 20 * (pr / 0.3), 0, Math.PI * 2); ctx.stroke();
            } else if (pr < 0.6) {
                const alpha = 1 - (pr - 0.3) / 0.3;
                ctx.fillStyle = `rgba(255,80,0,${alpha * 0.5})`;
                ctx.beginPath(); ctx.arc(sx, sy, 25, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(255,200,0,${alpha * 0.3})`;
                ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    _renderGravityWell(ctx, cam) {
        if (!this.activeEvent) return;
        const sx = this.activeEvent.wellX - cam.x, sy = this.activeEvent.wellY - cam.y;
        const r = this.activeEvent.wellRadius;
        const t = performance.now() * 0.002;
        ctx.strokeStyle = `rgba(150,0,255,${0.3 + Math.sin(t) * 0.15})`; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            const rr = r * (0.3 + i * 0.3);
            ctx.beginPath(); ctx.arc(sx, sy, rr, t + i, t + i + Math.PI * 1.5); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(150,0,255,0.15)';
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(200,100,255,0.6)'; ctx.textAlign = 'center';
        ctx.fillText('GRAVITY', sx, sy - r - 8);
    }

    _renderShieldBubble(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.2 + Math.sin(performance.now() * 0.006) * 0.1;
        ctx.strokeStyle = `rgba(0,150,255,${p + 0.2})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(0,150,255,${p * 0.1})`;
        ctx.beginPath(); ctx.arc(px, py, 50, 0, Math.PI * 2); ctx.fill();
    }

    _renderMinefield(ctx, cam) {
        if (!this.activeEvent || !this.activeEvent.mines) return;
        for (const m of this.activeEvent.mines) {
            if (m.exploded) continue;
            const sx = m.x - cam.x, sy = m.y - cam.y;
            const p = 0.4 + Math.sin(performance.now() * 0.005 + m.x) * 0.2;
            ctx.fillStyle = `rgba(255,50,0,${p})`;
            ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(255,50,0,${p * 0.5})`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.stroke();
        }
    }

    _renderHealingAura(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.2 + Math.sin(performance.now() * 0.004) * 0.15;
        ctx.strokeStyle = `rgba(0,255,100,${p + 0.1})`; ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(px, py, 60, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '9px monospace'; ctx.fillStyle = `rgba(0,255,100,${p + 0.2})`; ctx.textAlign = 'center';
        ctx.fillText('HEAL+', px, py - 68);
    }

    _renderDoubleScore(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.3 + Math.sin(performance.now() * 0.01) * 0.2;
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = `rgba(255,215,0,${p + 0.3})`; ctx.textAlign = 'center';
        ctx.fillText('x2 SCORE', px, py - 55);
    }

    _renderBulletTime(ctx, cam, game) {
        // Vignette effect
        const sw = game.screenWidth, sh = game.screenHeight;
        const grad = ctx.createRadialGradient(sw/2, sh/2, sw*0.3, sw/2, sh/2, sw*0.7);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,50,0.2)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, sw, sh);
    }

    _renderChainLightning(ctx, cam, game) {
        if (!this.activeEvent || !this.activeEvent.lightningTarget) return;
        const t = this.activeEvent.lightningTarget;
        if (t.age > 300) return;
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const tx = t.x - cam.x, ty = t.y - cam.y;
        const alpha = 1 - t.age / 300;
        ctx.strokeStyle = `rgba(100,200,255,${alpha})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px, py);
        const midX = (px + tx) / 2 + (Math.random() - 0.5) * 30;
        const midY = (py + ty) / 2 + (Math.random() - 0.5) * 30;
        ctx.lineTo(midX, midY); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.strokeStyle = `rgba(200,240,255,${alpha * 0.5})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
    }

    _renderRageMode(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.3 + Math.sin(performance.now() * 0.015) * 0.2;
        ctx.strokeStyle = `rgba(255,0,0,${p + 0.2})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 35, 0, Math.PI * 2); ctx.stroke();
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = `rgba(255,50,0,${p + 0.3})`; ctx.textAlign = 'center';
        ctx.fillText('RAGE', px, py - 45);
    }

    _renderEnemyFreeze(ctx, cam, game) {
        // Blue tint overlay
        const sw = game.screenWidth, sh = game.screenHeight;
        ctx.fillStyle = 'rgba(100,150,255,0.05)'; ctx.fillRect(0, 0, sw, sh);
        // Frozen indicator on enemies
        for (const e of game.enemies) {
            if (!e.active || e.isDying) continue;
            const sx = e.x - cam.x, sy = e.y - cam.y;
            ctx.strokeStyle = 'rgba(100,200,255,0.4)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(sx, sy, e.radius + 5, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = 'rgba(100,200,255,0.6)'; ctx.textAlign = 'center';
        ctx.fillText('FROZEN', sw / 2, sh - 60);
    }

    _renderBerserker(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.3 + Math.sin(performance.now() * 0.012) * 0.2;
        ctx.strokeStyle = `rgba(255,100,0,${p + 0.2})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 30, 0, Math.PI * 2); ctx.stroke();
        ctx.font = 'bold 9px monospace'; ctx.fillStyle = `rgba(255,150,0,${p + 0.3})`; ctx.textAlign = 'center';
        ctx.fillText('NO RELOAD', px, py - 40);
    }

    _renderRadarPing(ctx, cam, game) {
        // Show all enemies with red outlines
        for (const e of game.enemies) {
            if (!e.active || e.isDying) continue;
            const sx = e.x - cam.x, sy = e.y - cam.y;
            const p = 0.3 + Math.sin(performance.now() * 0.005 + e.x * 0.01) * 0.2;
            ctx.strokeStyle = `rgba(255,0,0,${p})`; ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(sx, sy, e.radius + 8, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
    }

    _renderFireTrail(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.3 + Math.sin(performance.now() * 0.015) * 0.2;
        ctx.font = 'bold 9px monospace'; ctx.fillStyle = `rgba(255,100,0,${p + 0.3})`; ctx.textAlign = 'center';
        ctx.fillText('NAPALM', px, py - 45);
    }

    _renderShockwave(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.2 + Math.sin(performance.now() * 0.008) * 0.15;
        ctx.strokeStyle = `rgba(100,200,255,${p})`; ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(px, py, 25, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '9px monospace'; ctx.fillStyle = `rgba(100,200,255,${p + 0.2})`; ctx.textAlign = 'center';
        ctx.fillText('PULSE', px, py - 35);
    }

    _renderVampireAura(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.2 + Math.sin(performance.now() * 0.006) * 0.15;
        ctx.strokeStyle = `rgba(200,0,0,${p + 0.1})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '9px monospace'; ctx.fillStyle = `rgba(200,0,0,${p + 0.2})`; ctx.textAlign = 'center';
        ctx.fillText('LIFESTEAL', px, py - 58);
    }

    _renderPhaseWalk(ctx, cam, game) {
        const px = game.player.x - cam.x, py = game.player.y - cam.y;
        const p = 0.2 + Math.sin(performance.now() * 0.01) * 0.15;
        ctx.strokeStyle = `rgba(200,200,255,${p + 0.2})`; ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.arc(px, py, 35, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '9px monospace'; ctx.fillStyle = `rgba(200,200,255,${p + 0.3})`; ctx.textAlign = 'center';
        ctx.fillText('PHASE', px, py - 43);
    }

    _renderGravityFlip(ctx, cam, game) {
        const sw = game.screenWidth, sh = game.screenHeight;
        const t = performance.now() * 0.002;
        // Rotating arrows
        ctx.strokeStyle = 'rgba(150,100,255,0.3)'; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const a = t + (Math.PI / 2) * i;
            const cx = sw / 2 + Math.cos(a) * 100;
            const cy = sh / 2 + Math.sin(a) * 100;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a + 1) * 20, cy + Math.sin(a + 1) * 20); ctx.stroke();
        }
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = 'rgba(150,100,255,0.5)'; ctx.textAlign = 'center';
        ctx.fillText('GRAVITY SHIFT', sw / 2, sh - 60);
    }

    _renderObjective(ctx, sw, sh) {
        if (!this.objective) return;
        const x = sw / 2, y = 45;
        const timeLeft = Math.max(0, this.objectiveTimer / 1000);
        const progress = Math.min(1, this.objective.progress / this.objective.target);
        ctx.font = '11px "Courier New", monospace';
        ctx.fillStyle = this.objective.completed ? '#00FF66' : '#FFD700';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(this.objective.desc, x, y);
        const barW = 180, barH = 3, barX = x - barW / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(barX, y + 16, barW, barH);
        ctx.fillStyle = this.objective.completed ? '#00FF66' : '#FFD700';
        ctx.fillRect(barX, y + 16, barW * progress, barH);
        ctx.font = '9px monospace';
        ctx.fillStyle = timeLeft < 3 ? '#FF4444' : '#888';
        ctx.fillText(`${timeLeft.toFixed(1)}s`, x, y + 24);
    }
}
