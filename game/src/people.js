// The people of Solmar City: pedestrians who stroll the sidewalks and flee
// trouble, and the SCPD — foot cops and patrol cars — who answer the wanted level.
import { COLORS, WANTED } from './config.js';
import { carRadius, makeCar } from './vehicles.js';

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 55),
    color: rng.pick(COLORS.pedShirt),
    state: 'walk', // 'walk' | 'flee' | 'down'
    targetX: x,
    targetY: y,
    downTimer: 0,
    fleeTimer: 0,
  };
}

export function makeCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 205,
    state: 'patrol', // 'patrol' | 'chase' | 'bust'
    bustTimer: 0,
    targetX: x,
    targetY: y,
  };
}

function distTo(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Pedestrians stroll between sidewalk points; a scare (a speeding car, a
// gunshot) sends them running, and a hard hit knocks them down.
export function updatePeds(world, dt) {
  const { city, player, peds } = world;
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
      }
      continue;
    }
    const threatX = player.x;
    const threatY = player.y;
    const threatDist = distTo(ped.x, ped.y, threatX, threatY);
    const speedingCar = !player.onFoot && Math.abs(player.car.speed) > 200;
    if (ped.state === 'walk' && threatDist < 110 && (speedingCar || world.gunshotTimer > 0)) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - threatY, ped.x - threatX);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      if (distTo(ped.x, ped.y, ped.targetX, ped.targetY) < 20) {
        const p = city.sidewalkPoint();
        ped.targetX = p.x;
        ped.targetY = p.y;
      }
      ped.angle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    const pos = { x: ped.x, y: ped.y };
    if (city.collideCircle(pos, 9)) {
      ped.x = pos.x;
      ped.y = pos.y;
    }
  }
}

// A pedestrian a car hits at speed goes down; the world counts it as a crime.
export function checkPedHits(world) {
  const { cars, peds, player } = world;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    for (const car of cars) {
      if (car.kind === 'parked') continue;
      const d = distTo(ped.x, ped.y, car.x, car.y);
      if (d < carRadius(car) + 8 && Math.abs(car.speed) > 60) {
        ped.state = 'down';
        ped.downTimer = 4;
        if (car === player.car) world.crime('ped', ped.x, ped.y);
        const away = Math.atan2(ped.y - car.y, ped.x - car.x);
        ped.x += Math.cos(away) * 18;
        ped.y += Math.sin(away) * 18;
        break;
      }
    }
  }
}

// Keep the streets staffed to the wanted level: foot cops on patrol, patrol
// cars when the heat rises. Cops spawn on roads near the player, never on top.
export function staffPolice(world) {
  const wanted = world.player.wanted;
  const wantCops = WANTED.copsAt[wanted];
  const wantCars = WANTED.carsAt[wanted];
  const { city, rng, player } = world;
  let tries = 0;
  while (world.cops.length < wantCops && tries < 40) {
    tries += 1;
    const p = city.roadPoint();
    if (distTo(p.x, p.y, player.x, player.y) < 320) continue;
    world.cops.push(makeCop(p.x, p.y));
  }
  let haveCars = 0;
  for (const car of world.cars) if (car.kind === 'police') haveCars += 1;
  tries = 0;
  while (haveCars < wantCars && tries < 40) {
    tries += 1;
    const p = city.roadPoint();
    if (distTo(p.x, p.y, player.x, player.y) < 420) continue;
    const car = makeCar('police', p.x, p.y, p.angle, 'police');
    car.speed = 120;
    world.cars.push(car);
    haveCars += 1;
  }
  // The heat drops: extra cops walk off, extra patrol cars drive off — the
  // farthest first, so the ones near the player never pop out of sight.
  while (world.cops.length > wantCops) world.cops.pop();
  if (haveCars > wantCars) {
    const police = world.cars
      .filter((car) => car.kind === 'police')
      .sort((a, b) => distTo(b.x, b.y, player.x, player.y) - distTo(a.x, a.y, player.x, player.y));
    const remove = new Set(police.slice(0, haveCars - wantCars));
    world.cars = world.cars.filter((car) => !remove.has(car));
  }
}

// Foot cops: patrol near the player, chase on foot, and make the bust when they
// hold the player close. Returns 'busted' when the bust lands.
export function updateCops(world, dt) {
  const { player, cops, city } = world;
  for (const cop of cops) {
    const d = distTo(cop.x, cop.y, player.x, player.y);
    const playerSlow = player.onFoot || Math.abs(player.car.speed) < WANTED.bustSpeed;
    if (player.wanted > 0 && d < 420) cop.state = 'chase';
    else if (cop.state === 'chase' && d > 560) cop.state = 'patrol';
    if (cop.state === 'chase') {
      cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      if (d < WANTED.bustRadiusFoot && playerSlow) {
        cop.bustTimer += dt;
        if (cop.bustTimer >= WANTED.bustTime) return 'busted';
      } else {
        cop.bustTimer = 0;
      }
    } else {
      if (distTo(cop.x, cop.y, cop.targetX, cop.targetY) < 24) {
        const p = city.roadPoint();
        cop.targetX = p.x;
        cop.targetY = p.y;
      }
      cop.angle = Math.atan2(cop.targetY - cop.y, cop.targetX - cop.x);
      cop.x += Math.cos(cop.angle) * 110 * dt;
      cop.y += Math.sin(cop.angle) * 110 * dt;
      cop.bustTimer = 0;
    }
    const pos = { x: cop.x, y: cop.y };
    if (city.collideCircle(pos, 10)) {
      cop.x = pos.x;
      cop.y = pos.y;
    }
  }
  return null;
}

// Patrol cars chase the player and ram; a slow player boxed in by one is busted.
export function updatePoliceCars(world, dt) {
  const { player, city } = world;
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    const d = distTo(car.x, car.y, player.x, player.y);
    const wantAngle = Math.atan2(player.y - car.y, player.x - car.x);
    let angleDiff = wantAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, angleDiff * 1.6));
    car.speed += (car.topSpeed * 0.92 - car.speed) * Math.min(1, dt * 0.9);
    car.angle += steer * car.turn * Math.min(1, Math.abs(car.speed) / 140) * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const pos = { x: car.x, y: car.y };
    if (city.collideCircle(pos, carRadius(car))) {
      car.x = pos.x;
      car.y = pos.y;
      car.speed *= 0.5;
    }
    // A busted player is slow and close to a patrol car.
    const playerSlow = player.onFoot || Math.abs(player.car.speed) < WANTED.bustSpeed;
    if (d < WANTED.bustRadiusCar && playerSlow) {
      car.bustTimer = (car.bustTimer || 0) + dt;
      if (car.bustTimer >= WANTED.bustTime) return 'busted';
    } else {
      car.bustTimer = 0;
    }
    car.lightPhase += dt * 9;
  }
  return null;
}
