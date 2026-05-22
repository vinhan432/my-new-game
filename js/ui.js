/**
 * Dodge Warfare - Phase 5
 * UI - HUD, Minimap, Crosshair, KillFeed, GameStateManager, Menus
 */

// ============================================================
// HUD - Phase 5 with compact debug overlay
// ============================================================
class HUD {
    constructor() {
        this.showDebug = false; this.fps = 0; this.frameCount = 0; this.fpsTimer = 0;
        this.frameTimes = []; this.maxFrameSamples = 120;
        this.dtMin = Infinity; this.dtMax = 0; this.dtSum = 0; this.dtSamples = 0;
    }
    update(dt) {
        this.frameCount++;
        this.fpsTimer += dt;
        // Frame timing stats
        this.frameTimes.push(dt * 1000);
        if (this.frameTimes.length > this.maxFrameSamples) this.frameTimes.shift();
        this.dtMin = Math.min(this.dtMin, dt * 1000);
        this.dtMax = Math.max(this.dtMax, dt * 1000);
        this.dtSum += dt * 1000;
        this.dtSamples++;
        if (this.fpsTimer >= 1.0) {
            this.fps = Math.round(this.frameCount / this.fpsTimer);
            this.frameCount = 0; this.fpsTimer = 0;
        }
    }
    render(ctx, player, camera, bullets, enemyBullets, enemies, effects, scoreManager, waveManager, killFeed, persistence, audioManager, game) {
        const margin = CONFIG.hud.margin, barWidth = CONFIG.hud.barWidth, barHeight = CONFIG.hud.barHeight, padding = CONFIG.hud.barPadding;
        let y = margin;
        // HP bar
        this._drawBar(ctx, margin, y, barWidth, barHeight, player.hp, player.maxHP, CONFIG.hud.hpColor, CONFIG.hud.hpBgColor, 'HP', player.hp < 30 ? CONFIG.hud.hpLowColor : null);
        y += barHeight + padding;
        // Stamina bar
        this._drawBar(ctx, margin, y, barWidth, barHeight, player.stamina, player.maxStamina, CONFIG.hud.staminaColor, CONFIG.hud.staminaBgColor, 'STAMINA');
        y += barHeight + padding + 8;
        // Weapon info panel
        const w = player.weapon;
        const wpnPanelW = 240, wpnPanelH = 70;
        const wpnX = margin, wpnY = y;
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(wpnX, wpnY, wpnPanelW, wpnPanelH);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.strokeRect(wpnX, wpnY, wpnPanelW, wpnPanelH);
        // Weapon name
        ctx.font = 'bold 14px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#FFF'; ctx.fillText(w.name, wpnX + 8, wpnY + 6);
        // Weapon slots (6 weapons)
        for (let i = 0; i < player.weapons.length; i++) {
            const slotX = wpnX + 8 + i * 24, slotY = wpnY + 24;
            ctx.fillStyle = i === player.currentWeaponIndex ? '#555' : '#222';
            ctx.fillRect(slotX, slotY, 20, 16);
            ctx.strokeStyle = i === player.currentWeaponIndex ? '#FFD700' : '#444'; ctx.lineWidth = 1; ctx.strokeRect(slotX, slotY, 20, 16);
            ctx.font = '9px monospace'; ctx.fillStyle = i === player.currentWeaponIndex ? '#FFD700' : '#888'; ctx.textAlign = 'center';
            ctx.fillText(`${i + 1}`, slotX + 10, slotY + 3);
        }
        // Ammo display
        const magColor = player.currentMag <= 3 ? CONFIG.hud.ammoLowColor : CONFIG.hud.ammoColor;
        ctx.font = 'bold 20px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.fillStyle = magColor;
        ctx.fillText(`${player.currentMag}`, wpnX + 8, wpnY + 46);
        ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = '#888';
        ctx.fillText(`/ ${w.reserveAmmo}`, wpnX + 50, wpnY + 50);
        // Reload bar
        if (player.isReloading) {
            const reloadPct = 1 - (player.reloadTimer / player.reloadDuration);
            ctx.fillStyle = '#222'; ctx.fillRect(wpnX + 120, wpnY + 48, 110, 12);
            ctx.fillStyle = CONFIG.hud.reloadColor; ctx.fillRect(wpnX + 120, wpnY + 48, 110 * reloadPct, 12);
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(wpnX + 120, wpnY + 48, 110, 12);
            ctx.font = '10px monospace'; ctx.fillStyle = '#FFF'; ctx.textAlign = 'center';
            ctx.fillText('RELOADING', wpnX + 175, wpnY + 49);
        }
        y += wpnPanelH + 10;
        // Perks display
        if (player.perks.length > 0) {
            const perkY = y;
            ctx.font = '10px "Courier New", monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'left';
            ctx.fillText('PERKS:', margin, perkY);
            for (let i = 0; i < player.perks.length; i++) {
                const perk = player.perks[i];
                const perkX = margin + 50 + i * 50;
                ctx.fillStyle = 'rgba(255,0,255,0.15)'; ctx.fillRect(perkX, perkY - 2, 44, 16);
                ctx.strokeStyle = '#FF00FF'; ctx.lineWidth = 1; ctx.strokeRect(perkX, perkY - 2, 44, 16);
                ctx.fillStyle = '#FF88FF'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
                ctx.fillText(perk.icon, perkX + 22, perkY + 9);
            }
            y += 20;
        }
        // Wave & enemies
        ctx.font = CONFIG.hud.labelFont; ctx.fillStyle = CONFIG.hud.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`Wave: ${waveManager.wave}`, margin, y);
        ctx.fillText(`Enemies: ${waveManager.getEnemiesRemaining(enemies)}`, margin, y + 16);
        // Score (top-center)
        ctx.font = 'bold 18px "Courier New", monospace'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`Score: ${scoreManager.score}`, ctx.canvas.width / 2, margin);
        // Combo
        if (scoreManager.combo > 1) {
            ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#FF8800';
            ctx.fillText(`Combo x${scoreManager.combo}`, ctx.canvas.width / 2, margin + 22);
        }
        // Run timer (top-center, below score)
        if (game && game.runTime > 0) {
            const mins = Math.floor(game.runTime / 60);
            const secs = Math.floor(game.runTime % 60);
            ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, ctx.canvas.width / 2, margin + 40);
        }
        // Kill feed
        if (killFeed) killFeed.render(ctx);
        // Wave announcement (dramatic with slide-in/fade-in)
        if (waveManager.announcementTimer > 0) {
            const maxTimer = waveManager.announcementText.includes('BOSS') ? 3000 : 2000;
            const elapsed = maxTimer - waveManager.announcementTimer;
            const fadeInDuration = 400; // ms for slide-in
            const fadeInProgress = Math.min(1, elapsed / fadeInDuration);
            // Eased slide-in (ease-out cubic)
            const slideEase = 1 - Math.pow(1 - fadeInProgress, 3);
            const alpha = slideEase;
            const slideOffset = (1 - slideEase) * 40; // Slide from 40px above

            const isBoss = waveManager.announcementText.includes('BOSS');
            const isComplete = waveManager.announcementText.includes('Complete');
            const isPerk = waveManager.announcementText.includes('PERK');
            const isSupply = waveManager.announcementText.includes('SUPPLY');
            const pulse = 0.85 + Math.sin(performance.now() * 0.008) * 0.15;
            const cy = ctx.canvas.height / 2 - 60 - slideOffset;
            ctx.globalAlpha = alpha * pulse;
            // Background bar with slide
            const textW = ctx.measureText(waveManager.announcementText).width + 60;
            const bgAlpha = alpha * (isBoss ? 0.6 : isComplete ? 0.5 : 0.5);
            ctx.fillStyle = isBoss ? `rgba(150,0,0,${bgAlpha})` : isComplete ? `rgba(0,100,0,${bgAlpha})` : isPerk ? `rgba(100,0,100,${bgAlpha})` : isSupply ? `rgba(0,80,100,${bgAlpha})` : `rgba(0,0,0,${bgAlpha})`;
            ctx.fillRect(ctx.canvas.width / 2 - textW / 2, cy - 22, textW, 48);
            // Border with glow
            const borderColor = isBoss ? '#FF0000' : isComplete ? '#00FF88' : isPerk ? '#FF00FF' : isSupply ? '#00CCFF' : '#FF8800';
            ctx.shadowColor = borderColor; ctx.shadowBlur = 8 * alpha;
            ctx.strokeStyle = borderColor; ctx.lineWidth = 2; ctx.strokeRect(ctx.canvas.width / 2 - textW / 2, cy - 22, textW, 48);
            ctx.shadowBlur = 0;
            // Main text
            ctx.font = isBoss ? 'bold 34px "Courier New", monospace' : 'bold 28px "Courier New", monospace';
            ctx.fillStyle = isBoss ? '#FF2222' : isComplete ? '#00FF88' : isPerk ? '#FF44FF' : isSupply ? '#00DDFF' : '#FF8800';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(waveManager.announcementText, ctx.canvas.width / 2, cy);
            // Subtitle
            if (isBoss) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(255,102,102,${alpha})`;
                ctx.fillText('PREPARE FOR BATTLE', ctx.canvas.width / 2, cy + 22);
            } else if (isComplete) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(136,255,187,${alpha})`;
                ctx.fillText('Next wave approaching...', ctx.canvas.width / 2, cy + 22);
            } else if (isPerk) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(255,136,255,${alpha})`;
                ctx.fillText('Select your upgrade!', ctx.canvas.width / 2, cy + 22);
            } else if (isSupply) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(0,220,255,${alpha})`;
                ctx.fillText('Collect supplies!', ctx.canvas.width / 2, cy + 22);
            }
            ctx.globalAlpha = 1;
        }
        // Low HP vignette
        if (player.hp < 30 && player.alive) {
            const vignetteAlpha = (1 - player.hp / 30) * 0.3 * (0.7 + Math.sin(performance.now() * 0.005) * 0.3);
            const g = ctx.createRadialGradient(ctx.canvas.width / 2, ctx.canvas.height / 2, ctx.canvas.width * 0.3, ctx.canvas.width / 2, ctx.canvas.height / 2, ctx.canvas.width * 0.7);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${vignetteAlpha})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        // === MATH NERD DEBUG OVERLAY ===
        if (this.showDebug && game) {
            this._renderMathNerdDebug(ctx, player, camera, bullets, enemyBullets, enemies, effects, scoreManager, waveManager, audioManager, game);
        }
    }
    _drawBar(ctx, x, y, width, height, current, max, color, bgColor, label, flashColor) {
        const pct = clamp(current / max, 0, 1);
        ctx.fillStyle = bgColor; ctx.fillRect(x, y, width, height);
        ctx.fillStyle = flashColor && current < max * 0.3 ? flashColor : color;
        ctx.fillRect(x, y, width * pct, height);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
        ctx.font = CONFIG.hud.labelFont; ctx.fillStyle = CONFIG.hud.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${label}: ${Math.ceil(current)} / ${max}`, x + 4, y + 2);
    }

    // ============================================================
    // COMPACT DEBUG OVERLAY + VISUAL AIDS
    // ============================================================
    _renderMathNerdDebug(ctx, player, camera, bullets, enemyBullets, enemies, effects, scoreManager, waveManager, audioManager, game) {
        const f = (v, d = 2) => typeof v === 'number' ? v.toFixed(d) : String(v);
        const fi = (v) => Math.round(v).toString();
        const avgDt = this.frameTimes.length > 0 ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length : 0;
        const camOff = camera.getOffset();
        const cw = ctx.canvas.width, ch = ctx.canvas.height;

        // ---- COMPACT DATA PANEL (top-left) ----
        const rows = [
            { label: 'FPS',       value: `${this.fps} (${f(avgDt, 1)}ms)`, warn: this.fps < 30 },
            { label: 'Enemies',   value: `${enemies.length} · ${bullets.length}◇ ${enemyBullets.length}◆ ${effects.length}*`, warn: enemies.length > 100 },
            { label: 'HP',        value: `${fi(player.hp)}/${player.maxHP} · ${fi(player.stamina)}/${player.maxStamina}`, warn: player.hp < 30 },
            { label: 'Weapon',    value: `${player.weapon.name} [${player.currentMag}/${player.weapon.magSize}]${player.isReloading ? ' (R)' : ''}` },
            { label: 'Wave',      value: `W${waveManager.wave} · ${scoreManager.kills} kills · ${fi(game.runTime)}s` },
            { label: 'Pos',       value: `(${fi(player.x)}, ${fi(player.y)})` },
            { label: 'Status',    value: `${game.godMode ? 'GOD ' : ''}${game.devCheats ? 'DEV ' : ''}${game.network.connected ? 'NET ' : ''}${game.graphicsQuality}` },
        ];

        const pad = 6, lineH = 14, topY = 40;
        const width = 320;
        let h = pad;
        for (const r of rows) h += lineH;
        h += pad + 16;
        const x = 10, y = topY;
        const t = performance.now() * 0.001;

        ctx.fillStyle = 'rgba(5,5,15,0.82)';
        ctx.fillRect(x, y, width, h);
        ctx.strokeStyle = `rgba(0,200,100,${0.2 + Math.sin(t * 2) * 0.08})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, h);
        ctx.fillStyle = 'rgba(0,200,100,0.12)';
        ctx.fillRect(x, y, width, 16);
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillStyle = '#00FF88';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('> DEBUG', x + pad, y + 3);
        if (Math.sin(t * 3) > 0) {
            ctx.fillStyle = '#00FF88';
            ctx.fillRect(x + 58, y + 3, 5, 9);
        }

        let cy = y + 18;
        ctx.textBaseline = 'top';
        ctx.font = '10px "Courier New", monospace';
        for (const row of rows) {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#666';
            ctx.fillText(row.label, x + pad, cy);
            ctx.textAlign = 'right';
            ctx.fillStyle = row.warn ? '#FF6644' : '#BBB';
            ctx.fillText(row.value, x + width - pad, cy);
            cy += lineH;
        }

        // ---- VISUAL AIDS (world-space overlays) ----

        // Frame time sparkline (bottom-right)
        this._renderSparkline(ctx, cw - 220, ch - 80, 200, 50, this.frameTimes, 16.667, 'Frame Time (ms)');

        // Detection / attack range circles on enemies
        for (const enemy of enemies) {
            if (!enemy.active) continue;
            const ex = enemy.x - camOff.x, ey = enemy.y - camOff.y;
            ctx.beginPath(); ctx.arc(ex, ey, enemy.detectionRange, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,255,0,0.08)'; ctx.lineWidth = 1; ctx.stroke();
            if (enemy.attackRange) {
                ctx.beginPath(); ctx.arc(ex, ey, enemy.attackRange, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,0,0,0.08)'; ctx.lineWidth = 1; ctx.stroke();
            }
            ctx.font = '9px monospace'; ctx.fillStyle = '#0F0'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(`${enemy.type} [${enemy.state}] HP:${fi(enemy.hp)}`, ex, ey - enemy.radius - 18);
            if (enemy.vx !== undefined || enemy.separationX !== undefined) {
                const svx = (enemy.separationX || 0) * 3, svy = (enemy.separationY || 0) * 3;
                if (Math.abs(svx) > 0.5 || Math.abs(svy) > 0.5) {
                    ctx.strokeStyle = 'rgba(0,200,255,0.4)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + svx, ey + svy); ctx.stroke();
                }
            }
        }

        // Player collision circle + aim line
        const px = player.x - camOff.x, py = player.y - camOff.y;
        ctx.strokeStyle = 'rgba(255,255,0,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,100,100,0.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(player.angle) * 300, py + Math.sin(player.angle) * 300);
        ctx.stroke();
    }

    _renderDebugColumn(ctx, entries, x, y, width, lineH, headerH, pad) {
        let h = pad;
        for (const entry of entries) {
            h += entry.header ? headerH : lineH;
        }
        h += pad;
        const t = performance.now() * 0.001;
        ctx.fillStyle = 'rgba(5,5,15,0.88)'; ctx.fillRect(x, y, width, h);
        const borderAlpha = 0.25 + Math.sin(t * 2) * 0.1;
        ctx.strokeStyle = `rgba(0,200,100,${borderAlpha})`; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, h);
        ctx.fillStyle = 'rgba(0,200,100,0.15)'; ctx.fillRect(x, y, width, headerH);
        ctx.font = 'bold 10px "Courier New", monospace'; ctx.fillStyle = '#00FF88'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('> SYSTEM_DEBUG', x + pad, y + 4);
        if (Math.sin(t * 3) > 0) {
            ctx.fillStyle = '#00FF88'; ctx.fillRect(x + 110, y + 4, 6, 10);
        }
        let cy = y + headerH + pad * 0.5;
        ctx.textBaseline = 'top';
        for (const entry of entries) {
            if (entry.header) {
                ctx.font = 'bold 11px "Courier New", monospace';
                ctx.fillStyle = '#00CC77'; ctx.textAlign = 'left';
                ctx.fillText(`[${entry.header}]`, x + pad, cy);
                cy += headerH * 0.8;
            } else if (entry.label || entry.value) {
                ctx.font = '10px "Courier New", monospace';
                ctx.textAlign = 'left'; ctx.fillStyle = '#666';
                ctx.fillText(entry.label, x + pad, cy);
                ctx.textAlign = 'right';
                ctx.fillStyle = entry.warn ? '#FF6644' : '#BBB';
                ctx.fillText(entry.value, x + width - pad, cy);
                cy += lineH;
            } else {
                cy += lineH * 0.3;
            }
        }
    }

    _renderSparkline(ctx, x, y, w, h, data, threshold, label) {
        if (data.length < 2) return;
        ctx.fillStyle = 'rgba(5,5,15,0.82)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(0,200,100,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
        ctx.font = '9px "Courier New", monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(label, x + 4, y + 2);
        const maxY = Math.max(threshold * 2, ...data);
        const ty = y + h - 4 - ((threshold / maxY) * (h - 12));
        ctx.strokeStyle = 'rgba(255,100,100,0.4)'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x + 4, ty); ctx.lineTo(x + w - 4, ty); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '8px monospace'; ctx.fillStyle = '#FF6644'; ctx.textAlign = 'right';
        ctx.fillText('16.7ms', x + w - 4, ty - 9);
        const graphX = x + 4, graphW = w - 8, graphY = y + 12, graphH = h - 16;
        ctx.beginPath();
        for (let i = 0; i < data.length; i++) {
            const gx = graphX + (i / (data.length - 1)) * graphW;
            const gy = graphY + graphH - (data[i] / maxY) * graphH;
            if (i === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
        }
        ctx.strokeStyle = '#00FF88'; ctx.lineWidth = 1.5; ctx.stroke();
        const lastGx = graphX + graphW;
        const lastGy = graphY + graphH - (data[data.length - 1] / maxY) * graphH;
        ctx.lineTo(lastGx, graphY + graphH); ctx.lineTo(graphX, graphY + graphH); ctx.closePath();
        ctx.fillStyle = 'rgba(0,255,136,0.08)'; ctx.fill();
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#FFF'; ctx.textAlign = 'right';
        ctx.fillText(`${data[data.length - 1].toFixed(1)}`, x + w - 4, y + 2);
    }

    toggleDebug() { this.showDebug = !this.showDebug; }
}

// ============================================================
// MINIMAP
// ============================================================
class Minimap {
    constructor() { this.size = CONFIG.minimap.size; this.scale = this.size / CONFIG.world.width; }
    render(ctx, player, buildings, cars, barrels, trees, enemies, pickups, trucks = [], suvs = [], vans = []) {
        const margin = CONFIG.minimap.margin, x = ctx.canvas.width - this.size - margin, y = margin;
        // Background
        ctx.fillStyle = CONFIG.minimap.bgColor; ctx.fillRect(x, y, this.size, this.size);
        // Roads
        const roadWidth = 3 * CONFIG.tile.size * this.scale, centerX = x + this.size / 2, centerY = y + this.size / 2;
        ctx.fillStyle = CONFIG.minimap.roadColor; ctx.fillRect(centerX - roadWidth / 2, y, roadWidth, this.size); ctx.fillRect(x, centerY - roadWidth / 2, this.size, roadWidth);
        // Buildings
        ctx.fillStyle = CONFIG.minimap.buildingColor; for (const b of buildings) ctx.fillRect(x + b.x * this.scale, y + b.y * this.scale, b.w * this.scale, b.h * this.scale);
        // Cars
        ctx.fillStyle = CONFIG.minimap.carColor; for (const c of cars) if (!c.destroyed) { ctx.beginPath(); ctx.arc(x + (c.x + c.w / 2) * this.scale, y + (c.y + c.h / 2) * this.scale, 2, 0, Math.PI * 2); ctx.fill(); }
        // Trucks (larger dots)
        ctx.fillStyle = '#AA8844'; for (const t of trucks) if (!t.destroyed) { ctx.beginPath(); ctx.arc(x + (t.x + t.w / 2) * this.scale, y + (t.y + t.h / 2) * this.scale, 3, 0, Math.PI * 2); ctx.fill(); }
        // SUVs
        ctx.fillStyle = '#668866'; for (const s of suvs) if (!s.destroyed) { ctx.beginPath(); ctx.arc(x + (s.x + s.w / 2) * this.scale, y + (s.y + s.h / 2) * this.scale, 2, 0, Math.PI * 2); ctx.fill(); }
        // Vans
        ctx.fillStyle = '#888888'; for (const v of vans) if (!v.destroyed) { ctx.beginPath(); ctx.arc(x + (v.x + v.w / 2) * this.scale, y + (v.y + v.h / 2) * this.scale, 2, 0, Math.PI * 2); ctx.fill(); }
        // Barrels
        ctx.fillStyle = CONFIG.minimap.barrelColor; for (const b of barrels) if (!b.destroyed) { ctx.beginPath(); ctx.arc(x + (b.x + b.radius) * this.scale, y + (b.y + b.radius) * this.scale, 2, 0, Math.PI * 2); ctx.fill(); }
        // Trees
        ctx.fillStyle = CONFIG.minimap.treeColor; for (const t of trees) { ctx.beginPath(); ctx.arc(x + (t.x + t.radius) * this.scale, y + (t.y + t.radius) * this.scale, 2, 0, Math.PI * 2); ctx.fill(); }
        // Pickups
        for (const p of pickups) {
            if (!p.active) continue;
            let color;
            if (p.type === 'health') color = CONFIG.minimap.pickupHealthColor;
            else if (p.type === 'stamina') color = CONFIG.minimap.pickupStaminaColor;
            else color = CONFIG.minimap.pickupAmmoColor;
            ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + p.x * this.scale, y + p.y * this.scale, 2, 0, Math.PI * 2); ctx.fill();
        }
        // Enemies
        ctx.fillStyle = CONFIG.minimap.enemyColor; for (const e of enemies) if (e.active && !e.isDying) { ctx.beginPath(); ctx.arc(x + e.x * this.scale, y + e.y * this.scale, CONFIG.minimap.enemyDotSize, 0, Math.PI * 2); ctx.fill(); }
        // Player
        const px = x + player.x * this.scale, py = y + player.y * this.scale;
        ctx.beginPath(); ctx.arc(px, py, CONFIG.minimap.playerDotSize, 0, Math.PI * 2); ctx.fillStyle = CONFIG.minimap.playerColor; ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
        // Border
        ctx.strokeStyle = CONFIG.minimap.borderColor; ctx.lineWidth = CONFIG.minimap.borderWidth; ctx.strokeRect(x, y, this.size, this.size);
    }
}

// ============================================================
// CROSSHAIR - Phase 5 with weapon-reactive design
// ============================================================
class Crosshair {
    constructor() { this.hitPulse = 0; }
    onHit() { this.hitPulse = 1; }
    render(ctx, mouseX, mouseY, player) {
        if (this.hitPulse > 0) this.hitPulse = Math.max(0, this.hitPulse - 0.05);
        const size = 14 + (player && player.isReloading ? 4 : 0);
        const gap = 5 + (player ? player.weapon.spread * 30 : 0);
        const thickness = 2;
        ctx.save(); ctx.translate(mouseX, mouseY);
        // Outer shadow
        ctx.strokeStyle = '#000'; ctx.lineWidth = thickness + 2; ctx.lineCap = 'round';
        this._drawLines(ctx, size, gap);
        // Main crosshair
        const color = this.hitPulse > 0 ? '#FF4444' : (player && player.currentMag <= 3 ? '#FF6600' : '#FFF');
        ctx.strokeStyle = color; ctx.lineWidth = thickness; this._drawLines(ctx, size, gap);
        // Center dot
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fillStyle = this.hitPulse > 0 ? '#FF0000' : '#F00'; ctx.fill();
        ctx.restore();
    }
    _drawLines(ctx, outer, inner) {
        ctx.beginPath(); ctx.moveTo(0, -inner); ctx.lineTo(0, -outer); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, inner); ctx.lineTo(0, outer); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-inner, 0); ctx.lineTo(-outer, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(inner, 0); ctx.lineTo(outer, 0); ctx.stroke();
    }
}

// ============================================================
// KILL FEED
// ============================================================
class KillFeed {
    constructor() { this.entries = []; this.maxEntries = 5; }
    add(text) { this.entries.push({ text, time: 3000 }); if (this.entries.length > this.maxEntries) this.entries.shift(); }
    update(dt) { for (const e of this.entries) e.time -= dt * 1000; this.entries = this.entries.filter(e => e.time > 0); }
    render(ctx) {
        const x = ctx.canvas.width - 220, y = 100;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        for (let i = 0; i < this.entries.length; i++) {
            const e = this.entries[i]; const alpha = Math.min(1, e.time / 1000);
            ctx.globalAlpha = alpha; ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#FFF';
            ctx.fillText(e.text, x, y + i * 18);
        }
        ctx.globalAlpha = 1;
    }
}

// ============================================================
// GAME STATE MANAGER - Phase 5 with full menu system
// ============================================================
class GameStateManager {
    constructor() {
        this.state = 'menu'; this.menuSelection = 0;
        this.menuItems = ['Play Solo', 'Play Online', 'Leaderboard', 'Settings'];
        this.settingsSelection = 0;
        this.settingsItems = ['Master Volume', 'SFX Volume', 'Music Volume', 'Mute', 'Graphics Quality', 'Screen Shake', 'Damage Numbers', 'Minimap', 'Player Name', 'Back'];
        this.leaderboardData = []; this.leaderboardLoading = false; this.leaderboardError = null;
        this.nameInput = ''; this.nameInputActive = false;
        this.onlineSelection = 0; this.onlineItems = ['Create Room', 'Join Room', 'Back'];
        this.roomCode = ''; this.roomCodeInput = ''; this.roomCodeInputActive = false;
        this.submitResult = null; this.submitted = false;
        this.transitionAlpha = 0; this.transitionTarget = null;
        // Mission selection
        this.missionSelection = 0;
        this.missions = CONFIG.missions;
    }

    update(dt, input, game) {
        if (this.state === 'menu') {
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) { this.menuSelection = (this.menuSelection - 1 + this.menuItems.length) % this.menuItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) { this.menuSelection = (this.menuSelection + 1) % this.menuItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('Enter') || input.justPressed('Space')) {
                game.soundManager.playSound('menuSelect');
                switch (this.menuSelection) {
                    case 0: this.state = 'missions'; this.missionSelection = 0; break;
                    case 1: this.state = 'online'; this.onlineSelection = 0; break;
                    case 2: this.state = 'leaderboard'; this._fetchLeaderboard(game); break;
                    case 3: this.state = 'settings'; this.settingsSelection = 0; break;
                }
            }
        } else if (this.state === 'missions') {
            if (input.justPressed('ArrowLeft') || input.justPressed('KeyA')) { this.missionSelection = (this.missionSelection - 1 + this.missions.length) % this.missions.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) { this.missionSelection = (this.missionSelection + 1) % this.missions.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) { this.missionSelection = (this.missionSelection - 1 + this.missions.length) % this.missions.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) { this.missionSelection = (this.missionSelection + 1) % this.missions.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('Enter') || input.justPressed('Space')) {
                game.soundManager.playSound('menuSelect');
                const mission = this.missions[this.missionSelection];
                game.loadMission(mission.id);
                game.startGame();
                this.state = 'playing';
            }
            if (input.justPressed('Escape')) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
        } else if (this.state === 'playing') {
            if (input.justPressed('Escape')) { this.state = 'paused'; game.soundManager.playSound('menuSelect'); }
        } else if (this.state === 'paused') {
            if (input.justPressed('Escape')) { this.state = 'playing'; game.soundManager.playSound('menuSelect'); }
            if (input.justPressed('KeyQ')) { this.state = 'menu'; game.resetGame(); game.soundManager.playSound('menuSelect'); }
        } else if (this.state === 'gameover') {
            if (!this.submitted) {
                // Name input
                if (input.justPressed('Enter')) {
                    if (this.nameInput.length > 0) game.persistence.setPlayerName(this.nameInput);
                    this._submitScore(game);
                }
                if (input.justPressed('Escape')) { this.submitted = true; this.submitResult = { skipped: true }; }
            } else {
                if (input.justPressed('KeyR') || input.justPressed('Enter')) { this.state = 'menu'; game.resetGame(); game.soundManager.playSound('menuSelect'); }
                if (input.justPressed('KeyL')) { this.state = 'leaderboard'; this._fetchLeaderboard(game); }
            }
        } else if (this.state === 'settings') {
            const s = game.persistence.data.settings;
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) { this.settingsSelection = (this.settingsSelection - 1 + this.settingsItems.length) % this.settingsItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) { this.settingsSelection = (this.settingsSelection + 1) % this.settingsItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowLeft') || input.justPressed('KeyA')) this._adjustSetting(game, -1);
            if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) this._adjustSetting(game, 1);
            if (input.justPressed('Enter') || input.justPressed('Escape')) {
                if (this.settingsSelection === this.settingsItems.length - 1 || input.justPressed('Escape')) {
                    this.state = 'menu'; game.soundManager.playSound('menuSelect');
                } else if (this.settingsSelection === 8) {
                    this.nameInputActive = true; this.nameInput = game.persistence.data.playerName;
                }
            }
        } else if (this.state === 'leaderboard') {
            if (input.justPressed('Escape') || input.justPressed('Enter')) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
        } else if (this.state === 'online') {
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) { this.onlineSelection = (this.onlineSelection - 1 + this.onlineItems.length) % this.onlineItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) { this.onlineSelection = (this.onlineSelection + 1) % this.onlineItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('Enter')) {
                game.soundManager.playSound('menuSelect');
                switch (this.onlineSelection) {
                    case 0: game.network.createRoom(game.persistence.data.playerName); this.state = 'waiting'; break;
                    case 1: this.roomCodeInputActive = true; this.roomCodeInput = ''; this.state = 'joinRoom'; break;
                    case 2: this.state = 'menu'; break;
                }
            }
            if (input.justPressed('Escape')) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
        } else if (this.state === 'joinRoom') {
            if (input.justPressed('Enter') && this.roomCodeInput.length >= 4) {
                game.network.joinRoom(this.roomCodeInput.toUpperCase(), game.persistence.data.playerName);
                this.state = 'waiting';
            }
            if (input.justPressed('Escape')) { this.state = 'online'; }
        } else if (this.state === 'waiting') {
            if (input.justPressed('Escape')) { game.network.disconnect(); this.state = 'online'; }
        }
    }

    _adjustSetting(game, dir) {
        const s = game.persistence.data.settings;
        switch (this.settingsSelection) {
            case 0: s.masterVolume = clamp(s.masterVolume + dir * 0.1, 0, 1); game.audioManager.setMasterVolume(s.masterVolume); break;
            case 1: s.sfxVolume = clamp(s.sfxVolume + dir * 0.1, 0, 1); game.audioManager.setSfxVolume(s.sfxVolume); break;
            case 2: s.musicVolume = clamp(s.musicVolume + dir * 0.1, 0, 1); game.audioManager.setMusicVolume(s.musicVolume); break;
            case 3: game.audioManager.toggleMute(); s.muted = game.audioManager.muted; break;
            case 4: const q = ['low', 'medium', 'high']; const qi = q.indexOf(s.graphicsQuality); s.graphicsQuality = q[clamp(qi + dir, 0, 2)]; game.graphicsQuality = s.graphicsQuality; break;
            case 5: s.screenShakeIntensity = clamp(s.screenShakeIntensity + dir * 0.25, 0, 2); game.camera.shakeMultiplier = s.screenShakeIntensity; break;
            case 6: s.showDamageNumbers = !s.showDamageNumbers; break;
            case 7: s.showMinimap = !s.showMinimap; break;
            case 8: this.nameInputActive = true; this.nameInput = game.persistence.data.playerName; break;
        }
        game.persistence.save();
        game.soundManager.playSound('menuNavigate');
    }

    async _fetchLeaderboard(game) {
        this.leaderboardLoading = true; this.leaderboardError = null;
        try {
            const result = await game.leaderboardClient.fetchScores(20);
            if (result.error) { this.leaderboardError = result.error; this.leaderboardData = []; }
            else { this.leaderboardData = result.scores || []; }
        } catch (e) { this.leaderboardError = 'Failed to connect'; this.leaderboardData = []; }
        this.leaderboardLoading = false;
    }

    async _submitScore(game) {
        this.submitted = true;
        const data = {
            playerName: game.persistence.data.playerName,
            score: game.scoreManager.score,
            waveReached: game.waveManager.wave,
            kills: game.scoreManager.kills,
            runDuration: Math.floor(game.runTime || 0),
            mode: 'solo',
            version: CONFIG.version
        };
        try {
            const result = await game.leaderboardClient.submitScore(data);
            if (result.error) { this.submitResult = { success: false, error: result.error }; game.soundManager.playSound('submitFail'); }
            else { this.submitResult = { success: true, rank: result.rank }; game.soundManager.playSound('submitSuccess'); }
        } catch (e) { this.submitResult = { success: false, error: 'Offline' }; game.soundManager.playSound('submitFail'); }
    }

    render(ctx, game) {
        if (this.state === 'menu') this._renderMenu(ctx, game);
        else if (this.state === 'missions') this._renderMissions(ctx, game);
        else if (this.state === 'paused') this._renderPause(ctx, game);
        else if (this.state === 'gameover') this._renderGameOver(ctx, game);
        else if (this.state === 'settings') this._renderSettings(ctx, game);
        else if (this.state === 'leaderboard') this._renderLeaderboard(ctx, game);
        else if (this.state === 'online') this._renderOnline(ctx, game);
        else if (this.state === 'joinRoom') this._renderJoinRoom(ctx, game);
        else if (this.state === 'waiting') this._renderWaiting(ctx, game);
    }

    _renderMenu(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const t = performance.now() * 0.001;
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        // Animated grid
        ctx.strokeStyle = 'rgba(255,50,50,0.04)'; ctx.lineWidth = 1;
        const gridOffset = (t * 10) % 40;
        for (let x = -40 + gridOffset; x < cw + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
        for (let y = -40 + gridOffset; y < ch + 40; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
        // Floating particles
        ctx.fillStyle = 'rgba(255,50,50,0.15)';
        for (let i = 0; i < 20; i++) {
            const px = (cw * 0.1 + (i * 137.5) % (cw * 0.8)) + Math.sin(t + i * 0.7) * 20;
            const py = (ch * 0.1 + (i * 197.3) % (ch * 0.8)) + Math.cos(t * 0.8 + i * 0.5) * 15;
            const s = 2 + Math.sin(t * 2 + i) * 1;
            ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2); ctx.fill();
        }
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // Title shadow
        ctx.font = 'bold 56px "Courier New", monospace'; ctx.fillStyle = 'rgba(255,0,0,0.15)';
        ctx.fillText('DODGE WARFARE', cw / 2 + 3, ch / 2 - 137);
        // Title main
        ctx.fillStyle = '#FF3333';
        ctx.fillText('DODGE WARFARE', cw / 2, ch / 2 - 140);
        // Subtitle
        ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = '#555';
        ctx.fillText(`Phase 5  |  v${CONFIG.version}`, cw / 2, ch / 2 - 98);
        // Decorative line
        const lineW = 300;
        ctx.strokeStyle = 'rgba(255,50,50,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cw / 2 - lineW / 2, ch / 2 - 78); ctx.lineTo(cw / 2 + lineW / 2, ch / 2 - 78); ctx.stroke();
        // Menu items
        for (let i = 0; i < this.menuItems.length; i++) {
            const selected = i === this.menuSelection;
            const y = ch / 2 - 20 + i * 45;
            if (selected) {
                // Selection background with animated border
                const selPulse = 0.7 + Math.sin(t * 4) * 0.3;
                ctx.fillStyle = `rgba(255,50,50,${0.08 * selPulse})`; ctx.fillRect(cw / 2 - 160, y - 16, 320, 34);
                ctx.strokeStyle = `rgba(255,50,50,${0.6 * selPulse})`; ctx.lineWidth = 1; ctx.strokeRect(cw / 2 - 160, y - 16, 320, 34);
                // Arrow indicator
                ctx.fillStyle = '#FF3333'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'right';
                ctx.fillText('>', cw / 2 - 165, y + 1);
                ctx.textAlign = 'center';
            }
            ctx.font = selected ? 'bold 22px "Courier New", monospace' : '20px "Courier New", monospace';
            ctx.fillStyle = selected ? '#FF5555' : '#777';
            ctx.fillText(this.menuItems[i], cw / 2, y);
        }
        // High score display
        if (game && game.persistence && game.persistence.data.highScore > 0) {
            ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
            ctx.fillText(`High Score: ${game.persistence.data.highScore}  |  Best Wave: ${game.persistence.data.bestWave}`, cw / 2, ch / 2 + 160);
        }
        // Controls hint
        ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#444';
        ctx.fillText('W/S or Arrows to navigate  |  Enter/Space to select', cw / 2, ch - 30);
    }

    _renderMissions(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const t = performance.now() * 0.001;
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        // Animated grid
        ctx.strokeStyle = 'rgba(0,150,255,0.03)'; ctx.lineWidth = 1;
        const gridOff = (t * 8) % 40;
        for (let x = -40 + gridOff; x < cw + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
        for (let y = -40 + gridOff; y < ch + 40; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 36px "Courier New", monospace'; ctx.fillStyle = '#00CCFF';
        ctx.fillText('SELECT MISSION', cw / 2, 60);
        // Mission cards
        const cardW = 260, cardH = 200, cardPad = 20;
        const totalW = this.missions.length * (cardW + cardPad) - cardPad;
        const startX = cw / 2 - totalW / 2;
        for (let i = 0; i < this.missions.length; i++) {
            const m = this.missions[i];
            const selected = i === this.missionSelection;
            const cx = startX + i * (cardW + cardPad);
            const cy = ch / 2 - cardH / 2 - 20;
            // Card background
            ctx.fillStyle = selected ? 'rgba(0,100,180,0.25)' : 'rgba(20,20,30,0.8)';
            ctx.fillRect(cx, cy, cardW, cardH);
            ctx.strokeStyle = selected ? '#00CCFF' : '#333';
            ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect(cx, cy, cardW, cardH);
            // Theme color accent bar
            const themeColors = { urban: '#8B7355', desert: '#C2B280', forest: '#5A7247', industrial: '#6A6A6A' };
            ctx.fillStyle = themeColors[m.theme] || '#555';
            ctx.fillRect(cx, cy, cardW, 4);
            // Mission info
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            // Name
            ctx.font = 'bold 16px "Courier New", monospace';
            ctx.fillStyle = selected ? '#00CCFF' : '#CCC';
            ctx.fillText(m.name, cx + 12, cy + 14);
            // Difficulty
            const diffColors = { Normal: '#4CAF50', Hard: '#FF9800', Extreme: '#F44336' };
            ctx.font = '11px "Courier New", monospace';
            ctx.fillStyle = diffColors[m.difficulty] || '#888';
            ctx.fillText(m.difficulty, cx + 12, cy + 36);
            // Description
            ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#888';
            const words = m.description.split(' ');
            let line = '', lineY = cy + 56;
            for (const word of words) {
                const test = line + word + ' ';
                if (ctx.measureText(test).width > cardW - 24 && line) {
                    ctx.fillText(line.trim(), cx + 12, lineY); lineY += 14; line = word + ' ';
                } else { line = test; }
            }
            if (line) ctx.fillText(line.trim(), cx + 12, lineY);
            // Stats
            ctx.font = '10px "Courier New", monospace'; ctx.fillStyle = '#666';
            const statsY = cy + cardH - 50;
            ctx.fillText(`Waves: ${m.waves}`, cx + 12, statsY);
            ctx.fillText(`Map: ${m.worldSize}×${m.worldSize}`, cx + 12, statsY + 14);
            ctx.fillText(`Theme: ${m.theme}`, cx + 12, statsY + 28);
            // Boss indicator
            ctx.fillStyle = '#FF4444'; ctx.font = '10px "Courier New", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`Boss: W${m.bossWave}`, cx + cardW - 12, statsY);
            ctx.textAlign = 'left';
            // Enemy types
            ctx.fillStyle = '#555'; ctx.font = '9px "Courier New", monospace';
            ctx.fillText(`Enemies: ${m.enemyTypes.join(', ')}`, cx + 12, statsY + 14);
        }
        // Selected mission detail panel
        const sel = this.missions[this.missionSelection];
        if (sel) {
            const panelY = ch / 2 + cardH / 2 - 10;
            ctx.textAlign = 'center'; ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#888';
            ctx.fillText(`Press Enter to deploy to ${sel.name}`, cw / 2, panelY + 20);
        }
        // Controls
        ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#444'; ctx.textAlign = 'center';
        ctx.fillText('A/D or Left/Right to select  |  Enter to start  |  ESC to go back', cw / 2, ch - 30);
    }

    _renderPause(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, cw, ch);
        // Decorative lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
        for (let y = 0; y < ch; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 48px "Courier New", monospace'; ctx.fillStyle = '#FFF';
        ctx.fillText('PAUSED', cw / 2, ch / 2 - 80);
        // Stats
        const runMins = Math.floor((game.runTime || 0) / 60);
        const runSecs = Math.floor((game.runTime || 0) % 60);
        ctx.font = '16px "Courier New", monospace'; ctx.fillStyle = '#AAA';
        ctx.fillText(`Wave: ${game.waveManager.wave}  |  Score: ${game.scoreManager.score}  |  Kills: ${game.scoreManager.kills}`, cw / 2, ch / 2 - 30);
        ctx.fillText(`Time: ${runMins}:${runSecs.toString().padStart(2, '0')}`, cw / 2, ch / 2 - 5);
        // Controls
        const controlsY = ch / 2 + 40;
        ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = '#888';
        const controls = [
            ['ESC', 'Resume'],
            ['Q', 'Quit to Menu'],
            ['F3', 'Debug Overlay'],
            ['`', 'Dev Cheats'],
        ];
        for (let i = 0; i < controls.length; i++) {
            const [key, label] = controls[i];
            const y = controlsY + i * 22;
            ctx.fillStyle = '#FF8800'; ctx.fillText(key, cw / 2 - 60, y);
            ctx.fillStyle = '#AAA'; ctx.fillText(label, cw / 2 + 10, y);
        }
    }

    _renderGameOver(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, cw, ch);
        // Decorative scan lines
        ctx.fillStyle = 'rgba(255,0,0,0.02)';
        for (let y = 0; y < ch; y += 3) ctx.fillRect(0, y, cw, 1);
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const pulse = 0.8 + Math.sin(performance.now() * 0.003) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 52px "Courier New", monospace'; ctx.fillStyle = '#FF0000';
        ctx.fillText('GAME OVER', cw / 2, ch / 2 - 160);
        ctx.globalAlpha = 1;
        // Stats panel
        const panelW = 380, panelH = 180, panelX = cw / 2 - panelW / 2, panelY = ch / 2 - 120;
        ctx.fillStyle = 'rgba(20,0,0,0.7)'; ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#FF3333'; ctx.lineWidth = 1; ctx.strokeRect(panelX, panelY, panelW, panelH);
        // Stats
        const runMins = Math.floor((game.runTime || 0) / 60);
        const runSecs = Math.floor((game.runTime || 0) % 60);
        const kpm = game.runTime > 0 ? (game.scoreManager.kills / (game.runTime / 60)).toFixed(1) : '—';
        const scorePerSec = game.runTime > 0 ? (game.scoreManager.score / game.runTime).toFixed(1) : '—';
        const stats = [
            ['Final Score', `${game.scoreManager.score}`, '#FFD700'],
            ['Waves Survived', `${game.waveManager.wave}`, '#FFF'],
            ['Total Kills', `${game.scoreManager.kills}`, '#FFF'],
            ['Time Survived', `${runMins}:${runSecs.toString().padStart(2, '0')}`, '#FFF'],
            ['Kills/min', `${kpm}`, '#AAA'],
            ['Score/sec', `${scorePerSec}`, '#AAA'],
            ['High Score', `${game.persistence.data.highScore}`, '#FFD700'],
        ];
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        for (let i = 0; i < stats.length; i++) {
            const [label, value, color] = stats[i];
            const sy = panelY + 12 + i * 23;
            ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = '#888';
            ctx.fillText(label, panelX + 16, sy);
            ctx.textAlign = 'right'; ctx.fillStyle = color; ctx.font = 'bold 14px "Courier New", monospace';
            ctx.fillText(value, panelX + panelW - 16, sy);
            ctx.textAlign = 'left';
        }
        // High score indicator
        if (game.scoreManager.score >= game.persistence.data.highScore && game.scoreManager.score > 0) {
            ctx.font = 'bold 16px "Courier New", monospace'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
            ctx.fillText('NEW HIGH SCORE!', cw / 2, panelY + panelH + 16);
        }
        // Name input / submit
        if (!this.submitted) {
            const t = performance.now() * 0.001;
            const pulse = 0.5 + Math.sin(t * 4) * 0.5;
            const inputW = 280, inputH = 36;
            const inputX = cw / 2 - inputW / 2, inputY = ch / 2 + 82;
            // Outer glow
            ctx.shadowColor = `rgba(0,204,255,${0.3 * pulse})`; ctx.shadowBlur = 10 * pulse;
            ctx.fillStyle = '#111'; ctx.fillRect(inputX, inputY, inputW, inputH);
            ctx.strokeStyle = `rgba(0,204,255,${0.5 + pulse * 0.5})`; ctx.lineWidth = 2; ctx.strokeRect(inputX, inputY, inputW, inputH);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'center';
            ctx.font = '16px "Courier New", monospace'; ctx.fillStyle = '#FFF';
            ctx.fillText(`Name: ${this.nameInput || game.persistence.data.playerName}_`, cw / 2, inputY + 22);
            ctx.font = '13px "Courier New", monospace'; ctx.fillStyle = '#666';
            ctx.fillText('Enter to Submit | ESC to Skip', cw / 2, ch / 2 + 140);
        } else {
            if (this.submitResult) {
                if (this.submitResult.success) {
                    ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#00FF00'; ctx.textAlign = 'center';
                    ctx.fillText(`Submitted! Rank: #${this.submitResult.rank}`, cw / 2, ch / 2 + 100);
                } else if (!this.submitResult.skipped) {
                    ctx.font = '16px monospace'; ctx.fillStyle = '#FF4444'; ctx.textAlign = 'center';
                    ctx.fillText(`Submit failed: ${this.submitResult.error}`, cw / 2, ch / 2 + 100);
                }
            }
            // Restart prompt
            const p2 = 0.7 + Math.sin(performance.now() * 0.004) * 0.3;
            ctx.globalAlpha = p2;
            ctx.font = 'bold 16px "Courier New", monospace'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
            ctx.fillText('R — Restart  |  L — Leaderboard', cw / 2, ch / 2 + 140);
            ctx.globalAlpha = 1;
        }
        // Lifetime stats
        ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#444'; ctx.textAlign = 'center';
        ctx.fillText(`Lifetime: ${game.persistence.data.totalRuns} runs | ${game.persistence.data.totalKills} kills | Best wave: ${game.persistence.data.bestWave}`, cw / 2, ch - 30);
    }

    _renderSettings(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const s = game.persistence.data.settings;
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 32px "Courier New", monospace'; ctx.fillStyle = '#FFF';
        ctx.fillText('SETTINGS', cw / 2, 60);
        const startY = 120;
        for (let i = 0; i < this.settingsItems.length; i++) {
            const selected = i === this.settingsSelection;
            const y = startY + i * 40;
            let valueText = '';
            switch (i) {
                case 0: valueText = `[${'█'.repeat(Math.round(s.masterVolume * 10))}${'░'.repeat(10 - Math.round(s.masterVolume * 10))}] ${Math.round(s.masterVolume * 100)}%`; break;
                case 1: valueText = `[${'█'.repeat(Math.round(s.sfxVolume * 10))}${'░'.repeat(10 - Math.round(s.sfxVolume * 10))}] ${Math.round(s.sfxVolume * 100)}%`; break;
                case 2: valueText = `[${'█'.repeat(Math.round(s.musicVolume * 10))}${'░'.repeat(10 - Math.round(s.musicVolume * 10))}] ${Math.round(s.musicVolume * 100)}%`; break;
                case 3: valueText = s.muted ? '[ON]' : '[OFF]'; break;
                case 4: valueText = `[${s.graphicsQuality.toUpperCase()}]`; break;
                case 5: valueText = `[${s.screenShakeIntensity.toFixed(2)}]`; break;
                case 6: valueText = s.showDamageNumbers ? '[ON]' : '[OFF]'; break;
                case 7: valueText = s.showMinimap ? '[ON]' : '[OFF]'; break;
                case 8: valueText = game.persistence.data.playerName; break;
                case 9: valueText = ''; break;
            }
            if (selected) {
                ctx.fillStyle = 'rgba(255,50,50,0.1)'; ctx.fillRect(cw / 2 - 250, y - 14, 500, 30);
                ctx.strokeStyle = '#FF3333'; ctx.lineWidth = 1; ctx.strokeRect(cw / 2 - 250, y - 14, 500, 30);
            }
            ctx.font = selected ? 'bold 16px "Courier New", monospace' : '15px "Courier New", monospace';
            ctx.textAlign = 'left'; ctx.fillStyle = selected ? '#FF5555' : '#AAA';
            ctx.fillText(this.settingsItems[i], cw / 2 - 230, y);
            ctx.textAlign = 'right'; ctx.fillStyle = selected ? '#FFF' : '#777';
            ctx.fillText(valueText, cw / 2 + 230, y);
        }
        ctx.textAlign = 'center'; ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#555';
        ctx.fillText('A/D or Left/Right to adjust | Enter/ESC to go back', cw / 2, ch - 40);
    }

    _renderLeaderboard(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 32px "Courier New", monospace'; ctx.fillStyle = '#FFD700';
        ctx.fillText('GLOBAL LEADERBOARD', cw / 2, 50);
        if (this.leaderboardLoading) {
            ctx.font = '18px monospace'; ctx.fillStyle = '#AAA';
            ctx.fillText('Loading...', cw / 2, ch / 2);
        } else if (this.leaderboardError) {
            ctx.font = '16px monospace'; ctx.fillStyle = '#FF4444';
            ctx.fillText(`Error: ${this.leaderboardError}`, cw / 2, ch / 2 - 10);
            ctx.fillStyle = '#AAA'; ctx.fillText('Make sure the backend server is running', cw / 2, ch / 2 + 20);
        } else if (this.leaderboardData.length === 0) {
            ctx.font = '16px monospace'; ctx.fillStyle = '#AAA';
            ctx.fillText('No scores yet. Be the first!', cw / 2, ch / 2);
        } else {
            // Table header
            const tableX = cw / 2 - 300, startY = 100;
            ctx.font = 'bold 14px "Courier New", monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'left';
            ctx.fillText('Rank', tableX, startY);
            ctx.fillText('Name', tableX + 60, startY);
            ctx.fillText('Score', tableX + 220, startY);
            ctx.fillText('Wave', tableX + 340, startY);
            ctx.fillText('Kills', tableX + 420, startY);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tableX, startY + 12); ctx.lineTo(tableX + 500, startY + 12); ctx.stroke();
            // Rows
            for (let i = 0; i < Math.min(this.leaderboardData.length, 15); i++) {
                const entry = this.leaderboardData[i]; const y = startY + 30 + i * 28;
                const isMe = entry.playerName === game.persistence.data.playerName;
                ctx.font = isMe ? 'bold 14px "Courier New", monospace' : '13px "Courier New", monospace';
                ctx.fillStyle = isMe ? '#FFD700' : (i < 3 ? '#FFF' : '#AAA');
                ctx.textAlign = 'left';
                ctx.fillText(`#${i + 1}`, tableX, y);
                ctx.fillText(entry.playerName || '???', tableX + 60, y);
                ctx.fillText(entry.score.toLocaleString(), tableX + 220, y);
                ctx.fillText(`${entry.waveReached}`, tableX + 340, y);
                ctx.fillText(`${entry.kills}`, tableX + 420, y);
            }
        }
        ctx.textAlign = 'center'; ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#555';
        ctx.fillText('Press Enter or ESC to go back', cw / 2, ch - 30);
    }

    _renderOnline(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 32px "Courier New", monospace'; ctx.fillStyle = '#00CCFF';
        ctx.fillText('ONLINE PLAY', cw / 2, ch / 2 - 100);
        for (let i = 0; i < this.onlineItems.length; i++) {
            const selected = i === this.onlineSelection;
            const y = ch / 2 - 20 + i * 45;
            if (selected) {
                ctx.fillStyle = 'rgba(0,150,255,0.1)'; ctx.fillRect(cw / 2 - 150, y - 16, 300, 34);
                ctx.strokeStyle = '#00CCFF'; ctx.lineWidth = 1; ctx.strokeRect(cw / 2 - 150, y - 16, 300, 34);
            }
            ctx.font = selected ? 'bold 20px "Courier New", monospace' : '18px "Courier New", monospace';
            ctx.fillStyle = selected ? '#00CCFF' : '#888';
            ctx.fillText(this.onlineItems[i], cw / 2, y);
        }
        ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = '#555';
        ctx.fillText(`Server: ${CONFIG.multiplayer.url}`, cw / 2, ch - 40);
    }

    _renderJoinRoom(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const t = performance.now() * 0.001;
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 28px "Courier New", monospace'; ctx.fillStyle = '#00CCFF';
        ctx.fillText('JOIN ROOM', cw / 2, ch / 2 - 60);
        ctx.font = '16px monospace'; ctx.fillStyle = '#AAA';
        ctx.fillText('Enter Room Code:', cw / 2, ch / 2 - 20);
        // Code input box with pulsing neon cyan border
        const boxX = cw / 2 - 80, boxY = ch / 2, boxW = 160, boxH = 40;
        const pulse = 0.5 + Math.sin(t * 4) * 0.5;
        // Outer glow
        ctx.shadowColor = `rgba(0,204,255,${0.4 * pulse})`; ctx.shadowBlur = 12 * pulse;
        ctx.fillStyle = '#111'; ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = `rgba(0,204,255,${0.6 + pulse * 0.4})`; ctx.lineWidth = 2; ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 28px "Courier New", monospace'; ctx.fillStyle = '#FFF';
        ctx.fillText(this.roomCodeInput.toUpperCase() + '_', cw / 2, ch / 2 + 20);
        ctx.font = '12px monospace'; ctx.fillStyle = '#555';
        ctx.fillText('4 characters | Enter to join | ESC to back', cw / 2, ch / 2 + 60);
    }

    _renderWaiting(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px "Courier New", monospace'; ctx.fillStyle = '#00CCFF';
        const dots = '.'.repeat(Math.floor(performance.now() / 500) % 4);
        ctx.fillText(`Waiting for players${dots}`, cw / 2, ch / 2 - 30);
        if (game.network.roomCode) {
            ctx.font = 'bold 36px "Courier New", monospace'; ctx.fillStyle = '#FFD700';
            ctx.fillText(`Room: ${game.network.roomCode}`, cw / 2, ch / 2 + 20);
        }
        ctx.font = '12px monospace'; ctx.fillStyle = '#555';
        ctx.fillText('ESC to cancel', cw / 2, ch / 2 + 60);
    }
}
