// Solmar City itself: the street grid, the blocks, the buildings, the beach and the
// ocean, plus the collision answers the cars and the player ask every step.
// Nothing here draws; render.js paints what this builds.
import {
  BEACH_X, BLOCK, COLORS, ROAD_HALF, STREETS_X, STREETS_Y, WATER_X, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function circleHitsRect(x, y, r, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < r * r;
}

export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const parks = [];
  // One block is the square between four streets. A block holds one to three
  // buildings, or a park, or nothing but palms; the beach column holds sand.
  for (let bx = 0; bx < STREETS_X.length - 1; bx += 1) {
    for (let by = 0; by < STREETS_Y.length - 1; by += 1) {
      const x0 = STREETS_X[bx] + ROAD_HALF + 14;
      const x1 = STREETS_X[bx + 1] - ROAD_HALF - 14;
      const y0 = STREETS_Y[by] + ROAD_HALF + 14;
      const y1 = STREETS_Y[by + 1] - ROAD_HALF - 14;
      const roll = rng.next();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 5; p += 1) {
          palms.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20) });
        }
        continue;
      }
      const count = rng.int(1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = rng.range(90, 170);
        const h = rng.range(80, 150);
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        const rect = { x, y, w, h, color: rng.pick(COLORS.buildingRoof) };
        let overlaps = false;
        for (const other of buildings) {
          if (x < other.x + other.w + 12 && x + w + 12 > other.x && y < other.y + other.h + 12 && y + h + 12 > other.y) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) buildings.push(rect);
      }
      if (rng.chance(0.5)) {
        palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1) });
      }
    }
  }
  // The beach: palms along the sand, and a pier jutting into the ocean.
  for (let y = 120; y < WORLD_HEIGHT - 120; y += 170) {
    palms.push({ x: rng.range(BEACH_X + 12, WATER_X - 24), y: y + rng.range(-30, 30) });
  }

  function isRoad(x, y) {
    if (x >= BEACH_X || y < 0 || y > WORLD_HEIGHT) return false;
    for (const sx of STREETS_X) if (Math.abs(x - sx) <= ROAD_HALF) return true;
    for (const sy of STREETS_Y) if (Math.abs(y - sy) <= ROAD_HALF) return true;
    return false;
  }

  function isWater(x, y) {
    return x >= WATER_X;
  }

  function isSand(x, y) {
    return x >= BEACH_X && x < WATER_X;
  }

  // Push a circle out of every solid thing. Returns true when it was pushed.
  function collideCircle(pos, radius) {
    let hit = false;
    for (const b of buildings) {
      if (!circleHitsRect(pos.x, pos.y, radius, b)) continue;
      const nearestX = clamp(pos.x, b.x, b.x + b.w);
      const nearestY = clamp(pos.y, b.y, b.y + b.h);
      let dx = pos.x - nearestX;
      let dy = pos.y - nearestY;
      let dist = Math.hypot(dx, dy);
      if (dist === 0) {
        // Dead centre of a building: shove it out along the shortest side.
        const left = pos.x - b.x;
        const right = b.x + b.w - pos.x;
        const top = pos.y - b.y;
        const bottom = b.y + b.h - pos.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = b.x - radius;
        else if (m === right) pos.x = b.x + b.w + radius;
        else if (m === top) pos.y = b.y - radius;
        else pos.y = b.y + b.h + radius;
      } else {
        dx /= dist;
        dy /= dist;
        pos.x = nearestX + dx * radius;
        pos.y = nearestY + dy * radius;
      }
      hit = true;
    }
    if (pos.x + radius > WATER_X) {
      pos.x = WATER_X - radius;
      hit = true;
    }
    // The world edge is solid too: clamp and report the hit, so a car or a
    // pedestrian can never drive or walk out of the city.
    const clampedX = clamp(pos.x, radius, WORLD_WIDTH - radius);
    const clampedY = clamp(pos.y, radius, WORLD_HEIGHT - radius);
    if (clampedX !== pos.x || clampedY !== pos.y) hit = true;
    pos.x = clampedX;
    pos.y = clampedY;
    return hit;
  }

  // A point on a road, with the direction of travel along it (for traffic and spawns).
  function roadPoint() {
    if (rng.chance(0.55)) {
      const sx = rng.pick(STREETS_X);
      const y = rng.range(80, WORLD_HEIGHT - 80);
      const lane = rng.chance(0.5) ? -14 : 14;
      return { x: sx + lane, y, angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
    }
    const sy = rng.pick(STREETS_Y);
    const x = rng.range(80, BEACH_X - 80);
    const lane = rng.chance(0.5) ? -14 : 14;
    return { x, y: sy + lane, angle: rng.chance(0.5) ? 0 : Math.PI };
  }

  // A point on a sidewalk beside a road (for pedestrians).
  function sidewalkPoint() {
    const p = roadPoint();
    const off = ROAD_HALF + 14;
    if (Math.abs(p.angle) === Math.PI / 2) return { x: p.x + (rng.chance(0.5) ? off : -off), y: p.y };
    return { x: p.x, y: p.y + (rng.chance(0.5) ? off : -off) };
  }

  // The street a point is on or nearest to, and which way it runs.
  function nearestStreet(x, y) {
    let bestX = STREETS_X[0];
    let bestDx = Infinity;
    for (const sx of STREETS_X) {
      const d = Math.abs(x - sx);
      if (d < bestDx) {
        bestDx = d;
        bestX = sx;
      }
    }
    let bestY = STREETS_Y[0];
    let bestDy = Infinity;
    for (const sy of STREETS_Y) {
      const d = Math.abs(y - sy);
      if (d < bestDy) {
        bestDy = d;
        bestY = sy;
      }
    }
    if (bestDx <= bestDy) return { axis: 'x', coord: bestX, along: y };
    return { axis: 'y', coord: bestY, along: x };
  }

  return {
    buildings, palms, parks,
    isRoad, isWater, isSand, collideCircle, roadPoint, sidewalkPoint, nearestStreet,
  };
}
