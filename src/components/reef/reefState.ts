/**
 * Mutable, render-free bridge between the scrolling DOM story and the 3D scene.
 * Updating these values never triggers a React re-render — the R3F frame loop
 * reads them each tick, which keeps scroll-linked motion smooth.
 */
export type ReefState = {
  /** 0 -> 1 overall page scroll progress */
  scroll: number;
  /** 0 = bleached, 1 = fully restored (target value) */
  target: number;
  /** timestamp (seconds) of the last restore burst, -1 if never */
  burstAt: number;
  /** smoothed absolute scroll speed, roughly 0 -> 1 */
  scrollSpeed: number;
};

export const reefState: ReefState = {
  scroll: 0,
  target: 0,
  burstAt: -1,
  scrollSpeed: 0,
};

let lastScroll = 0;
let lastTime = -1;

/** Update scroll progress and derive a smoothed scroll speed. */
export function setScroll(v: number) {
  const now = performance.now() / 1000;
  if (lastTime > 0) {
    const dt = Math.max(now - lastTime, 1 / 240);
    const raw = Math.min(1, (Math.abs(v - lastScroll) / dt) * 1.6);
    // fast attack, slow release so motion settles when the user pauses
    const k = raw > reefState.scrollSpeed ? 0.5 : 0.12;
    reefState.scrollSpeed += (raw - reefState.scrollSpeed) * k;
  }
  lastScroll = v;
  lastTime = now;
  reefState.scroll = v;
}

export function triggerRestore() {
  reefState.target = 1;
  reefState.burstAt = performance.now() / 1000;
}

export function resetReef() {
  reefState.target = 0;
  reefState.burstAt = -1;
}

