// Cars: their models, arcade driving physics, traffic that follows the streets,
// parked cars to steal, and the push-apart when two cars meet.
// A car is a point with a heading and a speed; the renderer draws the body.
import { CAR_MODELS, STREETS_X, STREETS_Y } from './config.js';

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function carRadius(car) {
  return Math.max(car.width / 2 + 4, car.length * 0.36);
}

export function makeCar(modelKey, x, y, angle, kind) {
  const model = CAR_MODELS[modelKey];
  return {
    model: modelKey,
    name: model.name,
    color: model.color,
    topSpeed: model.topSpeed,
    accel: model.accel,
    turn: model.turn,
    length: model.length,
    width: model.width,
    x, y, angle,
    speed: 0,
    kind, // 'traffic' | 'parked' | 'police' | 'mission' | 'player'
    driver: kind === 'traffic' || kind === 'police',
    // Traffic state: which street it follows and which way.
    streetAxis: 'x',
    streetCoord: 0,
    dir: 1,
    lane: 14,
    cruise: 150,
    turnCooldown: 0,
    // Damage smoke, and a flashing light bar on police cars.
    damage: 0,
    lightPhase: Math.random() * Math.PI * 2,
  };
}

// The player's hands on a car: throttle -1..1, steer -1..1, handbrake.
export function driveCar(car, drive, dt, city) {
  const grip = drive.handbrake ? 0.35 : 1;
  if (drive.throttle > 0) car.speed += car.accel * drive.throttle * dt;
  else if (drive.throttle < 0) {
    if (car.speed > 8) car.speed += car.accel * 1.4 * drive.throttle * dt;
    else car.speed += car.accel * 0.55 * drive.throttle * dt;
  }
  // Rolling drag and the handbrake's bite.
  car.speed -= car.speed * (drive.handbrake ? 1.6 : 0.35) * dt;
  if (car.speed > car.topSpeed) car.speed = car.topSpeed;
  if (car.speed < -car.topSpeed * 0.45) car.speed = -car.topSpeed * 0.45;
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 120) * grip;
  car.angle += drive.steer * car.turn * steerAuthority * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const pos = { x: car.x, y: car.y };
  if (city.collideCircle(pos, carRadius(car))) {
    car.x = pos.x;
    car.y = pos.y;
    if (Math.abs(car.speed) > 120) car.damage = Math.min(1, car.damage + 0.25);
    car.speed *= 0.55;
  }
  return Math.abs(car.speed);
}

// One traffic car following its street, turning at intersections, braking for
// the car ahead. `rng` is only consulted when it chooses a turn.
export function updateTrafficCar(car, dt, city, cars, rng) {
  car.turnCooldown -= dt;
  const street = city.nearestStreet(car.x, car.y);
  if (car.streetCoord === 0 || Math.abs(car.x - car.streetCoord) > 120 && car.streetAxis === 'x' || Math.abs(car.y - car.streetCoord) > 120 && car.streetAxis === 'y') {
    car.streetAxis = street.axis;
    car.streetCoord = street.coord;
  }
  const desiredAngle = car.streetAxis === 'x'
    ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.dir > 0 ? 0 : Math.PI);
  // At an intersection, sometimes turn onto the cross street.
  const along = car.streetAxis === 'x' ? car.y : car.x;
  const cross = car.streetAxis === 'x' ? STREETS_Y : STREETS_X;
  let nearCross = null;
  for (const c of cross) {
    if (Math.abs(along - c) < 60) {
      nearCross = c;
      break;
    }
  }
  if (nearCross !== null && car.turnCooldown <= 0 && rng.chance(dt * 0.9)) {
    car.streetAxis = car.streetAxis === 'x' ? 'y' : 'x';
    car.streetCoord = nearCross;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.lane = car.dir > 0 ? 14 : -14;
    car.turnCooldown = 4;
  }
  // Brake for the car ahead.
  let targetSpeed = car.cruise;
  const aheadX = car.x + Math.cos(car.angle) * 46;
  const aheadY = car.y + Math.sin(car.angle) * 46;
  for (const other of cars) {
    if (other === car) continue;
    const dx = other.x - aheadX;
    const dy = other.y - aheadY;
    if (dx * dx + dy * dy < 42 * 42) {
      targetSpeed = 0;
      break;
    }
  }
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.4);
  car.angle = angleLerp(car.angle, desiredAngle, dt * 2.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Ease back onto the lane centre.
  if (car.streetAxis === 'x') {
    const want = car.streetCoord + car.lane;
    car.x += (want - car.x) * Math.min(1, dt * 1.5);
  } else {
    const want = car.streetCoord + car.lane;
    car.y += (want - car.y) * Math.min(1, dt * 1.5);
  }
  const pos = { x: car.x, y: car.y };
  if (city.collideCircle(pos, carRadius(car))) {
    car.x = pos.x;
    car.y = pos.y;
    car.speed *= 0.5;
  }
}

// Push two overlapping cars apart and trade a little speed; returns the impact
// (0 when they never touched) for sparks, sound and the wanted level.
export function resolveCarCollisions(cars, onCrash) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = carRadius(a) + carRadius(b) - 4;
      const distSq = dx * dx + dy * dy;
      if (distSq >= min * min || distSq === 0) continue;
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const push = (min - dist) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.6;
      b.speed = avg * 0.6;
      if (impact > 90 && onCrash) onCrash(a, b, impact);
    }
  }
}
