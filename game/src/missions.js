// Vera's jobs: five missions with a story, each a run of stages. A stage names
// its objective text, its target on the map, and what completes it; the runner
// in world.js steps through them and pays out at the end.
import { MISSION_REWARDS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { makeCar } from './vehicles.js';

// Fixed corners of Solmar City the jobs use (all on roads, all deterministic).
export const SPOTS = {
  plaza: { x: 600, y: 600 },
  hotel: { x: 2200, y: 1800 },
  chopShop: { x: 2600, y: 200 },
  bank: { x: 1400, y: 1000 },
  docks: { x: 2950, y: 2200 },
  veraOffice: { x: 1000, y: 1400 },
  dropNorth: { x: 2200, y: 600 },
  dropWest: { x: 600, y: 1800 },
  dropEast: { x: 2600, y: 1400 },
  packagePickup: { x: 1000, y: 1800 },
};

function nearPlayer(world, x, y, radius) {
  const dx = world.player.x - x;
  const dy = world.player.y - y;
  return dx * dx + dy * dy < radius * radius;
}

function inCar(world, car) {
  return !world.player.onFoot && world.player.car === car;
}

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    brief: 'Vera Solano needs a driver she can trust. Prove it: take the taxi, pick up the client at the plaza, and get him to the Marlin Hotel in one piece.',
    reward: MISSION_REWARDS[0],
    stages: [
      {
        text: 'Get in the yellow taxi',
        target: null, // set at setup: the taxi itself
        setup(world) {
          const tx = Math.min(WORLD_WIDTH - 80, Math.max(80, world.player.x + 120));
          const ty = Math.min(WORLD_HEIGHT - 80, Math.max(80, world.player.y + 40));
          const taxi = makeCar('taxi', tx, ty, 0, 'mission');
          world.cars.push(taxi);
          world.missionCar = taxi;
          world.mission.target = { x: taxi.x, y: taxi.y, r: 90, car: taxi, label: 'TAXI' };
          world.say('Vera: "The taxi is yours, Leo. Don\'t scratch it."');
        },
        update(world) {
          const taxi = world.missionCar;
          world.mission.target = { x: taxi.x, y: taxi.y, r: 90, car: taxi, label: 'TAXI' };
          return inCar(world, taxi);
        },
      },
      {
        text: 'Pick up the client at the plaza',
        target: { ...SPOTS.plaza, r: 90, label: 'CLIENT' },
        setup(world) {
          world.say('Vera: "Client\'s waiting at the plaza. He tips well."');
        },
        update(world) {
          return nearPlayer(world, SPOTS.plaza.x, SPOTS.plaza.y, 90) && !world.player.onFoot;
        },
      },
      {
        text: 'Drive the client to the Marlin Hotel',
        target: { ...SPOTS.hotel, r: 100, label: 'HOTEL' },
        setup(world) {
          world.say('Client: "Marlin Hotel, and step on it."');
        },
        update(world) {
          return nearPlayer(world, SPOTS.hotel.x, SPOTS.hotel.y, 100) && !world.player.onFoot;
        },
      },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    brief: 'A Veloce GT is parked outside the gallery on Solmar Row. Vera has a buyer. Take it, and bring it to the chop shop on the north side — quietly.',
    reward: MISSION_REWARDS[1],
    stages: [
      {
        text: 'Steal the Veloce GT on Solmar Row',
        target: { x: 1800, y: 600, r: 90, label: 'VELOCE GT' },
        setup(world) {
          const gt = makeCar('sport', 1800, 600, Math.PI / 2, 'mission');
          gt.speed = 0;
          world.cars.push(gt);
          world.missionCar = gt;
          world.say('Vera: "Red Veloce, gallery row. The alarm is already dead."');
        },
        update(world) {
          return inCar(world, world.missionCar);
        },
      },
      {
        text: 'Deliver the Veloce to the chop shop',
        target: { ...SPOTS.chopShop, r: 100, label: 'CHOP SHOP' },
        setup(world) {
          world.raiseWanted(1);
          world.say('Vera: "Cops are sniffing. Don\'t let them box you in."');
        },
        update(world) {
          return nearPlayer(world, SPOTS.chopShop.x, SPOTS.chopShop.y, 100) && inCar(world, world.missionCar);
        },
      },
    ],
    onComplete(world) {
      world.player.hasPistol = true;
      world.player.ammo += 24;
      world.say('Vera: "Clean work. Take this pistol — you\'ll need it."');
    },
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    brief: 'The job went loud. Three stars, half the SCPD on your tail, and Vera\'s voice in your ear: just stay free for sixty seconds.',
    reward: MISSION_REWARDS[2],
    stages: [
      {
        text: 'Lose the heat — stay free for 60 seconds',
        target: null,
        timer: 60,
        setup(world) {
          world.player.wanted = 3;
          world.mission.holdWanted = true;
          world.say('Vera: "Three stars, Leo. Drive like the city owes you money."');
        },
        update(world, dt) {
          world.mission.timer -= dt;
          return world.mission.timer <= 0;
        },
      },
    ],
    onComplete(world) {
      world.mission.holdWanted = false;
      world.player.wanted = 0;
      world.say('Vera: "You\'re clean. That was beautiful driving."');
    },
  },
  {
    id: 'turf-run',
    title: 'Turf Run',
    brief: 'Three packages, three drops, and the Northside crew trying to take them off you. Vera\'s words: don\'t stop, don\'t get boxed in, don\'t lose the goods.',
    reward: MISSION_REWARDS[3],
    stages: [
      {
        text: 'Pick up the packages at the warehouse',
        target: { ...SPOTS.packagePickup, r: 90, label: 'PACKAGES' },
        setup(world) {
          world.spawnRivals(2);
          world.say('Vera: "Northside knows about the run. Watch your mirrors."');
        },
        update(world) {
          return nearPlayer(world, SPOTS.packagePickup.x, SPOTS.packagePickup.y, 90);
        },
      },
      {
        text: 'Drop 1 of 3 — north side',
        target: { ...SPOTS.dropNorth, r: 90, label: 'DROP 1/3' },
        update(world) {
          return nearPlayer(world, SPOTS.dropNorth.x, SPOTS.dropNorth.y, 90);
        },
      },
      {
        text: 'Drop 2 of 3 — west side',
        target: { ...SPOTS.dropWest, r: 90, label: 'DROP 2/3' },
        update(world) {
          return nearPlayer(world, SPOTS.dropWest.x, SPOTS.dropWest.y, 90);
        },
      },
      {
        text: 'Drop 3 of 3 — east side',
        target: { ...SPOTS.dropEast, r: 90, label: 'DROP 3/3' },
        update(world) {
          return nearPlayer(world, SPOTS.dropEast.x, SPOTS.dropEast.y, 90);
        },
      },
    ],
    onComplete(world) {
      world.clearRivals();
      world.say('Vera: "All three drops clean. Northside can keep the bruises."');
    },
  },
  {
    id: 'solmar-heist',
    title: 'The Solmar Heist',
    brief: 'The big one. An armored van leaves the Solmar Bank at noon with the weekend take. Take the van, lose four stars of heat, and bring it to the docks. After this, Leo, you\'re out — or you\'re a legend.',
    reward: MISSION_REWARDS[4],
    stages: [
      {
        text: 'Steal the armored van at the bank',
        target: { ...SPOTS.bank, r: 100, label: 'ARMORED VAN' },
        setup(world) {
          const van = makeCar('armored', SPOTS.bank.x + 60, SPOTS.bank.y, Math.PI / 2, 'mission');
          van.speed = 0;
          world.cars.push(van);
          world.missionCar = van;
          world.say('Vera: "The van is at the bank. This is the one, Leo."');
        },
        update(world) {
          return inCar(world, world.missionCar);
        },
      },
      {
        text: 'Lose the heat and deliver the van to the docks',
        target: { ...SPOTS.docks, r: 110, label: 'DOCKS' },
        setup(world) {
          world.player.wanted = 4;
          world.mission.holdWanted = true;
          world.say('Vera: "Four stars! Get to the docks and don\'t stop for anyone."');
        },
        update(world) {
          return nearPlayer(world, SPOTS.docks.x, SPOTS.docks.y, 110) && inCar(world, world.missionCar);
        },
      },
    ],
    onComplete(world) {
      world.mission.holdWanted = false;
      world.player.wanted = 0;
      world.storyComplete = true;
      world.say('Vera: "It\'s done. Solmar is yours now, Leo Marín."');
    },
  },
];

// The mission runner: holds the active mission, its stage and its target.
export function createMissionState() {
  return {
    index: -1, // -1: free roam, no job active
    stage: 0,
    target: null,
    timer: 0,
    holdWanted: false,
    active: false,
    // A mission's title card, shown briefly when the job starts.
    intro: null,
    stageText: '',
  };
}
