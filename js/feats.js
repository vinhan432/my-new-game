/**
 * Dodge Warfare - Phase 7
 * New Features: Kill Streaks, Headshots, Melee Combos, Supply Drops, Bullet Time, Traps, Ragdolls, Weapon Mastery
 */

class KillStreakManager {
    constructor() {
        this.killStreak = 0;
        this.pendingStreak = 0;
        this.streakIcons = ['☠', '🔥', '💀', '⚔', '🎯'];
        this.announceTimer = 0;
        this.announceText = '';
        this._activeStreak = null;
    }

    reset() {
        this.killStreak = 0;
        this.pendingStreak = 0;
        this._activeStreak = null;
    }

    onKill(game) {
        this.killStreak++;
        this.pendingStreak = this.killStreak;

        // Multi-kill announcements via kill feed only (no wave announcements to avoid UI overlap)
        if (this.killStreak === 3) {
            game.killFeed.add('⚡ DOUBLE KILL!');
            game.screenFlash.alpha = 0.15; game.screenFlash.color = '#FF6600'; game.screenFlash.decay = 2;
        } else if (this.killStreak === 5) {
            game.killFeed.add('🔥 MULTI KILL!');
            game.screenFlash.alpha = 0.2; game.screenFlash.color = '#FF0044'; game.screenFlash.decay = 2.5;
            game.camera.triggerShake(200, 5);
        } else if (this.killStreak === 8) {
            game.killFeed.add('💀 KILLING SPREE!');
            game.screenFlash.alpha = 0.25; game.screenFlash.color = '#FF00FF'; game.screenFlash.decay = 3;
            game.camera.triggerShake(300, 8);
        } else if (this.killStreak === 12) {
            game.killFeed.add('☠ UNSTOPPABLE!');
            game.screenFlash.alpha = 0.3; game.screenFlash.color = '#FFD700'; game.screenFlash.decay = 3;
            game.camera.triggerShake(400, 10);
        } else if (this.killStreak === 15) {
            game.killFeed.add('👑 GODLIKE!');
            game.screenFlash.alpha = 0.35; game.screenFlash.color = '#00FFFF'; game.screenFlash.decay = 4;
            game.camera.triggerShake(500, 12);
        }

        // Check for streak rewards
        this._checkStreakRewards(game);
    }

    onDeath() {
        this.killStreak = 0;
    }

    announce(text, color) {
        this.announceText = text;
        this.announceTimer = 2500;
        // game might not be set when this is called, skip killFeed add if so
        try {
            if (typeof game !== 'undefined' && game && game.killFeed) {
                game.killFeed.add(text);
            }
        } catch (e) { /* game not ready */ }
    }

    _checkStreakRewards(game) {
        const streak = this.killStreak;
        // Don't overwrite existing unused streak
        if (this._activeStreak) return;

        let reward = null;
        if (streak >= 5 && streak < 8) {
            reward = { type: 'uav', name: 'UAV', icon: '◉' };
        } else if (streak >= 8 && streak < 12) {
            reward = { type: 'airstrike', name: 'Airstrike', icon: '✈' };
        } else if (streak >= 12) {
            reward = { type: 'helicopter', name: 'Helicopter', icon: '🚁' };
        }

        if (reward) {
            this.announce(`${reward.icon} ${reward.name} ready!`, '#FFD700');
            this._activeStreak = reward;
        }
    }

    useStreak(game) {
        if (!this._activeStreak) return false;
        const streak = this._activeStreak;
        this._activeStreak = null;

        switch (streak.type) {
            case 'uav':
                this._activateUAV(game);
                break;
            case 'airstrike':
                this._activateAirstrike(game);
                break;
            case 'helicopter':
                this._activateHelicopter(game);
                break;
        }
        return true;
    }

    _activateUAV(game) {
        // Reveal all enemies on minimap for 8 seconds
        game.killFeed.add('◉ UAV Active - Enemies revealed!');
        const duration = 8000;
        const originalRender = game.minimap.render;
        game.minimap._uavActive = true;
        game.minimap._uavTimer = duration;
        setTimeout(() => {
            game.minimap._uavActive = false;
        }, duration);
    }

    _activateAirstrike(game) {
        // Call in an airstrike on cursor position
        const angle = Math.atan2(
            game.player.y - game.camera.y - game.canvas.height / 2,
            game.player.x - game.camera.x - game.canvas.width / 2
        );
        const targetX = game.player.x + Math.cos(angle) * 400;
        const targetY = game.player.y + Math.sin(angle) * 400;

        game.killFeed.add('✈ Airstrike inbound!');
        game.addEffect(new AirStrikeEffect(targetX, targetY, game));
    }

    _activateHelicopter(game) {
        // Spawn a helicopter that strafes the area
        game.killFeed.add('🚁 Helicopter inbound!');
        const hp = new HelicopterStreak(game.player.x - 400, game.player.y - 500, game);
        game._helicopterStreak = hp;
    }

    update(dt) {
        if (this.announceTimer > 0) this.announceTimer -= dt * 1000;
    }
}

class AirStrikeEffect {
    constructor(x, y, game) {
        this.x = x; this.y = y;
        this.game = game;
        this.timer = 2000;
        this.stage = 'incoming';
        this.damage = 150;
        this.radius = 100;
        this.active = true;
        this.tracking = [];
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            this.tracking.push({ angle: a, dist: 300 + Math.random() * 100 });
        }
    }

    update(dt) {
        this.timer -= dt * 1000;
        if (this.timer <= 500 && this.stage === 'incoming') {
            this.stage = 'impact';
            this.game.createExplosion(this.x, this.y, this.radius, this.damage, null);
            // Multiple explosions along the strike line
            for (let i = 0; i < 4; i++) {
                const offset = (i - 1.5) * 40;
                setTimeout(() => {
                    if (this.game && this.game.createExplosion) {
                        this.game.createExplosion(
                            this.x + (Math.random() - 0.5) * 60,
                            this.y + offset,
                            60, 80, null
                        );
                    }
                }, i * 100);
            }
        }
        if (this.timer <= 0) this.active = false;
    }

    render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        if (this.stage === 'incoming') {
            // Warning circles
            const progress = 1 - this.timer / 2000;
            for (const t of this.tracking) {
                const dist = t.dist * (1 - progress);
                const tx = sx + Math.cos(t.angle) * dist;
                const ty = sy + Math.sin(t.angle) * dist;
                ctx.strokeStyle = '#FF4400';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
                ctx.beginPath();
                ctx.arc(tx, ty, 20, 0, Math.PI * 2);
                ctx.stroke();
            }
            // Center target
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.arc(sx, sy, 30 + Math.sin(performance.now() * 0.01) * 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx - 40, sy); ctx.lineTo(sx + 40, sy);
            ctx.moveTo(sx, sy - 40); ctx.lineTo(sx, sy + 40);
            ctx.stroke();
        } else {
            // Explosion flash
            const alpha = this.timer / 500;
            ctx.globalAlpha = alpha * 0.5;
            ctx.fillStyle = '#FF6600';
            ctx.beginPath();
            ctx.arc(sx, sy, this.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

class HelicopterStreak {
    constructor(x, y, game) {
        this.x = x; this.y = y;
        this.game = game;
        this.active = true;
        this.timer = 10000;
        this.bulletTimer = 0;
        this.bulletInterval = 150;
        this.targetX = game.player.x;
        this.targetY = game.player.y;
        this.angle = 0;
        this.rotorAngle = 0;
        this.speed = 80;
    }

    update(dt) {
        this.timer -= dt * 1000;
        this.rotorAngle += dt * 25;

        // Move toward player
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 200) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        // Fire at nearby enemies
        this.bulletTimer -= dt * 1000;
        if (this.bulletTimer <= 0) {
            this.bulletTimer = this.bulletInterval;
            const nearestEnemy = this._findNearestEnemy();
            if (nearestEnemy && distance(this.x, this.y, nearestEnemy.x, nearestEnemy.y) < 500) {
                const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
                const bullet = new EnemyBullet(
                    this.x, this.y + 20,
                    angle, 600, 12
                );
                this.game.enemyBullets.push(bullet);
            }
        }

        if (this.timer <= 0) this.active = false;
    }

    _findNearestEnemy() {
        let nearest = null;
        let minDist = Infinity;
        for (const e of this.game.enemies) {
            if (!e.active || e.isDying) continue;
            const d = distance(this.x, this.y, e.x, e.y);
            if (d < minDist) { minDist = d; nearest = e; }
        }
        return nearest;
    }

    render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);

        // Body
        ctx.fillStyle = '#2A2A2A';
        ctx.beginPath();
        ctx.ellipse(0, 0, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#4A6A8A';
        ctx.beginPath();
        ctx.ellipse(20, 0, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(-60, -5, 30, 10);
        ctx.beginPath();
        ctx.moveTo(-60, -8);
        ctx.lineTo(-70, -20);
        ctx.lineTo(-50, -8);
        ctx.fill();

        // Rotor
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-35 * Math.cos(this.rotorAngle), -20);
        ctx.lineTo(35 * Math.cos(this.rotorAngle), -20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-35 * Math.cos(this.rotorAngle + Math.PI / 2), -20);
        ctx.lineTo(35 * Math.cos(this.rotorAngle + Math.PI / 2), -20);
        ctx.stroke();

        // Skids
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-20, 15); ctx.lineTo(-20, 25); ctx.lineTo(20, 25); ctx.lineTo(20, 15);
        ctx.stroke();

        ctx.restore();
    }
}

class HeadshotSystem {
    constructor() {
        this.headshotMultiplier = 2.5;
        this.helmetChance = 0.4;
        this.flyoffForce = 300;
    }

    checkHeadshot(enemy, bulletAngle, bulletX, bulletY) {
        // Head hitbox is the upper portion of the enemy's head circle
        const headOffsetX = enemy.x + Math.cos(enemy.angle) * enemy.radius * 0.3;
        const headOffsetY = enemy.y + Math.sin(enemy.angle) * enemy.radius * 0.3;
        const headRadius = enemy.radius * 0.4;

        const dx = bulletX - headOffsetX;
        const dy = bulletY - headOffsetY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < headRadius) {
            return { isHeadshot: true, headX: headOffsetX, headY: headOffsetY };
        }
        return { isHeadshot: false };
    }

    applyHeadshotDamage(enemy, baseDamage, game) {
        const finalDamage = Math.ceil(baseDamage * this.headshotMultiplier);
        enemy.takeDamage(finalDamage, game);

        // Spawn helmet flyoff
        if (Math.random() < this.helmetChance && enemy.variantName !== 'Heavy') {
            this._spawnHelmetFlyoff(enemy, game);
        }

        // Headshot effect
        if (game) {
            game.addEffect({
                x: enemy.x, y: enemy.y - enemy.radius * 0.3,
                vx: 0, vy: -50, life: 300, age: 0, size: 15,
                color: '#FFFF00', active: true, type: 'headshot',
                update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                render(ctx, cam) {
                    const a = 1 - this.age / this.life;
                    ctx.globalAlpha = a;
                    ctx.font = 'bold 16px Arial';
                    ctx.fillStyle = '#FFD700';
                    ctx.textAlign = 'center';
                    ctx.fillText('HEADSHOT!', this.x - cam.x, this.y - cam.y);
                    ctx.globalAlpha = 1;
                }
            });
            game.scoreManager.floatingNumbers.push({
                x: enemy.x, y: enemy.y - 40, text: `+${finalDamage}`,
                age: 0, maxAge: 1000, vy: -60, isCoin: false, color: '#FFD700'
            });
        }

        return finalDamage;
    }

    _spawnHelmetFlyoff(enemy, game) {
        const helmetColors = ['#4A5D23', '#3A3A2A', '#2A1A0A', '#4A5D23'];
        const color = helmetColors[Math.floor(Math.random() * helmetColors.length)];
        const flyAngle = enemy.angle + Math.PI + (Math.random() - 0.5) * 0.5;
        const force = this.flyoffForce + Math.random() * 150;

        game.addEffect({
            x: enemy.x, y: enemy.y - enemy.radius * 0.3,
            vx: Math.cos(flyAngle) * force,
            vy: Math.sin(flyAngle) * force - 100,
            life: 800, age: 0, size: enemy.radius * 0.5,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 15,
            color: color, type: 'helmet',
            update(dt) {
                this.x += this.vx * dt;
                this.y += this.vy * dt;
                this.vy += 600 * dt; // gravity
                this.rotation += this.rotSpeed * dt;
                this.age += dt * 1000;
                if (this.age > this.life) this.active = false;
            },
            render(ctx, cam) {
                const a = Math.max(0, 1 - this.age / this.life);
                ctx.globalAlpha = a;
                ctx.save();
                ctx.translate(this.x - cam.x, this.y - cam.y);
                ctx.rotate(this.rotation);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(0, 0, this.size, -0.7, 0.7);
                ctx.fill();
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        });
    }
}

class MeleeSystem {
    constructor() {
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboWindow = 600;
        this.damage = [35, 50, 75];
        this.range = 45;
        this.cooldown = 350;
        this.lastAttackTime = 0;
        this.active = false;
        this.attackAngle = 0;
        this.swingProgress = 0;
    }

    update(dt, player, game) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt * 1000;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
            }
        }

        if (this.active) {
            this.swingProgress += dt * 8;
            if (this.swingProgress >= 1) {
                this.active = false;
                this.swingProgress = 0;
            }
        }
    }

    tryMeleeAttack(player, game) {
        const now = performance.now();
        if (now - this.lastAttackTime < this.cooldown) return false;

        this.lastAttackTime = now;
        this.comboCount = (this.comboCount % 3) + 1;
        this.comboTimer = this.comboWindow;
        this.active = true;
        this.swingProgress = 0;
        this.attackAngle = player.angle;

        // Damage and effects
        const damage = this.damage[this.comboCount - 1];
        const hitRadius = this.range + (this.comboCount - 1) * 10;

        // Check for enemy hits
        for (const enemy of game.enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const dist = distance(player.x, player.y, enemy.x, enemy.y);
            if (dist < hitRadius + enemy.radius) {
                // Check angle - must be in front
                const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
                const angleDiff = Math.abs(normalizeAngle(angleToEnemy - player.angle));
                if (angleDiff < Math.PI / 2 || angleDiff > Math.PI * 1.5) {
                    enemy.takeDamage(damage, game);
                    // Knockback
                    const kbAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
                    enemy.x += Math.cos(kbAngle) * 20;
                    enemy.y += Math.sin(kbAngle) * 20;

                    // Blood effect
                    game.addEffect({
                        x: enemy.x, y: enemy.y, vx: Math.cos(kbAngle) * 100,
                        vy: Math.sin(kbAngle) * 100 - 50, life: 400, age: 0,
                        size: 5 + Math.random() * 4, color: '#FF0000', active: true,
                        update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.95; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                        render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x - cam.x, this.y - cam.y, this.size * a, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
                    });
                }
            }
        }

        // Swing effect
        game.addEffect({
            x: player.x, y: player.y, angle: this.attackAngle,
            combo: this.comboCount, progress: 0, life: 250, age: 0, active: true, type: 'meleeSwing',
            update(dt) { this.age += dt * 1000; this.progress = this.age / this.life; if (this.age > this.life) this.active = false; },
            render(ctx, cam) {
                const sx = this.x - cam.x, sy = this.y - cam.y;
                const arcStart = this.angle - 0.8;
                const arcEnd = this.angle + 0.8;
                const reach = 45 + (this.combo - 1) * 10;
                ctx.globalAlpha = 1 - this.progress * 0.7;
                ctx.strokeStyle = this.combo === 3 ? '#FF4444' : this.combo === 2 ? '#FFAA00' : '#FFFFFF';
                ctx.lineWidth = 3 + (3 - this.combo) * 2;
                ctx.beginPath();
                ctx.arc(sx, sy, reach * (0.5 + this.progress * 0.5), arcStart, arcEnd);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        });

        // Sound
        if (game.soundManager) {
            game.soundManager.playSound(this.comboCount === 3 ? 'heavyHit' : 'meleeHit');
        }

        return true;
    }

    renderSwing(ctx, cam, player) {
        // Drawn via effect system
    }
}

class SupplyDropManager {
    constructor() {
        this.drops = [];
        this.spawnInterval = 25000;
        this.lastSpawn = 0;
        this.dropRadius = 25;
        this.parachuteProgress = 0;
    }

    update(dt, game) {
        // Spawn drops periodically
        this.lastSpawn += dt * 1000;
        if (this.lastSpawn >= this.spawnInterval && game.waveManager.state === 'active') {
            this.lastSpawn = 0;
            this._spawnDrop(game);
        }

        // Update drops
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            drop.update(dt, game);
            if (!drop.active) {
                this.drops.splice(i, 1);
            }
        }
    }

    _spawnDrop(game) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 400;
        const x = game.player.x + Math.cos(angle) * dist;
        const y = game.player.y + Math.sin(angle) * dist;

        const types = ['ammo', 'health', 'stamina', 'powerup'];
        const weights = [0.3, 0.3, 0.25, 0.15];
        const r = Math.random();
        let type;
        if (r < weights[0]) type = 'ammo';
        else if (r < weights[0] + weights[1]) type = 'health';
        else if (r < weights[0] + weights[1] + weights[2]) type = 'stamina';
        else type = 'powerup';

        const drop = new SupplyDrop(
            clamp(x, 100, CONFIG.world.width - 100),
            clamp(y, 100, CONFIG.world.height - 100),
            type
        );
        this.drops.push(drop);
        game.killFeed.add('📦 Supply drop incoming!');
    }

    render(ctx, cam, game) {
        for (const drop of this.drops) {
            drop.render(ctx, cam, game);
        }
    }
}

class SupplyDrop {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type;
        this.active = true;
        this.falling = true;
        this.fallSpeed = 0;
        this.targetY = y;
        this.groundY = y;
        this.parachuteOpen = false;
        this.fallTimer = 0;
        this.bobTimer = 0;

        // Find ground level (simplified - just place on terrain)
        this.groundY = y;

        // Power-up types
        this.powerupSubtype = null;
        if (type === 'powerup') {
            const powerups = ['speed', 'shield', 'damage', 'heal', 'ammo'];
            this.powerupSubtype = powerups[Math.floor(Math.random() * powerups.length)];
        }
    }

    update(dt, game) {
        if (this.falling) {
            this.fallSpeed += 200 * dt;
            this.y += this.fallSpeed * dt;

            if (this.fallSpeed > 100) {
                this.parachuteOpen = true;
            }

            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.falling = false;
                // Impact effect
                game.addEffect({
                    x: this.x, y: this.y, vx: 0, vy: 0, life: 500, age: 0,
                    size: 40, color: '#8B7355', active: true,
                    update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                    render(ctx, cam) {
                        const a = 1 - this.age / this.life;
                        ctx.globalAlpha = a * 0.5;
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        ctx.arc(this.x - cam.x, this.y - cam.y, this.size * (1 + this.age / this.life), 0, Math.PI * 2);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                });
            }
        } else {
            this.bobTimer += dt;
            // Check pickup
            const player = game.player;
            if (distance(this.x, this.y, player.x, player.y) < 40) {
                this._collect(game);
            }
        }
    }

    _collect(game) {
        const player = game.player;
        switch (this.type) {
            case 'health':
                player.hp = Math.min(player.maxHP, player.hp + 40);
                game.killFeed.add('+40 HP');
                break;
            case 'ammo':
                player.currentMag = player.weapon.magSize;
                player.reserveAmmo = Math.floor(player.weapon.reserveAmmo * 1.5);
                game.killFeed.add('+50% Ammo');
                break;
            case 'stamina':
                player.stamina = player.maxStamina;
                game.killFeed.add('Full Stamina');
                break;
            case 'powerup':
                this._activatePowerup(game);
                break;
        }

        // Collect effect
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            game.addEffect({
                x: this.x, y: this.y,
                vx: Math.cos(angle) * 80, vy: Math.sin(angle) * 80,
                life: 400, age: 0, size: 6, color: '#FFD700', active: true,
                update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.fillRect(this.x - cam.x - this.size / 2, this.y - cam.y - this.size / 2, this.size, this.size); ctx.globalAlpha = 1; }
            });
        }

        this.active = false;
    }

    _activatePowerup(game) {
        const player = game.player;
        const colors = { speed: '#00FF00', shield: '#4488FF', damage: '#FF4444', heal: '#00FF88', ammo: '#FFAA00' };

        game.killFeed.add(`⚡ ${this.powerupSubtype.toUpperCase()} BOOST!`);

        // Add timed buff
        const buff = {
            type: this.powerupSubtype,
            duration: 8000,
            timer: 8000,
            color: colors[this.powerupSubtype]
        };

        if (!player.activeBuffs) player.activeBuffs = [];
        player.activeBuffs.push(buff);

        // Apply effect
        switch (this.powerupSubtype) {
            case 'speed':
                player.speedBonus += 0.3;
                break;
            case 'shield':
                player.shieldHP = 50;
                break;
            case 'damage':
                player.weapons.forEach(w => w.damage = Math.ceil(w.damage * 1.5));
                break;
            case 'heal':
                player.hp = player.maxHP;
                break;
            case 'ammo':
                player.weapons.forEach(w => { w.reserveAmmo = Math.ceil(w.reserveAmmo * 2); });
                break;
        }

        // Visual effect
        game.screenFlash.alpha = 0.2; game.screenFlash.color = colors[this.powerupSubtype]; game.screenFlash.decay = 2;
    }

    render(ctx, cam, game) {
        const sx = this.x - cam.x;
        const sy = this.y - cam.y;

        if (this.falling && this.parachuteOpen) {
            // Parachute
            ctx.strokeStyle = '#DDD';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(sx, sy - 60, 30, Math.PI, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx - 30, sy - 60); ctx.lineTo(sx, sy - 20);
            ctx.moveTo(sx + 30, sy - 60); ctx.lineTo(sx, sy - 20);
            ctx.stroke();
        }

        // Crate
        const bob = this.falling ? 0 : Math.sin(this.bobTimer * 3) * 3;
        ctx.save();
        ctx.translate(sx, sy + bob);

        ctx.fillStyle = '#8B7355';
        ctx.fillRect(-20, -15, 40, 30);
        ctx.fillStyle = '#6B5335';
        ctx.fillRect(-18, -13, 36, 26);

        // Cross
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-2, -10, 4, 20);
        ctx.fillRect(-10, -2, 20, 4);

        // Light glow
        if (!this.falling) {
            ctx.globalAlpha = 0.3 + Math.sin(performance.now() * 0.005) * 0.1;
            ctx.fillStyle = this.type === 'powerup' ? '#FF00FF' : '#00FF00';
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }
}

class TrapSystem {
    constructor() {
        this.traps = [];
        this.maxTraps = 5;
    }

    update(dt, game) {
        for (let i = this.traps.length - 1; i >= 0; i--) {
            const trap = this.traps[i];
            trap.update(dt, game);
            if (!trap.active) {
                this.traps.splice(i, 1);
            }
        }
    }

    placeTrap(x, y, type, game) {
        if (this.traps.length >= this.maxTraps) {
            // Remove oldest
            this.traps.shift();
        }

        let trap;
        switch (type) {
            case 'mine':
                trap = new ProximityMine(x, y);
                break;
            case 'claymore':
                trap = new Claymore(x, y);
                break;
            case 'tripwire':
                trap = new Tripwire(x, y);
                break;
            default:
                trap = new ProximityMine(x, y);
        }
        this.traps.push(trap);
        game.killFeed.add(`⚡ Placed ${type}`);

        // Place effect
        game.addEffect({
            x, y, vx: 0, vy: 0, life: 300, age: 0, size: 10,
            color: '#FFD700', active: true,
            update(dt) { this.age += dt * 1000; if (this.age > this.life) this.active = false; },
            render(ctx, cam) {
                const a = 1 - this.age / this.life;
                ctx.globalAlpha = a;
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x - cam.x, this.y - cam.y, this.size * (1 + this.age / this.life), 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        });
    }

    render(ctx, cam) {
        for (const trap of this.traps) {
            trap.render(ctx, cam);
        }
    }
}

class ProximityMine {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.radius = 20;
        this.damage = 60;
        this.explosionRadius = 80;
        this.triggerRadius = 50;
        this.armed = false;
        this.armTimer = 1000;
    }

    update(dt, game) {
        if (!this.armed) {
            this.armTimer -= dt * 1000;
            if (this.armTimer <= 0) this.armed = true;
            return;
        }

        // Check player proximity
        const player = game.player;
        if (distance(this.x, this.y, player.x, player.y) < this.triggerRadius) {
            this.explode(game);
        }
    }

    explode(game) {
        game.createExplosion(this.x, this.y, this.explosionRadius, this.damage, null);
        this.active = false;
    }

    render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;

        ctx.fillStyle = this.armed ? '#FF0000' : '#888';
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.armed) {
            ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.01) * 0.3;
            ctx.fillStyle = '#FF4444';
            ctx.beginPath();
            ctx.arc(sx, sy, this.radius + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Warning symbol
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠', sx, sy);
    }
}

class Claymore {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.damage = 50;
        this.explosionRadius = 100;
        this.angle = 0; // Facing direction
        this.armed = false;
        this.armTimer = 800;
    }

    update(dt, game) {
        if (!this.armed) {
            this.armTimer -= dt * 1000;
            if (this.armTimer <= 0) this.armed = true;
            return;
        }

        // Check enemies in cone
        for (const enemy of game.enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const dist = distance(this.x, this.y, enemy.x, enemy.y);
            if (dist < 60) {
                const angleToEnemy = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                const angleDiff = Math.abs(normalizeAngle(angleToEnemy - this.angle));
                if (angleDiff < Math.PI / 3) {
                    this.explode(game);
                    return;
                }
            }
        }
    }

    explode(game) {
        game.createExplosion(this.x, this.y, this.explosionRadius, this.damage, null);
        this.active = false;
    }

    render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.armed ? '#8B0000' : '#555';
        ctx.fillRect(-15, -8, 30, 16);
        ctx.fillStyle = '#FF4400';
        ctx.fillRect(-10, -4, 6, 8);

        // Detection cone
        if (this.armed) {
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 60, -Math.PI / 3, Math.PI / 3);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }
}

class Tripwire {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.damage = 40;
        this.explosionRadius = 60;
        this.length = 150;
        this.angle = 0;
        this.armed = false;
        this.armTimer = 500;
    }

    update(dt, game) {
        if (!this.armed) {
            this.armTimer -= dt * 1000;
            if (this.armTimer <= 0) this.armed = true;
            return;
        }

        const player = game.player;
        const px = player.x, py = player.y;

        // Line-circle intersection
        const dx = Math.cos(this.angle) * this.length;
        const dy = Math.sin(this.angle) * this.length;
        const closest = this._closestPointOnLine(this.x, this.y, this.x + dx, this.y + dy, px, py);
        if (distance(closest.x, closest.y, px, py) < 15) {
            this.explode(game);
        }
    }

    _closestPointOnLine(x1, y1, x2, y2, px, py) {
        const dx = x2 - x1, dy = y2 - y1;
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        return { x: x1 + t * dx, y: y1 + t * dy };
    }

    explode(game) {
        game.createExplosion(this.x, this.y, this.explosionRadius, this.damage, null);
        this.active = false;
    }

    render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        const ex = sx + Math.cos(this.angle) * this.length;
        const ey = sy + Math.sin(this.angle) * this.length;

        ctx.strokeStyle = this.armed ? '#FF0000' : '#888';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

class RagdollSystem {
    constructor() {
        this.bodies = [];
    }

    onEnemyDeath(enemy, game) {
        // Spawn body parts
        const partCount = game.graphicsQuality === 'low' ? 2 : game.graphicsQuality === 'medium' ? 4 : 6;
        for (let i = 0; i < partCount; i++) {
            this._spawnLimb(enemy, game);
        }
    }

    _spawnLimb(enemy, game) {
        const angle = Math.random() * Math.PI * 2;
        const force = 100 + Math.random() * 200;
        const types = ['arm', 'leg', 'torso'];
        const type = types[Math.floor(Math.random() * types.length)];
        const size = type === 'torso' ? 10 : 6 + Math.random() * 4;

        game.addEffect({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(angle) * force,
            vy: Math.sin(angle) * force - 80,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 12,
            life: 2000 + Math.random() * 1000,
            age: 0, size: size, type: type, color: enemy.bodyColor || '#6B3A2A',
            active: true, isRagdoll: true,
            update(dt) {
                this.x += this.vx * dt;
                this.y += this.vy * dt;
                this.vy += 400 * dt;
                this.vx *= 0.99;
                this.rotation += this.rotSpeed * dt;
                this.age += dt * 1000;
                if (this.age > this.life) this.active = false;
            },
            render(ctx, cam) {
                const a = Math.max(0, 1 - this.age / this.life);
                ctx.globalAlpha = a;
                ctx.save();
                ctx.translate(this.x - cam.x, this.y - cam.y);
                ctx.rotate(this.rotation);
                ctx.fillStyle = this.color;
                if (this.type === 'arm' || this.type === 'leg') {
                    ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        });
    }
}

class WeaponMasterySystem {
    constructor() {
        this.masteryData = {};
    }

    initWeapon(weaponIndex, weaponName) {
        if (!this.masteryData[weaponIndex]) {
            this.masteryData[weaponIndex] = {
                name: weaponName,
                kills: 0,
                headshots: 0,
                damageDealt: 0,
                level: 1,
                xp: 0,
                xpToNext: 100
            };
        }
    }

    onKill(weaponIndex, weaponName, isHeadshot) {
        this.initWeapon(weaponIndex, weaponName);
        const data = this.masteryData[weaponIndex];
        data.kills++;
        data.xp += isHeadshot ? 25 : 10;

        if (isHeadshot) data.headshots++;

        // Level up check
        while (data.xp >= data.xpToNext) {
            data.xp -= data.xpToNext;
            data.level++;
            data.xpToNext = Math.floor(data.xpToNext * 1.5);
        }
    }

    onDamage(weaponIndex, weaponName, damage) {
        this.initWeapon(weaponIndex, weaponName);
        this.masteryData[weaponIndex].damageDealt += damage;
    }

    getBonus(weaponIndex) {
        const data = this.masteryData[weaponIndex];
        if (!data) return 0;
        return 1 + (data.level - 1) * 0.05; // 5% stronger per level
    }

    getLevel(weaponIndex) {
        const data = this.masteryData[weaponIndex];
        return data ? data.level : 1;
    }
}

function normalizeAngle(a) {
    while (a < 0) a += Math.PI * 2;
    while (a >= Math.PI * 2) a -= Math.PI * 2;
    return a;
}