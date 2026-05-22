const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'dodge_warfare.db');

let db = null;
let SQL = null;

async function init() {
  SQL = await initSqlJs();

  // Try to load existing database
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('[DB] Loaded existing database from', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }

  // Create tables if not exist
  db.run(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerName TEXT NOT NULL,
      score INTEGER NOT NULL,
      waveReached INTEGER NOT NULL,
      kills INTEGER NOT NULL,
      runDuration INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('solo', 'coop')),
      version TEXT NOT NULL DEFAULT '1.0.0',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (score DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_leaderboard_mode ON leaderboard (mode, score DESC)
  `);

  save();
  console.log('[DB] SQLite initialized (sql.js)');
}

function save() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('[DB] Failed to save:', e.message);
  }
}

function insertScore({ playerName, score, waveReached, kills, runDuration, mode, version }) {
  if (!db) throw new Error('Database not initialized');

  db.run(
    `INSERT INTO leaderboard (playerName, score, waveReached, kills, runDuration, mode, version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [playerName, score, waveReached, kills, runDuration, mode || 'solo', version || '1.0.0']
  );
  save();

  // Get rank (parameterized to prevent SQL injection)
  const rankResult = db.exec(
    `SELECT COUNT(*) + 1 as rank FROM leaderboard WHERE mode = ? AND score > ?`,
    [mode || 'solo', score]
  );
  const rank = rankResult.length > 0 && rankResult[0].values.length > 0
    ? rankResult[0].values[0][0]
    : 1;

  return { rank };
}

function getTopScores(limit = 20, mode = null) {
  if (!db) return [];

  const validLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);

  let query, params;
  if (mode && (mode === 'solo' || mode === 'coop')) {
    query = `
      SELECT id, playerName, score, waveReached, kills, runDuration, mode, version, createdAt
      FROM leaderboard
      WHERE mode = ?
      ORDER BY score DESC
      LIMIT ?
    `;
    params = [mode, validLimit];
  } else {
    query = `
      SELECT id, playerName, score, waveReached, kills, runDuration, mode, version, createdAt
      FROM leaderboard
      ORDER BY score DESC
      LIMIT ?
    `;
    params = [validLimit];
  }

  const result = db.exec(query, params);
  if (result.length === 0) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function close() {
  if (db) {
    save();
    db.close();
    db = null;
    console.log('[DB] Connection closed');
  }
}

module.exports = { init, insertScore, getTopScores, close };
