/**
 * Dodge Warfare - Phase 6
 * UI - HUD, Minimap, Crosshair, KillFeed, GameStateManager, Menus
 */

// ============================================================
// HUD - Phase 6 with compact debug overlay
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
        const sw = game.screenWidth || ctx.canvas.width, sh = game.screenHeight || ctx.canvas.height;
        const scale = Math.min(1, sw / 1200);
        const margin = Math.floor(CONFIG.hud.margin * scale);
        const barWidth = Math.floor(CONFIG.hud.barWidth * scale);
        const barHeight = Math.floor(CONFIG.hud.barHeight * scale);
        const padding = Math.floor(CONFIG.hud.barPadding * scale);
        let y = margin;
        // HP bar
        this._drawBar(ctx, margin, y, barWidth, barHeight, player.hp, player.maxHP, CONFIG.hud.hpColor, CONFIG.hud.hpBgColor, 'HP', player.hp < 30 ? CONFIG.hud.hpLowColor : null);
        y += barHeight + padding;
        // Stamina bar
        this._drawBar(ctx, margin, y, barWidth, barHeight, player.stamina, player.maxStamina, CONFIG.hud.staminaColor, CONFIG.hud.staminaBgColor, 'STAMINA');
        y += barHeight + padding + 8;
        // Weapon info panel
        const w = player.weapon;
        const wpnPanelW = Math.floor(240 * scale), wpnPanelH = Math.floor(70 * scale);
        const wpnX = margin, wpnY = y;
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(wpnX, wpnY, wpnPanelW, wpnPanelH);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.strokeRect(wpnX, wpnY, wpnPanelW, wpnPanelH);
        // Weapon name (truncate if too long for panel)
        let wpnName = w.name;
        ctx.font = 'bold 14px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        if (ctx.measureText(wpnName).width > wpnPanelW - 16) {
            while (ctx.measureText(wpnName + '\u2026').width > wpnPanelW - 16 && wpnName.length > 1) {
                wpnName = wpnName.slice(0, -1);
            }
            wpnName += '\u2026';
        }
        ctx.fillStyle = '#FFF'; ctx.fillText(wpnName, wpnX + 8, wpnY + 6);
        // Phase 7: Carried weapon slots (limited carry)
        const slotSize = Math.min(20, Math.floor((wpnPanelW - 16) / player.carriedWeaponIndices.length));
        for (let i = 0; i < player.carriedWeaponIndices.length; i++) {
            const wpnIdx = player.carriedWeaponIndices[i];
            if (wpnIdx === -1) {
                // Empty slot
                const slotX = wpnX + 8 + i * (slotSize + 2), slotY = wpnY + 24;
                ctx.fillStyle = '#111'; ctx.fillRect(slotX, slotY, slotSize, 16);
                ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(slotX, slotY, slotSize, 16);
                ctx.font = '8px monospace'; ctx.fillStyle = '#555'; ctx.textAlign = 'center';
                ctx.fillText('--', slotX + slotSize / 2, slotY + 3);
            } else {
                const slotX = wpnX + 8 + i * (slotSize + 2), slotY = wpnY + 24;
                ctx.fillStyle = wpnIdx === player.currentWeaponIndex ? '#555' : '#222';
                ctx.fillRect(slotX, slotY, slotSize, 16);
                ctx.strokeStyle = wpnIdx === player.currentWeaponIndex ? '#FFD700' : '#444'; ctx.lineWidth = 1; ctx.strokeRect(slotX, slotY, slotSize, 16);
                ctx.font = '9px monospace'; ctx.fillStyle = wpnIdx === player.currentWeaponIndex ? '#FFD700' : '#888'; ctx.textAlign = 'center';
                ctx.fillText(`${i + 1}`, slotX + slotSize / 2, slotY + 3);
                // Small dot for weapon color
                ctx.beginPath(); ctx.arc(slotX + slotSize - 3, slotY + 8, 2, 0, Math.PI * 2);
                ctx.fillStyle = player.weapons[wpnIdx].bulletColor || '#FFF'; ctx.fill();
            }
        }
        // Ammo display (scale font to fit panel)
        const magColor = player.currentMag <= 3 ? CONFIG.hud.ammoLowColor : CONFIG.hud.ammoColor;
        const ammoFontSize = Math.min(20, Math.max(12, wpnPanelW * 0.08));
        const reserveFontSize = Math.min(14, Math.max(10, wpnPanelW * 0.055));
        ctx.font = `bold ${ammoFontSize}px "Courier New", monospace`; ctx.textAlign = 'left'; ctx.fillStyle = magColor;
        ctx.fillText(`${player.currentMag}`, wpnX + 8, wpnY + 46);
        ctx.font = `${reserveFontSize}px "Courier New", monospace`; ctx.fillStyle = '#888';
        ctx.fillText(`/ ${w.reserveAmmo}`, wpnX + 8 + ctx.measureText(`${player.currentMag}`).width + 6, wpnY + 48 + (ammoFontSize - reserveFontSize));
        // Reload bar (fit within panel)
        if (player.isReloading) {
            const reloadPct = 1 - (player.reloadTimer / player.reloadDuration);
            const reloadBarX = wpnX + wpnPanelW - 130;
            const reloadBarW = Math.min(120, wpnPanelW - ctx.measureText(`${player.currentMag}`).width - 50);
            if (reloadBarW > 40) {
                ctx.fillStyle = '#222'; ctx.fillRect(reloadBarX, wpnY + 48, reloadBarW, 12);
                ctx.fillStyle = CONFIG.hud.reloadColor; ctx.fillRect(reloadBarX, wpnY + 48, reloadBarW * reloadPct, 12);
                ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(reloadBarX, wpnY + 48, reloadBarW, 12);
                ctx.font = '10px monospace'; ctx.fillStyle = '#FFF'; ctx.textAlign = 'center';
                ctx.fillText('RELOADING', reloadBarX + reloadBarW / 2, wpnY + 49);
            } else {
                ctx.font = '10px monospace'; ctx.fillStyle = CONFIG.hud.reloadColor; ctx.textAlign = 'right';
                ctx.fillText('RELOADING', wpnX + wpnPanelW - 8, wpnY + 48);
            }
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
        // Phase 7: Ability cooldown HUD
        if (player.abilities) {
            const abKeys = ['grenade', 'shield', 'adrenaline'];
            const abLabels = { grenade: 'Q', shield: 'E', adrenaline: 'F' };
            const abWidth = 50, abHeight = 20, abGap = 4;
            const abStartX = margin;
            y += 2;
            for (let i = 0; i < abKeys.length; i++) {
                const key = abKeys[i];
                const ab = player.abilities[key];
                if (!ab) continue;
                const ax = abStartX + i * (abWidth + abGap);
                const ready = ab.ready;
                const active = ab.active;
                const cdPct = ab.ready ? 1 : Math.max(0, 1 - ab.cooldown / ab.maxCooldown);
                ctx.fillStyle = active ? 'rgba(50,100,255,0.3)' : ready ? 'rgba(0,255,0,0.1)' : 'rgba(80,80,80,0.5)';
                ctx.fillRect(ax, y, abWidth, abHeight);
                ctx.strokeStyle = active ? '#4488FF' : ready ? '#00FF00' : '#555';
                ctx.lineWidth = 1; ctx.strokeRect(ax, y, abWidth, abHeight);
                // Cooldown overlay
                if (!ready) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(ax, y, abWidth * (1 - cdPct), abHeight);
                }
                // Label
                ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = ready ? '#FFF' : '#888';
                ctx.fillText(abLabels[key], ax + 12, y + abHeight / 2);
                // Ability name
                ctx.font = '7px monospace'; ctx.textAlign = 'left';
                ctx.fillText(key.charAt(0).toUpperCase() + key.slice(1), ax + 18, y + 8);
                // Cooldown text
                if (!ready) {
                    ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#AAA';
                    ctx.fillText(`${Math.ceil(ab.cooldown / 1000)}s`, ax + abWidth / 2, y + abHeight - 3);
                } else if (active) {
                    ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#88BBFF';
                    ctx.fillText(`${Math.ceil(ab.timer / 1000)}s`, ax + abWidth / 2, y + abHeight - 3);
                }
            }
            y += abHeight + 4;
        }
        ctx.font = CONFIG.hud.labelFont; ctx.fillStyle = CONFIG.hud.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        if (!(game && game.endlessMode)) {
            ctx.fillText(`Wave: ${waveManager.wave}`, margin, y);
        }
        ctx.fillText(`Enemies: ${waveManager.getEnemiesRemaining(enemies)}`, margin, y + 16);
        // Score — positioned left side below stamina
        const scoreFontSize = Math.floor(Math.min(16, sw * 0.03));
        ctx.font = `bold ${scoreFontSize}px "Courier New", monospace`; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`Score: ${scoreManager.score}`, margin, y + 4);
        // Combo
        if (scoreManager.combo > 1) {
            ctx.font = `bold ${Math.floor(scoreFontSize * 0.78)}px monospace`; ctx.fillStyle = '#FF8800';
            ctx.fillText(`Combo x${scoreManager.combo}`, margin, y + scoreFontSize + 8);
        }
        // Run timer (below combo)
        if (game && game.runTime > 0) {
            const mins = Math.floor(game.runTime / 60);
            const secs = Math.floor(game.runTime % 60);
            ctx.font = `${Math.floor(scoreFontSize * 0.67)}px "Courier New", monospace`; ctx.fillStyle = '#888'; ctx.textAlign = 'left';
            ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, margin, y + scoreFontSize * 2 + 12);
        }
        // Bot mode indicator (below timer)
        if (game && game.bot && game.bot.active) {
            const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
            ctx.font = `bold ${Math.floor(scoreFontSize * 0.78)}px "Courier New", monospace`;
            ctx.fillStyle = `rgba(0,200,255,${pulse})`;
            ctx.textAlign = 'left';
            const skillPct = Math.floor(game.bot._skillLevel * 100);
            const kills = game.bot._kills;
            const combo = game.bot._knowledge.currentCombo;
            const label = combo > 2 ? `BOT [${skillPct}%] ${kills}K x${combo}` : `BOT [${skillPct}%] ${kills}K`;
            ctx.fillText(label, margin, y + scoreFontSize * 3 + 16);
        }
        // Coins display (top-right, left of minimap)
        if (game && game.persistence) {
            const showMinimap = game && game.persistence && game.persistence.data.settings.showMinimap;
            const mmSize = showMinimap ? Math.floor(Math.min(200, sw * 0.18)) : 0;
            const rightEdge = sw - margin - (showMinimap ? mmSize + 10 : 0);
            ctx.font = `bold ${Math.floor(13 * scale)}px "Courier New", monospace`; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
            ctx.fillText(`$ ${game.persistence.data.coins.toLocaleString()}`, rightEdge, margin);
        }
        // Kill feed
        if (killFeed) killFeed.render(ctx, game);
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
            const cy = sh * 0.35 - slideOffset;
            ctx.globalAlpha = alpha * pulse;
            // Background bar with slide
            const textW = ctx.measureText(waveManager.announcementText).width + 60;
            const bgAlpha = alpha * (isBoss ? 0.6 : isComplete ? 0.5 : 0.5);
            ctx.fillStyle = isBoss ? `rgba(150,0,0,${bgAlpha})` : isComplete ? `rgba(0,100,0,${bgAlpha})` : isPerk ? `rgba(100,0,100,${bgAlpha})` : isSupply ? `rgba(0,80,100,${bgAlpha})` : `rgba(0,0,0,${bgAlpha})`;
            ctx.fillRect(sw / 2 - textW / 2, cy - 22, textW, 48);
            // Border with glow
            const borderColor = isBoss ? '#FF0000' : isComplete ? '#00FF88' : isPerk ? '#FF00FF' : isSupply ? '#00CCFF' : '#FF8800';
            ctx.shadowColor = borderColor; ctx.shadowBlur = 8 * alpha;
            ctx.strokeStyle = borderColor; ctx.lineWidth = 2; ctx.strokeRect(sw / 2 - textW / 2, cy - 22, textW, 48);
            ctx.shadowBlur = 0;
            // Main text
            ctx.font = isBoss ? 'bold 34px "Courier New", monospace' : 'bold 28px "Courier New", monospace';
            ctx.fillStyle = isBoss ? '#FF2222' : isComplete ? '#00FF88' : isPerk ? '#FF44FF' : isSupply ? '#00DDFF' : '#FF8800';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(waveManager.announcementText, sw / 2, cy);
            // Subtitle
            if (isBoss) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(255,102,102,${alpha})`;
                ctx.fillText('PREPARE FOR BATTLE', sw / 2, cy + 22);
            } else if (isComplete) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(136,255,187,${alpha})`;
                ctx.fillText('Next wave approaching...', sw / 2, cy + 22);
            } else if (isPerk) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(255,136,255,${alpha})`;
                ctx.fillText('Select your upgrade!', sw / 2, cy + 22);
            } else if (isSupply) {
                ctx.font = '14px "Courier New", monospace'; ctx.fillStyle = `rgba(0,220,255,${alpha})`;
                ctx.fillText('Collect supplies!', sw / 2, cy + 22);
            }
            ctx.globalAlpha = 1;
        }
        // Low HP vignette
        if (player.hp < 30 && player.alive) {
            const vignetteAlpha = (1 - player.hp / 30) * 0.3 * (0.7 + Math.sin(performance.now() * 0.005) * 0.3);
            const g = ctx.createRadialGradient(sw / 2, sh / 2, sw * 0.3, sw / 2, sh / 2, sw * 0.7);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${vignetteAlpha})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, sw, sh);
        }

        // Phase 7: Weapon pickup indicator (near ground drops)
        if (game && game.effects) {
            for (const eff of game.effects) {
                if (eff.weaponName && eff.active) {
                    const d = distance(player.x, player.y, eff.x, eff.y);
                    if (d < CONFIG.weaponCarry.pickupRange) {
                        const sx = eff.x - camera.x + game.camera.shakeOffsetX || 0;
                        const sy = eff.y - camera.y + game.camera.shakeOffsetY || 0;
                        ctx.save();
                        const pulse = 0.6 + Math.sin(performance.now() * 0.005) * 0.4;
                        ctx.globalAlpha = pulse;
                        ctx.font = 'bold 11px "Courier New", monospace';
                        ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                        ctx.fillText(`[${CONFIG.weaponCarry.pickupKey}] PICK UP`, sx, sy - 20);
                        ctx.globalAlpha = 1;
                        ctx.restore();
                        break;
                    }
                }
            }
        }

        // Phase 7: Weapon shop overlay
        if (game && game.gameState && game.gameState.weaponShopOpen) {
            game.hud._renderWeaponShop(ctx, sw, sh, game);
        }

        // === MATH NERD DEBUG OVERLAY ===
        if (this.showDebug && game) {
            this._renderMathNerdDebug(ctx, player, camera, bullets, enemyBullets, enemies, effects, scoreManager, waveManager, audioManager, game);
        }
    }

    // Phase 7: Weapon shop overlay
    _renderWeaponShop(ctx, sw, sh, game) {
        const gs = game.gameState;
        const player = game.player;
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, sw, sh);
        const panelW = Math.min(500, sw * 0.8);
        const panelH = Math.min(400, sh * 0.7);
        const px = (sw - panelW) / 2, py = (sh - panelH) / 2;
        ctx.fillStyle = 'rgba(20,20,30,0.95)'; ctx.fillRect(px, py, panelW, panelH);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.strokeRect(px, py, panelW, panelH);
        ctx.font = 'bold 18px "Courier New", monospace'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('WEAPON SHOP', sw / 2, py + 10);
        ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#AAA'; ctx.textAlign = 'center';
        ctx.fillText('Select a weapon to buy (cost in coins)', sw / 2, py + 36);
        // Coins display
        ctx.font = 'bold 13px "Courier New", monospace'; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'right';
        ctx.fillText(`$ ${game.persistence.data.coins.toLocaleString()}`, px + panelW - 10, py + 10);
        // Available weapons from config
        const shopWeapons = CONFIG.weapons.filter(w => w.cost && w.cost > 0);
        const startY = py + 60;
        const itemH = 50;
        const visibleCount = Math.min(shopWeapons.length, Math.floor((panelH - 70) / itemH));
        const scrollOffset = gs.weaponShopScroll || 0;
        for (let i = 0; i < visibleCount && i + scrollOffset < shopWeapons.length; i++) {
            const idx = i + scrollOffset;
            const wpn = shopWeapons[idx];
            const iy = startY + i * itemH;
            const isOwned = player.weapons.find(w => w.name === wpn.name) && player.carriedWeaponIndices.some(ci => ci >= 0 && player.weapons[ci].name === wpn.name);
            const canAfford = game.persistence.data.coins >= wpn.cost;
            const isSelected = idx === gs.weaponShopSelection;
            if (isSelected) {
                ctx.fillStyle = 'rgba(255,215,0,0.15)';
                ctx.fillRect(px + 10, iy, panelW - 20, itemH - 4);
                ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
                ctx.strokeRect(px + 10, iy, panelW - 20, itemH - 4);
            }
            ctx.font = 'bold 13px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = isOwned ? '#888' : canAfford ? '#FFF' : '#555';
            ctx.fillText(wpn.name, px + 20, iy + itemH / 2 - 4);
            ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'right';
            ctx.fillStyle = canAfford ? '#FFD700' : '#FF4444';
            ctx.fillText(`$${wpn.cost}`, px + panelW - 20, iy + itemH / 2 - 4);
            ctx.font = '8px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#888';
            const statsText = `DMG:${wpn.damage} | ROF:${Math.round(60000/wpn.fireRate)} | MAG:${wpn.magSize}`;
            ctx.fillText(statsText, px + 20, iy + itemH / 2 + 12);
            ctx.font = '8px monospace'; ctx.textAlign = 'right';
            ctx.fillStyle = wpn.tier === 3 ? '#FF4444' : wpn.tier === 2 ? '#FF8800' : '#AAA';
            ctx.fillText(`Tier ${wpn.tier}`, px + panelW - 20, iy + itemH / 2 + 12);
            if (isOwned) {
                ctx.fillStyle = '#00FF00'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
                ctx.fillText('OWNED', px + panelW - 80, iy + itemH / 2 - 4);
            }
        }
        // Buy button
        const sel = shopWeapons[gs.weaponShopSelection];
        if (sel) {
            const isOwned = player.weapons.find(w => w.name === sel.name) && player.carriedWeaponIndices.some(ci => ci >= 0 && player.weapons[ci].name === sel.name);
            const canAfford = game.persistence.data.coins >= sel.cost;
            const btnY = py + panelH - 50;
            const btnW = 120, btnH = 30;
            const btnX = sw / 2 - btnW / 2;
            ctx.fillStyle = isOwned ? '#444' : canAfford ? '#FFD700' : '#333';
            ctx.fillRect(btnX, btnY, btnW, btnH);
            ctx.strokeStyle = isOwned ? '#666' : canAfford ? '#FFAA00' : '#555';
            ctx.lineWidth = 1; ctx.strokeRect(btnX, btnY, btnW, btnH);
            ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = isOwned ? '#888' : canAfford ? '#000' : '#555';
            ctx.fillText(isOwned ? 'EQUIPPED' : canAfford ? 'BUY' : 'LOCKED', sw / 2, btnY + btnH / 2);
        }
        ctx.font = '10px "Courier New", monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('Arrow keys: Navigate | Enter: Buy/Swap | Esc: Close', sw / 2, py + panelH - 4);
    }

    _drawBar(ctx, x, y, width, height, current, max, color, bgColor, label, flashColor) {
        const pct = clamp(current / max, 0, 1);
        ctx.fillStyle = bgColor; ctx.fillRect(x, y, width, height);
        ctx.fillStyle = flashColor && current < max * 0.3 ? flashColor : color;
        ctx.fillRect(x, y, width * pct, height);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
        const barFontSize = Math.max(8, Math.min(12, height - 4));
        ctx.font = `${barFontSize}px "Courier New", monospace`;
        ctx.fillStyle = CONFIG.hud.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${label}: ${Math.ceil(current)} / ${max}`, x + 4, y + 1);
        ctx.restore();
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
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;

        // ---- COMPACT DATA PANEL (top-left) ----
        const rows = [
            { label: 'FPS',       value: `${this.fps} (${f(avgDt, 1)}ms)`, warn: this.fps < 30 },
            { label: 'Enemies',   value: `${enemies.length} · ${bullets.length}◇ ${enemyBullets.length}◆ ${effects.length}*`, warn: enemies.length > 100 },
            { label: 'HP',        value: `${fi(player.hp)}/${player.maxHP} · ${fi(player.stamina)}/${player.maxStamina}`, warn: player.hp < 30 },
            { label: 'Weapon',    value: `${player.weapon.name} [${player.currentMag}/${player.weapon.magSize}]${player.isReloading ? ' (R)' : ''}` },
            { label: 'Wave',      value: `W${waveManager.wave} · ${scoreManager.kills} kills · ${fi(game.runTime)}s` },
            { label: 'Pos',       value: `(${fi(player.x)}, ${fi(player.y)})` },
            { label: 'Status',    value: `${game.godMode ? 'GOD ' : ''}${game.network.connected ? 'NET ' : ''}${game.graphicsQuality}` },
            { label: 'AntiCheat', value: `${game.antiCheat.enabled ? 'ON' : 'OFF'} [${game.antiCheat.violations.length}] ${game.antiCheat.suspicionLevel}%`, warn: game.antiCheat.suspicionLevel > 50 },
            { label: 'Bot',      value: game.bot.active ? `Skill:${(game.bot._skillLevel*100).toFixed(0)}% Kills:${game.bot._kills} Combo:${game.bot._knowledge.currentCombo}` : 'OFF' },
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
        this._renderSparkline(ctx, sw - 220, sh - 80, 200, 50, this.frameTimes, 16.667, 'Frame Time (ms)');

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
    render(ctx, player, buildings, cars, barrels, trees, enemies, pickups, trucks = [], suvs = [], vans = [], screenWidth) {
        const sw = screenWidth || ctx.canvas.width;
        const actualSize = Math.floor(Math.min(CONFIG.minimap.size, sw * 0.18));
        const margin = Math.floor(CONFIG.minimap.margin * Math.min(1, sw / 1200));
        const x = sw - actualSize - margin, y = margin;
        this.size = actualSize;
        this.scale = actualSize / CONFIG.world.width;
        const s = this.scale;
        // Background
        ctx.fillStyle = CONFIG.minimap.bgColor; ctx.fillRect(x, y, this.size, this.size);
        // Roads
        const roadWidth = 3 * CONFIG.tile.size * s, centerX = x + this.size / 2, centerY = y + this.size / 2;
        ctx.fillStyle = CONFIG.minimap.roadColor; ctx.fillRect(centerX - roadWidth / 2, y, roadWidth, this.size); ctx.fillRect(x, centerY - roadWidth / 2, this.size, roadWidth);
        // Minimap viewport bounds (world coords) for culling
        const mmWorldMinX = 0, mmWorldMinY = 0, mmWorldMaxX = CONFIG.world.width, mmWorldMaxY = CONFIG.world.height;
        // Buildings (limit to first 100 for performance)
        ctx.fillStyle = CONFIG.minimap.buildingColor; const bLen = Math.min(buildings.length, 100); for (let i = 0; i < bLen; i++) { const b = buildings[i]; ctx.fillRect(x + b.x * s, y + b.y * s, b.w * s, b.h * s); }
        // Cars
        ctx.fillStyle = CONFIG.minimap.carColor; for (let i = 0, len = Math.min(cars.length, 50); i < len; i++) { const c = cars[i]; if (!c.destroyed) ctx.fillRect(x + c.x * s, y + c.y * s, 3, 3); }
        // Trucks
        ctx.fillStyle = '#AA8844'; for (let i = 0, len = Math.min(trucks.length, 30); i < len; i++) { const t = trucks[i]; if (!t.destroyed) ctx.fillRect(x + t.x * s, y + t.y * s, 4, 4); }
        // SUVs
        ctx.fillStyle = '#668866'; for (let i = 0, len = Math.min(suvs.length, 30); i < len; i++) { const sv = suvs[i]; if (!sv.destroyed) ctx.fillRect(x + sv.x * s, y + sv.y * s, 3, 3); }
        // Vans
        ctx.fillStyle = '#888888'; for (let i = 0, len = Math.min(vans.length, 30); i < len; i++) { const v = vans[i]; if (!v.destroyed) ctx.fillRect(x + v.x * s, y + v.y * s, 3, 3); }
        // Barrels
        ctx.fillStyle = CONFIG.minimap.barrelColor; for (let i = 0, len = Math.min(barrels.length, 50); i < len; i++) { const b = barrels[i]; if (!b.destroyed) ctx.fillRect(x + (b.x + b.radius) * s, y + (b.y + b.radius) * s, 2, 2); }
        // Trees
        ctx.fillStyle = CONFIG.minimap.treeColor; for (let i = 0, len = Math.min(trees.length, 80); i < len; i++) { const t = trees[i]; ctx.fillRect(x + (t.x + t.radius) * s, y + (t.y + t.radius) * s, 2, 2); }
        // Pickups (limit to 60)
        for (let i = 0, len = Math.min(pickups.length, 60); i < len; i++) {
            const p = pickups[i];
            if (!p.active) continue;
            ctx.fillStyle = p.type === 'health' ? CONFIG.minimap.pickupHealthColor : p.type === 'stamina' ? CONFIG.minimap.pickupStaminaColor : CONFIG.minimap.pickupAmmoColor;
            ctx.fillRect(x + p.x * s, y + p.y * s, 2, 2);
        }
        // Enemies (limit to 80)
        ctx.fillStyle = CONFIG.minimap.enemyColor; for (let i = 0, len = Math.min(enemies.length, 80); i < len; i++) { const e = enemies[i]; if (e.active && !e.isDying) ctx.fillRect(x + e.x * s, y + e.y * s, 3, 3); }
        // Player
        const px = x + player.x * s, py = y + player.y * s;
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
    render(ctx, game) {
        const sw = (game && game.screenWidth) || window.innerWidth || ctx.canvas.width;
        const sh = (game && game.screenHeight) || window.innerHeight || ctx.canvas.height;
        // Position kill feed below minimap to avoid overlap
        const showMinimap = game && game.persistence && game.persistence.data.settings.showMinimap;
        const mmSize = showMinimap ? Math.floor(Math.min(CONFIG.minimap.size, sw * 0.18)) : 0;
        const mmMargin = showMinimap ? Math.floor(CONFIG.minimap.margin * Math.min(1, sw / 1200)) : 0;
        const x = sw - Math.min(220, sw * 0.25);
        const y = showMinimap ? mmMargin + mmSize + 12 : Math.min(80, sh * 0.1);
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
// GAME STATE MANAGER - Phase 6 with full menu system and shop
// ============================================================
class GameStateManager {
    constructor() {
        this.state = 'menu'; this.menuSelection = 0;
        this.menuItems = ['Play Solo', 'Play Online', 'Shop', 'Achievements', 'Leaderboard', 'Help', 'Settings'];
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
        // Shop state (Phase 6)
        this.shopSelection = 0;
        this.shopCategory = 0; // 0=Upgrades, 1=Pets, 2=Drones, 3=Teammates
        this.shopCategories = ['Upgrades', 'Pets', 'Drones', 'Teammates', 'Weapons'];
        this.shopScroll = 0;
        // Achievements (Phase 6)
        this.achievementsSelection = 0;
        this.achievementsScroll = 0;
        this.missionScroll = 0;
        // Daily challenge
        this.dailyChallenge = null;
        this.showDailyBanner = false;
        // Phase 7: Weapon shop
        this.weaponShopOpen = false;
        this.weaponShopSelection = 0;
        this.weaponShopScroll = 0;
    }

    update(dt, input, game) {
        const sw = game.screenWidth || 800, sh = game.screenHeight || 600;
        if (this.state === 'menu') {
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) { this.menuSelection = (this.menuSelection - 1 + this.menuItems.length) % this.menuItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) { this.menuSelection = (this.menuSelection + 1) % this.menuItems.length; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('Enter') || input.justPressed('Space')) {
                game.soundManager.playSound('menuSelect');
                switch (this.menuSelection) {
                    case 0: this.state = 'missions'; this.missionSelection = 0; break;
                    case 1: this.state = 'online'; this.onlineSelection = 0; break;
                    case 2: this.state = 'shop'; this.shopSelection = 0; this.shopCategory = 0; break;
                    case 3: this.state = 'achievements'; this.achievementsSelection = 0; break;
                    case 4: this.state = 'leaderboard'; this._fetchLeaderboard(game); break;
                    case 5: this.state = 'tutorial'; break;
                    case 6: this.state = 'settings'; this.settingsSelection = 0; break;
                }
            }
            // Touch: menu items — match render layout
            const touchTopY = sh * 0.1 + Math.min(56, sw * 0.06) * 0.7 + 44;
            const touchBottomY = sh - 110;
            const touchSpacing = Math.min(56, (touchBottomY - touchTopY) / this.menuItems.length);
            const touchStartY = touchTopY + ((touchBottomY - touchTopY) - touchSpacing * this.menuItems.length) / 2;
            const tapIdx = this._touchTap(input, sw, touchStartY, touchSpacing, this.menuItems.length);
            if (tapIdx >= 0) {
                this.menuSelection = tapIdx;
                game.soundManager.playSound('menuSelect');
                switch (tapIdx) {
                    case 0: this.state = 'missions'; this.missionSelection = 0; break;
                    case 1: this.state = 'online'; this.onlineSelection = 0; break;
                    case 2: this.state = 'shop'; this.shopSelection = 0; this.shopCategory = 0; break;
                    case 3: this.state = 'achievements'; this.achievementsSelection = 0; break;
                    case 4: this.state = 'leaderboard'; this._fetchLeaderboard(game); break;
                    case 5: this.state = 'tutorial'; break;
                    case 6: this.state = 'settings'; this.settingsSelection = 0; break;
                }
            }
        } else if (this.state === 'missions') {
            // Helper to find next/prev unlocked mission
            const findUnlocked = (dir) => {
                let idx = this.missionSelection;
                for (let i = 0; i < this.missions.length; i++) {
                    idx = (idx + dir + this.missions.length) % this.missions.length;
                    if (this._isMissionUnlocked(this.missions[idx], game)) return idx;
                }
                return this.missionSelection;
            };
            if (input.justPressed('ArrowLeft') || input.justPressed('KeyA')) { this.missionSelection = findUnlocked(-1); game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) { this.missionSelection = findUnlocked(1); game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) { this.missionSelection = findUnlocked(-1); game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) { this.missionSelection = findUnlocked(1); game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('Enter') || input.justPressed('Space')) {
                game.soundManager.playSound('menuSelect');
                if (this.missionSelection < this.missions.length) {
                    const mission = this.missions[this.missionSelection];
                    if (!this._isMissionUnlocked(mission, game)) {
                        game.soundManager.playSound('menuNavigate'); // Deny sound
                        return;
                    }
                    game.loadMission(mission.id);
                } else {
                    game.startEndless();
                }
                // Phase 7: Go to loadout screen
                this.state = 'loadout';
                this.loadoutSelection = 0;
                // Initialize loadout weapons (slot 0 = pistol always)
                if (!this.loadoutWeapons) this.loadoutWeapons = [0, -1]; // -1 = empty
                this.joinDailyChallenge = false; // Reset daily challenge checkbox
            }
            if (input.justPressed('Escape')) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
            // Touch: mission cards — match render layout
            if (input.isMobile) {
                const smallScreen = sw < 600;
                const totalCards = this.missions.length + 1;
                const cardW = smallScreen ? Math.min(sw - 40, 360) : Math.min(260, (sw - 80) / Math.min(4, totalCards));
                const cardPad = smallScreen ? 8 : Math.max(10, cardW * 0.06);
                const cardH = smallScreen ? 120 : Math.min(220, sh * 0.42);
                for (const [, touch] of Object.entries(input.touches)) {
                    if (touch.startY === undefined) continue;
                    if (Math.abs(touch.y - touch.startY) < 10 && Math.abs(touch.x - touch.startX) < 10) {
                        if (smallScreen) {
                            // Vertical layout
                            const listTopY = 80;
                            const scrollOff = (this._missionScrollTarget || 0) * (cardH + cardPad);
                            for (let i = 0; i < totalCards; i++) {
                                const iy = listTopY + i * (cardH + cardPad) - scrollOff;
                                const cardX = (sw - cardW) / 2;
                                if (touch.x >= cardX && touch.x < cardX + cardW && touch.y >= iy && touch.y < iy + cardH) {
                                    this.missionSelection = i;
                                    if (i < this.missions.length) { game.loadMission(this.missions[i].id); game.startGame(); } else { game.startEndless(); }
                                    this.state = 'deploying'; this._deployTimer = 0; this._deployPhase = 'flyin';
                                    game.soundManager.playSound('menuSelect');
                                    break;
                                }
                            }
                        } else {
                            // Horizontal layout with scroll
                            const scrollX = this._missionScrollX || 0;
                            const baseX = 20 - scrollX;
                            const cy = sh / 2 - cardH / 2 - 20;
                            for (let i = 0; i < totalCards; i++) {
                                const cx = baseX + i * (cardW + cardPad);
                                if (touch.x >= cx && touch.x < cx + cardW && touch.y >= cy && touch.y < cy + cardH) {
                                    this.missionSelection = i;
                                    if (i < this.missions.length) { game.loadMission(this.missions[i].id); game.startGame(); } else { game.startEndless(); }
                                    this.state = 'deploying'; this._deployTimer = 0; this._deployPhase = 'flyin';
                                    game.soundManager.playSound('menuSelect');
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        } else if (this.state === 'loadout') {
            // Phase 7: Weapon loadout selection before mission
            const ownedWeapons = this._getOwnedWeapons(game);
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) {
                this.loadoutSelection = Math.max(0, this.loadoutSelection - 1);
                game.soundManager.playSound('menuNavigate');
            }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) {
                this.loadoutSelection = Math.min(ownedWeapons.length - 1, this.loadoutSelection + 1);
                game.soundManager.playSound('menuNavigate');
            }
            // Toggle daily challenge with Left/Right arrows
            if (input.justPressed('ArrowLeft') || input.justPressed('ArrowRight') || input.justPressed('KeyA') || input.justPressed('KeyD')) {
                this.joinDailyChallenge = !this.joinDailyChallenge;
                game.soundManager.playSound('menuSelect');
            }
            if (input.justPressed('Enter') || input.justPressed('Space')) {
                // Toggle weapon in loadout
                const wpn = ownedWeapons[this.loadoutSelection];
                if (wpn) {
                    const wpnIdx = wpn.weaponIndex;
                    if (this.loadoutWeapons[0] === wpnIdx || this.loadoutWeapons[1] === wpnIdx) {
                        // Remove from loadout
                        if (this.loadoutWeapons[0] === wpnIdx) this.loadoutWeapons[0] = -1;
                        if (this.loadoutWeapons[1] === wpnIdx) this.loadoutWeapons[1] = -1;
                    } else {
                        // Add to first empty slot
                        if (this.loadoutWeapons[0] === -1) this.loadoutWeapons[0] = wpnIdx;
                        else if (this.loadoutWeapons[1] === -1) this.loadoutWeapons[1] = wpnIdx;
                        else {
                            // Replace second slot
                            this.loadoutWeapons[1] = wpnIdx;
                        }
                    }
                    // Ensure pistol is always in slot 0
                    if (this.loadoutWeapons[0] === -1 && this.loadoutWeapons[1] !== -1) {
                        this.loadoutWeapons[0] = this.loadoutWeapons[1];
                        this.loadoutWeapons[1] = -1;
                    }
                }
                game.soundManager.playSound('menuSelect');
            }
            if (input.justPressed('Escape')) { this.state = 'missions'; game.soundManager.playSound('menuSelect'); }
            if (input.justPressed('KeyB')) {
                // Back to missions and start
                if (this.missionSelection < this.missions.length) {
                    const mission = this.missions[this.missionSelection];
                    game.loadMission(mission.id);
                    game.startGame(this.loadoutWeapons, this.joinDailyChallenge);
                } else {
                    game.startEndless(this.loadoutWeapons, this.joinDailyChallenge);
                }
                this.state = 'deploying';
                this._deployTimer = 0;
                this._deployPhase = 'flyin';
                game.soundManager.playSound('menuSelect');
            }
        } else if (this.state === 'deploying') {
            // Helicopter deployment animation — auto-advances to 'playing'
            this._deployTimer = (this._deployTimer || 0) + dt;
            if (this._deployTimer > 4.0) {
                this.state = 'playing';
            }
        } else if (this.state === 'playing') {
            // Phase 7: Weapon shop navigation
            if (this.weaponShopOpen) {
                const shopWeapons = CONFIG.weapons.filter(w => w.cost && w.cost > 0);
                if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) {
                    this.weaponShopSelection = Math.max(0, this.weaponShopSelection - 1);
                    game.soundManager.playSound('menuNavigate');
                }
                if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) {
                    this.weaponShopSelection = Math.min(shopWeapons.length - 1, this.weaponShopSelection + 1);
                    game.soundManager.playSound('menuNavigate');
                }
                if (input.justPressed('Enter') || input.justPressed('Space')) {
                    const wpn = shopWeapons[this.weaponShopSelection];
                    if (wpn && game.persistence.data.coins >= wpn.cost) {
                        const wpnIdx = game.player.weapons.findIndex(w => w.name === wpn.name);
                        if (wpnIdx >= 0) {
                            game.player.pickupWeapon(wpnIdx, game);
                        } else {
                            // Create a new weapon instance
                            const newWpn = { ...CONFIG.weapons[wpn.id || CONFIG.weapons.indexOf(wpn)] || wpn };
                            game.player.weapons.push(newWpn);
                            game.player.pickupWeapon(game.player.weapons.length - 1, game);
                        }
                        game.persistence.data.coins -= wpn.cost;
                        game.persistence.data.totalCoinsEarned = (game.persistence.data.totalCoinsEarned || 0);
                        game.persistence.save();
                        game.soundManager.playSound('menuSelect');
                    }
                }
                if (input.justPressed('Escape')) {
                    this.weaponShopOpen = false;
                    game.soundManager.playSound('menuSelect');
                }
            } else {
                if (input.justPressed('Escape')) { this.state = 'paused'; game.soundManager.playSound('menuSelect'); }
            }
        } else if (this.state === 'paused') {
            if (input.justPressed('Escape')) { this.state = 'playing'; game.soundManager.playSound('menuSelect'); }
            if (input.justPressed('KeyQ')) { this._termState = null; this.state = 'menu'; game.resetGame(); game.soundManager.playSound('menuSelect'); }
        } else if (this.state === 'gameover') {
            if (!this.submitted) {
                // Name input
                if (input.justPressed('Enter')) {
                    if (this.nameInput.length > 0) game.persistence.setPlayerName(this.nameInput);
                    this._submitScore(game);
                }
                if (input.justPressed('Escape')) { this.submitted = true; this.submitResult = { skipped: true }; }
            } else {
                if (input.justPressed('KeyR') || input.justPressed('Enter')) { this._termState = null; this.state = 'menu'; game.resetGame(); game.soundManager.playSound('menuSelect'); }
                if (input.justPressed('KeyL')) { this.state = 'leaderboard'; this._fetchLeaderboard(game); }
            }
        }
        else if (this.state === 'tutorial') {
            if (input.justPressed('Escape') || input.justPressed('Enter') || input.justPressed('Space')) {
                this.state = 'menu';
                game.soundManager.playSound('menuSelect');
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
            // Touch: settings items — match render layout
            if (input.isMobile) {
                const itemSpacing = Math.min(50, (sh - 160) / this.settingsItems.length);
                const startY = 120;
                for (const [, touch] of Object.entries(input.touches)) {
                    if (touch.startY === undefined) continue;
                    if (Math.abs(touch.y - touch.startY) >= 10) continue;
                    if (touch.x > sw * 0.1 && touch.x < sw * 0.9) {
                        for (let i = 0; i < this.settingsItems.length; i++) {
                            const y = startY + i * itemSpacing;
                            if (touch.y >= y - 14 && touch.y < y + 16) {
                                this.settingsSelection = i;
                                if (i === this.settingsItems.length - 1) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
                                else if (i === 8) { this.nameInputActive = true; this.nameInput = game.persistence.data.playerName; }
                                else { this._adjustSetting(game, 1); }
                                break;
                            }
                        }
                    }
                }
            }
        } else if (this.state === 'leaderboard') {
            if (input.justPressed('Escape') || input.justPressed('Enter')) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
        } else if (this.state === 'shop') {
            const cats = this.shopCategories;
            if (input.justPressed('ArrowLeft') || input.justPressed('KeyA')) { this.shopCategory = (this.shopCategory - 1 + cats.length) % cats.length; this.shopSelection = 0; this.shopScroll = 0; game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) { this.shopCategory = (this.shopCategory + 1) % cats.length; this.shopSelection = 0; this.shopScroll = 0; game.soundManager.playSound('menuNavigate'); }
            const items = this._getShopItems(game);
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) { this.shopSelection = Math.max(0, this.shopSelection - 1); game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) { this.shopSelection = Math.min(items.length - 1, this.shopSelection + 1); game.soundManager.playSound('menuNavigate'); }
            if (input.justPressed('Enter') || input.justPressed('Space')) {
                this._handleShopPurchase(game);
            }
            if (input.justPressed('Escape')) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
            // Touch: shop items and tabs
            if (input.isMobile) {
                const tabW = Math.min(140, (sw - 40) / this.shopCategories.length);
                const tabStartX = sw / 2 - (this.shopCategories.length * tabW) / 2;
                const itemH = sw < 600 ? 70 : 60;
                const listY = 110 + 32 + 15;
                for (const [, touch] of Object.entries(input.touches)) {
                    if (touch.startY === undefined) continue;
                    if (Math.abs(touch.y - touch.startY) >= 10) continue;
                    // Tab taps
                    if (touch.y >= 110 && touch.y < 110 + 32) {
                        for (let i = 0; i < this.shopCategories.length; i++) {
                            const tx = tabStartX + i * tabW;
                            if (touch.x >= tx && touch.x < tx + tabW) {
                                this.shopCategory = i; this.shopSelection = 0; this.shopScroll = 0;
                                game.soundManager.playSound('menuNavigate'); break;
                            }
                        }
                    }
                    // Item taps
                    if (touch.x > sw * 0.1 && touch.x < sw * 0.9) {
                        const scrollOffset = this.shopScroll * itemH;
                        for (let i = 0; i < items.length; i++) {
                            const iy = listY + i * itemH - scrollOffset;
                            if (iy < listY - itemH || iy > sh) continue;
                            if (touch.y >= iy && touch.y < iy + itemH) {
                                this.shopSelection = i;
                                this._handleShopPurchase(game); game.soundManager.playSound('menuSelect'); break;
                            }
                        }
                    }
                }
            }
        } else if (this.state === 'achievements') {
            const total = CONFIG.achievements.length;
            if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) this.achievementsSelection = Math.max(0, this.achievementsSelection - 1);
            if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) this.achievementsSelection = Math.min(total - 1, this.achievementsSelection + 1);
            if (input.justPressed('Escape') || input.justPressed('Enter')) { this.state = 'menu'; game.soundManager.playSound('menuSelect'); }
            // Touch: achievement items
            if (input.isMobile) {
                const itemH = sw < 600 ? 56 : 50;
                const startY = 100;
                const scrollOffset = this.achievementsScroll * itemH;
                for (const [, touch] of Object.entries(input.touches)) {
                    if (touch.startY === undefined) continue;
                    if (Math.abs(touch.y - touch.startY) >= 10) continue;
                    if (touch.x > sw * 0.1 && touch.x < sw * 0.9) {
                        for (let i = 0; i < total; i++) {
                            const iy = startY + i * itemH - scrollOffset;
                            if (iy < startY - itemH || iy > sh) continue;
                            if (touch.y >= iy && touch.y < iy + itemH) { this.achievementsSelection = i; break; }
                        }
                    }
                }
            }
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

    _getScrollOffset(selection, itemH, startY, maxY) {
        const selectedY = startY + selection * itemH;
        const visibleH = maxY - startY;
        if (selectedY > startY + visibleH - itemH) return selectedY - startY - visibleH + itemH;
        if (selectedY < startY) return selectedY - startY;
        return 0;
    }

    _touchTap(input, sw, startY, itemH, count) {
        if (!input.isMobile) return -1;
        for (const [, touch] of Object.entries(input.touches)) {
            if (touch.startY === undefined) continue;
            const dy = Math.abs(touch.y - touch.startY);
            if (dy < 10) {
                for (let i = 0; i < count; i++) {
                    const itemY = startY + i * itemH;
                    if (touch.y >= itemY && touch.y < itemY + itemH && touch.x > sw * 0.1 && touch.x < sw * 0.9) {
                        return i;
                    }
                }
            }
        }
        return -1;
    }

    _getShopItems(game) {
        const cat = this.shopCategory;
        if (cat === 0) return CONFIG.shop.upgrades;
        if (cat === 1) return CONFIG.shop.pets;
        if (cat === 2) return CONFIG.shop.drones;
        if (cat === 3) return CONFIG.shop.teammates || [];
        // Weapons category
        return CONFIG.weapons.filter(w => w.cost > 0).map(w => ({
            id: w.name.toLowerCase().replace(/\s+/g, '_'),
            name: w.name,
            desc: `DMG:${w.damage} | ROF:${Math.round(60000/w.fireRate)} | MAG:${w.magSize}`,
            cost: w.cost,
            icon: w.name[0],
            color: w.bulletColor || '#FFD700',
            tier: w.tier,
            weaponDef: w
        }));
    }

    // Phase 7: Get weapons the player owns (for loadout selection)
    _getOwnedWeapons(game) {
        const purchased = game.persistence.data.purchasedWeapons || [];
        const owned = [];
        for (let i = 0; i < CONFIG.weapons.length; i++) {
            const w = CONFIG.weapons[i];
            if (i === 0 || purchased.includes(w.name.toLowerCase().replace(/\s+/g, '_'))) {
                owned.push({ name: w.name, weaponIndex: i, damage: w.damage, tier: w.tier });
            }
        }
        return owned;
    }

    // Phase 7: Check if a mission is unlocked
    _isMissionUnlocked(mission, game) {
        // Only lock hardest missions (Extreme difficulty with unlockOrder >= 6)
        if (!mission.unlockOrder || mission.unlockOrder < 6) return true;
        const completed = game.persistence.data.missionsCompleted || [];
        const prevOrder = mission.unlockOrder - 1;
        for (const missionId of completed) {
            const prev = this.missions.find(m => m.id === missionId);
            if (prev && prev.unlockOrder === prevOrder) return true;
        }
        return false;
    }

    _handleShopPurchase(game) {
        const items = this._getShopItems(game);
        const item = items[this.shopSelection];
        if (!item) return;
        if (this.shopCategory === 0) {
            // Upgrade
            const currentLevel = game.persistence.data.upgradeLevels[item.id] || 0;
            if (currentLevel >= item.maxLevel) return;
            const cost = item.cost * (currentLevel + 1);
            if (game.persistence.data.coins < cost) return;
            game.persistence.data.coins -= cost;
            game.persistence.data.upgradeLevels[item.id] = currentLevel + 1;
            game.persistence.save();
            game.soundManager.playSound('pickup');
        } else if (this.shopCategory === 4) {
            // Weapons
            if (game.persistence.data.coins < item.cost) return;
            if (!game.persistence.data.purchasedWeapons) game.persistence.data.purchasedWeapons = [];
            const wpnId = item.id;
            if (game.persistence.data.purchasedWeapons.includes(wpnId)) {
                game.soundManager.playSound('menuSelect');
                return;
            }
            game.persistence.data.coins -= item.cost;
            game.persistence.data.purchasedWeapons.push(wpnId);
            game.persistence.save();
            game.soundManager.playSound('pickup');
        } else {
            // Pet, Drone, or Teammate
            if (game.persistence.data.purchasedItems.includes(item.id)) {
                // Toggle equip
                if (this.shopCategory === 1) {
                    game.persistence.data.equippedPet = game.persistence.data.equippedPet === item.id ? null : item.id;
                } else if (this.shopCategory === 2) {
                    game.persistence.data.equippedDrone = game.persistence.data.equippedDrone === item.id ? null : item.id;
                } else if (this.shopCategory === 3) {
                    game.persistence.data.equippedTeammate = game.persistence.data.equippedTeammate === item.id ? null : item.id;
                }
                game.persistence.save();
                game.soundManager.playSound('menuSelect');
            } else {
                // Purchase
                if (game.persistence.data.coins < item.cost) return;
                game.persistence.data.coins -= item.cost;
                game.persistence.data.purchasedItems.push(item.id);
                game.persistence.save();
                game.soundManager.playSound('pickup');
            }
        }
    }

    _renderShop(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const t = performance.now() * 0.001;
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        // Animated grid
        ctx.strokeStyle = 'rgba(255,200,0,0.03)'; ctx.lineWidth = 1;
        const gridOff = (t * 8) % 40;
        for (let x = -40 + gridOff; x < sw + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sh); ctx.stroke(); }
        for (let y = -40 + gridOff; y < sh + 40; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke(); }
        // Responsive sizing
        const titleSize = Math.min(36, sw * 0.05);
        const tabW = Math.min(140, (sw - 40) / this.shopCategories.length);
        const tabH = 32, tabY = 110;
        const tabStartX = sw / 2 - (this.shopCategories.length * tabW) / 2;
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#FFD700';
        ctx.fillText('SHOP', sw / 2, 50);
        // Coin balance
        ctx.font = `bold ${Math.min(18, sw * 0.03)}px "Courier New", monospace`; ctx.fillStyle = '#FFD700';
        ctx.fillText(`$ ${game.persistence.data.coins.toLocaleString()}`, sw / 2, 85);
        // Category tabs
        for (let i = 0; i < this.shopCategories.length; i++) {
            const tx = tabStartX + i * tabW;
            const selected = i === this.shopCategory;
            ctx.fillStyle = selected ? 'rgba(255,200,0,0.2)' : 'rgba(255,255,255,0.05)';
            ctx.fillRect(tx, tabY, tabW, tabH);
            ctx.strokeStyle = selected ? '#FFD700' : '#444'; ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect(tx, tabY, tabW, tabH);
            ctx.font = selected ? `bold ${Math.min(14, tabW * 0.1)}px "Courier New", monospace` : `${Math.min(13, tabW * 0.09)}px "Courier New", monospace`;
            ctx.fillStyle = selected ? '#FFD700' : '#888'; ctx.textAlign = 'center';
            ctx.fillText(this.shopCategories[i], tx + tabW / 2, tabY + tabH / 2);
        }
        // Items list with scroll
        const items = this._getShopItems(game);
        const listY = tabY + tabH + 15;
        const itemH = sw < 600 ? 70 : 60;
        const itemW = Math.min(560, sw - 40);
        const itemX = (sw - itemW) / 2;
        const maxVisible = Math.floor((sh - listY - 60) / itemH);
        const scrollTarget = Math.max(0, this.shopSelection - maxVisible + 2);
        this.shopScroll += (scrollTarget - this.shopScroll) * 0.2;
        const fontSize = Math.min(14, itemW * 0.025);
        const descFontSize = Math.min(11, itemW * 0.02);
        const iconOffset = Math.min(30, itemW * 0.05);
        const textOffset = Math.min(60, itemW * 0.1);
        const rightOffset = Math.min(10, itemW * 0.018);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const selected = i === this.shopSelection;
            const iy = listY + i * itemH - this.shopScroll * itemH;
            if (iy < listY - itemH || iy > sh) continue;
            // Background
            ctx.fillStyle = selected ? 'rgba(255,200,0,0.1)' : 'rgba(20,20,30,0.6)';
            ctx.fillRect(itemX, iy, itemW, itemH - 4);
            ctx.strokeStyle = selected ? '#FFD700' : '#333'; ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect(itemX, iy, itemW, itemH - 4);
            // Icon
            ctx.fillStyle = item.color || '#FFD700';
            ctx.beginPath(); ctx.arc(itemX + iconOffset, iy + (itemH - 4) / 2, 16, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#FFF'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(item.icon || item.name[0], itemX + iconOffset, iy + (itemH - 4) / 2);
            // Name & desc
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.font = `bold ${fontSize}px "Courier New", monospace`; ctx.fillStyle = selected ? '#FFD700' : '#CCC';
            const nameW = ctx.measureText(item.name).width;
            ctx.fillText(item.name, itemX + textOffset, iy + 8);
            ctx.font = `${descFontSize}px "Courier New", monospace`; ctx.fillStyle = '#888';
            ctx.fillText(item.desc, itemX + textOffset, iy + 26);
            // Price/status (dynamic font to avoid overlap)
            ctx.textAlign = 'right';
            if (this.shopCategory === 0) {
                const level = game.persistence.data.upgradeLevels[item.id] || 0;
                const cost = item.cost * (level + 1);
                const lvText = `Lv ${level}/${item.maxLevel}`;
                const maxLvW = itemW - textOffset - nameW - 16;
                const lvFontSize = maxLvW < ctx.measureText(lvText).width ? Math.max(8, descFontSize - 1) : descFontSize + 1;
                ctx.font = `${lvFontSize}px "Courier New", monospace`;
                ctx.fillStyle = '#888'; ctx.fillText(lvText, itemX + itemW - rightOffset, iy + 8);
                if (level < item.maxLevel) {
                    const costText = `$ ${cost}`;
                    const costFontSize = maxLvW < ctx.measureText(costText).width ? Math.max(9, descFontSize) : descFontSize + 2;
                    ctx.fillStyle = game.persistence.data.coins >= cost ? '#00FF88' : '#FF4444';
                    ctx.font = `bold ${costFontSize}px "Courier New", monospace`;
                    ctx.fillText(costText, itemX + itemW - rightOffset, iy + 26);
                } else {
                    ctx.fillStyle = '#00CCFF'; ctx.font = `bold ${Math.max(9, descFontSize + 2)}px "Courier New", monospace`;
                    ctx.fillText('MAX', itemX + itemW - rightOffset, iy + 26);
                }
} else {
                const isWeaponCat = this.shopCategory === 4;
                const owned = isWeaponCat
                    ? (game.persistence.data.purchasedWeapons && game.persistence.data.purchasedWeapons.includes(item.id))
                    : game.persistence.data.purchasedItems.includes(item.id);
                const equipped = !isWeaponCat && (this.shopCategory === 1 ? game.persistence.data.equippedPet === item.id : this.shopCategory === 2 ? game.persistence.data.equippedDrone === item.id : this.shopCategory === 3 ? game.persistence.data.equippedTeammate === item.id : false);
                const maxStatusW = itemW - textOffset - nameW - 16;
                if (owned) {
                    const statusText = equipped ? 'EQUIPPED' : (isWeaponCat ? 'UNLOCKED' : 'OWNED');
                    const sf = maxStatusW < ctx.measureText(statusText).width ? Math.max(9, descFontSize) : descFontSize + 2;
                    ctx.fillStyle = equipped ? '#00FF88' : '#00CCFF';
                    ctx.font = `bold ${sf}px "Courier New", monospace`;
                    ctx.fillText(statusText, itemX + itemW - rightOffset, iy + 18);
                } else {
                    const costText = `$ ${item.cost}`;
                    const sf = maxStatusW < ctx.measureText(costText).width ? Math.max(9, descFontSize) : descFontSize + 2;
                    ctx.fillStyle = game.persistence.data.coins >= item.cost ? '#00FF88' : '#FF4444';
                    ctx.font = `bold ${sf}px "Courier New", monospace`;
                    ctx.fillText(costText, itemX + itemW - rightOffset, iy + 18);
                }
            }
        }
        // Controls
        ctx.textAlign = 'center'; ctx.font = `${Math.min(12, sw * 0.02)}px "Courier New", monospace`; ctx.fillStyle = '#555';
        const actionText = this.shopCategory === 0 ? 'Enter to Upgrade' : 'Enter to Buy/Equip';
        ctx.fillText(`A/D tabs | W/S select | ${actionText} | ESC back`, sw / 2, sh - 30);
    }

    _renderAchievements(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const t = performance.now() * 0.001;
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        // Animated grid
        ctx.strokeStyle = 'rgba(255,200,0,0.03)'; ctx.lineWidth = 1;
        const gridOff = (t * 8) % 40;
        for (let x = -40 + gridOff; x < sw + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sh); ctx.stroke(); }
        for (let y = -40 + gridOff; y < sh + 40; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke(); }
        // Responsive sizing
        const titleSize = Math.min(36, sw * 0.05);
        const itemH = sw < 600 ? 56 : 50;
        const itemW = Math.min(560, sw - 40);
        const itemX = (sw - itemW) / 2;
        const startY = 100;
        const maxVisible = Math.floor((sh - startY - 50) / itemH);
        const scrollTarget = Math.max(0, this.achievementsSelection - maxVisible + 2);
        this.achievementsScroll += (scrollTarget - this.achievementsScroll) * 0.2;
        const fontSize = Math.min(14, itemW * 0.025);
        const descFontSize = Math.min(11, itemW * 0.02);
        const iconOffset = Math.min(30, itemW * 0.05);
        const textOffset = Math.min(60, itemW * 0.1);
        const rightOffset = Math.min(10, itemW * 0.018);
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#FFD700';
        ctx.fillText('ACHIEVEMENTS', sw / 2, 50);
        // Progress
        const unlocked = game.persistence.data.achievementsUnlocked || [];
        const total = CONFIG.achievements.length;
        ctx.font = `${Math.min(14, sw * 0.022)}px "Courier New", monospace`; ctx.fillStyle = '#888';
        ctx.fillText(`${unlocked.length} / ${total} Unlocked`, sw / 2, 80);
        // Achievement list with scroll
        for (let i = 0; i < CONFIG.achievements.length; i++) {
            const a = CONFIG.achievements[i];
            const selected = i === this.achievementsSelection;
            const isUnlocked = unlocked.includes(a.id);
            const iy = startY + i * itemH - this.achievementsScroll * itemH;
            if (iy < startY - itemH || iy > sh) continue;
            // Background
            ctx.fillStyle = selected ? 'rgba(255,200,0,0.1)' : 'rgba(20,20,30,0.6)';
            ctx.fillRect(itemX, iy, itemW, itemH - 4);
            ctx.strokeStyle = selected ? '#FFD700' : (isUnlocked ? '#444' : '#222'); ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect(itemX, iy, itemW, itemH - 4);
            // Icon
            ctx.fillStyle = isUnlocked ? '#FFD700' : '#444';
            ctx.beginPath(); ctx.arc(itemX + iconOffset, iy + (itemH - 4) / 2, 14, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = isUnlocked ? '#000' : '#666'; ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(a.icon, itemX + iconOffset, iy + (itemH - 4) / 2);
            // Name & desc
            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
            ctx.font = `bold ${fontSize}px "Courier New", monospace`;
            ctx.fillStyle = isUnlocked ? '#FFD700' : '#666';
            const nameWidth = ctx.measureText(a.name).width;
            ctx.fillText(a.name, itemX + textOffset, iy + 8);
            ctx.font = `${descFontSize}px "Courier New", monospace`; ctx.fillStyle = isUnlocked ? '#AAA' : '#555';
            ctx.fillText(a.desc, itemX + textOffset, iy + 26);
            // Status (adjust position to avoid overlap)
            ctx.textAlign = 'right';
            const statusText = isUnlocked ? 'UNLOCKED' : 'LOCKED';
            const maxStatusW = itemW - textOffset - nameWidth - 24;
            const statusFontSize = maxStatusW < ctx.measureText(statusText).width ? Math.max(9, descFontSize - 1) : descFontSize + 1;
            if (isUnlocked) {
                ctx.fillStyle = '#00FF88'; ctx.font = `bold ${statusFontSize}px "Courier New", monospace`;
                ctx.fillText(statusText, itemX + itemW - rightOffset, iy + 18);
            } else {
                ctx.fillStyle = '#555'; ctx.font = `${statusFontSize}px "Courier New", monospace`;
                ctx.fillText(statusText, itemX + itemW - rightOffset, iy + 18);
            }
        }
        // Controls
        ctx.textAlign = 'center'; ctx.font = `${Math.min(12, sw * 0.02)}px "Courier New", monospace`; ctx.fillStyle = '#555';
        ctx.fillText('W/S to browse | ESC to go back', sw / 2, sh - 30);
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
            mode: game.endlessMode ? 'endless' : 'solo',
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
        else if (this.state === 'loadout') this._renderLoadout(ctx, game);
        else if (this.state === 'deploying') this._renderDeploying(ctx, game);
        else if (this.state === 'paused') this._renderPause(ctx, game);
        else if (this.state === 'gameover') this._renderGameOver(ctx, game);
        else if (this.state === 'tutorial') this._renderTutorial(ctx, game);
        else if (this.state === 'settings') this._renderSettings(ctx, game);
        else if (this.state === 'leaderboard') this._renderLeaderboard(ctx, game);
        else if (this.state === 'shop') this._renderShop(ctx, game);
        else if (this.state === 'achievements') this._renderAchievements(ctx, game);
        else if (this.state === 'online') this._renderOnline(ctx, game);
        else if (this.state === 'joinRoom') this._renderJoinRoom(ctx, game);
        else if (this.state === 'waiting') this._renderWaiting(ctx, game);
    }

    _renderMenu(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const t = performance.now() * 0.001;
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        // Animated grid
        ctx.strokeStyle = 'rgba(255,50,50,0.04)'; ctx.lineWidth = 1;
        const gridOffset = (t * 10) % 40;
        for (let x = -40 + gridOffset; x < sw + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sh); ctx.stroke(); }
        for (let y = -40 + gridOffset; y < sh + 40; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke(); }
        // Floating particles
        ctx.fillStyle = 'rgba(255,50,50,0.15)';
        for (let i = 0; i < 20; i++) {
            const px = (sw * 0.1 + (i * 137.5) % (sw * 0.8)) + Math.sin(t + i * 0.7) * 20;
            const py = (sh * 0.1 + (i * 197.3) % (sh * 0.8)) + Math.cos(t * 0.8 + i * 0.5) * 15;
            const s = 2 + Math.sin(t * 2 + i) * 1;
            ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2); ctx.fill();
        }
        // Responsive sizing — compute available space between title and controls
        const titleSize = Math.min(56, sw * 0.06);
        const menuW = Math.min(320, sw * 0.8);
        const topY = sh * 0.1; // Title area starts here
        const bottomY = sh - 50; // Controls hint ends here
        const availH = bottomY - topY;
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`;
        ctx.fillStyle = 'rgba(255,0,0,0.15)'; ctx.fillText('DODGE WARFARE', sw / 2 + 3, topY + 3);
        ctx.fillStyle = '#FF3333'; ctx.fillText('DODGE WARFARE', sw / 2, topY);
        // Subtitle
        const subSize = Math.min(14, sw * 0.025);
        ctx.font = `${subSize}px "Courier New", monospace`; ctx.fillStyle = '#555';
        ctx.fillText(`Phase 6  |  v${CONFIG.version}`, sw / 2, topY + titleSize * 0.7 + 8);
        // Decorative line
        const lineY = topY + titleSize * 0.7 + 24;
        const lineW = Math.min(300, sw * 0.4);
        ctx.strokeStyle = 'rgba(255,50,50,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sw / 2 - lineW / 2, lineY); ctx.lineTo(sw / 2 + lineW / 2, lineY); ctx.stroke();
        // Calculate menu layout — items fit between lineY+20 and bottomY-60
        const menuTopY = lineY + 20;
        const menuBottomY = bottomY - 60; // Leave room for stats + controls
        const totalMenuH = menuBottomY - menuTopY;
        const itemSpacing = Math.min(56, totalMenuH / this.menuItems.length);
        const menuStartY = menuTopY + (totalMenuH - itemSpacing * this.menuItems.length) / 2;
        // Menu items
        for (let i = 0; i < this.menuItems.length; i++) {
            const selected = i === this.menuSelection;
            const y = menuStartY + i * itemSpacing;
            if (selected) {
                const selPulse = 0.7 + Math.sin(t * 4) * 0.3;
                ctx.fillStyle = `rgba(255,50,50,${0.08 * selPulse})`; ctx.fillRect(sw / 2 - menuW / 2, y - 16, menuW, 34);
                ctx.strokeStyle = `rgba(255,50,50,${0.6 * selPulse})`; ctx.lineWidth = 1; ctx.strokeRect(sw / 2 - menuW / 2, y - 16, menuW, 34);
                ctx.fillStyle = '#FF3333'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'right';
                ctx.fillText('>', sw / 2 - menuW / 2 - 5, y + 1);
                ctx.textAlign = 'center';
            }
            const fontSize = selected ? Math.min(22, sw * 0.035) : Math.min(20, sw * 0.03);
            ctx.font = selected ? `bold ${fontSize}px "Courier New", monospace` : `${fontSize}px "Courier New", monospace`;
            ctx.fillStyle = selected ? '#FF5555' : '#777';
            ctx.fillText(this.menuItems[i], sw / 2, y);
        }
        // Stats — below menu items, above controls
        const statsY = menuStartY + this.menuItems.length * itemSpacing + 20;
        if (game && game.persistence && game.persistence.data.highScore > 0) {
            ctx.font = `${Math.min(12, sw * 0.02)}px "Courier New", monospace`; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
            ctx.fillText(`High Score: ${game.persistence.data.highScore}  |  Best Wave: ${game.persistence.data.bestWave}`, sw / 2, statsY);
        }
        if (game && game.persistence) {
            ctx.font = `${Math.min(13, sw * 0.022)}px "Courier New", monospace`; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
            ctx.fillText(`Coins: $ ${game.persistence.data.coins.toLocaleString()}`, sw / 2, statsY + 18);
        }
        // Controls hint
        ctx.font = `${Math.min(11, sw * 0.018)}px "Courier New", monospace`; ctx.fillStyle = '#444';
        ctx.fillText('Navigate & Select  |  Touch or Keyboard', sw / 2, sh - 30);
    }

    _renderMissions(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const t = performance.now() * 0.001;
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        // Animated grid
        ctx.strokeStyle = 'rgba(0,150,255,0.03)'; ctx.lineWidth = 1;
        const gridOff = (t * 8) % 40;
        for (let x = -40 + gridOff; x < sw + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sh); ctx.stroke(); }
        for (let y = -40 + gridOff; y < sh + 40; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke(); }
        // Responsive sizing
        const titleSize = Math.min(36, sw * 0.05);
        const totalCards = this.missions.length + 1;
        const smallScreen = sw < 600;
        const cardW = smallScreen ? Math.min(sw - 40, 360) : Math.min(260, (sw - 80) / Math.min(4, totalCards));
        const cardH = smallScreen ? 120 : Math.min(220, sh * 0.42);
        const cardPad = smallScreen ? 8 : Math.max(10, cardW * 0.06);
        const cardFont = Math.max(9, Math.min(11, cardW * 0.045));
        const cardTitleFont = Math.max(12, Math.min(16, cardW * 0.065));
        // Title
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#00CCFF';
        ctx.fillText('SELECT MISSION', sw / 2, smallScreen ? 40 : 60);
        // Daily challenge banner
        const dailyOffset = smallScreen ? 18 : 30;
        if (game.persistence) {
            const daily = game.persistence.getDailyChallenge ? game.persistence.getDailyChallenge() : null;
            if (daily) {
                ctx.font = `${Math.min(13, sw * 0.022)}px "Courier New", monospace`; ctx.fillStyle = '#FF8800'; ctx.textAlign = 'center';
                ctx.fillText(`Daily: ${daily.name} - ${daily.desc}`, sw / 2, (smallScreen ? 40 : 60) + dailyOffset);
            }
        }
        const themeColors = { urban: '#8B7355', desert: '#C2B280', forest: '#5A7247', industrial: '#6A6A6A', storm: '#4A4A6A', snow: '#B0C4DE', volcano: '#8B2500', training: '#5A8247' };
        const diffColors = { Normal: '#4CAF50', Hard: '#FF9800', Extreme: '#F44336' };

        if (smallScreen) {
            // Vertical scrollable card layout for small screens
            const listTopY = 80;
            const listBottomY = sh - 50;
            const visibleH = listBottomY - listTopY;
            const maxVisible = Math.floor(visibleH / (cardH + cardPad));
            const scrollTarget = Math.max(0, Math.min(this.missionSelection - Math.floor(maxVisible / 2), totalCards - maxVisible));
            if (this._missionScrollTarget === undefined) this._missionScrollTarget = 0;
            this._missionScrollTarget += (scrollTarget - this._missionScrollTarget) * 0.2;
            const scrollOffset = this._missionScrollTarget * (cardH + cardPad);
            const cardX = (sw - cardW) / 2;

            for (let i = 0; i < totalCards; i++) {
                const selected = i === this.missionSelection;
                const cy = listTopY + i * (cardH + cardPad) - scrollOffset;
                if (cy + cardH < listTopY - cardH || cy > listBottomY + cardH) continue;

                if (i < this.missions.length) {
                    const m = this.missions[i];
                    const isUnlocked = this._isMissionUnlocked(m, game);
                    ctx.fillStyle = selected ? 'rgba(0,100,180,0.25)' : isUnlocked ? 'rgba(20,20,30,0.8)' : 'rgba(30,30,30,0.6)';
                    ctx.fillRect(cardX, cy, cardW, cardH);
                    ctx.strokeStyle = selected ? '#00CCFF' : isUnlocked ? '#333' : '#222'; ctx.lineWidth = selected ? 2 : 1;
                    ctx.strokeRect(cardX, cy, cardW, cardH);
                    ctx.fillStyle = themeColors[m.theme] || '#555';
                    ctx.fillRect(cardX, cy, cardW, 3);
                    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                    ctx.font = `bold ${cardTitleFont}px "Courier New", monospace`;
                    ctx.fillStyle = selected ? '#00CCFF' : isUnlocked ? '#CCC' : '#666';
                    ctx.fillText(m.name, cardX + 10, cy + 10);
                    ctx.font = `${cardFont}px "Courier New", monospace`;
                    ctx.fillStyle = diffColors[m.difficulty] || '#888';
                    ctx.fillText(m.difficulty, cardX + 10, cy + 10 + cardTitleFont + 2);
                    ctx.font = `${Math.max(8, cardFont - 1)}px "Courier New", monospace`; ctx.fillStyle = '#666'; ctx.textAlign = 'left';
                    const waveInfo = `Waves: ${m.waves} | ${m.worldSize}x${m.worldSize} | ${m.theme}`;
                    const bossText = `Boss: W${m.bossWave}`;
                    const availW = cardW - 20;
                    const waveInfoW = ctx.measureText(waveInfo).width;
                    const bossW = ctx.measureText(bossText).width;
                    if (waveInfoW + bossW + 8 > availW) {
                        const combinedRatio = availW / (waveInfoW + bossW + 8);
                        const infoFs = Math.max(7, Math.floor(Math.max(8, cardFont - 1) * combinedRatio * 0.9));
                        ctx.font = `${infoFs}px "Courier New", monospace`;
                    }
                    ctx.fillText(waveInfo, cardX + 10, cy + cardH - 28);
                    ctx.fillStyle = '#FF4444'; ctx.textAlign = 'right';
                    ctx.fillText(bossText, cardX + cardW - 10, cy + cardH - 28);
                    ctx.textAlign = 'left'; ctx.fillStyle = '#555';
                    let enemyTxt = `Enemies: ${m.enemyTypes.join(', ')}`;
                    ctx.font = `${Math.max(8, cardFont - 1)}px "Courier New", monospace`;
                    const eAvail = cardW - 20;
                    if (ctx.measureText(enemyTxt).width > eAvail) {
                        ctx.font = `${Math.max(6, cardFont - 2)}px "Courier New", monospace`;
                        if (ctx.measureText(enemyTxt).width > eAvail) {
                            while (ctx.measureText(enemyTxt + '\u2026').width > eAvail && enemyTxt.length > 10) {
                                enemyTxt = enemyTxt.slice(0, -1);
                            }
                            enemyTxt += '\u2026';
                        }
                    }
                    ctx.fillText(enemyTxt, cardX + 10, cy + cardH - 14);
                    // Lock indicator for locked missions
                    if (!isUnlocked) {
                        ctx.fillStyle = 'rgba(0,0,0,0.5)';
                        ctx.fillRect(cardX, cy, cardW, cardH);
                        ctx.font = `bold ${cardTitleFont + 4}px "Courier New", monospace`;
                        ctx.fillStyle = '#888'; ctx.textAlign = 'center';
                        ctx.fillText('🔒', cardX + cardW / 2, cy + cardH / 2 - 10);
                        ctx.font = `${Math.max(8, cardFont)}px "Courier New", monospace`;
                        ctx.fillText('Complete previous mission', cardX + cardW / 2, cy + cardH / 2 + 15);
                        ctx.textAlign = 'left';
                    }
                } else {
                    // Endless Run card
                    ctx.fillStyle = selected ? 'rgba(0,255,200,0.15)' : 'rgba(20,20,30,0.85)';
                    ctx.fillRect(cardX, cy, cardW, cardH);
                    ctx.strokeStyle = selected ? '#00FFCC' : '#333'; ctx.lineWidth = selected ? 2 : 1;
                    ctx.strokeRect(cardX, cy, cardW, cardH);
                    ctx.fillStyle = '#00FFCC'; ctx.fillRect(cardX, cy, cardW, 3);
                    ctx.font = `bold ${cardTitleFont}px "Courier New", monospace`; ctx.fillStyle = selected ? '#00FFCC' : '#CCC';
                    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                    ctx.fillText('Endless Run', cardX + 10, cy + 10);
                    ctx.font = `${cardFont}px "Courier New", monospace`; ctx.fillStyle = '#888';
                    ctx.fillText('Survive as long as you can. Enemies get harder.', cardX + 10, cy + 10 + cardTitleFont + 4);
                    ctx.font = `bold ${cardFont + 1}px "Courier New", monospace`; ctx.fillStyle = '#FF8800';
                    ctx.fillText('INFINITE', cardX + 10, cy + cardH - 20);
                    ctx.font = `${Math.max(20, Math.min(28, cardW * 0.1))}px sans-serif`; ctx.fillStyle = selected ? '#00FFCC' : '#444';
                    ctx.textAlign = 'right';
                    ctx.fillText('\u221E', cardX + cardW - 10, cy + cardH - 24);
                }
            }
        } else {
            // Horizontal card layout for wider screens — with scrolling
            const totalCards = this.missions.length + 1;
            const totalCardsW = totalCards * (cardW + cardPad) - cardPad;
            const viewW = sw - 40;
            const cy = sh / 2 - cardH / 2 - 20;
            // Smooth scroll to keep selected card visible
            const selCenter = this.missionSelection * (cardW + cardPad) + cardW / 2;
            const scrollTarget = Math.max(0, Math.min(totalCardsW - viewW, selCenter - viewW / 2));
            if (this._missionScrollX === undefined) this._missionScrollX = 0;
            this._missionScrollX += (scrollTarget - this._missionScrollX) * 0.15;
            const baseX = 20 - this._missionScrollX;
            // Clip to view area
            ctx.save();
            ctx.beginPath(); ctx.rect(20, cy - 4, viewW, cardH + 8); ctx.clip();
            for (let i = 0; i < this.missions.length; i++) {
                const m = this.missions[i];
                const selected = i === this.missionSelection;
                const cx = baseX + i * (cardW + cardPad);
                // Card background
                ctx.fillStyle = selected ? 'rgba(0,100,180,0.25)' : 'rgba(20,20,30,0.8)';
                ctx.fillRect(cx, cy, cardW, cardH);
                ctx.strokeStyle = selected ? '#00CCFF' : '#333';
                ctx.lineWidth = selected ? 2 : 1;
                ctx.strokeRect(cx, cy, cardW, cardH);
                // Theme color accent bar
                ctx.fillStyle = themeColors[m.theme] || '#555';
                ctx.fillRect(cx, cy, cardW, 4);
                // Mission info
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                // Name
                ctx.font = `bold ${cardTitleFont}px "Courier New", monospace`;
                ctx.fillStyle = selected ? '#00CCFF' : '#CCC';
                ctx.fillText(m.name, cx + 12, cy + 14);
                // Difficulty
                ctx.font = `${cardFont}px "Courier New", monospace`;
                ctx.fillStyle = diffColors[m.difficulty] || '#888';
                ctx.fillText(m.difficulty, cx + 12, cy + 14 + cardTitleFont + 4);
                // Description — clip to avoid overlapping stats
                ctx.font = `${cardFont}px "Courier New", monospace`; ctx.fillStyle = '#888';
                const words = m.description.split(' ');
                const descStartY = cy + 56;
                const lineHeight = cardFont + 3;
                const statsStartY = cy + cardH - 56;
                const maxDescLines = Math.max(1, Math.floor((statsStartY - descStartY) / lineHeight));
                let line = '', lineY = descStartY, lineCount = 0;
                for (const word of words) {
                    const test = line + word + ' ';
                    if (ctx.measureText(test).width > cardW - 24 && line) {
                        if (lineCount < maxDescLines) {
                            ctx.fillText(line.trim(), cx + 12, lineY);
                            lineY += lineHeight; lineCount++;
                        }
                        line = word + ' ';
                    } else { line = test; }
                }
                if (line && lineCount < maxDescLines) ctx.fillText(line.trim(), cx + 12, lineY);
                // Stats — fixed positions with clear spacing
                let statFont = Math.max(8, cardFont - 1);
                const statLineH = statFont + 4;
                ctx.font = `${statFont}px "Courier New", monospace`; ctx.fillStyle = '#666';
                ctx.textAlign = 'left';
                const wavesText = `Waves: ${m.waves}`;
                const bossText = `Boss: W${m.bossWave}`;
                const bossW = ctx.measureText(bossText).width;
                const statAvailW = cardW - 24;
                if (ctx.measureText(wavesText).width + bossW + 8 > statAvailW) {
                    statFont = Math.max(7, statFont - 1);
                    ctx.font = `${statFont}px "Courier New", monospace`;
                }
                ctx.fillText(wavesText, cx + 12, statsStartY);
                ctx.fillText(`Map: ${m.worldSize}x${m.worldSize}`, cx + 12, statsStartY + statLineH);
                ctx.fillText(`Theme: ${m.theme}`, cx + 12, statsStartY + statLineH * 2);
                // Boss indicator
                ctx.fillStyle = '#FF4444';
                ctx.textAlign = 'right';
                ctx.fillText(bossText, cx + cardW - 12, statsStartY);
                ctx.textAlign = 'left';
                // Enemy types
                ctx.fillStyle = '#555';
                let enemyFont = Math.max(8, cardFont - 2);
                let enemyText = `Enemies: ${m.enemyTypes.join(', ')}`;
                ctx.font = `${enemyFont}px "Courier New", monospace`;
                if (ctx.measureText(enemyText).width > statAvailW) {
                    enemyFont = Math.max(6, enemyFont - 1);
                    ctx.font = `${enemyFont}px "Courier New", monospace`;
                    if (ctx.measureText(enemyText).width > statAvailW) {
                        while (ctx.measureText(enemyText + '\u2026').width > statAvailW && enemyText.length > 10) {
                            enemyText = enemyText.slice(0, -1);
                        }
                        enemyText += '\u2026';
                    }
                }
                ctx.fillText(enemyText, cx + 12, statsStartY + statLineH * 3);
            }
            // Endless Run card
            {
                const cardX = baseX + this.missions.length * (cardW + cardPad);
                const selected = this.missionSelection === this.missions.length;
                ctx.fillStyle = selected ? 'rgba(0,255,200,0.15)' : 'rgba(20,20,30,0.85)';
                ctx.fillRect(cardX, cy, cardW, cardH);
                ctx.strokeStyle = selected ? '#00FFCC' : '#333'; ctx.lineWidth = selected ? 2 : 1;
                ctx.strokeRect(cardX, cy, cardW, cardH);
                // Accent bar
                ctx.fillStyle = '#00FFCC'; ctx.fillRect(cardX, cy, cardW, 4);
                // Title
                ctx.font = `bold ${Math.max(14, cardTitleFont + 2)}px "Courier New", monospace`; ctx.fillStyle = selected ? '#00FFCC' : '#CCC';
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                ctx.fillText('Endless Run', cardX + 12, cy + 14);
                // Description
                ctx.font = `${cardFont}px "Courier New", monospace`; ctx.fillStyle = '#888';
                const desc = 'Survive as long as you can. Enemies get harder. No waves. No end.';
                const dWords = desc.split(' ');
                let dLine = '', dLineY = cy + 56;
                for (const word of dWords) {
                    const test = dLine + word + ' ';
                    if (ctx.measureText(test).width > cardW - 24 && dLine) {
                        ctx.fillText(dLine.trim(), cardX + 12, dLineY); dLineY += cardFont + 3; dLine = word + ' ';
                    } else { dLine = test; }
                }
                if (dLine) ctx.fillText(dLine.trim(), cardX + 12, dLineY);
                // Difficulty
                ctx.font = `bold ${cardFont + 1}px "Courier New", monospace`; ctx.fillStyle = '#FF8800';
                ctx.fillText('INFINITE', cardX + 12, cy + cardH - 50);
                // Icon
                ctx.font = `${Math.max(24, Math.min(32, cardW * 0.12))}px sans-serif`; ctx.fillStyle = selected ? '#00FFCC' : '#444';
                ctx.textAlign = 'center';
                ctx.fillText('\u221E', cardX + cardW / 2, cy + cardH - 25);
            }
            ctx.restore();
            // Scroll indicators
            if (this._missionScrollX > 10) {
                ctx.font = `bold ${Math.min(20, sw * 0.03)}px "Courier New", monospace`; ctx.fillStyle = 'rgba(0,204,255,0.6)';
                ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillText('\u25C0', 6, cy + cardH / 2);
            }
            if (this._missionScrollX < totalCardsW - viewW - 10) {
                ctx.font = `bold ${Math.min(20, sw * 0.03)}px "Courier New", monospace`; ctx.fillStyle = 'rgba(0,204,255,0.6)';
                ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
                ctx.fillText('\u25B6', sw - 6, cy + cardH / 2);
            }
        }

        // Selected mission detail panel
        const sel = this.missionSelection < this.missions.length ? this.missions[this.missionSelection] : null;
        const panelY = smallScreen ? sh - 45 : sh / 2 + cardH / 2 - 10;
        ctx.textAlign = 'center'; ctx.font = `${Math.min(12, sw * 0.02)}px "Courier New", monospace`; ctx.fillStyle = '#888';
        if (sel) {
            ctx.fillText(`Press Enter to deploy to ${sel.name}`, sw / 2, panelY + 20);
        } else {
            ctx.fillText('Press Enter to start Endless Run', sw / 2, panelY + 20);
        }
        // Controls
        ctx.font = `${Math.min(11, sw * 0.018)}px "Courier New", monospace`; ctx.fillStyle = '#444'; ctx.textAlign = 'center';
        ctx.fillText('A/D or Left/Right to select  |  Enter to start  |  ESC to go back', sw / 2, sh - 15);
    }

    // Phase 7: Weapon loadout selection screen
    _renderLoadout(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        // Title
        ctx.font = `bold ${Math.min(28, sw * 0.04)}px "Courier New", monospace`; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('SELECT WEAPONS', sw / 2, 30);
        ctx.font = `${Math.min(12, sw * 0.02)}px "Courier New", monospace`; ctx.fillStyle = '#888';
        ctx.fillText('Choose up to 2 weapons. Pistol is always included.', sw / 2, 65);
        // Daily challenge checkbox
        const cbx = sw / 2 - 100, cby = 85, cbw = 200, cbh = 28;
        ctx.fillStyle = this.joinDailyChallenge ? 'rgba(0,150,255,0.2)' : 'rgba(50,50,60,0.5)';
        ctx.fillRect(cbx, cby, cbw, cbh);
        ctx.strokeStyle = this.joinDailyChallenge ? '#00AAFF' : '#444'; ctx.lineWidth = 1;
        ctx.strokeRect(cbx, cby, cbw, cbh);
        // Checkbox mark
        ctx.strokeStyle = this.joinDailyChallenge ? '#00FF88' : '#555'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cbx + 8, cby + cbh / 2);
        ctx.lineTo(cbx + 14, cby + cbh / 2 + 6);
        ctx.lineTo(cbx + 22, cby + cbh / 2 - 6);
        ctx.stroke();
        ctx.font = '12px "Courier New", monospace'; ctx.fillStyle = this.joinDailyChallenge ? '#00DDFF' : '#888'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('Join Daily Challenge', cbx + 30, cby + cbh / 2);
        // Current loadout slots
        const slotW = 140, slotH = 50, slotGap = 15;
        const totalSlotW = slotW * 2 + slotGap;
        const slotStartX = (sw - totalSlotW) / 2;
        const slotY = 125;
        ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'center';
        ctx.fillText('YOUR LOADOUT', sw / 2, slotY - 18);
        for (let i = 0; i < 2; i++) {
            const sx = slotStartX + i * (slotW + slotGap);
            const wpnIdx = this.loadoutWeapons[i];
            const wpn = wpnIdx >= 0 ? CONFIG.weapons[wpnIdx] : null;
            ctx.fillStyle = wpn ? 'rgba(255,215,0,0.15)' : 'rgba(50,50,60,0.5)';
            ctx.fillRect(sx, slotY, slotW, slotH);
            ctx.strokeStyle = wpn ? '#FFD700' : '#444'; ctx.lineWidth = 1;
            ctx.strokeRect(sx, slotY, slotW, slotH);
            if (wpn) {
                ctx.font = 'bold 12px "Courier New", monospace'; ctx.fillStyle = '#FFF'; ctx.textAlign = 'center';
                ctx.fillText(wpn.name, sx + slotW / 2, slotY + 14);
                ctx.font = '10px "Courier New", monospace'; ctx.fillStyle = '#888';
                ctx.fillText(`DMG:${wpn.damage}`, sx + slotW / 2, slotY + 32);
            } else {
                ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#555'; ctx.textAlign = 'center';
                ctx.fillText('Empty', sx + slotW / 2, slotY + 18);
                ctx.fillStyle = '#444'; ctx.font = '10px "Courier New", monospace';
                ctx.fillText(i === 0 ? '(Pistol auto)' : '(Tap to fill)', sx + slotW / 2, slotY + 35);
            }
        }
        // Weapon list
        const ownedWeapons = this._getOwnedWeapons(game);
        const listY = slotY + slotH + 25;
        const itemH = 42;
        const visibleCount = Math.min(ownedWeapons.length, Math.floor((sh - listY - 80) / itemH));
        const scrollOffset = Math.max(0, this.loadoutSelection - Math.floor(visibleCount / 2));
        ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = '#666'; ctx.textAlign = 'center';
        ctx.fillText('AVAILABLE WEAPONS (W/S to navigate, Enter to toggle)', sw / 2, listY - 5);
        for (let i = 0; i < visibleCount && i + scrollOffset < ownedWeapons.length; i++) {
            const idx = i + scrollOffset;
            const wpn = ownedWeapons[idx];
            const iy = listY + i * itemH;
            const selected = idx === this.loadoutSelection;
            const inLoadout = this.loadoutWeapons[0] === wpn.weaponIndex || this.loadoutWeapons[1] === wpn.weaponIndex;
            ctx.fillStyle = selected ? 'rgba(255,215,0,0.15)' : 'rgba(20,20,30,0.6)';
            ctx.fillRect(sw / 2 - 200, iy, 400, itemH - 4);
            ctx.strokeStyle = selected ? '#FFD700' : inLoadout ? '#00FF88' : '#333'; ctx.lineWidth = selected ? 2 : 1;
            ctx.strokeRect(sw / 2 - 200, iy, 400, itemH - 4);
            if (inLoadout) {
                ctx.fillStyle = '#00FF88'; ctx.font = '9px "Courier New", monospace'; ctx.textAlign = 'left';
                ctx.fillText('EQUIPPED', sw / 2 - 192, iy + 12);
            }
            ctx.font = 'bold 13px "Courier New", monospace'; ctx.fillStyle = selected ? '#FFD700' : '#CCC'; ctx.textAlign = 'left';
            ctx.fillText(wpn.name, sw / 2 - 180, iy + (inLoadout ? 24 : 14));
            ctx.font = '10px "Courier New", monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'right';
            ctx.fillText(`DMG:${wpn.damage} | T${wpn.tier}`, sw / 2 + 192, iy + (inLoadout ? 24 : 14));
            if (inLoadout) {
                ctx.font = '9px "Courier New", monospace'; ctx.fillStyle = '#888'; ctx.textAlign = 'right';
                ctx.fillText('ENTER to remove', sw / 2 + 192, iy + 36);
            }
        }
        // Start button
        const btnY = sh - 55;
        ctx.fillStyle = '#FFD700'; ctx.fillRect(sw / 2 - 80, btnY, 160, 35);
        ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 2; ctx.strokeRect(sw / 2 - 80, btnY, 160, 35);
        ctx.font = 'bold 14px "Courier New", monospace'; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('PRESS B TO DEPLOY', sw / 2, btnY + 17);
        ctx.font = '10px "Courier New", monospace'; ctx.fillStyle = '#555'; ctx.textAlign = 'center';
        ctx.fillText('ESC to go back', sw / 2, btnY + 45);
    }

    _renderPause(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, cw, ch);
        // Decorative lines
        ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
        for (let y = 0; y < sh; y += 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke(); }
        // Responsive sizing — flow layout from top
        const titleSize = Math.min(48, sw * 0.07);
        const statSize = Math.min(16, sw * 0.025);
        const ctrlSize = Math.min(14, sw * 0.022);
        // Title
        const titleY = sh * 0.15;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#FFF';
        ctx.fillText('PAUSED', sw / 2, titleY);
        // Run stats below title
        const runMins = Math.floor((game.runTime || 0) / 60);
        const runSecs = Math.floor((game.runTime || 0) % 60);
        const statY = titleY + titleSize * 0.7 + 20;
        ctx.font = `${statSize}px "Courier New", monospace`; ctx.fillStyle = '#AAA';
        if (game.endlessMode) {
            ctx.fillText(`Distance: ${Math.floor(game.endlessDistance)}m  |  Score: ${game.scoreManager.score}  |  Kills: ${game.scoreManager.kills}`, sw / 2, statY);
            ctx.fillText(`Difficulty: ${game.endlessDifficulty.toFixed(1)}x`, sw / 2, statY + 24);
        } else {
            ctx.fillText(`Wave: ${game.waveManager.wave}  |  Score: ${game.scoreManager.score}  |  Kills: ${game.scoreManager.kills}`, sw / 2, statY);
            ctx.fillText(`Time: ${runMins}:${runSecs.toString().padStart(2, '0')}`, sw / 2, statY + 24);
        }
        // Bot mode indicator
        let belowStats = statY + 52;
        if (game.bot && game.bot.active) {
            const pulse = 0.6 + Math.sin(performance.now() * 0.004) * 0.4;
            ctx.font = `bold ${ctrlSize}px "Courier New", monospace`;
            ctx.fillStyle = `rgba(0,200,255,${pulse})`;
            ctx.fillText('BOT MODE ACTIVE', sw / 2, belowStats);
            belowStats += 28;
        }
        // Controls below stats
        const controlSpacing = Math.max(22, Math.min(28, sh * 0.04));
        ctx.font = `${ctrlSize}px "Courier New", monospace`; ctx.fillStyle = '#888';
        const controls = [
            ['ESC', 'Resume'],
            ['Q', 'Quit to Menu'],
            ['B', game.bot && game.bot.active ? 'Disable Bot' : 'Enable Bot'],
            ['F3', 'Debug Overlay'],
        ];
        const labelOffset = Math.min(60, sw * 0.1);
        for (let i = 0; i < controls.length; i++) {
            const [key, label] = controls[i];
            const y = belowStats + i * controlSpacing;
            ctx.fillStyle = '#FF8800'; ctx.textAlign = 'right';
            ctx.fillText(key, sw / 2 - 8, y);
            ctx.fillStyle = '#AAA'; ctx.textAlign = 'left';
            ctx.fillText(label, sw / 2 + 8, y);
        }
    }

    // ============================================================
    // HELICOPTER DEPLOYMENT ANIMATION
    // ============================================================
    _renderDeploying(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const timer = this._deployTimer || 0;

        // Background: game world from above (darkened)
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, cw, ch);

        // Terrain grid (moving downward to simulate flight)
        const gridOffset = (timer * 200) % 60;
        ctx.strokeStyle = 'rgba(0,255,100,0.06)'; ctx.lineWidth = 1;
        for (let y = -60 + gridOffset; y < sh + 60; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y); ctx.stroke();
        }
        for (let x = 0; x < sw; x += 60) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sh); ctx.stroke();
        }

        // Mission info (top)
        const missionName = game.currentMission?.name || 'ENDLESS RUN';
        const difficulty = game.currentMission?.difficulty || 'Extreme';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillStyle = '#00FF88'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`DEPLOYING TO: ${missionName.toUpperCase()}`, sw / 2, 30);
        ctx.font = '11px "Courier New", monospace';
        ctx.fillStyle = '#888';
        ctx.fillText(`Difficulty: ${difficulty} | Squad: 4 operators`, sw / 2, 50);

        // Helicopter
        const heliPhase = Math.min(1, timer / 1.5); // 0-1 over 1.5s
        const heliX = sw * 0.5 + Math.sin(timer * 2) * 30;
        const heliY = timer < 2.5 ? sh * 0.15 + Math.sin(timer * 4) * 8 : sh * 0.15 + (timer - 2.5) * 200;

        if (heliY < sh + 100) {
            ctx.save();
            ctx.translate(heliX, heliY);

            // Helicopter body
            ctx.fillStyle = '#3A4A3A';
            ctx.beginPath();
            ctx.ellipse(0, 0, 50, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2A3A2A'; ctx.lineWidth = 2; ctx.stroke();

            // Cockpit
            ctx.fillStyle = 'rgba(100,150,200,0.4)';
            ctx.beginPath();
            ctx.ellipse(35, -5, 15, 10, 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Tail
            ctx.fillStyle = '#3A4A3A';
            ctx.fillRect(-55, -5, 25, 10);
            ctx.fillRect(-75, -15, 20, 25);

            // Tail rotor
            const rotorAngle = timer * 30;
            ctx.strokeStyle = 'rgba(200,200,200,0.4)'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-75 + Math.cos(rotorAngle) * 12, -15 + Math.sin(rotorAngle) * 3);
            ctx.lineTo(-75 - Math.cos(rotorAngle) * 12, -15 - Math.sin(rotorAngle) * 3);
            ctx.stroke();

            // Main rotor
            ctx.strokeStyle = 'rgba(200,200,200,0.3)'; ctx.lineWidth = 3;
            const mainRotorAngle = timer * 25;
            ctx.beginPath();
            ctx.moveTo(Math.cos(mainRotorAngle) * 60, -18 + Math.sin(mainRotorAngle) * 5);
            ctx.lineTo(-Math.cos(mainRotorAngle) * 60, -18 - Math.sin(mainRotorAngle) * 5);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(Math.cos(mainRotorAngle + Math.PI/2) * 60, -18 + Math.sin(mainRotorAngle + Math.PI/2) * 5);
            ctx.lineTo(-Math.cos(mainRotorAngle + Math.PI/2) * 60, -18 - Math.sin(mainRotorAngle + Math.PI/2) * 5);
            ctx.stroke();

            // Landing skids
            ctx.strokeStyle = '#2A3A2A'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-30, 18); ctx.lineTo(30, 18); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-25, 18); ctx.lineTo(-25, 22); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(25, 18); ctx.lineTo(25, 22); ctx.stroke();

            // Open door (deploying)
            if (timer > 1.5) {
                ctx.fillStyle = '#1A2A1A';
                ctx.fillRect(10, -8, 15, 16);
            }

            ctx.restore();

            // Rope (after 2s)
            if (timer > 2.0 && timer < 3.5) {
                const ropeProgress = Math.min(1, (timer - 2.0) / 0.8);
                const ropeLen = ropeProgress * (sh * 0.5);
                const ropeX = heliX + 15;
                const ropeTop = heliY + 10;
                ctx.strokeStyle = 'rgba(200,200,150,0.6)'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ropeX, ropeTop);
                // Rope sway
                for (let ry = 0; ry < ropeLen; ry += 10) {
                    const sway = Math.sin(timer * 3 + ry * 0.02) * 5;
                    ctx.lineTo(ropeX + sway, ropeTop + ry);
                }
                ctx.stroke();

                // Operator sliding down
                if (timer > 2.3) {
                    const slideProgress = Math.min(1, (timer - 2.3) / 0.7);
                    const opY = ropeTop + slideProgress * ropeLen;
                    const opSway = Math.sin(timer * 3 + slideProgress * ropeLen * 0.02) * 5;
                    ctx.fillStyle = '#4A5D23';
                    ctx.beginPath(); ctx.arc(ropeX + opSway, opY, 8, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#3D4F1C';
                    ctx.beginPath(); ctx.arc(ropeX + opSway + 3, opY - 2, 4, 0, Math.PI * 2); ctx.fill();
                }
            }
        }

        // Status text (bottom)
        let statusText = '';
        let statusColor = '#00FF88';
        if (timer < 1.5) { statusText = 'EN ROUTE TO DROP ZONE...'; statusColor = '#00CCFF'; }
        else if (timer < 2.0) { statusText = 'ARRIVING AT LZ'; statusColor = '#FFD700'; }
        else if (timer < 3.0) { statusText = 'DEPLOYING OPERATORS...'; statusColor = '#FF8800'; }
        else if (timer < 3.5) { statusText = 'ALL OPERATORS ON GROUND'; statusColor = '#00FF66'; }
        else { statusText = 'COMMENCING OPERATION'; statusColor = '#FF0000'; }

        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.fillStyle = statusColor; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const blink = Math.floor(timer * 3) % 2 === 0;
        ctx.fillText(blink ? statusText : '', sw / 2, sh - 40);

        // Progress bar
        const barW = Math.min(300, sw - 60);
        const barH = 4;
        const barX = sw / 2 - barW / 2;
        const barY = sh - 25;
        const progress = Math.min(1, timer / 4.0);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = statusColor; ctx.fillRect(barX, barY, barW * progress, barH);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);

        // Skip hint
        if (timer > 1.0) {
            ctx.font = '10px "Courier New", monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.textAlign = 'center';
            ctx.fillText('Press any key to skip', sw / 2, sh - 8);
        }

        // Skip on any key press
        if (timer > 0.5 && game.input && Object.values(game.input.keys).some(v => v)) {
            this.state = 'playing';
        }
    }

    _renderGameOver(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;

        // Terminal background
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, cw, ch);
        // CRT scan lines
        for (let y = 0; y < sh; y += 2) {
            ctx.fillStyle = 'rgba(0,255,0,0.008)'; ctx.fillRect(0, y, sw, 1);
        }

        const t = performance.now();
        const charW = Math.min(10, sw * 0.014);
        const lineH = Math.min(18, sh * 0.028);
        const marginLeft = Math.min(30, sw * 0.04);
        const maxChars = Math.floor((sw - marginLeft * 2) / charW);

        // Terminal state
        if (!this._termState) {
            const missionComplete = game.waveManager.wave >= (game.currentMission?.waves || 999) && !game.endlessMode;
            const missionFailed = !missionComplete;
            const missionName = game.currentMission?.name || 'Endless Run';

            // Generate teammates from actual game data
            const actualTeammates = game.teammates || [];
            const teammates = actualTeammates.map(tm => ({
                name: `${tm.role === 'medic' ? 'SGT' : tm.role === 'sniper' ? 'CPL' : tm.role === 'support' ? 'SPC' : 'PVT'}. ${tm.name}`,
                status: missionFailed ? (tm.alive ? (Math.random() < 0.5 ? 'WIA' : 'MIA') : 'KIA') : 'RTB',
                kills: Math.floor(Math.random() * game.scoreManager.kills * 0.3)
            }));
            // Add filler teammates if less than 2
            while (teammates.length < 2) {
                const fillerNames = ['PVT. Tanaka', 'SPC. Chen'];
                teammates.push({
                    name: fillerNames[teammates.length],
                    status: missionFailed ? 'KIA' : 'RTB',
                    kills: Math.floor(Math.random() * game.scoreManager.kills * 0.2)
                });
            }

            // Build terminal lines
            const lines = [];
            const date = new Date();
            const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
            const timeStr = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
            const runMins = Math.floor((game.runTime || 0) / 60);
            const runSecs = Math.floor((game.runTime || 0) % 60);
            const statusColor = missionFailed ? '#FF3333' : '#00FF66';
            const statusText = missionFailed ? 'MISSION FAILED' : 'MISSION COMPLETE';
            const kpm = game.runTime > 0 ? (game.scoreManager.kills / (game.runTime / 60)).toFixed(1) : '0.0';

            lines.push({ text: `===========================================`, color: '#333', delay: 0 });
            lines.push({ text: `  AFTER ACTION REPORT — CLASSIFIED`, color: '#00FF88', delay: 50 });
            lines.push({ text: `  Date: ${dateStr}  Time: ${timeStr}`, color: '#008844', delay: 100 });
            lines.push({ text: `===========================================`, color: '#333', delay: 150 });
            lines.push({ text: ``, color: '#000', delay: 200 });
            lines.push({ text: `  OPERATION: ${missionName.toUpperCase()}`, color: '#00CCFF', delay: 250 });
            lines.push({ text: `  STATUS: ${statusText}`, color: statusColor, delay: 400 });
            lines.push({ text: ``, color: '#000', delay: 500 });
            lines.push({ text: `-------------------------------------------`, color: '#222', delay: 550 });
            lines.push({ text: `  SQUAD ROSTER`, color: '#888', delay: 600 });
            lines.push({ text: `-------------------------------------------`, color: '#222', delay: 650 });

            // Player
            const playerName = game.persistence.data.playerName || 'OPERATOR';
            lines.push({ text: `  ${playerName.padEnd(18)} ${'ACTIVE'.padEnd(8)} ${game.scoreManager.kills} KILLS`, color: '#00FF66', delay: 700 });

            // Teammates
            let tDelay = 800;
            for (const tm of teammates) {
                const stColor = tm.status === 'KIA' ? '#FF3333' : tm.status === 'WIA' ? '#FF8800' : tm.status === 'MIA' ? '#FF00FF' : '#00FF66';
                lines.push({ text: `  ${tm.name.padEnd(18)} ${tm.status.padEnd(8)} ${tm.kills} KILLS`, color: stColor, delay: tDelay });
                tDelay += 100;
            }

            lines.push({ text: ``, color: '#000', delay: tDelay });
            lines.push({ text: `-------------------------------------------`, color: '#222', delay: tDelay + 50 });
            lines.push({ text: `  COMBAT STATISTICS`, color: '#888', delay: tDelay + 100 });
            lines.push({ text: `-------------------------------------------`, color: '#222', delay: tDelay + 150 });

            if (game.endlessMode) {
                lines.push({ text: `  Distance Covered : ${Math.floor(game.endlessDistance)}m`, color: '#AAA', delay: tDelay + 200 });
                lines.push({ text: `  Max Difficulty   : ${game.endlessDifficulty.toFixed(1)}x`, color: '#AAA', delay: tDelay + 250 });
            } else {
                lines.push({ text: `  Waves Cleared    : ${game.waveManager.wave}`, color: '#AAA', delay: tDelay + 200 });
            }
            lines.push({ text: `  Final Score      : ${game.scoreManager.score}`, color: '#FFD700', delay: tDelay + 300 });
            lines.push({ text: `  Total Kills      : ${game.scoreManager.kills}`, color: '#AAA', delay: tDelay + 350 });
            lines.push({ text: `  Kill Rate        : ${kpm}/min`, color: '#AAA', delay: tDelay + 400 });
            lines.push({ text: `  Time in Theater  : ${runMins}:${runSecs.toString().padStart(2, '0')}`, color: '#AAA', delay: tDelay + 450 });
            lines.push({ text: `  Best Combo       : x${game.scoreManager.combo}`, color: '#FF8800', delay: tDelay + 500 });
            lines.push({ text: `  High Score       : ${game.persistence.data.highScore}`, color: '#FFD700', delay: tDelay + 550 });
            lines.push({ text: `  Coins Earned     : $${game.persistence.data.coins.toLocaleString()}`, color: '#FFD700', delay: tDelay + 600 });
            lines.push({ text: ``, color: '#000', delay: tDelay + 650 });
            lines.push({ text: `===========================================`, color: '#333', delay: tDelay + 700 });

            if (missionFailed) {
                lines.push({ text: `  RECOMMENDATION: Re-evaluate tactics.`, color: '#FF6644', delay: tDelay + 800 });
                lines.push({ text: `  Consider different loadout or approach.`, color: '#FF6644', delay: tDelay + 900 });
            } else {
                lines.push({ text: `  RECOMMENDATION: Excellent performance.`, color: '#00FF66', delay: tDelay + 800 });
                lines.push({ text: `  Operator cleared for next operation.`, color: '#00FF66', delay: tDelay + 900 });
            }
            lines.push({ text: `===========================================`, color: '#333', delay: tDelay + 1000 });

            // Input prompt
            if (!this.submitted) {
                lines.push({ text: ``, color: '#000', delay: tDelay + 1100 });
                lines.push({ text: `  ENTER NAME TO SUBMIT SCORE:`, color: '#00CCFF', delay: tDelay + 1200 });
            } else {
                lines.push({ text: ``, color: '#000', delay: tDelay + 1100 });
                if (this.submitResult && this.submitResult.success) {
                    lines.push({ text: `  SCORE SUBMITTED — RANK #${this.submitResult.rank}`, color: '#00FF66', delay: tDelay + 1200 });
                } else if (this.submitResult && !this.submitResult.skipped) {
                    lines.push({ text: `  SUBMIT FAILED: ${this.submitResult.error}`, color: '#FF3333', delay: tDelay + 1200 });
                }
                lines.push({ text: `  [R] RESTART  |  [L] LEADERBOARD  |  [ESC] MENU`, color: '#888', delay: tDelay + 1300 });
            }
            lines.push({ text: `  LIFETIME: ${game.persistence.data.totalRuns} runs | ${game.persistence.data.totalKills} kills | Best: W${game.persistence.data.bestWave}`, color: '#444', delay: tDelay + 1400 });

            this._termState = { lines, startTime: t, teammates };
        }

        // Render terminal lines with typewriter effect
        const termState = this._termState;
        const elapsed = t - termState.startTime;
        let y = lineH * 1.5;

        ctx.textAlign = 'left'; ctx.textBaseline = 'top';

        for (const line of termState.lines) {
            if (elapsed < line.delay) break;
            const lineElapsed = elapsed - line.delay;
            const charsVisible = Math.min(line.text.length, Math.floor(lineElapsed / 12));

            if (charsVisible > 0) {
                const displayText = line.text.substring(0, charsVisible);
                ctx.font = `${charW}px "Courier New", monospace`;
                ctx.fillStyle = line.color;
                ctx.fillText(displayText, marginLeft, y);

                // Blinking cursor on current line
                if (charsVisible < line.text.length) {
                    const cursorX = marginLeft + ctx.measureText(displayText).width;
                    if (Math.floor(t / 300) % 2 === 0) {
                        ctx.fillStyle = '#00FF88';
                        ctx.fillRect(cursorX, y, charW, lineH - 2);
                    }
                }
            }
            y += lineH;
            if (y > sh - lineH) break;
        }

        // Name input field (after terminal finishes)
        if (!this.submitted && elapsed > (termState.lines[termState.lines.length - 1]?.delay || 0) - 200) {
            const inputY = y + lineH;
            const inputW = Math.min(280, sw - marginLeft * 2);
            const inputX = marginLeft;

            // Input box
            const blink = Math.floor(t / 500) % 2 === 0;
            ctx.fillStyle = '#111'; ctx.fillRect(inputX, inputY, inputW, lineH + 4);
            ctx.strokeStyle = '#00FF88'; ctx.lineWidth = 1; ctx.strokeRect(inputX, inputY, inputW, lineH + 4);

            const nameText = `${this.nameInput || game.persistence.data.playerName}${blink ? '_' : ' '}`;
            ctx.font = `${charW}px "Courier New", monospace`;
            ctx.fillStyle = '#00FF88';
            ctx.fillText(nameText, inputX + 4, inputY + 3);
        }

        // Achievement unlocks (bottom)
        if (this.achievementUnlocks && this.achievementUnlocks.length > 0) {
            for (let i = 0; i < this.achievementUnlocks.length; i++) {
                const a = this.achievementUnlocks[i];
                const ay = sh - lineH * 2 - i * (lineH + 4);
                ctx.font = `bold ${charW - 1}px "Courier New", monospace`;
                ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
                ctx.fillText(`ACHIEVEMENT UNLOCKED: ${a.name}`, sw / 2, ay);
            }
        }

        // CRT vignette effect
        const grad = ctx.createRadialGradient(sw/2, sh/2, sw*0.3, sw/2, sh/2, sw*0.7);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, sw, sh);
    }

    _renderTutorial(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, cw, ch);

        // Title
        ctx.font = `bold ${Math.min(32, sw * 0.05)}px "Courier New", monospace`; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('HOW TO PLAY', sw / 2, 25);

        // Two column layout
        const colW = sw * 0.4;
        const leftX = sw * 0.1;
        const rightX = sw * 0.55;
        let leftY = 75;
        const rightY = 75;
        const lineH = 22;

        // Left column: Controls
        ctx.font = `bold ${Math.min(16, sw * 0.025)}px "Courier New", monospace`; ctx.fillStyle = '#FF8800'; ctx.textAlign = 'left';
        ctx.fillText('CONTROLS', leftX, leftY);
        leftY += lineH + 8;

        const controls = [
            ['WASD / Arrows', 'Move'],
            ['Mouse', 'Aim'],
            ['Left Click', 'Shoot'],
            ['R', 'Reload'],
            ['E', 'Shield Ability'],
            ['Q', 'Grenade'],
            ['F', 'Adrenaline'],
            ['Space', 'Dodge Roll'],
            ['G', 'Drop Weapon'],
            ['T', 'Swap Weapons'],
            ['1 / 2', 'Select Weapon'],
            ['V', 'Melee Attack'],
            ['X', 'Place Mine'],
            ['Shift+X', 'Place Claymore'],
            ['P', 'Weapon Shop (between waves)'],
            ['K', 'Use Kill Streak'],
            ['M', 'Toggle Minimap'],
        ];

        ctx.font = `${Math.min(12, sw * 0.018)}px "Courier New", monospace`;
        for (const [key, action] of controls) {
            ctx.fillStyle = '#FFD700'; ctx.textAlign = 'left';
            ctx.fillText(key, leftX, leftY);
            ctx.fillStyle = '#CCC';
            ctx.fillText(action, leftX + 90, leftY);
            leftY += lineH;
        }

        // Right column: Gameplay
        ctx.font = `bold ${Math.min(16, sw * 0.025)}px "Courier New", monospace`; ctx.fillStyle = '#FF8800'; ctx.textAlign = 'left';
        ctx.fillText('GAMEPLAY', rightX, rightY);
        let rY = rightY + lineH + 8;

        const gameplay = [
            ['Kill Enemies', 'Earn score and coins'],
            ['Waves', 'Survive all waves to complete mission'],
            ['Combo', 'Kill quickly for bonus multiplier'],
            ['Health', 'Find pickups or use medkits'],
            ['Ammo', 'Collect ammo drops or visit shop'],
            ['Kill Streaks', '5+ kills without dying = reward'],
            ['Weapons', 'Buy from Shop, pick up, or find'],
            ['Upgrades', 'Spend coins in Shop to upgrade'],
        ];

        ctx.font = `${Math.min(12, sw * 0.018)}px "Courier New", monospace`;
        for (const [title, desc] of gameplay) {
            ctx.fillStyle = '#FFF'; ctx.textAlign = 'left';
            ctx.fillText(title, rightX, rY);
            ctx.fillStyle = '#888';
            ctx.fillText(desc, rightX, rY + 14);
            rY += lineH + 10;
        }

        // Kill streak info
        ctx.font = `bold ${Math.min(14, sw * 0.022)}px "Courier New", monospace`; ctx.fillStyle = '#00FF88'; ctx.textAlign = 'left';
        ctx.fillText('KILL STREAKS', rightX, rY + 10);
        rY += lineH + 14;

        const streaks = [
            ['5 Kills', 'UAV - Reveal enemies'],
            ['8 Kills', 'Airstrike - Area bomb'],
            ['12 Kills', 'Helicopter - Air support'],
        ];

        ctx.font = `${Math.min(11, sw * 0.017)}px "Courier New", monospace`;
        for (const [kills, reward] of streaks) {
            ctx.fillStyle = '#FFD700'; ctx.fillText(kills, rightX, rY);
            ctx.fillStyle = '#AAA'; ctx.fillText(reward, rightX + 70, rY);
            rY += lineH;
        }

        // Tips section
        const tipY = Math.max(leftY, rY) + 20;
        ctx.font = `bold ${Math.min(14, sw * 0.022)}px "Courier New", monospace`; ctx.fillStyle = '#FF6600'; ctx.textAlign = 'center';
        ctx.fillText('TIPS', sw / 2, tipY);

        const tips = [
            'Dodge rolling gives brief invulnerability - use it to dodge through enemy fire!',
            'Combat medic perk heals you when you get kills - great for sustain.',
            'Speed boost lets you outrun zombies and position better.',
            'UAV helps spot enemies in tough spots - use it when overwhelmed.',
            'Supply drops spawn every 25 seconds - watch for the announcement!',
        ];

        ctx.font = `${Math.min(11, sw * 0.017)}px "Courier New", monospace`; ctx.fillStyle = '#CCC'; ctx.textAlign = 'center';
        for (let i = 0; i < tips.length; i++) {
            ctx.fillText(tips[i], sw / 2, tipY + 20 + i * 18);
        }

        // Back button
        const btnY = sh - 50;
        ctx.fillStyle = '#FFD700'; ctx.fillRect(sw / 2 - 80, btnY, 160, 32);
        ctx.strokeStyle = '#FFAA00'; ctx.lineWidth = 1; ctx.strokeRect(sw / 2 - 80, btnY, 160, 32);
        ctx.font = 'bold 14px "Courier New", monospace'; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('PRESS ANY KEY', sw / 2, btnY + 16);
    }

    _renderSettings(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const s = game.persistence.data.settings;
        // Responsive sizing — fit all items within screen bounds
        const titleSize = Math.min(32, sw * 0.05);
        const itemSpacing = Math.min(50, (sh - 160) / this.settingsItems.length);
        const panelW = Math.min(500, sw - 40);
        const panelX = sw / 2 - panelW / 2;
        const dynamicFontSize = Math.min(16, Math.max(10, sw * 0.022));
        const fontSize = dynamicFontSize;
        const valueFontSize = Math.min(15, Math.max(9, sw * 0.02));
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#FFF';
        ctx.fillText('SETTINGS', sw / 2, 60);
        const startY = 120;
        // Volume bar width scales with panel
        const barChars = Math.max(3, Math.min(10, Math.floor(panelW / 40)));
        for (let i = 0; i < this.settingsItems.length; i++) {
            const selected = i === this.settingsSelection;
            const y = startY + i * itemSpacing;
            let valueText = '';
            switch (i) {
                case 0: valueText = `[${'█'.repeat(Math.round(s.masterVolume * barChars))}${'░'.repeat(barChars - Math.round(s.masterVolume * barChars))}] ${Math.round(s.masterVolume * 100)}%`; break;
                case 1: valueText = `[${'█'.repeat(Math.round(s.sfxVolume * barChars))}${'░'.repeat(barChars - Math.round(s.sfxVolume * barChars))}] ${Math.round(s.sfxVolume * 100)}%`; break;
                case 2: valueText = `[${'█'.repeat(Math.round(s.musicVolume * barChars))}${'░'.repeat(barChars - Math.round(s.musicVolume * barChars))}] ${Math.round(s.musicVolume * 100)}%`; break;
                case 3: valueText = s.muted ? '[ON]' : '[OFF]'; break;
                case 4: valueText = `[${s.graphicsQuality.toUpperCase()}]`; break;
                case 5: valueText = `[${s.screenShakeIntensity.toFixed(2)}]`; break;
                case 6: valueText = s.showDamageNumbers ? '[ON]' : '[OFF]'; break;
                case 7: valueText = s.showMinimap ? '[ON]' : '[OFF]'; break;
                case 8: valueText = game.persistence.data.playerName; break;
                case 9: valueText = ''; break;
            }
            if (selected) {
                ctx.fillStyle = 'rgba(255,50,50,0.1)'; ctx.fillRect(panelX, y - 14, panelW, 30);
                ctx.strokeStyle = '#FF3333'; ctx.lineWidth = 1; ctx.strokeRect(panelX, y - 14, panelW, 30);
            }
            ctx.font = selected ? `bold ${fontSize}px "Courier New", monospace` : `${valueFontSize}px "Courier New", monospace`;
            ctx.textAlign = 'left'; ctx.fillStyle = selected ? '#FF5555' : '#AAA';
            ctx.fillText(this.settingsItems[i], panelX + 20, y);
            const labelW = ctx.measureText(this.settingsItems[i]).width;
            const valueAvailW = panelW - 40 - labelW - 16;
            ctx.textAlign = 'right'; ctx.fillStyle = selected ? '#FFF' : '#777';
            if (valueAvailW > 20) {
                ctx.fillText(valueText, panelX + panelW - 20, y);
            } else {
                ctx.textAlign = 'left';
                ctx.font = `${Math.max(9, valueFontSize - 2)}px "Courier New", monospace`;
                ctx.fillText(valueText, panelX + 20, y + fontSize + 2);
            }
        }
        ctx.textAlign = 'center'; ctx.font = `${Math.min(12, sw * 0.018)}px "Courier New", monospace`; ctx.fillStyle = '#555';
        ctx.fillText('A/D or Left/Right to adjust | Enter/ESC to go back', sw / 2, sh - 30);
    }

    _renderLeaderboard(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        // Responsive sizing
        const titleSize = Math.min(32, sw * 0.05);
        const tableW = Math.min(500, sw - 40);
        const tableX = sw / 2 - tableW / 2;
        const fontSize = Math.min(14, sw * 0.022);
        const rowH = Math.max(24, sh * 0.04);
        const startY = 100;
        const maxVisibleRows = Math.floor((sh - startY - 60) / rowH);
        // Find player row for auto-scroll
        let playerRow = -1;
        const playerName = game.persistence.data.playerName;
        for (let i = 0; i < this.leaderboardData.length; i++) {
            if (this.leaderboardData[i].playerName === playerName) { playerRow = i; break; }
        }
        const scrollOffset = playerRow >= 0 ? Math.max(0, playerRow - Math.floor(maxVisibleRows / 2)) : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#FFD700';
        ctx.fillText('GLOBAL LEADERBOARD', sw / 2, 50);
        if (this.leaderboardLoading) {
            ctx.font = `${Math.min(18, sw * 0.028)}px monospace`; ctx.fillStyle = '#AAA';
            ctx.fillText('Loading...', sw / 2, sh / 2);
        } else if (this.leaderboardError) {
            ctx.font = `${Math.min(16, sw * 0.025)}px monospace`; ctx.fillStyle = '#FF4444';
            ctx.fillText(`Error: ${this.leaderboardError}`, sw / 2, sh / 2 - 10);
            ctx.fillStyle = '#AAA'; ctx.fillText('Make sure the backend server is running', sw / 2, sh / 2 + 20);
        } else if (this.leaderboardData.length === 0) {
            ctx.font = `${Math.min(16, sw * 0.025)}px monospace`; ctx.fillStyle = '#AAA';
            ctx.fillText('No scores yet. Be the first!', sw / 2, sh / 2);
        } else {
            // Column positions scale with table width
            const colRank = tableX;
            const colName = tableX + Math.min(60, tableW * 0.12);
            const colScore = tableX + Math.min(220, tableW * 0.44);
            const colWave = tableX + Math.min(340, tableW * 0.68);
            const colKills = tableX + Math.min(420, tableW * 0.84);
            // Table header
            ctx.font = `bold ${fontSize}px "Courier New", monospace`; ctx.fillStyle = '#888'; ctx.textAlign = 'left';
            ctx.fillText('Rank', colRank, startY);
            ctx.fillText('Name', colName, startY);
            ctx.fillText('Score', colScore, startY);
            ctx.fillText('Wave', colWave, startY);
            ctx.fillText('Kills', colKills, startY);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tableX, startY + 12); ctx.lineTo(tableX + tableW, startY + 12); ctx.stroke();
            // Visible rows with scroll
            const visibleCount = Math.min(this.leaderboardData.length - scrollOffset, maxVisibleRows);
            for (let vi = 0; vi < visibleCount; vi++) {
                const i = vi + scrollOffset;
                const entry = this.leaderboardData[i]; const y = startY + 30 + vi * rowH;
                const isMe = entry.playerName === playerName;
                ctx.font = isMe ? `bold ${fontSize}px "Courier New", monospace` : `${Math.max(11, fontSize - 1)}px "Courier New", monospace`;
                ctx.fillStyle = isMe ? '#FFD700' : (i < 3 ? '#FFF' : '#AAA');
                ctx.textAlign = 'left';
                ctx.fillText(`#${i + 1}`, colRank, y);
                const maxNameW = colScore - colName - 8;
                let nameText = entry.playerName || '???';
                if (ctx.measureText(nameText).width > maxNameW) {
                    while (ctx.measureText(nameText + '\u2026').width > maxNameW && nameText.length > 1) {
                        nameText = nameText.slice(0, -1);
                    }
                    nameText += '\u2026';
                }
                ctx.fillText(nameText, colName, y);
                ctx.fillText(entry.score.toLocaleString(), colScore, y);
                ctx.fillText(`${entry.waveReached}`, colWave, y);
                ctx.fillText(`${entry.kills}`, colKills, y);
            }
        }
        ctx.textAlign = 'center'; ctx.font = `${Math.min(12, sw * 0.018)}px "Courier New", monospace`; ctx.fillStyle = '#555';
        ctx.fillText('Press Enter or ESC to go back', sw / 2, sh - 30);
    }

    _renderOnline(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const titleSize = Math.min(32, sw * 0.05);
        const menuW = Math.min(300, sw * 0.8);
        const itemSpacing = Math.max(45, sh * 0.06);
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#00CCFF';
        ctx.fillText('ONLINE PLAY', sw / 2, sh / 2 - 100);
        for (let i = 0; i < this.onlineItems.length; i++) {
            const selected = i === this.onlineSelection;
            const y = sh / 2 - 20 + i * itemSpacing;
            if (selected) {
                ctx.fillStyle = 'rgba(0,150,255,0.1)'; ctx.fillRect(sw / 2 - menuW / 2, y - 16, menuW, 34);
                ctx.strokeStyle = '#00CCFF'; ctx.lineWidth = 1; ctx.strokeRect(sw / 2 - menuW / 2, y - 16, menuW, 34);
            }
            const fontSize = selected ? Math.min(20, sw * 0.03) : Math.min(18, sw * 0.027);
            ctx.font = selected ? `bold ${fontSize}px "Courier New", monospace` : `${fontSize}px "Courier New", monospace`;
            ctx.fillStyle = selected ? '#00CCFF' : '#888';
            ctx.fillText(this.onlineItems[i], sw / 2, y);
        }
        ctx.font = `${Math.min(12, sw * 0.018)}px "Courier New", monospace`; ctx.fillStyle = '#555';
        ctx.fillText(`Server: ${CONFIG.multiplayer.url}`, sw / 2, sh - 30);
    }

    _renderJoinRoom(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        const t = performance.now() * 0.001;
        const titleSize = Math.min(28, sw * 0.045);
        const boxW = Math.min(160, sw * 0.4);
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${titleSize}px "Courier New", monospace`; ctx.fillStyle = '#00CCFF';
        ctx.fillText('JOIN ROOM', sw / 2, sh / 2 - 60);
        ctx.font = `${Math.min(16, sw * 0.025)}px monospace`; ctx.fillStyle = '#AAA';
        ctx.fillText('Enter Room Code:', sw / 2, sh / 2 - 20);
        // Code input box with pulsing neon cyan border
        const boxX = sw / 2 - boxW / 2, boxY = sh / 2, boxH = 40;
        const pulse = 0.5 + Math.sin(t * 4) * 0.5;
        // Outer glow
        ctx.shadowColor = `rgba(0,204,255,${0.4 * pulse})`; ctx.shadowBlur = 12 * pulse;
        ctx.fillStyle = '#111'; ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = `rgba(0,204,255,${0.6 + pulse * 0.4})`; ctx.lineWidth = 2; ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.shadowBlur = 0;
        ctx.font = `bold ${Math.min(28, boxW * 0.18)}px "Courier New", monospace`; ctx.fillStyle = '#FFF';
        ctx.fillText(this.roomCodeInput.toUpperCase() + '_', sw / 2, sh / 2 + 20);
        ctx.font = `${Math.min(12, sw * 0.018)}px monospace`; ctx.fillStyle = '#555';
        ctx.fillText('4 characters | Enter to join | ESC to back', sw / 2, sh / 2 + 60);
    }

    _renderWaiting(ctx, game) {
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        const sw = game.screenWidth || cw, sh = game.screenHeight || ch;
        ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const waitSize = Math.min(24, sw * 0.04);
        ctx.font = `bold ${waitSize}px "Courier New", monospace`; ctx.fillStyle = '#00CCFF';
        const dots = '.'.repeat(Math.floor(performance.now() / 500) % 4);
        ctx.fillText(`Waiting for players${dots}`, sw / 2, sh / 2 - 30);
        if (game.network.roomCode) {
            ctx.font = `bold ${Math.min(36, sw * 0.06)}px "Courier New", monospace`; ctx.fillStyle = '#FFD700';
            ctx.fillText(`Room: ${game.network.roomCode}`, sw / 2, sh / 2 + 20);
        }
        ctx.font = `${Math.min(12, sw * 0.018)}px monospace`; ctx.fillStyle = '#555';
        ctx.fillText('ESC to cancel', sw / 2, sh / 2 + 60);
    }
}
