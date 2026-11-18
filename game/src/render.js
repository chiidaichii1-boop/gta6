// Drawing only: the world's state and the current screen in, pixels out. A
// camera follows the player over Solmar City; the HUD (minimap, wanted stars,
// health, cash, mission objective) and the screens (title, pause, busted,
// wasted, story complete) are painted on top. Nothing here simulates.
import {
  BEACH_X, BLOCK, COLORS, FONT, ROAD_HALF, STREETS_X, STREETS_Y, WATER_X, WORLD_HEIGHT, WORLD_WIDTH,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const MINIMAP_W = 196;
const MINIMAP_H = 148;

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 0, h: 0, scale: 1 };
  const camera = { x: 1600, y: 1200, zoom: 1 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.w = Math.round(window.innerWidth * ratio);
    view.h = Math.round(window.innerHeight * ratio);
    canvas.width = view.w;
    canvas.height = view.h;
  }

  function font(size, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  // Split a line into as many lines as fit in maxWidth at this size.
  function wrapText(value, maxWidth, size) {
    ctx.font = font(size, false);
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Put the camera on a point at once (a screenshot paints twice, too few
  // frames for the follow-lerp to catch up).
  function snapCamera(x, y) {
    camera.x = x;
    camera.y = y;
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = COLORS.hudPanel;
    rr(ctx, x, y, w, h, 10);
    ctx.fill();
  }

  function drawGround(state) {
    const city = state.city;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X, WORLD_HEIGHT);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(WATER_X, 0, WORLD_WIDTH - WATER_X, WORLD_HEIGHT);
    ctx.fillStyle = COLORS.waterDeep;
    for (let y = 60; y < WORLD_HEIGHT; y += 240) {
      ctx.fillRect(WATER_X + 30, y, WORLD_WIDTH - WATER_X - 60, 14);
    }
    for (const park of city.parks) {
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Sidewalks, then asphalt, then the centre dashes.
    ctx.fillStyle = COLORS.sidewalk;
    for (const sx of STREETS_X) ctx.fillRect(sx - ROAD_HALF - 12, 0, (ROAD_HALF + 12) * 2, WORLD_HEIGHT);
    for (const sy of STREETS_Y) ctx.fillRect(0, sy - ROAD_HALF - 12, BEACH_X, (ROAD_HALF + 12) * 2);
    ctx.fillStyle = COLORS.asphalt;
    for (const sx of STREETS_X) ctx.fillRect(sx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_HEIGHT);
    for (const sy of STREETS_Y) ctx.fillRect(0, sy - ROAD_HALF, BEACH_X, ROAD_HALF * 2);
    ctx.fillStyle = COLORS.roadLine;
    for (const sx of STREETS_X) {
      for (let y = 0; y < WORLD_HEIGHT; y += 80) ctx.fillRect(sx - 2, y, 4, 40);
    }
    for (const sy of STREETS_Y) {
      for (let x = 0; x < BEACH_X; x += 80) ctx.fillRect(x, sy - 2, 40, 4);
    }
    // A pier into the ocean.
    ctx.fillStyle = '#8d7d6b';
    ctx.fillRect(BEACH_X + 20, 1180, 120, 16);
  }

  function drawBuildings(state, left, top, right, bottom) {
    for (const b of state.city.buildings) {
      if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = COLORS.buildingWall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 8);
      ctx.fillStyle = 'rgba(20, 30, 45, 0.55)';
      const cols = Math.max(1, Math.floor((b.w - 20) / 22));
      const rows = Math.max(1, Math.floor((b.h - 28) / 22));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          ctx.fillRect(b.x + 12 + c * 22, b.y + 26 + r * 22, 10, 12);
        }
      }
    }
    for (const palm of state.city.palms) {
      if (palm.x < left || palm.x > right || palm.y < top || palm.y > bottom) continue;
      ctx.strokeStyle = COLORS.palmTrunk;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + 4, palm.y - 14);
      ctx.stroke();
      ctx.fillStyle = COLORS.palmLeaf;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.5;
        ctx.beginPath();
        ctx.ellipse(palm.x + 4 + Math.cos(a) * 9, palm.y - 14 + Math.sin(a) * 7, 10, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const l = car.length;
    const w = car.width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    rr(ctx, -l / 2 + 3, -w / 2 + 4, l, w, 7);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#14181f';
    ctx.fillRect(-l / 2 + 4, -w / 2 - 2, 10, 5);
    ctx.fillRect(l / 2 - 14, -w / 2 - 2, 10, 5);
    ctx.fillRect(-l / 2 + 4, w / 2 - 3, 10, 5);
    ctx.fillRect(l / 2 - 14, w / 2 - 3, 10, 5);
    // Body, windshield, roof.
    ctx.fillStyle = car.color;
    rr(ctx, -l / 2, -w / 2, l, w, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 235, 0.9)';
    ctx.fillRect(-l / 2 + 12, -w / 2 + 3, 8, w - 6);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-2, -w / 2 + 3, 12, w - 6);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(l / 2 - 2, -w / 2 + 3, 3, 4);
    ctx.fillRect(l / 2 - 2, w / 2 - 7, 3, 4);
    if (car.kind === 'police') {
      const flash = Math.sin(car.lightPhase) > 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-6, -w / 2 + 2, 10, 4);
      ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-6, w / 2 - 6, 10, 4);
    }
    if (car.kind === 'mission') {
      ctx.strokeStyle = COLORS.hudGold;
      ctx.lineWidth = 2;
      rr(ctx, -l / 2 - 3, -w / 2 - 3, l + 6, w + 6, 9);
      ctx.stroke();
    }
    if (isPlayer) {
      ctx.strokeStyle = COLORS.playerRing;
      ctx.lineWidth = 2.5;
      rr(ctx, -l / 2 - 5, -w / 2 - 5, l + 10, w + 10, 10);
      ctx.stroke();
    }
    if (car.damage > 0.4) {
      ctx.fillStyle = 'rgba(60, 60, 60, 0.5)';
      ctx.beginPath();
      ctx.arc(-l / 4, 0, 6 + car.damage * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, isCop) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isCop ? '#1f2a37' : color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, 4, 0, Math.PI * 2);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-6, -9, 12, 3);
    }
    ctx.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'smoke') ctx.fillStyle = `rgba(90, 90, 90, ${alpha * 0.55})`;
      else if (p.kind === 'spark') ctx.fillStyle = `rgba(255, 200, 60, ${alpha})`;
      else if (p.kind === 'muzzle') ctx.fillStyle = `rgba(255, 240, 150, ${alpha})`;
      else ctx.fillStyle = `rgba(230, 57, 70, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'smoke' ? 7 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTargetMarker(state, left, top, right, bottom) {
    const target = state.mission.target;
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    const inView = target.x > left && target.x < right && target.y > top && target.y < bottom;
    if (inView) {
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ff4d6d';
      ctx.globalAlpha = 0.9;
      const s = 16 * pulse;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255, 77, 109, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    // An edge arrow when the target is off screen, with the distance.
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    const dist = Math.hypot(dx, dy);
    if (!inView && dist > 10) {
      const angle = Math.atan2(dy, dx);
      const ax = cx + Math.cos(angle) * ((right - left) / 2 - 70);
      const ay = cy + Math.sin(angle) * ((bottom - top) / 2 - 70);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      text(`${Math.round(dist / 40)}m`, ax, ay - 18, 15, '#ff4d6d', 'center', true);
    }
  }

  function drawMinimap(state) {
    const px = view.w / (window.devicePixelRatio || 1) - MINIMAP_W - 14;
    const py = 14;
    panel(px, py, MINIMAP_W, MINIMAP_H);
    const sx = (MINIMAP_W - 16) / WORLD_WIDTH;
    const sy = (MINIMAP_H - 16) / WORLD_HEIGHT;
    const ox = px + 8;
    const oy = py + 8;
    ctx.fillStyle = COLORS.grassDark;
    ctx.fillRect(ox, oy, MINIMAP_W - 16, MINIMAP_H - 16);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(ox + WATER_X * sx, oy, (WORLD_WIDTH - WATER_X) * sx, MINIMAP_H - 16);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(ox + BEACH_X * sx, oy, (WATER_X - BEACH_X) * sx, MINIMAP_H - 16);
    ctx.fillStyle = COLORS.asphalt;
    for (const sxx of STREETS_X) ctx.fillRect(ox + (sxx - ROAD_HALF) * sx, oy, ROAD_HALF * 2 * sx, MINIMAP_H - 16);
    for (const syy of STREETS_Y) ctx.fillRect(ox, oy + (syy - ROAD_HALF) * sy, BEACH_X * sx, ROAD_HALF * 2 * sy);
    function blip(x, y, color, size) {
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * sx - size / 2, oy + y * sy - size / 2, size, size);
    }
    const target = state.mission.target;
    if (target) {
      ctx.save();
      ctx.translate(ox + target.x * sx, oy + target.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
    for (const car of state.cars) {
      if (car.kind === 'police') blip(car.x, car.y, '#2d6bff', 6);
      else if (car.kind === 'rival') blip(car.x, car.y, '#b5179e', 6);
      else if (car.kind === 'mission') blip(car.x, car.y, COLORS.hudGold, 6);
    }
    blip(state.player.x, state.player.y, COLORS.player, 8);
    text('SOLMAR CITY', px + 8, py + MINIMAP_H - 6, 11, 'rgba(255,255,255,0.65)', 'left', true);
  }

  function drawHud(state, ui) {
    const dpr = window.devicePixelRatio || 1;
    const w = view.w / dpr;
    const h = view.h / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    // Wanted stars, health, cash, ammo — top left.
    panel(14, 14, 178, 108);
    let starX = 28;
    for (let i = 0; i < 5; i += 1) {
      text('★', starX, 44, 26, i < state.player.wanted ? COLORS.star : COLORS.starEmpty, 'left', true);
      starX += 28;
    }
    ctx.fillStyle = '#222';
    rr(ctx, 28, 54, 150, 12, 6);
    ctx.fill();
    ctx.fillStyle = state.player.health > 30 ? COLORS.good : COLORS.danger;
    rr(ctx, 28, 54, Math.max(0, 150 * state.player.health / 100), 12, 6);
    ctx.fill();
    text(`$${state.player.cash.toLocaleString('en-US')}`, 28, 92, 20, COLORS.hudGold, 'left', true);
    if (state.player.hasPistol) text(`PISTOL ${state.player.ammo}`, 28, 112, 13, COLORS.hudText, 'left');
    else if (state.missionsDone > 0) text(`${state.missionsDone}/5 JOBS DONE`, 28, 112, 13, COLORS.hudText, 'left');
    drawMinimap(state);
    // Mission objective, top centre.
    if (state.mission.active) {
      const mission = state.mission;
      const label = mission.timer > 0
        ? `${missionText(state)}  ${Math.ceil(mission.timer)}s`
        : missionText(state);
      ctx.font = font(17, true);
      const tw = ctx.measureText(label).width;
      panel(w / 2 - tw / 2 - 18, 14, tw + 36, 36);
      text(label, w / 2, 39, 17, COLORS.hudText, 'center', true);
    } else if (state.nextMissionIndex < 5) {
      ctx.font = font(14, false);
      const label = 'Free roam — press T to call Vera for the next job';
      const tw = ctx.measureText(label).width;
      panel(w / 2 - tw / 2 - 14, 14, tw + 28, 30);
      text(label, w / 2, 34, 14, 'rgba(255,255,255,0.85)', 'center');
    }
    // A mission's title card, briefly, when the job starts.
    if (state.mission.intro && state.time < state.mission.intro.until) {
      const intro = state.mission.intro;
      const lines = wrapText(intro.brief, 560, 16);
      const cardH = 78 + lines.length * 24;
      panel(w / 2 - 310, h / 2 - cardH / 2, 620, cardH);
      text(intro.title, w / 2, h / 2 - cardH / 2 + 42, 30, COLORS.hudGold, 'center', true);
      lines.forEach((line, i) => {
        text(line, w / 2, h / 2 - cardH / 2 + 72 + i * 24, 16, COLORS.hudText, 'center');
      });
    }
    // Speed and controls, bottom right.
    if (!state.player.onFoot && state.player.car) {
      const mph = Math.round(Math.abs(state.player.car.speed) * 0.12);
      text(`${mph} mph`, w - 18, view.h / dpr - 44, 26, COLORS.hudText, 'right', true);
    }
    text('WASD drive · E enter/exit car · F fight · SPACE handbrake · P pause · M sound', w - 18, view.h / dpr - 18, 12, 'rgba(255,255,255,0.6)', 'right');
    // Message feed, bottom left.
    let my = view.h / dpr - 18;
    const recent = state.messages.slice(-3);
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      const m = recent[i];
      const age = state.time - m.t;
      const alpha = age > 5 ? Math.max(0, 1 - (age - 5) / 2) : 1;
      ctx.globalAlpha = alpha;
      text(m.text, 18, my, 14, COLORS.hudText, 'left');
      ctx.globalAlpha = 1;
      my -= 22;
    }
    if (ui.muted) text('MUTED (M)', 18, 140, 13, 'rgba(255,255,255,0.6)', 'left');
    ctx.restore();
  }

  function missionText(state) {
    // The world keeps the current stage's text on the mission state.
    return state.mission.stageText || '';
  }

  function drawScreenOverlay(title, lines, prompt, color) {
    const dpr = window.devicePixelRatio || 1;
    const w = view.w / dpr;
    const h = view.h / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
    ctx.fillRect(0, 0, w, h);
    text(title, w / 2, h / 2 - 60, 54, color || COLORS.hudGold, 'center', true);
    let y = h / 2;
    for (const line of lines) {
      text(line, w / 2, y, 17, COLORS.hudText, 'center');
      y += 26;
    }
    text(prompt, w / 2, y + 22, 16, 'rgba(255,255,255,0.75)', 'center', true);
    ctx.restore();
  }

  function drawTitle(state, ui) {
    const dpr = window.devicePixelRatio || 1;
    const w = view.w / dpr;
    const h = view.h / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgba(10, 14, 24, 0.55)';
    ctx.fillRect(0, 0, w, h);
    text('SOLMAR CITY', w / 2, h / 2 - 118, 64, COLORS.hudGold, 'center', true);
    text('An open-world crime story in the sun', w / 2, h / 2 - 84, 20, COLORS.hudText, 'center');
    const lines = [
      'Leo Marín came to Solmar to drive. Vera Solano has five jobs for him,',
      'from a first fare to the heist of the decade — and the whole SCPD in between.',
      '',
      'WASD / arrows — walk and drive · E — steal and enter cars · F — fight',
      'SPACE — handbrake · T — call Vera for the next job · P — pause · M — sound',
    ];
    let y = h / 2 - 40;
    for (const line of lines) {
      text(line, w / 2, y, 16, 'rgba(255,255,255,0.9)', 'center');
      y += 24;
    }
    if (ui.save && (ui.save.cash > 50 || ui.save.missionsDone > 0)) {
      text(`Welcome back — $${ui.save.cash} in the pocket, ${ui.save.missionsDone}/5 jobs done.`, w / 2, y + 8, 15, COLORS.hudGold, 'center', true);
      y += 24;
    }
    text('Press ENTER or click to start', w / 2, y + 30, 18, COLORS.hudText, 'center', true);
    ctx.restore();
  }

  function drawWorld(state, screen) {
    // The camera follows the player; on the title screen it drifts over the city.
    const player = state.player;
    if (screen === SCREEN_TITLE) {
      camera.x = 1600 + Math.cos(state.time * 0.05) * 500;
      camera.y = 1200 + Math.sin(state.time * 0.04) * 350;
      camera.zoom = 0.62;
    } else {
      const targetZoom = player.onFoot ? 1 : 0.86;
      camera.zoom += (targetZoom - camera.zoom) * 0.05;
      camera.x += (player.x - camera.x) * 0.12;
      camera.y += (player.y - camera.y) * 0.12;
    }
    const base = Math.min(view.w / 1000, view.h / 700);
    const scale = base * camera.zoom;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, view.w / dpr, view.h / dpr);
    ctx.translate(view.w / dpr / 2, view.h / dpr / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camera.x, -camera.y);
    const left = camera.x - (view.w / dpr / 2) / scale - 40;
    const top = camera.y - (view.h / dpr / 2) / scale - 40;
    const right = camera.x + (view.w / dpr / 2) / scale + 40;
    const bottom = camera.y + (view.h / dpr / 2) / scale + 40;
    drawGround(state);
    drawBuildings(state, left, top, right, bottom);
    drawTargetMarker(state, left, top, right, bottom);
    for (const car of state.cars) {
      if (car.x < left - 80 || car.x > right + 80 || car.y < top - 80 || car.y > bottom + 80) continue;
      drawCar(car, car === player.car);
    }
    for (const ped of state.peds) {
      if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(1.2);
        ctx.fillStyle = ped.color;
        ctx.fillRect(-9, -4, 18, 8);
        ctx.restore();
      } else {
        drawPerson(ped.x, ped.y, ped.angle, ped.color, false);
      }
    }
    for (const cop of state.cops) {
      if (cop.x < left || cop.x > right || cop.y < top || cop.y > bottom) continue;
      drawPerson(cop.x, cop.y, cop.angle, '#1f2a37', true);
    }
    if (player.onFoot) {
      drawPerson(player.x, player.y, player.angle, COLORS.player, false);
      ctx.strokeStyle = COLORS.playerRing;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const bullet of state.bullets) {
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    drawParticles(state);
    ctx.restore();
  }

  function draw(state, screen, ui) {
    resize();
    drawWorld(state, screen);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
    } else {
      drawHud(state, ui);
      if (screen === SCREEN_PAUSED) {
        drawScreenOverlay('PAUSED', ['The city waits. Your save is safe.'], 'Press P or ENTER to keep driving', COLORS.hudText);
      } else if (screen === SCREEN_BUSTED) {
        drawScreenOverlay('BUSTED', ['The SCPD took their cut and dropped you at the station.', 'Your jobs are still waiting — call Vera (T) to run them again.'], 'Press ENTER to get back on the streets', COLORS.danger);
      } else if (screen === SCREEN_WASTED) {
        drawScreenOverlay('WASTED', ['The hospital patched you up and charged you for it.', 'Solmar is not done with you yet.'], 'Press ENTER to get back on the streets', COLORS.danger);
      } else if (screen === SCREEN_COMPLETE) {
        drawScreenOverlay('SOLMAR IS YOURS', ['All five jobs done. The heist paid out, Vera is proud,', 'and Leo Marín owns the streets he used to run from.'], 'Press ENTER to keep cruising free roam', COLORS.hudGold);
      }
    }
  }

  return { draw, resize, snapCamera };
}
