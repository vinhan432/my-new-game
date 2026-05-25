/**
 * Dodge Warfare - Enhanced Bot Controller v3
 * Kill-driven learning: every kill makes the bot smarter instantly
 */

class BotController {
    constructor() {
        this.active = false;
        this.virtualInput = new BotInput();
        this._decisionTimer = 0;
        this._targetEnemy = null;
        this._moveTarget = null;
        this._strafeDir = 1;
        this._dodgeCooldown = 0;
        this._weaponSwitchTimer = 0;
        this._exploreAngle = Math.random() * Math.PI * 2;
        this._exploreTimer = 0;
        this._lastPlayerX = 0; this._lastPlayerY = 0;
        this._stuckTimer = 0;
        this._retreatTimer = 0;
        this._aimSmooth = 0;
        this._burstTimer = 0;
        this._burstPause = false;

        // Kill-driven learning
        this._kills = 0;
        this._runTime = 0;
        this._skillLevel = 0.4;
        this._aimAccuracy = 0.72;
        this._reactionSpeed = 1.2;
        this._decisionQuality = 0.55;

        // Knowledge base — populated per kill
        this._knowledge = {
            // Per enemy type: { kills, avgKillTime, bestWeapon, bestRange, threat, dodgeSuccess }
            enemyTypes: {},
            // Weapon effectiveness: { weaponName: { kills, avgRange, accuracy } }
            weapons: {},
            // Global patterns
            totalKills: 0,
            totalDeaths: 0,
            bestCombo: 0,
            currentCombo: 0,
            comboTimer: 0,
            lastKillTime: 0,
            killTimes: [], // Last 20 kill timestamps for TTK learning
        };

        // Tactical memory
        this._lastDamageTime = 0;
        this._enemyThreatMemory = new Map();
        this._coverTimer = 0;
        this._flankSide = 1;
        this._engageTimer = 0;

        // Smart dodging
        this._nearbyBulletCount = 0;
        this._closestBulletDist = Infinity;
        this._bulletDangerAngle = -1;

        // Kill learning callback reference
        this._onKillCallback = null;
    }

    toggle() {
        this.active = !this.active;
        this._decisionTimer = 0;
        this._stuckTimer = 0;
        this._runTime = 0;
        return this.active;
    }

    // Called by game.js when an enemy is killed
    onEnemyKilled(enemy, weapon, dist, game) {
        this._kills++;
        const kb = this._knowledge;
        kb.totalKills++;

        // === COMBO LEARNING ===
        const now = performance.now();
        const timeSinceLastKill = now - kb.lastKillTime;
        kb.lastKillTime = now;
        if (timeSinceLastKill < 3000) {
            kb.currentCombo++;
            if (kb.currentCombo > kb.bestCombo) kb.bestCombo = kb.currentCombo;
        } else {
            kb.currentCombo = 1;
        }
        kb.killTimes.push(now);
        if (kb.killTimes.length > 20) kb.killTimes.shift();

        // === ENEMY TYPE LEARNING ===
        const eType = enemy.type;
        if (!kb.enemyTypes[eType]) {
            kb.enemyTypes[eType] = {
                kills: 0, totalKillTime: 0, avgKillTime: 0,
                bestWeapon: null, bestRange: 0, bestRangeKills: 0,
                threatLevel: 0, dodgeSuccess: 0, dodgeAttempts: 0,
                killDistances: [], preferredAngle: 0
            };
        }
        const ek = kb.enemyTypes[eType];
        ek.kills++;
        ek.totalKillTime += (now - (enemy._spawnTime || now));
        ek.avgKillTime = ek.totalKillTime / ek.kills;

        // Learn best range for this enemy type
        if (dist !== undefined) {
            ek.killDistances.push(dist);
            if (ek.killDistances.length > 10) ek.killDistances.shift();
            ek.bestRange = ek.killDistances.reduce((a, b) => a + b, 0) / ek.killDistances.length;
        }

        // Learn best weapon for this enemy type
        if (weapon) {
            const wName = weapon.name;
            if (!kb.weapons[wName]) {
                kb.weapons[wName] = { kills: 0, totalRange: 0, avgRange: 0, typeKills: {} };
            }
            const wk = kb.weapons[wName];
            wk.kills++;
            if (dist) { wk.totalRange += dist; wk.avgRange = wk.totalRange / wk.kills; }
            wk.typeKills[eType] = (wk.typeKills[eType] || 0) + 1;

            // Track which weapon kills this enemy type fastest
            if (!ek.bestWeapon || (wk.typeKills[eType] || 0) > (kb.weapons[ek.bestWeapon]?.typeKills?.[eType] || 0)) {
                ek.bestWeapon = wName;
            }
        }

        // === SKILL GROWTH (kill-driven, much faster) ===
        // Each kill gives a significant boost
        const killBonus = 0.03 + Math.min(kb.totalKills * 0.002, 0.05); // 3-8% per kill
        this._skillLevel = Math.min(1.0, this._skillLevel + killBonus);

        // Combo bonus: killing fast accelerates learning
        if (kb.currentCombo >= 3) this._skillLevel = Math.min(1.0, this._skillLevel + 0.02);
        if (kb.currentCombo >= 5) this._skillLevel = Math.min(1.0, this._skillLevel + 0.03);
        if (kb.currentCombo >= 10) this._skillLevel = Math.min(1.0, this._skillLevel + 0.05);

        // Derived stats
        this._aimAccuracy = Math.min(0.99, 0.72 + this._skillLevel * 0.27);
        this._decisionQuality = Math.min(0.98, 0.55 + this._skillLevel * 0.43);
        this._reactionSpeed = Math.max(0.3, 1.2 - this._skillLevel * 0.7);

        // === ENEMY THREAT RECALIBRATION ===
        // If we kill this type easily, lower its threat priority
        if (ek.kills >= 3) {
            const killEfficiency = ek.kills / Math.max(1, ek.avgKillTime / 1000);
            ek.threatLevel = Math.max(0, 10 - killEfficiency);
        }
    }

    // Called when bot takes damage
    onDamageTaken(enemyType) {
        this._knowledge.totalDeaths++;
        if (enemyType) {
            if (!this._knowledge.enemyTypes[enemyType]) {
                this._knowledge.enemyTypes[enemyType] = {
                    kills: 0, totalKillTime: 0, avgKillTime: 0,
                    bestWeapon: null, bestRange: 0, bestRangeKills: 0,
                    threatLevel: 5, dodgeSuccess: 0, dodgeAttempts: 0,
                    killDistances: [], preferredAngle: 0
                };
            }
            // Increase threat of enemies that hurt us
            this._knowledge.enemyTypes[enemyType].threatLevel =
                Math.min(10, (this._knowledge.enemyTypes[enemyType].threatLevel || 5) + 1);
            this._enemyThreatMemory.set(enemyType,
                (this._enemyThreatMemory.get(enemyType) || 0) + 1);
        }
    }

    // Called when dodge succeeds (avoided damage)
    onDodgeSuccess(enemyType) {
        if (enemyType && this._knowledge.enemyTypes[enemyType]) {
            this._knowledge.enemyTypes[enemyType].dodgeSuccess =
                (this._knowledge.enemyTypes[enemyType].dodgeSuccess || 0) + 1;
        }
    }

    update(dt, game) {
        if (!this.active || !game.player.alive) return;

        const player = game.player;
        const enemies = game.enemies;
        const pickups = game.pickups;
        const enemyBullets = game.enemyBullets;
        const vi = this.virtualInput;

        vi._frameReset();
        this._dodgeCooldown = Math.max(0, this._dodgeCooldown - dt * 1000);
        this._weaponSwitchTimer = Math.max(0, this._weaponSwitchTimer - dt * 1000);
        this._retreatTimer = Math.max(0, this._retreatTimer - dt * 1000);
        this._coverTimer = Math.max(0, this._coverTimer - dt * 1000);
        this._engageTimer = Math.max(0, this._engageTimer - dt * 1000);
        this._burstTimer -= dt * 1000;

        // Combo timer decay
        this._knowledge.comboTimer -= dt * 1000;
        if (this._knowledge.comboTimer <= 0) this._knowledge.currentCombo = 0;

        this._runTime += dt;

        // Stuck detection
        const movedDist = distanceSq(player.x, player.y, this._lastPlayerX, this._lastPlayerY);
        if (movedDist < 25 && vi.moveX !== 0) {
            this._stuckTimer += dt * 1000;
            if (this._stuckTimer > 400) {
                this._exploreAngle += Math.PI * 0.5 + Math.random() * Math.PI;
                this._stuckTimer = 0;
                this._moveTarget = null;
            }
        } else {
            this._stuckTimer = 0;
        }
        this._lastPlayerX = player.x; this._lastPlayerY = player.y;

        // Build bullet danger grid
        this._buildBulletGrid(player, enemyBullets);

        // Track damage for learning
        if (player.hitFlash > 0 && this._runTime - this._lastDamageTime > 0.5) {
            this._lastDamageTime = this._runTime;
            // Find closest enemy to blame
            let closestEnemy = null, closestDist = Infinity;
            for (let i = 0, len = enemies.length; i < len; i++) {
                const e = enemies[i];
                if (!e.active || e.isDying) continue;
                const d = distanceSq(player.x, player.y, e.x, e.y);
                if (d < closestDist) { closestDist = d; closestEnemy = e; }
            }
            if (closestEnemy) this.onDamageTaken(closestEnemy.type);
        }

        // Decision making: faster with higher skill
        const decisionInterval = Math.max(20, 70 - this._skillLevel * 50);
        this._decisionTimer -= dt * 1000;
        if (this._decisionTimer <= 0) {
            this._decisionTimer = decisionInterval + Math.random() * 15;
            this._makeDecision(dt, player, enemies, pickups, enemyBullets, game);
        }

        // Apply movement
        if (this._moveTarget) {
            const dx = this._moveTarget.x - player.x;
            const dy = this._moveTarget.y - player.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > 225) {
                const dist = Math.sqrt(distSq);
                vi.moveX = dx / dist;
                vi.moveY = dy / dist;
            }
        }

        // Smooth aim with knowledge-based prediction
        if (this._targetEnemy && this._targetEnemy.active && !this._targetEnemy.isDying) {
            const predicted = this._predictTarget(player, this._targetEnemy);
            const desiredAngle = Math.atan2(predicted.y - player.y, predicted.x - player.x);
            let angleDiff = desiredAngle - this._aimSmooth;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            const aimSpeed = 6 + this._skillLevel * 14;
            this._aimSmooth += angleDiff * Math.min(1, dt * aimSpeed);
            vi.aimAngle = this._aimSmooth;

            const aimError = Math.abs(angleDiff);
            const hitThreshold = 0.15 + (1 - this._aimAccuracy) * 0.12;

            if (aimError < hitThreshold) {
                const wName = player.weapon.name;
                let burstDuration, pauseDuration;
                if (wName === 'Sniper') { burstDuration = 0; pauseDuration = 400; }
                else if (wName === 'Shotgun') { burstDuration = 0; pauseDuration = 350; }
                else if (wName === 'Rocket') { burstDuration = 0; pauseDuration = 600; }
                else if (wName === 'Flamethrower') { burstDuration = 3000; pauseDuration = 0; }
                else if (wName === 'SMG') { burstDuration = 300; pauseDuration = 40; }
                else if (wName === 'Dual Pistol') { burstDuration = 250; pauseDuration = 60; }
                else { burstDuration = 200; pauseDuration = 60; }

                // Under pressure: shorter bursts
                if (this._runTime - this._lastDamageTime < 1.5) {
                    burstDuration *= 0.5;
                    pauseDuration *= 1.4;
                }

                if (this._burstPause) {
                    if (this._burstTimer <= 0) { this._burstPause = false; this._burstTimer = burstDuration; }
                } else {
                    vi.shooting = true;
                    if (this._burstTimer <= 0 && pauseDuration > 0) { this._burstPause = true; this._burstTimer = pauseDuration; }
                }
            }
        } else {
            this._aimSmooth = player.angle;
        }
    }

    _makeDecision(dt, player, enemies, pickups, enemyBullets, game) {
        const vi = this.virtualInput;
        const px = player.x, py = player.y;

        // === AUTO-EXTRACT: Mission complete, move to extraction ===
        if (game.waveManager && !game.endlessMode) {
            const maxWaves = game.currentMission?.waves || 999;
            if (game.waveManager.wave >= maxWaves && game.waveManager.state === 'between') {
                // Mission complete — move to extraction zone
                const extractX = game.currentMission?.playerSpawn?.x || CONFIG.world.width / 2;
                const extractY = game.currentMission?.playerSpawn?.y || CONFIG.world.height / 2;
                this._moveTarget = { x: extractX, y: extractY };
                this._targetEnemy = null;
                vi.sprinting = player.stamina > 20;
                game.killFeed.add('Mission Complete — Extracting');
                return;
            }
        }

        const threat = this._assessThreats(player, enemies, enemyBullets);

        // P1: Smart dodge
        const dodgeResult = this._smartDodge(player, threat, enemyBullets);
        if (dodgeResult) {
            vi.dodging = dodgeResult.dodge;
            this._moveTarget = dodgeResult.target;
            this._dodgeCooldown = dodgeResult.cooldown;
            return;
        }

        // P1b: Stealth ninja
        const ninjaThreat = this._detectStealthNinja(player, enemies);
        if (ninjaThreat) {
            this._targetEnemy = ninjaThreat;
            this._moveTarget = this._fleeFrom(player, ninjaThreat, 220);
            vi.sprinting = true;
            return;
        }

        // P1c: Hazards
        if (this._avoidHazards(player, game)) return;

        // P2: Survival
        const hpRatio = player.hp / player.maxHP;
        if (hpRatio < 0.2) {
            this._retreatTimer = 4000;
            const healthPickup = this._findBestPickup(player, pickups, 'health');
            if (healthPickup) {
                this._moveTarget = { x: healthPickup.x, y: healthPickup.y };
                this._targetEnemy = threat.nearestEnemy;
                vi.sprinting = true;
                return;
            }
            if (threat.nearestEnemy) {
                this._moveTarget = this._fleeFrom(player, threat.nearestEnemy, 450);
                this._targetEnemy = threat.nearestEnemy;
                vi.sprinting = true;
                return;
            }
        }

        // P3: Cover when hurt
        if (hpRatio < 0.4 && this._retreatTimer <= 0 && threat.dangerLevel > 2) {
            const cover = this._findCover(player, threat.nearestEnemy, game.obstacles);
            if (cover && distanceSq(px, py, cover.x, cover.y) < 160000) {
                this._moveTarget = cover;
                this._coverTimer = 2000;
                this._targetEnemy = threat.nearestEnemy;
                return;
            }
        }

        // P4: Resources
        if (this._manageResources(player, pickups, threat, game)) return;

        // P5: Weapon (knowledge-based)
        if (this._weaponSwitchTimer <= 0) {
            this._selectBestWeapon(player, threat);
            this._weaponSwitchTimer = 1200;
        }

        // P6: Explosive opportunism
        if (this._exploitBarrels(player, enemies, game)) return;

        // P7: Combat
        if (threat.nearestEnemy) {
            this._engageCombat(player, enemies, threat, game);
        } else {
            this._exploreAndCollect(player, pickups, game);
        }
    }

    // === THREAT ASSESSMENT (knowledge-enhanced) ===
    _assessThreats(player, enemies, enemyBullets) {
        const result = { incomingBullets: [], nearestEnemy: null, dangerLevel: 0, highPriorityTargets: [] };
        const px = player.x, py = player.y;
        const kb = this._knowledge;

        // Incoming bullets
        for (let i = 0, len = enemyBullets.length; i < len; i++) {
            const b = enemyBullets[i];
            const dx = b.x - px, dy = b.y - py;
            const distSq = dx * dx + dy * dy;
            if (distSq > 62500) continue;
            const bulletAngle = Math.atan2(b.vy, b.vx);
            const toPlayer = Math.atan2(py - b.y, px - b.x);
            let angleDiff = Math.abs(bulletAngle - toPlayer);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            if (angleDiff < 0.4) {
                result.incomingBullets.push({ dist: Math.sqrt(distSq), angle: bulletAngle, bullet: b });
            }
        }
        result.incomingBullets.sort((a, b) => a.dist - b.dist);

        // Enemy analysis with knowledge
        let nearestDist = Infinity;
        for (let i = 0, len = enemies.length; i < len; i++) {
            const e = enemies[i];
            if (!e.active || e.isDying) continue;
            const dx = px - e.x, dy = py - e.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) { nearestDist = d; result.nearestEnemy = e; }

            // Knowledge-based threat assessment
            const ek = kb.enemyTypes[e.type];
            const threatLevel = ek ? ek.threatLevel : 5;
            const kills = ek ? ek.kills : 0;

            // High priority: enemies we haven't mastered yet, or dangerous types
            if (threatLevel > 6 || kills < 3 || e.type === 'medic' || e.type === 'sniper' || e.type === 'bomber' || e.type === 'boss' || e.type === 'ninja') {
                result.highPriorityTargets.push({ enemy: e, dist: d, threat: threatLevel });
            }

            if (d < 300) result.dangerLevel += 2;
            else if (d < 600) result.dangerLevel += 1;
        }
        result.highPriorityTargets.sort((a, b) => b.threat - a.threat || a.dist - b.dist);

        return result;
    }

    // === SMART DODGING (learns from kills) ===
    _smartDodge(player, threat, enemyBullets) {
        if (this._dodgeCooldown > 0 || threat.incomingBullets.length === 0) return null;

        const px = player.x, py = player.y;
        const closest = threat.incomingBullets[0];
        const bulletSpeed = Math.sqrt(closest.bullet.vx ** 2 + closest.bullet.vy ** 2);

        // Faster reaction at higher skill
        const baseThreshold = Math.min(200, 70 + bulletSpeed * 0.14);
        const dodgeThreshold = baseThreshold * (0.6 + this._skillLevel * 0.7);

        if (closest.dist > dodgeThreshold) return null;

        const safeDir = this._findSafeDodgeDirection(player, threat.incomingBullets);

        if (closest.dist < dodgeThreshold * 0.5) {
            return {
                dodge: true,
                target: { x: px + safeDir.x * 300, y: py + safeDir.y * 300 },
                cooldown: Math.max(400, 800 - this._skillLevel * 400)
            };
        } else {
            return {
                dodge: false,
                target: { x: px + safeDir.x * 220, y: py + safeDir.y * 220 },
                cooldown: 0
            };
        }
    }

    _findSafeDodgeDirection(player, incomingBullets) {
        const px = player.x, py = player.y;
        let bestAngle = 0, bestScore = -Infinity;

        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const dx = Math.cos(angle), dy = Math.sin(angle);
            let score = 0;

            for (const b of incomingBullets) {
                const bx = b.bullet.vx, by = b.bullet.vy;
                const bLen = Math.sqrt(bx * bx + by * by) || 1;
                const cross = Math.abs(dx * (by / bLen) - dy * (bx / bLen));
                score += cross * 120;
                const toBulletX = b.bullet.x - px, toBulletY = b.bullet.y - py;
                score -= (dx * toBulletX + dy * toBulletY) * 0.4;
            }

            const testX = px + dx * 180, testY = py + dy * 180;
            if (testX < 100 || testX > CONFIG.world.width - 100) score -= 250;
            if (testY < 100 || testY > CONFIG.world.height - 100) score -= 250;

            if (score > bestScore) { bestScore = score; bestAngle = angle; }
        }

        return { x: Math.cos(bestAngle), y: Math.sin(bestAngle) };
    }

    _buildBulletGrid(player, enemyBullets) {
        const px = player.x, py = player.y;
        this._nearbyBulletCount = 0;
        this._closestBulletDist = Infinity;
        for (let i = 0, len = enemyBullets.length; i < len; i++) {
            const b = enemyBullets[i];
            const dx = b.x - px, dy = b.y - py;
            const distSq = dx * dx + dy * dy;
            if (distSq < 90000) {
                this._nearbyBulletCount++;
                const dist = Math.sqrt(distSq);
                if (dist < this._closestBulletDist) this._closestBulletDist = dist;
            }
        }
    }

    _detectStealthNinja(player, enemies) {
        for (let i = 0, len = enemies.length; i < len; i++) {
            const e = enemies[i];
            if (e.type === 'ninja' && !e.isDying && e.active) {
                if (distanceSq(player.x, player.y, e.x, e.y) < 40000) return e;
            }
        }
        return null;
    }

    _avoidHazards(player, game) {
        const px = player.x, py = player.y;
        if (game.barbedWires) {
            for (let i = 0, len = game.barbedWires.length; i < len; i++) {
                const bw = game.barbedWires[i];
                const cx = bw.x + bw.w / 2, cy = bw.y + bw.h / 2;
                if (distanceSq(px, py, cx, cy) < 6400) {
                    const dx = px - cx, dy = py - cy;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    this._moveTarget = { x: px + (dx / len) * 180, y: py + (dy / len) * 180 };
                    return true;
                }
            }
        }
        if (game.barrels) {
            for (let i = 0, len = game.barrels.length; i < len; i++) {
                const b = game.barrels[i];
                if (b.destroyed) continue;
                const bx = b.x + (b.radius || 12), by = b.y + (b.radius || 12);
                if (distanceSq(px, py, bx, by) < 2500) {
                    let enemyNear = false;
                    for (let j = 0, eLen = game.enemies.length; j < eLen; j++) {
                        const e = game.enemies[j];
                        if (!e.active || e.isDying) continue;
                        if (distanceSq(e.x, e.y, bx, by) < 10000) { enemyNear = true; break; }
                    }
                    if (enemyNear) {
                        const dx = px - bx, dy = py - by;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        this._moveTarget = { x: px + (dx / len) * 200, y: py + (dy / len) * 200 };
                        return true;
                    }
                }
            }
        }
        return false;
    }

    _manageResources(player, pickups, threat, game) {
        const vi = this.virtualInput;
        const px = player.x, py = player.y;

        if (player.currentMag < player.weapon.magSize * 0.25 && !player.isReloading &&
            player.weapon.reserveAmmo > 0 && threat.dangerLevel < 2) {
            vi.reload = true;
        }
        if (player.currentMag < 3 && player.weapon.reserveAmmo > 0) vi.reload = true;

        if (player.weapon.reserveAmmo < player.weapon.magSize * 0.5) {
            const ammoPickup = this._findBestPickup(player, pickups, 'ammo');
            if (ammoPickup && distanceSq(px, py, ammoPickup.x, ammoPickup.y) < 250000) {
                this._moveTarget = { x: ammoPickup.x, y: ammoPickup.y };
                this._targetEnemy = threat.nearestEnemy;
                return true;
            }
        }

        if (player.hp < player.maxHP * 0.55 && this._retreatTimer <= 0) {
            const healthPickup = this._findBestPickup(player, pickups, 'health');
            if (healthPickup && distanceSq(px, py, healthPickup.x, healthPickup.y) < 360000) {
                this._moveTarget = { x: healthPickup.x, y: healthPickup.y };
                this._targetEnemy = threat.nearestEnemy;
                return true;
            }
        }

        if (player.stamina < 25 && threat.dangerLevel > 2) {
            const staminaPickup = this._findBestPickup(player, pickups, 'stamina');
            if (staminaPickup && distanceSq(px, py, staminaPickup.x, staminaPickup.y) < 160000) {
                this._moveTarget = { x: staminaPickup.x, y: staminaPickup.y };
                return true;
            }
        }

        return false;
    }

    _exploitBarrels(player, enemies, game) {
        if (!game.barrels) return false;
        const px = player.x, py = player.y;
        for (let i = 0, len = game.barrels.length; i < len; i++) {
            const barrel = game.barrels[i];
            if (barrel.destroyed) continue;
            const bx = barrel.x + (barrel.radius || 12), by = barrel.y + (barrel.radius || 12);
            if (distanceSq(px, py, bx, by) > 250000) continue;
            let enemiesNear = 0;
            for (let j = 0, eLen = enemies.length; j < eLen; j++) {
                const e = enemies[j];
                if (!e.active || e.isDying) continue;
                if (distanceSq(e.x, e.y, bx, by) < 10000) enemiesNear++;
            }
            if (enemiesNear >= 2 || (enemiesNear >= 1 && distanceSq(player.x, player.y, bx, by) < 40000)) {
                this._targetEnemy = { x: bx, y: by, active: true, isDying: false, type: 'barrel', radius: barrel.radius || 15 };
                return true;
            }
        }
        return false;
    }

    // === COMBAT (knowledge-based) ===
    _engageCombat(player, enemies, threat, game) {
        const vi = this.virtualInput;
        const px = player.x, py = player.y;
        const kb = this._knowledge;

        this._targetEnemy = this._selectTarget(player, enemies, threat);
        const target = this._targetEnemy;
        if (!target) return;

        const dx = px - target.x, dy = py - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const optimalRange = this._getOptimalRange(player, target);
        const danger = threat.dangerLevel;

        if (target.type === 'boss') { this._handleBossCombat(player, target, dist, game); return; }
        if (target.type === 'medic' && dist > 120) {
            this._moveTarget = { x: target.x, y: target.y };
            vi.sprinting = player.stamina > 30;
            return;
        }
        if (target.type === 'shield') {
            const behindX = target.x + Math.cos(target.angle) * 80;
            const behindY = target.y + Math.sin(target.angle) * 80;
            this._moveTarget = { x: behindX, y: behindY };
            vi.sprinting = player.stamina > 40;
            return;
        }

        // Knowledge-based range: use learned optimal distance for this enemy type
        const ek = kb.enemyTypes[target.type];
        const learnedRange = ek && ek.bestRange > 0 ? ek.bestRange : optimalRange;
        const effectiveRange = (learnedRange + optimalRange) / 2;

        if (dist < effectiveRange * 0.5) {
            this._moveTarget = this._fleeFrom(player, target, effectiveRange * 0.8);
            vi.sprinting = this._shouldSprint(player, dist, danger);
        } else if (dist > effectiveRange * 2) {
            this._moveTarget = { x: target.x, y: target.y };
            vi.sprinting = this._shouldSprint(player, dist, danger);
        } else {
            this._strafeDir *= (Math.random() < 0.015 + (1 - this._skillLevel) * 0.02) ? -1 : 1;
            const perpAngle = Math.atan2(target.y - py, target.x - px) + Math.PI / 2 * this._strafeDir;
            const strafeDist = 80 + this._skillLevel * 120 + Math.random() * 40;
            this._moveTarget = { x: px + Math.cos(perpAngle) * strafeDist, y: py + Math.sin(perpAngle) * strafeDist };
        }

        if (danger > 3 && this._coverTimer <= 0) {
            const cover = this._findCover(player, target, game.obstacles);
            if (cover && distanceSq(px, py, cover.x, cover.y) < 90000) {
                this._moveTarget = cover;
                this._coverTimer = 2000;
            }
        }

        this._moveTarget = this._avoidObstacles(player, this._moveTarget, game.obstacles);
    }

    _handleBossCombat(player, boss, dist, game) {
        const vi = this.virtualInput;
        const px = player.x, py = player.y;
        const bossAngle = Math.atan2(py - boss.y, px - boss.x);

        if (dist < 200) {
            this._moveTarget = this._fleeFrom(player, boss, 400);
            vi.sprinting = true;
        } else if (dist < 450) {
            this._strafeDir *= (Math.random() < 0.02) ? -1 : 1;
            this._moveTarget = { x: px + Math.cos(bossAngle + Math.PI / 2 * this._strafeDir) * 200, y: py + Math.sin(bossAngle + Math.PI / 2 * this._strafeDir) * 200 };
        } else {
            this._moveTarget = { x: boss.x, y: boss.y };
        }
        const cover = this._findCover(player, boss, game.obstacles);
        if (cover && distanceSq(px, py, cover.x, cover.y) < 225000) this._moveTarget = cover;
        vi.sprinting = dist < 300 || player.stamina > 60;
    }

    // === TARGET SELECTION (knowledge-weighted) ===
    _selectTarget(player, enemies, threat) {
        const px = player.x, py = player.y;
        const kb = this._knowledge;
        let bestTarget = null, bestScore = -Infinity;

        for (let i = 0, len = enemies.length; i < len; i++) {
            const e = enemies[i];
            if (!e.active || e.isDying) continue;
            const dx = px - e.x, dy = py - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            let score = 0;

            // Distance
            if (dist < 100) score -= 40;
            else if (dist < 300) score += 100;
            else if (dist < 500) score += 60;
            else score += Math.max(0, 30 - dist * 0.04);

            // Knowledge: prefer enemies we know how to kill efficiently
            const ek = kb.enemyTypes[e.type];
            if (ek) {
                // Fast kills = high priority (we can finish them quickly)
                if (ek.avgKillTime < 2000) score += 80;
                // High threat = high priority
                score += (ek.threatLevel || 5) * 15;
                // Unfamiliar enemies = medium priority (need to learn)
                if (ek.kills < 3) score += 60;
            } else {
                score += 70; // Unknown enemy = learn it
            }

            // Type bonuses
            switch (e.type) {
                case 'medic': score += 200; break;
                case 'sniper': score += 160; break;
                case 'bomber': score += 140; break;
                case 'ninja': score += 150; break;
                case 'boss': score += 280; break;
                case 'heavy': score += 70; break;
                case 'flanker': score += 100; break;
                case 'shield': score -= 40; break;
                case 'drone': score += 50; break;
                case 'turret': score += 90; break;
                case 'grunt': score += 30; break;
            }

            // Low HP = finish off
            if (e.hp < 30) score += 130;
            else if (e.hp < e.maxHp * 0.3) score += 80;

            // Combo potential: prefer quick kills when combo is active
            if (kb.currentCombo > 0 && ek && ek.avgKillTime < 1500) score += 40 * kb.currentCombo;

            score *= (0.5 + this._decisionQuality * 0.5);

            if (score > bestScore) { bestScore = score; bestTarget = e; }
        }

        return bestTarget || threat.nearestEnemy;
    }

    _predictTarget(player, target) {
        const dx = target.x - player.x, dy = target.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const bulletSpeed = player.weapon.bulletSpeed || 750;
        const travelTime = dist / bulletSpeed;

        let vx = 0, vy = 0;
        if (target.vx !== undefined) { vx = target.vx; vy = target.vy; }
        else if (target.speed !== undefined && target.angle !== undefined) {
            vx = Math.cos(target.angle) * target.speed;
            vy = Math.sin(target.angle) * target.speed;
        }

        // Knowledge: predict based on learned enemy movement patterns
        const ek = this._knowledge.enemyTypes[target.type];
        const predictionMult = ek && ek.kills >= 5 ? 1.1 : (0.8 + this._skillLevel * 0.3);

        return { x: target.x + vx * travelTime * predictionMult, y: target.y + vy * travelTime * predictionMult };
    }

    _getOptimalRange(player, target) {
        const w = player.weapon;
        const kb = this._knowledge;

        // Knowledge: use learned best range for this weapon+enemy combo
        const wk = kb.weapons[w.name];
        if (wk && wk.kills >= 5) {
            const ek = kb.enemyTypes[target.type];
            if (ek && ek.bestRange > 0) return ek.bestRange;
        }

        let baseRange;
        switch (w.name) {
            case 'Shotgun': case 'Flamethrower': baseRange = 130; break;
            case 'SMG': case 'Dual Pistol': baseRange = 180; break;
            case 'Sniper': baseRange = 550; break;
            case 'Rocket': baseRange = 350; break;
            case 'Rifle': baseRange = 300; break;
            default: baseRange = 250;
        }

        if (target.type === 'rusher' || target.type === 'ninja') baseRange *= 1.3;
        if (target.type === 'turret') baseRange *= 1.4;
        if (target.type === 'boss') baseRange *= 1.2;
        return baseRange;
    }

    _findBestPickup(player, pickups, typeFilter) {
        let best = null, bestScore = -Infinity;
        const px = player.x, py = player.y;
        for (let i = 0, len = pickups.length; i < len; i++) {
            const p = pickups[i];
            if (!p.active) continue;
            if (typeFilter && p.type !== typeFilter) continue;
            const dx = px - p.x, dy = py - p.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            let score = 1000 - d;
            if (p.type === 'health') score += (1 - player.hp / player.maxHP) * 800;
            else if (p.type === 'ammo') score += (1 - player.weapon.reserveAmmo / (player.weapon.magSize * 5)) * 500;
            else if (p.type === 'stamina') score += (1 - player.stamina / player.maxStamina) * 300;
            if (p.lifetime && p.age > p.lifetime * 0.7) score += 200;
            if (score > bestScore) { bestScore = score; best = p; }
        }
        return best;
    }

    _fleeFrom(player, threat, desiredDist) {
        const dx = player.x - threat.x, dy = player.y - threat.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1) return { x: player.x + 200, y: player.y };
        const dist = Math.sqrt(distSq);
        const perpX = -dy / dist, perpY = dx / dist;
        const zigzag = Math.sin(this._runTime * 3) * 0.3;
        return { x: player.x + (dx / dist + perpX * zigzag) * desiredDist, y: player.y + (dy / dist + perpY * zigzag) * desiredDist };
    }

    _findCover(player, threat, obstacles) {
        if (!obstacles || !threat) return null;
        const px = player.x, py = player.y;
        let bestCover = null, bestScore = -Infinity;
        for (let i = 0, len = obstacles.length; i < len; i++) {
            const obs = obstacles[i];
            if (!obs.isSolid || !obs.isSolid()) continue;
            const b = obs.getBounds ? obs.getBounds() : null;
            if (!b) continue;
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
            const distToPlayer = distanceSq(px, py, cx, cy);
            if (distToPlayer > 160000 || distToPlayer < 900) continue;
            const distToThreat = distanceSq(threat.x, threat.y, cx, cy);
            const playerThreatDist = distanceSq(px, py, threat.x, threat.y);
            if (distToThreat < playerThreatDist) {
                const score = playerThreatDist - distToPlayer + (b.w + b.h) * 0.5;
                if (score > bestScore) { bestScore = score; bestCover = { x: cx, y: cy }; }
            }
        }
        return bestCover;
    }

    _shouldSprint(player, dist, dangerLevel) {
        if (player.stamina < 15) return false;
        if (dangerLevel > 4 && dist < 250) return true;
        if (dist > 450) return true;
        if (player.hp < player.maxHP * 0.3) return true;
        if (this._retreatTimer > 0) return true;
        return false;
    }

    _avoidObstacles(player, target, obstacles) {
        if (!target || !obstacles) return target;
        const px = player.x, py = player.y;
        const midX = (px + target.x) / 2, midY = (py + target.y) / 2;
        for (let i = 0, len = obstacles.length; i < len; i++) {
            const obs = obstacles[i];
            if (!obs.isSolid || !obs.isSolid()) continue;
            const b = obs.getBounds ? obs.getBounds() : null;
            if (!b) continue;
            if (midX > b.x - 30 && midX < b.x + b.w + 30 && midY > b.y - 30 && midY < b.y + b.h + 30) {
                const goRight = px > b.x + b.w / 2;
                const goBelow = py > b.y + b.h / 2;
                return { x: goRight ? b.x + b.w + 50 : b.x - 50, y: goBelow ? b.y + b.h + 50 : b.y - 50 };
            }
        }
        return target;
    }

    // === WEAPON SELECTION (knowledge-based) ===
    _selectBestWeapon(player, threat) {
        const target = threat.nearestEnemy;
        if (!target) return;
        const px = player.x, py = player.y;
        const dist = Math.sqrt(distanceSq(px, py, target.x, target.y));
        const danger = threat.dangerLevel;
        const vi = this.virtualInput;
        const kb = this._knowledge;

        let bestIdx = player.currentWeaponIndex;
        let bestWeaponScore = -Infinity;

        for (let i = 0; i < player.weapons.length; i++) {
            const w = player.weapons[i];
            if (player.weaponMags[i] <= 0 && w.reserveAmmo <= 0) continue;
            let score = 0;

            // Knowledge: prefer weapons that kill this enemy type fastest
            const wk = kb.weapons[w.name];
            const ek = kb.enemyTypes[target.type];
            if (wk && ek) {
                const typeKills = wk.typeKills?.[target.type] || 0;
                score += typeKills * 20; // More kills with this weapon on this type = better
                if (ek.bestWeapon === w.name) score += 80; // Known best weapon
            }

            // Range effectiveness
            if (dist < 150) {
                if (w.name === 'Flamethrower' || w.name === 'Shotgun') score += 100;
                else if (w.name === 'SMG' || w.name === 'Dual Pistol') score += 80;
                else if (w.name === 'Sniper') score -= 50;
            } else if (dist < 350) {
                if (w.name === 'Rifle' || w.name === 'SMG') score += 90;
                else if (w.name === 'Dual Pistol') score += 70;
                else if (w.name === 'Shotgun') score += 60;
            } else {
                if (w.name === 'Sniper') score += 100;
                else if (w.name === 'Rifle') score += 80;
                else if (w.name === 'Rocket') score += 70;
                else score -= 30;
            }

            if (target.type === 'boss') {
                if (w.name === 'Rocket') score += 80;
                if (w.name === 'Sniper') score += 60;
                if (w.name === 'Flamethrower') score += 50;
            }

            if (danger > 3) {
                if (w.name === 'Rocket') score += 40;
                if (w.name === 'Shotgun' || w.name === 'Flamethrower') score += 30;
            }

            if (player.weaponMags[i] > 0) score += 30;
            if (i === player.currentWeaponIndex) score += 15;

            if (score > bestWeaponScore) { bestWeaponScore = score; bestIdx = i; }
        }

        if (bestIdx !== player.currentWeaponIndex && !player.isReloading) {
            vi.switchToWeapon = bestIdx;
        }
    }

    _exploreAndCollect(player, pickups, game) {
        const vi = this.virtualInput;
        const px = player.x, py = player.y;

        this._exploreTimer -= 100;
        if (this._exploreTimer <= 0) {
            const nearPickup = this._findBestPickup(player, pickups, null);
            if (nearPickup && distanceSq(px, py, nearPickup.x, nearPickup.y) < 400000) {
                this._exploreAngle = Math.atan2(nearPickup.y - py, nearPickup.x - px);
            } else {
                this._exploreAngle += (Math.random() - 0.5) * 1.0;
            }
            this._exploreTimer = 2000 + Math.random() * 3000;
        }

        this._moveTarget = {
            x: clamp(px + Math.cos(this._exploreAngle) * 400, 200, CONFIG.world.width - 200),
            y: clamp(py + Math.sin(this._exploreAngle) * 400, 200, CONFIG.world.height - 200)
        };

        const nearPickup = this._findBestPickup(player, pickups, null);
        if (nearPickup && distanceSq(px, py, nearPickup.x, nearPickup.y) < 250000) {
            this._moveTarget = { x: nearPickup.x, y: nearPickup.y };
        }
        vi.sprinting = player.stamina > 50;
    }
}

// ============================================================
// BotInput
// ============================================================
class BotInput {
    constructor() {
        this.mouse = { x: 400, y: 300, wheel: 0 };
        this.isMobile = false;
        this.touches = {};
        this.moveX = 0; this.moveY = 0;
        this.aimAngle = 0;
        this.shooting = false;
        this.dodging = false;
        this.sprinting = false;
        this.reload = false;
        this.switchToWeapon = -1;
        this._justPressedKeys = new Set();
        this._heldKeys = new Set();
        this._mousePressed = false;
    }

    _frameReset() {
        this.moveX = 0; this.moveY = 0;
        this.shooting = false;
        this.dodging = false;
        this.sprinting = false;
        this.reload = false;
        this.switchToWeapon = -1;
        this._justPressedKeys.clear();
        this._heldKeys.clear();
        this._mousePressed = false;
        this.mouse.wheel = 0;
    }

    _applyActions() {
        if (this.sprinting) this._heldKeys.add('ShiftLeft');
        if (this.dodging) this._justPressedKeys.add('Space');
        if (this.reload) this._justPressedKeys.add('KeyR');
        if (this.switchToWeapon >= 0) this._justPressedKeys.add(`Digit${this.switchToWeapon + 1}`);
        if (this.shooting) this._mousePressed = true;
        this.mouse.x = 400 + Math.cos(this.aimAngle) * 200;
        this.mouse.y = 300 + Math.sin(this.aimAngle) * 200;
    }

    isKey(code) { return this._heldKeys.has(code); }
    justPressed(code) {
        if (this._justPressedKeys.has(code)) { this._justPressedKeys.delete(code); return true; }
        return false;
    }
    isMousePressed() { return this._mousePressed; }
    getMoveVector() { return { x: this.moveX, y: this.moveY }; }
    getAimAngle(playerX, playerY, cameraOffset) { return this.aimAngle; }
}
