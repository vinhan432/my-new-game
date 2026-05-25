/**
 * Dodge Warfare - Anti-Cheat System (Simplified)
 * Only detects actual score/money exploitation
 * No false positives from legitimate gameplay
 */

class AntiCheat {
    constructor() {
        this.enabled = true;
        this.violations = [];
        this.maxViolations = 20; // Need many violations before action
        this.violationDecayTimer = 0;
        this.violationDecayInterval = 3000; // Decay 1 violation every 3s

        // Tracking state
        this._lastMoney = 0;
        this._lastMoneyCheckTime = 0;
        this._lastScore = 0;
        this._lastScoreCheckTime = 0;
        this._initialized = false;

        // Generous thresholds - only flag EXTREME cheating
        this.maxMoneyGainPerSecond = 50000; // 50x normal earning rate
        this.maxScoreGainPerSecond = 50000; // 50x normal scoring
        this.maxViolationsBeforeWarn = 8;
        this.maxViolationsBeforeAction = 15;

        // Warning state
        this.warningMessage = '';
        this.warningTimer = 0;
        this.suspicionLevel = 0;
    }

    init(player) {
        if (!player) return;
        this._lastMoney = player && player.hp ? 0 : 0;
        this._lastMoneyCheckTime = performance.now();
        this._lastScore = 0;
        this._lastScoreCheckTime = performance.now();
        this._initialized = true;
        this.violations = [];
        this.suspicionLevel = 0;
        this.warningMessage = '';
        this.warningTimer = 0;
    }

    update(dt, player, scoreManager, game) {
        if (!this.enabled || !this._initialized) return;
        if (!game || !game.persistence) return;

        const now = performance.now();

        // Decay violations slowly over time
        this.violationDecayTimer += dt * 1000;
        if (this.violationDecayTimer >= this.violationDecayInterval) {
            this.violationDecayTimer = 0;
            if (this.violations.length > 0) this.violations.shift();
        }

        // Warning timer
        if (this.warningTimer > 0) this.warningTimer -= dt * 1000;

        // Only check money and score - no other metrics
        this._checkMoneyGain(game, now);
        this._checkScoreGain(scoreManager, now);

        // Update suspicion level (very slowly)
        this.suspicionLevel = Math.max(0, Math.min(100,
            this.violations.length * (100 / this.maxViolationsBeforeAction)
        ));

        // Only take action at very high violation count (many consecutive offenses)
        if (this.violations.length >= this.maxViolationsBeforeAction) {
            this._onExploitDetected(game);
        }

        this._lastMoney = game.persistence.data.coins || 0;
        this._lastScore = scoreManager ? scoreManager.score : 0;
        this._lastMoneyCheckTime = now;
        this._lastScoreCheckTime = now;
    }

    _checkMoneyGain(game, now) {
        const elapsed = (now - this._lastMoneyCheckTime) / 1000;
        if (elapsed < 2) return; // Check every 2 seconds minimum

        const currentMoney = game.persistence.data.coins || 0;
        const moneyDelta = currentMoney - this._lastMoney;

        // Skip if money decreased (spent coins) or no change
        if (moneyDelta <= 0) return;

        const moneyRate = moneyDelta / elapsed;

        // Only flag if gaining money 50x faster than possible
        // Normal gameplay: ~100-500 coins per minute max
        // 50x that = 5000-25000 coins per minute = ~83-416 per second
        if (moneyRate > this.maxMoneyGainPerSecond && moneyDelta > 10000) {
            this._addViolation('money', `Money exploit: +${Math.round(moneyDelta)} in ${elapsed.toFixed(1)}s (${Math.round(moneyRate)}/s)`);
        }
    }

    _checkScoreGain(scoreManager, now) {
        const elapsed = (now - this._lastScoreCheckTime) / 1000;
        if (elapsed < 2) return;

        if (!scoreManager) return;

        const scoreDelta = scoreManager.score - this._lastScore;

        // Skip if score decreased or no change
        if (scoreDelta <= 0) return;

        const scoreRate = scoreDelta / elapsed;

        // Only flag impossible score gains
        // Normal: ~100-500 score per wave, takes 30-60 seconds
        // So 10-15 score per second is very good
        // 50x that = 500-750 score per second
        if (scoreRate > this.maxScoreGainPerSecond && scoreDelta > 10000) {
            this._addViolation('score', `Score exploit: +${Math.round(scoreDelta)} in ${elapsed.toFixed(1)}s`);
        }
    }

    _addViolation(type, detail) {
        // Prevent spam - only add if different type or 5s gap
        const lastViolation = this.violations[this.violations.length - 1];
        if (lastViolation) {
            if (lastViolation.type === type && performance.now() - lastViolation.time < 5000) {
                return;
            }
        }

        this.violations.push({
            type,
            detail,
            time: performance.now()
        });

        // Cap violations array
        if (this.violations.length > this.maxViolations) {
            this.violations.shift();
        }

        // Show warning at high threshold
        if (this.violations.length >= this.maxViolationsBeforeWarn &&
            this.violations.length < this.maxViolationsBeforeAction) {
            this.warningMessage = 'Anti-cheat: Unusual activity detected. Please disable any cheats.';
            this.warningTimer = 5000;
        }
    }

    _onExploitDetected(game) {
        // Log detected exploit but don't auto-punish
        // In a real game this would send to server for review
        console.warn('Anti-cheat: Possible exploit detected', {
            violations: this.violations.length,
            lastViolation: this.violations[this.violations.length - 1]
        });

        // Show warning to player
        this.warningMessage = 'Anti-cheat: Suspicious activity logged. Your run may be reviewed.';
        this.warningTimer = 8000;

        // Reset violations
        this.violations = [];
        this.suspicionLevel = 30; // Lower back down
    }

    render(ctx, screenWidth, screenHeight) {
        if (this.warningTimer <= 0) return;

        const alpha = Math.min(1, this.warningTimer / 2000);
        const y = screenHeight - 50;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(200,100,0,0.8)';
        ctx.fillRect(0, y - 5, screenWidth, 35);
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.warningMessage, screenWidth / 2, y + 12);
        ctx.restore();
    }

    getStatus() {
        return {
            enabled: this.enabled,
            violations: this.violations.length,
            suspicionLevel: this.suspicionLevel,
            lastViolation: this.violations.length > 0 ?
                this.violations[this.violations.length - 1] : null
        };
    }
}