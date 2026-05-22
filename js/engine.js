/**
 * Dodge Warfare - Phase 5
 * Engine - Core utilities, Input, Camera, AudioManager, PersistenceManager
 */

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function distance(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2); }
function rectContains(rx, ry, rw, rh, px, py, pr = 0) {
    return px + pr > rx && px - pr < rx + rw && py + pr > ry && py - pr < ry + rh;
}
function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    return distance(cx, cy, closestX, closestY) < cr;
}
function resolveCircleRect(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dist = distance(cx, cy, closestX, closestY);
    if (dist < cr && dist > 0) {
        const overlap = cr - dist;
        return { x: cx + ((cx - closestX) / dist) * overlap, y: cy + ((cy - closestY) / dist) * overlap, overlap };
    }
    return null;
}
function randomRange(min, max) { return min + Math.random() * (max - min); }

// ============================================================
// OBJECT POOL - Reuse objects to reduce GC pressure
// ============================================================
class ObjectPool {
    constructor(factory, resetFn, initialSize = 50) {
        this._factory = factory;
        this._resetFn = resetFn;
        this._pool = [];
        for (let i = 0; i < initialSize; i++) this._pool.push(factory());
    }
    get(...args) {
        const obj = this._pool.length > 0 ? this._pool.pop() : this._factory();
        this._resetFn(obj, ...args);
        return obj;
    }
    release(obj) {
        obj.active = false;
        this._pool.push(obj);
    }
}

// ============================================================
// PARTICLE - Reusable base class for all visual effects
// ============================================================
class Particle {
    constructor(x, y, vx, vy, life, size, color, opts = {}) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.age = 0; this.size = size; this.color = color;
        this.active = true; this.alpha = opts.alpha || 1;
        this.gravity = opts.gravity || 0; this.fadeIn = opts.fadeIn || 0;
        this.shrink = opts.shrink || false; this.shape = opts.shape || 'rect';
        this.isSmoke = opts.isSmoke || false; this.rotation = opts.rotation || 0;
        this.rotSpeed = opts.rotSpeed || 0; this.friction = opts.friction || 0;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vy += this.gravity * dt;
        if (this.friction) { this.vx *= (1 - this.friction * dt); this.vy *= (1 - this.friction * dt); }
        this.age += dt * 1000; this.rotation += this.rotSpeed * dt;
        if (this.age > this.life) this.active = false;
    }
    render(ctx, cam) {
        const sx = this.x - cam.x, sy = this.y - cam.y;
        if (sx < -20 || sx > ctx.canvas.width + 20 || sy < -20 || sy > ctx.canvas.height + 20) return;
        const progress = this.age / this.life;
        let a = this.alpha * (1 - progress);
        if (this.fadeIn && this.age < this.fadeIn) a *= this.age / this.fadeIn;
        const sz = this.shrink ? this.size * (1 - progress * 0.7) : this.size;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = this.color;
        if (this.isSmoke || this.shape === 'circle') {
            ctx.beginPath(); ctx.arc(sx, sy, sz, 0, Math.PI * 2); ctx.fill();
        } else if (this.rotation) {
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.rotation);
            ctx.fillRect(-sz / 2, -sz / 2, sz, sz); ctx.restore();
        } else {
            ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
        }
        ctx.globalAlpha = 1;
    }
}
function randomInt(min, max) { return Math.floor(randomRange(min, max + 1)); }
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}
function rgbaFromHex(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ============================================================
// INPUT
// ============================================================
class Input {
    constructor(canvas) {
        this.keys = {}; this.keysJustPressed = {};
        this.mouse = { x: 0, y: 0, leftDown: false, rightDown: false, wheel: 0 };
        this.canvas = canvas; this._bindEvents();
    }
    _bindEvents() {
        window.addEventListener('keydown', (e) => {
            // Block gameplay keys while typing in text fields
            if (typeof game !== 'undefined' && game.gameState && (game.gameState.nameInputActive || game.gameState.roomCodeInputActive)) return;
            if (!this.keys[e.code]) this.keysJustPressed[e.code] = true;
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyR', 'Escape', 'Backquote', 'Tab'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => {
            if (typeof game !== 'undefined' && game.gameState && (game.gameState.nameInputActive || game.gameState.roomCodeInputActive)) return;
            this.keys[e.code] = false;
        });
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left; this.mouse.y = e.clientY - rect.top;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            // Block mouse clicks while typing in text fields
            if (typeof game !== 'undefined' && game.gameState && (game.gameState.nameInputActive || game.gameState.roomCodeInputActive)) return;
            if (e.button === 0) this.mouse.leftDown = true;
            if (e.button === 2) this.mouse.rightDown = true;
        });
        this.canvas.addEventListener('mouseup', (e) => {
            if (typeof game !== 'undefined' && game.gameState && (game.gameState.nameInputActive || game.gameState.roomCodeInputActive)) return;
            if (e.button === 0) this.mouse.leftDown = false;
            if (e.button === 2) this.mouse.rightDown = false;
        });
        this.canvas.addEventListener('wheel', (e) => {
            this.mouse.wheel = Math.sign(e.deltaY);
            e.preventDefault();
        }, { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        // Prevent text selection
        this.canvas.addEventListener('selectstart', (e) => e.preventDefault());
    }
    isKey(code) { return !!this.keys[code]; }
    justPressed(code) { return !!this.keysJustPressed[code]; }
    clearJustPressed() { this.keysJustPressed = {}; this.mouse.wheel = 0; }
}

// ============================================================
// CAMERA - Smooth follow with screen shake
// ============================================================
class Camera {
    constructor(worldWidth, worldHeight) {
        this.x = 0; this.y = 0; this.targetX = 0; this.targetY = 0;
        this.worldWidth = worldWidth; this.worldHeight = worldHeight;
        this.lerpFactor = CONFIG.camera.lerpFactor;
        this.shakes = []; this.shakeX = 0; this.shakeY = 0; this.shakeMultiplier = 1.0;
    }
    follow(targetX, targetY, canvasWidth, canvasHeight) {
        this.targetX = targetX - canvasWidth / 2; this.targetY = targetY - canvasHeight / 2;
        this.x = lerp(this.x, this.targetX, this.lerpFactor);
        this.y = lerp(this.y, this.targetY, this.lerpFactor);
        this.x = clamp(this.x, 0, this.worldWidth - canvasWidth);
        this.y = clamp(this.y, 0, this.worldHeight - canvasHeight);
    }
    triggerShake(duration = CONFIG.camera.shakeDuration, intensity = CONFIG.camera.shakeIntensity) {
        if (this.shakes.length < CONFIG.camera.maxShakeStack) {
            this.shakes.push({ timer: duration, duration, intensity });
        }
    }
    updateShake(dt) {
        this.shakeX = 0; this.shakeY = 0;
        for (let i = this.shakes.length - 1; i >= 0; i--) {
            const s = this.shakes[i];
            s.timer -= dt * 1000;
            if (s.timer <= 0) { this.shakes.splice(i, 1); continue; }
            const decay = s.timer / s.duration;
            this.shakeX += (Math.random() - 0.5) * s.intensity * decay * this.shakeMultiplier;
            this.shakeY += (Math.random() - 0.5) * s.intensity * decay * this.shakeMultiplier;
        }
    }
    getOffset() { return { x: this.x + this.shakeX, y: this.y + this.shakeY }; }
}

// ============================================================
// AUDIO MANAGER - Web Audio API procedural sounds
// ============================================================
class AudioManager {
    constructor() {
        this.ctx = null; this.masterVolume = 0.7; this.sfxVolume = 0.8;
        this.musicVolume = 0.35; this.muted = false; this.initialized = false;
        this.musicOsc = null; this.musicGain = null; this.musicPlaying = false;
    }
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.ctx.destination);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);
            this.musicGainNode = this.ctx.createGain();
            this.musicGainNode.gain.value = this.musicVolume;
            this.musicGainNode.connect(this.masterGain);
            this.initialized = true;
        } catch (e) { console.warn('Web Audio API not available'); }
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    setMasterVolume(v) { this.masterVolume = v; if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : v; }
    setSfxVolume(v) { this.sfxVolume = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
    setMusicVolume(v) { this.musicVolume = v; if (this.musicGainNode) this.musicGainNode.gain.value = v; }
    toggleMute() { this.muted = !this.muted; if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.masterVolume; return this.muted; }

    playSound(name) {
        if (!this.initialized || this.muted) return;
        this.resume();
        try {
            switch (name) {
                case 'shoot': this._shootSound(800, 200, 0.08, 0.25); break;
                case 'rifle': this._shootSound(1000, 300, 0.05, 0.2); break;
                case 'shotgun': this._shotgunSound(); break;
                case 'sniper': this._sniperSound(); break;
                case 'reload': this._reloadSound(); break;
                case 'reloadComplete': this._reloadCompleteSound(); break;
                case 'empty': this._emptySound(); break;
                case 'hit': this._hitSound(); break;
                case 'enemyHit': this._enemyHitSound(); break;
                case 'enemyDeath': this._enemyDeathSound(); break;
                case 'playerHit': this._playerHitSound(); break;
                case 'explosion': this._explosionSound(); break;
                case 'pickup': this._pickupSound(); break;
                case 'waveStart': this._waveStartSound(); break;
                case 'waveComplete': this._waveCompleteSound(); break;
                case 'dodge': this._dodgeSound(); break;
                case 'gameOver': this._gameOverSound(); break;
                case 'menuSelect': this._menuSelectSound(); break;
                case 'menuNavigate': this._menuNavigateSound(); break;
                case 'weaponSwitch': this._weaponSwitchSound(); break;
                case 'bossWarning': this._bossWarningSound(); break;
                case 'submitSuccess': this._submitSuccessSound(); break;
                case 'submitFail': this._submitFailSound(); break;
            }
        } catch (e) { /* ignore audio errors */ }
    }

    _createOsc(type, freq, duration, volume = 0.3) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.value = freq;
        osc.connect(gain); gain.connect(this.sfxGain);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
        return { osc, gain };
    }

    _noise(duration, volume = 0.2) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        source.connect(gain); gain.connect(this.sfxGain);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        source.start(); source.stop(this.ctx.currentTime + duration);
        return { source, gain };
    }

    _shootSound(freqStart, freqEnd, duration, volume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
        osc.connect(gain); gain.connect(this.sfxGain);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.start(); osc.stop(this.ctx.currentTime + duration);
        this._noise(0.04, 0.15);
    }

    _shotgunSound() {
        this._noise(0.15, 0.4);
        this._createOsc('sawtooth', 400, 0.1, 0.3);
        this._createOsc('square', 200, 0.08, 0.2);
    }

    _sniperSound() {
        this._noise(0.1, 0.3);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    }

    _reloadSound() {
        this._createOsc('sine', 600, 0.08, 0.15);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 800, 0.06, 0.12); }, 200);
    }

    _reloadCompleteSound() {
        this._createOsc('sine', 500, 0.06, 0.15);
        this._createOsc('sine', 700, 0.08, 0.12);
    }

    _emptySound() {
        this._createOsc('square', 200, 0.05, 0.1);
    }

    _hitSound() {
        this._createOsc('square', 300, 0.06, 0.2);
        this._noise(0.03, 0.15);
    }

    _enemyHitSound() {
        this._createOsc('square', 400, 0.05, 0.18);
    }

    _enemyDeathSound() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.2);
        osc.connect(gain); gain.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
        osc.start(); osc.stop(this.ctx.currentTime + 0.25);
    }

    _playerHitSound() {
        this._createOsc('square', 150, 0.15, 0.3);
        this._noise(0.05, 0.2);
    }

    _explosionSound() {
        this._noise(0.4, 0.5);
        this._createOsc('sine', 60, 0.3, 0.4);
        this._createOsc('sine', 40, 0.5, 0.3);
    }

    _pickupSound() {
        this._createOsc('sine', 523, 0.08, 0.15);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 659, 0.08, 0.15); }, 60);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 784, 0.1, 0.15); }, 120);
    }

    _waveStartSound() {
        this._createOsc('square', 220, 0.15, 0.2);
        setTimeout(() => { if (this.initialized) this._createOsc('square', 330, 0.15, 0.2); }, 150);
        setTimeout(() => { if (this.initialized) this._createOsc('square', 440, 0.2, 0.25); }, 300);
    }

    _waveCompleteSound() {
        this._createOsc('sine', 440, 0.1, 0.15);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 554, 0.1, 0.15); }, 80);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 659, 0.1, 0.15); }, 160);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 880, 0.2, 0.2); }, 240);
    }

    _dodgeSound() {
        this._noise(0.08, 0.12);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.start(); osc.stop(this.ctx.currentTime + 0.12);
    }

    _gameOverSound() {
        this._createOsc('sawtooth', 300, 0.3, 0.25);
        setTimeout(() => { if (this.initialized) this._createOsc('sawtooth', 200, 0.3, 0.2); }, 300);
        setTimeout(() => { if (this.initialized) this._createOsc('sawtooth', 100, 0.5, 0.2); }, 600);
    }

    _menuSelectSound() {
        this._createOsc('sine', 600, 0.06, 0.12);
    }

    _menuNavigateSound() {
        this._createOsc('sine', 400, 0.04, 0.08);
    }

    _weaponSwitchSound() {
        this._createOsc('triangle', 500, 0.05, 0.1);
        this._createOsc('triangle', 700, 0.05, 0.08);
    }

    _bossWarningSound() {
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                if (this.initialized) {
                    this._createOsc('square', 200, 0.2, 0.25);
                    this._createOsc('square', 150, 0.25, 0.2);
                }
            }, i * 400);
        }
    }

    _submitSuccessSound() {
        this._createOsc('sine', 523, 0.1, 0.12);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 659, 0.1, 0.12); }, 100);
        setTimeout(() => { if (this.initialized) this._createOsc('sine', 784, 0.15, 0.15); }, 200);
    }

    _submitFailSound() {
        this._createOsc('square', 200, 0.15, 0.15);
        setTimeout(() => { if (this.initialized) this._createOsc('square', 150, 0.2, 0.15); }, 150);
    }

    // Ambient music - subtle procedural background
    startMusic(type) {
        if (!this.initialized || this.musicPlaying) return;
        this.musicPlaying = true;
        this._playAmbientLoop(type);
    }
    stopMusic() { this.musicPlaying = false; }
    _playAmbientLoop(type) {
        if (!this.musicPlaying || !this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const baseFreq = type === 'menu' ? 110 : type === 'boss' ? 82 : 98;
        osc.frequency.setValueAtTime(baseFreq + Math.sin(t * 0.5) * 5, t);
        osc.connect(gain); gain.connect(this.musicGainNode);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 3);
        osc.start(t); osc.stop(t + 3);
        setTimeout(() => this._playAmbientLoop(type), 2500 + Math.random() * 1000);
    }
}

// ============================================================
// PERSISTENCE MANAGER - localStorage
// ============================================================
class PersistenceManager {
    constructor() {
        this.key = 'dodgeWarfare_v5';
        this.data = this._load();
    }
    _defaults() {
        return {
            highScore: 0, bestWave: 0, totalKills: 0, totalRuns: 0,
            playerName: 'Player',
            settings: {
                masterVolume: 0.7, sfxVolume: 0.8, musicVolume: 0.35, muted: false,
                showDamageNumbers: true, showMinimap: true, screenShakeIntensity: 1.0,
                graphicsQuality: 'high', showFps: false
            },
            weaponPreferences: [0]
        };
    }
    _load() {
        try {
            const saved = localStorage.getItem(this.key);
            if (saved) {
                const parsed = JSON.parse(saved);
                const defaults = this._defaults();
                // Merge with defaults for forward compatibility
                return { ...defaults, ...parsed, settings: { ...defaults.settings, ...parsed.settings } };
            }
        } catch (e) { console.warn('Failed to load save data, resetting'); }
        return this._defaults();
    }
    save() {
        try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
    }
    updateRunStats(score, wave, kills) {
        let isNewHighScore = false;
        if (score > this.data.highScore) { this.data.highScore = score; isNewHighScore = true; }
        if (wave > this.data.bestWave) this.data.bestWave = wave;
        this.data.totalKills += kills;
        this.data.totalRuns++;
        this.save();
        return isNewHighScore;
    }
    updateSettings(key, value) {
        this.data.settings[key] = value;
        this.save();
    }
    setPlayerName(name) {
        this.data.playerName = name.substring(0, CONFIG.leaderboard.maxNameLength);
        this.save();
    }
}

// ============================================================
// LIGHTING MANAGER - Dynamic light sources with darkness overlay
// ============================================================
class LightingManager {
    constructor() { this.lights = []; this.maxLights = 30; }
    addLight(x, y, radius, color, intensity, lifetime = 200) {
        if (this.lights.length >= this.maxLights) this.lights.shift();
        this.lights.push({ x, y, radius, color, intensity, lifetime, age: 0 });
    }
    update(dt) {
        for (let i = this.lights.length - 1; i >= 0; i--) {
            this.lights[i].age += dt * 1000;
            if (this.lights[i].age > this.lights[i].lifetime) this.lights.splice(i, 1);
        }
    }
    render(ctx, cameraOffset, canvasWidth, canvasHeight) {
        if (this.lights.length === 0) return;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.globalCompositeOperation = 'lighter';
        for (const light of this.lights) {
            const sx = light.x - cameraOffset.x, sy = light.y - cameraOffset.y;
            const alpha = light.intensity * (1 - light.age / light.lifetime);
            if (alpha < 0.01) continue;
            const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, light.radius);
            gradient.addColorStop(0, `rgba(255,255,255,${alpha * 0.8})`);
            // Parse hex to rgba
            const r = parseInt(light.color.slice(1,3), 16);
            const g = parseInt(light.color.slice(3,5), 16);
            const b = parseInt(light.color.slice(5,7), 16);
            gradient.addColorStop(0.3, `rgba(${r},${g},${b},${alpha * 0.5})`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(sx - light.radius, sy - light.radius, light.radius * 2, light.radius * 2);
        }
        ctx.restore();
    }
}

// ============================================================
// AMBIENT WEATHER - Dust, leaves, embers particles
// ============================================================
class AmbientWeather {
    constructor() {
        this.particles = [];
        this.maxParticles = 60;
        this.spawnTimer = 0;
        this.spawnInterval = 0.05;
    }
    update(dt, playerX, playerY) {
        this.spawnTimer += dt;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.age += dt * 1000;
            if (p.type === 'leaves') {
                p.vx += Math.sin(p.age * 0.003) * 0.5;
                p.vy += 10 * dt;
            }
            if (p.type === 'embers') {
                p.vy -= 30 * dt;
                p.vx += (Math.random() - 0.5) * 20 * dt;
            }
            if (p.age > p.life || p.x < playerX - 900 || p.x > playerX + 900 || p.y < playerY - 900 || p.y > playerY + 900) {
                this.particles.splice(i, 1);
            }
        }
        if (this.spawnTimer >= this.spawnInterval && this.particles.length < this.maxParticles) {
            this.spawnTimer = 0;
            this._spawnNearPlayer(playerX, playerY);
        }
    }
    _spawnNearPlayer(px, py) {
        const x = px + (Math.random() - 0.5) * 1600;
        const y = py + (Math.random() - 0.5) * 1600;
        const types = ['dust', 'dust', 'leaves', 'embers'];
        const type = types[Math.floor(Math.random() * types.length)];
        let particle;
        switch(type) {
            case 'dust':
                particle = { x, y, vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*15, life: 3000+Math.random()*2000, age: 0, size: 1+Math.random()*2, color: '#8B7355', type, alpha: 0.3+Math.random()*0.3 };
                break;
            case 'leaves':
                particle = { x, y: y - 200, vx: 30+Math.random()*40, vy: 20+Math.random()*30, life: 4000+Math.random()*3000, age: 0, size: 2+Math.random()*3, color: ['#2D5A1E','#3A7A28','#4A8A38'][Math.floor(Math.random()*3)], type, alpha: 0.5, rotation: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*3 };
                break;
            case 'embers':
                particle = { x, y: y + 100, vx: (Math.random()-0.5)*30, vy: -50-Math.random()*40, life: 1500+Math.random()*1500, age: 0, size: 1+Math.random()*2, color: ['#FF6600','#FFAA00','#FF4400'][Math.floor(Math.random()*3)], type, alpha: 0.6+Math.random()*0.4 };
                break;
        }
        this.particles.push(particle);
    }
    render(ctx, cameraOffset, quality) {
        if (quality === 'low') return;
        const alpha = quality === 'medium' ? 0.5 : 1.0;
        for (const p of this.particles) {
            const sx = p.x - cameraOffset.x, sy = p.y - cameraOffset.y;
            const lifeRatio = 1 - p.age / p.life;
            const a = p.alpha * lifeRatio * alpha;
            if (a < 0.01) continue;
            ctx.save();
            ctx.globalAlpha = a;
            if (p.type === 'leaves') {
                ctx.translate(sx, sy);
                ctx.rotate(p.rotation || 0);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
                if (p.rotation !== undefined) p.rotation += (p.rotSpeed || 0) * 0.016;
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(sx, sy, p.size * lifeRatio, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
}
