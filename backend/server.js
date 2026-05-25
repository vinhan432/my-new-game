const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
 7| const db = require('./db');\
 8| const path = require('path');\
 9| app.use(express.static(path.join(__dirname, '..')));\
 10| \

10|app.use(express.static(path.join(__dirname, '..')));
11|// --- Express setup ---

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  credentials: false
}));
// Disable helmet CSP for local dev — it blocks Chrome DevTools discovery and WebSocket connections
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json());

// Suppress favicon 404 noise
app.get('/favicon.ico', (req, res) => res.status(204).end());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// --- Database init (must complete before server accepts requests) ---

let dbReady = false;
db.init().then(() => { dbReady = true; }).catch(err => { console.error('[DB] Init failed:', err.message); });

// --- Validation helpers ---

const NAME_REGEX = /^[a-zA-Z0-9 ]{1,20}$/;

function validateScore(body) {
  const errors = [];

  if (!body.playerName || typeof body.playerName !== 'string') {
    errors.push('playerName is required');
  } else if (!NAME_REGEX.test(body.playerName)) {
    errors.push('playerName must be 1-20 alphanumeric characters or spaces');
  }

  if (body.score === undefined || body.score === null) {
    errors.push('score is required');
  } else if (typeof body.score !== 'number' || body.score < 0 || body.score > 10000000) {
    errors.push('score must be a number between 0 and 10000000');
  }

  if (body.waveReached === undefined || body.waveReached === null) {
    errors.push('waveReached is required');
  } else if (typeof body.waveReached !== 'number' || body.waveReached < 1 || body.waveReached > 9999) {
    errors.push('waveReached must be a number between 1 and 9999');
  }

  if (body.kills === undefined || body.kills === null) {
    errors.push('kills is required');
  } else if (typeof body.kills !== 'number' || body.kills < 0 || body.kills > 99999) {
    errors.push('kills must be a number between 0 and 99999');
  }

  if (body.runDuration === undefined || body.runDuration === null) {
    errors.push('runDuration is required');
  } else if (typeof body.runDuration !== 'number' || body.runDuration < 0 || body.runDuration > 86400) {
    errors.push('runDuration must be a number between 0 and 86400');
  }

  if (body.mode && body.mode !== 'solo' && body.mode !== 'coop') {
    errors.push("mode must be 'solo' or 'coop'");
  }

  // Impossible value checks
  if (typeof body.score === 'number' && typeof body.waveReached === 'number') {
    // Max score per wave is roughly 50000
    if (body.score > 50000 * body.waveReached) {
      errors.push('Score exceeds maximum possible value for the given wave');
    }
    // Must have some score if reached later waves (enemies give points)
    if (body.waveReached >= 3 && body.score < 100) {
      errors.push('Score too low for wave reached');
    }
  }

  // Kills consistency: must have kills if reached later waves
  if (typeof body.kills === 'number' && typeof body.waveReached === 'number') {
    if (body.waveReached >= 2 && body.kills < 1) {
      errors.push('Must have at least 1 kill to reach wave 2+');
    }
    // Each wave spawns ~5-15 enemies, so max kills is roughly 15 * wave
    if (body.kills > 20 * body.waveReached) {
      errors.push('Kills exceed maximum possible for the given wave');
    }
  }

  // Run duration consistency: each wave takes at least 15 seconds
  if (typeof body.runDuration === 'number' && typeof body.waveReached === 'number') {
    const minDuration = body.waveReached * 10; // 10 seconds minimum per wave
    if (body.runDuration < minDuration) {
      errors.push('Run duration too short for wave reached');
    }
    // Max ~5 minutes per wave (300 seconds)
    if (body.runDuration > body.waveReached * 300 + 60) {
      errors.push('Run duration exceeds maximum for wave reached');
    }
  }

  // Kill rate check: max ~3 kills/second (shotgun burst at close range)
  if (typeof body.kills === 'number' && typeof body.runDuration === 'number' && body.runDuration > 0) {
    const killRate = body.kills / body.runDuration;
    if (killRate > 5) {
      errors.push('Kill rate exceeds maximum possible value');
    }
  }

  // Score per kill ratio: min ~50 points per kill (grunt = 100pts)
  if (typeof body.score === 'number' && typeof body.kills === 'number' && body.kills > 0) {
    const scorePerKill = body.score / body.kills;
    if (scorePerKill < 30) {
      errors.push('Score per kill too low');
    }
  }

  return errors;
}

// --- REST endpoints ---

// Middleware to ensure DB is ready
function requireDb(req, res, next) {
  if (!dbReady) return res.status(503).json({ success: false, error: 'Database initializing' });
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', dbReady, uptime: process.uptime() });
});

app.get('/api/scores', requireDb, (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const mode = req.query.mode || null;
    const scores = db.getTopScores(limit, mode);
    res.json({ success: true, data: scores });
  } catch (error) {
    console.error('[GET /api/scores]:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch scores' });
  }
});

app.post('/api/scores', requireDb, (req, res) => {
  try {
    const errors = validateScore(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.join(', ') });
    }

    const { playerName, score, waveReached, kills, runDuration, mode, version } = req.body;

    const result = db.insertScore({
      playerName: playerName.trim(),
      score,
      waveReached,
      kills,
      runDuration,
      mode: mode || 'solo',
      version: version || '1.0.0'
    });

    res.json({ success: true, rank: result.rank });
  } catch (error) {
    console.error('[POST /api/scores]:', error.message);
    res.status(500).json({ success: false, error: 'Failed to save score' });
  }
});

// --- Socket.IO setup ---

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: { maxDisconnectionDuration: 30000 }
});

// Connection rate limiting for Socket.IO
const connectionCounts = new Map();
io.use((socket, next) => {
  const ip = socket.handshake.address;
  const now = Date.now();
  const entry = connectionCounts.get(ip);
  if (entry) {
    // Allow max 10 connections per 5 minutes per IP
    if (now - entry.windowStart < 300000 && entry.count >= 10) {
      return next(new Error('Too many connections'));
    }
    if (now - entry.windowStart >= 300000) { entry.windowStart = now; entry.count = 0; }
    entry.count++;
  } else {
    connectionCounts.set(ip, { windowStart: now, count: 1 });
  }
  next();
});

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

function getRoomBySocket(socket) {
  for (const [code, room] of rooms) {
    if (room.players.has(socket.id)) {
      return { code, room };
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('[Socket] Connected:', socket.id);

  socket.on('createRoom', (data, callback) => {
    try {
      const existing = getRoomBySocket(socket);
      if (existing) {
        socket.leave(existing.code);
        existing.room.players.delete(socket.id);
      }

      const code = generateRoomCode();
      const name = (data && data.name) ? String(data.name).slice(0, 20) : 'Player';

      rooms.set(code, {
        state: 'waiting',
        players: new Map([[socket.id, {
          id: socket.id,
          name,
          x: 0, y: 0, angle: 0,
          weaponIndex: 0,
          currentMag: 0,
          isReloading: false,
          hp: 100
        }]])
      });

      socket.join(code);
      socket.roomCode = code;

      console.log(`[Room] Created: ${code} by ${name}`);

      if (typeof callback === 'function') {
        callback({ success: true, code });
      }
    } catch (error) {
      console.error('[Socket:createRoom]:', error.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to create room' });
      }
    }
  });

  socket.on('joinRoom', (data, callback) => {
    try {
      if (!data || !data.code || !data.name) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'code and name are required' });
        }
        return;
      }

      const code = String(data.code).toUpperCase();
      const name = String(data.name).slice(0, 20);
      const room = rooms.get(code);

      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Room not found' });
        }
        return;
      }

      if (room.players.size >= 4) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Room is full' });
        }
        return;
      }

      // Leave existing room if in one
      const existing = getRoomBySocket(socket);
      if (existing) {
        socket.leave(existing.code);
        existing.room.players.delete(socket.id);
        io.to(existing.code).emit('playerLeft', { id: socket.id });
      }

      room.players.set(socket.id, {
        id: socket.id,
        name,
        x: 0, y: 0, angle: 0,
        weaponIndex: 0,
        currentMag: 0,
        isReloading: false,
        hp: 100
      });

      socket.join(code);
      socket.roomCode = code;

      // Notify others
      socket.to(code).emit('playerJoined', { id: socket.id, name });

      // Send room state to joiner
      const players = [];
      for (const [id, player] of room.players) {
        if (id !== socket.id) {
          players.push(player);
        }
      }

      console.log(`[Room] ${name} joined ${code} (${room.players.size}/4)`);

      if (typeof callback === 'function') {
        callback({ success: true, code, players });
      }
    } catch (error) {
      console.error('[Socket:joinRoom]:', error.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to join room' });
      }
    }
  });

  socket.on('leaveRoom', () => {
    handleLeaveRoom(socket);
  });

  socket.on('stateUpdate', (data) => {
    const existing = getRoomBySocket(socket);
    if (!existing) return;

    const { code, room } = existing;
    const player = room.players.get(socket.id);
    if (!player) return;

    // Update stored state
    if (data) {
      if (typeof data.x === 'number') player.x = data.x;
      if (typeof data.y === 'number') player.y = data.y;
      if (typeof data.angle === 'number') player.angle = data.angle;
      if (typeof data.weaponIndex === 'number') player.weaponIndex = data.weaponIndex;
      if (typeof data.currentMag === 'number') player.currentMag = data.currentMag;
      if (typeof data.isReloading === 'boolean') player.isReloading = data.isReloading;
      if (typeof data.hp === 'number') player.hp = data.hp;
    }

    socket.to(code).emit('playerUpdate', {
      id: socket.id,
      ...player
    });
  });

  socket.on('enemyDamage', (data) => {
    const existing = getRoomBySocket(socket);
    if (!existing) return;
    socket.to(existing.code).emit('enemyDamage', data);
  });

  socket.on('playerShoot', (data) => {
    const existing = getRoomBySocket(socket);
    if (!existing) return;
    socket.to(existing.code).emit('playerShoot', { id: socket.id, ...data });
  });

  socket.on('waveStart', (data) => {
    const existing = getRoomBySocket(socket);
    if (!existing) return;

    existing.room.state = 'playing';
    io.to(existing.code).emit('waveStart', data);
  });

  socket.on('pickupCollected', (data) => {
    const existing = getRoomBySocket(socket);
    if (!existing) return;
    socket.to(existing.code).emit('pickupCollected', { id: socket.id, ...data });
  });

  socket.on('playerDown', () => {
    const existing = getRoomBySocket(socket);
    if (!existing) return;
    socket.to(existing.code).emit('playerDown', { id: socket.id });
  });

  socket.on('playerRevive', (data) => {
    const existing = getRoomBySocket(socket);
    if (!existing) return;
    socket.to(existing.code).emit('playerRevive', { id: socket.id, ...data });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected:', socket.id);
    handleLeaveRoom(socket);
  });
});

function handleLeaveRoom(socket) {
  const existing = getRoomBySocket(socket);
  if (!existing) return;

  const { code, room } = existing;
  const player = room.players.get(socket.id);
  room.players.delete(socket.id);
  socket.leave(code);
  socket.roomCode = null;

  if (room.players.size === 0) {
    rooms.delete(code);
    console.log(`[Room] Deleted: ${code}`);
  } else {
    io.to(code).emit('playerLeft', { id: socket.id, name: player ? player.name : null });
    console.log(`[Room] Player left ${code} (${room.players.size}/4)`);
  }
}

// --- Graceful shutdown ---

function shutdown() {
  console.log('\n[Server] Shutting down...');
  db.close();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// --- Start server ---

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`[Server] Dodge Warfare backend running on port ${PORT}`);
  console.log(`[Server] REST API: http://localhost:${PORT}/api/health`);
});
