/**
 * Procedural reef audio — no assets.
 *  • a continuous underwater ambience bed (muffled ocean movement) that opens
 *    up from "murky" to "clear/rich" as the reef comes back to life
 *  • a one-shot restore cue (low rumble + rising whoosh)
 *
 * Muted by default on load, per browser autoplay policy: nothing is created
 * until the user opts in with a gesture.
 */

const STORAGE_KEY = "reef:audio";

/** Default OFF — the user must opt in. */
export function isAudioEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "on";
}

export function setAudioEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  if (on) startAmbience();
  else stopAmbience();
}

/** Has the user ever made a choice? Used to show the gentle unmute prompt. */
export function hasAudioChoice() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    // brown-ish noise: softer, deeper than white
    last = (last + Math.random() * 2 - 1) * 0.5;
    data[i] = last;
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/* Ambient underwater bed                                              */
/* ------------------------------------------------------------------ */
type Ambience = {
  master: GainNode;
  lp: BiquadFilterNode;
  swellGain: GainNode;
  toneGain: GainNode;
  nodes: AudioScheduledSourceNode[];
};

let ambience: Ambience | null = null;
let ambienceLife = 0;

export function startAmbience() {
  if (ambience || !isAudioEnabled()) return;
  const ac = getContext();
  if (!ac) return;
  const t0 = ac.currentTime;

  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.linearRampToValueAtTime(0.16, t0 + 3.5); // gentle fade-in
  master.connect(ac.destination);

  // Muffled, slow-moving water: brown noise through a low-pass that opens up
  // when the reef is alive.
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(340, t0);
  lp.Q.value = 0.4;
  lp.connect(master);

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 8);
  src.loop = true;
  const bedGain = ac.createGain();
  bedGain.gain.value = 0.55;
  src.connect(bedGain).connect(lp);

  // slow swell — distant surge, breathing in and out
  const swellGain = ac.createGain();
  swellGain.gain.value = 0.35;
  const swellSrc = ac.createBufferSource();
  swellSrc.buffer = noiseBuffer(ac, 6);
  swellSrc.loop = true;
  const swellBand = ac.createBiquadFilter();
  swellBand.type = "bandpass";
  swellBand.frequency.value = 220;
  swellBand.Q.value = 0.7;
  swellSrc.connect(swellBand).connect(swellGain).connect(lp);

  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.28;
  lfo.connect(lfoGain).connect(swellGain.gain);

  // deep, muffled ocean tone
  const toneGain = ac.createGain();
  toneGain.gain.value = 0.07;
  toneGain.connect(lp);
  const tone = ac.createOscillator();
  tone.type = "sine";
  tone.frequency.value = 58;
  const tone2 = ac.createOscillator();
  tone2.type = "sine";
  tone2.frequency.value = 87.3;
  const tone2Gain = ac.createGain();
  tone2Gain.gain.value = 0.35;
  tone.connect(toneGain);
  tone2.connect(tone2Gain).connect(toneGain);

  src.start(t0);
  swellSrc.start(t0);
  lfo.start(t0);
  tone.start(t0);
  tone2.start(t0);

  ambience = {
    master,
    lp,
    swellGain,
    toneGain,
    nodes: [src, swellSrc, lfo, tone, tone2],
  };
  applyAmbienceLife(ambienceLife, true);
}

export function stopAmbience() {
  const a = ambience;
  if (!a || !ctx) return;
  ambience = null;
  const t0 = ctx.currentTime;
  a.master.gain.cancelScheduledValues(t0);
  a.master.gain.setValueAtTime(Math.max(a.master.gain.value, 0.0001), t0);
  a.master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
  a.nodes.forEach((n) => {
    try {
      n.stop(t0 + 0.9);
    } catch {
      /* already stopped */
    }
  });
}

function applyAmbienceLife(life: number, immediate = false) {
  const a = ambience;
  if (!a || !ctx) return;
  const t = ctx.currentTime;
  const ramp = immediate ? 0.05 : 0.4;
  // murky (dark, muffled) -> clearer, richer as the reef revives
  a.lp.frequency.setTargetAtTime(320 + life * 2100, t, ramp);
  a.swellGain.gain.setTargetAtTime(0.3 + life * 0.35, t, ramp);
  a.toneGain.gain.setTargetAtTime(0.07 - life * 0.03, t, ramp);
  a.master.gain.setTargetAtTime(0.16 + life * 0.06, t, ramp * 2);
}

/** Drive the ambience timbre from the reef's 0 -> 1 life value. */
export function setAmbienceLife(life: number) {
  if (Math.abs(life - ambienceLife) < 0.01) return;
  ambienceLife = life;
  applyAmbienceLife(life);
}

/* ------------------------------------------------------------------ */
/* One-shot restore cue                                                */
/* ------------------------------------------------------------------ */
/** Low rumble + whoosh, ~3.5s, matching the visual transformation. */
export function playRestoreCue() {
  if (!isAudioEnabled()) return;
  const ac = getContext();
  if (!ac) return;

  const t0 = ac.currentTime;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.5, t0 + 0.35);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
  master.connect(ac.destination);

  // --- sub rumble ---------------------------------------------------
  const sub = ac.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(64, t0);
  sub.frequency.exponentialRampToValueAtTime(30, t0 + 3.4);
  const subGain = ac.createGain();
  subGain.gain.setValueAtTime(0.0001, t0);
  subGain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.5);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
  sub.connect(subGain).connect(master);

  // --- whoosh (filtered noise sweeping upward, then away) ------------
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 3.8);
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(140, t0);
  band.frequency.exponentialRampToValueAtTime(1900, t0 + 1.1);
  band.frequency.exponentialRampToValueAtTime(220, t0 + 3.5);
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.45);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
  src.connect(band).connect(noiseGain).connect(master);

  // --- soft bloom shimmer on the release -----------------------------
  const shimmer = ac.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.setValueAtTime(320, t0);
  shimmer.frequency.exponentialRampToValueAtTime(720, t0 + 2.6);
  const shimmerGain = ac.createGain();
  shimmerGain.gain.setValueAtTime(0.0001, t0);
  shimmerGain.gain.exponentialRampToValueAtTime(0.06, t0 + 1.4);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
  shimmer.connect(shimmerGain).connect(master);

  sub.start(t0);
  src.start(t0);
  shimmer.start(t0);
  sub.stop(t0 + 3.7);
  src.stop(t0 + 3.7);
  shimmer.stop(t0 + 3.7);
}
