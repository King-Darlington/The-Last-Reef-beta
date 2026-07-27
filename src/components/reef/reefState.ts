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
};

export const reefState: ReefState = {
  scroll: 0,
  target: 0,
  burstAt: -1,
};

export function triggerRestore() {
  reefState.target = 1;
  reefState.burstAt = performance.now() / 1000;
}

export function resetReef() {
  reefState.target = 0;
  reefState.burstAt = -1;
}
