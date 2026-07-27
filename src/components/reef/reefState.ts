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
  /** life value the current wave started from (enables reverse transitions) */
  from: number;
  /** 1 = coming alive, -1 = fading back to bleached */
  direction: 1 | -1;
  /** timestamp (seconds) of the last restore burst, -1 if never */
  burstAt: number;
  /** smoothed absolute scroll speed, roughly 0 -> 1 */
  scrollSpeed: number;
  /** world-space origin the restoration wave radiates from */
  origin: { x: number; y: number; z: number };
  /** timestamp (seconds) the restore wave started, -1 if never */
  restoreAt: number;
};

/** total length of the dead -> alive transformation, in seconds */
export const RESTORE_DURATION = 3.6;
/** how far the wave has to travel to cover the whole reef */
const MAX_RADIUS = 52;
/** width of the soft leading edge of the wave */
const FEATHER = 16;

export const reefState: ReefState = {
  scroll: 0,
  target: 0,
  from: 0,
  direction: 1,
  burstAt: -1,
  scrollSpeed: 0,
  origin: { x: 0, y: -0.5, z: -4 },
  restoreAt: -1,
};

let lastScroll = 0;
let lastTime = -1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => v * v * (3 - 2 * v);
/** eased travel of the wave: gentle start, long natural deceleration */
const easeOut = (v: number) => {
  const s = v * v * (3 - 2 * v);
  return s * s * (3 - 2 * s) * 0.35 + s * 0.65;
};

const now = () => performance.now() / 1000;

/** Update scroll progress and derive a smoothed scroll speed. */
export function setScroll(v: number) {
  const t = now();
  if (lastTime > 0) {
    const dt = Math.max(t - lastTime, 1 / 240);
    const raw = Math.min(1, (Math.abs(v - lastScroll) / dt) * 1.6);
    // fast attack, slow release so motion settles when the user pauses
    const k = raw > reefState.scrollSpeed ? 0.5 : 0.12;
    reefState.scrollSpeed += (raw - reefState.scrollSpeed) * k;
  }
  lastScroll = v;
  lastTime = t;
  reefState.scroll = v;
}

/** Raw 0 -> 1 progress of the restore wave (linear time). */
export function restoreTime() {
  if (reefState.restoreAt < 0) return reefState.target;
  return clamp01((now() - reefState.restoreAt) / RESTORE_DURATION);
}

/** Blend the wave coverage between where the reef was and where it's going. */
const mix = (cov: number) =>
  reefState.from + (reefState.target - reefState.from) * cov;

/** Eased global life value — use for anything that doesn't have a position. */
export function reefLife() {
  if (reefState.restoreAt < 0) return reefState.target;
  return mix(easeOut(restoreTime()));
}

/** Distance the leading edge of the wave has travelled. */
function frontRadius() {
  return easeOut(restoreTime()) * (MAX_RADIUS + FEATHER);
}

/** Life value at a world position — the wave ripples outward from the click. */
export function lifeAt(x: number, y: number, z: number) {
  if (reefState.restoreAt < 0) return reefState.target;
  const o = reefState.origin;
  const dx = x - o.x;
  const dy = (y - o.y) * 0.7;
  const dz = z - o.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return mix(smooth(clamp01((frontRadius() - d) / FEATHER)));
}

/** 0 -> 1 brightness of the radiating light band as it sweeps past a position. */
export function waveEdge(x: number, y: number, z: number) {
  if (reefState.restoreAt < 0) return 0;
  const p = restoreTime();
  if (p >= 1) return 0;
  const o = reefState.origin;
  const dx = x - o.x;
  const dy = (y - o.y) * 0.7;
  const dz = z - o.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const band = (d - (frontRadius() - FEATHER * 0.55)) / (FEATHER * 0.55);
  const g = Math.exp(-band * band * 2.4);
  // the fading wave carries a dimmer, cooler edge than the restoring one
  return g * (1 - p * p) * (reefState.direction > 0 ? 1 : 0.45);
}

/** Short, bright screen-wide bloom flash right after the click. */
export function restoreFlash() {
  if (reefState.restoreAt < 0) return 0;
  const t = now() - reefState.restoreAt;
  if (t < 0 || t > 1.2) return 0;
  const x = t / 1.2;
  const amp = reefState.direction > 0 ? 1 : 0.35;
  return Math.pow(1 - x, 2.2) * Math.min(1, x * 12) * amp;
}

/**
 * Kick off the transformation.
 * `origin` is normalised device coords of the click (-1..1), mapped into a
 * rough world position so the ripple starts where the user actually pressed.
 */
function startWave(to: 0 | 1, origin?: { x: number; y: number }) {
  if (origin) {
    reefState.origin = { x: origin.x * 12, y: origin.y * 5 - 0.5, z: -4 };
  }
  reefState.from = reefLife();
  reefState.target = to;
  reefState.direction = to === 1 ? 1 : -1;
  reefState.restoreAt = now();
  reefState.burstAt = reefState.restoreAt;
}

export function triggerRestore(origin?: { x: number; y: number }) {
  startWave(1, origin);
}

/** Ripple the reef back to its bleached state so the story can be replayed. */
export function revertReef(origin?: { x: number; y: number }) {
  startWave(0, origin);
}

/** Instantly snap back to bleached with no animation. */
export function resetReef() {
  reefState.target = 0;
  reefState.from = 0;
  reefState.direction = 1;
  reefState.burstAt = -1;
  reefState.restoreAt = -1;
}
