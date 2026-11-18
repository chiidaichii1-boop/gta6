// The simulation: Solmar City alive — the player on foot and in cars, traffic,
// pedestrians, the SCPD answering the wanted level, bullets and fists, and
// Vera's five jobs. No drawing and no browser in here; render.js paints this
// state and main.js feeds it input. step() advances one fixed step and returns
// what happened as bit flags.
import { ECONOMY, PLAYER, WANTED } from './config.js';
import { buildCity } from './city.js';
import { createRandom } from './random.js';
import {
  checkPedHits, makePed, staffPolice, updateCops, updatePeds, updatePoliceCars,
} from './people.js';
import { carRadius, driveCar, makeCar, resolveCarCollisions, updateTrafficCar } from './vehicles.js';
import { MISSIONS, SPOTS as MISSION_SPOTS, createMissionState } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_SHOT = 8;
export const EVENT_CRASH = 16;
export const EVENT_PUNCH = 32;

const TRAFFIC_COUNT = 14;
const PARKED_COUNT = 9;
const PED_COUNT = 26;

function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function createWorld(seed, save) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const player = {
    x: MISSION_SPOTS.veraOffice.x,
    y: MISSION_SPOTS.veraOffice.y,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: PLAYER.health,
    cash: save ? save.cash : ECONOMY.startCash,
    wanted: 0,
    hasPistol: false,
    ammo: 0,
    fireCooldown: 0,
    invulnerable: 0,
  };
  const world = {
    seed, rng, city, player,
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    mission: createMissionState(),
    missionCar: null,
    messages: [],
    time: 0,
    gunshotTimer: 0,
    lastCrimeTime: -100,
    wantedTimer: 0,
    // True while a screenshot scene is staged: the city plays on, but a bust
    // or a wasting is a moment to capture, not a game over.
    staging: false,
    missionsDone: save ? save.missionsDone : 0,
    storyComplete: save ? !!save.storyComplete : false,
    nextMissionIndex: save ? save.missionsDone : 0,
  };

  function say(text) {
    world.messages.push({ text, t: world.time });
    if (world.messages.length > 4) world.messages.shift();
  }

  function spawnParticle(x, y, kind) {
    for (let i = 0; i < (kind === 'smoke' ? 5 : 8); i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const speed = kind === 'smoke' ? rng.range(12, 42) : rng.range(60, 190);
      world.particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: rng.range(0.3, 0.8),
        maxLife: 0.8,
        kind,
      });
    }
  }

  function raiseWanted(n) {
    player.wanted = Math.min(WANTED.maxStars, player.wanted + n);
    world.lastCrimeTime = world.time;
    world.wantedTimer = 0;
  }

  function crime(kind, x, y) {
    if (kind === 'steal') {
      raiseWanted(1);
      say('Car stolen — the SCPD is on its way.');
    } else if (kind === 'ped') {
      raiseWanted(1);
      say('Pedestrian down! The heat is rising.');
    } else if (kind === 'shoot') {
      raiseWanted(1);
      say('Shots fired — the SCPD heard that.');
    } else if (kind === 'cop') {
      raiseWanted(1);
      say('You hit a cop. That was a choice.');
    }
    void x;
    void y;
  }

  function populate() {
    world.cars = [];
    world.peds = [];
    world.cops = [];
    const models = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'pickup', 'sedan', 'taxi'];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const p = city.roadPoint();
      if (dist(p.x, p.y, player.x, player.y) < 200) continue;
      const car = makeCar(models[i % models.length], p.x, p.y, p.angle, 'traffic');
      car.streetAxis = Math.abs(p.angle) === Math.PI / 2 ? 'x' : 'y';
      car.streetCoord = car.streetAxis === 'x' ? p.x : p.y;
      car.dir = car.streetAxis === 'x' ? (p.angle > 0 ? 1 : -1) : (p.angle === 0 ? 1 : -1);
      car.lane = car.dir > 0 ? 14 : -14;
      car.cruise = rng.range(120, 200);
      car.speed = car.cruise;
      world.cars.push(car);
    }
    for (let i = 0; i < PARKED_COUNT; i += 1) {
      const p = city.roadPoint();
      const parked = makeCar(models[rng.int(0, models.length - 1)], p.x + 58, p.y, p.angle, 'parked');
      parked.speed = 0;
      parked.driver = false;
      world.cars.push(parked);
    }
    for (let i = 0; i < PED_COUNT; i += 1) {
      const p = city.sidewalkPoint();
      world.peds.push(makePed(p.x, p.y, rng));
    }
  }

  function reset() {
    populate();
    player.x = MISSION_SPOTS.veraOffice.x;
    player.y = MISSION_SPOTS.veraOffice.y;
    player.angle = -Math.PI / 2;
    player.onFoot = true;
    player.car = null;
    player.health = PLAYER.health;
    player.wanted = 0;
    player.fireCooldown = 0;
    player.invulnerable = 0;
    world.bullets = [];
    world.particles = [];
    world.messages = [];
    world.mission = createMissionState();
    world.missionCar = null;
    world.time = 0;
    world.gunshotTimer = 0;
    world.lastCrimeTime = -100;
    world.wantedTimer = 0;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of world.cars) {
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar() {
    const car = nearestCar(64);
    if (!car) return false;
    if (car.driver) {
      // The driver bails and runs.
      const ped = makePed(car.x + 20, car.y + 20, rng);
      ped.state = 'flee';
      ped.fleeTimer = 4;
      world.peds.push(ped);
      car.driver = false;
    }
    if (car.kind === 'traffic' || car.kind === 'parked') {
      crime('steal');
    }
    player.car = car;
    player.onFoot = false;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    car.kind = car.kind === 'police' ? 'police' : car.kind;
    return true;
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    const side = player.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 30;
    player.y = car.y + Math.sin(side) * 30;
    player.angle = car.angle;
    player.onFoot = true;
    player.car = null;
    car.speed = 0;
  }

  function shoot() {
    if (!player.hasPistol || player.ammo <= 0 || player.fireCooldown > 0) return 0;
    player.ammo -= 1;
    player.fireCooldown = PLAYER.fireCooldown;
    world.gunshotTimer = 0.8;
    const a = player.angle;
    world.bullets.push({
      x: player.x + Math.cos(a) * 18,
      y: player.y + Math.sin(a) * 18,
      angle: a,
      speed: 950,
      life: 0.55,
      damage: PLAYER.pistolDamage,
    });
    spawnParticle(player.x + Math.cos(a) * 20, player.y + Math.sin(a) * 20, 'muzzle');
    crime('shoot');
    return EVENT_SHOT;
  }

  function punch() {
    let hit = false;
    const reach = PLAYER.punchRange;
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      const d = dist(player.x, player.y, ped.x, ped.y);
      if (d < reach + 10) {
        ped.state = 'down';
        ped.downTimer = 3;
        spawnParticle(ped.x, ped.y, 'hit');
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const cop of world.cops) {
        const d = dist(player.x, player.y, cop.x, cop.y);
        if (d < reach + 10) {
          cop.state = 'patrol';
          cop.bustTimer = 0;
          spawnParticle(cop.x, cop.y, 'hit');
          crime('cop');
          hit = true;
          break;
        }
      }
    }
    return hit ? EVENT_PUNCH : 0;
  }

  function spawnRivals(count) {
    const models = ['sedan', 'sport'];
    for (let i = 0; i < count; i += 1) {
      const p = city.roadPoint();
      const car = makeCar(models[i % models.length], p.x, p.y, p.angle, 'rival');
      car.color = i === 0 ? '#7b2cbf' : '#3a0ca3';
      car.speed = 200;
      car.topSpeed = 460;
      world.cars.push(car);
    }
  }

  function clearRivals() {
    world.cars = world.cars.filter((car) => car.kind !== 'rival');
  }

  function updateRivals(dt) {
    for (const car of world.cars) {
      if (car.kind !== 'rival') continue;
      const wantAngle = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));
      car.speed += (car.topSpeed * 0.9 - car.speed) * Math.min(1, dt * 0.8);
      car.angle += steer * car.turn * Math.min(1, Math.abs(car.speed) / 140) * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const pos = { x: car.x, y: car.y };
      if (city.collideCircle(pos, carRadius(car))) {
        car.x = pos.x;
        car.y = pos.y;
        car.speed *= 0.5;
      }
    }
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    if (!mission) return false;
    world.mission.index = index;
    world.mission.stage = 0;
    world.mission.active = true;
    world.mission.holdWanted = false;
    world.mission.timer = 0;
    // The job's title card shows for a few seconds; the feed keeps one short line.
    world.mission.intro = { title: mission.title, brief: mission.brief, until: world.time + 3 };
    say(`Job: ${mission.title}`);
    startStage();
    return true;
  }

  function startStage() {
    const mission = MISSIONS[world.mission.index];
    const stage = mission.stages[world.mission.stage];
    world.mission.target = stage.target || null;
    world.mission.timer = stage.timer || 0;
    world.mission.stageText = stage.text;
    if (stage.setup) stage.setup(world);
    if (world.mission.target && !world.mission.target.label) world.mission.target.label = 'JOB';
  }

  function updateMission(dt) {
    if (!world.mission.active) return 0;
    const mission = MISSIONS[world.mission.index];
    const stage = mission.stages[world.mission.stage];
    const done = stage.update(world, dt);
    if (!done) return 0;
    world.mission.stage += 1;
    if (world.mission.stage >= mission.stages.length) {
      const reward = mission.reward;
      player.cash += reward;
      world.missionsDone += 1;
      world.nextMissionIndex = Math.min(MISSIONS.length, world.missionsDone);
      if (mission.onComplete) mission.onComplete(world);
      say(`${mission.title} complete — $${reward} in the pocket.`);
      world.mission.active = false;
      world.mission.index = -1;
      world.mission.target = null;
      world.missionCar = null;
      return EVENT_MISSION_DONE;
    }
    startStage();
    return 0;
  }

  function failMission() {
    if (!world.mission.active) return;
    say('Job blown — call Vera (T) to run it again.');
    world.mission.active = false;
    world.mission.holdWanted = false;
    world.mission.target = null;
    world.mission.intro = null;
    world.missionCar = null;
    clearRivals();
  }

  function respawn(kind) {
    const fine = kind === 'busted' ? ECONOMY.bustFine : ECONOMY.wastedFine;
    const lost = Math.min(player.cash, fine);
    player.cash -= lost;
    player.wanted = 0;
    player.health = PLAYER.health;
    player.onFoot = true;
    player.car = null;
    const spot = kind === 'busted' ? { x: 1000, y: 1000 } : { x: 1800, y: 1400 };
    player.x = spot.x;
    player.y = spot.y;
    player.invulnerable = 2;
    failMission();
    say(kind === 'busted'
      ? `BUSTED. The SCPD took $${lost} and dropped you at the station.`
      : `WASTED. The hospital patched you up for $${lost}.`);
  }

  function updateBullets(dt) {
    for (const bullet of world.bullets) {
      bullet.life -= dt;
      bullet.x += Math.cos(bullet.angle) * bullet.speed * dt;
      bullet.y += Math.sin(bullet.angle) * bullet.speed * dt;
      const pos = { x: bullet.x, y: bullet.y };
      if (city.collideCircle(pos, 2)) {
        bullet.life = 0;
        spawnParticle(bullet.x, bullet.y, 'spark');
        continue;
      }
      for (const ped of world.peds) {
        if (ped.state === 'down') continue;
        if (dist(bullet.x, bullet.y, ped.x, ped.y) < 14) {
          ped.state = 'down';
          ped.downTimer = 5;
          bullet.life = 0;
          spawnParticle(ped.x, ped.y, 'hit');
          break;
        }
      }
      if (bullet.life <= 0) continue;
      for (const cop of world.cops) {
        if (dist(bullet.x, bullet.y, cop.x, cop.y) < 14) {
          cop.state = 'patrol';
          cop.bustTimer = 0;
          bullet.life = 0;
          spawnParticle(cop.x, cop.y, 'hit');
          crime('cop');
          break;
        }
      }
    }
    world.bullets = world.bullets.filter((b) => b.life > 0);
  }

  function updatePlayer(dt, input) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.onFoot) {
      const mx = input.moveX();
      const my = input.moveY();
      const len = Math.hypot(mx, my);
      const running = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      if (len > 0.01) {
        player.angle = Math.atan2(my, mx);
        const speed = running * Math.min(1, len);
        player.x += (mx / len) * speed * dt;
        player.y += (my / len) * speed * dt;
        const pos = { x: player.x, y: player.y };
        if (city.collideCircle(pos, PLAYER.radius)) {
          player.x = pos.x;
          player.y = pos.y;
        }
      }
    } else if (player.car) {
      const drive = {
        throttle: input.throttle(),
        steer: input.steer(),
        handbrake: input.handbrake(),
      };
      const speed = driveCar(player.car, drive, dt, city);
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
      if (speed > 300) {
        const back = player.angle + Math.PI;
        if (rng.chance(dt * 6)) {
          world.particles.push({
            x: player.car.x + Math.cos(back) * 20 + rng.range(-6, 6),
            y: player.car.y + Math.sin(back) * 20 + rng.range(-6, 6),
            vx: rng.range(-20, 20),
            vy: rng.range(-20, 20),
            life: 0.5,
            maxLife: 0.5,
            kind: 'smoke',
          });
        }
      }
    }
  }

  // One fixed step. `input` is the live input object; with `harmless` set the
  // city ambles behind the title screen and nothing can hurt the player.
  function step(dt, input, harmless) {
    let events = 0;
    world.time += dt;
    world.gunshotTimer = Math.max(0, world.gunshotTimer - dt);
    world.messages = world.messages.filter((m) => world.time - m.t < 7);

    for (const car of world.cars) {
      if (car.kind === 'traffic') updateTrafficCar(car, dt, city, world.cars, rng);
    }
    updatePeds(world, dt);
    if (harmless) {
      updateParticles(dt);
      return 0;
    }

    const actions = input.takeActions();
    if (actions.enter) {
      if (player.onFoot) enterCar();
      else exitCar();
    }
    if (actions.shoot) {
      if (player.onFoot) {
        events |= player.hasPistol && player.ammo > 0 ? shoot() : punch();
      }
    }
    if (actions.call && !world.mission.active && world.nextMissionIndex < MISSIONS.length) {
      startMission(world.nextMissionIndex);
    }

    updatePlayer(dt, input);
    updateRivals(dt);
    resolveCarCollisions(world.cars, (a, b, impact) => {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      spawnParticle(mx, my, 'spark');
      if ((a === player.car || b === player.car) && impact > 160) {
        events |= EVENT_CRASH;
        player.health = Math.max(0, player.health - Math.min(24, impact / 22));
      }
    });
    checkPedHits(world);
    updateBullets(dt);
    events |= updateMission(dt);

    // The wanted level: heat rises with crime, cools when the city forgets.
    if (!world.mission.holdWanted) {
      if (world.time - world.lastCrimeTime > WANTED.decayDelay && player.wanted > 0) {
        let near = false;
        for (const cop of world.cops) {
          if (dist(cop.x, cop.y, player.x, player.y) < 350) {
            near = true;
            break;
          }
        }
        if (!near) {
          world.wantedTimer += dt;
          if (world.wantedTimer >= WANTED.decayEvery) {
            player.wanted -= 1;
            world.wantedTimer = 0;
          }
        } else {
          world.wantedTimer = 0;
        }
      }
    }
    staffPolice(world);
    if (updateCops(world, dt) === 'busted' || updatePoliceCars(world, dt) === 'busted') {
      // During screenshot staging the bust is only a moment to capture, not a
      // game over: the city keeps playing and the frame stays an action shot.
      if (!world.staging) {
        respawn('busted');
        return events | EVENT_BUSTED;
      }
    }
    if (player.health <= 0) {
      if (!world.staging) {
        respawn('wasted');
        return events | EVENT_WASTED;
      }
      player.health = 1;
    }
    updateParticles(dt);
    return events;
  }

  function updateParticles(dt) {
    for (const p of world.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
    }
    world.particles = world.particles.filter((p) => p.life > 0);
  }

  function getSave() {
    return {
      cash: player.cash,
      missionsDone: world.missionsDone,
      storyComplete: world.storyComplete,
    };
  }

  // The helpers the mission stages and the people module call on the state.
  Object.assign(world, { say, spawnParticle, raiseWanted, crime, spawnRivals, clearRivals });

  reset();
  return {
    state: world,
    player,
    reset,
    step,
    say,
    spawnParticle,
    raiseWanted,
    crime,
    startMission,
    spawnRivals,
    clearRivals,
    getSave,
    get mission() {
      return world.mission;
    },
    get cars() {
      return world.cars;
    },
    get peds() {
      return world.peds;
    },
    get cops() {
      return world.cops;
    },
  };
}
