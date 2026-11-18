// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, busted, wasted and story complete. Progress (cash, jobs done) is
// saved to local storage whenever it changes and when the tab hides.
//
// ?seed=N fixes the city's random pattern. ?shot=start|play|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION_DONE, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 50, missionsDone: 0, storyComplete: false };
    const parsed = JSON.parse(raw);
    return {
      cash: typeof parsed.cash === 'number' ? parsed.cash : 50,
      missionsDone: typeof parsed.missionsDone === 'number' ? parsed.missionsDone : 0,
      storyComplete: !!parsed.storyComplete,
    };
  } catch {
    return { cash: 50, missionsDone: 0, storyComplete: false };
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

const world = createWorld(seed, loadSave());
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  // Centre the camera on the player at once: a shot paints twice, too few
  // frames for the follow-lerp to catch up.
  renderer.snapCamera(world.state.player.x, world.state.player.y);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { save: loadSave(), muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = loadSave();
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  function saveGame() {
    save = world.getSave();
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      const earned = save.cash;
      if (earned > best) {
        best = earned;
        window.localStorage.setItem(BEST_KEY, String(best));
      }
    } catch {
      // Storage can be off (private windows): progress then lasts this visit only.
    }
  }

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    announce('Playing Solmar City. Press T to call Vera for a job.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_MISSION_DONE) {
      audio.jingle();
      saveGame();
      if (world.state.storyComplete) {
        screen = SCREEN_COMPLETE;
        announce('Story complete. Solmar City is yours.');
      }
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_BUSTED;
      saveGame();
      announce('Busted. The SCPD took their cut.');
    } else if (events & EVENT_WASTED) {
      audio.busted();
      screen = SCREEN_WASTED;
      saveGame();
      announce('Wasted. The hospital patched you up.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions.mute) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (actions.confirm) audio.ensure();
    if (screen === SCREEN_TITLE && actions.confirm) {
      startGame();
      return;
    }
    if ((screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_COMPLETE) && actions.confirm) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (actions.pause && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions.pause && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions.confirm && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, input, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, input, false);
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    // Sound follows the world: the engine by speed, the siren by the heat.
    const player = world.state.player;
    audio.engine(player.onFoot ? 0 : Math.abs(player.car.speed) / 520, screen === SCREEN_PLAY);
    audio.siren(player.wanted > 0 && screen === SCREEN_PLAY);
    audio.update(0);
    renderer.draw(world.state, screen, { save, muted });
  }

  // Leaving the tab pauses a running game and saves it.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
      saveGame();
    }
  });

  announce('Solmar City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
