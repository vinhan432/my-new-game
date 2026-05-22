/**
 * Dodge Warfare - Phase 5
 * Network - Leaderboard client, Multiplayer client
 */

// ============================================================
// LEADERBOARD CLIENT
// ============================================================
class LeaderboardClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || CONFIG.leaderboard.url;
    }
    async fetchScores(limit = 20) {
        try {
            const res = await fetch(`${this.baseUrl}/api/scores?limit=${limit}`);
            if (!res.ok) return { error: `HTTP ${res.status}`, scores: [] };
            const json = await res.json();
            return { scores: json.data || json.scores || [] };
        } catch (e) { return { error: 'Connection failed', scores: [] }; }
    }
    async submitScore(data) {
        try {
            const res = await fetch(`${this.baseUrl}/api/scores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) { const err = await res.json().catch(() => ({})); return { error: err.error || `HTTP ${res.status}` }; }
            return await res.json();
        } catch (e) { return { error: 'Connection failed' }; }
    }
}

// ============================================================
// NETWORK CLIENT - Multiplayer via Socket.IO
// ============================================================
class NetworkClient {
    constructor() {
        this.socket = null; this.connected = false; this.roomCode = null;
        this.players = {}; this.isHost = false;
        this.callbacks = {};
        this.lastSentState = 0; this.sendInterval = 50; // 20 updates/sec
    }

    on(event, callback) { this.callbacks[event] = callback; }
    _emit(event, data) { if (this.callbacks[event]) this.callbacks[event](data); }

    connect(url) {
        if (this.socket) this.disconnect();
        try {
            // Socket.IO is loaded from backend
            if (typeof io === 'undefined') {
                console.warn('Socket.IO not loaded. Multiplayer unavailable.');
                return;
            }
            this.socket = io(url || CONFIG.multiplayer.url, {
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                this.connected = true;
                this._emit('connected');
            });

            this.socket.on('disconnect', () => {
                this.connected = false; this.roomCode = null;
                this._emit('disconnected');
            });

            this.socket.on('roomCreated', (data) => {
                this.roomCode = data.code; this.isHost = true;
                this._emit('roomCreated', data);
            });

            this.socket.on('roomJoined', (data) => {
                this.roomCode = data.code; this.isHost = false;
                this._emit('roomJoined', data);
            });

            this.socket.on('playerJoined', (data) => {
                this._emit('playerJoined', data);
            });

            this.socket.on('playerLeft', (data) => {
                delete this.players[data.id];
                this._emit('playerLeft', data);
            });

            this.socket.on('playerUpdate', (data) => {
                this.players[data.id] = {
                    ...data,
                    lastUpdate: performance.now()
                };
            });

            this.socket.on('playerShoot', (data) => {
                this._emit('remoteShoot', data);
            });

            this.socket.on('enemyDamage', (data) => {
                this._emit('remoteEnemyDamage', data);
            });

            this.socket.on('waveStart', (data) => {
                this._emit('remoteWaveStart', data);
            });

            this.socket.on('gameState', (data) => {
                this._emit('remoteGameState', data);
            });

            this.socket.on('error', (data) => {
                this._emit('error', data);
            });

        } catch (e) { console.warn('Multiplayer connection failed:', e); }
    }

    createRoom(playerName) {
        if (this.socket && this.connected) {
            this.socket.emit('createRoom', { name: playerName });
        }
    }

    joinRoom(code, playerName) {
        if (this.socket && this.connected) {
            this.socket.emit('joinRoom', { code: code.toUpperCase(), name: playerName });
        }
    }

    leaveRoom() {
        if (this.socket) {
            this.socket.emit('leaveRoom');
            this.roomCode = null; this.players = {};
        }
    }

    sendPlayerState(state) {
        if (!this.socket || !this.connected || !this.roomCode) return;
        const now = performance.now();
        if (now - this.lastSentState < this.sendInterval) return;
        this.lastSentState = now;
        this.socket.emit('stateUpdate', state);
    }

    sendShoot(data) {
        if (this.socket && this.connected && this.roomCode) {
            this.socket.emit('playerShoot', data);
        }
    }

    sendEnemyDamage(data) {
        if (this.socket && this.connected && this.roomCode) {
            this.socket.emit('enemyDamage', data);
        }
    }

    sendWaveStart(wave) {
        if (this.socket && this.connected && this.roomCode) {
            this.socket.emit('waveStart', { wave });
        }
    }

    getRemotePlayers() {
        const now = performance.now();
        const active = {};
        for (const [id, p] of Object.entries(this.players)) {
            if (now - p.lastUpdate < 2000) active[id] = p; // Remove stale
        }
        this.players = active;
        return active;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false; this.roomCode = null; this.players = {};
    }
}
