// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays
// the real rules forward from a staged start for a fixed number of steps,
// steered by an autopilot that follows the road and brakes for the car ahead,
// so the frame is what a short game really looks like and the same seed always
// gives the same frame. The cover is the chase: a wanted level, police behind,
// the minimap and a mission objective all on the HUD at once.
import { STEP } from './config.js';
import { makeCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 6;
const CHASE_SECONDS = 4;
const MISSION_SECONDS = 20;

function makePilot() {
  const input = {
    steerVal: 0,
    throttleVal: 1,
    moveX: () => 0,
    moveY: () => 0,
    throttle: () => input.throttleVal,
    steer: () => input.steerVal,
    handbrake: () => false,
    run: () => false,
    takeActions: () => ({ confirm: false, pause: false, enter: false, shoot: false, call: false, mute: false }),
  };
  return input;
}

// Steer a car toward a point ahead: pure pursuit, clamped to full lock.
function pursuitSteer(car, aimX, aimY) {
  const desired = Math.atan2(aimY - car.y, aimX - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 2.2));
}

// Brake (throttle 0) when another car is right ahead, else full throttle.
function throttleAhead(world, car) {
  const aheadX = car.x + Math.cos(car.angle) * 58;
  const aheadY = car.y + Math.sin(car.angle) * 58;
  for (const other of world.state.cars) {
    if (other === car) continue;
    const dx = other.x - aheadX;
    const dy = other.y - aheadY;
    if (dx * dx + dy * dy < 48 * 48) return 0;
  }
  return 1;
}

// Follow the street the car is on, in the direction it is already travelling,
// and brake for the car ahead. This keeps the autopilot on the road instead
// of through buildings.
function roadDrive(world) {
  const s = world.state;
  const car = s.player.car;
  if (!car) return { steer: 0, throttle: 0 };
  const street = s.city.nearestStreet(car.x, car.y);
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  let aimX;
  let aimY;
  if (street.axis === 'x') {
    aimX = street.coord;
    aimY = car.y + (vy >= 0 ? 220 : -220);
  } else {
    aimX = car.x + (vx >= 0 ? 220 : -220);
    aimY = street.coord;
  }
  return { steer: pursuitSteer(car, aimX, aimY), throttle: throttleAhead(world, car) };
}

function putPlayerInCar(world, car) {
  const s = world.state;
  if (!s.cars.includes(car)) s.cars.push(car);
  s.player.car = car;
  s.player.onFoot = false;
  s.player.x = car.x;
  s.player.y = car.y;
  s.player.angle = car.angle;
}

function stepPilot(world, pilot, seconds, driveFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const drive = driveFn ? driveFn(world) : { steer: 0, throttle: 1 };
    pilot.steerVal = drive.steer;
    pilot.throttleVal = drive.throttle;
    world.step(STEP, pilot, false);
  }
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const s = world.state;
  s.staging = true;
  const pilot = makePilot();
  if (name === 'play') {
    const car = makeCar('sedan', 200, 600, 0, 'player');
    putPlayerInCar(world, car);
    stepPilot(world, pilot, PLAY_SECONDS, roadDrive);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // The getaway job: three stars, the timer running, and the SCPD closing in.
    // A sedan, not a sports car, so the interceptors can catch up and the
    // frame shows the chase on top of the player.
    world.startMission(2);
    const car = makeCar('sedan', 600, 1000, 0, 'player');
    putPlayerInCar(world, car);
    for (let i = 0; i < 2; i += 1) {
      const cop = makeCar('police', 150 - i * 70, 1000, 0, 'police');
      cop.speed = 300;
      s.cars.push(cop);
    }
    stepPilot(world, pilot, CHASE_SECONDS, roadDrive);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    world.startMission(0);
    const taxi = s.missionCar;
    putPlayerInCar(world, taxi);
    world.step(STEP, pilot, false); // getting in the taxi completes stage 0
    // The client waits at the plaza: drive there, then the hotel is the job.
    taxi.x = 600;
    taxi.y = 560;
    taxi.angle = Math.PI / 2;
    s.player.x = taxi.x;
    s.player.y = taxi.y;
    s.player.angle = taxi.angle;
    world.step(STEP, pilot, false); // arriving at the plaza completes stage 1
    taxi.x = 2200;
    taxi.y = 400;
    taxi.angle = Math.PI / 2;
    s.player.x = taxi.x;
    s.player.y = taxi.y;
    s.player.angle = taxi.angle;
    // Drive toward the hotel and stop just short of it, so the frame shows
    // the mission still in progress: banner, target marker and minimap. The
    // drive takes longer than the job's title card, so the card is gone.
    const steps = Math.round(MISSION_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const drive = roadDrive(world);
      pilot.steerVal = drive.steer;
      pilot.throttleVal = drive.throttle;
      world.step(STEP, pilot, false);
      const dx = s.player.x - 2200;
      const dy = s.player.y - 1800;
      if (dx * dx + dy * dy < 260 * 260) break;
    }
    return { screen: SCREEN_PLAY };
  }
  for (let i = 0; i < Math.round(START_SECONDS / STEP); i += 1) {
    world.step(STEP, pilot, true);
  }
  return { screen: SCREEN_TITLE };
}
