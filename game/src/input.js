// Keyboard and pointer input. Held keys give movement and driving; one-shot
// presses (start, pause, enter a car, shoot, call Vera, mute) are queued and
// taken once by the loop, so a press between two frames is never lost or
// counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const SHOOT = new Set(['KeyF']);
const CALL = new Set(['KeyT']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);

export function createInput(target) {
  const held = new Set();
  let actions = { confirm: false, pause: false, enter: false, shoot: false, call: false, mute: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || CONFIRM.has(event.code) || PAUSE.has(event.code) || ENTER.has(event.code)
      || SHOOT.has(event.code) || CALL.has(event.code) || MUTE.has(event.code) || RUN.has(event.code)) {
      event.preventDefault();
    }
    held.add(event.code);
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions.confirm = true;
    else if (PAUSE.has(event.code)) actions.pause = true;
    else if (ENTER.has(event.code)) actions.enter = true;
    else if (SHOOT.has(event.code)) actions.shoot = true;
    else if (CALL.has(event.code)) actions.call = true;
    else if (MUTE.has(event.code)) actions.mute = true;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', () => {
    actions.confirm = true;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1..1 on each axis, from WASD or the arrow keys. */
    moveX() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    moveY() {
      return (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
    },
    /** Driving: W/S give +1/-1, A/D give the steering. */
    throttle() {
      return (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0);
    },
    steer() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    handbrake() {
      return has(HANDBRAKE);
    },
    run() {
      return has(RUN);
    },
    /** The one-shot presses since the last call, each true at most once. */
    takeActions() {
      const taken = actions;
      actions = { confirm: false, pause: false, enter: false, shoot: false, call: false, mute: false };
      return taken;
    },
  };
}
