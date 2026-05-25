/**
 * Dodge Warfare - Phase 6
 * Companions - Pet, Drone, and Teammate entities
 */

// ============================================================
// PET - Enhanced with real-life behaviors
// ============================================================
class Pet {
    constructor(config, playerRef) {
        this.id = config.id;
        this.type = config.type;
        this.name = config.name;
        this.color = config.color;
        this.icon = config.icon;
        this.x = playerRef.x;
        this.y = playerRef.y;
        this.radius = 10;
        this.hp = 50;
        this.maxHp = 50;
        this.active = true;
        this.player = playerRef;
        this.effectTimer = 0;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitRadius = 40;
        this.orbitSpeed = 2;
        this.bobPhase = 0;
        this.shieldCooldown = 0;
        // Enhanced behavior state
        this.state = 'follow'; // follow, fetch, guard, alert
        this.stateTimer = 0;
        this.targetItem = null;
        this.guardX = 0;
        this.guardY = 0;
        this.alertTimer = 0;
        this.barkTimer = 0;
        this.emotionTimer = 0;
        this.emotion = null; // happy, alert, scared
        this.facingAngle = 0;
        this.tailWag = 0;
    }

    update(dt, game) {
        if (!this.active) return;

        this.bobPhase += dt * 4;
        this.stateTimer += dt * 1000;
        this.barkTimer -= dt * 1000;
        this.emotionTimer -= dt * 1000;
        if (this.emotionTimer <= 0) this.emotion = null;

        // Type-specific enhanced behaviors
        switch (this.type) {
            case 'heal':
                this._updateHealPet(dt, game);
                break;
            case 'shield':
                this._updateShieldPet(dt, game);
                break;
            case 'loot':
                this._updateLootPet(dt, game);
                break;
            case 'damage':
                this._updateDamagePet(dt, game);
                break;
            default:
                this._followPlayer(dt);
        }

        this.tailWag = Math.sin(this.bobPhase * 3) * 0.3;
    }

    _followPlayer(dt) {
        this.orbitAngle += this.orbitSpeed * dt;
        const targetX = this.player.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        const targetY = this.player.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.x = lerp(this.x, targetX, dt * 5);
        this.y = lerp(this.y, targetY, dt * 5);
        this.facingAngle = Math.atan2(this.player.y - this.y, this.player.x - this.x);
    }

    _updateHealPet(dt, game) {
        // Medic pup - follows closely, heals periodically, barks when player is low HP
        this._followPlayer(dt);
        this.effectTimer += dt * 1000;

        // Heal every 5 seconds
        if (this.effectTimer >= 5000) {
            this.effectTimer = 0;
            if (this.player.hp < this.player.maxHP) {
                this.player.heal(2);
                this._healEffect(game);
                this.emotion = 'happy';
                this.emotionTimer = 1000;
            }
        }

        // Alert when player HP is low
        if (this.player.hp < this.player.maxHP * 0.3 && this.barkTimer <= 0) {
            this.barkTimer = 3000;
            this.emotion = 'alert';
            this.emotionTimer = 2000;
            // Visual bark indicator
            if (game.graphicsQuality !== 'low') {
                game.effects.push({
                    x: this.x, y: this.y - 20,
                    vx: 0, vy: -20,
                    life: 1000, age: 0, size: 8,
                    active: true,
                    update(dt) { this.y += this.vy * dt; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                    render(ctx, cam) {
                        const a = 1 - this.age / this.life;
                        ctx.globalAlpha = a;
                        ctx.fillStyle = '#FFD700';
                        ctx.font = 'bold 10px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('!', this.x - cam.x, this.y - cam.y);
                        ctx.globalAlpha = 1;
                    }
                });
            }
        }
    }

    _updateShieldPet(dt, game) {
        // Guardian turtle - moves slower, positions between player and threats
        this.orbitSpeed = 1.5;

        // Find nearest threat
        let nearestThreat = null;
        let minDist = 300;
        for (const enemy of game.enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const d = distance(this.player.x, this.player.y, enemy.x, enemy.y);
            if (d < minDist) { minDist = d; nearestThreat = enemy; }
        }

        if (nearestThreat) {
            // Position between player and threat
            const angle = Math.atan2(nearestThreat.y - this.player.y, nearestThreat.x - this.player.x);
            const targetX = this.player.x + Math.cos(angle) * 30;
            const targetY = this.player.y + Math.sin(angle) * 30;
            this.x = lerp(this.x, targetX, dt * 3);
            this.y = lerp(this.y, targetY, dt * 3);
            this.facingAngle = angle;
        } else {
            this._followPlayer(dt);
        }

        // Shield ability - blocks bullets
        if (this.shieldCooldown > 0) { this.shieldCooldown -= dt * 1000; }
        if (this.shieldCooldown <= 0) {
            for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
                const b = game.enemyBullets[i];
                if (distance(b.x, b.y, this.x, this.y) < 25) {
                    b.active = false;
                    this.shieldCooldown = 8000;
                    game.effects.push(new ImpactEffect(b.x, b.y));
                    this.emotion = 'alert';
                    this.emotionTimer = 1000;
                    break;
                }
            }
        }
    }

    _updateLootPet(dt, game) {
        // Scavenger fox - actively fetches nearby pickups
        this.orbitSpeed = 2.5;

        // Look for items to fetch
        if (this.state === 'follow' || !this.targetItem) {
            let nearestPickup = null;
            let minDist = 250;
            for (const pickup of game.pickups) {
                if (!pickup.active) continue;
                const d = distance(this.player.x, this.player.y, pickup.x, pickup.y);
                if (d < minDist) { minDist = d; nearestPickup = pickup; }
            }

            if (nearestPickup && distance(this.x, this.y, nearestPickup.x, nearestPickup.y) > 30) {
                this.targetItem = nearestPickup;
                this.state = 'fetch';
            } else {
                this._followPlayer(dt);
            }
        }

        if (this.state === 'fetch' && this.targetItem) {
            if (!this.targetItem.active) {
                this.state = 'follow';
                this.targetItem = null;
                return;
            }

            // Move toward item
            const dx = this.targetItem.x - this.x;
            const dy = this.targetItem.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
                this.x += (dx / dist) * 180 * dt;
                this.y += (dy / dist) * 180 * dt;
                this.facingAngle = Math.atan2(dy, dx);
            }

            // Pull item toward player when close
            if (dist < 30) {
                const angle = Math.atan2(this.player.y - this.targetItem.y, this.player.x - this.targetItem.x);
                this.targetItem.x += Math.cos(angle) * 200 * dt;
                this.targetItem.y += Math.sin(angle) * 200 * dt;
                this.emotion = 'happy';
                this.emotionTimer = 500;
            }

            // Return to follow if too far
            if (distance(this.x, this.player.x, this.y, this.player.y) > 300) {
                this.state = 'follow';
                this.targetItem = null;
            }
        }

        // Passive loot pull
        for (const pickup of game.pickups) {
            if (!pickup.active) continue;
            const dist = distance(this.x, this.y, pickup.x, pickup.y);
            if (dist < 100) {
                const angle = Math.atan2(this.player.y - pickup.y, this.player.x - pickup.x);
                pickup.x += Math.cos(angle) * 80 * dt;
                pickup.y += Math.sin(angle) * 80 * dt;
            }
        }
    }

    _updateDamagePet(dt, game) {
        // Attack hawk - circles wider, attacks enemies
        this.orbitRadius = 60;
        this.orbitSpeed = 3;
        this._followPlayer(dt);

        this.effectTimer += dt * 1000;
        if (this.effectTimer >= 1000) {
            this.effectTimer = 0;
            let nearest = null, minDist = 200;
            for (const enemy of game.enemies) {
                if (!enemy.active || enemy.isDying) continue;
                const d = distance(this.x, this.y, enemy.x, enemy.y);
                if (d < minDist) { minDist = d; nearest = enemy; }
            }
            if (nearest) {
                nearest.takeDamage(5, game);
                game.effects.push(new ImpactEffect(nearest.x, nearest.y));
                this.facingAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                this.emotion = 'happy';
                this.emotionTimer = 500;
            }
        }

        // Alert on nearby enemies
        for (const enemy of game.enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const d = distance(this.player.x, this.player.y, enemy.x, enemy.y);
            if (d < 150 && this.barkTimer <= 0) {
                this.barkTimer = 2000;
                this.emotion = 'alert';
                this.emotionTimer = 1500;
                break;
            }
        }
    }

    _healEffect(game) {
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            game.effects.push(new Particle(
                this.x, this.y,
                Math.cos(angle) * 40, Math.sin(angle) * 40,
                400, 3, '#00FF88'
            ));
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) { this.active = false; }
        this.emotion = 'scared';
        this.emotionTimer = 2000;
    }

    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x;
        const sy = this.y - cameraOffset.y + Math.sin(this.bobPhase) * 2;

        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 2, sy + 3, 8, 5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
        }

        // Body
        ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();

        // Eyes (facing direction)
        const eyeX = sx + Math.cos(this.facingAngle) * 4;
        const eyeY = sy + Math.sin(this.facingAngle) * 4;
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(eyeX - 2, eyeY - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 2, eyeY - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(eyeX - 1.5, eyeY - 2, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 2.5, eyeY - 2, 1, 0, Math.PI * 2); ctx.fill();

        // Tail (wagging for happy)
        if (quality !== 'low') {
            const tailAngle = this.facingAngle + Math.PI + this.tailWag;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(sx - Math.cos(this.facingAngle) * 8, sy - Math.sin(this.facingAngle) * 8);
            ctx.lineTo(sx - Math.cos(this.facingAngle) * 15 + Math.cos(tailAngle) * 5,
                sy - Math.sin(this.facingAngle) * 15 + Math.sin(tailAngle) * 5);
            ctx.stroke();
        }

        // Emotion indicator
        if (this.emotion && quality !== 'low') {
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            if (this.emotion === 'happy') {
                ctx.fillStyle = '#FFD700';
                ctx.fillText('♫', sx, sy - this.radius - 8);
            } else if (this.emotion === 'alert') {
                ctx.fillStyle = '#FF4444';
                ctx.fillText('!', sx, sy - this.radius - 8);
            } else if (this.emotion === 'scared') {
                ctx.fillStyle = '#8888FF';
                ctx.fillText('~', sx, sy - this.radius - 8);
            }
        }

        // Type icon
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, sx, sy);

        // HP bar (only if damaged)
        if (this.hp < this.maxHp) {
            const barW = 18, barH = 2;
            ctx.fillStyle = '#333'; ctx.fillRect(sx - barW / 2, sy - this.radius - 5, barW, barH);
            ctx.fillStyle = '#00FF88'; ctx.fillRect(sx - barW / 2, sy - this.radius - 5, barW * (this.hp / this.maxHp), barH);
        }
    }
}

// ============================================================
// PLAYER DRONE - Enhanced with real-life capabilities
// ============================================================
class PlayerDrone {
    constructor(config, playerRef) {
        this.id = config.id;
        this.type = config.type;
        this.name = config.name;
        this.color = config.color;
        this.icon = config.icon;
        this.x = playerRef.x;
        this.y = playerRef.y;
        this.radius = 12;
        this.hp = 80;
        this.maxHp = 80;
        this.active = true;
        this.player = playerRef;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitRadius = 60;
        this.orbitSpeed = 1.5;
        this.hoverPhase = 0;
        this.lastActionTime = 0;
        this.angle = 0;
        this.targetAngle = 0;
        // Combat stats from config
        this.bulletDamage = config.bulletDamage || 0;
        this.fireRate = config.fireRate || 1000;
        this.bulletSpeed = config.bulletSpeed || 500;
        this.range = config.range || 300;
        this.shieldHP = config.shieldHP || 0;
        this.maxShieldHP = config.shieldHP || 0;
        this.healAmount = config.healAmount || 0;
        this.healInterval = config.healInterval || 3000;
        this.shieldRechargeTimer = 0;
        // Enhanced state
        this.state = 'orbit'; // orbit, scout, mark, engage
        this.scoutTarget = null;
        this.markedEnemy = null;
        this.markTimer = 0;
        this.engageTimer = 0;
        this.scanAngle = 0;
        this.propellerPhase = 0;
    }

    update(dt, game) {
        if (!this.active) return;

        this.hoverPhase += dt * 6;
        this.propellerPhase += dt * 20;
        this.markTimer -= dt * 1000;
        this.engageTimer -= dt * 1000;

        // Smooth angle interpolation
        this.angle = lerp(this.angle, this.targetAngle, dt * 8);

        switch (this.type) {
            case 'attack':
                this._updateAttackDrone(dt, game);
                break;
            case 'shield':
                this._updateShieldDrone(dt, game);
                break;
            case 'repair':
                this._updateRepairDrone(dt, game);
                break;
            case 'scout':
                this._updateScoutDrone(dt, game);
                break;
        }
    }

    _orbitPlayer(dt) {
        this.orbitAngle += this.orbitSpeed * dt;
        const targetX = this.player.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        const targetY = this.player.y + Math.sin(this.orbitAngle) * this.orbitRadius;
        this.x = lerp(this.x, targetX, dt * 4);
        this.y = lerp(this.y, targetY, dt * 4);
    }

    _updateAttackDrone(dt, game) {
        // Attack drone - actively engages enemies, flanks when possible
        const now = performance.now();
        let nearest = null, minDist = this.range;

        for (const enemy of game.enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const d = distance(this.x, this.y, enemy.x, enemy.y);
            if (d < minDist) { minDist = d; nearest = enemy; }
        }

        if (nearest && this.engageTimer <= 0) {
            // Engage enemy
            this.state = 'engage';
            this.targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);

            // Move to optimal range (keep distance)
            const optimalRange = this.range * 0.6;
            const dx = nearest.x - this.x;
            const dy = nearest.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < optimalRange * 0.8) {
                // Too close, back up
                this.x -= (dx / dist) * 100 * dt;
                this.y -= (dy / dist) * 100 * dt;
            } else if (dist > optimalRange) {
                // Too far, approach
                this.x += (dx / dist) * 80 * dt;
                this.y += (dy / dist) * 80 * dt;
            }

            // Strafe around enemy
            const strafeAngle = this.targetAngle + Math.PI / 2;
            this.x += Math.cos(strafeAngle) * 40 * dt;
            this.y += Math.sin(strafeAngle) * 40 * dt;

            // Fire
            if (now - this.lastActionTime >= this.fireRate) {
                this.lastActionTime = now;
                const bx = this.x + Math.cos(this.targetAngle) * (this.radius + 5);
                const by = this.y + Math.sin(this.targetAngle) * (this.radius + 5);
                game.createBullet(bx, by, this.targetAngle, this.bulletSpeed, 3, '#FF8800', this.bulletDamage);
            }

            // Mark enemy for player
            if (this.markTimer <= 0) {
                this.markedEnemy = nearest;
                this.markTimer = 5000;
            }
        } else {
            this.state = 'orbit';
            this._orbitPlayer(dt);
        }
    }

    _updateShieldDrone(dt, game) {
        // Shield drone - projects protective field, positions strategically
        this._orbitPlayer(dt);

        // Recharge shield
        if (this.shieldHP <= 0 && this.maxShieldHP > 0) {
            this.shieldRechargeTimer += dt * 1000;
            if (this.shieldRechargeTimer >= 10000) {
                this.shieldHP = this.maxShieldHP;
                this.shieldRechargeTimer = 0;
            }
        }

        // Absorb bullets near player
        if (this.shieldHP > 0) {
            for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
                const b = game.enemyBullets[i];
                if (distance(b.x, b.y, this.player.x, this.player.y) < 60) {
                    b.active = false;
                    this.shieldHP -= b.damage || 10;
                    game.effects.push(new ImpactEffect(b.x, b.y));
                    if (this.shieldHP <= 0) { this.shieldHP = 0; break; }
                }
            }
        }

        // Intercept incoming projectiles
        for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
            const b = game.enemyBullets[i];
            if (distance(b.x, b.y, this.x, this.y) < 30) {
                b.active = false;
                game.effects.push(new ImpactEffect(b.x, b.y));
            }
        }
    }

    _updateRepairDrone(dt, game) {
        // Repair drone - heals player and nearby allies
        this._orbitPlayer(dt);

        const now = performance.now();
        if (now - this.lastActionTime >= this.healInterval) {
            this.lastActionTime = now;

            // Heal player
            if (this.player.hp < this.player.maxHP) {
                this.player.heal(this.healAmount);
                game.effects.push(new Particle(
                    this.player.x, this.player.y,
                    0, -30, 500, 4, '#00FF88'
                ));
            }

            // Heal nearby pets/drones
            for (const pet of game.pets) {
                if (pet.active && pet.hp < pet.maxHp && distance(this.x, this.y, pet.x, pet.y) < 100) {
                    pet.hp = Math.min(pet.maxHp, pet.hp + 1);
                }
            }
        }
    }

    _updateScoutDrone(dt, game) {
        // Scout drone - explores ahead, marks enemies, reveals area
        this.orbitRadius = 100;
        this.orbitSpeed = 2;
        this._orbitPlayer(dt);

        this.scanAngle += dt * 3;

        // Mark enemies in range
        if (this.markTimer <= 0) {
            for (const enemy of game.enemies) {
                if (!enemy.active || enemy.isDying) continue;
                const d = distance(this.x, this.y, enemy.x, enemy.y);
                if (d < 200) {
                    this.markedEnemy = enemy;
                    this.markTimer = 3000;
                    break;
                }
            }
        }

        // Reveal fog of war area (if active)
        if (game._challengeFogRadius) {
            // Extend visibility around drone
            game._extendedFogRadius = Math.max(game._challengeFogRadius, 400);
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) { this.active = false; }
    }

    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x;
        const bobY = Math.sin(this.hoverPhase) * 2;
        const sy = this.y - cameraOffset.y + bobY;

        // Propellers (spinning)
        if (quality !== 'low') {
            ctx.strokeStyle = 'rgba(150,150,150,0.4)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                const a = this.propellerPhase + (Math.PI / 2) * i;
                const propX = sx + Math.cos(a + this.orbitAngle) * this.radius * 0.8;
                const propY = sy + Math.sin(a + this.orbitAngle) * this.radius * 0.8;
                ctx.beginPath();
                ctx.moveTo(propX - Math.cos(a) * 8, propY - Math.sin(a) * 8);
                ctx.lineTo(propX + Math.cos(a) * 8, propY + Math.sin(a) * 8);
                ctx.stroke();
            }
        }

        // Body
        ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill();
        ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1.5; ctx.stroke();

        // Camera eye
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(sx + Math.cos(this.angle) * 5, sy + Math.sin(this.angle) * 5, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FF0000';
        ctx.beginPath(); ctx.arc(sx + Math.cos(this.angle) * 5, sy + Math.sin(this.angle) * 5, 2, 0, Math.PI * 2); ctx.fill();

        // Type indicator
        ctx.fillStyle = '#FFF'; ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, sx, sy);

        // Attack: show aim line and target
        if (this.type === 'attack' && this.state === 'engage') {
            ctx.strokeStyle = 'rgba(255,100,0,0.5)'; ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(this.angle) * 50, sy + Math.sin(this.angle) * 50);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Marked enemy indicator
        if (this.markedEnemy && this.markedEnemy.active) {
            const mx = this.markedEnemy.x - cameraOffset.x;
            const my = this.markedEnemy.y - cameraOffset.y;
            ctx.strokeStyle = 'rgba(255,0,0,0.6)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(mx, my, this.markedEnemy.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Shield: show shield HP
        if (this.type === 'shield' && this.maxShieldHP > 0) {
            const barW = 20, barH = 2;
            ctx.fillStyle = '#333'; ctx.fillRect(sx - barW / 2, sy - this.radius - 6, barW, barH);
            ctx.fillStyle = '#4488FF'; ctx.fillRect(sx - barW / 2, sy - this.radius - 6, barW * (this.shieldHP / this.maxShieldHP), barH);

            // Shield radius indicator
            if (this.shieldHP > 0) {
                ctx.strokeStyle = 'rgba(68,136,255,0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(sx, sy, 60, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // HP bar
        if (this.hp < this.maxHp) {
            const barW = 20, barH = 2;
            ctx.fillStyle = '#333'; ctx.fillRect(sx - barW / 2, sy - this.radius - 3, barW, barH);
            ctx.fillStyle = '#FF4444'; ctx.fillRect(sx - barW / 2, sy - this.radius - 3, barW * (this.hp / this.maxHp), barH);
        }
    }
}

// ============================================================
// TEAMMATE - AI-controlled ally that fights alongside player
// ============================================================
class Teammate {
    constructor(config, playerRef) {
        this.id = config.id;
        this.name = config.name;
        this.color = config.color;
        this.x = playerRef.x + 50;
        this.y = playerRef.y + 50;
        this.radius = 14;
        this.hp = 100;
        this.maxHp = 100;
        this.active = true;
        this.player = playerRef;
        this.angle = 0;
        this.state = 'follow'; // follow, engage, retreat, cover
        this.stateTimer = 0;
        // Weapons
        this.weapons = config.weapons || [
            { name: 'Rifle', damage: 12, fireRate: 120, bulletSpeed: 800, spread: 0.06, bulletRadius: 3, bulletColor: '#00CCFF' }
        ];
        this.currentWeaponIndex = 0;
        this.lastShotTime = 0;
        this.currentMag = 30;
        this.maxMag = 30;
        this.isReloading = false;
        this.reloadTimer = 0;
        // AI state
        this.targetEnemy = null;
        this.moveTarget = null;
        this.strafeDir = 1;
        this.strafeTimer = 0;
        this.coverTimer = 0;
        this.alertLevel = 0; // 0-1, increases when under fire
        // Animation
        this.bobPhase = 0;
        this.hitFlash = 0;
        this.muzzleFlash = 0;
        this.footstepTimer = 0;
    }

    get weapon() { return this.weapons[this.currentWeaponIndex]; }

    update(dt, game) {
        if (!this.active) return;

        this.bobPhase += dt * 8;
        if (this.hitFlash > 0) this.hitFlash -= dt * 1000;
        if (this.muzzleFlash > 0) this.muzzleFlash -= dt * 1000;
        this.stateTimer += dt * 1000;
        this.strafeTimer -= dt * 1000;
        this.coverTimer -= dt * 1000;

        // Reload
        if (this.isReloading) {
            this.reloadTimer -= dt * 1000;
            if (this.reloadTimer <= 0) {
                this.isReloading = false;
                this.currentMag = this.maxMag;
            }
        }

        // AI decision making
        this._makeDecision(dt, game);

        // Apply state
        switch (this.state) {
            case 'follow':
                this._followPlayer(dt);
                break;
            case 'engage':
                this._engageEnemy(dt, game);
                break;
            case 'retreat':
                this._retreat(dt, game);
                break;
            case 'cover':
                this._takeCover(dt, game);
                break;
        }

        // Clamp to world
        this.x = clamp(this.x, this.radius, CONFIG.world.width - this.radius);
        this.y = clamp(this.y, this.radius, CONFIG.world.height - this.radius);
    }

    _makeDecision(dt, game) {
        // Find nearest threat
        let nearestEnemy = null;
        let minDist = 500;
        for (const enemy of game.enemies) {
            if (!enemy.active || enemy.isDying) continue;
            const d = distance(this.x, this.y, enemy.x, enemy.y);
            if (d < minDist) { minDist = d; nearestEnemy = enemy; }
        }

        // Health check - retreat if low
        if (this.hp < this.maxHp * 0.3) {
            this.state = 'retreat';
            return;
        }

        // Combat decision
        if (nearestEnemy) {
            this.targetEnemy = nearestEnemy;
            if (minDist < 300) {
                this.state = 'engage';
            } else if (minDist < 500) {
                this.state = 'follow';
            }
        } else {
            this.state = 'follow';
            this.targetEnemy = null;
        }
    }

    _followPlayer(dt) {
        const followDist = 80;
        const dx = this.player.x - this.x;
        const dy = this.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > followDist) {
            const speed = 200;
            this.x += (dx / dist) * speed * dt;
            this.y += (dy / dist) * speed * dt;
            this.angle = Math.atan2(dy, dx);
        }

        // Face toward nearest enemy if close
        if (this.targetEnemy && this.targetEnemy.active) {
            this.angle = Math.atan2(this.targetEnemy.y - this.y, this.targetEnemy.x - this.x);
        }
    }

    _engageEnemy(dt, game) {
        if (!this.targetEnemy || !this.targetEnemy.active) {
            this.state = 'follow';
            return;
        }

        const dx = this.targetEnemy.x - this.x;
        const dy = this.targetEnemy.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.angle = Math.atan2(dy, dx);

        // Maintain optimal range
        const optimalRange = 150;
        if (dist > optimalRange + 50) {
            this.x += (dx / dist) * 150 * dt;
            this.y += (dy / dist) * 150 * dt;
        } else if (dist < optimalRange - 30) {
            this.x -= (dx / dist) * 100 * dt;
            this.y -= (dy / dist) * 100 * dt;
        }

        // Strafe
        if (this.strafeTimer <= 0) {
            this.strafeDir *= -1;
            this.strafeTimer = 1000 + Math.random() * 1000;
        }
        const strafeAngle = this.angle + Math.PI / 2 * this.strafeDir;
        this.x += Math.cos(strafeAngle) * 60 * dt;
        this.y += Math.sin(strafeAngle) * 60 * dt;

        // Shoot
        this._tryShoot(game);
    }

    _retreat(dt, game) {
        // Move away from enemies toward player
        const dx = this.player.x - this.x;
        const dy = this.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 50) {
            this.x += (dx / dist) * 200 * dt;
            this.y += (dy / dist) * 200 * dt;
            this.angle = Math.atan2(dy, dx);
        }

        // Heal if safe
        if (this.coverTimer <= 0 && distance(this.x, this.y, this.player.x, this.player.y) < 100) {
            this.hp = Math.min(this.maxHp, this.hp + 20 * dt);
        }
    }

    _takeCover(dt, game) {
        // Stay behind cover
        if (this.coverTimer <= 0) {
            this.state = 'follow';
        }
    }

    _tryShoot(game) {
        if (this.isReloading) return;

        const now = performance.now();
        if (now - this.lastShotTime < this.weapon.fireRate) return;

        if (this.currentMag <= 0) {
            this.isReloading = true;
            this.reloadTimer = 1500;
            return;
        }

        this.lastShotTime = now;
        this.currentMag--;
        this.muzzleFlash = 8;

        const gunTipX = this.x + Math.cos(this.angle) * (this.radius + 10);
        const gunTipY = this.y + Math.sin(this.angle) * (this.radius + 10);
        const spread = (Math.random() - 0.5) * this.weapon.spread * 2;
        game.createBullet(gunTipX, gunTipY, this.angle + spread, this.weapon.bulletSpeed, this.weapon.bulletRadius, this.weapon.bulletColor, this.weapon.damage);
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.hitFlash = 120;
        this.alertLevel = Math.min(1, this.alertLevel + 0.3);
        if (this.hp <= 0) { this.active = false; }
    }

    render(ctx, cameraOffset, quality) {
        if (!this.active) return;
        const sx = this.x - cameraOffset.x;
        const sy = this.y - cameraOffset.y;

        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 3, sy + 4, this.radius * 0.8, this.radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
        }

        // Body
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.angle);

        // Hit flash
        const isHit = this.hitFlash > 0;
        const bodyColor = isHit ? '#FFFFFF' : this.color;

        // Legs
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#2A2A2A';
            ctx.beginPath(); ctx.ellipse(-2, this.radius * 0.5, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-2, -this.radius * 0.5, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
        }

        // Body circle
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.stroke();

        // Head
        ctx.beginPath(); ctx.arc(this.radius * 0.3, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : '#333'; ctx.fill();

        // Gun
        ctx.fillStyle = '#555';
        ctx.fillRect(this.radius * 0.5, -2, this.radius + 5, 4);
        ctx.fillStyle = '#333';
        ctx.fillRect(this.radius + 3, -3, 8, 6);

        // Muzzle flash
        if (this.muzzleFlash > 0) {
            ctx.fillStyle = `rgba(255,200,50,${this.muzzleFlash / 8})`;
            ctx.beginPath(); ctx.arc(this.radius + 12, 0, 6, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();

        // Teammate indicator
        ctx.fillStyle = '#00CCFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ALLY', sx, sy - this.radius - 12);

        // Name
        ctx.fillStyle = '#FFF';
        ctx.font = '9px monospace';
        ctx.fillText(this.name, sx, sy - this.radius - 4);

        // HP bar
        const barW = 24, barH = 3;
        ctx.fillStyle = '#333'; ctx.fillRect(sx - barW / 2, sy + this.radius + 5, barW, barH);
        ctx.fillStyle = this.hp > this.maxHp * 0.5 ? '#00FF88' : this.hp > this.maxHp * 0.25 ? '#FFAA00' : '#FF4444';
        ctx.fillRect(sx - barW / 2, sy + this.radius + 5, barW * (this.hp / this.maxHp), barH);

        // Reload indicator
        if (this.isReloading) {
            ctx.fillStyle = '#FFAA00';
            ctx.font = '8px monospace';
            ctx.fillText('RELOAD', sx, sy + this.radius + 15);
        }

        // State indicator (debug)
        if (quality === 'high') {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '7px monospace';
            ctx.fillText(this.state.toUpperCase(), sx, sy + this.radius + 22);
        }
    }
}

// ============================================================
// AI TEAMMATE - Autonomous squad member for singleplayer
// ============================================================
class AITeammate {
    constructor(x, y, name, role) {
        this.x = x; this.y = y;
        this.name = name;
        this.role = role;
        this.radius = 14;
        this.hp = 100; this.maxHp = 100;
        this.alive = true; this.active = true;
        this.angle = 0; this.speed = 200;
        this.state = 'follow';
        this.target = null;
        this.lastShotTime = 0;
        this.hitFlash = 0;
        this._bobPhase = Math.random() * Math.PI * 2;
        this._prevX = x; this._prevY = y;
        this._velocityMag = 0;
        this._reloadTimer = 0;
        this._mag = 30; this._maxMag = 30;
        this._healCooldown = 0;
        this._strafeDir = Math.random() > 0.5 ? 1 : -1;
        this._strafeTimer = 0;
        this._dodgeCooldown = 0;
        this._coverTarget = null;
        this._lastHitTime = 0;
        this._kills = 0;
        this._damageDealt = 0;
        this._stuckTimer = 0;
        this._stuckX = x; this._stuckY = y;
        this._positionTimer = 0;
        this._combatTimer = 0;

        // Role-specific stats
        switch (role) {
            case 'assault':
                this.bodyColor = '#4A5D23'; this.headColor = '#3D4F1C';
                this.speed = 240; this.fireRate = 250; this.damage = 16;
                this.bulletSpeed = 800; this.attackRange = 300;
                this._maxMag = 30; this._mag = 30;
                this.detectionRange = 500;
                break;
            case 'medic':
                this.bodyColor = '#8B0000'; this.headColor = '#6B3A3A';
                this.speed = 220; this.fireRate = 450; this.damage = 10;
                this.bulletSpeed = 700; this.attackRange = 280;
                this._maxMag = 20; this._mag = 20;
                this._healAmount = 8; this._healRange = 180;
                this.detectionRange = 400;
                break;
            case 'sniper':
                this.bodyColor = '#2E4A2E'; this.headColor = '#3A5A3A';
                this.speed = 170; this.fireRate = 1000; this.damage = 40;
                this.bulletSpeed = 1200; this.attackRange = 600;
                this._maxMag = 8; this._mag = 8;
                this.detectionRange = 700;
                break;
            case 'support':
                this.bodyColor = '#3A3A2A'; this.headColor = '#2A2A1A';
                this.speed = 200; this.fireRate = 150; this.damage = 11;
                this.bulletSpeed = 750; this.attackRange = 320;
                this._maxMag = 60; this._mag = 60;
                this.detectionRange = 450;
                break;
        }
    }

    update(dt, game) {
        if (!this.alive || !this.active) return;
        if (this.hitFlash > 0) this.hitFlash -= dt * 1000;
        if (this._healCooldown > 0) this._healCooldown -= dt * 1000;
        if (this._dodgeCooldown > 0) this._dodgeCooldown -= dt * 1000;
        this._strafeTimer -= dt * 1000;
        this._combatTimer += dt;

        // Velocity tracking
        const dx = this.x - this._prevX, dy = this.y - this._prevY;
        this._velocityMag = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 0.001);
        this._prevX = this.x; this._prevY = this.y;
        if (this._velocityMag > 10) this._bobPhase += dt * 8;

        // Stuck detection
        this._positionTimer += dt * 1000;
        if (this._positionTimer > 500) {
            this._positionTimer = 0;
            const moved = distanceSq(this.x, this.y, this._stuckX, this._stuckY);
            if (moved < 100) {
                this._stuckTimer += 500;
                if (this._stuckTimer > 1000) {
                    this._stuckTimer = 0;
                    this.x += (Math.random() - 0.5) * 100;
                    this.y += (Math.random() - 0.5) * 100;
                }
            } else {
                this._stuckTimer = 0;
            }
            this._stuckX = this.x; this._stuckY = this.y;
        }

        // Reload
        if (this._reloadTimer > 0) {
            this._reloadTimer -= dt * 1000;
            if (this._reloadTimer <= 0) this._mag = this._maxMag;
        }

        // Find best target (smart targeting)
        this.target = this._findBestTarget(game);

        const playerDist = Math.sqrt(distanceSq(this.x, this.y, game.player.x, game.player.y));

        // Smart state machine
        this._decideState(game, playerDist);

        switch (this.state) {
            case 'follow': this._followPlayer(game, dt); break;
            case 'attack': this._attackEnemy(game, dt); break;
            case 'heal': this._healPlayer(game, dt); break;
            case 'retreat': this._retreat(game, dt); break;
            case 'cover': this._takeCover(game, dt); break;
            case 'flank': this._flankEnemy(game, dt); break;
        }

        // Dodge incoming bullets
        this._dodgeBullets(game, dt);

        // Keep in bounds
        this.x = clamp(this.x, this.radius, CONFIG.world.width - this.radius);
        this.y = clamp(this.y, this.radius, CONFIG.world.height - this.radius);
    }

    _findBestTarget(game) {
        let best = null, bestScore = -Infinity;
        const px = this.x, py = this.y;
        for (let i = 0, len = game.enemies.length; i < len; i++) {
            const e = game.enemies[i];
            if (!e.active || e.isDying) continue;
            const d = Math.sqrt(distanceSq(px, py, e.x, e.y));
            if (d > this.detectionRange) continue;
            let score = 0;
            // Closer = better
            score += Math.max(0, 500 - d);
            // Priority targets
            if (e.type === 'medic') score += 200;
            if (e.type === 'sniper') score += 150;
            if (e.type === 'bomber') score += 120;
            if (e.type === 'boss') score += 300;
            if (e.type === 'ninja') score += 180;
            // Low HP = finish off
            if (e.hp < 30) score += 150;
            // Threat level
            score += (e.detectionRange || 400) * 0.1;
            if (score > bestScore) { bestScore = score; best = e; }
        }
        return best;
    }

    _decideState(game, playerDist) {
        const hpRatio = this.hp / this.maxHp;
        const playerHpRatio = game.player.hp / game.player.maxHP;
        const hasTarget = this.target && this.target.active && !this.target.isDying;
        const targetDist = hasTarget ? Math.sqrt(distanceSq(this.x, this.y, this.target.x, this.target.y)) : Infinity;

        // Medic priority: heal injured player
        if (this.role === 'medic' && playerHpRatio < 0.65 && playerDist < this._healRange * 2.5) {
            this.state = 'heal'; return;
        }

        // Critical HP: retreat
        if (hpRatio < 0.25) {
            this.state = 'retreat'; return;
        }

        // Low HP and under fire: take cover
        if (hpRatio < 0.5 && performance.now() - this._lastHitTime < 2000) {
            this.state = 'cover'; return;
        }

        // Has target in range
        if (hasTarget && targetDist < this.detectionRange) {
            // Sniper: stay at max range
            if (this.role === 'sniper' && targetDist < this.attackRange * 0.5) {
                this.state = 'retreat'; return;
            }
            // Flank if target is focused on player
            if (this.target.angle !== undefined && targetDist < 400) {
                const targetFacingPlayer = Math.abs(this.target.angle - Math.atan2(game.player.y - this.target.y, game.player.x - this.target.x)) < 0.5;
                if (targetFacingPlayer && Math.random() < 0.3) {
                    this.state = 'flank'; return;
                }
            }
            this.state = 'attack'; return;
        }

        // No target: follow player
        this.state = 'follow';
    }

    _followPlayer(game, dt) {
        const dx = game.player.x - this.x, dy = game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Formation: different positions based on role
        let formX = 0, formY = 0;
        const playerAngle = game.player.angle;
        switch (this.role) {
            case 'assault':
                formX = Math.cos(playerAngle + 0.5) * 80;
                formY = Math.sin(playerAngle + 0.5) * 80;
                break;
            case 'medic':
                formX = Math.cos(playerAngle - 0.3) * 60;
                formY = Math.sin(playerAngle - 0.3) * 60;
                break;
            case 'sniper':
                formX = Math.cos(playerAngle + Math.PI) * 120;
                formY = Math.sin(playerAngle + Math.PI) * 120;
                break;
            case 'support':
                formX = Math.cos(playerAngle - 0.8) * 90;
                formY = Math.sin(playerAngle - 0.8) * 90;
                break;
        }
        const targetX = game.player.x + formX;
        const targetY = game.player.y + formY;
        const tdx = targetX - this.x, tdy = targetY - this.y;
        const tDist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tDist > 20) {
            this.x += (tdx / tDist) * this.speed * dt;
            this.y += (tdy / tDist) * this.speed * dt;
            this.angle = Math.atan2(tdy, tdx);
        }
        // Shoot nearby enemies while following
        if (this.target && this.target.active && !this.target.isDying) {
            const eDist = Math.sqrt(distanceSq(this.x, this.y, this.target.x, this.target.y));
            if (eDist < this.attackRange) this._shoot(game);
        }
    }

    _attackEnemy(game, dt) {
        if (!this.target || !this.target.active || this.target.isDying) return;
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.angle = Math.atan2(dy, dx);

        // Smart positioning based on role
        const optimalRange = this.role === 'sniper' ? this.attackRange * 0.8 :
                            this.role === 'assault' ? this.attackRange * 0.6 :
                            this.role === 'support' ? this.attackRange * 0.7 :
                            this.attackRange * 0.5;

        if (dist > optimalRange * 1.2) {
            // Close in
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        } else if (dist < optimalRange * 0.5) {
            // Back away
            this.x -= (dx / dist) * this.speed * 0.6 * dt;
            this.y -= (dy / dist) * this.speed * 0.6 * dt;
        } else {
            // Strafe
            if (this._strafeTimer <= 0) {
                this._strafeTimer = 1500 + Math.random() * 1500;
                this._strafeDir *= -1;
            }
            const perpX = -dy / dist, perpY = dx / dist;
            this.x += perpX * this.speed * 0.5 * this._strafeDir * dt;
            this.y += perpY * this.speed * 0.5 * this._strafeDir * dt;
        }

        this._shoot(game);
    }

    _shoot(game) {
        if (this._mag <= 0 || this._reloadTimer > 0) return;
        const now = performance.now();
        if (now - this.lastShotTime < this.fireRate) return;

        this.lastShotTime = now;
        this._mag--;

        const spread = this.role === 'sniper' ? (Math.random() - 0.5) * 0.03 :
                       this.role === 'assault' ? (Math.random() - 0.5) * 0.08 :
                       (Math.random() - 0.5) * 0.1;
        const bx = this.x + Math.cos(this.angle) * (this.radius + 10);
        const by = this.y + Math.sin(this.angle) * (this.radius + 10);
        const bulletColor = this.role === 'medic' ? '#00FFAA' :
                           this.role === 'sniper' ? '#FFCC00' :
                           this.role === 'support' ? '#88CCFF' : '#88FF88';
        game.createBullet(bx, by, this.angle + spread, this.bulletSpeed, 3, bulletColor, this.damage);
        this._damageDealt += this.damage;

        if (this._mag <= 0) this._reloadTimer = this.role === 'sniper' ? 3000 : 2000;
    }

    _healPlayer(game, dt) {
        const dx = game.player.x - this.x, dy = game.player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.angle = Math.atan2(dy, dx);

        if (dist > 50) {
            this.x += (dx / dist) * this.speed * 1.3 * dt;
            this.y += (dy / dist) * this.speed * 1.3 * dt;
            // Shoot enemies while moving to heal
            if (this.target && this.target.active && !this.target.isDying) {
                const eDist = Math.sqrt(distanceSq(this.x, this.y, this.target.x, this.target.y));
                if (eDist < this.attackRange * 0.7) this._shoot(game);
            }
        } else if (this._healCooldown <= 0) {
            this._healCooldown = 2500;
            const healAmount = this._healAmount || 8;
            game.player.heal(healAmount);
            game.effects.push(new Particle(game.player.x, game.player.y, 0, -40, 600, 4, '#00FF88'));
            game.scoreManager.floatingNumbers.push({
                x: game.player.x, y: game.player.y - 30,
                text: `+${healAmount} HP`, age: 0, maxAge: 800, vy: -50, color: '#00FF88'
            });
        }
    }

    _retreat(game, dt) {
        // Find threat and flee
        let threat = null, threatDist = Infinity;
        for (let i = 0, len = game.enemies.length; i < len; i++) {
            const e = game.enemies[i];
            if (!e.active || e.isDying) continue;
            const d = Math.sqrt(distanceSq(this.x, this.y, e.x, e.y));
            if (d < threatDist) { threatDist = d; threat = e; }
        }

        if (threat && threatDist < 400) {
            const dx = this.x - threat.x, dy = this.y - threat.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                this.x += (dx / dist) * this.speed * 1.2 * dt;
                this.y += (dy / dist) * this.speed * 1.2 * dt;
                this.angle = Math.atan2(-dy, -dx);
            }
        } else {
            // Move toward player
            const dx = game.player.x - this.x, dy = game.player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 50) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
        }

        // Self-heal when safe
        if (threatDist > 350 && this._healCooldown <= 0) {
            this._healCooldown = 4000;
            this.hp = Math.min(this.maxHp, this.hp + 15);
        }
    }

    _takeCover(game, dt) {
        // Find obstacle between self and threat
        let threat = null, threatDist = Infinity;
        for (let i = 0, len = game.enemies.length; i < len; i++) {
            const e = game.enemies[i];
            if (!e.active || e.isDying) continue;
            const d = Math.sqrt(distanceSq(this.x, this.y, e.x, e.y));
            if (d < threatDist) { threatDist = d; threat = e; }
        }

        if (!this._coverTarget && threat) {
            // Find nearest obstacle
            let bestCover = null, bestDist = Infinity;
            for (const obs of game.obstacles) {
                if (!obs.isSolid || !obs.isSolid()) continue;
                const b = obs.getBounds ? obs.getBounds() : null;
                if (!b) continue;
                const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
                const d = Math.sqrt(distanceSq(this.x, this.y, cx, cy));
                if (d < bestDist && d < 300) { bestDist = d; bestCover = { x: cx, y: cy }; }
            }
            this._coverTarget = bestCover;
        }

        if (this._coverTarget) {
            const dx = this._coverTarget.x - this.x, dy = this._coverTarget.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 30) {
                this.x += (dx / dist) * this.speed * 1.2 * dt;
                this.y += (dy / dist) * this.speed * 1.2 * dt;
            } else {
                // At cover, heal
                if (this._healCooldown <= 0) {
                    this._healCooldown = 4000;
                    this.hp = Math.min(this.maxHp, this.hp + 12);
                }
                this._coverTarget = null;
            }
        } else {
            this.state = 'follow';
        }
    }

    _flankEnemy(game, dt) {
        if (!this.target || !this.target.active || !this.target.isDying) { this.state = 'attack'; return; }
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / dist, perpY = dx / dist;
        const flankX = this.target.x + perpX * 120;
        const flankY = this.target.y + perpY * 120;
        const fdx = flankX - this.x, fdy = flankY - this.y;
        const fDist = Math.sqrt(fdx * fdx + fdy * fdy);
        if (fDist > 20) {
            this.x += (fdx / fDist) * this.speed * 1.1 * dt;
            this.y += (fdy / fDist) * this.speed * 1.1 * dt;
        }
        this.angle = Math.atan2(dy, dx);
        if (dist < this.attackRange) this._shoot(game);
    }

    _dodgeBullets(game, dt) {
        if (this._dodgeCooldown > 0) return;
        for (const b of game.enemyBullets) {
            if (!b.active) continue;
            const dx = b.x - this.x, dy = b.y - this.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 10000) continue; // 100^2
            // Check if bullet heading toward us
            const bAngle = Math.atan2(b.vy, b.vx);
            const toMe = Math.atan2(-dy, -dx);
            let diff = Math.abs(bAngle - toMe);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 0.5) {
                // Dodge perpendicular
                const perpAngle = bAngle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
                this.x += Math.cos(perpAngle) * this.speed * 0.8 * dt * 3;
                this.y += Math.sin(perpAngle) * this.speed * 0.8 * dt * 3;
                this._dodgeCooldown = 300;
                break;
            }
        }
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.hp -= amount; this.hitFlash = 120;
        this._lastHitTime = performance.now();
        if (this.hp <= 0) { this.alive = false; this.active = false; }
    }

    render(ctx, cameraOffset, quality) {
        if (!this.alive || !this.active) return;
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        if (sx < -50 || sx > ctx.canvas.width + 50 || sy < -50 || sy > ctx.canvas.height + 50) return;

        const alpha = this.hitFlash > 0 ? 0.7 : 1;
        ctx.save(); ctx.globalAlpha = alpha;

        // Shadow
        if (quality !== 'low') {
            ctx.beginPath(); ctx.ellipse(sx + 3, sy + 4, this.radius * 0.8, this.radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
        }

        ctx.translate(sx, sy); ctx.rotate(this.angle);
        const bob = Math.sin(this._bobPhase) * 0.02;
        if (bob !== 0) ctx.scale(1 + bob, 1 - bob);
        const isHit = this.hitFlash > 0;
        const bc = isHit ? '#FFFFFF' : this.bodyColor;

        // Legs
        if (quality !== 'low') {
            ctx.fillStyle = isHit ? '#DDD' : '#2A2A2A';
            ctx.beginPath(); ctx.ellipse(-2, this.radius * 0.5, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-2, -this.radius * 0.5, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
        }

        // Body
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = bc; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();

        // Role details
        if (quality !== 'low') {
            if (this.role === 'medic') {
                ctx.fillStyle = '#FF0000';
                ctx.fillRect(-2, -5, 4, 10); ctx.fillRect(-5, -2, 10, 4);
            } else if (this.role === 'sniper') {
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(this.radius * 0.3, 0); ctx.lineTo(this.radius + 20, 0); ctx.stroke();
            } else if (this.role === 'support') {
                ctx.fillStyle = 'rgba(50,50,50,0.3)';
                ctx.fillRect(-this.radius * 0.3, -this.radius * 0.6, this.radius * 0.6, this.radius * 1.2);
            }
        }

        // Head
        ctx.beginPath(); ctx.arc(this.radius * 0.3, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#FFCCCC' : this.headColor; ctx.fill();

        // Gun
        ctx.fillStyle = '#333';
        ctx.fillRect(this.radius * 0.3, -2, this.radius + 10, 4);

        ctx.restore(); ctx.globalAlpha = 1;

        // Name tag with role icon
        const roleIcon = this.role === 'medic' ? '+' : this.role === 'sniper' ? 'S' : this.role === 'support' ? 'A' : 'R';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillStyle = this.state === 'heal' ? '#00FF88' : this.state === 'attack' ? '#FF8800' : this.state === 'retreat' ? '#FF4444' : '#00CCFF';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${roleIcon} ${this.name}`, sx, sy - this.radius - 16);

        // HP bar
        if (this.hp < this.maxHp) {
            const barW = this.radius * 2, barH = 3;
            ctx.fillStyle = '#222'; ctx.fillRect(sx - barW / 2, sy - this.radius - 10, barW, barH);
            const pct = this.hp / this.maxHp;
            ctx.fillStyle = pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#FF9800' : '#F44336';
            ctx.fillRect(sx - barW / 2, sy - this.radius - 10, barW * pct, barH);
        }

        // Reload indicator
        if (this._reloadTimer > 0) {
            ctx.font = '7px monospace'; ctx.fillStyle = '#FFAA00'; ctx.textAlign = 'center';
            ctx.fillText('RLD', sx, sy + this.radius + 12);
        }

        // State icon
        if (this.state === 'heal') {
            ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#00FF88'; ctx.textAlign = 'center';
            ctx.fillText('+', sx, sy - this.radius - 24);
        } else if (this.state === 'retreat') {
            ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#FF4444'; ctx.textAlign = 'center';
            ctx.fillText('!', sx, sy - this.radius - 24);
        } else if (this.state === 'flank') {
            ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#FFaa00'; ctx.textAlign = 'center';
            ctx.fillText('F', sx, sy - this.radius - 24);
        }
    }
}
