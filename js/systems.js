/**
 * Dodge Warfare - Phase 5
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
        const fireCount = isBoss ? 50 : 20;
        const smokeCount = isBoss ? 20 : 8;
        const debrisCount = isBoss ? 15 : 0;
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
        this.bossSpawned = false; this.isBossWave = false;
        this.maxWaves = 999; this.missionEnemyTypes = null; this.bossWave = 5;
        this.bossWarningTimer = 0;
    }
    getEnemiesRemaining(enemies) { return enemies.filter(e => e.active && !e.isDying).length; }
    getBossRemaining(enemies) { return enemies.filter(e => e.active && !e.isDying && e.type === 'boss').length; }
    update(dt, game) {
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
        this.bossSpawned = false;
        if (this.isBossWave) {
            this.enemiesToSpawn = Math.min(3 + Math.floor(this.wave / 5), 8);
        } else {
            this.enemiesToSpawn = Math.min(CONFIG.wave.baseEnemyCount + (this.wave - 1) * CONFIG.wave.countIncrease, CONFIG.wave.maxEnemies);
        }
        this.enemiesSpawned = 0; this.state = 'spawning'; this.spawnTimer = 0;
        if (this.isBossWave) {
            this.announcementText = `BOSS WAVE ${this.wave}`;
            this.announcementTimer = 3000;
            // Screen flash for boss wave
            if (game.screenFlash) {
                game.screenFlash.alpha = 0.5;
                game.screenFlash.color = '#FF0000';
                game.screenFlash.decay = 1.5;
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
    }
    _spawnEnemy(game) {
        const cx = CONFIG.world.width / 2, cy = CONFIG.world.height / 2;
        let x, y, attempts = 0;
        do {
            const angle = Math.random() * Math.PI * 2;
            const dist = CONFIG.wave.spawnRadius + Math.random() * 300;
            x = clamp(cx + Math.cos(angle) * dist, CONFIG.wave.spawnMargin, CONFIG.world.width - CONFIG.wave.spawnMargin);
            y = clamp(cy + Math.sin(angle) * dist, CONFIG.wave.spawnMargin, CONFIG.world.height - CONFIG.wave.spawnMargin);
            attempts++;
        } while (distance(x, y, game.player.x, game.player.y) < CONFIG.wave.spawnRadius && attempts < 10);

        const hpMult = 1 + (this.wave - 1) * 0.04;
        const dmgMult = 1 + (this.wave - 1) * 0.02;

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
            : ['grunt', 'rusher', 'heavy', 'sniper', 'flanker', 'medic', 'shield', 'drone', 'turret'];
        // Weighted selection: earlier types are more common, unlock higher-tier types by wave
        const tierUnlocks = { grunt: 1, rusher: 3, heavy: 5, sniper: 7, flanker: 9, medic: 6, shield: 8, drone: 10, turret: 12 };
        const eligible = allowed.filter(t => this.wave >= (tierUnlocks[t] || 1));
        if (eligible.length === 0) {
            type = 'grunt'; // Fallback
        } else {
            // Weight toward earlier (easier) types
            const weights = eligible.map(t => {
                if (t === 'grunt') return 4;
                if (t === 'rusher') return 3;
                if (t === 'heavy' || t === 'sniper') return 2;
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
        }
        enemy._gameRef = game;
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
            if (fn.age > fn.maxAge) this.floatingNumbers.splice(i, 1);
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
