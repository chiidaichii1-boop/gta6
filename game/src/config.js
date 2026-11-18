// Solmar City: the one place every number of the game lives.
// A sun-soaked coastal city, 3200 by 2400 units, on a 400-unit street grid.
// Roads are the only drivable ground; the east edge is beach and ocean.
export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const ROAD_HALF = 46;
export const BLOCK = 400;
export const STREETS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const STREETS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const BEACH_X = 3050;
export const WATER_X = 3140;

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-city-save-v1';
export const BEST_KEY = 'solmar-city-best-v1';

// Sun-soaked palette: warm sand, teal water, pastel towers, dark asphalt.
export const COLORS = {
  water: '#1f7f8c',
  waterDeep: '#166b7a',
  sand: '#e9d5a1',
  sandDark: '#dcc78d',
  grass: '#7fb069',
  grassDark: '#6da25c',
  asphalt: '#3a3f4a',
  asphaltDark: '#323743',
  roadLine: '#e8e3c8',
  sidewalk: '#b9b3a2',
  sidewalkLine: '#a39d8b',
  buildingRoof: ['#f2a65a', '#e07a5f', '#81b29a', '#f4d35e', '#6d9dc5', '#c08497', '#f7ede2', '#e8b4b8'],
  buildingWall: '#8d7d6b',
  palmTrunk: '#7a5c3e',
  palmLeaf: '#4e9b47',
  player: '#ffd23f',
  playerRing: '#fff3b0',
  police: '#1f2a37',
  policeWhite: '#f4f6f8',
  pedShirt: ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9b5de5', '#f15bb5', '#00bbf9', '#fee440'],
  hudPanel: 'rgba(12, 18, 28, 0.78)',
  hudText: '#f8f9fa',
  hudGold: '#ffd23f',
  star: '#ffd23f',
  starEmpty: '#5a6472',
  danger: '#e63946',
  good: '#43aa8b',
};

// Car models: name, body colour, top speed (units/s), acceleration, turn rate, size.
export const CAR_MODELS = {
  sedan: { name: 'Solmar Sedan', color: '#4a6fa5', topSpeed: 380, accel: 240, turn: 2.6, length: 44, width: 22 },
  taxi: { name: 'Solmar Taxi', color: '#f4b400', topSpeed: 360, accel: 230, turn: 2.7, length: 44, width: 22 },
  sport: { name: 'Veloce GT', color: '#d7263d', topSpeed: 520, accel: 340, turn: 3.1, length: 46, width: 22 },
  van: { name: 'Cargo Van', color: '#8d99ae', topSpeed: 300, accel: 170, turn: 2.1, length: 52, width: 24 },
  pickup: { name: 'Rancho Pickup', color: '#588157', topSpeed: 350, accel: 220, turn: 2.5, length: 48, width: 23 },
  police: { name: 'SCPD Interceptor', color: '#1f2a37', topSpeed: 470, accel: 320, turn: 3.0, length: 46, width: 22 },
  armored: { name: 'Armored Van', color: '#3d5a80', topSpeed: 320, accel: 190, turn: 2.2, length: 54, width: 24 },
};

// What the player walks and drives like.
export const PLAYER = {
  walkSpeed: 190,
  runSpeed: 260,
  radius: 11,
  health: 100,
  punchRange: 34,
  punchDamage: 12,
  pistolDamage: 34,
  pistolRange: 420,
  fireCooldown: 0.28,
};

// Wanted level: stars 0-5, and how the police answer each one.
export const WANTED = {
  maxStars: 5,
  decayDelay: 12,
  decayEvery: 8,
  // foot cops and patrol cars the city fields at each star level.
  copsAt: [0, 2, 3, 4, 6, 8],
  carsAt: [0, 0, 1, 2, 3, 4],
  bustRadiusFoot: 30,
  bustTime: 1.2,
  bustRadiusCar: 46,
  bustSpeed: 26,
};

// Money.
export const ECONOMY = {
  startCash: 50,
  bustFine: 200,
  wastedFine: 150,
};

export const MISSION_REWARDS = [200, 400, 600, 800, 1500];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
