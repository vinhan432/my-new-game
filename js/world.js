/**
 * Dodge Warfare - Phase 5
 * World - TileMap, obstacles, destructibles, hazards
 * Theme-aware terrain generation with mission system
 */

// ============================================================
// TILEMAP - Theme-aware terrain with rich visuals
// ============================================================
class TileMap {
    constructor(worldWidth, worldHeight, theme) {
        this.tileSize = CONFIG.tile.size;
        this.worldWidth = worldWidth || CONFIG.world.width;
        this.worldHeight = worldHeight || CONFIG.world.height;
        this.cols = Math.ceil(this.worldWidth / this.tileSize);
        this.rows = Math.ceil(this.worldHeight / this.tileSize);
        this.theme = theme || 'urban';
        this.themeData = CONFIG.themes[this.theme];
        this.tiles = [];
    }

    generate(missionTerrain) {
        const baseType = this.themeData.base.type;
        // Fill base
        for (let y = 0; y < this.rows; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.tiles[y][x] = { type: baseType, variation: Math.random(), detail: Math.random(), decoration: Math.random() };
            }
        }
        // Roads
        if (missionTerrain && missionTerrain.roads) {
            for (const road of missionTerrain.roads) {
                if (road.orientation === 'vertical') {
                    const cx = Math.floor(this.cols * road.centerFrac), w = road.width;
                    for (let y = 0; y < this.rows; y++) for (let dx = -w; dx <= w; dx++) {
                        const tx = cx + dx;
                        if (tx >= 0 && tx < this.cols) this.tiles[y][tx] = { type: 'road', variation: Math.random(), detail: Math.random(), decoration: 0 };
                    }
                } else if (road.orientation === 'horizontal') {
                    const cy = Math.floor(this.rows * road.centerFrac), w = road.width;
                    for (let x = 0; x < this.cols; x++) for (let dy = -w; dy <= w; dy++) {
                        const ty = cy + dy;
                        if (ty >= 0 && ty < this.rows) this.tiles[ty][x] = { type: 'road', variation: Math.random(), detail: Math.random(), decoration: 0 };
                    }
                } else if (road.orientation === 'diagonal') {
                    const fx1 = Math.floor(this.cols * road.from.x), fy1 = Math.floor(this.rows * road.from.y);
                    const fx2 = Math.floor(this.cols * road.to.x), fy2 = Math.floor(this.rows * road.to.y);
                    const steps = Math.max(Math.abs(fx2 - fx1), Math.abs(fy2 - fy1));
                    for (let s = 0; s <= steps; s++) {
                        const t = s / steps;
                        const cx = Math.round(fx1 + (fx2 - fx1) * t), cy = Math.round(fy1 + (fy2 - fy1) * t);
                        for (let dy = -road.width; dy <= road.width; dy++) for (let dx = -road.width; dx <= road.width; dx++) {
                            const tx = cx + dx, ty = cy + dy;
                            if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows)
                                this.tiles[ty][tx] = { type: 'road', variation: Math.random(), detail: Math.random(), decoration: 0 };
                        }
                    }
                }
            }
        }
        // Terrain patches
        if (missionTerrain && missionTerrain.patches) {
            for (const patch of missionTerrain.patches) {
                const count = patch.count || 10, minR = patch.minR || 1, maxR = patch.maxR || 3;
                for (let i = 0; i < count; i++) {
                    const cx = Math.floor(Math.random() * this.cols), cy = Math.floor(Math.random() * this.rows);
                    const r = minR + Math.floor(Math.random() * (maxR - minR + 1));
                    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
                        if (dx * dx + dy * dy <= r * r) {
                            const tx = cx + dx, ty = cy + dy;
                            if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows && this.tiles[ty][tx].type === baseType)
                                this.tiles[ty][tx] = { type: patch.type, variation: Math.random(), detail: Math.random(), decoration: Math.random() };
                        }
                    }
                }
            }
        }
    }

    render(ctx, cameraOffset, canvasWidth, canvasHeight, quality) {
        const startCol = Math.max(0, Math.floor(cameraOffset.x / this.tileSize));
        const endCol = Math.min(this.cols, Math.ceil((cameraOffset.x + canvasWidth) / this.tileSize) + 1);
        const startRow = Math.max(0, Math.floor(cameraOffset.y / this.tileSize));
        const endRow = Math.min(this.rows, Math.ceil((cameraOffset.y + canvasHeight) / this.tileSize) + 1);
        const td = this.themeData;

        for (let y = startRow; y < endRow; y++) {
            if (!this.tiles[y]) continue;
            for (let x = startCol; x < endCol; x++) {
            const tile = this.tiles[y][x];
            if (!tile) continue;
            const sx = x * this.tileSize - cameraOffset.x, sy = y * this.tileSize - cameraOffset.y;
            // Pick color from theme
            let colors;
            switch (tile.type) {
                case 'road': colors = td.road.colors; break;
                case 'grass': case 'grassDark': colors = td.patch2.type === tile.type ? td.patch2.colors : td.patch1.type === tile.type ? td.patch1.colors : td.base.colors; break;
                case 'sand': case 'dirt': case 'rust': case 'concrete':
                    colors = td.patch1.type === tile.type ? td.patch1.colors : td.patch2.type === tile.type ? td.patch2.colors : td.base.colors;
                    break;
                default: colors = td.base.colors;
            }
            const ci = tile.variation > 0.6 ? 0 : tile.variation > 0.3 ? 1 : 2;
            ctx.fillStyle = colors[ci]; ctx.fillRect(sx, sy, this.tileSize + 1, this.tileSize + 1);

            // Terrain detail (skip on low + medium for performance)
            if (quality === 'high') {
                const v = tile.variation, d = tile.detail, dec = tile.decoration;
                if (tile.type === 'road') {
                    // Cracks
                    if (d > 0.65) { ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx + v * 20, sy + d * 30); ctx.lineTo(sx + 30 + v * 20, sy + 40 + d * 10); ctx.stroke(); }
                    if (d > 0.8) { ctx.fillStyle = 'rgba(80,80,80,0.25)'; ctx.fillRect(sx + 10 + v * 30, sy + 20 + d * 20, 8, 3); }
                    // Lane markings (dashed center lines)
                    if (y % 4 === 0 && (x % 6 < 3)) {
                        ctx.fillStyle = td.road.lineColor; ctx.fillRect(sx + 5, sy + this.tileSize / 2 - 1, this.tileSize - 10, 2);
                    }
                    // Puddles on industrial/concrete
                    if (this.theme === 'industrial' && dec > 0.85) {
                        ctx.fillStyle = 'rgba(40,60,80,0.15)'; ctx.beginPath(); ctx.ellipse(sx + v * 30 + 15, sy + d * 30 + 15, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
                    }
                    // Manhole covers
                    if (dec > 0.92 && d > 0.5) {
                        ctx.strokeStyle = 'rgba(50,50,50,0.3)'; ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.arc(sx + 32, sy + 32, 8, 0, Math.PI * 2); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(sx + 26, sy + 32); ctx.lineTo(sx + 38, sy + 32); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(sx + 32, sy + 26); ctx.lineTo(sx + 32, sy + 38); ctx.stroke();
                    }
                    // Road stains
                    if (dec > 0.78 && d > 0.4) {
                        ctx.fillStyle = 'rgba(30,30,30,0.08)';
                        ctx.beginPath(); ctx.ellipse(sx + v * 40 + 10, sy + d * 40 + 10, 10 + d * 8, 6 + d * 4, v * Math.PI, 0, Math.PI * 2); ctx.fill();
                    }
                } else if (tile.type === 'grass' || tile.type === 'grassDark') {
                    // Grass blades
                    const bladeColor = tile.type === 'grassDark' ? 'rgba(40,80,30,0.5)' : 'rgba(80,130,60,0.4)';
                    ctx.fillStyle = bladeColor;
                    for (let i = 0; i < 6; i++) {
                        const bx = sx + (v * 40 + i * 10) % 55, by = sy + (d * 30 + i * 14) % 50;
                        const bladeH = 3 + d * 5;
                        const bladeLean = Math.sin(v * 10 + i) * 1.5;
                        ctx.beginPath(); ctx.moveTo(bx, by + bladeH); ctx.lineTo(bx + bladeLean, by); ctx.lineTo(bx + bladeLean + 0.5, by + 0.5); ctx.lineTo(bx + 0.5, by + bladeH); ctx.fill();
                    }
                    // Small flowers in forest
                    if (this.theme === 'forest' && dec > 0.88) {
                        const flowerColors = ['#FFE066', '#FF9999', '#99CCFF', '#FFB6C1', '#98FB98'];
                        ctx.fillStyle = flowerColors[Math.floor(v * 5) % 5];
                        ctx.beginPath(); ctx.arc(sx + v * 45 + 8, sy + d * 45 + 8, 2.5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#FFFF00';
                        ctx.beginPath(); ctx.arc(sx + v * 45 + 8, sy + d * 45 + 8, 1, 0, Math.PI * 2); ctx.fill();
                    }
                    // Grass tuft
                    if (dec > 0.75) {
                        ctx.fillStyle = 'rgba(100,160,70,0.25)'; ctx.beginPath(); ctx.arc(sx + v * 40 + 10, sy + d * 40 + 10, 4, 0, Math.PI * 2); ctx.fill();
                    }
                    // Mushrooms in forest
                    if (this.theme === 'forest' && dec > 0.95 && v > 0.7) {
                        ctx.fillStyle = '#D2691E';
                        ctx.fillRect(sx + 20, sy + 35, 2, 5);
                        ctx.fillStyle = '#8B4513';
                        ctx.beginPath(); ctx.arc(sx + 21, sy + 34, 4, Math.PI, 0); ctx.fill();
                    }
                } else if (tile.type === 'dirt') {
                    // Pebbles
                    ctx.fillStyle = 'rgba(90,70,50,0.2)';
                    for (let i = 0; i < 4; i++) {
                        const px = sx + (v * 30 + i * 15) % 50, py = sy + (d * 25 + i * 18) % 50;
                        ctx.beginPath(); ctx.arc(px, py, 1.5 + (i % 2) * d, 0, Math.PI * 2); ctx.fill();
                    }
                    // Tire tracks
                    if (dec > 0.8) {
                        ctx.strokeStyle = 'rgba(60,50,35,0.15)'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(sx + 10, sy + v * 20 + 20); ctx.lineTo(sx + 50, sy + v * 20 + 22); ctx.stroke();
                    }
                    // Small rocks
                    if (dec > 0.85 && v > 0.5) {
                        ctx.fillStyle = 'rgba(100,90,80,0.25)';
                        ctx.beginPath(); ctx.ellipse(sx + 30, sy + 20, 4, 3, v * 2, 0, Math.PI * 2); ctx.fill();
                    }
                } else if (tile.type === 'sand') {
                    // Sand ripples
                    if (d > 0.5) { ctx.strokeStyle = 'rgba(180,170,120,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx + 5, sy + v * 30 + 15); ctx.quadraticCurveTo(sx + 30, sy + v * 20, sx + 55, sy + v * 30 + 20); ctx.stroke(); }
                    // Footprints in sand
                    if (dec > 0.9 && v > 0.6) {
                        ctx.fillStyle = 'rgba(150,140,100,0.15)';
                        ctx.beginPath(); ctx.ellipse(sx + 15, sy + 25, 3, 4, 0.3, 0, Math.PI * 2); ctx.fill();
                        ctx.beginPath(); ctx.ellipse(sx + 25, sy + 30, 3, 4, -0.2, 0, Math.PI * 2); ctx.fill();
                    }
                    // Scorpions/bugs in desert
                    if (this.theme === 'desert' && dec > 0.95) {
                        ctx.fillStyle = 'rgba(80,60,40,0.3)'; ctx.beginPath(); ctx.arc(sx + 30, sy + 30, 2, 0, Math.PI * 2); ctx.fill();
                        ctx.fillRect(sx + 28, sy + 28, 1, 6); ctx.fillRect(sx + 32, sy + 28, 1, 6);
                    }
                } else if (tile.type === 'concrete') {
                    // Concrete seams
                    if (x % 4 === 0) { ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + this.tileSize); ctx.stroke(); }
                    if (y % 4 === 0) { ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + this.tileSize, sy); ctx.stroke(); }
                    // Stains
                    if (dec > 0.85) { ctx.fillStyle = 'rgba(40,40,40,0.1)'; ctx.beginPath(); ctx.ellipse(sx + v * 40 + 10, sy + d * 40 + 10, 8, 6, v * Math.PI, 0, Math.PI * 2); ctx.fill(); }
                    // Cracks in concrete
                    if (dec > 0.8 && d > 0.6) {
                        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5;
                        ctx.beginPath(); ctx.moveTo(sx + 10, sy + 10); ctx.lineTo(sx + 25 + v * 10, sy + 20 + d * 10); ctx.lineTo(sx + 40, sy + 15); ctx.stroke();
                    }
                    // Drain grates
                    if (dec > 0.93 && v > 0.7) {
                        ctx.strokeStyle = 'rgba(40,40,40,0.25)'; ctx.lineWidth = 1;
                        ctx.strokeRect(sx + 20, sy + 20, 12, 12);
                        for (let gi = 0; gi < 3; gi++) {
                            ctx.beginPath(); ctx.moveTo(sx + 23 + gi * 3, sy + 20); ctx.lineTo(sx + 23 + gi * 3, sy + 32); ctx.stroke();
                        }
                    }
                } else if (tile.type === 'rust') {
                    // Rust spots
                    ctx.fillStyle = 'rgba(120,60,20,0.15)';
                    ctx.beginPath(); ctx.arc(sx + v * 40 + 12, sy + d * 40 + 12, 5 + d * 4, 0, Math.PI * 2); ctx.fill();
                    if (dec > 0.7) { ctx.fillStyle = 'rgba(100,50,15,0.1)'; ctx.beginPath(); ctx.arc(sx + (1 - v) * 30 + 10, sy + (1 - d) * 30 + 10, 4, 0, Math.PI * 2); ctx.fill(); }
                    // Metal debris
                    if (dec > 0.88 && v > 0.6) {
                        ctx.fillStyle = 'rgba(80,60,40,0.2)';
                        ctx.save(); ctx.translate(sx + 25, sy + 25); ctx.rotate(v * 3);
                        ctx.fillRect(-5, -2, 10, 4); ctx.restore();
                    }
                } else if (tile.type === 'snow') {
                    // Sparkle on snow
                    if (dec > 0.85 && quality === 'high') {
                        const sparkle = Math.sin(performance.now() * 0.003 + v * 10) * 0.5 + 0.5;
                        ctx.fillStyle = `rgba(255,255,255,${sparkle * 0.4})`;
                        ctx.beginPath(); ctx.arc(sx + v * 50 + 10, sy + d * 50 + 10, 1.5, 0, Math.PI * 2); ctx.fill();
                    }
                    // Footprints in snow
                    if (dec > 0.9 && v > 0.5) {
                        ctx.fillStyle = 'rgba(180,180,200,0.2)';
                        ctx.beginPath(); ctx.ellipse(sx + 20, sy + 30, 3, 4, 0.2, 0, Math.PI * 2); ctx.fill();
                    }
                }
            }
            }
        }
    }
}

// ============================================================
// OBSTACLE BASE
// ============================================================
class Obstacle {
    constructor(x, y, w, h, type) { this.x = x; this.y = y; this.w = w; this.h = h; this.type = type; this.active = true; }
    isSolid() { return true; } blocksBullets() { return true; }
    update(dt, game) {} render(ctx, cameraOffset) {}
    getBounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

// ============================================================
// BUILDING - Enhanced with better detail
// ============================================================
class Building extends Obstacle {
    constructor(x, y, w, h, doorPositions = []) {
        super(x, y, w, h, 'building');
        this.wallThickness = 12; this.doorPositions = doorPositions;
        this.interiorColor = '#5A4D42'; this.wallColor = '#6A6A6A';
        this.roofColor = '#4A4A4A'; this.detailSeed = Math.random();
        this._cachedRects = null;
    }
    isSolid() { return true; } blocksBullets() { return true; }
    getCollisionRects() {
        if (this._cachedRects) return this._cachedRects;
        const walls = [
            { x: this.x, y: this.y, w: this.w, h: this.wallThickness },
            { x: this.x, y: this.y + this.h - this.wallThickness, w: this.w, h: this.wallThickness },
            { x: this.x, y: this.y, w: this.wallThickness, h: this.h },
            { x: this.x + this.w - this.wallThickness, y: this.y, w: this.wallThickness, h: this.h }
        ];
        const result = [];
        for (const wall of walls) {
            let segments = [wall];
            for (const door of this.doorPositions) {
                const doorAbs = { x: this.x + door.x, y: this.y + door.y, w: door.w, h: door.h };
                const newSegments = [];
                for (const seg of segments) {
                    if (!(seg.x < doorAbs.x + doorAbs.w && seg.x + seg.w > doorAbs.x && seg.y < doorAbs.y + doorAbs.h && seg.y + seg.h > doorAbs.y)) {
                        newSegments.push(seg);
                    } else {
                        if (seg.x < doorAbs.x) newSegments.push({ x: seg.x, y: seg.y, w: doorAbs.x - seg.x, h: seg.h });
                        if (seg.x + seg.w > doorAbs.x + doorAbs.w) newSegments.push({ x: doorAbs.x + doorAbs.w, y: seg.y, w: (seg.x + seg.w) - (doorAbs.x + doorAbs.w), h: seg.h });
                        if (seg.y < doorAbs.y) newSegments.push({ x: Math.max(seg.x, doorAbs.x), y: seg.y, w: Math.min(seg.x + seg.w, doorAbs.x + doorAbs.w) - Math.max(seg.x, doorAbs.x), h: doorAbs.y - seg.y });
                        if (seg.y + seg.h > doorAbs.y + doorAbs.h) newSegments.push({ x: Math.max(seg.x, doorAbs.x), y: doorAbs.y + doorAbs.h, w: Math.min(seg.x + seg.w, doorAbs.x + doorAbs.w) - Math.max(seg.x, doorAbs.x), h: (seg.y + seg.h) - (doorAbs.y + doorAbs.h) });
                    }
                }
                segments = newSegments;
            }
            result.push(...segments.filter(r => r.w > 0 && r.h > 0));
        }
        this._cachedRects = result;
        return result;
    }
    render(ctx, cameraOffset) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling — skip offscreen buildings
        if (sx + this.w < 0 || sx > ctx.canvas.width || sy + this.h < 0 || sy > ctx.canvas.height) return;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(sx + 4, sy + 4, this.w, this.h);
        // Interior floor
        ctx.fillStyle = this.interiorColor; ctx.fillRect(sx, sy, this.w, this.h);
        // Interior details (floor tiles, debris)
        const s = this.detailSeed;
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        for (let i = 0; i < 8; i++) {
            const ix = sx + 15 + (s * 40 + i * 37) % (this.w - 30), iy = sy + 15 + (s * 53 + i * 41) % (this.h - 30);
            ctx.fillRect(ix, iy, 6 + (i % 3) * 3, 3);
        }
        // Floor tile grid
        ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
        for (let fy = 0; fy < this.h; fy += 20) { ctx.beginPath(); ctx.moveTo(sx, sy + fy); ctx.lineTo(sx + this.w, sy + fy); ctx.stroke(); }
        for (let fx = 0; fx < this.w; fx += 20) { ctx.beginPath(); ctx.moveTo(sx + fx, sy); ctx.lineTo(sx + fx, sy + this.h); ctx.stroke(); }
        // Interior furniture/details
        if (s > 0.5) {
            // Desk or table
            ctx.fillStyle = 'rgba(80,60,40,0.15)';
            ctx.fillRect(sx + 20 + (s * 30) % (this.w - 60), sy + 20 + (s * 25) % (this.h - 50), 30, 20);
        }
        if (s > 0.3) {
            // Shelf or rack
            ctx.fillStyle = 'rgba(60,50,35,0.12)';
            const shelfX = sx + 10 + (s * 50) % (this.w - 30);
            ctx.fillRect(shelfX, sy + 10, 3, this.h - 20);
        }
        // Walls with highlights
        for (const wall of this.getCollisionRects()) {
            const wx = wall.x - cameraOffset.x, wy = wall.y - cameraOffset.y;
            ctx.fillStyle = this.wallColor; ctx.fillRect(wx, wy, wall.w, wall.h);
            ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(wx, wy, wall.w, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(wx, wy + wall.h - 2, wall.w, 2);
            // Brick pattern on walls
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5;
            for (let row = 0; row < wall.h; row += 5) {
                const off = (Math.floor(row / 5) % 2) * 5;
                for (let col = -10; col < wall.w + 10; col += 10) ctx.strokeRect(wx + col + off, wy + row, 10, 5);
            }
        }
        // Doors
        for (const door of this.doorPositions) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx + door.x, sy + door.y, door.w, door.h);
            ctx.fillStyle = 'rgba(60,50,40,0.4)'; ctx.fillRect(sx + door.x + 1, sy + door.y + 1, door.w - 2, door.h - 2);
            // Door frame
            ctx.strokeStyle = 'rgba(80,60,40,0.5)'; ctx.lineWidth = 1;
            ctx.strokeRect(sx + door.x, sy + door.y, door.w, door.h);
        }
    }
}

// ============================================================
// BRICK WALL
// ============================================================
class BrickWall extends Obstacle {
    constructor(x, y, w, h) { super(x, y, w, h, 'brickWall'); this.color = '#7A3E12'; this.mortarColor = '#9A5222'; }
    render(ctx, cameraOffset) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling
        if (sx + this.w < 0 || sx > ctx.canvas.width || sy + this.h < 0 || sy > ctx.canvas.height) return;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx + 3, sy + 3, this.w, this.h);
        ctx.fillStyle = this.color; ctx.fillRect(sx, sy, this.w, this.h);
        ctx.strokeStyle = this.mortarColor; ctx.lineWidth = 0.5;
        for (let row = 0; row < this.h; row += 5) {
            const offset = (Math.floor(row / 5) % 2) * 5;
            for (let col = -10; col < this.w + 10; col += 10) ctx.strokeRect(sx + col + offset, sy + row, 10, 5);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(sx, sy, this.w, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(sx, sy + this.h - 2, this.w, 2);
    }
}

// ============================================================
// VEHICLE - Unified class for Car, Truck, SUV, Van
// ============================================================
class Vehicle extends Obstacle {
    constructor(x, y, w, h, angle = 0, type = 'car') {
        super(x, y, w, h, type); this.angle = angle; this.vehicleType = type;
        const cfg = CONFIG.vehicleTypes[type] || CONFIG.vehicleTypes.car;
        this.hp = cfg.hp; this.maxHp = cfg.hp; this.destroyed = false;
        this.explosionRadius = cfg.explosionRadius; this.explosionDamage = cfg.explosionDamage;
        this.color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    }
    isSolid() { return !this.destroyed; } blocksBullets() { return !this.destroyed; }
    getBounds() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const cos = Math.abs(Math.cos(this.angle)), sin = Math.abs(Math.sin(this.angle));
        const halfW = this.w / 2, halfH = this.h / 2;
        const newHalfW = halfW * cos + halfH * sin;
        const newHalfH = halfW * sin + halfH * cos;
        return { x: cx - newHalfW, y: cy - newHalfH, w: newHalfW * 2, h: newHalfH * 2 };
    }
    takeDamage(amount, game) {
        if (this.destroyed) return;
        this.hp -= amount;
        if (this.hp <= 0) { this.destroyed = true; game.createExplosion(this.x + this.w / 2, this.y + this.h / 2, this.explosionRadius, this.explosionDamage, this); }
    }
    render(ctx, cameraOffset) {
        const cx = this.x + this.w / 2 - cameraOffset.x, cy = this.y + this.h / 2 - cameraOffset.y;
        const maxDim = Math.sqrt(this.w * this.w + this.h * this.h) / 2 + 10;
        if (cx < -maxDim || cx > ctx.canvas.width + maxDim || cy < -maxDim || cy > ctx.canvas.height + maxDim) return;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(-this.w / 2 + 3, -this.h / 2 + 3, this.w, this.h);
        if (this.destroyed) {
            ctx.fillStyle = '#1A1A1A'; ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
            ctx.fillStyle = '#252525'; ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 4, this.w - 8, this.h - 8);
            ctx.fillStyle = 'rgba(40,20,0,0.4)';
            ctx.beginPath(); ctx.arc(-5, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(60,30,0,0.3)';
            ctx.beginPath(); ctx.arc(8, -3, 6, 0, Math.PI * 2); ctx.fill();
            // Smoke wisps from destroyed vehicle
            ctx.fillStyle = 'rgba(60,60,60,0.15)';
            for (let i = 0; i < 3; i++) {
                const t = performance.now() * 0.001 + i * 2;
                const smokeX = Math.sin(t * 0.7) * 8;
                const smokeY = -this.h / 2 - 5 - Math.abs(Math.sin(t * 0.5)) * 15;
                const smokeR = 4 + Math.sin(t * 1.2) * 2;
                ctx.beginPath(); ctx.arc(smokeX, smokeY, smokeR, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            const damaged = this.hp < this.maxHp / 2;
            ctx.fillStyle = damaged ? '#1A1A1A' : this.color;
            ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
            // Paint shine (gradient)
            if (!damaged) {
                const shine = ctx.createLinearGradient(-this.w / 2, -this.h / 2, -this.w / 2, this.h / 2);
                shine.addColorStop(0, 'rgba(255,255,255,0.08)');
                shine.addColorStop(0.5, 'rgba(255,255,255,0)');
                shine.addColorStop(1, 'rgba(0,0,0,0.05)');
                ctx.fillStyle = shine;
                ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
            }
            // Type-specific details
            if (this.vehicleType === 'truck') {
                ctx.fillStyle = damaged ? '#151515' : 'rgba(30,30,30,0.8)';
                ctx.fillRect(this.w / 2 - 25, -this.h / 2 + 2, 22, this.h - 4);
                ctx.fillStyle = 'rgba(100,150,200,0.3)';
                ctx.fillRect(this.w / 2 - 22, -this.h / 2 + 4, 4, this.h - 8);
                ctx.fillStyle = 'rgba(20,20,20,0.5)';
                ctx.fillRect(-this.w / 2 + 2, -this.h / 2 + 3, this.w / 2 - 5, this.h - 6);
                // Cargo details
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath(); ctx.moveTo(-this.w / 2 + 5 + i * 15, -this.h / 2 + 3); ctx.lineTo(-this.w / 2 + 5 + i * 15, this.h / 2 - 3); ctx.stroke();
                }
            } else if (this.vehicleType === 'suv') {
                ctx.fillStyle = 'rgba(20,20,20,0.6)';
                ctx.fillRect(-this.w / 4, -this.h / 2 + 2, this.w / 2, this.h - 4);
                ctx.fillStyle = 'rgba(100,150,200,0.35)';
                ctx.fillRect(-this.w / 4 + 3, -this.h / 2 + 4, this.w / 2 - 6, this.h - 8);
                // Roof rack
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
                ctx.strokeRect(-this.w / 4 + 5, -this.h / 2, this.w / 2 - 10, 2);
            } else if (this.vehicleType === 'van') {
                ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(-this.w / 4, -this.h / 2); ctx.lineTo(-this.w / 4, this.h / 2); ctx.stroke();
                ctx.fillStyle = 'rgba(100,150,200,0.3)';
                ctx.fillRect(this.w / 2 - 18, -this.h / 2 + 3, 5, this.h - 6);
                // Side door handle
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(-this.w / 4 + 5, -2, 8, 3);
            } else {
                // Car: roof/window
                ctx.fillStyle = '#111A2A';
                ctx.fillRect(-this.w / 4, -this.h / 2 + 3, this.w / 2, this.h / 3);
                ctx.fillStyle = 'rgba(100,150,200,0.3)';
                ctx.fillRect(-this.w / 4 + 2, -this.h / 2 + 4, this.w / 2 - 4, this.h / 3 - 2);
                // Window reflection
                ctx.fillStyle = 'rgba(200,220,255,0.1)';
                ctx.beginPath(); ctx.moveTo(-this.w / 4 + 3, -this.h / 2 + 5); ctx.lineTo(-this.w / 4 + 12, -this.h / 2 + 5); ctx.lineTo(-this.w / 4 + 3, -this.h / 2 + 12); ctx.closePath(); ctx.fill();
            }
            // Wheels (all types)
            ctx.fillStyle = '#111';
            const wheelW = this.vehicleType === 'truck' ? 10 : 8;
            ctx.fillRect(-this.w / 2 + 2, -this.h / 2 - 2, wheelW, 4);
            ctx.fillRect(-this.w / 2 + 2, this.h / 2 - 2, wheelW, 4);
            ctx.fillRect(this.w / 2 - wheelW - 2, -this.h / 2 - 2, wheelW, 4);
            ctx.fillRect(this.w / 2 - wheelW - 2, this.h / 2 - 2, wheelW, 4);
            // Wheel detail (hub caps)
            ctx.fillStyle = 'rgba(60,60,60,0.4)';
            for (const wx of [-this.w / 2 + 2 + wheelW / 2, this.w / 2 - 2 - wheelW / 2]) {
                for (const wy of [-this.h / 2 - 2 + 2, this.h / 2 - 2 + 2]) {
                    ctx.beginPath(); ctx.arc(wx, wy, 1.5, 0, Math.PI * 2); ctx.fill();
                }
            }
            // Headlights (all types)
            ctx.fillStyle = 'rgba(255,255,200,0.4)';
            ctx.fillRect(this.w / 2 - 3, -this.h / 2 + 3, 2, 4);
            ctx.fillRect(this.w / 2 - 3, this.h / 2 - 7, 2, 4);
            // Tail lights
            ctx.fillStyle = 'rgba(255,0,0,0.3)';
            ctx.fillRect(-this.w / 2 + 1, -this.h / 2 + 3, 2, 3);
            ctx.fillRect(-this.w / 2 + 1, this.h / 2 - 6, 2, 3);
            // Damage cracks
            if (damaged) {
                ctx.strokeStyle = 'rgba(100,100,100,0.4)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(-8, -this.h / 2); ctx.lineTo(-3, 0); ctx.lineTo(-10, this.h / 2); ctx.stroke();
                // Scorch marks
                ctx.fillStyle = 'rgba(40,30,20,0.3)';
                ctx.beginPath(); ctx.arc(5, -3, 6, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    }
}

// Backward-compatible aliases
const Car = Vehicle;
const Truck = Vehicle;
const SUV = Vehicle;
const Van = Vehicle;

// ============================================================
// BARREL - Enhanced
// ============================================================
class Barrel extends Obstacle {
    constructor(x, y) { super(x, y, 24, 24, 'barrel'); this.radius = 12; this.hp = 3; this.maxHp = 3; this.destroyed = false; this._heatPhase = Math.random() * Math.PI * 2; }
    isSolid() { return !this.destroyed; } blocksBullets() { return !this.destroyed; }
    takeDamage(amount, game) {
        if (this.destroyed) return;
        this.hp -= amount;
        if (this.hp <= 0) { this.destroyed = true; game.createExplosion(this.x + this.radius, this.y + this.radius, 90, 55, this); }
    }
    render(ctx, cameraOffset) {
        const sx = this.x + this.radius - cameraOffset.x, sy = this.y + this.radius - cameraOffset.y;
        // Viewport culling
        const margin = this.radius * 2 + 10;
        if (sx < -margin || sx > ctx.canvas.width + margin || sy < -margin || sy > ctx.canvas.height + margin) return;
        if (this.destroyed) {
            // Scorch mark
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(30,30,30,0.5)'; ctx.fill();
            // Debris
            ctx.fillStyle = '#555';
            ctx.fillRect(sx - 6, sy - 3, 4, 3); ctx.fillRect(sx + 2, sy + 1, 3, 4); ctx.fillRect(sx - 2, sy + 4, 5, 2);
            // Smoke wisps
            ctx.fillStyle = 'rgba(40,40,40,0.2)';
            const t = performance.now() * 0.001;
            for (let i = 0; i < 2; i++) {
                const smokeX = sx + Math.sin(t * 0.5 + i * 3) * 5;
                const smokeY = sy - 8 - Math.abs(Math.sin(t * 0.3 + i * 2)) * 10;
                ctx.beginPath(); ctx.arc(smokeX, smokeY, 3 + i, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            // Shadow
            ctx.beginPath(); ctx.arc(sx + 3, sy + 3, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fill();
            // Body
            ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#CC6600'; ctx.fill();
            ctx.strokeStyle = '#8B4513'; ctx.lineWidth = 2; ctx.stroke();
            // Metal bands
            ctx.strokeStyle = '#5A3A1A'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * 0.85, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * 0.55, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(sx, sy, this.radius * 0.25, 0, Math.PI * 2); ctx.stroke();
            // Highlight (3D effect)
            const grad = ctx.createRadialGradient(sx - 3, sy - 3, 0, sx, sy, this.radius);
            grad.addColorStop(0, 'rgba(255,200,100,0.2)');
            grad.addColorStop(0.5, 'rgba(255,200,100,0.05)');
            grad.addColorStop(1, 'rgba(0,0,0,0.1)');
            ctx.beginPath(); ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad; ctx.fill();
            // Warning label
            ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('!', sx, sy);
            // Danger glow when damaged
            if (this.hp < this.maxHp) {
                this._heatPhase += 0.05;
                const heatAlpha = 0.15 + Math.sin(this._heatPhase) * 0.1;
                ctx.fillStyle = `rgba(255,80,0,${heatAlpha})`;
                ctx.beginPath(); ctx.arc(sx, sy, this.radius + 3, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
}

// ============================================================
// TREE - Enhanced with shadow and detail
// ============================================================
class Tree extends Obstacle {
    constructor(x, y, radius = 20) { super(x, y, radius * 2, radius * 2, 'tree'); this.radius = radius; this.detailSeed = Math.random(); this._swayPhase = Math.random() * Math.PI * 2; }
    isSolid() { return true; } blocksBullets() { return false; }
    render(ctx, cameraOffset) {
        const sx = this.x + this.radius - cameraOffset.x, sy = this.y + this.radius - cameraOffset.y;
        // Viewport culling
        const margin = this.radius + 10;
        if (sx < -margin || sx > ctx.canvas.width + margin || sy < -margin || sy > ctx.canvas.height + margin) return;
        // Gentle sway
        this._swayPhase += 0.002;
        const swayX = Math.sin(this._swayPhase + this.detailSeed * 10) * 1.5;
        const swayY = Math.cos(this._swayPhase * 0.7 + this.detailSeed * 5) * 0.5;
        // Ground shadow
        ctx.beginPath(); ctx.ellipse(sx + 5, sy + 6, this.radius * 1.1, this.radius * 0.7, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
        // Main canopy
        ctx.beginPath(); ctx.arc(sx + swayX, sy + swayY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#2D5A1E'; ctx.fill();
        // Lighter patch
        ctx.beginPath(); ctx.arc(sx - this.radius * 0.25 + swayX, sy - this.radius * 0.25 + swayY, this.radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = '#3A7A28'; ctx.fill();
        // Detail leaves
        if (this.detailSeed > 0.3) {
            ctx.fillStyle = '#4A8A38';
            ctx.beginPath(); ctx.arc(sx + this.radius * 0.3 + swayX, sy - this.radius * 0.1 + swayY, this.radius * 0.35, 0, Math.PI * 2); ctx.fill();
        }
        if (this.detailSeed > 0.6) {
            ctx.fillStyle = '#357A25';
            ctx.beginPath(); ctx.arc(sx - this.radius * 0.15 + swayX, sy + this.radius * 0.25 + swayY, this.radius * 0.3, 0, Math.PI * 2); ctx.fill();
        }
        // Trunk
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#4A2A0A'; ctx.fill();
        // Trunk shadow
        ctx.beginPath(); ctx.arc(sx + 1, sy + 1, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
    }
}

// ============================================================
// BARBED WIRE - Enhanced
// ============================================================
class BarbedWire extends Obstacle {
    constructor(x, y, w, h) { super(x, y, w, h, 'barbedWire'); }
    isSolid() { return false; } blocksBullets() { return false; }
    containsPoint(px, py) { return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h; }
    render(ctx, cameraOffset) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling
        if (sx + this.w < 0 || sx > ctx.canvas.width || sy + this.h < 0 || sy > ctx.canvas.height) return;
        // Base
        ctx.fillStyle = 'rgba(60,60,60,0.25)'; ctx.fillRect(sx, sy, this.w, this.h);
        // Wire grid
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        for (let x = 0; x < this.w; x += 10) { ctx.beginPath(); ctx.moveTo(sx + x, sy); ctx.lineTo(sx + x, sy + this.h); ctx.stroke(); }
        for (let y = 0; y < this.h; y += 10) { ctx.beginPath(); ctx.moveTo(sx, sy + y); ctx.lineTo(sx + this.w, sy + y); ctx.stroke(); }
        // Barbs
        ctx.fillStyle = '#777';
        for (let x = 10; x < this.w; x += 20) for (let y = 10; y < this.h; y += 20) {
            ctx.beginPath(); ctx.arc(sx + x, sy + y, 1.5, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// ============================================================
// SANDBAG - Cover obstacle
// ============================================================
class Sandbag extends Obstacle {
    constructor(x, y, w, h) {
        super(x, y, w, h, 'sandbag');
        this.color = '#8B7355';
        this.detailSeed = Math.random();
    }
    isSolid() { return true; } blocksBullets() { return true; }
    render(ctx, cameraOffset) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling
        if (sx + this.w < 0 || sx > ctx.canvas.width || sy + this.h < 0 || sy > ctx.canvas.height) return;
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx + 2, sy + 2, this.w, this.h);
        ctx.fillStyle = this.color; ctx.fillRect(sx, sy, this.w, this.h);
        const bagW = 20, bagH = 12;
        for (let row = 0; row < this.h; row += bagH) {
            const offset = (Math.floor(row / bagH) % 2) * (bagW / 2);
            for (let col = -bagW; col < this.w + bagW; col += bagW) {
                const bx = sx + col + offset, by = sy + row;
                ctx.fillStyle = `rgb(${139+(this.detailSeed*20)|0},${115+(this.detailSeed*15)|0},${85+(this.detailSeed*10)|0})`;
                ctx.beginPath();
                ctx.ellipse(bx + bagW/2, by + bagH/2, bagW/2 - 1, bagH/2 - 1, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();
            }
        }
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx, sy, this.w, 2);
    }
}

// ============================================================
// CRATE - Destructible cover
// ============================================================
class Crate extends Obstacle {
    constructor(x, y, size = 32) {
        super(x, y, size, size, 'crate');
        this.hp = 5; this.maxHp = 5; this.destroyed = false;
        this.color = '#6B4226';
        this.detailSeed = Math.random();
    }
    isSolid() { return !this.destroyed; } blocksBullets() { return !this.destroyed; }
    takeDamage(amount, game) {
        if (this.destroyed) return;
        this.hp -= amount;
        if (this.hp <= 0) {
            this.destroyed = true;
            if (game && game.addEffect) {
                for (let i = 0; i < 8; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    game.addEffect({
                        x: this.x + this.w/2, y: this.y + this.h/2,
                        vx: Math.cos(angle) * (50 + Math.random() * 80), vy: Math.sin(angle) * (50 + Math.random() * 80),
                        life: 300 + Math.random() * 200, age: 0, size: 3 + Math.random() * 4,
                        color: '#6B4226', active: true,
                        update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.95; this.vy *= 0.95; this.age += dt * 1000; if (this.age > this.life) this.active = false; },
                        render(ctx, cam) { const a = 1 - this.age / this.life; ctx.globalAlpha = a; ctx.fillStyle = this.color; ctx.fillRect(this.x - cam.x - this.size/2, this.y - cam.y - this.size/2, this.size, this.size); ctx.globalAlpha = 1; }
                    });
                }
            }
        }
    }
    render(ctx, cameraOffset) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling
        if (sx + this.w < 0 || sx > ctx.canvas.width || sy + this.h < 0 || sy > ctx.canvas.height) return;
        if (this.destroyed) {
            ctx.fillStyle = 'rgba(80,50,30,0.3)'; ctx.fillRect(sx + 4, sy + 4, this.w - 8, this.h - 8);
            ctx.fillStyle = '#5A3A20'; ctx.fillRect(sx + 8, sy + 8, 6, 4); ctx.fillRect(sx + 16, sy + 12, 4, 6);
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx + 3, sy + 3, this.w, this.h);
            ctx.fillStyle = this.color; ctx.fillRect(sx, sy, this.w, this.h);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const gy = sy + 5 + i * 7;
                ctx.beginPath(); ctx.moveTo(sx + 2, gy); ctx.lineTo(sx + this.w - 2, gy + (this.detailSeed > 0.5 ? 2 : -2)); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx + 4, sy + 4); ctx.lineTo(sx + this.w - 4, sy + this.h - 4); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sx + this.w - 4, sy + 4); ctx.lineTo(sx + 4, sy + this.h - 4); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx, sy, this.w, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(sx, sy + this.h - 2, this.w, 2);
        }
    }
}

// ============================================================
// RUINS - Partial building cover
// ============================================================
class Ruins extends Obstacle {
    constructor(x, y, w, h) {
        super(x, y, w, h, 'ruins');
        this.wallThickness = 8;
        this.detailSeed = Math.random();
    }
    isSolid() { return true; } blocksBullets() { return true; }
    getBounds() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
    render(ctx, cameraOffset) {
        const sx = this.x - cameraOffset.x, sy = this.y - cameraOffset.y;
        // Viewport culling
        if (sx + this.w < 0 || sx > ctx.canvas.width || sy + this.h < 0 || sy > ctx.canvas.height) return;
        ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(sx + 3, sy + 3, this.w, this.h);
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(sx, sy + this.h - this.wallThickness, this.w, this.wallThickness);
        if (this.detailSeed > 0.3) ctx.fillRect(sx, sy, this.wallThickness, this.h * 0.6);
        if (this.detailSeed > 0.5) ctx.fillRect(sx + this.w - this.wallThickness, sy + this.h * 0.3, this.wallThickness, this.h * 0.7);
        if (this.detailSeed > 0.7) ctx.fillRect(sx, sy, this.w * 0.4, this.wallThickness);
        ctx.fillStyle = '#4A4A4A';
        for (let i = 0; i < 3; i++) {
            const rx = sx + 10 + (this.detailSeed * 30 + i * 25) % (this.w - 20);
            const ry = sy + 10 + (this.detailSeed * 40 + i * 30) % (this.h - 20);
            ctx.fillRect(rx, ry, 4 + (i % 3) * 3, 3 + (i % 2) * 2);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx + this.w * 0.3, sy); ctx.lineTo(sx + this.w * 0.5, sy + this.h * 0.5); ctx.stroke();
    }
}
