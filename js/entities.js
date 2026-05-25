/**
 * Dodge Warfare - Phase 6
 * Entities - Player, Enemies, Bullets, Pickups
 */

// ============================================================
// BULLET (Player)
// ============================================================
class Bullet {
    constructor(x, y, angle, speed, radius, color, damage, explosive = false, explosionRadius = 0, explosionDamage = 0) {
        this.x = x; this.y = y;         this.radius = radius || 4;
        this.speed = speed || 700; this.damage = damage || 20;
        this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
        this.lifetime = 3000; this.age = 0; this.active = true;
        this.color = color || '#FFD700';
        this.explosive = explosive; this.explosionRadius = explosionRadius; this.explosionDamage = explosionDamage;
        // Trail positions (fixed-size circular buffer)
        this.trail = [{ x, y }, { x, y }, { x, y }, { x, y }, { x, y }, { x, y }];
        this.trailIdx = 0; this.maxTrail = 6;
        // Pre-computed hex color for trail
        this._trailRgba = '';
    }
    update(dt) {
        // Store trail (circular buffer, skip on low quality)
        if (game.graphicsQuality !== 'low') {
            this.trail[this.trailIdx] = { x: this.x, y: this.y };
            this.trailIdx = (this.trailIdx + 1) % this.maxTrail;
        }
        this.x += this.vx * dt; this.y += this.vy * dt; this.age += dt * 1000;
        if (this.x < -50 || this.x > CONFIG.world.width + 50 || this.y < -50 || this.y > CONFIG.world.height + 50 || this.age > this.lifetime) this.active = false;
    }
    render(ctx, cameraOffset, quality) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling — skip offscreen bullets
        const margin = this.radius * 2 + 10;
        if (sx < -margin || sx > ctx.canvas.width + margin || sy < -margin || sy > ctx.canvas.height + margin) return;
        // Trail (circular buffer)
        if (quality !== 'low') {
            const hex = this.color.startsWith('#') ? this.color : '#FFD700';
            const hr = parseInt(hex.slice(1,3),16), hg = parseInt(hex.slice(3,5),16), hb = parseInt(hex.slice(5,7),16);
            for (let i = 0; i < this.maxTrail; i++) {
                const idx = (this.trailIdx + i) % this.maxTrail;
                const t = this.trail[idx];
                const alpha = (i / this.maxTrail) * 0.3;
                const tx = t.x - cameraOffset.x, ty = t.y - cameraOffset.y;
                ctx.beginPath(); ctx.arc(tx, ty, this.radius * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${hr},${hg},${hb},${alpha})`; ctx.fill();
            }
        }
        // Bullet
        ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        // Glow
        ctx.beginPath(); ctx.arc(sx, sy, this.radius * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,0.2)`; ctx.fill();
    }
}

// ============================================================
// ENEMY BULLET
// ============================================================
class EnemyBullet {
    constructor(x, y, angle, speed, damage) {
        this.x = x; this.y = y; this.radius = CONFIG.enemyBullet.radius;
        this.speed = speed; this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.lifetime = CONFIG.enemyBullet.lifetime; this.age = 0; this.active = true; this.damage = damage;
        this.trail = [{ x, y }, { x, y }, { x, y }, { x, y }];
        this.trailIdx = 0; this.maxTrail = 4;
    }
    update(dt) {
        if (game.graphicsQuality !== 'low') {
            this.trail[this.trailIdx] = { x: this.x, y: this.y };
            this.trailIdx = (this.trailIdx + 1) % this.maxTrail;
        }
        this.x += this.vx * dt; this.y += this.vy * dt; this.age += dt * 1000;
        if (this.x < -50 || this.x > CONFIG.world.width + 50 || this.y < -50 || this.y > CONFIG.world.height + 50 || this.age > this.lifetime) this.active = false;
    }
    render(ctx, cameraOffset, quality) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling — skip offscreen enemy bullets
        const margin = this.radius * 2 + 10;
        if (sx < -margin || sx > ctx.canvas.width + margin || sy < -margin || sy > ctx.canvas.height + margin) return;
        if (quality !== 'low') {
            for (let i = 0; i < this.maxTrail; i++) {
                const idx = (this.trailIdx + i) % this.maxTrail;
                const t = this.trail[idx];
                const alpha = (i / this.maxTrail) * 0.2;
                ctx.beginPath(); ctx.arc(t.x - cameraOffset.x, t.y - cameraOffset.y, this.radius * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,68,68,${alpha})`; ctx.fill();
            }
        }
        ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.enemyBullet.color; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, this.radius * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = CONFIG.enemyBullet.glowColor; ctx.fill();
    }
}

// ============================================================
// ENEMY BASE CLASS - Enhanced with group tactics & better AI
// ============================================================
class Enemy {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.angle = 0; this.active = true; this.alertTimer = 0;
        this.lastAttackTime = 0; this.hitFlash = 0;
        this.patrolTarget = { x: x, y: y }; this.state = 'idle';
        this.deathTimer = 0; this.isDying = false;
        this.separationX = 0; this.separationY = 0;
        this._gameRef = null;
        // Hip-bobbing tracking
        this._prevX = x; this._prevY = y; this._velocityMag = 0;
        this._bobPhase = 0; this._bobScale = 1; this._bobRotation = 0;
        // Group tactics
        this._groupCooldown = 0;
        this._callForHelpCooldown = 0;
        this._lastKnownPlayerX = 0;
        this._lastKnownPlayerY = 0;
        this._stuckCheckX = x;
        this._stuckCheckY = y;
        this._stuckTimer = 0;
        this._pathRetryTimer = 0;
        // Alert indicator
        this._alertAlpha = 0;
        this._stateChangeTime = 0;
        // Damage flash particles
        this._hitParticles = [];
        // Burn damage over time (from flamethrower)
        this._burnTimer = 0;
        this._burnDamage = 0;
        this._burnTickTimer = 0;
        // Phase 7: Variant system
        this.variant = null;
        this.variantName = '';
        this.variantSkill = null;
        this._skillCooldowns = {};
        // Enhanced AI state
        this._suppressTarget = null;
        this._lastPlayerWeaponIndex = -1;
        this._coverPosition = null;
        this._peekTimer = 0;
        this._isPeeking = false;
    }
    isSolid() { return true; } blocksBullets() { return true; }

    // Phase 7: Initialize variant from config
    initVariant(game) {
        const cfg = CONFIG.enemy[this.type];
        if (!cfg || !cfg.variants || cfg.variants.length === 0) return;
        // Pick random variant
        const variant = cfg.variants[Math.floor(Math.random() * cfg.variants.length)];
        this.variant = variant;
        this.variantName = variant.name;
        // Apply variant stat modifications
        if (variant.hp) { this.hp = variant.hp; this.maxHp = variant.hp; }
        if (variant.speed) this.speed = variant.speed;
        if (variant.damage) this.damage = variant.damage;
        if (variant.bodyColor) this.bodyColor = variant.bodyColor;
        if (variant.helmetColor) this.helmetColor = variant.helmetColor;
        // Set variant skill
        if (variant.skill && CONFIG.variantSkills[variant.skill]) {
            this.variantSkill = { id: variant.skill, ...CONFIG.variantSkills[variant.skill] };
        }
    }

    // Process variant skill effects
    _processVariantSkill(dt, game) {
        if (!this.variantSkill) return;
        const skill = this.variantSkill;
        // Healing aura: heal nearby allies
        if (skill.id === 'healingAura' && skill.auraRange) {
            if (!this._auraTickTimer) this._auraTickTimer = 0;
            this._auraTickTimer -= dt * 1000;
            if (this._auraTickTimer <= 0) {
                this._auraTickTimer = 1000;
                for (const ally of game.enemies) {
                    if (ally === this || !ally.active || ally.isDying) continue;
                    if (distance(this.x, this.y, ally.x, ally.y) < skill.auraRange) {
                        ally.hp = Math.min(ally.maxHp, ally.hp + (skill.auraHeal || 5));
                    }
                }
            }
        }
        // Combat heal: heal while in combat
        if (skill.id === 'combatHeal' && this.state === 'attack') {
            this.hp = Math.min(this.maxHp, this.hp + (skill.healPerSecond || 3) * dt);
        }
        // Poison cloud: leave poison trail
        if (skill.id === 'poisonCloud') {
            if (!this._poisonTrailTimer) this._poisonTrailTimer = 0;
            this._poisonTrailTimer -= dt * 1000;
            if (this._poisonTrailTimer <= 0 && this._velocityMag > 30) {
                this._poisonTrailTimer = 300;
                if (game.addEffect) {
                    game.addEffect({
                        x: this.x, y: this.y, radius: 40,
                        damage: skill.poisonDamage || 3, life: skill.poisonDuration || 2000,
                        age: 0, active: true, type: 'poison',
                        update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                        render(ctx, cam) {
                            const a = (1 - this.age / this.life) * 0.3;
                            ctx.globalAlpha = a; ctx.fillStyle = '#44AA00';
                            ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.radius, 0, Math.PI * 2); ctx.fill();
                            ctx.globalAlpha = 1;
                        }
                    });
                }
            }
        }
    }

    update(dt, game) {
        if (!this.active) return;
        if (this.isDying) {
            this.deathTimer += dt * 1000;
            if (this.deathTimer > 500) this.active = false;
            return;
        }
        if (this.hitFlash > 0) this.hitFlash -= dt * 1000;
        this.alertTimer = Math.max(0, this.alertTimer - dt * 1000);
        this._separation(dt, game.enemies);
        this._ai(dt, game);
        this._processVariantSkill(dt, game); // Phase 7: variant skills
        this.x = clamp(this.x, this.radius, CONFIG.world.width - this.radius);
        this.y = clamp(this.y, this.radius, CONFIG.world.height - this.radius);

        // Hip-bobbing: track velocity
        const edx = this.x - this._prevX, edy = this.y - this._prevY;
        this._velocityMag = Math.sqrt(edx * edx + edy * edy) / Math.max(dt, 0.001);
        this._prevX = this.x; this._prevY = this.y;
        if (this._velocityMag > 10) {
            const bobSpd = 6 + Math.min(this._velocityMag / 60, 6);
            this._bobPhase += dt * bobSpd;
            this._bobScale = 1 + Math.sin(this._bobPhase) * 0.02;
            this._bobRotation = Math.sin(this._bobPhase * 0.5) * 0.03;
        } else {
            this._bobScale = lerp(this._bobScale, 1, dt * 4);
            this._bobRotation = lerp(this._bobRotation, 0, dt * 4);
        }

        // Group tactics: call for help cooldown
        if (this._callForHelpCooldown > 0) this._callForHelpCooldown -= dt * 1000;
        if (this._groupCooldown > 0) this._groupCooldown -= dt * 1000;

        // Store last known player position when alerted
        if (this.alertTimer > 0 && game.player) {
            this._lastKnownPlayerX = game.player.x;
            this._lastKnownPlayerY = game.player.y;
        }

        // Stuck detection
        const stuckDx = this.x - this._stuckCheckX;
        const stuckDy = this.y - this._stuckCheckY;
        if (Math.sqrt(stuckDx * stuckDx + stuckDy * stuckDy) < 3 && this._velocityMag > 20) {
            this._stuckTimer += dt * 1000;
            if (this._stuckTimer > 800) {
                this._stuckTimer = 0;
                // Unstuck: pick random nearby position
                const angle = Math.random() * Math.PI * 2;
                this.patrolTarget = {
                    x: clamp(this.x + Math.cos(angle) * 200, 100, CONFIG.world.width - 100),
                    y: clamp(this.y + Math.sin(angle) * 200, 100, CONFIG.world.height - 100)
                };
            }
        } else {
            this._stuckTimer = 0;
        }
        if (this._pathRetryTimer > 0) this._pathRetryTimer -= dt * 1000;
        if (this._pathRetryTimer <= 0) {
            this._stuckCheckX = this.x;
            this._stuckCheckY = this.y;
            this._pathRetryTimer = 500;
        }

        // Alert indicator animation
        const isAlert = this.state === 'attack' || this.state === 'chase';
        this._alertAlpha = lerp(this._alertAlpha, isAlert ? 1 : 0, dt * 8);

        // Update hit particles
        for (let i = this._hitParticles.length - 1; i >= 0; i--) {
            const p = this._hitParticles[i];
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vx *= 0.95; p.vy *= 0.95;
            p.age += dt * 1000;
            if (p.age > p.life) this._hitParticles.splice(i, 1);
        }

        // State change tracking
        if (this._prevState !== this.state) {
            this._prevState = this.state;
            this._stateChangeTime = performance.now();
        }
    }

    // Minimal update for distant enemies (skip AI, separation, stuck detection)
    updateBasic(dt) {
        if (!this.active) return;
        if (this.isDying) {
            this.deathTimer += dt * 1000;
            if (this.deathTimer > 500) this.active = false;
            return;
        }
        if (this.hitFlash > 0) this.hitFlash -= dt * 1000;
        this.alertTimer = Math.max(0, this.alertTimer - dt * 1000);
        if (this._callForHelpCooldown > 0) this._callForHelpCooldown -= dt * 1000;
        this._prevX = this.x; this._prevY = this.y;
    }

    // Group tactics: call nearby allies to help
    _callForHelp(game) {
        if (this._callForHelpCooldown > 0) return;
        this._callForHelpCooldown = 5000; // 5s cooldown

        const helpRangeSq = 400 * 400;
        const px = game.player.x, py = game.player.y;
        for (let i = 0, len = game.enemies.length; i < len; i++) {
            const ally = game.enemies[i];
            if (ally === this || !ally.active || ally.isDying) continue;
            const dx = this.x - ally.x, dy = this.y - ally.y;
            if (dx * dx + dy * dy < helpRangeSq && ally.alertTimer <= 0) {
                ally.alertTimer = 4000;
                ally._lastKnownPlayerX = px;
                ally._lastKnownPlayerY = py;
            }
        }
    }
    // Phase 7: Enhanced cover finding
    _findCoverAdvanced(game, range) {
        let bestCover = null; let bestScore = -Infinity;
        const searchRange = range || 200;
        for (const obs of game.obstacles) {
            if (!obs.isSolid()) continue;
            const b = obs.getBounds();
            const obsCX = b.x + b.w / 2, obsCY = b.y + b.h / 2;
            const distToObs = distance(this.x, this.y, obsCX, obsCY);
            if (distToObs > searchRange) continue;
            const distToPlayer = distance(obsCX, obsCY, game.player.x, game.player.y);
            // Prefer cover that's between us and the player
            const distFromPlayerToUs = distance(game.player.x, game.player.y, this.x, this.y);
            const behindCover = distToPlayer < distFromPlayerToUs;
            const score = behindCover ? distToObs * 2 - distToPlayer : distToPlayer - distToObs;
            if (score > bestScore) { bestScore = score; bestCover = { x: obsCX, y: obsCY }; }
        }
        return bestCover;
    }

    // Phase 7: Weapon awareness - check if player is reloading
    _isPlayerReloading(game) {
        return game.player && game.player.isReloading;
    }

    // Phase 7: Coordinated attack - check if nearby allies are engaging
    _hasAlliesEngaging(game, range) {
        for (const ally of game.enemies) {
            if (ally === this || !ally.active || ally.isDying) continue;
            if (ally.state === 'attack' && distance(this.x, this.y, ally.x, ally.y) < range) return true;
        }
        return false;
    }

    // Phase 7: Find flanking position (behind player)
    _findFlankPosition(game, range) {
        if (!game.player) return null;
        const behindAngle = game.player.angle + Math.PI;
        const behindDist = range || 150;
        const targetX = game.player.x + Math.cos(behindAngle) * behindDist;
        const targetY = game.player.y + Math.sin(behindAngle) * behindDist;
        // Check if position is reachable
        if (this._hasLineOfSight(targetX, targetY, game)) return { x: targetX, y: targetY };
        return null;
    }

    // Phase 7: Smart retreat - move away from player while firing
    _smartRetreat(dt, game, speed) {
        if (!game.player) return;
        const angle = Math.atan2(this.y - game.player.y, this.x - game.player.x);
        const retreatSpeed = speed || this.speed;
        this._moveToward(this.x + Math.cos(angle) * 200, this.y + Math.sin(angle) * 200, retreatSpeed, dt, game.obstacles);
    }

    // Phase 7: Peek-shoot behavior
    _peekShoot(dt, game) {
        if (!this._peekTimer) this._peekTimer = 0;
        this._peekTimer -= dt * 1000;
        if (this._isPeeking) {
            if (this._peekTimer <= 0) {
                this._isPeeking = false;
                this._peekTimer = 1500 + Math.random() * 1000; // Hide duration
            }
            return true; // Peeking: can shoot
        } else {
            if (this._peekTimer <= 0) {
                this._isPeeking = true;
                this._peekTimer = 500 + Math.random() * 500; // Peek duration
            }
            return false; // Hidden
        }
    }

    _ai(dt, game) {}
    _separation(dt, enemies) {
        this.separationX = 0; this.separationY = 0;
        const rSumBase = CONFIG.separation.radius;
        for (let i = 0, len = enemies.length; i < len; i++) {
            const other = enemies[i];
            if (other === this || !other.active || other.isDying) continue;
            const dx = this.x - other.x, dy = this.y - other.y;
            const distSq = dx * dx + dy * dy;
            const minDist = this.radius + other.radius + rSumBase;
            if (distSq < minDist * minDist && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const force = (minDist - dist) / minDist * CONFIG.separation.strength;
                this.separationX += (dx / dist) * force;
                this.separationY += (dy / dist) * force;
            }
        }
        this.x += this.separationX * dt; this.y += this.separationY * dt;
    }
    takeDamage(amount, game) {
        if (this.isDying) return;
        this.hp -= amount; this.hitFlash = 120; this.alertTimer = 8000;
        if (game && game.addDamageNumber) game.addDamageNumber(this.x, this.y - 20, amount);
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('enemyHit');
        // Stagger knockback
        if (game && game.player) {
            const knockAngle = Math.atan2(this.y - game.player.y, this.x - game.player.x);
            const knockDist = Math.min(15, amount * 0.5);
            this.x += Math.cos(knockAngle) * knockDist;
            this.y += Math.sin(knockAngle) * knockDist;
        }
        // Group tactics: call for help when damaged
        if (game) this._callForHelp(game);
        // Hit particles (optimized - stored in entity, rendered in render())
        const partMult = game.graphicsQuality === 'low' ? 0.4 : game.graphicsQuality === 'medium' ? 0.7 : 1;
        const count = Math.max(1, Math.floor(Math.min(6, Math.floor(2 + amount / 5)) * partMult));
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            this._hitParticles.push({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * (60 + Math.random() * 80),
                vy: Math.sin(angle) * (60 + Math.random() * 80),
                life: 200 + Math.random() * 150, age: 0,
                size: 2 + Math.random() * 2, active: true
            });
        }
        // Also add visual effects via game
        const visPartMult = game.graphicsQuality === 'low' ? 0.3 : game.graphicsQuality === 'medium' ? 0.6 : 1;
        const effectCount = Math.max(1, Math.floor(Math.min(4, Math.floor(3 + amount / 8)) * visPartMult));
        for (let i = 0; i < effectCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            game.addEffect({
                x: this.x, y: this.y, vx: Math.cos(angle) * (80 + Math.random() * 120), vy: Math.sin(angle) * (80 + Math.random() * 120),
                life: 250 + Math.random() * 200, age: 0, size: 2 + Math.random() * 3,
                color: '#FF6666', active: true,
                update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.98; this.vy *= 0.98; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.fillRect(this.x - cam.x - this.size / 2, this.y - cam.y - this.size / 2, this.size, this.size); ctx.globalAlpha = 1; }
            });
        }
        // Zombie mode: enemies only die from close range hits
        if (this.hp <= 0 && game && game._challengeZombieMode) {
            const distToPlayer = game.player ? distance(this.x, this.y, game.player.x, game.player.y) : Infinity;
            if (distToPlayer > 100) this.hp = 1;
        }
        if (this.hp <= 0) this.die(game);
    }
    die(game) {
        this.isDying = true; this.deathTimer = 0;
        if (game && game.onEnemyKilled) game.onEnemyKilled(this);
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('enemyDeath');
        // Phase 7: Variant death effects
        if (this.variantSkill && game) {
            const skill = this.variantSkill;
            if (skill.id === 'explosiveDeath') {
                // Explode on death
                game.createExplosion(this.x, this.y, skill.explosionRadius || 80, skill.explosionDamage || 25, null);
            }
            if (skill.id === 'smokeGrenade') {
                // Drop smoke cloud
                game.addEffect({
                    x: this.x, y: this.y, radius: skill.smokeRadius || 120,
                    life: skill.smokeDuration || 3000, age: 0, active: true, type: 'smoke',
                    update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                    render(ctx, cam) {
                        const a = (1 - this.age / this.life) * 0.5;
                        ctx.globalAlpha = a; ctx.fillStyle = 'rgba(100,100,100,0.6)';
                        ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.radius, 0, Math.PI * 2); ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                });
            }
            if (skill.id === 'callReinforcements') {
                // Spawn extra enemy on death
                const count = skill.reinforceCount || 1;
                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 50 + Math.random() * 30;
                    const x = clamp(this.x + Math.cos(angle) * dist, 50, CONFIG.world.width - 50);
                    const y = clamp(this.y + Math.sin(angle) * dist, 50, CONFIG.world.height - 50);
                    const enemy = new EnemyGrunt(x, y, 1, 1);
                    enemy._gameRef = game;
                    enemy.initVariant(game);
                    game.enemies.push(enemy);
                }
            }
        }
        // Blood decal
        if (game && game.addScorchMark) game.addScorchMark({ x: this.x, y: this.y, radius: this.radius * 1.5, color: 'rgba(120,30,30,0.35)', isBlood: true });
        // Death body (stays on ground)
        if (game && game.addEffect && this.type !== 'drone' && this.type !== 'turret') {
            const deathAngle = this.angle;
            game.addEffect({
                x: this.x, y: this.y, angle: deathAngle, radius: this.radius,
                color: this.color, bodyColor: this.bodyColor, type: this.type,
                life: 15000, age: 0, size: this.radius, active: true,
                update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                render(ctx, cam) {
                    const sx = this.x - cam.x, sy = this.y - cam.y;
                    const a = Math.max(0.15, 1 - this.age / this.life);
                    ctx.save(); ctx.globalAlpha = a; ctx.translate(sx, sy); ctx.rotate(this.angle);
                    // Dead body - flat on ground
                    ctx.beginPath(); ctx.ellipse(0, 0, this.radius * 1.2, this.radius * 0.7, 0, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(80,30,30,0.5)'; ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
                    ctx.restore(); ctx.globalAlpha = 1;
                }
            });
        }
        // Death particles
        if (game && game.addEffect) {
        const deathPartCount = game.graphicsQuality === 'low' ? 4 : game.graphicsQuality === 'medium' ? 8 : 12;
        for (let i = 0; i < deathPartCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            game.addEffect({
                x: this.x, y: this.y, vx: Math.cos(angle) * (50 + Math.random() * 100), vy: Math.sin(angle) * (50 + Math.random() * 100),
                life: 350 + Math.random() * 300, age: 0, size: 3 + Math.random() * 5,
                color: this.color, active: true,
                update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.96; this.vy *= 0.96; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.fillRect(this.x - cam.x - this.size / 2, this.y - cam.y - this.size / 2, this.size, this.size); ctx.globalAlpha = 1; }
            });
        }
        }
    }
    _resolveCollisions(obstacles) {
        for (const obs of obstacles) {
            if (!obs.isSolid()) continue;
            const b = obs.getBounds();
            const result = resolveCircleRect(this.x, this.y, this.radius, b.x, b.y, b.w, b.h);
            if (result) { this.x = result.x; this.y = result.y; }
        }
    }

    // Find nearest target (player or teammate)
    _findNearestTarget(game) {
        let nearest = game.player;
        let minDist = distance(this.x, this.y, game.player.x, game.player.y);

        // Check teammates
        if (game.teammates) {
            for (const tm of game.teammates) {
                if (!tm.active) continue;
                const d = distance(this.x, this.y, tm.x, tm.y);
                if (d < minDist) { minDist = d; nearest = tm; }
            }
        }

        return { target: nearest, dist: minDist };
    }

    _moveToward(tx, ty, speed, dt, obstacles) {
        const dx = tx - this.x, dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) return;
        const nx = dx / dist, ny = dy / dist;
        this.x += nx * speed * dt; this.y += ny * speed * dt;
        this._resolveCollisions(obstacles);
    }
    _hasLineOfSight(tx, ty, game) {
        const dx = tx - this.x, dy = ty - this.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        const steps = Math.min(12, Math.ceil(dist / 40));
        const invSteps = 1 / steps;
        const obstacles = game.obstacles;
        for (let i = 1; i < steps; i++) {
            const t = i * invSteps;
            const px = this.x + dx * t, py = this.y + dy * t;
            for (let j = 0, oLen = obstacles.length; j < oLen; j++) {
                const obs = obstacles[j];
                if (!obs.blocksBullets()) continue;
                if (obs.type === 'building') {
                    const walls = obs.getCollisionRects();
                    for (let k = 0, wLen = walls.length; k < wLen; k++) {
                        const wall = walls[k];
                        if (px > wall.x - 2 && px < wall.x + wall.w + 2 && py > wall.y - 2 && py < wall.y + wall.h + 2) return false;
                    }
                } else {
                    const b = obs.getBounds();
                    if (px > b.x - 2 && px < b.x + b.w + 2 && py > b.y - 2 && py < b.y + b.h + 2) return false;
                }
            }
        }
        return true;
    }
    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling — skip offscreen enemies (generous margin for health bars, debug text)
        const margin = (this.radius || 16) + 40;
        if (sx < -margin || sx > ctx.canvas.width + margin || sy < -margin || sy > ctx.canvas.height + margin) return;
        const alpha = this.isDying ? Math.max(0, 1 - this.deathTimer / 500) : 1;
        ctx.save(); ctx.globalAlpha = alpha;
        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 4, sy + 5, this.radius * 0.9, this.radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
        }
        ctx.translate(sx, sy); ctx.rotate(this.angle);
        // Hip-bobbing: organic wobble
        if (this._bobScale !== 1 || this._bobRotation !== 0) {
            ctx.scale(this._bobScale, 2 - this._bobScale);
            ctx.rotate(this._bobRotation);
        }
        // Hit flash
        const isHit = this.hitFlash > 0;
        // Call type-specific render (overridden in subclasses)
        this._drawCharacter(ctx, isHit, quality);
        ctx.restore(); ctx.globalAlpha = 1;

        // Inline hit particles (no separate effect objects)
        if (quality !== 'low') {
            for (const p of this._hitParticles) {
                const lifeRatio = 1 - p.age / p.life;
                const psx = p.x - cameraOffset.x, psy = p.y - cameraOffset.y;
                if (psx < -10 || psx > ctx.canvas.width + 10 || psy < -10 || psy > ctx.canvas.height + 10) continue;
                ctx.globalAlpha = lifeRatio * 0.8;
                ctx.fillStyle = '#FF6666';
                ctx.fillRect(psx - p.size / 2, psy - p.size / 2, p.size * lifeRatio, p.size * lifeRatio);
            }
            ctx.globalAlpha = 1;
        }

        // Alert indicator (! icon above head)
        if (this._alertAlpha > 0.1 && !this.isDying) {
            ctx.save();
            ctx.globalAlpha = this._alertAlpha * 0.8;
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = this.state === 'attack' ? '#FF4444' : '#FFAA00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('!', sx, sy - this.radius - 14);
            ctx.restore();
        }

        // Health bar
        if (this.hp < this.maxHp && !this.isDying) {
            const barW = this.radius * 2, barH = 4;
            ctx.fillStyle = '#222'; ctx.fillRect(sx - barW / 2, sy - this.radius - 10, barW, barH);
            const pct = this.hp / this.maxHp;
            ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FF9800' : '#F44336';
            ctx.fillRect(sx - barW / 2, sy - this.radius - 10, barW * pct, barH);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.strokeRect(sx - barW / 2, sy - this.radius - 10, barW, barH);
        }
        // Variant name display (Phase 7)
        if (this.variantName && this.variantName !== 'Standard' && !this.isDying) {
            ctx.font = '9px monospace';
            ctx.fillStyle = '#AAA';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.variantName, sx, sy - this.radius - (this.hp < this.maxHp ? 14 : 4));
        }
        // Debug state
        if (game && game.hud && game.hud.showDebug) {
            ctx.font = '10px monospace'; ctx.fillStyle = '#0F0'; ctx.textAlign = 'center';
            ctx.fillText(this.state, sx, sy - this.radius - 16);
        }
    }
    _drawCharacter(ctx, isHit, quality) {
        // Default: simple body (overridden in subclasses)
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor || this.color;
        // Legs
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#2A2A2A';
            ctx.beginPath(); ctx.ellipse(-2, r * 0.5, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, r * 0.5, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Body
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        // Head
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#333'; ctx.fill();
        // Gun
        this._drawGun(ctx);
    }
    _drawGun(ctx) {
        ctx.fillStyle = '#222'; ctx.fillRect(this.radius * 0.3, -3, this.radius + 10, 6);
    }
}

// ============================================================
// ENEMY: GRUNT
// ============================================================
class EnemyGrunt extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'grunt');
        const cfg = CONFIG.enemy.grunt;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.state = 'idle'; this._pickPatrolTarget();
        this.flankTimer = 0; this.flankAngle = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 400, y: this.y + (Math.random() - 0.5) * 400 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawGun(ctx) { ctx.fillStyle = this.gunColor; ctx.fillRect(this.radius * 0.3, -3, this.radius + 8, 6); }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Legs
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#3A2A1A';
            ctx.beginPath(); ctx.ellipse(-2, r * 0.55, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, r * 0.55, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            // Boots
            ctx.fillStyle = isHit ? '#EEE' : '#2A1A0A';
            ctx.beginPath(); ctx.ellipse(-2, r * 0.75, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, r * 0.75, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Body - military fatigues
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Tactical vest
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : 'rgba(50,40,25,0.6)';
            ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.65, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
            // Ammo pouches
            ctx.fillStyle = isHit ? '#DDD' : 'rgba(40,30,18,0.7)';
            ctx.fillRect(-r * 0.25, -r * 0.3, r * 0.2, r * 0.15);
            ctx.fillRect(-r * 0.25, r * 0.15, r * 0.2, r * 0.15);
        }
        // Arms
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.3, 4, 3.5, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.25, r * 0.3, 4, 3.5, 0.2, 0, Math.PI * 2); ctx.fill();
        // Head with helmet
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#3A3A2A'; ctx.fill();
        // Helmet
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#4A5D23';
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.45, -0.7, 0.7); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.45, -0.7, 0.7); ctx.stroke();
        }
        // AK-style rifle
        this._drawGun(ctx);
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 6000;
        if (this.alertTimer > 0 && hasLOS) {
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this.flankTimer -= dt * 1000;
                if (this.flankTimer <= 0) {
                    this.flankTimer = 2000 + Math.random() * 2000;
                    this.flankAngle = this.angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                }
                const flankDist = 150;
                const flankX = game.player.x + Math.cos(this.flankAngle) * flankDist;
                const flankY = game.player.y + Math.sin(this.flankAngle) * flankDist;
                this._moveToward(flankX, flankY, this.speed * 0.6, dt, game.obstacles);
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate) {
                    this.lastAttackTime = now;
                    const spread = (Math.random() - 0.5) * 0.12;
                    game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 12), this.y + Math.sin(this.angle) * (this.radius + 12), this.angle + spread, this.bulletSpeed, this.damage));
                    if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('shoot');
                }
                // Group tactics: call for help when engaging
                if (this._callForHelpCooldown <= 0) this._callForHelp(game);
            } else {
                this.state = 'chase'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.6, dt, game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: RUSHER
// ============================================================
class EnemyRusher extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'rusher');
        const cfg = CONFIG.enemy.rusher;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.detectionRange = cfg.detectionRange; this.meleeRange = cfg.meleeRange; this.attackCooldown = cfg.attackCooldown;
        this.state = 'idle'; this._pickPatrolTarget();
        this.feintTimer = 0; this.isFeinting = false;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 500, y: this.y + (Math.random() - 0.5) * 500 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawGun(ctx) {
        ctx.fillStyle = '#888'; ctx.fillRect(this.radius * 0.3, -2, this.radius * 0.8, 4);
        ctx.fillStyle = '#AAA'; ctx.beginPath();
        ctx.moveTo(this.radius * 0.3 + this.radius * 0.8, -3); ctx.lineTo(this.radius * 0.3 + this.radius * 0.8 + 8, 0); ctx.lineTo(this.radius * 0.3 + this.radius * 0.8, 3); ctx.fill();
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Rusher: lean, fast, knife weapon, light gear
        // Legs - longer stride pose
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#4A3020';
            ctx.beginPath(); ctx.ellipse(-1, r * 0.6, 2.5, 5, 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(1, r * 0.6, 2.5, 5, -0.15, 0, Math.PI * 2); ctx.fill();
        }
        // Body - lean build
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Light vest / bandolier
        if (quality !== 'low') {
            ctx.strokeStyle = isHit ? '#DDD' : 'rgba(80,50,30,0.5)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.5); ctx.lineTo(r * 0.4, r * 0.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r * 0.4, -r * 0.5); ctx.lineTo(-r * 0.4, r * 0.5); ctx.stroke();
        }
        // Arms - reaching forward aggressively
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.25, 3.5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.35, r * 0.25, 3.5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
        // Head - no helmet, bandana
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#5A4030'; ctx.fill();
        // Bandana
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#8B0000';
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.42, -0.6, 0.6); ctx.fill();
            // Bandana tails
            ctx.beginPath(); ctx.moveTo(r * 0.3 - r * 0.35, -r * 0.2); ctx.lineTo(r * 0.3 - r * 0.55, -r * 0.35); ctx.lineTo(r * 0.3 - r * 0.3, -r * 0.1); ctx.fill();
        }
        // Combat knife
        this._drawGun(ctx);
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 6000;
        if (this.alertTimer > 0 && hasLOS) {
            if (distToPlayer <= this.meleeRange) {
                this.state = 'attack'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                const now = performance.now();
                if (now - this.lastAttackTime >= this.attackCooldown) {
                    this.lastAttackTime = now;
                    game.player.takeDamage(this.damage);
                    if (game.camera) game.camera.triggerShake(100, 4);
                    if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('playerHit');
                }
            } else {
                this.state = 'chase'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this.feintTimer -= dt * 1000;
                let targetX = game.player.x, targetY = game.player.y;
                if (this.feintTimer <= 0 && Math.random() < 0.3) {
                    this.feintTimer = 1500 + Math.random() * 1000;
                    this.isFeinting = !this.isFeinting;
                }
                if (this.isFeinting) {
                    const feintAngle = this.angle + Math.PI / 2 * (Math.sin(performance.now() * 0.01) > 0 ? 1 : -1);
                    targetX = game.player.x + Math.cos(feintAngle) * 100;
                    targetY = game.player.y + Math.sin(feintAngle) * 100;
                }
                const wobble = Math.sin(performance.now() * 0.008 + this.y) * 30;
                this._moveToward(targetX + wobble, targetY + Math.cos(performance.now() * 0.006) * 30, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.6, dt, game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: HEAVY
// ============================================================
class EnemyHeavy extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'heavy');
        const cfg = CONFIG.enemy.heavy;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.fireRate = cfg.fireRate; this.burstCooldown = cfg.burstCooldown; this.burstShotInterval = cfg.burstShotInterval;
        this.burstCount = cfg.burstCount; this.bulletSpeed = cfg.bulletSpeed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.state = 'idle'; this.burstProgress = 0; this._pickPatrolTarget();
        this.coverTarget = null; this.seekingCover = false;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 300, y: this.y + (Math.random() - 0.5) * 300 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _findCover(game) {
        let bestCover = null; let bestScore = -Infinity;
        for (const obs of game.obstacles) {
            if (!obs.isSolid()) continue;
            const b = obs.getBounds();
            const obsCX = b.x + b.w / 2, obsCY = b.y + b.h / 2;
            const distToObs = distance(this.x, this.y, obsCX, obsCY);
            const distToPlayer = distance(obsCX, obsCY, game.player.x, game.player.y);
            const score = distToPlayer - distToObs;
            if (score > bestScore && distToObs < 200) { bestScore = score; bestCover = { x: obsCX, y: obsCY }; }
        }
        return bestCover;
    }
    _drawGun(ctx) {
        ctx.fillStyle = this.gunColor; ctx.fillRect(this.radius * 0.3, -4, this.radius + 14, 8);
        ctx.fillStyle = '#555'; ctx.fillRect(this.radius * 0.3 + this.radius + 10, -5, 6, 10);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Heavy: big, armored, LMG
        // Legs - thick, slow
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#1A1A1A';
            ctx.beginPath(); ctx.ellipse(-3, r * 0.6, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(3, r * 0.6, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
            // Heavy boots
            ctx.fillStyle = isHit ? '#EEE' : '#111';
            ctx.beginPath(); ctx.ellipse(-3, r * 0.85, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(3, r * 0.85, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Body - heavily armored
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
        // Heavy armor plates
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : 'rgba(30,30,30,0.7)';
            ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.75, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
            // Armor panel lines
            ctx.strokeStyle = isHit ? '#DDD' : 'rgba(60,60,60,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.3, -r * 0.3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.3); ctx.lineTo(r * 0.3, r * 0.3); ctx.stroke();
            // Shoulder pads
            ctx.fillStyle = isHit ? '#DDD' : 'rgba(40,40,40,0.8)';
            ctx.beginPath(); ctx.ellipse(r * 0.1, -r * 0.6, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.6, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Thick arms
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.4, 6, 5, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.4, 6, 5, 0.2, 0, Math.PI * 2); ctx.fill();
        // Head - heavy helmet
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#1A1A1A'; ctx.fill();
        // Full face helmet with visor
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#2A2A2A';
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.44, -0.9, 0.9); ctx.fill();
            // Visor
            ctx.fillStyle = isHit ? '#DDD' : 'rgba(200,50,50,0.4)';
            ctx.beginPath(); ctx.arc(r * 0.35, 0, r * 0.2, -0.5, 0.5); ctx.fill();
        }
        // LMG - big gun
        this._drawGun(ctx);
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 10000;
        if (this.alertTimer > 0 && hasLOS) {
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                const now = performance.now();
                if (this.burstProgress < this.burstCount) {
                    if (now - this.lastAttackTime >= this.burstShotInterval) {
                        this.lastAttackTime = now;
                        const spread = (this.burstProgress - 1) * 0.1;
                        game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 16), this.y + Math.sin(this.angle) * (this.radius + 16), this.angle + spread, this.bulletSpeed, this.damage));
                        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('shoot');
                        this.burstProgress++;
                    }
                } else if (now - this.lastAttackTime >= this.burstCooldown) {
                    this.burstProgress = 0;
                    if (this.hp < this.maxHp * 0.5) {
                        const cover = this._findCover(game);
                        if (cover) { this.state = 'cover'; this._moveToward(cover.x, cover.y, this.speed * 0.8, dt, game.obstacles); }
                    }
                }
            } else {
                this.state = 'chase'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.5, dt, game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: SNIPER
// ============================================================
class EnemySniper extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'sniper');
        const cfg = CONFIG.enemy.sniper;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.retreatDistance = cfg.retreatDistance; this.laserWarningTime = cfg.laserWarningTime;
        this.state = 'idle'; this.laserActive = false; this.laserTimer = 0; this._pickPatrolTarget();
        this.repositionTimer = 0; this.lastShotTime = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 400, y: this.y + (Math.random() - 0.5) * 400 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawGun(ctx) {
        ctx.fillStyle = this.gunColor; ctx.fillRect(this.radius * 0.3, -2, this.radius + 22, 4);
        ctx.fillStyle = '#666'; ctx.fillRect(this.radius * 0.3 + this.radius + 18, -3, 4, 6);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Sniper: stealthy, ghillie-style, long rifle
        // Legs - crouched stance
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#2A3A2A';
            ctx.beginPath(); ctx.ellipse(-2, r * 0.5, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, r * 0.5, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Body - ghillie suit texture
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Ghillie strips
        if (quality !== 'low') {
            ctx.strokeStyle = isHit ? '#DDD' : 'rgba(60,90,40,0.4)'; ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 / 6) * i;
                ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
                ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); ctx.stroke();
            }
        }
        // Arms - steady aim pose
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.2, 3, 3, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.35, r * 0.2, 3, 3, 0.1, 0, Math.PI * 2); ctx.fill();
        // Head - sniper hood
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#2A3A2A'; ctx.fill();
        // Hood / face covering
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#3A4A3A';
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, -0.8, 0.8); ctx.fill();
            // Eye slit
            ctx.fillStyle = isHit ? '#DDD' : 'rgba(100,150,100,0.5)';
            ctx.fillRect(r * 0.35, -2, 6, 4);
        }
        // Sniper rifle - long barrel
        this._drawGun(ctx);
        // Scope
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#444';
            ctx.fillRect(r * 0.3 + 8, -6, 16, 4);
            ctx.fillStyle = isHit ? '#EEE' : 'rgba(100,150,255,0.3)';
            ctx.fillRect(r * 0.3 + 10, -5, 12, 2);
        }
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 10000;
        if (this.alertTimer > 0 && hasLOS) {
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate) {
                    if (!this.laserActive) { this.laserActive = true; this.laserTimer = this.laserWarningTime; }
                    if (this.laserActive) {
                        this.laserTimer -= dt * 1000;
                        if (this.laserTimer <= 0) {
                            this.laserActive = false; this.lastAttackTime = now; this.lastShotTime = now;
                            game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 24), this.y + Math.sin(this.angle) * (this.radius + 24), this.angle, this.bulletSpeed, this.damage));
                            if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('sniper');
                            this.repositionTimer = 1500;
                        }
                    }
                }
            } else if (distToPlayer < this.retreatDistance) {
                this.state = 'retreat'; this.angle = Math.atan2(this.y - game.player.y, this.x - game.player.x);
                this._moveToward(this.x + Math.cos(this.angle) * 100, this.y + Math.sin(this.angle) * 100, this.speed, dt, game.obstacles);
            } else if (this.repositionTimer > 0) {
                this.repositionTimer -= dt * 1000;
                this.state = 'reposition';
                if (!this.patrolTarget || distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 50) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 400 + Math.random() * 200;
                    this.patrolTarget = {
                        x: clamp(game.player.x + Math.cos(angle) * dist, 100, CONFIG.world.width - 100),
                        y: clamp(game.player.y + Math.sin(angle) * dist, 100, CONFIG.world.height - 100)
                    };
                }
                this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 1.2, dt, game.obstacles);
            } else {
                this.state = 'idle'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            }
        } else {
            this.state = 'idle'; this.laserActive = false;
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.6, dt, game.obstacles); }
            }
        }
    }
    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Laser sight
        if (this.laserActive && this._gameRef && this._gameRef.player) {
            const px = this._gameRef.player.x - cameraOffset.x, py = this._gameRef.player.y - cameraOffset.y;
            const pulse = 0.4 + Math.sin(performance.now() * 0.01) * 0.3;
            ctx.strokeStyle = `rgba(255,0,0,${pulse})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py); ctx.stroke();
            ctx.strokeStyle = `rgba(255,0,0,${pulse * 0.3})`; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py); ctx.stroke();
        }
        super.render(ctx, cameraOffset, quality);
    }
}

// ============================================================
// ENEMY: FLANKER - Fast, tries to get behind player
// ============================================================
class EnemyFlanker extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'flanker');
        const cfg = CONFIG.enemy.flanker;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.state = 'idle'; this.flankSide = 1; this._pickPatrolTarget();
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 500, y: this.y + (Math.random() - 0.5) * 500 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawGun(ctx) {
        ctx.fillStyle = this.gunColor; ctx.fillRect(this.radius * 0.3, -2, this.radius + 6, 4);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Flanker: stealthy infiltrator, dark gear, compact SMG
        // Legs - athletic, ready to sprint
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#2A1A2A';
            ctx.beginPath(); ctx.ellipse(-1, r * 0.55, 2.5, 5, 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(1, r * 0.55, 2.5, 5, -0.1, 0, Math.PI * 2); ctx.fill();
        }
        // Body - sleek tactical
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Tactical harness
        if (quality !== 'low') {
            ctx.strokeStyle = isHit ? '#DDD' : 'rgba(80,30,80,0.4)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.5); ctx.lineTo(r * 0.2, r * 0.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r * 0.3, -r * 0.5); ctx.lineTo(-r * 0.2, r * 0.5); ctx.stroke();
        }
        // Arms - compact, agile
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(r * 0.4, -r * 0.25, 3, 3, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.25, r * 0.25, 3, 3, 0.2, 0, Math.PI * 2); ctx.fill();
        // Head - balaclava
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#2A1A2A'; ctx.fill();
        // Balaclava
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#3A2A3A';
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, 0, Math.PI * 2); ctx.fill();
            // Eye holes
            ctx.fillStyle = isHit ? '#DDD' : '#1A0A1A';
            ctx.beginPath(); ctx.arc(r * 0.38, -2, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(r * 0.38, 2, 2, 0, Math.PI * 2); ctx.fill();
        }
        // Compact SMG
        this._drawGun(ctx);
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 5000;
        if (this.alertTimer > 0 && hasLOS) {
            const behindAngle = game.player.angle + Math.PI;
            const behindDist = 120;
            const targetX = game.player.x + Math.cos(behindAngle) * behindDist;
            const targetY = game.player.y + Math.sin(behindAngle) * behindDist;
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate) {
                    this.lastAttackTime = now;
                    const spread = (Math.random() - 0.5) * 0.15;
                    game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 10), this.y + Math.sin(this.angle) * (this.radius + 10), this.angle + spread, this.bulletSpeed, this.damage));
                }
                const circleAngle = behindAngle + Math.PI / 3 * this.flankSide;
                this._moveToward(
                    game.player.x + Math.cos(circleAngle) * behindDist,
                    game.player.y + Math.sin(circleAngle) * behindDist,
                    this.speed, dt, game.obstacles
                );
            } else {
                this.state = 'chase';
                this._moveToward(targetX, targetY, this.speed * 1.3, dt, game.obstacles);
                this.angle = Math.atan2(targetY - this.y, targetX - this.x);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.7, dt, game.obstacles); }
            }
        }
    }
}

// ============================================================
// PLAYER - Phase 5 with weapon/ammo system
// ============================================================
class Player {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = CONFIG.player.radius; this.angle = 0;
        this.hp = CONFIG.player.maxHP; this.maxHP = CONFIG.player.maxHP;
        this.stamina = CONFIG.stamina.max; this.maxStamina = CONFIG.stamina.max;
        this.isSprinting = false; this.isDodging = false;
        this.dodgeTimer = 0; this.dodgeCooldown = 0; this.dodgeDirection = { x: 0, y: 0 };
        this.isInvulnerable = false; this.invulnTimer = 0; this.staminaRegenTimer = 0;
        this.rollTrail = []; this.muzzleFlash = 0; this.lastShotTime = 0;
        this.inBarbedWire = false; this.alive = true; this.hitFlash = 0;
        this.recoilOffset = 0;
        this._autoReloadPending = false; this._autoReloadDelay = 0;
        this._dualBarrel = 0;

        // Weapon system - track mag per weapon (Phase 7: 2-weapon carry limit)
        this.weapons = CONFIG.weapons.map(w => ({ ...w }));
        this.currentWeaponIndex = 0;
        this.weaponMags = CONFIG.weapons.map(w => w.magSize);
        this.isReloading = false; this.reloadTimer = 0; this.reloadDuration = 0;
        // Phase 7: Weapon carry limit - only 2 weapons at a time
        this.maxWeaponSlots = CONFIG.weaponCarry.maxWeapons || 2;
        this.carriedWeaponIndices = [0]; // Start with pistol, second slot empty (-1)

        // Phase 7: Active abilities
        this.abilities = {
            grenade: {
                cooldown: 0, maxCooldown: CONFIG.abilities.grenade.cooldown,
                ready: true, key: CONFIG.abilities.grenade.key
            },
            shield: {
                cooldown: 0, maxCooldown: CONFIG.abilities.shield.cooldown,
                ready: true, active: false, timer: 0, duration: CONFIG.abilities.shield.duration,
                key: CONFIG.abilities.shield.key
            },
            adrenaline: {
                cooldown: 0, maxCooldown: CONFIG.abilities.adrenaline.cooldown,
                ready: true, active: false, timer: 0, duration: CONFIG.abilities.adrenaline.duration,
                slowFactor: CONFIG.abilities.adrenaline.slowFactor,
                key: CONFIG.abilities.adrenaline.key
            }
        };
        // Ability perk bonuses
        this.grenadeDamageBonus = 1;
        this.grenadeRadiusBonus = 1;
        this.shieldCooldownBonus = 1;
        this.adrenalineDurationBonus = 0;
        this.adrenalineHealPerKill = 0;
        this.ammoDropBonus = 0;

        // Perks
        this.perks = [];
        this.healPerKill = 0;
        this.ammoMultiplier = 1;
        this.explosionMult = 1;
        this.lastStand = false;
        this.lastStandUsed = false;
        this.speedBonus = 0;
        this.footstepTimer = 0;
        this.staggerX = 0; this.staggerY = 0; this.staggerTimer = 0;
        // Hip-bobbing tracking
        this.prevX = x; this.prevY = y; this.velocityMag = 0;
        this.bobPhase = 0; this.bobScale = 1; this.bobRotation = 0;
    }
    get weapon() { return this.weapons[this.currentWeaponIndex]; }
    get currentMag() { return this.weaponMags[this.currentWeaponIndex]; }
    set currentMag(v) { this.weaponMags[this.currentWeaponIndex] = v; }

    addPerk(perk) {
        if (this.perks.length >= CONFIG.perks.maxPerks) return false;
        if (this.perks.find(p => p.id === perk.id)) return false;
        this.perks.push(perk);
        perk.effect(this);
        return true;
    }

    applyUpgrades(persistence) {
        if (!persistence || !persistence.data) return;
        const levels = persistence.data.upgradeLevels || {};
        for (const upgrade of CONFIG.shop.upgrades) {
            const level = levels[upgrade.id] || 0;
            if (level <= 0) continue;
            if (upgrade.weapon) {
                // Weapon upgrade
                const weaponIndex = this.weapons.findIndex(w => w.name.toLowerCase() === upgrade.weapon);
                if (weaponIndex >= 0) {
                    this.weapons[weaponIndex][upgrade.stat] += upgrade.value * level;
                }
            } else {
                // Player stat upgrade
                if (upgrade.stat === 'maxHP') { this.maxHP += upgrade.value * level; this.hp = this.maxHP; }
                else if (upgrade.stat === 'maxStamina') { this.maxStamina += upgrade.value * level; this.stamina = this.maxStamina; }
                else if (upgrade.stat === 'speedBonus') { this.speedBonus += upgrade.value * level; }
                else if (upgrade.stat === 'healPerKill') { this.healPerKill += upgrade.value * level; }
                else if (upgrade.stat === 'ammoMultiplier') { this.ammoMultiplier += upgrade.value * level; }
                else if (upgrade.stat === 'explosionMult') { this.explosionMult += upgrade.value * level; }
            }
        }
    }

    update(dt, input, cameraOffset, canvasWidth, canvasHeight, obstacles, barbedWires) {
        if (!this.alive) return;
        // Aim direction: touch joystick or mouse
        const aimAngle = input.getAimAngle ? input.getAimAngle(this.x, this.y, cameraOffset) : null;
        if (aimAngle !== null) {
            this.angle = aimAngle;
        } else {
            const mouseWorldX = input.mouse.x + cameraOffset.x, mouseWorldY = input.mouse.y + cameraOffset.y;
            this.angle = Math.atan2(mouseWorldY - this.y, mouseWorldX - this.x);
        }
        if (this.muzzleFlash > 0) this.muzzleFlash -= dt * 1000;
        if (this.hitFlash > 0) this.hitFlash -= dt * 1000;
        if (this.recoilOffset > 0) this.recoilOffset = Math.max(0, this.recoilOffset - dt * 30);
        if (this.invulnTimer > 0) { this.invulnTimer -= dt * 1000; if (this.invulnTimer <= 0) this.isInvulnerable = false; }
        this.inBarbedWire = false;
        for (const wire of barbedWires) if (wire.containsPoint(this.x, this.y)) { this.inBarbedWire = true; break; }

        // Reload
        if (this.isReloading) {
            this.reloadTimer -= dt * 1000;
            if (this.reloadTimer <= 0) this._finishReload();
        }
        // Auto-reload pending (replaces setTimeout for magazine-empty reload)
        if (this._autoReloadPending) {
            this._autoReloadDelay -= dt * 1000;
            if (this._autoReloadDelay <= 0) {
                this._autoReloadPending = false;
                if (this.alive && !this.isReloading) this._startReload();
            }
        }

        // Weapon switching (Phase 7: limited to carried weapons)
        for (let i = 0; i < this.carriedWeaponIndices.length; i++) {
            if (this.carriedWeaponIndices[i] !== -1) {
                const keyNum = (i + 1).toString();
                if (input.justPressed('Digit' + keyNum) && this.currentWeaponIndex !== this.carriedWeaponIndices[i]) {
                    this._switchWeapon(this.carriedWeaponIndices[i]);
                }
            }
        }
        if (input.mouse.wheel !== 0) {
            const curCarryIdx = this.carriedWeaponIndices.indexOf(this.currentWeaponIndex);
            const nextCarryIdx = (curCarryIdx + (input.mouse.wheel > 0 ? 1 : -1) + this.carriedWeaponIndices.length) % this.carriedWeaponIndices.length;
            const nextWeaponIdx = this.carriedWeaponIndices[nextCarryIdx];
            if (nextWeaponIdx !== -1 && nextWeaponIdx !== this.currentWeaponIndex) {
                this._switchWeapon(nextWeaponIdx);
            }
            input.mouse.wheel = 0;
        }
        // Drop weapon (Phase 7)
        if (input.justPressed(CONFIG.weaponCarry.dropKey)) {
            this._dropCurrentWeapon(game);
        }

        // Manual reload
        if (input.justPressed('KeyR') && !this.isReloading && this.currentMag < this.weapon.magSize && this.weapon.reserveAmmo > 0) {
            this._startReload();
        }

        // Phase 7: Active ability key handling
        if (CONFIG.abilities.grenade && input.justPressed(CONFIG.abilities.grenade.key)) {
            this.tryUseAbility('grenade', game);
        }
        if (CONFIG.abilities.shield && input.justPressed(CONFIG.abilities.shield.key)) {
            this.tryUseAbility('shield', game);
        }
        if (CONFIG.abilities.adrenaline && input.justPressed(CONFIG.abilities.adrenaline.key)) {
            this.tryUseAbility('adrenaline', game);
        }

        // Phase 7: Ability cooldown updates
        for (const key in this.abilities) {
            const ab = this.abilities[key];
            if (!ab.ready) {
                ab.cooldown -= dt * 1000;
                if (ab.cooldown <= 0) ab.ready = true;
            }
            if (ab.active) {
                ab.timer -= dt * 1000;
                if (ab.timer <= 0) ab.active = false;
            }
        }

        if (this.isDodging) this._updateDodge(dt, obstacles);
        else {
            if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;
            // Fade out dodge trails
            for (let i = this.rollTrail.length - 1; i >= 0; i--) {
                const t = this.rollTrail[i];
                if (t.fading) {
                    t.age += dt;
                    t.alpha = Math.max(0, 0.35 - t.age * 1.5);
                    if (t.alpha <= 0) this.rollTrail.splice(i, 1);
                }
            }
            this._updateMovement(dt, input, obstacles, barbedWires);
        }
        this.x = clamp(this.x, this.radius, CONFIG.world.width - this.radius);
        this.y = clamp(this.y, this.radius, CONFIG.world.height - this.radius);

        // Hip-bobbing: track velocity for organic movement wobble
        const dx = this.x - this.prevX, dy = this.y - this.prevY;
        this.velocityMag = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 0.001);
        this.prevX = this.x; this.prevY = this.y;
        if (this.velocityMag > 10) {
            const bobSpeed = 8 + Math.min(this.velocityMag / 50, 8);
            this.bobPhase += dt * bobSpeed;
            this.bobScale = 1 + Math.sin(this.bobPhase) * 0.025;
            this.bobRotation = Math.sin(this.bobPhase * 0.5) * 0.04;
        } else {
            this.bobScale = lerp(this.bobScale, 1, dt * 5);
            this.bobRotation = lerp(this.bobRotation, 0, dt * 5);
        }
    }

    _switchWeapon(index) {
        if (this.isReloading) return; // Can't switch while reloading
        this.currentWeaponIndex = index;
        this.isReloading = false; this.reloadTimer = 0;
        this._autoReloadPending = false;
        // Magician perk: auto-reload on switch
        if (this.autoReloadOnSwitch && this.currentMag < this.weapon.magSize && this.weapon.reserveAmmo > 0) {
            this._startReload();
        }
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('weaponSwitch');
    }

    // Phase 7: Drop current weapon (opens slot for new weapon)
    _dropCurrentWeapon(game) {
        if (this.carriedWeaponIndices.length <= 1) return; // Must keep at least 1 weapon
        const idx = this.carriedWeaponIndices.indexOf(this.currentWeaponIndex);
        if (idx === -1) return;
        // Drop weapon as pickup on ground
        const wpn = this.weapons[this.currentWeaponIndex];
        game.effects.push({
            x: this.x, y: this.y, weaponName: wpn.name,
            radius: 10, age: 0, life: 15000, active: true,
            bobPhase: 0, color: wpn.bulletColor || '#FFD700',
            update(dt) {
                this.bobPhase += dt*3; this.age += dt*1000;
                if (this.age > this.life) this.active = false;
            },
            render(ctx, cam) {
                const sx=this.x-cam.x, sy=this.y-cam.y+Math.sin(this.bobPhase)*4;
                const a = Math.max(0.3, 1-this.age/this.life);
                ctx.globalAlpha=a;
                ctx.beginPath(); ctx.arc(sx,sy,this.radius,0,Math.PI*2);
                ctx.fillStyle=this.color; ctx.fill();
                ctx.fillStyle='#FFF'; ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText('W',sx,sy);
                ctx.globalAlpha=1;
            }
        });
        // Remove from carried weapons
        this.carriedWeaponIndices.splice(idx, 1);
        // Switch to first carried weapon
        if (this.carriedWeaponIndices.length > 0) {
            this._switchWeapon(this.carriedWeaponIndices[0]);
        }
    }

    // Phase 7: Pick up a weapon from the ground
    pickupWeapon(weaponIndex, game) {
        if (this.carriedWeaponIndices.includes(weaponIndex)) return false;
        // Check if we have room
        const emptySlot = this.carriedWeaponIndices.indexOf(-1);
        if (emptySlot !== -1) {
            this.carriedWeaponIndices[emptySlot] = weaponIndex;
            this._switchWeapon(weaponIndex);
            return true;
        }
        // No room - need to drop current
        if (this.carriedWeaponIndices.length >= this.maxWeaponSlots) {
            // Auto-swap: drop current, pick up new
            this._dropCurrentWeapon(game);
            this.carriedWeaponIndices.push(weaponIndex);
            this._switchWeapon(weaponIndex);
            return true;
        }
        this.carriedWeaponIndices.push(weaponIndex);
        this._switchWeapon(weaponIndex);
        return true;
    }

    _startReload() {
        this.isReloading = true;
        this.reloadDuration = this.weapon.reloadTime;
        this.reloadTimer = this.weapon.reloadTime;
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('reload');
    }

    _finishReload() {
        const needed = this.weapon.magSize - this.currentMag;
        const available = Math.min(needed, this.weapon.reserveAmmo);
        this.currentMag += available;
        this.weapon.reserveAmmo -= available;
        this.isReloading = false; this.reloadTimer = 0;
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('reloadComplete');
    }

    tryShoot() {
        if (this.isReloading) return null;
        const now = performance.now();
        if (now - this.lastShotTime >= this.weapon.fireRate) {
            if (this.currentMag <= 0) {
                // Empty click
                if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('empty');
                if (this.weapon.reserveAmmo > 0) this._startReload();
                this.lastShotTime = now;
                return null;
            }
            this.lastShotTime = now;
            this.currentMag--;
            this.recoilOffset = this.weapon.recoil;
            // Auto-reload when empty (flag-based, runs in game loop)
            if (this.currentMag <= 0 && this.weapon.reserveAmmo > 0) {
                this._autoReloadPending = true;
                this._autoReloadDelay = 200;
            }
            return this.shoot();
        }
        return null;
    }

    shoot() {
        const w = this.weapon;
        const gunTipX = this.x + Math.cos(this.angle) * (CONFIG.player.gunLength + this.radius * 0.5 - this.recoilOffset);
        const gunTipY = this.y + Math.sin(this.angle) * (CONFIG.player.gunLength + this.radius * 0.5 - this.recoilOffset);
        this.muzzleFlash = w.muzzleFlash;
        const soundName = w.name === 'Shotgun' ? 'shotgun' : w.name === 'Sniper' ? 'sniper' : w.name === 'Rifle' ? 'rifle' : w.name === 'Dual Pistol' ? 'shoot' : w.name === 'Flamethrower' ? 'flame' : 'shoot';
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound(soundName);
        // Flamethrower: stream weapon, no bullets
        if (w.isFlame) {
            return null; // Handled by FlameStream system
        }
        if (w.pellets) {
            // Shotgun: multiple pellets
            const bullets = [];
            for (let i = 0; i < w.pellets; i++) {
                const spread = (Math.random() - 0.5) * w.spread * 2;
                bullets.push(new Bullet(gunTipX, gunTipY, this.angle + spread, w.bulletSpeed, w.bulletRadius, w.bulletColor, w.damage));
            }
            return bullets;
        }
        // Rocket: explosive bullet
        if (w.explosive) {
            return [new Bullet(gunTipX, gunTipY, this.angle, w.bulletSpeed, w.bulletRadius, w.bulletColor, w.damage, true, w.explosionRadius, w.explosionDamage)];
        }
        // Dual wield: alternate barrels, each shot from one side
        if (w.dualWield) {
            const perpAngle = this.angle + Math.PI / 2;
            const barrelOffset = this._dualBarrel === 0 ? 4 : -4;
            const ox = Math.cos(perpAngle) * barrelOffset;
            const oy = Math.sin(perpAngle) * barrelOffset;
            this._dualBarrel = 1 - this._dualBarrel;
            const spread = (Math.random() - 0.5) * w.spread * 2;
            return [new Bullet(gunTipX + ox, gunTipY + oy, this.angle + spread, w.bulletSpeed, w.bulletRadius, w.bulletColor, w.damage)];
        }
        const spread = (Math.random() - 0.5) * w.spread * 2;
        return [new Bullet(gunTipX, gunTipY, this.angle + spread, w.bulletSpeed, w.bulletRadius, w.bulletColor, w.damage)];
    }

    takeDamage(amount) {
        if (this.isInvulnerable || !this.alive) return;
        // Last Stand perk
        if (this.lastStand && !this.lastStandUsed && amount >= this.hp) {
            this.lastStandUsed = true;
            this.hp = Math.ceil(this.maxHP * 0.3);
            this.isInvulnerable = true; this.invulnTimer = 2000;
            if (typeof game !== 'undefined' && game && game.addEffect) {
                for (let i = 0; i < 20; i++) {
                    const angle = (Math.PI * 2 / 20) * i;
                    game.addEffect({
                        x: this.x, y: this.y, vx: Math.cos(angle) * 100, vy: Math.sin(angle) * 100,
                        life: 500, age: 0, size: 4, color: '#FF0000', active: true,
                        update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                        render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
                    });
                }
            }
            return;
        }
        this.hp = Math.max(0, this.hp - amount);
        this.hitFlash = 200; this.isInvulnerable = true; this.invulnTimer = CONFIG.player.invulnTime;
        // Stagger knockback
        if (typeof game !== 'undefined' && game && game.player) {
            const knockAngle = Math.atan2(this.y - (game.input.mouse.y + game.camera.getOffset().y), this.x - (game.input.mouse.x + game.camera.getOffset().x));
            this.staggerX = Math.cos(knockAngle) * 8;
            this.staggerY = Math.sin(knockAngle) * 8;
            this.staggerTimer = 150;
            this.x += this.staggerX; this.y += this.staggerY;
        }
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('playerHit');
        if (this.hp <= 0) this.alive = false;
    }
    heal(amount) { this.hp = Math.min(this.maxHP, this.hp + amount); }
    restoreStamina(amount) { this.stamina = Math.min(this.maxStamina, this.stamina + amount); }

    // Phase 7: Active ability system
    tryUseAbility(abilityName, game) {
        const ab = this.abilities[abilityName];
        if (!ab || !ab.ready || ab.active) return false;
        ab.ready = false;
        ab.cooldown = abilityName === 'shield' ? ab.maxCooldown * this.shieldCooldownBonus : ab.maxCooldown;
        switch (abilityName) {
            case 'grenade': this._useGrenade(game); break;
            case 'shield': this._useShield(game); break;
            case 'adrenaline': this._useAdrenaline(game); break;
        }
        return true;
    }
    _useGrenade(game) {
        const cfg = CONFIG.abilities.grenade;
        const radius = cfg.radius * this.grenadeRadiusBonus;
        const damage = cfg.damage * this.grenadeDamageBonus;
        // Create grenade projectile
        const grn = {
            x: this.x + Math.cos(this.angle) * (this.radius + 10),
            y: this.y + Math.sin(this.angle) * (this.radius + 10),
            vx: Math.cos(this.angle) * cfg.throwSpeed,
            vy: Math.sin(this.angle) * cfg.throwSpeed,
            radius: 6, age: 0, active: true, bounces: 0,
            maxBounces: cfg.bounces, fuseTimer: cfg.fuseTime,
            explosionRadius: radius, damage: damage * this.explosionMult,
            trail: [],
            update(dt) {
                this.vy += 300 * dt; // Gravity
                this.x += this.vx * dt; this.y += this.vy * dt;
                this.age += dt * 1000; this.fuseTimer -= dt * 1000;
                if (this.x < 20 || this.x > CONFIG.world.width-20) { this.vx *= -0.5; this.bounces++; }
                if (this.y < 20 || this.y > CONFIG.world.height-20) { this.vy *= -0.5; this.bounces++; }
                if (this.fuseTimer <= 0) {
                    this.active = false;
                    game.createExplosion(this.x, this.y, this.explosionRadius, this.damage, false);
                }
                this.trail.push({x:this.x,y:this.y});
                if (this.trail.length > 8) this.trail.shift();
            },
            render(ctx, cam) {
                const sx=this.x-cam.x, sy=this.y-cam.y;
                ctx.globalAlpha=0.3;
                for (const t of this.trail) {
                    ctx.fillStyle='#FFAA00';
                    ctx.beginPath(); ctx.arc(t.x-cam.x,t.y-cam.y,3,0,Math.PI*2); ctx.fill();
                }
                ctx.globalAlpha=1;
                ctx.beginPath(); ctx.arc(sx,sy,this.radius,0,Math.PI*2);
                ctx.fillStyle='#5A4A2A'; ctx.fill();
                ctx.strokeStyle='#333'; ctx.lineWidth=1.5; ctx.stroke();
                // Fuse spark
                const spark = Math.sin(performance.now()*0.05)*3;
                ctx.fillStyle='#FF6600';
                ctx.beginPath(); ctx.arc(sx+2,sy-3+spark,2,0,Math.PI*2); ctx.fill();
            }
        };
        game.effects.push(grn);
        if (game.soundManager) game.soundManager.playSound('shoot');
    }
    _useShield(game) {
        this.abilities.shield.active = true;
        this.abilities.shield.timer = this.abilities.shield.duration;
        if (game.soundManager) game.soundManager.playSound('menuSelect');
        // Shield visual effect
        if (game.addEffect) {
            game.addEffect({
                x: this.x, y: this.y, angle: this.angle, age: 0, active: true, player: this,
                _shieldAge: this.abilities.shield.duration,
                update(dt) {
                    this._shieldAge -= dt * 1000;
                    this.x = this.player.x; this.y = this.player.y;
                    this.angle = this.player.angle;
                    if (this._shieldAge <= 0 || !this.player.abilities.shield.active) this.active = false;
                },
                render(ctx, cam) {
                    const sx=this.x-cam.x, sy=this.y-cam.y;
                    const w=CONFIG.abilities.shield.width;
                    const blockAngle=CONFIG.abilities.shield.blockAngle;
                    const pulse=0.6+Math.sin(performance.now()*0.01)*0.4;
                    ctx.save(); ctx.translate(sx,sy); ctx.rotate(this.angle);
                    // Shield arc
                    ctx.globalAlpha=0.3*pulse;
                    ctx.beginPath(); ctx.moveTo(10,0);
                    ctx.arc(0,0,w,-blockAngle/2,blockAngle/2);
                    ctx.closePath();
                    ctx.fillStyle='rgba(50,100,255,0.5)'; ctx.fill();
                    ctx.strokeStyle='rgba(100,150,255,0.7)'; ctx.lineWidth=2; ctx.stroke();
                    // Shield border glow
                    ctx.globalAlpha=0.2*pulse;
                    ctx.beginPath(); ctx.arc(0,0,w,-blockAngle/2,blockAngle/2);
                    ctx.strokeStyle='rgba(150,200,255,0.6)'; ctx.lineWidth=4; ctx.stroke();
                    ctx.globalAlpha=1;
                    ctx.restore();
                }
            });
        }
    }
    _useAdrenaline(game) {
        this.abilities.adrenaline.active = true;
        const extraDuration = this.adrenalineDurationBonus || 0;
        this.abilities.adrenaline.timer = this.abilities.adrenaline.duration + extraDuration;
        if (game.soundManager) game.soundManager.playSound('bossWarning');
        // Visual: screen tint effect
        if (game.screenFlash) {
            game.screenFlash.alpha = 0.3;
            game.screenFlash.color = '#4488FF';
            game.screenFlash.decay = 0.5;
        }
    }
    isAdrenalineActive() {
        return this.abilities.adrenaline.active;
    }
    getSlowFactor() {
        return this.isAdrenalineActive() ? this.abilities.adrenaline.slowFactor : 1;
    }

    addAmmo(pickupAmount) {
        const mult = this.ammoMultiplier || 1;
        for (const w of this.weapons) {
            const maxReserve = CONFIG.weapons.find(cw => cw.name === w.name).reserveAmmo;
            w.reserveAmmo = Math.min(maxReserve, w.reserveAmmo + Math.ceil(maxReserve * pickupAmount * mult));
        }
    }

    _updateMovement(dt, input, obstacles, barbedWires) {
        let moveX = 0, moveY = 0;
        if (input.isKey('KeyW') || input.isKey('ArrowUp')) moveY -= 1;
        if (input.isKey('KeyS') || input.isKey('ArrowDown')) moveY += 1;
        if (input.isKey('KeyA') || input.isKey('ArrowLeft')) moveX -= 1;
        if (input.isKey('KeyD') || input.isKey('ArrowRight')) moveX += 1;
        // Virtual joystick input (Phase 6)
        const joyMove = input.getMoveVector ? input.getMoveVector() : null;
        if (joyMove) { moveX += joyMove.x; moveY += joyMove.y; }
        if (moveX !== 0 || moveY !== 0) { const len = Math.sqrt(moveX * moveX + moveY * moveY); moveX /= len; moveY /= len; }
        const wantsToSprint = input.isKey('ShiftLeft') || input.isKey('ShiftRight') || (input.touchButtons && input.touchButtons.isPressed('sprint'));
        this.isSprinting = wantsToSprint && this.stamina > 0 && (moveX !== 0 || moveY !== 0);
        let baseSpeed = CONFIG.player.baseSpeed * (1 + this.speedBonus);
        let speed = this.isSprinting ? baseSpeed * 1.625 : baseSpeed;
        // Gameplay event speed boost
        if (typeof game !== 'undefined' && game.events) speed *= game.events.getSpeedMultiplier();
        if (this.inBarbedWire) { speed *= CONFIG.barbedWire.slowFactor; this.hp = Math.max(0, this.hp - CONFIG.barbedWire.damagePerSecond * dt); if (this.hp <= 0) this.alive = false; }
        this.x += moveX * speed * dt; this._resolveCollisions(obstacles, 'x');
        this.y += moveY * speed * dt; this._resolveCollisions(obstacles, 'y');

        // Footstep particles
        if ((moveX !== 0 || moveY !== 0) && typeof game !== 'undefined' && game && game.addEffect) {
            const stepInterval = this.isSprinting ? 0.15 : 0.25;
            this.footstepTimer += dt;
            if (this.footstepTimer >= stepInterval) {
                this.footstepTimer = 0;
                game.addEffect({
                    x: this.x + (Math.random() - 0.5) * 8, y: this.y + (Math.random() - 0.5) * 8,
                    vx: 0, vy: 0, life: 300, age: 0, size: 3 + Math.random() * 3,
                    color: this.isSprinting ? '#8B7355' : '#7A6548', active: true,
                    update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                    render(ctx, cam) { const a = (1 - this.age / this.life) * 0.4; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.size * (1 + this.age / this.life), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
                });
            }
        }

        // Stagger decay
        if (this.staggerTimer > 0) {
            this.staggerTimer -= dt * 1000;
            this.staggerX *= 0.9; this.staggerY *= 0.9;
        } else { this.staggerX = 0; this.staggerY = 0; }

        if (this.isSprinting) { this.stamina = Math.max(0, this.stamina - CONFIG.stamina.drainRate * dt); this.staminaRegenTimer = 0; }
        else { if (this.stamina < this.maxStamina) { this.staminaRegenTimer += dt; if (this.staminaRegenTimer >= CONFIG.stamina.regenDelay) this.stamina = Math.min(this.maxStamina, this.stamina + CONFIG.stamina.regenRate * dt); } }
        const wantDodge = input.isKey('Space') || (input.touchButtons && input.touchButtons.isPressed('dodge'));
        if (wantDodge && this.dodgeCooldown <= 0 && !this.isDodging) this._startDodge(moveX, moveY);
    }
    _resolveCollisions(obstacles, axis) {
        for (const obs of obstacles) {
            if (!obs.isSolid()) continue;
            const b = obs.getBounds();
            const result = resolveCircleRect(this.x, this.y, this.radius, b.x, b.y, b.w, b.h);
            if (result) { if (axis === 'x') this.x = result.x; else this.y = result.y; }
        }
    }
    _startDodge(moveX, moveY) {
        this.isDodging = true; this.isInvulnerable = true; this.invulnTimer = CONFIG.dodge.duration * 1000;
        this.dodgeTimer = CONFIG.dodge.duration;
        const dodgeCooldownMult = 1 - (this.dodgeCooldownBonus || 0);
        this.dodgeCooldown = CONFIG.dodge.cooldown * Math.max(0.1, dodgeCooldownMult);
        if (moveX !== 0 || moveY !== 0) { const len = Math.sqrt(moveX * moveX + moveY * moveY); this.dodgeDirection.x = moveX / len; this.dodgeDirection.y = moveY / len; }
        else { this.dodgeDirection.x = Math.cos(this.angle); this.dodgeDirection.y = Math.sin(this.angle); }
        this.rollTrail = [];
        if (typeof game !== 'undefined' && game && game.soundManager) game.soundManager.playSound('dodge');
    }
    _updateDodge(dt, obstacles) {
        this.dodgeTimer -= dt;
        if (game.graphicsQuality !== 'low') {
            this.rollTrail.push({ x: this.x, y: this.y, alpha: CONFIG.dodge.trailAlpha, age: 0 });
            if (this.rollTrail.length > CONFIG.dodge.trailCount) this.rollTrail.shift();
        }
        const dodgeSpeed = CONFIG.player.baseSpeed * CONFIG.dodge.speedMultiplier;
        this.x += this.dodgeDirection.x * dodgeSpeed * dt; this.y += this.dodgeDirection.y * dodgeSpeed * dt;
        this._resolveCollisions(obstacles, 'x'); this._resolveCollisions(obstacles, 'y');
        if (this.dodgeTimer <= 0) {
            this.isDodging = false; this.isInvulnerable = false; this.invulnTimer = 0;
            // Mark trails for fade-out
            for (const t of this.rollTrail) { t.fading = true; t.alpha = 0.35; }
        }
    }
    render(ctx, cameraOffset, quality) {
        if (!this.alive) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Roll trails - ghost after-images
        if (this.rollTrail.length > 0) {
            for (let i = 0; i < this.rollTrail.length; i++) {
                const trail = this.rollTrail[i];
                const tx = trail.x - cameraOffset.x, ty = trail.y - cameraOffset.y;
                // Decreasing alpha based on position in trail (oldest = faintest)
                const trailAlpha = trail.alpha * (0.3 + (i / this.rollTrail.length) * 0.7);
                ctx.save(); ctx.globalAlpha = trailAlpha; ctx.translate(tx, ty); ctx.rotate(this.angle);
                // Slight scale down for older ghosts
                const ghostScale = 0.85 + (i / this.rollTrail.length) * 0.15;
                ctx.scale(ghostScale, ghostScale);
                this._drawBody(ctx, true, quality); ctx.restore();
            }
        }
        ctx.save();
        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + CONFIG.player.shadowOffsetX, sy + CONFIG.player.shadowOffsetY, this.radius * 0.9, this.radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
        }
        ctx.translate(sx, sy); ctx.rotate(this.angle);
        // Hip-bobbing: organic scale/rotation wobble
        if (this.bobScale !== 1 || this.bobRotation !== 0) {
            ctx.scale(this.bobScale, 2 - this.bobScale); // Squash/stretch
            ctx.rotate(this.bobRotation);
        }
        if (this.isInvulnerable) ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
        if (this.hitFlash > 0) ctx.globalAlpha = 0.7 + Math.sin(performance.now() * 0.03) * 0.3;
        this._drawBody(ctx, false, quality);
        if (this.muzzleFlash > 0) this._drawMuzzleFlash(ctx, quality);
        ctx.restore(); ctx.globalAlpha = 1;
    }
    _drawBody(ctx, isTrail, quality) {
        const bc = isTrail ? 'rgba(74,93,35,0.5)' : CONFIG.player.bodyColor;
        const hc = isTrail ? 'rgba(61,79,28,0.5)' : CONFIG.player.headColor;
        const gc = isTrail ? 'rgba(44,44,44,0.5)' : CONFIG.player.gunColor;
        const recoil = isTrail ? 0 : this.recoilOffset;
        const r = this.radius;
        const t = performance.now() * 0.001;
        const breathe = Math.sin(t * 2) * 0.5; // Subtle breathing
        const isMoving = !isTrail && (this.isSprinting || this.isDodging);
        const bob = isMoving ? Math.sin(t * 6) * 1 : 0;

        // Damage state
        const damageRatio = 1 - (this.hp / this.maxHP);

        // === MAIN BODY (The Ball - with soul) ===
        // Outer glow (alive feeling)
        if (!isTrail && quality !== 'low') {
            const glowAlpha = 0.15 + breathe * 0.05;
            const glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.5);
            glow.addColorStop(0, `rgba(100,140,60,${glowAlpha})`);
            glow.addColorStop(1, 'rgba(100,140,60,0)');
            ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = glow; ctx.fill();
        }

        // Body circle
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bc; ctx.fill();
        ctx.strokeStyle = '#2C3518'; ctx.lineWidth = 2; ctx.stroke();

        // Inner shading (3D feel)
        if (!isTrail) {
            const innerGlow = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
            innerGlow.addColorStop(0, 'rgba(255,255,255,0.15)');
            innerGlow.addColorStop(0.5, 'rgba(0,0,0,0)');
            innerGlow.addColorStop(1, 'rgba(0,0,0,0.2)');
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = innerGlow; ctx.fill();
        }

        // === TACTICAL VEST (Simple overlay on ball) ===
        if (!isTrail && quality !== 'low') {
            ctx.fillStyle = 'rgba(55,50,30,0.6)';
            ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.6, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();

            // Ammo pouches
            ctx.fillStyle = 'rgba(45,40,25,0.7)';
            ctx.fillRect(-r * 0.35, -r * 0.3, r * 0.12, r * 0.2);
            ctx.fillRect(-r * 0.35, r * 0.1, r * 0.12, r * 0.2);

            // Radio
            ctx.fillStyle = '#333';
            ctx.fillRect(r * 0.15, r * 0.3, r * 0.15, r * 0.18);
            // Radio antenna
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(r * 0.25, r * 0.3); ctx.lineTo(r * 0.3, r * 0.1); ctx.stroke();
            // Radio LED (blinking)
            ctx.fillStyle = Math.sin(t * 3) > 0 ? '#0F0' : '#060';
            ctx.beginPath(); ctx.arc(r * 0.22, r * 0.38, 1.5, 0, Math.PI * 2); ctx.fill();
        }

        // === WEAPON ===
        ctx.save();
        const gunStartX = r * 0.3 - recoil;
        const w = this.weapon;

        if (w.name === 'Shotgun') {
            ctx.fillStyle = '#5A3A1A'; ctx.fillRect(gunStartX - 8, -4, 12, 8);
            ctx.fillStyle = '#333'; ctx.fillRect(gunStartX + 4, -3, 18, 6);
            ctx.fillStyle = '#444'; ctx.fillRect(gunStartX + 22, -2, r + 5, 4);
            ctx.fillStyle = '#5A3A1A'; ctx.fillRect(gunStartX + 12, -4, 8, 8);
        } else if (w.name === 'Sniper') {
            ctx.fillStyle = '#3A3A2A'; ctx.fillRect(gunStartX - 12, -3, 16, 6);
            ctx.fillStyle = '#333'; ctx.fillRect(gunStartX + 4, -2, 22, 4);
            ctx.fillStyle = '#444'; ctx.fillRect(gunStartX + 26, -2, r + 10, 4);
            ctx.fillStyle = '#222'; ctx.fillRect(gunStartX + 8, -7, 14, 4);
            ctx.fillStyle = 'rgba(100,150,255,0.4)';
            ctx.beginPath(); ctx.arc(gunStartX + 10, -5, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(gunStartX + 20, -5, 1.5, 0, Math.PI * 2); ctx.fill();
        } else if (w.name === 'SMG') {
            ctx.fillStyle = '#333'; ctx.fillRect(gunStartX - 6, -2, 8, 4);
            ctx.fillStyle = '#444'; ctx.fillRect(gunStartX + 2, -2, 16, 4);
            ctx.fillStyle = '#555'; ctx.fillRect(gunStartX + 18, -2, r + 5, 4);
            ctx.fillStyle = '#222'; ctx.fillRect(gunStartX + 6, 2, 5, 8);
        } else if (w.name === 'Rocket') {
            ctx.fillStyle = '#4A4A3A'; ctx.fillRect(gunStartX - 4, -5, r + 22, 10);
            ctx.fillStyle = '#FF4400'; ctx.beginPath(); ctx.arc(gunStartX + r + 18, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#555'; ctx.fillRect(gunStartX + 4, -7, 8, 2);
            ctx.fillStyle = '#FF0'; ctx.fillRect(gunStartX + 12, -5, 2, 10);
        } else if (w.name === 'Rifle') {
            ctx.fillStyle = '#3A3A2A'; ctx.fillRect(gunStartX - 8, -3, 12, 6);
            ctx.fillStyle = '#333'; ctx.fillRect(gunStartX + 4, -2, 18, 4);
            ctx.fillStyle = '#444'; ctx.fillRect(gunStartX + 22, -2, r + 5, 4);
            ctx.fillStyle = '#222'; ctx.fillRect(gunStartX + 8, 2, 5, 8);
            ctx.fillStyle = '#555'; ctx.fillRect(gunStartX + r + 22, -2, 6, 4);
        } else if (w.name === 'Flamethrower') {
            // Fuel tank
            ctx.fillStyle = '#444'; ctx.fillRect(gunStartX - 10, -6, 14, 12);
            ctx.fillStyle = '#FF6600'; ctx.fillRect(gunStartX - 8, -4, 3, 8);
            // Hose
            ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(gunStartX + 4, 0); ctx.lineTo(gunStartX + 12, 0); ctx.stroke();
            // Wide nozzle
            ctx.fillStyle = '#333'; ctx.fillRect(gunStartX + 12, -5, 10, 10);
            ctx.fillStyle = '#222'; ctx.beginPath();
            ctx.moveTo(gunStartX + 22, -6); ctx.lineTo(gunStartX + r + 10, -3);
            ctx.lineTo(gunStartX + r + 10, 3); ctx.lineTo(gunStartX + 22, 6);
            ctx.closePath(); ctx.fill();
            // Nozzle tip glow
            ctx.fillStyle = '#FF4400'; ctx.beginPath(); ctx.arc(gunStartX + r + 10, 0, 2, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = gc;
            ctx.fillRect(gunStartX, -CONFIG.player.gunWidth / 2, CONFIG.player.gunLength, CONFIG.player.gunWidth);
        }
        ctx.restore();

        // === NVG HELMET (The "face" of the ball) ===
        const headX = r * 0.25;
        const headR = r * 0.42;

        // Helmet base
        ctx.beginPath(); ctx.arc(headX, 0, headR, 0, Math.PI * 2);
        ctx.fillStyle = hc; ctx.fill();
        ctx.strokeStyle = 'rgba(30,40,15,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();

        if (!isTrail && quality !== 'low') {
            // NVG mount on helmet
            ctx.fillStyle = '#2A2A2A';
            ctx.fillRect(headX + headR * 0.2, -3, 5, 6);

            // NVG device (dual tubes)
            ctx.fillStyle = '#1A1A1A';
            ctx.fillRect(headX + headR * 0.5, -5, 8, 4);
            ctx.fillRect(headX + headR * 0.5, 1, 8, 4);
            // NVG lenses (green glow)
            ctx.fillStyle = 'rgba(0,255,0,0.3)';
            ctx.beginPath(); ctx.arc(headX + headR * 0.5 + 8, -3, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(headX + headR * 0.5 + 8, 3, 2, 0, Math.PI * 2); ctx.fill();

            // Helmet rim
            ctx.strokeStyle = 'rgba(40,55,25,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(headX, 0, headR + 1, -0.6, 0.6); ctx.stroke();

            // Chin strap
            ctx.strokeStyle = 'rgba(40,35,20,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(headX, headR * 0.4, headR * 0.7, 0.2, Math.PI - 0.2); ctx.stroke();

            // Helmet band
            ctx.strokeStyle = 'rgba(60,70,40,0.4)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(headX, 0, headR * 0.65, -0.3, 0.3); ctx.stroke();
        }

        // === EYES (The soul!) ===
        const eyeX = headX + headR * 0.35;
        const eyeY = 0;
        const eyeSpacing = 3;

        // Eye whites
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.ellipse(eyeX, eyeY - eyeSpacing, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(eyeX, eyeY + eyeSpacing, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();

        // Pupils (look toward mouse - they're already rotated, so forward)
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(eyeX + 1, eyeY - eyeSpacing, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 1, eyeY + eyeSpacing, 1.2, 0, Math.PI * 2); ctx.fill();

        // Eye shine (alive!)
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(eyeX + 1.5, eyeY - eyeSpacing - 0.5, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 1.5, eyeY + eyeSpacing - 0.5, 0.5, 0, Math.PI * 2); ctx.fill();

        // Angry/determined eyebrows when moving
        if (isMoving) {
            ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(eyeX - 1, eyeY - eyeSpacing - 2.5); ctx.lineTo(eyeX + 3, eyeY - eyeSpacing - 1.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(eyeX - 1, eyeY + eyeSpacing + 2.5); ctx.lineTo(eyeX + 3, eyeY + eyeSpacing + 1.5); ctx.stroke();
        }

        // === ACCESSORIES ===
        if (!isTrail && quality !== 'low') {
            // Patch on body (unit insignia)
            ctx.fillStyle = 'rgba(80,70,40,0.7)';
            ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.35, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.35, 2, 0, Math.PI * 2); ctx.fill();

            // Blood stains when damaged
            if (damageRatio > 0.3) {
                ctx.fillStyle = `rgba(120,20,20,${damageRatio * 0.5})`;
                ctx.beginPath(); ctx.ellipse(r * 0.1, -r * 0.15, r * 0.25, r * 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
    _drawMuzzleFlash(ctx, quality) {
        const fx = CONFIG.player.gunLength + this.radius * 0.5 - this.recoilOffset;
        const fr = 12;

        // Flamethrower: wide cone-shaped flame
        if (this.weapon && this.weapon.isFlame) {
            const coneLen = fr * 2.5;
            const coneWidth = fr * 1.8;
            if (quality === 'high') {
                // Multi-layer cone: inner bright, outer dim
                const g = ctx.createLinearGradient(fx, 0, fx + coneLen, 0);
                g.addColorStop(0, 'rgba(255,240,100,0.95)');
                g.addColorStop(0.3, 'rgba(255,160,40,0.8)');
                g.addColorStop(0.7, 'rgba(255,80,0,0.4)');
                g.addColorStop(1, 'rgba(200,30,0,0)');
                ctx.beginPath();
                ctx.moveTo(fx, -coneWidth * 0.15);
                ctx.lineTo(fx + coneLen, -coneWidth);
                ctx.lineTo(fx + coneLen, coneWidth);
                ctx.lineTo(fx, coneWidth * 0.15);
                ctx.closePath(); ctx.fillStyle = g; ctx.fill();
                // Hot core
                const g2 = ctx.createLinearGradient(fx, 0, fx + coneLen * 0.5, 0);
                g2.addColorStop(0, 'rgba(255,255,200,0.9)');
                g2.addColorStop(1, 'rgba(255,200,50,0)');
                ctx.beginPath();
                ctx.moveTo(fx, -coneWidth * 0.08);
                ctx.lineTo(fx + coneLen * 0.5, -coneWidth * 0.35);
                ctx.lineTo(fx + coneLen * 0.5, coneWidth * 0.35);
                ctx.lineTo(fx, coneWidth * 0.08);
                ctx.closePath(); ctx.fillStyle = g2; ctx.fill();
            } else {
                const g = ctx.createLinearGradient(fx, 0, fx + coneLen * 0.8, 0);
                g.addColorStop(0, 'rgba(255,220,60,0.9)');
                g.addColorStop(0.5, 'rgba(255,120,0,0.5)');
                g.addColorStop(1, 'rgba(200,40,0,0)');
                ctx.beginPath();
                ctx.moveTo(fx, -coneWidth * 0.1);
                ctx.lineTo(fx + coneLen * 0.8, -coneWidth * 0.8);
                ctx.lineTo(fx + coneLen * 0.8, coneWidth * 0.8);
                ctx.lineTo(fx, coneWidth * 0.1);
                ctx.closePath(); ctx.fillStyle = g; ctx.fill();
            }
            return;
        }

        // Dual wield: flash from alternating barrel position
        const isDual = this.weapon && this.weapon.dualWield;
        const yOff = isDual ? (this._dualBarrel === 0 ? -4 : 4) : 0;
        if (quality === 'high') {
            const g = ctx.createRadialGradient(fx, yOff, 0, fx, yOff, fr * 1.5);
            g.addColorStop(0, 'rgba(255,220,80,0.95)'); g.addColorStop(0.3, 'rgba(255,160,40,0.7)'); g.addColorStop(0.7, 'rgba(255,100,0,0.3)'); g.addColorStop(1, 'rgba(255,50,0,0)');
            ctx.beginPath(); ctx.arc(fx, yOff, fr * 1.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        } else {
            const g = ctx.createRadialGradient(fx, yOff, 0, fx, yOff, fr);
            g.addColorStop(0, 'rgba(255,200,50,0.9)'); g.addColorStop(0.5, 'rgba(255,150,30,0.5)'); g.addColorStop(1, 'rgba(255,100,0,0)');
            ctx.beginPath(); ctx.arc(fx, yOff, fr, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        }
    }
}

// ============================================================
// ENEMY: MEDIC - Heals nearby enemies
// ============================================================
class EnemyMedic extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'medic');
        const cfg = CONFIG.enemy.medic;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.healRange = cfg.healRange; this.healAmount = cfg.healAmount; this.healCooldown = cfg.healCooldown;
        this.lastHealTime = 0; this.state = 'idle'; this._pickPatrolTarget();
        this.flankTimer = 0; this.flankAngle = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 400, y: this.y + (Math.random() - 0.5) * 400 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawGun(ctx) {
        // Medical pistol
        ctx.fillStyle = this.gunColor; ctx.fillRect(this.radius * 0.3, -2, this.radius + 4, 4);
        ctx.fillStyle = '#FF0000'; ctx.fillRect(this.radius * 0.3 + 2, -1, 4, 2);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Legs
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#3A2A2A';
            ctx.beginPath(); ctx.ellipse(-2, r * 0.55, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, r * 0.55, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Body - white/red medic coat
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Medic coat
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : 'rgba(200,50,50,0.3)';
            ctx.beginPath(); ctx.ellipse(-r * 0.1, 0, r * 0.6, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
            // Red cross
            ctx.fillStyle = isHit ? '#DDD' : '#FF0000';
            ctx.fillRect(-r * 0.15, -r * 0.25, r * 0.3, r * 0.12);
            ctx.fillRect(-r * 0.06, -r * 0.35, r * 0.12, r * 0.3);
        }
        // Arms
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.3, 4, 3.5, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.25, r * 0.3, 4, 3.5, 0.2, 0, Math.PI * 2); ctx.fill();
        // Head - medic helmet with cross
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#4A3A3A'; ctx.fill();
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#8B0000';
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.45, -0.7, 0.7); ctx.fill();
            ctx.fillStyle = '#FFF'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('+', r * 0.3, -r * 0.15);
        }
        this._drawGun(ctx);
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 6000;

        // Heal nearby allies first
        const now = performance.now();
        if (now - this.lastHealTime >= this.healCooldown) {
            for (const ally of game.enemies) {
                if (ally === this || !ally.active || ally.isDying) continue;
                if (ally.hp < ally.maxHp && distance(this.x, this.y, ally.x, ally.y) < this.healRange) {
                    ally.hp = Math.min(ally.maxHp, ally.hp + this.healAmount);
                    this.lastHealTime = now;
                    // Heal effect
                    if (game.addEffect) {
                        game.addEffect({
                            x: ally.x, y: ally.y, vx: 0, vy: -30,
                            life: 600, age: 0, size: 6, color: '#00FF00', active: true,
                            update(dt) { this.y += this.vy * dt; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                            render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
                        });
                    }
                    break;
                }
            }
        }

        if (this.alertTimer > 0 && hasLOS) {
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this.flankTimer -= dt * 1000;
                if (this.flankTimer <= 0) {
                    this.flankTimer = 2500 + Math.random() * 2000;
                    this.flankAngle = this.angle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                }
                const flankX = game.player.x + Math.cos(this.flankAngle) * 120;
                const flankY = game.player.y + Math.sin(this.flankAngle) * 120;
                this._moveToward(flankX, flankY, this.speed * 0.5, dt, game.obstacles);
                if (now - this.lastAttackTime >= this.fireRate) {
                    this.lastAttackTime = now;
                    const spread = (Math.random() - 0.5) * 0.1;
                    game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 10), this.y + Math.sin(this.angle) * (this.radius + 10), this.angle + spread, this.bulletSpeed, this.damage));
                }
            } else {
                this.state = 'chase'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.6, dt, game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: SHIELD - Blocks bullets, protects allies
// ============================================================
class EnemyShield extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'shield');
        const cfg = CONFIG.enemy.shield;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.shieldAngle = 0; this.shieldWidth = Math.PI * 0.8;
        this.state = 'idle'; this._pickPatrolTarget();
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 300, y: this.y + (Math.random() - 0.5) * 300 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    blocksBullets() { return true; }
    // Shield blocks bullets from front
    isBulletBlocked(bulletX, bulletY) {
        const angleToBullet = Math.atan2(bulletY - this.y, bulletX - this.x);
        let diff = angleToBullet - this.shieldAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return Math.abs(diff) < this.shieldWidth / 2;
    }
    _drawGun(ctx) {
        ctx.fillStyle = this.gunColor; ctx.fillRect(this.radius * 0.3, -3, this.radius + 6, 6);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Legs - heavy, slow
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#1A1A2A';
            ctx.beginPath(); ctx.ellipse(-3, r * 0.6, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(3, r * 0.6, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Body - armored
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        // Shield (drawn in front)
        if (quality !== 'low') {
            ctx.save();
            ctx.fillStyle = isHit ? '#DDD' : 'rgba(60,60,120,0.8)';
            ctx.strokeStyle = isHit ? '#EEE' : 'rgba(100,100,180,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(r * 0.5, 0, r * 0.7, -this.shieldWidth / 2, this.shieldWidth / 2);
            ctx.lineTo(r * 0.5, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Shield emblem
            ctx.fillStyle = isHit ? '#CCC' : 'rgba(150,150,255,0.4)';
            ctx.beginPath(); ctx.arc(r * 0.6, 0, 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        // Arms
        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.ellipse(r * 0.4, -r * 0.35, 5, 4, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.2, r * 0.35, 5, 4, 0.2, 0, Math.PI * 2); ctx.fill();
        // Head - riot helmet
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#2A2A3A'; ctx.fill();
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#3A3A5A';
            ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, -0.8, 0.8); ctx.fill();
            // Visor
            ctx.fillStyle = isHit ? '#DDD' : 'rgba(100,100,200,0.4)';
            ctx.beginPath(); ctx.arc(r * 0.35, 0, r * 0.15, -0.4, 0.4); ctx.fill();
        }
        this._drawGun(ctx);
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 8000;
        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            // Shield faces player
            this.shieldAngle = this.angle + Math.PI;
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack';
                // Stay between player and allies
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate) {
                    this.lastAttackTime = now;
                    const spread = (Math.random() - 0.5) * 0.1;
                    game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 10), this.y + Math.sin(this.angle) * (this.radius + 10), this.angle + spread, this.bulletSpeed, this.damage));
                }
                // Hold position, don't advance
            } else {
                this.state = 'chase';
                // Move toward player but stop at medium range
                const targetDist = 200;
                const tx = game.player.x - Math.cos(this.angle) * targetDist;
                const ty = game.player.y - Math.sin(this.angle) * targetDist;
                this._moveToward(tx, ty, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.5, dt, game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: DRONE - Flying, fast, hard to hit
// ============================================================
class EnemyDrone extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'drone');
        const cfg = CONFIG.enemy.drone;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.state = 'idle'; this.hoverPhase = Math.random() * Math.PI * 2;
        this._pickPatrolTarget();
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 500, y: this.y + (Math.random() - 0.5) * 500 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const t = performance.now() * 0.01;
        // Drone: small, flying, rotor blades
        const bodyColor = isHit ? '#FFFFFF' : '#4A4A4A';
        // Rotor blades (spinning)
        if (quality !== 'low') {
            ctx.strokeStyle = isHit ? '#DDD' : 'rgba(150,150,150,0.5)'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) {
                const a = t + (Math.PI / 2) * i;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3); ctx.stroke();
            }
        }
        // Body - compact drone
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Camera/sensor eye
        ctx.fillStyle = isHit ? '#DDD' : '#FF0000';
        ctx.beginPath(); ctx.arc(r * 0.3, 0, 3, 0, Math.PI * 2); ctx.fill();
        // LED indicator
        if (quality !== 'low') {
            const blink = Math.sin(t * 3) > 0 ? 1 : 0.2;
            ctx.fillStyle = `rgba(255,0,0,${blink})`;
            ctx.beginPath(); ctx.arc(-r * 0.4, 0, 2, 0, Math.PI * 2); ctx.fill();
        }
        // Small weapon mount
        ctx.fillStyle = '#555';
        ctx.fillRect(r * 0.3, -1.5, r * 0.6, 3);
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 5000;
        if (this.alertTimer > 0 && hasLOS) {
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                // Hover and strafe
                const hoverX = Math.sin(this.hoverPhase + performance.now() * 0.003) * 50;
                const hoverY = Math.cos(this.hoverPhase + performance.now() * 0.002) * 50;
                this._moveToward(game.player.x + hoverX, game.player.y + hoverY, this.speed * 0.6, dt, game.obstacles);
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate) {
                    this.lastAttackTime = now;
                    const spread = (Math.random() - 0.5) * 0.15;
                    game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 5), this.y + Math.sin(this.angle) * (this.radius + 5), this.angle + spread, this.bulletSpeed, this.damage));
                }
            } else {
                this.state = 'chase'; this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.7, dt, game.obstacles); }
            }
        }
    }
    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        const alpha = this.isDying ? Math.max(0, 1 - this.deathTimer / 500) : 1;
        ctx.save(); ctx.globalAlpha = alpha;
        // Drone shadow (smaller, offset)
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 2, sy + 3, this.radius * 0.6, this.radius * 0.4, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fill();
        }
        ctx.translate(sx, sy); ctx.rotate(this.angle);
        this._drawCharacter(ctx, this.hitFlash > 0, quality);
        ctx.restore(); ctx.globalAlpha = 1;
        // Health bar
        if (this.hp < this.maxHp && !this.isDying) {
            const barW = this.radius * 2, barH = 3;
            ctx.fillStyle = '#222'; ctx.fillRect(sx - barW / 2, sy - this.radius - 8, barW, barH);
            const pct = this.hp / this.maxHp;
            ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FF9800' : '#F44336';
            ctx.fillRect(sx - barW / 2, sy - this.radius - 8, barW * pct, barH);
        }
    }
}

// ============================================================
// ENEMY: TURRET - Stationary, high damage, armored
// ============================================================
class EnemyTurret extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'turret');
        const cfg = CONFIG.enemy.turret;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.state = 'idle'; this.rotationSpeed = cfg.rotationSpeed || 0.03;
        this.x = clamp(x, 50, CONFIG.world.width - 50);
        this.y = clamp(y, 50, CONFIG.world.height - 50);
    }
    isSolid() { return true; } blocksBullets() { return true; }
    getBounds() { return { x: this.x - this.radius, y: this.y - this.radius, w: this.radius * 2, h: this.radius * 2 }; }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Base platform
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
        // Armor plates
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : 'rgba(50,50,50,0.7)';
            ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
            // Bolt details
            ctx.fillStyle = isHit ? '#DDD' : '#555';
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI / 2) * i;
                ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 2, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Rotating barrel
        ctx.save(); ctx.rotate(this.angle);
        ctx.fillStyle = isHit ? '#DDD' : '#444';
        ctx.fillRect(r * 0.2, -4, r + 12, 8);
        ctx.fillStyle = isHit ? '#EEE' : '#555';
        ctx.fillRect(r + 10, -5, 6, 10); // muzzle brake
        ctx.restore();
        // Center sensor
        ctx.fillStyle = isHit ? '#DDD' : '#FF4400';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        // Status light
        if (quality !== 'low') {
            const alert = this.state === 'attack';
            ctx.fillStyle = alert ? '#FF0000' : '#00FF00';
            ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.5, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 10000;
        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack';
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate) {
                    this.lastAttackTime = now;
                    const spread = (Math.random() - 0.5) * 0.06;
                    game.addEnemyBullet(new EnemyBullet(this.x + Math.cos(this.angle) * (this.radius + 14), this.y + Math.sin(this.angle) * (this.radius + 14), this.angle + spread, this.bulletSpeed, this.damage));
                }
            } else {
                this.state = 'idle';
            }
        } else {
            this.state = 'idle';
            // Slow rotation scanning
            this.angle += this.rotationSpeed;
        }
    }
    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        const alpha = this.isDying ? Math.max(0, 1 - this.deathTimer / 500) : 1;
        ctx.save(); ctx.globalAlpha = alpha;
        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 5, sy + 6, this.radius * 0.9, this.radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
        }
        ctx.translate(sx, sy);
        this._drawCharacter(ctx, this.hitFlash > 0, quality);
        ctx.restore(); ctx.globalAlpha = 1;
        // Health bar
        if (this.hp < this.maxHp && !this.isDying) {
            const barW = this.radius * 2, barH = 4;
            ctx.fillStyle = '#222'; ctx.fillRect(sx - barW / 2, sy - this.radius - 10, barW, barH);
            const pct = this.hp / this.maxHp;
            ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FF9800' : '#F44336';
            ctx.fillRect(sx - barW / 2, sy - this.radius - 10, barW * pct, barH);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5; ctx.strokeRect(sx - barW / 2, sy - this.radius - 10, barW, barH);
        }
    }
}

// ============================================================
// PICKUP - Phase 5 with ammo system integration
// ============================================================
class Pickup {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type; this.active = true;
        this.radius = CONFIG.pickup[type].radius;
        this.amount = CONFIG.pickup[type].amount;
        this.color = CONFIG.pickup[type].color;
        this.lifetime = CONFIG.pickup[type].lifetime;
        this.age = 0; this.bobPhase = Math.random() * Math.PI * 2;
        this._collectPulse = 0;
        this._orbitParticles = [];
        for (let i = 0; i < 4; i++) {
            this._orbitParticles.push({
                angle: (Math.PI * 2 / 4) * i,
                dist: this.radius + 6 + Math.random() * 4,
                speed: 1.5 + Math.random() * 1.5,
                size: 1.5 + Math.random() * 1
            });
        }
    }
    update(dt) {
        this.bobPhase += dt * 3; this.age += dt * 1000;
        if (this.age > this.lifetime) this.active = false;
        // Update orbit particles
        for (const p of this._orbitParticles) {
            p.angle += p.speed * dt;
        }
    }
    collect(player) {
        if (!this.active) return false;
        const dx = this.x - player.x, dy = this.y - player.y;
        const rSum = this.radius + player.radius;
        if (dx * dx + dy * dy < rSum * rSum) { this.active = false; return true; }
        return false;
    }
    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling
        const margin = 30;
        if (sx < -margin || sx > ctx.canvas.width + margin || sy < -margin || sy > ctx.canvas.height + margin) return;
        const bob = Math.sin(this.bobPhase) * 4;
        const alpha = this.age > this.lifetime - 2000 ? (this.lifetime - this.age) / 2000 : 1;
        const fadeIn = Math.min(1, this.age / 300);
        ctx.save(); ctx.globalAlpha = alpha * fadeIn;
        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 3, sy + bob + 5, this.radius * 0.9, this.radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
        }
        // Outer glow ring (pulsing)
        const glowPulse = 0.4 + Math.sin(this.bobPhase * 2) * 0.4;
        const outerR = this.radius + 8 + Math.sin(this.bobPhase * 1.5) * 3;
        ctx.beginPath(); ctx.arc(sx, sy + bob, outerR, 0, Math.PI * 2);
        ctx.fillStyle = rgbaFromHex(this.color, 0.08 * glowPulse); ctx.fill();
        // Inner glow
        ctx.beginPath(); ctx.arc(sx, sy + bob, this.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = rgbaFromHex(this.color, 0.2 * glowPulse); ctx.fill();

        // Orbit particles
        if (quality !== 'low') {
            for (const p of this._orbitParticles) {
                const px = sx + Math.cos(p.angle) * p.dist;
                const py = sy + bob + Math.sin(p.angle) * p.dist * 0.6;
                ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fillStyle = rgbaFromHex(this.color, 0.4); ctx.fill();
            }
        }

        // Body
        ctx.beginPath(); ctx.arc(sx, sy + bob, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();

        // Inner gradient for 3D effect
        if (quality !== 'low') {
            const grad = ctx.createRadialGradient(sx - 2, sy + bob - 2, 0, sx, sy + bob, this.radius);
            grad.addColorStop(0, 'rgba(255,255,255,0.3)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
            grad.addColorStop(1, 'rgba(0,0,0,0.15)');
            ctx.beginPath(); ctx.arc(sx, sy + bob, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad; ctx.fill();
        }

        // Highlight
        ctx.beginPath(); ctx.arc(sx - 3, sy + bob - 3, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
        // Icon
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 12px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (this.type === 'health') ctx.fillText('+', sx, sy + bob);
        else if (this.type === 'stamina') ctx.fillText('S', sx, sy + bob);
        else ctx.fillText('A', sx, sy + bob);

        // Type-specific details
        if (quality !== 'low') {
            if (this.type === 'health') {
                // Red cross detail
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(sx - 1, sy + bob - 5, 2, 10);
                ctx.fillRect(sx - 5, sy + bob - 1, 10, 2);
            } else if (this.type === 'stamina') {
                // Lightning bolt detail
                ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(sx - 2, sy + bob - 4); ctx.lineTo(sx + 1, sy + bob); ctx.lineTo(sx - 1, sy + bob); ctx.lineTo(sx + 2, sy + bob + 4); ctx.stroke();
            } else if (this.type === 'ammo') {
                // Bullet shape detail
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath(); ctx.arc(sx, sy + bob - 2, 2, Math.PI, 0); ctx.fill();
                ctx.fillRect(sx - 2, sy + bob - 2, 4, 5);
            }
        }

        ctx.restore(); ctx.globalAlpha = 1;
    }
}

// ============================================================
// ENEMY: BOMBER - Drops proximity mines
// ============================================================
class EnemyBomber extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'bomber');
        const cfg = CONFIG.enemy.bomber;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.fireRate = cfg.fireRate; this.damage = Math.ceil(cfg.damage * dmgMult);
        this.radius = cfg.radius; this.color = cfg.color; this.score = cfg.score;
        this.bodyColor = cfg.bodyColor; this.gunColor = cfg.gunColor;
        this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.mineRadius = cfg.mineRadius; this.mineDamage = Math.ceil((cfg.mineDamage || 50) * dmgMult);
        this.mineLifetime = cfg.mineLifetime || 15000;
        this.state = 'idle'; this._pickPatrolTarget();
        this._mineTimer = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 400, y: this.y + (Math.random() - 0.5) * 400 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Body
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Backpack (mine carrier)
        ctx.fillStyle = isHit ? '#DDD' : '#4A3A2A';
        ctx.fillRect(-r * 0.6, -r * 0.5, r * 0.4, r * 1);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(-r * 0.6, -r * 0.5, r * 0.4, r * 1);
        // Head
        ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#5A4A3A'; ctx.fill();
        // Mine indicator (red circle on backpack)
        ctx.beginPath(); ctx.arc(-r * 0.4, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#FF0000'; ctx.fill();
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 6000;
        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack';
                // Retreat if too close
                if (distToPlayer < this.attackRange * 0.5) {
                    const retreatAngle = this.angle + Math.PI;
                    this._moveToward(this.x + Math.cos(retreatAngle) * 100, this.y + Math.sin(retreatAngle) * 100, this.speed, dt, game.obstacles);
                }
                // Drop mine
                this._mineTimer -= dt * 1000;
                if (this._mineTimer <= 0) {
                    this._mineTimer = this.fireRate;
                    this._dropMine(game);
                }
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.6, dt, game.obstacles); }
            }
        }
    }
    _dropMine(game) {
        const mine = {
            x: this.x, y: this.y, radius: this.mineRadius,
            damage: this.mineDamage, lifetime: this.mineLifetime, age: 0,
            active: true, armed: false, armTimer: 1000,
            update(dt) {
                this.age += dt * 1000;
                this.armTimer -= dt * 1000;
                if (this.armTimer <= 0) this.armed = true;
                if (this.age > this.lifetime) this.active = false;
                // Proximity check
                if (this.armed && this.active) {
                    const dist = distance(this.x, this.y, game.player.x, game.player.y);
                    if (dist < this.radius + game.player.radius) {
                        game.createExplosion(this.x, this.y, this.radius * 2, this.damage, null);
                        this.active = false;
                    }
                }
            },
            render(ctx, cam) {
                const sx = this.x - cam.x, sy = this.y - cam.y;
                const pulse = this.armed ? (0.5 + Math.sin(performance.now() * 0.01) * 0.5) : 0.2;
                // Mine body
                ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
                ctx.fillStyle = this.armed ? '#FF4444' : '#884444'; ctx.fill();
                ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5; ctx.stroke();
                // Danger radius
                ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255,0,0,${pulse * 0.3})`; ctx.lineWidth = 1; ctx.stroke();
                // Blinking light
                if (this.armed && Math.sin(performance.now() * 0.008) > 0) {
                    ctx.beginPath(); ctx.arc(sx, sy - 2, 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#FF0000'; ctx.fill();
                }
            }
        };
        game.effects.push(mine);
        if (game.soundManager) game.soundManager.playSound('pickup');
    }
}

// ============================================================
// ENEMY: NINJA - Stealth melee attacker
// ============================================================
class EnemyNinja extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'ninja');
        const cfg = CONFIG.enemy.ninja;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.detectionRange = cfg.detectionRange; this.meleeRange = cfg.meleeRange;
        this.attackCooldown = cfg.attackCooldown;
        this.stealthAlpha = cfg.stealthAlpha || 0.15;
        this.stealthRevealRange = cfg.stealthRevealRange || 120;
        this.state = 'idle'; this._pickPatrolTarget();
        this._stealthed = true; this._attackTimer = 0; this._dashTimer = 0;
        this._dashCooldown = 0; this._dashTarget = null;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 500, y: this.y + (Math.random() - 0.5) * 500 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const alpha = this._stealthed ? this.stealthAlpha : 1;
        ctx.globalAlpha = isHit ? 1 : alpha;
        const bodyColor = isHit ? '#FFFFFF' : this.bodyColor;
        // Body (slim, ninja-like)
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        // Mask
        ctx.fillStyle = isHit ? '#FFCCCC' : '#2A1A3A';
        ctx.fillRect(r * 0.1, -r * 0.25, r * 0.5, r * 0.5);
        // Eyes (glowing)
        ctx.fillStyle = isHit ? '#FF6666' : '#FF4444';
        ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.1, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.35, r * 0.1, 2, 0, Math.PI * 2); ctx.fill();
        // Katana
        ctx.fillStyle = isHit ? '#DDD' : '#C0C0C0';
        ctx.save(); ctx.rotate(-0.3);
        ctx.fillRect(r * 0.5, -1.5, r * 1.2, 3);
        ctx.restore();
        ctx.globalAlpha = 1;
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        // Stealth: invisible when far, revealed when close
        this._stealthed = distToPlayer > this.stealthRevealRange;
        if (distToPlayer < this.detectionRange) this.alertTimer = 8000;
        if (this._dashCooldown > 0) this._dashCooldown -= dt * 1000;
        this._attackTimer -= dt * 1000;
        if (this.alertTimer > 0) {
            this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            if (distToPlayer <= this.meleeRange) {
                this.state = 'attack';
                // Melee attack
                if (this._attackTimer <= 0) {
                    this._attackTimer = this.attackCooldown;
                    game.player.takeDamage(this.damage);
                    // Slash effect
                    for (let i = 0; i < 5; i++) {
                        const a = this.angle + (Math.random() - 0.5) * 1.0;
                        game.effects.push(new Particle(
                            this.x + Math.cos(this.angle) * this.radius,
                            this.y + Math.sin(this.angle) * this.radius,
                            Math.cos(a) * 100, Math.sin(a) * 100,
                            200, 2, '#CC88FF'
                        ));
                    }
                }
            } else if (distToPlayer < this.detectionRange * 0.6 && this._dashCooldown <= 0) {
                // Dash toward player
                this.state = 'dash';
                this._dashCooldown = 3000 + Math.random() * 2000;
                this._dashTarget = { x: game.player.x, y: game.player.y };
                this._dashTimer = 300;
            } else if (this._dashTimer > 0) {
                // Dashing
                this._dashTimer -= dt * 1000;
                const dashSpeed = this.speed * 3;
                if (this._dashTarget) {
                    this._moveToward(this._dashTarget.x, this._dashTarget.y, dashSpeed, dt, game.obstacles);
                }
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.5, dt, game.obstacles); }
            }
        }
    }
    // Override render to support stealth alpha
    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        const dist = distance(this.x, this.y, (typeof game !== 'undefined' && game.player) ? game.player.x : 0, (typeof game !== 'undefined' && game.player) ? game.player.y : 0);
        const isRevealed = dist < this.stealthRevealRange || this.isDying;
        if (!isRevealed) {
            // Stealth: only render faint outline
            ctx.globalAlpha = this.stealthAlpha;
            ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100,50,150,0.3)'; ctx.lineWidth = 1; ctx.stroke();
            ctx.globalAlpha = 1;
            return;
        }
        // Normal render
        const isHit = this.hitFlash > 0;
        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 3, sy + 4, this.radius * 0.8, this.radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
        }
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);
        if (isHit) { ctx.shadowColor = '#FF0000'; ctx.shadowBlur = 8; }
        this._drawCharacter(ctx, isHit, quality);
        ctx.shadowBlur = 0;
        ctx.restore();
        // HP bar
        if (this.hp < this.maxHp && !this.isDying) {
            const barW = this.radius * 2, barH = 3;
            ctx.fillStyle = '#222'; ctx.fillRect(sx - barW / 2, sy - this.radius - 8, barW, barH);
            ctx.fillStyle = this.hp < this.maxHp * 0.3 ? '#FF4444' : '#44FF44';
            ctx.fillRect(sx - barW / 2, sy - this.radius - 8, barW * (this.hp / this.maxHp), barH);
        }
    }
}

// ============================================================
// ENEMY: GRENADIER - Throws area-denial grenades
// ============================================================
class EnemyGrenadier extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'grenadier');
        const cfg = CONFIG.enemy.grenadier;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.grenadeBounces = cfg.grenadeBounces || 2;
        this.grenadeFuseTime = cfg.grenadeFuseTime || 2000;
        this.grenadeRadius = cfg.grenadeRadius || 80;
        this.grenadeDamage = Math.ceil((cfg.grenadeDamage || 40) * dmgMult);
        this.state = 'idle'; this._pickPatrolTarget();
        this._grenadeTimer = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 400, y: this.y + (Math.random() - 0.5) * 400 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bColor = isHit ? '#FFFFFF' : (this.variant && this.variant.bodyColor) || this.bodyColor;
        // Legs
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#3A2A1A';
            ctx.beginPath(); ctx.ellipse(-2, r * 0.55, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, r * 0.55, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        // Body - combat vest
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = bColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Grenade bandolier
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : 'rgba(80,60,30,0.6)';
            ctx.fillRect(-r*0.5, -r*0.4, r*0.3, r*0.8);
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = '#5A4A2A';
                ctx.beginPath(); ctx.ellipse(-r*0.35, -r*0.2 + i*12, 3, 5, 0, 0, Math.PI*2); ctx.fill();
            }
        }
        // Head - helmet with goggles
        ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.4, 0, Math.PI*2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#5A4A3A'; ctx.fill();
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#6B5A3A';
            ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.45, -0.7, 0.7); ctx.fill();
            // Goggles
            ctx.fillStyle = 'rgba(100,150,200,0.4)';
            ctx.fillRect(r*0.3, -4, 8, 8);
        }
        // Grenade launcher
        ctx.fillStyle = this.gunColor;
        ctx.fillRect(r*0.3, -3, r+12, 6);
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(r*0.3+r+12, 0, 4, 0, Math.PI*2); ctx.fill();
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 6000;
        this._grenadeTimer -= dt * 1000;

        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack';
                // Retreat if player gets too close
                if (distToPlayer < this.attackRange * 0.4) {
                    this._smartRetreat(dt, game, this.speed);
                }
                // Throw grenade
                if (this._grenadeTimer <= 0) {
                    this._grenadeTimer = this.fireRate;
                    this._throwGrenade(game);
                }
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed*0.6, dt, game.obstacles); }
            }
        }
    }
    _throwGrenade(game) {
        const angle = this.angle;
        const speed = 400 + Math.random() * 100;
        const fx = this.x + Math.cos(angle) * (this.radius + 10);
        const fy = this.y + Math.sin(angle) * (this.radius + 10);
        // Create grenade projectile
        const grn = {
            x: fx, y: fy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            radius: 6, age: 0, active: true, bounces: 0, maxBounces: this.grenadeBounces,
            fuseTime: this.grenadeFuseTime, fuseTimer: this.grenadeFuseTime,
            explosionRadius: this.grenadeRadius,
            damage: this.grenadeDamage * (game.player ? game.player.explosionMult || 1 : 1),
            trail: [],
            update(dt) {
                this.vy += 200 * dt; // Gravity
                this.x += this.vx * dt; this.y += this.vy * dt;
                this.age += dt * 1000; this.fuseTimer -= dt * 1000;
                // Bounce off walls
                if (this.x < 20 || this.x > CONFIG.world.width-20) { this.vx *= -0.5; this.bounces++; }
                if (this.y < 20 || this.y > CONFIG.world.height-20) { this.vy *= -0.5; this.bounces++; }
                // Bounce limit
                if (Math.abs(this.vx) < 20) this.vx = 0;
                if (Math.abs(this.vy) < 20) this.vy = 0;
                // Explode
                if (this.fuseTimer <= 0) {
                    this.active = false;
                    game.createExplosion(this.x, this.y, this.explosionRadius, this.damage, null);
                }
                // Trail
                this.trail.push({x:this.x, y:this.y});
                if (this.trail.length > 10) this.trail.shift();
            },
            render(ctx, cam) {
                const sx = this.x - cam.x, sy = this.y - cam.y;
                // Trail
                ctx.globalAlpha = 0.3;
                for (const t of this.trail) {
                    ctx.fillStyle = '#FF4400';
                    ctx.beginPath(); ctx.arc(t.x-cam.x, t.y-cam.y, 3, 0, Math.PI*2); ctx.fill();
                }
                ctx.globalAlpha = 1;
                // Grenade body
                ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI*2);
                ctx.fillStyle = '#5A4A2A'; ctx.fill();
                ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
                // Fuse spark
                const spark = Math.sin(performance.now() * 0.05) * 3;
                ctx.fillStyle = '#FF6600';
                ctx.beginPath(); ctx.arc(sx+2, sy-3+spark, 2, 0, Math.PI*2); ctx.fill();
            }
        };
        game.effects.push(grn);
        if (game.soundManager) game.soundManager.playSound('shoot');
    }
}

// ============================================================
// ENEMY: PSYKER - Teleports, fires homing projectiles
// ============================================================
class EnemyPsyker extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'psyker');
        const cfg = CONFIG.enemy.psyker;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.teleportCooldown = cfg.teleportCooldown || 4000;
        this.teleportRange = cfg.teleportRange || 200;
        this.homingStrength = cfg.homingStrength || 0.03;
        this.state = 'idle'; this._pickPatrolTarget();
        this._teleportTimer = 0; this._teleporting = false; this._teleportFlash = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random() - 0.5) * 500, y: this.y + (Math.random() - 0.5) * 500 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width - 100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height - 100);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bColor = isHit ? '#FFFFFF' : (this.variant && this.variant.bodyColor) || this.bodyColor;
        // Glowing aura (always active for psyker)
        if (quality !== 'low') {
            const pulse = 0.3 + Math.sin(performance.now()*0.003)*0.2;
            ctx.beginPath(); ctx.arc(0, 0, r*1.5, 0, Math.PI*2);
            ctx.fillStyle = `rgba(100,0,200,${pulse*0.15})`; ctx.fill();
        }
        // Body - floating robe
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = bColor; ctx.fill();
        ctx.strokeStyle = 'rgba(100,50,150,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Robe detail
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : 'rgba(60,20,100,0.4)';
            ctx.beginPath(); ctx.ellipse(0, r*0.2, r*0.7, r*0.4, 0, 0, Math.PI*2); ctx.fill();
        }
        // Head - bald, glowing eyes
        ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.4, 0, Math.PI*2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#3A2A4A'; ctx.fill();
        // Glowing eyes
        const eyeGlow = 0.5 + Math.sin(performance.now()*0.005)*0.5;
        ctx.fillStyle = `rgba(150,50,255,${eyeGlow})`;
        ctx.beginPath(); ctx.arc(r*0.4, -2, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(r*0.4, 2, 2.5, 0, Math.PI*2); ctx.fill();
        // Psionic energy orb
        if (quality !== 'low') {
            const orbPulse = 0.3 + Math.sin(performance.now()*0.004)*0.2;
            ctx.fillStyle = `rgba(150,50,255,${orbPulse*0.3})`;
            ctx.beginPath(); ctx.arc(r*0.5, 0, 10+Math.sin(performance.now()*0.003)*3, 0, Math.PI*2); ctx.fill();
        }
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 5000;
        this._teleportTimer -= dt * 1000;

        // Teleport visual effect
        if (this._teleportFlash > 0) this._teleportFlash -= dt * 1000;

        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack';
                // Teleport around
                if (this._teleportTimer <= 0 && !this._teleporting) {
                    this._teleportTimer = this.teleportCooldown;
                    this._teleporting = true;
                    this._teleportFlash = 300;
                    // Pick teleport location (near player, behind them)
                    const behindAngle = game.player.angle + Math.PI + (Math.random()-0.5)*1.0;
                    const tDist = 100 + Math.random() * 100;
                    const nx = clamp(game.player.x + Math.cos(behindAngle) * tDist, 50, CONFIG.world.width-50);
                    const ny = clamp(game.player.y + Math.sin(behindAngle) * tDist, 50, CONFIG.world.height-50);
                    // Teleport after short delay (visual anticipation)
                    const self = this;
                    setTimeout(() => {
                        if (!self.active) return;
                        self.x = nx; self.y = ny;
                        self._teleporting = false;
                        self._teleportFlash = 200;
                        // Teleport particles
                        if (game && game.addEffect) {
                            for (let i = 0; i < 8; i++) {
                                const a = Math.random() * Math.PI * 2;
                                game.addEffect({
                                    x: self.x, y: self.y,
                                    vx: Math.cos(a)*80, vy: Math.sin(a)*80,
                                    life: 300, age: 0, size: 3, color: '#8844FF', active: true,
                                    update(dt) { this.x+=this.vx*dt; this.y+=this.vy*dt; this.age+=dt*1000; if(this.age>this.life) this.active=false; },
                                    render(ctx, cam) { const a=1-this.age/this.life; ctx.globalAlpha=a; ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x-cam.x,this.y-cam.y,this.size,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
                                });
                            }
                        }
                    }, 400);
                }
                // Fire homing projectile
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate && !this._teleporting) {
                    this.lastAttackTime = now;
                    const homingBullet = {
                        x: this.x + Math.cos(this.angle)*(this.radius+10),
                        y: this.y + Math.sin(this.angle)*(this.radius+10),
                        vx: Math.cos(this.angle)*this.bulletSpeed,
                        vy: Math.sin(this.angle)*this.bulletSpeed,
                        radius: 4, damage: this.damage, lifetime: 3000, age: 0, active: true,
                        homingStrength: this.homingStrength, speed: this.bulletSpeed,
                        update(dt) {
                            if (game && game.player && game.player.alive) {
                                const dx = game.player.x - this.x;
                                const dy = game.player.y - this.y;
                                const d = Math.sqrt(dx*dx+dy*dy);
                                if (d > 10) {
                                    this.vx += (dx/d) * this.homingStrength * 100 * dt;
                                    this.vy += (dy/d) * this.homingStrength * 100 * dt;
                                    const spd = Math.sqrt(this.vx*this.vx+this.vy*this.vy);
                                    if (spd > this.speed) { this.vx = (this.vx/spd)*this.speed; this.vy = (this.vy/spd)*this.speed; }
                                }
                            }
                            this.x += this.vx*dt; this.y += this.vy*dt;
                            this.age += dt*1000;
                            if (this.age > this.lifetime || this.x < -50 || this.x > CONFIG.world.width+50 || this.y < -50 || this.y > CONFIG.world.height+50) this.active = false;
                        },
                        render(ctx, cam) {
                            const sx = this.x-cam.x, sy = this.y-cam.y;
                            const pulse = 0.5+Math.sin(performance.now()*0.01)*0.5;
                            ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI*2);
                            ctx.fillStyle = `rgba(150,50,255,${pulse*0.8})`; ctx.fill();
                            ctx.beginPath(); ctx.arc(sx, sy, this.radius*2, 0, Math.PI*2);
                            ctx.fillStyle = `rgba(150,50,255,${pulse*0.2})`; ctx.fill();
                        }
                    };
                    game.enemyBullets.push(homingBullet);
                }
                // Strafe while attacking
                const strafeAngle = this.angle + Math.PI/2 * Math.sin(performance.now()*0.003);
                this._moveToward(this.x+Math.cos(strafeAngle)*80, this.y+Math.sin(strafeAngle)*80, this.speed*0.3, dt, game.obstacles);
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y-this.y, this.patrolTarget.x-this.x); this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed*0.5, dt, game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: SWARM - Tiny, fast, spawns in packs
// ============================================================
class EnemySwarm extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'swarm');
        const cfg = CONFIG.enemy.swarm;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.detectionRange = cfg.detectionRange; this.meleeRange = cfg.meleeRange; this.attackCooldown = cfg.attackCooldown;
        this.state = 'idle'; this._pickPatrolTarget();
        this._scuttlePhase = Math.random() * Math.PI * 2;
    }
    isSolid() { return false; } // Swarm doesn't block
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x + (Math.random()-0.5)*600, y: this.y + (Math.random()-0.5)*600 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 50, CONFIG.world.width-50);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 50, CONFIG.world.height-50);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bColor = isHit ? '#FFFFFF' : (this.variant && this.variant.bodyColor) || this.bodyColor;
        // Legs - many skittering legs
        if (quality !== 'low') {
            ctx.strokeStyle = isHit ? '#DDD' : '#4A0000';
            ctx.lineWidth = 1;
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI*2/6)*i + Math.sin(performance.now()*0.02+this._scuttlePhase)*0.3;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a)*r*1.3, Math.sin(a)*r*1.2); ctx.stroke();
            }
        }
        // Body
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = bColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        // Red eyes
        ctx.fillStyle = isHit ? '#FF6666' : '#FF0000';
        ctx.beginPath(); ctx.arc(r*0.3, -1, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(r*0.3, 1, 1.5, 0, Math.PI*2); ctx.fill();
        // Mandibles
        if (quality !== 'low') {
            ctx.strokeStyle = isHit ? '#DDD' : '#3A0000';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(r*0.5, -2); ctx.lineTo(r*0.8, -1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(r*0.5, 2); ctx.lineTo(r*0.8, 1); ctx.stroke();
        }
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange;
        if (hasLOS) this.alertTimer = 3000;
        this._scuttlePhase += dt * 5;
        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y-this.y, game.player.x-this.x);
            if (distToPlayer <= this.meleeRange) {
                this.state = 'attack';
                const now = performance.now();
                if (now - this.lastAttackTime >= this.attackCooldown) {
                    this.lastAttackTime = now;
                    game.player.takeDamage(this.damage);
                }
            } else {
                this.state = 'chase';
                // Zigzag movement
                const wobble = Math.sin(performance.now()*0.01+this._scuttlePhase)*40;
                this._moveToward(game.player.x+wobble, game.player.y+Math.cos(performance.now()*0.008)*40, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x,this.y,this.patrolTarget.x,this.patrolTarget.y)<30) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y-this.y,this.patrolTarget.x-this.x); this._moveToward(this.patrolTarget.x,this.patrolTarget.y,this.speed*0.7,dt,game.obstacles); }
            }
        }
    }
    // Swarm doesn't use separation
    _separation(dt, enemies) {}
    // Swarm has no death body
    die(game) {
        this.isDying = true; this.deathTimer = 0;
        if (game && game.onEnemyKilled) game.onEnemyKilled(this);
        if (game && game.soundManager) game.soundManager.playSound('enemyDeath');
        // Variant death skills
        if (this.variantSkill && game) {
            const skill = this.variantSkill;
            if (skill.id === 'explosiveDeath') {
                game.createExplosion(this.x, this.y, skill.explosionRadius || 50, skill.explosionDamage || 15, null);
            }
            if (skill.id === 'poisonCloud') {
                game.addEffect({
                    x:this.x,y:this.y,radius:50,damage:3,life:2000,age:0,active:true,type:'poison',
                    update(dt){this.age+=dt*1000;if(this.age>this.life)this.active=false;},
                    render(ctx,cam){const a=(1-this.age/this.life)*0.3;ctx.globalAlpha=a;ctx.fillStyle='#44AA00';ctx.beginPath();ctx.arc(this.x-cam.x,this.y-cam.y,this.radius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
                });
            }
            if (skill.id === 'callReinforcements') {
                const x = clamp(this.x+(Math.random()-0.5)*50,50,CONFIG.world.width-50);
                const y = clamp(this.y+(Math.random()-0.5)*50,50,CONFIG.world.height-50);
                const enemy = new EnemySwarm(x,y,1,1);
                enemy._gameRef=game; enemy.initVariant(game);
                game.enemies.push(enemy);
            }
        }
    }
}

// ============================================================
// ENEMY: CHARGER - Telegraphs charge, high damage knockback
// ============================================================
class EnemyCharger extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'charger');
        const cfg = CONFIG.enemy.charger;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp;
        this.speed = cfg.speed; this.baseSpeed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.detectionRange = cfg.detectionRange; this.meleeRange = cfg.meleeRange; this.attackCooldown = cfg.attackCooldown;
        this.chargeSpeed = cfg.chargeSpeed || 600;
        this.chargeWindup = cfg.chargeWindup || 1500;
        this.chargeDistance = cfg.chargeDistance || 300;
        this.state = 'idle'; this._pickPatrolTarget();
        this._isCharging = false;
        this._chargeWindupTimer = 0;
        this._chargeStartX = 0;
        this._chargeStartY = 0;
        this._chargeEndX = 0;
        this._chargeEndY = 0;
        this._chargeGlow = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x+(Math.random()-0.5)*400, y: this.y+(Math.random()-0.5)*400 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width-100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height-100);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bColor = isHit ? '#FFFFFF' : (this.variant && this.variant.bodyColor) || this.bodyColor;
        // Charge glow
        if (this._isCharging || this._chargeWindupTimer > 0) {
            const glowIntensity = this._isCharging ? 0.4 : this._chargeWindupTimer/this.chargeWindup*0.3;
            ctx.beginPath(); ctx.arc(0, 0, r*1.8, 0, Math.PI*2);
            ctx.fillStyle = `rgba(255,100,0,${glowIntensity})`; ctx.fill();
        }
        // Heavy armored legs
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#3A2A1A';
            ctx.beginPath(); ctx.ellipse(-4, r*0.6, 5, 6, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4, r*0.6, 5, 6, 0, 0, Math.PI*2); ctx.fill();
        }
        // Body - bulky armor
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = bColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
        // Shoulder pads (horns)
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#6A4A2A';
            ctx.beginPath(); ctx.moveTo(-r*0.4, -r*0.2); ctx.lineTo(-r*0.8, -r*0.7); ctx.lineTo(-r*0.3, -r*0.3); ctx.fill();
            ctx.beginPath(); ctx.moveTo(r*0.4, -r*0.2); ctx.lineTo(r*0.8, -r*0.7); ctx.lineTo(r*0.3, -r*0.3); ctx.fill();
        }
        // Head
        ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.4, 0, Math.PI*2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#4A3A2A'; ctx.fill();
        // Full helmet
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#5A4A3A';
            ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.45, -0.9, 0.9); ctx.fill();
            // Visor
            ctx.fillStyle = isHit ? '#DDD' : 'rgba(255,100,0,0.4)';
            ctx.fillRect(r*0.3, -3, 6, 6);
        }
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 10000;

        if (this._chargeGlow > 0) this._chargeGlow -= dt * 1000;

        if (this._isCharging) {
            // During charge - rush forward
            this.state = 'charge';
            this.x += this._chargeDirX * this.chargeSpeed * dt;
            this.y += this._chargeDirY * this.chargeSpeed * dt;
            // Check if passed player or hit something
            const chargeDist = distance(this._chargeStartX, this._chargeStartY, this.x, this.y);
            if (chargeDist > this.chargeDistance || this.x < 50 || this.x > CONFIG.world.width-50 || this.y < 50 || this.y > CONFIG.world.height-50) {
                this._isCharging = false;
                this.speed = this.baseSpeed;
            }
            // Check collision with player during charge
            if (game.player && game.player.alive) {
                const d = distance(this.x, this.y, game.player.x, game.player.y);
                if (d < this.radius + game.player.radius + 10) {
                    game.player.takeDamage(this.damage);
                    // Knockback
                    const knockAngle = Math.atan2(game.player.y-this.y, game.player.x-this.x);
                    game.player.x += Math.cos(knockAngle)*50;
                    game.player.y += Math.sin(knockAngle)*50;
                    if (game.camera) game.camera.triggerShake(200, 8);
                    this._isCharging = false;
                    this.speed = this.baseSpeed;
                }
            }
            return;
        }

        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y-this.y, game.player.x-this.x);
            if (distToPlayer <= (this.meleeRange + 100) && this._chargeWindupTimer <= 0 && this._isCharging === false) {
                // Start windup
                this.state = 'windup';
                this._chargeWindupTimer = this.chargeWindup;
                this._chargeStartX = this.x;
                this._chargeStartY = this.y;
                const chargeAngle = this.angle;
                this._chargeDirX = Math.cos(chargeAngle);
                this._chargeDirY = Math.sin(chargeAngle);
                this._chargeGlow = this.chargeWindup;
            } else if (this._chargeWindupTimer > 0) {
                // Windup animation
                this._chargeWindupTimer -= dt * 1000;
                this._chargeGlow = this._chargeWindupTimer;
                if (this._chargeWindupTimer <= 0) {
                    // CHARGE!
                    this._isCharging = true;
                    this._chargeWindupTimer = 0;
                    this.speed = this.chargeSpeed;
                    if (game.soundManager) game.soundManager.playSound('bossWarning');
                }
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this._chargeWindupTimer = 0;
            this.state = 'idle';
            if (this.patrolTarget) {
                if (distance(this.x,this.y,this.patrolTarget.x,this.patrolTarget.y)<20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y-this.y,this.patrolTarget.x-this.x); this._moveToward(this.patrolTarget.x,this.patrolTarget.y,this.speed*0.5,dt,game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: ASSASSIN - Stealth, triple dash, shurikens
// ============================================================
class EnemyAssassin extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'assassin');
        const cfg = CONFIG.enemy.assassin;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.detectionRange = cfg.detectionRange; this.meleeRange = cfg.meleeRange; this.attackCooldown = cfg.attackCooldown;
        this.shurikenDamage = Math.ceil((cfg.shurikenDamage || 12) * dmgMult);
        this.shurikenRange = cfg.shurikenRange || 300;
        this.dashCount = cfg.dashCount || 3;
        this.dashCooldown = cfg.dashCooldown || 2000;
        this.stealthAlpha = cfg.stealthAlpha || 0.1;
        this.stealthRevealRange = cfg.stealthRevealRange || 100;
        this.state = 'idle'; this._pickPatrolTarget();
        this._stealthed = true;
        this._dashesLeft = 3;
        this._dashTimer = 0;
        this._isDashing = false;
        this._dashAngle = 0;
        this._dashCooldownTimer = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x+(Math.random()-0.5)*500, y: this.y+(Math.random()-0.5)*500 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 50, CONFIG.world.width-50);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 50, CONFIG.world.height-50);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const alpha = this._stealthed ? this.stealthAlpha : 1;
        ctx.globalAlpha = isHit ? 1 : alpha;
        const bColor = isHit ? '#FFFFFF' : (this.variant && this.variant.bodyColor) || this.bodyColor;
        // Sleek body
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = bColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Ninja mask
        ctx.fillStyle = isHit ? '#FFCCCC' : '#1A1A3A';
        ctx.fillRect(r*0.1, -r*0.25, r*0.5, r*0.5);
        // Glowing purple eyes
        ctx.fillStyle = isHit ? '#FF6666' : '#8844FF';
        ctx.beginPath(); ctx.arc(r*0.35, -r*0.1, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(r*0.35, r*0.1, 1.5, 0, Math.PI*2); ctx.fill();
        // Dual blades
        ctx.fillStyle = isHit ? '#DDD' : '#C0C0C0';
        ctx.save(); ctx.rotate(-0.4);
        ctx.fillRect(r*0.4, -1.5, r*1.0, 3);
        ctx.restore();
        ctx.save(); ctx.rotate(0.4);
        ctx.fillRect(r*0.4, -1.5, r*0.8, 3);
        ctx.restore();
        ctx.globalAlpha = 1;
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        this._stealthed = distToPlayer > this.stealthRevealRange;
        if (distToPlayer < this.detectionRange) this.alertTimer = 8000;
        this._dashCooldownTimer -= dt * 1000;

        if (this._isDashing) {
            this.state = 'dash';
            this.x += Math.cos(this._dashAngle) * 500 * dt;
            this.y += Math.sin(this._dashAngle) * 500 * dt;
            this._dashTimer -= dt * 1000;
            if (this._dashTimer <= 0) {
                this._isDashing = false;
                this._dashesLeft--;
                if (this._dashesLeft > 0 && distToPlayer > this.meleeRange) {
                    // Chain dash
                    this._dashAngle = Math.atan2(game.player.y-this.y, game.player.x-this.x);
                    this._dashTimer = 150;
                    this._isDashing = true;
                    if (game && game.addEffect) {
                        for (let i=0;i<4;i++) {
                            const a = Math.random()*Math.PI*2;
                            game.addEffect({x:this.x,y:this.y,vx:Math.cos(a)*60,vy:Math.sin(a)*60,life:200,age:0,size:3,color:'#8844FF',active:true,
                                update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.age+=dt*1000;if(this.age>this.life)this.active=false;},
                                render(ctx,cam){const a=1-this.age/this.life;ctx.globalAlpha=a;ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x-cam.x,this.y-cam.y,this.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
                            });
                        }
                    }
                }
            }
            return;
        }

        if (this.alertTimer > 0) {
            this.angle = Math.atan2(game.player.y-this.y, game.player.x-this.x);
            if (distToPlayer <= this.meleeRange) {
                this.state = 'attack';
                const now = performance.now();
                if (now - this.lastAttackTime >= this.attackCooldown) {
                    this.lastAttackTime = now;
                    game.player.takeDamage(this.damage);
                    // Slash effect
                    for (let i=0;i<5;i++) {
                        const a = this.angle+(Math.random()-0.5)*1.0;
                        if (game.addEffect) game.addEffect({x:this.x+Math.cos(this.angle)*this.radius,y:this.y+Math.sin(this.angle)*this.radius,
                            vx:Math.cos(a)*100,vy:Math.sin(a)*100,life:200,age:0,size:2,color:'#CC88FF',active:true,
                            update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.vx*=0.96;this.vy*=0.96;this.age+=dt*1000;if(this.age>this.life)this.active=false;},
                            render(ctx,cam){const a=1-this.age/this.life;ctx.globalAlpha=a;ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x-cam.x,this.y-cam.y,this.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
                        });
                    }
                }
            } else if (distToPlayer <= this.shurikenRange) {
                this.state = 'attack';
                // Throw shuriken
                const now = performance.now();
                if (now - this.lastAttackTime >= this.attackCooldown*2) {
                    this.lastAttackTime = now;
                    const spread = (Math.random()-0.5)*0.2;
                    game.addEnemyBullet(new EnemyBullet(
                        this.x+Math.cos(this.angle)*(this.radius+5),
                        this.y+Math.sin(this.angle)*(this.radius+5),
                        this.angle+spread, 400, this.shurikenDamage
                    ));
                }
                // Dash toward player if possible
                if (this._dashesLeft > 0 && this._dashCooldownTimer <= 0) {
                    this._isDashing = true;
                    this._dashTimer = 200;
                    this._dashAngle = this.angle;
                    this._dashCooldownTimer = this.dashCooldown;
                } else {
                    this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
                }
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed*1.1, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            this._dashesLeft = this.dashCount;
            if (this.patrolTarget) {
                if (distance(this.x,this.y,this.patrolTarget.x,this.patrolTarget.y)<20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y-this.y,this.patrolTarget.x-this.x); this._moveToward(this.patrolTarget.x,this.patrolTarget.y,this.speed*0.5,dt,game.obstacles); }
            }
        }
    }
}

// ============================================================
// ENEMY: SUMMONER - Spawns minions, buffs allies
// ============================================================
class EnemySummoner extends Enemy {
    constructor(x, y, hpMult = 1, dmgMult = 1) {
        super(x, y, 'summoner');
        const cfg = CONFIG.enemy.summoner;
        this.hp = Math.ceil(cfg.hp * hpMult); this.maxHp = this.hp; this.speed = cfg.speed;
        this.damage = Math.ceil(cfg.damage * dmgMult); this.radius = cfg.radius;
        this.color = cfg.color; this.score = cfg.score; this.bodyColor = cfg.bodyColor;
        this.gunColor = cfg.gunColor; this.detectionRange = cfg.detectionRange; this.attackRange = cfg.attackRange;
        this.fireRate = cfg.fireRate; this.bulletSpeed = cfg.bulletSpeed;
        this.summonCooldown = cfg.summonCooldown || 10000;
        this.summonCount = cfg.summonCount || 2;
        this.summonTypes = cfg.summonTypes || ['grunt', 'grunt', 'rusher'];
        this.state = 'idle'; this._pickPatrolTarget();
        this._summonTimer = 0;
        this._summoning = false;
        this._summonFlash = 0;
    }
    _pickPatrolTarget() {
        this.patrolTarget = { x: this.x+(Math.random()-0.5)*300, y: this.y+(Math.random()-0.5)*300 };
        this.patrolTarget.x = clamp(this.patrolTarget.x, 100, CONFIG.world.width-100);
        this.patrolTarget.y = clamp(this.patrolTarget.y, 100, CONFIG.world.height-100);
    }
    _drawCharacter(ctx, isHit, quality) {
        const r = this.radius;
        const bColor = isHit ? '#FFFFFF' : (this.variant && this.variant.bodyColor) || this.bodyColor;
        // Summoning glow
        if (this._summoning) {
            const pulse = 0.5+Math.sin(performance.now()*0.01)*0.5;
            ctx.beginPath(); ctx.arc(0, 0, r*2, 0, Math.PI*2);
            ctx.fillStyle = `rgba(150,50,200,${pulse*0.2})`; ctx.fill();
        }
        // Legs - robe bottom
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#2A0A2A';
            ctx.beginPath(); ctx.ellipse(-2, r*0.55, 4, 6, 0, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, r*0.55, 4, 6, 0, 0, Math.PI*2); ctx.fill();
        }
        // Body - robe
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.fillStyle = bColor; ctx.fill();
        ctx.strokeStyle = 'rgba(100,50,150,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        // Robe runes
        if (quality !== 'low') {
            ctx.strokeStyle = isHit ? '#DDD' : 'rgba(200,100,255,0.3)';
            ctx.lineWidth = 1;
            for (let i=0;i<4;i++) {
                const a = (Math.PI*2/4)*i + 0.3;
                ctx.beginPath();
                ctx.arc(Math.cos(a)*r*0.5, Math.sin(a)*r*0.5, 4, 0, Math.PI*2);
                ctx.stroke();
            }
        }
        // Head
        ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.4, 0, Math.PI*2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#4A2A4A'; ctx.fill();
        // Hood
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#EEE' : '#3A1A3A';
            ctx.beginPath(); ctx.arc(r*0.3, 0, r*0.45, -0.8, 0.8); ctx.fill();
            // Eyes
            ctx.fillStyle = `rgba(200,100,255,${0.3+Math.sin(performance.now()*0.004)*0.3})`;
            ctx.beginPath(); ctx.arc(r*0.38, -2, 2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(r*0.38, 2, 2, 0, Math.PI*2); ctx.fill();
        }
        // Staff
        ctx.strokeStyle = isHit ? '#DDD' : '#555';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(r*0.5, r*0.5); ctx.lineTo(r*0.8, -r*0.5); ctx.stroke();
        // Staff orb
        const orbPulse = 0.5+Math.sin(performance.now()*0.005)*0.5;
        ctx.fillStyle = `rgba(200,100,255,${orbPulse*0.8})`;
        ctx.beginPath(); ctx.arc(r*0.8, -r*0.5, 4, 0, Math.PI*2); ctx.fill();
    }
    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);
        if (hasLOS) this.alertTimer = 6000;
        this._summonTimer -= dt * 1000;

        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y-this.y, game.player.x-this.x);
            if (distToPlayer <= this.attackRange) {
                this.state = 'attack';
                // Retreat if player gets close
                if (distToPlayer < this.attackRange*0.3) {
                    this._smartRetreat(dt, game, this.speed);
                }
                // Fire projectile
                const now = performance.now();
                if (now - this.lastAttackTime >= this.fireRate) {
                    this.lastAttackTime = now;
                    const spread = (Math.random()-0.5)*0.15;
                    game.addEnemyBullet(new EnemyBullet(
                        this.x+Math.cos(this.angle)*(this.radius+15),
                        this.y+Math.sin(this.angle)*(this.radius+15),
                        this.angle+spread, this.bulletSpeed, this.damage
                    ));
                }
                // Summon minions
                if (this._summonTimer <= 0) {
                    this._summonTimer = this.summonCooldown;
                    this._summoning = true;
                    this._summonFlash = 1000;
                    const self = this;
                    setTimeout(() => {
                        if (!self.active) return;
                        self._summoning = false;
                        self._doSummon(game);
                    }, 800);
                }
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            this._summoning = false;
            if (this.patrolTarget) {
                if (distance(this.x,this.y,this.patrolTarget.x,this.patrolTarget.y)<20) this._pickPatrolTarget();
                else { this.angle = Math.atan2(this.patrolTarget.y-this.y,this.patrolTarget.x-this.x); this._moveToward(this.patrolTarget.x,this.patrolTarget.y,this.speed*0.4,dt,game.obstacles); }
            }
        }
    }
    _doSummon(game) {
        const count = this.summonCount;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 40;
            const x = clamp(this.x + Math.cos(angle)*dist, 50, CONFIG.world.width-50);
            const y = clamp(this.y + Math.sin(angle)*dist, 50, CONFIG.world.height-50);
            const type = this.summonTypes[Math.floor(Math.random()*this.summonTypes.length)];
            let enemy;
            switch (type) {
                case 'grunt': enemy = new EnemyGrunt(x, y, 1, 1); break;
                case 'rusher': enemy = new EnemyRusher(x, y, 1, 1); break;
                case 'swarm': enemy = new EnemySwarm(x, y, 1, 1); break;
                default: enemy = new EnemyGrunt(x, y, 1, 1);
            }
            enemy._gameRef = game;
            enemy.initVariant(game);
            enemy.alertTimer = 8000;
            game.enemies.push(enemy);
            // Summon visual
            if (game.addEffect) {
                for (let j=0;j<6;j++) {
                    const a = Math.random()*Math.PI*2;
                    game.addEffect({x,y,vx:Math.cos(a)*80,vy:Math.sin(a)*80,life:300,age:0,size:3,color:'#AA44FF',active:true,
                        update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.age+=dt*1000;if(this.age>this.life)this.active=false;},
                        render(ctx,cam){const a=1-this.age/this.life;ctx.globalAlpha=a;ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(this.x-cam.x,this.y-cam.y,this.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
                    });
                }
            }
        }
        if (game.soundManager) game.soundManager.playSound('bossWarning');
    }
}

// ============================================================
// BOSS - "The Commander" - Phase 5 with phases and reinforcements
// ============================================================
class EnemyBoss extends Enemy {
    constructor(x, y, waveNumber) {
        super(x, y, 'boss');
        this.waveNumber = waveNumber;
        this.maxHp = 500 + (waveNumber - 1) * 80;
        this.hp = this.maxHp;
        this.speed = 110;
        this.radius = 36;
        this.color = '#4A0E0E';
        this.accentColor = '#FFD700';
        this.score = 2000 + waveNumber * 200;
        this.detectionRange = 800;
        this.attackRange = 400;
        this.phase = 1;
        this.phaseThresholds = [0.66, 0.33]; // Phase 2 at 66%, Phase 3 at 33%
        this.reinforcementTimer = 0;
        this.reinforcementInterval = 8000;
        this.attackTimer = 0;
        this.fireRate = 1200;
        this.bulletSpeed = 450;
        this.damage = 12;
        this.burstCount = 0;
        this.burstMax = 5;
        this.burstTimer = 0;
        this.laserWarning = false;
        this.laserTimer = 0;
        this.hitFlash = 0;
        this.deathTimer = 0;
        this.isDying = false;
        this._phaseTransitionFlash = 0;
    }

    _drawGun(ctx) {
        // Boss has dual guns
        ctx.fillStyle = this.accentColor;
        ctx.fillRect(this.radius * 0.3, -6, this.radius + 18, 5);
        ctx.fillRect(this.radius * 0.3, 1, this.radius + 18, 5);
        // Barrel tips
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(this.radius * 0.3 + this.radius + 14, -7, 6, 7);
        ctx.fillRect(this.radius * 0.3 + this.radius + 14, 0, 6, 7);
    }

    _ai(dt, game) {
        const distToPlayer = distance(this.x, this.y, game.player.x, game.player.y);
        const hasLOS = distToPlayer < this.detectionRange && this._hasLineOfSight(game.player.x, game.player.y, game);

        if (hasLOS) this.alertTimer = 10000;

        // Phase transitions
        const hpRatio = this.hp / this.maxHp;
        if (this.phase === 1 && hpRatio <= this.phaseThresholds[0]) {
            this.phase = 2; this.fireRate = 900; this.speed = 130;
            this._phaseTransitionFlash = 400;
            game.soundManager.playSound('bossWarning');
            game.camera.triggerShake(500, 10);
        } else if (this.phase === 2 && hpRatio <= this.phaseThresholds[1]) {
            this.phase = 3; this.fireRate = 600; this.speed = 150;
            this._phaseTransitionFlash = 400;
            game.soundManager.playSound('bossWarning');
            game.camera.triggerShake(600, 12);
        }

        if (this._phaseTransitionFlash > 0) this._phaseTransitionFlash -= dt * 1000;

        // Reinforcement spawning
        this.reinforcementTimer += dt * 1000;
        if (this.reinforcementTimer >= this.reinforcementInterval && this.phase >= 2) {
            this.reinforcementTimer = 0;
            this._spawnReinforcements(game);
        }

        if (this.alertTimer > 0 && hasLOS) {
            this.angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);

            if (distToPlayer <= this.attackRange) {
                this.state = 'attack';
                // Strafe movement
                const strafeAngle = this.angle + Math.PI / 2 * Math.sin(performance.now() * 0.0015);
                this._moveToward(
                    this.x + Math.cos(strafeAngle) * 100,
                    this.y + Math.sin(strafeAngle) * 100,
                    this.speed * 0.4, dt, game.obstacles
                );

                // Attack patterns based on phase
                const now = performance.now();
                if (this.phase === 1) {
                    // Single shots
                    if (now - this.attackTimer >= this.fireRate) {
                        this.attackTimer = now;
                        const spread = (Math.random() - 0.5) * 0.08;
                        game.addEnemyBullet(new EnemyBullet(
                            this.x + Math.cos(this.angle) * (this.radius + 20),
                            this.y + Math.sin(this.angle) * (this.radius + 20),
                            this.angle + spread, this.bulletSpeed, this.damage
                        ));
                        game.soundManager.playSound('shoot');
                    }
                } else if (this.phase === 2) {
                    // Burst fire
                    this.burstTimer += dt * 1000;
                    if (this.burstCount < this.burstMax) {
                        if (this.burstTimer >= 150) {
                            this.burstTimer = 0;
                            const spread = (this.burstCount - 2) * 0.1;
                            game.addEnemyBullet(new EnemyBullet(
                                this.x + Math.cos(this.angle) * (this.radius + 20),
                                this.y + Math.sin(this.angle) * (this.radius + 20),
                                this.angle + spread, this.bulletSpeed, this.damage
                            ));
                            game.soundManager.playSound('shoot');
                            this.burstCount++;
                        }
                    } else if (now - this.attackTimer >= this.fireRate) {
                        this.attackTimer = now;
                        this.burstCount = 0;
                        this.burstTimer = 0;
                    }
                } else {
                    // Phase 3: rapid fire + laser warning
                    if (now - this.attackTimer >= this.fireRate) {
                        this.attackTimer = now;
                        // 3-way spread
                        for (let i = -1; i <= 1; i++) {
                            const spread = i * 0.15;
                            game.addEnemyBullet(new EnemyBullet(
                                this.x + Math.cos(this.angle) * (this.radius + 20),
                                this.y + Math.sin(this.angle) * (this.radius + 20),
                                this.angle + spread, this.bulletSpeed * 1.1, this.damage
                            ));
                        }
                        game.soundManager.playSound('shoot');
                    }
                }
            } else {
                this.state = 'chase';
                this._moveToward(game.player.x, game.player.y, this.speed, dt, game.obstacles);
            }
        } else {
            this.state = 'idle';
            // Slow patrol
            if (!this.patrolTarget) this._pickPatrolTarget();
            if (distance(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 30) this._pickPatrolTarget();
            else {
                this.angle = Math.atan2(this.patrolTarget.y - this.y, this.patrolTarget.x - this.x);
                this._moveToward(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.5, dt, game.obstacles);
            }
        }
    }

    _pickPatrolTarget() {
        const cx = CONFIG.world.width / 2, cy = CONFIG.world.height / 2;
        const angle = Math.random() * Math.PI * 2;
        const dist = 200 + Math.random() * 300;
        this.patrolTarget = {
            x: clamp(cx + Math.cos(angle) * dist, 100, CONFIG.world.width - 100),
            y: clamp(cy + Math.sin(angle) * dist, 100, CONFIG.world.height - 100)
        };
    }

    _spawnReinforcements(game) {
        const count = this.phase === 2 ? 2 : 3;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 80;
            const x = this.x + Math.cos(angle) * dist;
            const y = this.y + Math.sin(angle) * dist;
            const rx = clamp(x, 50, CONFIG.world.width - 50);
            const ry = clamp(y, 50, CONFIG.world.height - 50);
            const types = ['grunt', 'grunt', 'rusher'];
            const type = types[Math.floor(Math.random() * types.length)];
            let enemy;
            switch (type) {
                case 'grunt': enemy = new EnemyGrunt(rx, ry, 1, 1); break;
                case 'rusher': enemy = new EnemyRusher(rx, ry, 1, 1); break;
            }
            enemy._gameRef = game;
            game.enemies.push(enemy);
        }
    }

    takeDamage(amount, game) {
        if (this.isDying) return;
        this.hp -= amount; this.hitFlash = 100; this.alertTimer = 8000;
        game.addDamageNumber(this.x, this.y - 40, amount);
        game.soundManager.playSound('enemyHit');
        // Hit particles
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            game.addEffect({
                x: this.x, y: this.y, vx: Math.cos(angle) * (60 + Math.random() * 100), vy: Math.sin(angle) * (60 + Math.random() * 100),
                life: 200 + Math.random() * 150, age: 0, size: 3 + Math.random() * 4,
                color: this.accentColor, active: true,
                update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.97; this.vy *= 0.97; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.fillRect(this.x - cam.x - this.size / 2, this.y - cam.y - this.size / 2, this.size, this.size); ctx.globalAlpha = 1; }
            });
        }
        if (this.hp <= 0) this.die(game);
    }

    die(game) {
        this.isDying = true; this.deathTimer = 0;
        game.onEnemyKilled(this);
        game.soundManager.playSound('explosion');
        game.camera.triggerShake(1000, 18);
        // Boss explosion (bigger, more particles, debris, multi-ring shockwave)
        game.effects.push(new Explosion(this.x, this.y, 200, 80, true));
        game.addScorchMark({ x: this.x, y: this.y, radius: 80, color: 'rgba(80,30,0,0.5)', isBlood: false });
        // Damage nearby enemies (boss explosion is devastating)
        for (const enemy of game.enemies) {
            if (!enemy.active || enemy === this) continue;
            const d = distance(this.x, this.y, enemy.x, enemy.y);
            if (d < 250) enemy.takeDamage(50 * (1 - d / 250), game);
        }
        // Screen flash
        if (game.screenFlash) {
            game.screenFlash.alpha = 0.8;
            game.screenFlash.color = '#FF4400';
            game.screenFlash.decay = 1.0;
        }
    }

    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        const alpha = this.isDying ? Math.max(0, 1 - this.deathTimer / 800) : 1;
        ctx.save(); ctx.globalAlpha = alpha;

        // Phase transition flash
        if (this._phaseTransitionFlash > 0) {
            const flashAlpha = (this._phaseTransitionFlash / 400) * 0.3;
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,215,0,${flashAlpha})`; ctx.fill();
        }

        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 6, sy + 8, this.radius * 1.1, this.radius * 0.7, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
        }

        // Outer glow
        if (quality !== 'low') {
            const glowColor = this.phase === 1 ? 'rgba(255,0,0,0.08)' : this.phase === 2 ? 'rgba(255,100,0,0.12)' : 'rgba(255,0,0,0.18)';
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * 1.8, 0, Math.PI * 2);
            ctx.fillStyle = glowColor; ctx.fill();
        }

        ctx.translate(sx, sy); ctx.rotate(this.angle);

        // Body with phase coloring
        const bodyColor = this.hitFlash > 0 ? '#FFFFFF' :
            this.phase === 3 ? '#6A1A1A' : this.phase === 2 ? '#5A1212' : this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = this.accentColor; ctx.lineWidth = 3; ctx.stroke();

        // Inner ring
        ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = rgbaFromHex(this.accentColor, 0.3); ctx.lineWidth = 1.5; ctx.stroke();

        // Head
        ctx.beginPath(); ctx.arc(this.radius * 0.3, 0, this.radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = this.hitFlash > 0 ? '#FFCCCC' : '#2A0A0A'; ctx.fill();

        // Crown/crest
        ctx.fillStyle = this.accentColor;
        ctx.beginPath();
        ctx.moveTo(-this.radius * 0.3, -this.radius * 0.6);
        ctx.lineTo(-this.radius * 0.15, -this.radius * 0.9);
        ctx.lineTo(0, -this.radius * 0.6);
        ctx.lineTo(this.radius * 0.15, -this.radius * 0.9);
        ctx.lineTo(this.radius * 0.3, -this.radius * 0.6);
        ctx.fill();

        this._drawGun(ctx);
        ctx.restore(); ctx.globalAlpha = 1;

        // Boss HP bar rendered at SCREEN level (after restore)
        this._renderBossHPBar(ctx);
    }

    _renderBossHPBar(ctx) {
        const barWidth = 400, barHeight = 14;
        const x = (ctx.canvas.width - barWidth) / 2;
        const y = 50;
        const hpRatio = Math.max(0, this.hp / this.maxHp);

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 8);

        // HP bar
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, barWidth, barHeight);

        // Phase-colored HP fill
        const hpColor = this.phase === 1 ? '#CC0000' : this.phase === 2 ? '#FF6600' : '#FF0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(x, y, barWidth * hpRatio, barHeight);

        // Phase markers
        for (const threshold of this.phaseThresholds) {
            const mx = x + barWidth * threshold;
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(mx - 1, y - 2, 2, barHeight + 4);
        }

        // Border
        ctx.strokeStyle = this.accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // Label
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`THE COMMANDER - Wave ${this.waveNumber}`, ctx.canvas.width / 2, y - 6);

        // HP text
        ctx.font = '11px "Courier New", monospace';
        ctx.fillStyle = '#DDD';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, ctx.canvas.width / 2, y + barHeight / 2);
    }
}
