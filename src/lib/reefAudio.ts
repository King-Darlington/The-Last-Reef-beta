/**
 * Synthesised restore cue — a low rumble under a rising filtered whoosh.
 * No audio assets required; everything is generated with the Web Audio API
 * on the user's click gesture, so autoplay policies are never an issue.
 */

const STORAGE_KEY = "reef:audio";

export function isAudioEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setAudioEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
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
