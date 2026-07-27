import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { reefState, reefLife, lifeAt, waveEdge, restoreFlash } from "./reefState";

/* ------------------------------------------------------------------ */
/* palette (kept in sync with the CSS design tokens)                    */
/* ------------------------------------------------------------------ */
const DEAD_CORAL = new THREE.Color("#E8E4D8");
const DEAD_CORAL_2 = new THREE.Color("#9AA096");
const DEAD_FOG = new THREE.Color("#04120F");
const LIVE_FOG = new THREE.Color("#001A12");
const WAVE_LIGHT = new THREE.Color("#d9fff6");
const LIVING = [
  new THREE.Color("#00E0C6"),
  new THREE.Color("#00FFA3"),
  new THREE.Color("#FF6B6B"),
  new THREE.Color("#FF9F5A"),
  new THREE.Color("#00C2FF"),
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ------------------------------------------------------------------ */
/* Coral field — one instanced capsule mesh for every branch segment    */
/* ------------------------------------------------------------------ */
type Branch = {
  matrix: THREE.Matrix4;
  dead: THREE.Color;
  live: THREE.Color;
  depth: number;
  x: number;
  y: number;
  z: number;
};

function buildReef(count: number): Branch[] {
  const rand = rng(9731);
  const branches: Branch[] = [];
  const dummy = new THREE.Object3D();

  for (let c = 0; c < count; c++) {
    const cx = (rand() - 0.5) * 38;
    const cz = -rand() * 24 - 4;
    const cy = -3.2 + rand() * 0.5 - Math.abs(cx) * 0.05;
    const liveColor = LIVING[Math.floor(rand() * LIVING.length)];
    const deadColor = DEAD_CORAL.clone().lerp(DEAD_CORAL_2, rand() * 0.7);
    const arms = 3 + Math.floor(rand() * 4);
    const scale = 0.6 + rand() * 1.1;

    for (let a = 0; a < arms; a++) {
      const baseAngle = (a / arms) * Math.PI * 2 + rand();
      let px = cx;
      let py = cy;
      let pz = cz;
      const segs = 3 + Math.floor(rand() * 3);
      for (let s = 0; s < segs; s++) {
        const len = (0.7 - s * 0.1) * scale;
        const tilt = 0.5 - s * 0.12 + rand() * 0.3;
        const dir = new THREE.Vector3(
          Math.cos(baseAngle) * tilt,
          1,
          Math.sin(baseAngle) * tilt,
        ).normalize();
        const nx = px + dir.x * len;
        const ny = py + dir.y * len;
        const nz = pz + dir.z * len;

        dummy.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const thick = (0.13 - s * 0.02) * scale;
        dummy.scale.set(thick, len, thick);
        dummy.updateMatrix();

        branches.push({
          matrix: dummy.matrix.clone(),
          dead: deadColor,
          live: liveColor,
          depth: -cz,
          x: (px + nx) / 2,
          y: (py + ny) / 2,
          z: (pz + nz) / 2,
        });
        px = nx;
        py = ny;
        pz = nz;
      }
    }
  }
  return branches;
}

function CoralField({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const branches = useMemo(() => buildReef(count), [count]);
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const g = reefLife();

    if (!mesh.instanceMatrix.array || mesh.count !== branches.length) {
      mesh.count = branches.length;
    }
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      mesh.setMatrixAt(i, b.matrix);
      // colour + material ripple outward from the point that was clicked
      const l = lifeAt(b.x, b.y, b.z);
      scratch.copy(b.dead).lerp(b.live, l);
      const edge = waveEdge(b.x, b.y, b.z);
      if (edge > 0.001) {
        // over-bright leading band, picked up by bloom as a radiating burst
        scratch.lerp(WAVE_LIGHT, edge * 0.85).multiplyScalar(1 + edge * 1.6);
      }
      mesh.setColorAt(i, scratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (matRef.current) {
      matRef.current.emissiveIntensity = g * 0.45 + restoreFlash() * 0.5;
      matRef.current.roughness = 0.9 - g * 0.4;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, branches.length]}
      castShadow={false}
      frustumCulled={false}
    >
      <capsuleGeometry args={[1, 1, 3, 7]} />
      <meshStandardMaterial
        ref={matRef}
        vertexColors
        roughness={0.9}
        metalness={0.05}
        emissive="#0b3f38"
        emissiveIntensity={0}
      />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/* Seafloor                                                            */
/* ------------------------------------------------------------------ */
function Seafloor() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const dead = useMemo(() => new THREE.Color("#12211D"), []);
  const live = useMemo(() => new THREE.Color("#083B33"), []);
  useFrame(() => {
    matRef.current?.color.copy(dead).lerp(live, reefLife());
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.6, -10]}>
      <planeGeometry args={[120, 90, 1, 1]} />
      <meshStandardMaterial ref={matRef} color="#12211D" roughness={1} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Bioluminescent particle layers                                       */
/* ------------------------------------------------------------------ */
const CYAN = new THREE.Color("#4fe6d6");
const CORAL_WARM = new THREE.Color("#e8815f");
const DULL = new THREE.Color("#8fa6a0");

const glowVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uLife;
  uniform float uScale;
  uniform float uFlicker;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float pulse = 1.0 + uFlicker * sin(uTime * (0.8 + aSpeed * 2.2) + aPhase);
    vColor = aColor;
    vAlpha = clamp(0.35 + 0.65 * pulse * 0.5, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mv.z, 3.0);
    gl_PointSize = clamp(aSize * uScale * pulse * (1.0 + uLife * 0.5) * (140.0 / dist), 1.0, 20.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const glowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float halo = pow(core, 3.0);
    gl_FragColor = vec4(vColor * (0.3 + halo * 0.6), core * halo * vAlpha * uOpacity * 0.75);
  }
`;

type LayerConfig = {
  count: number;
  seed: number;
  /** z range (negative = further away) */
  zNear: number;
  zFar: number;
  spread: number;
  size: [number, number];
  rise: [number, number];
  flicker: number;
  opacity: number;
  warmth: number;
  drift: number;
};

function ParticleLayer({ cfg }: { cfg: LayerConfig }) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const colorScratch = useMemo(() => new THREE.Color(), []);

  const { positions, sizes, phases, speeds, colors, live, dead } = useMemo(() => {
    const rand = rng(cfg.seed);
    const n = cfg.count;
    const positions = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const phases = new Float32Array(n);
    const speeds = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    const live: THREE.Color[] = [];
    const dead: THREE.Color[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (rand() - 0.5) * cfg.spread;
      positions[i * 3 + 1] = -4 + rand() * 18;
      positions[i * 3 + 2] = cfg.zNear + rand() * (cfg.zFar - cfg.zNear);
      sizes[i] = cfg.size[0] + rand() * (cfg.size[1] - cfg.size[0]);
      phases[i] = rand() * Math.PI * 2;
      speeds[i] = cfg.rise[0] + rand() * (cfg.rise[1] - cfg.rise[0]);
      c.copy(CYAN).lerp(CORAL_WARM, Math.pow(rand(), 1.6) * cfg.warmth);
      live.push(c.clone());
      dead.push(DULL.clone().lerp(c, 0.15));
      colors[i * 3] = dead[i].r;
      colors[i * 3 + 1] = dead[i].g;
      colors[i * 3 + 2] = dead[i].b;
    }
    return { positions, sizes, phases, speeds, colors, live, dead };
  }, [cfg]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLife: { value: 0 },
      uScale: { value: 1 },
      uFlicker: { value: cfg.flicker },
      uOpacity: { value: cfg.opacity },
    }),
    [cfg],
  );

  useFrame((state, d) => {
    const l = reefLife();
    const geo = pointsRef.current?.geometry;
    if (!geo) return;

    const boost = 1 + reefState.scrollSpeed * 2.6 * cfg.drift;
    const arr = geo.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < cfg.count; i++) {
      arr[i * 3 + 1] += speeds[i] * d * (0.35 + l) * boost;
      arr[i * 3] += Math.sin(arr[i * 3 + 1] * 0.4 + phases[i]) * d * 0.12 * boost;
      if (arr[i * 3 + 1] > 13) arr[i * 3 + 1] = -4.5;
    }
    geo.attributes.position.needsUpdate = true;

    // colour drifts from dull grey particulate to bioluminescent glow,
    // rippling outward from the restore point instead of all at once
    const carr = geo.attributes.aColor.array as Float32Array;
    for (let i = 0; i < cfg.count; i++) {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      const z = arr[i * 3 + 2];
      const li = lifeAt(x, y, z);
      colorScratch.copy(dead[i]).lerp(live[i], li);
      const edge = waveEdge(x, y, z);
      if (edge > 0.001) colorScratch.multiplyScalar(1 + edge * 2.4);
      carr[i * 3] = colorScratch.r;
      carr[i * 3 + 1] = colorScratch.g;
      carr[i * 3 + 2] = colorScratch.b;
    }
    geo.attributes.aColor.needsUpdate = true;

    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uLife.value = l;
      matRef.current.uniforms.uOpacity.value = cfg.opacity * (0.14 + l * 0.75);
      matRef.current.uniforms.uFlicker.value = cfg.flicker * (0.25 + l);
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={glowVertex}
        fragmentShader={glowFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* Foreground jellyfish-like drifters with a trailing light tail */
const TRAIL = 6;

function Jellies({ count }: { count: number }) {
  const bellRef = useRef<THREE.InstancedMesh>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const bellMat = useRef<THREE.MeshStandardMaterial>(null);
  const trailMat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  const jellies = useMemo(() => {
    const rand = rng(3121);
    return Array.from({ length: count }, () => ({
      x: (rand() - 0.5) * 16,
      z: 1.5 + rand() * 4.5,
      y: -3 + rand() * 12,
      speed: 0.22 + rand() * 0.3,
      sway: 0.6 + rand() * 1.5,
      phase: rand() * Math.PI * 2,
      scale: 0.35 + rand() * 0.45,
      color: CYAN.clone().lerp(CORAL_WARM, rand() * 0.55),
    }));
  }, [count]);

  useFrame((state, d) => {
    const l = reefLife();
    const t = state.clock.elapsedTime;
    const boost = 1 + reefState.scrollSpeed * 2.2;
    const bell = bellRef.current;
    const trail = trailRef.current;
    if (!bell || !trail) return;

    for (let i = 0; i < jellies.length; i++) {
      const j = jellies[i];
      j.y += j.speed * d * (0.25 + l) * boost;
      if (j.y > 11) j.y = -5;
      const pulse = 1 + Math.sin(t * 1.4 + j.phase) * 0.14;
      const x = j.x + Math.sin(t * 0.25 + j.phase) * j.sway;

      dummy.position.set(x, j.y, j.z);

      const jl = lifeAt(x, j.y, j.z);
      dummy.scale.set(
        j.scale * pulse * jl,
        j.scale * (1.15 - (pulse - 1)) * jl,
        j.scale * pulse * jl,
      );
      dummy.rotation.set(0, t * 0.1 + j.phase, Math.sin(t * 0.3 + j.phase) * 0.1);
      dummy.updateMatrix();
      bell.setMatrixAt(i, dummy.matrix);
      bell.setColorAt(i, j.color);

      for (let s = 0; s < TRAIL; s++) {
        const k = (s + 1) / TRAIL;
        const idx = i * TRAIL + s;
        dummy.position.set(
          x - Math.sin(t * 0.25 + j.phase) * j.sway * k * 0.35,
          j.y - k * j.scale * 3.4,
          j.z,
        );
        const w = j.scale * (0.34 - k * 0.22) * jl;
        dummy.scale.set(w, w, w);
        dummy.rotation.set(0, 0, Math.sin(t * 1.2 + j.phase + s) * 0.2);
        dummy.updateMatrix();
        trail.setMatrixAt(idx, dummy.matrix);
        scratch.copy(j.color).multiplyScalar(1 - k * 0.75);
        trail.setColorAt(idx, scratch);
      }
    }
    bell.instanceMatrix.needsUpdate = true;
    trail.instanceMatrix.needsUpdate = true;
    if (bell.instanceColor) bell.instanceColor.needsUpdate = true;
    if (trail.instanceColor) trail.instanceColor.needsUpdate = true;
    if (bellMat.current) {
      bellMat.current.emissiveIntensity = l * 0.35;
      bellMat.current.opacity = 0.03 + l * 0.12;
    }
    if (trailMat.current) trailMat.current.opacity = l * 0.1;
  });

  return (
    <group>
      <instancedMesh ref={bellRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial
          ref={bellMat}
          vertexColors
          emissive="#2fd8c8"
          emissiveIntensity={0}
          transparent
          opacity={0.1}
          roughness={0.25}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <instancedMesh
        ref={trailRef}
        args={[undefined, undefined, count * TRAIL]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          ref={trailMat}
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  );
}

function ParticleField({ low }: { low: boolean }) {
  const layers = useMemo<LayerConfig[]>(
    () => [
      {
        // tiny distant plankton
        count: low ? 420 : 1200,
        seed: 4242,
        zNear: -34,
        zFar: -14,
        spread: 46,
        size: [0.5, 1.1],
        rise: [0.05, 0.16],
        flicker: 0.18,
        opacity: 0.4,
        warmth: 0.35,
        drift: 0.35,
      },
      {
        // mid-ground pulsing motes
        count: low ? 120 : 260,
        seed: 8181,
        zNear: -14,
        zFar: -2,
        spread: 32,
        size: [1.1, 2.1],
        rise: [0.16, 0.42],
        flicker: 0.55,
        opacity: 0.5,
        warmth: 0.7,
        drift: 0.8,
      },
      {
        // near sparse embers
        count: low ? 14 : 30,
        seed: 5150,
        zNear: -2,
        zFar: 4,
        spread: 24,
        size: [1.1, 2.0],
        rise: [0.25, 0.6],
        flicker: 0.75,
        opacity: 0.42,
        warmth: 0.9,
        drift: 1,
      },
    ],
    [low],
  );

  return (
    <>
      {layers.map((cfg) => (
        <ParticleLayer key={cfg.seed} cfg={cfg} />
      ))}
      <Jellies count={low ? 3 : 6} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Reef inhabitants — anemones, urchins, kelp, rays and a sea turtle    */
/* ------------------------------------------------------------------ */
const ANEMONE_TENTACLES = 12;
const ANEMONE_LIVE = [
  new THREE.Color("#ff7a5c"),
  new THREE.Color("#ffb85c"),
  new THREE.Color("#8affe0"),
  new THREE.Color("#c47dff"),
];
const ANEMONE_DEAD = new THREE.Color("#b9b7ad");

/** Sea anemones: pale and shrunken when bleached, plump and glowing when alive. */
function Anemones({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  const anemones = useMemo(() => {
    const rand = rng(2468);
    return Array.from({ length: count }, () => {
      const x = (rand() - 0.5) * 30;
      const z = -2 - rand() * 20;
      return {
        x,
        z,
        y: -3.35 - Math.abs(x) * 0.04,
        scale: 0.6 + rand() * 0.7,
        phase: rand() * Math.PI * 2,
        color: ANEMONE_LIVE[Math.floor(rand() * ANEMONE_LIVE.length)],
      };
    });
  }, [count]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < anemones.length; i++) {
      const a = anemones[i];
      const l = lifeAt(a.x, a.y, a.z);
      const edge = waveEdge(a.x, a.y, a.z);
      for (let s = 0; s < ANEMONE_TENTACLES; s++) {
        const idx = i * ANEMONE_TENTACLES + s;
        const ang = (s / ANEMONE_TENTACLES) * Math.PI * 2 + a.phase;
        // tentacles unfurl outward and sway with the current as life returns
        const reach = (0.25 + l * 0.55) * a.scale;
        const sway = Math.sin(t * 1.1 + a.phase + s * 0.5) * 0.12 * (0.3 + l);
        const len = (0.22 + l * 0.5) * a.scale;
        dummy.position.set(
          a.x + Math.cos(ang) * reach + sway,
          a.y + len * 0.9 + l * 0.14,
          a.z + Math.sin(ang) * reach + sway * 0.5,
        );
        dummy.rotation.set(Math.cos(ang) * (0.5 - l * 0.2) + sway, 0, Math.sin(ang) * -0.45);
        const thick = (0.05 + l * 0.035) * a.scale;
        dummy.scale.set(thick, len, thick);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
        scratch.copy(ANEMONE_DEAD).lerp(a.color, l);
        if (edge > 0.001) scratch.lerp(WAVE_LIGHT, edge * 0.7).multiplyScalar(1 + edge * 1.3);
        mesh.setColorAt(idx, scratch);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (matRef.current) matRef.current.emissiveIntensity = reefLife() * 0.5;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count * ANEMONE_TENTACLES]}
      frustumCulled={false}
    >
      <capsuleGeometry args={[1, 1, 2, 6]} />
      <meshStandardMaterial
        ref={matRef}
        vertexColors
        roughness={0.55}
        emissive="#2c6f63"
        emissiveIntensity={0}
      />
    </instancedMesh>
  );
}

const URCHIN_SPIKES = 14;

/** Sea urchins — survivors. They're here in both states, just duller when bleached. */
function Urchins({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const dead = useMemo(() => new THREE.Color("#4a4a52"), []);
  const live = useMemo(() => new THREE.Color("#2a1440"), []);

  const urchins = useMemo(() => {
    const rand = rng(1357);
    return Array.from({ length: count }, () => {
      const x = (rand() - 0.5) * 32;
      const z = -2 - rand() * 22;
      const dirs = Array.from({ length: URCHIN_SPIKES }, () =>
        new THREE.Vector3(rand() - 0.5, rand() * 0.9 + 0.1, rand() - 0.5).normalize(),
      );
      return { x, z, y: -3.3 - Math.abs(x) * 0.04, scale: 0.22 + rand() * 0.22, dirs };
    });
  }, [count]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < urchins.length; i++) {
      const u = urchins[i];
      const l = lifeAt(u.x, u.y, u.z);
      for (let s = 0; s < URCHIN_SPIKES; s++) {
        const d = u.dirs[s];
        const len = u.scale * (1.5 + Math.sin(t * 0.7 + s) * 0.05);
        dummy.position.set(
          u.x + d.x * len * 0.5,
          u.y + d.y * len * 0.5,
          u.z + d.z * len * 0.5,
        );
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        dummy.scale.set(u.scale * 0.09, len, u.scale * 0.09);
        dummy.updateMatrix();
        mesh.setMatrixAt(i * URCHIN_SPIKES + s, dummy.matrix);
        scratch.copy(dead).lerp(live, l);
        mesh.setColorAt(i * URCHIN_SPIKES + s, scratch);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count * URCHIN_SPIKES]}
      frustumCulled={false}
    >
      <coneGeometry args={[0.5, 1, 4]} />
      <meshStandardMaterial vertexColors roughness={0.7} />
    </instancedMesh>
  );
}

const KELP_SEGS = 7;

/** Seagrass / kelp blades that sway with the current. */
function Kelp({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const dead = useMemo(() => new THREE.Color("#6a6b5c"), []);
  const live = useMemo(() => new THREE.Color("#1f8f5f"), []);

  const stalks = useMemo(() => {
    const rand = rng(8642);
    return Array.from({ length: count }, () => {
      const x = (rand() - 0.5) * 34;
      const z = -4 - rand() * 22;
      return {
        x,
        z,
        y: -3.5 - Math.abs(x) * 0.04,
        h: 0.5 + rand() * 0.7,
        phase: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.5,
      };
    });
  }, [count]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    const boost = 1 + reefState.scrollSpeed * 1.2;
    for (let i = 0; i < stalks.length; i++) {
      const k = stalks[i];
      const l = lifeAt(k.x, k.y + 1, k.z);
      for (let s = 0; s < KELP_SEGS; s++) {
        const f = s / KELP_SEGS;
        const bend = Math.sin(t * 0.9 * boost + k.phase + f * 2.2) * 0.35 * (f + 0.2);
        dummy.position.set(
          k.x + bend + k.lean * f * 2,
          k.y + f * k.h * KELP_SEGS * 0.32 + k.h * 0.16,
          k.z + bend * 0.4,
        );
        dummy.rotation.set(bend * 0.3, k.phase, bend * 0.6);
        const w = (0.11 - f * 0.05) * (0.5 + l * 0.6);
        dummy.scale.set(w, k.h * 0.34, 0.02);
        dummy.updateMatrix();
        mesh.setMatrixAt(i * KELP_SEGS + s, dummy.matrix);
        scratch.copy(dead).lerp(live, l);
        mesh.setColorAt(i * KELP_SEGS + s, scratch);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count * KELP_SEGS]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.85} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/** A sea turtle that glides across the reef once it's alive again. */
function SeaTurtle() {
  const group = useRef<THREE.Group>(null);
  const flipL = useRef<THREE.Mesh>(null);
  const flipR = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const a = t * 0.05;
    const r = 16;
    const x = Math.cos(a) * r;
    const z = -13 + Math.sin(a) * r * 0.6;
    const y = 1.4 + Math.sin(t * 0.22) * 0.9;
    g.position.set(x, y, z);
    g.rotation.y = -a + Math.PI / 2;
    g.rotation.z = Math.sin(t * 0.3) * 0.09;
    const l = lifeAt(x, y, z);
    g.scale.setScalar(0.62 * l);
    g.visible = l > 0.02;
    const flap = Math.sin(t * 1.5) * 0.5;
    if (flipL.current) flipL.current.rotation.z = 0.35 + flap;
    if (flipR.current) flipR.current.rotation.z = -0.35 - flap;
  });

  return (
    <group ref={group} scale={0}>
      {/* shell */}
      <mesh scale={[1.15, 0.42, 1.5]}>
        <sphereGeometry args={[1, 18, 14]} />
        <meshStandardMaterial color="#2c4536" roughness={0.9} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.08, 1.65]} scale={[0.33, 0.3, 0.42]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#33513f" roughness={0.85} />
      </mesh>
      {/* front flippers */}
      <mesh ref={flipL} position={[1.0, 0, 0.5]} scale={[1.15, 0.09, 0.4]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#2f4a3a" roughness={0.85} />
      </mesh>
      <mesh ref={flipR} position={[-1.0, 0, 0.5]} scale={[1.15, 0.09, 0.4]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#2f4a3a" roughness={0.85} />
      </mesh>
      {/* rear flippers */}
      <mesh position={[0.75, 0, -1.05]} scale={[0.55, 0.08, 0.3]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#2f4a3a" roughness={0.85} />
      </mesh>
      <mesh position={[-0.75, 0, -1.05]} scale={[0.55, 0.08, 0.3]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#2f4a3a" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Manta rays gliding through the upper water column. */
function Rays({ count }: { count: number }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Mesh | null)[]>([]);

  const rays = useMemo(() => {
    const rand = rng(9182);
    return Array.from({ length: count }, () => ({
      r: 9 + rand() * 8,
      y: 1.5 + rand() * 4,
      speed: 0.03 + rand() * 0.03,
      phase: rand() * Math.PI * 2,
      scale: 0.8 + rand() * 0.6,
    }));
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    rays.forEach((ray, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = t * ray.speed + ray.phase;
      const x = Math.cos(a) * ray.r;
      const z = -12 + Math.sin(a) * ray.r * 0.7;
      const y = ray.y + Math.sin(t * 0.3 + ray.phase) * 0.7;
      g.position.set(x, y, z);
      g.rotation.y = -a + Math.PI / 2;
      const l = lifeAt(x, y, z);
      g.scale.setScalar(ray.scale * l);
      g.visible = l > 0.02;
      const w = wings.current[i];
      if (w) w.rotation.x = Math.sin(t * 1.1 + ray.phase) * 0.35;
    });
  });

  return (
    <>
      {rays.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          scale={0}
        >
          <mesh
            ref={(el) => {
              wings.current[i] = el;
            }}
            rotation={[0, 0, 0]}
            scale={[2.4, 0.12, 1.5]}
          >
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial
              color="#20343f"
              roughness={0.6}
              emissive="#0a2a33"
              emissiveIntensity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* tail */}
          <mesh position={[0, 0, -1.6]} rotation={[Math.PI / 2, 0, 0]} scale={[0.05, 1.4, 0.05]}>
            <cylinderGeometry args={[1, 1, 1, 5]} />
            <meshStandardMaterial color="#20343f" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Fish shoal — only visible once the reef is alive                     */
/* ------------------------------------------------------------------ */
function Fish({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const life = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => {
    const rand = rng(777);
    return Array.from({ length: count }, () => ({
      r: 3 + rand() * 12,
      y: -2.4 + rand() * 4.5,
      z: -rand() * 24 - 2,
      speed: 0.15 + rand() * 0.35,
      phase: rand() * Math.PI * 2,
      scale: 0.1 + rand() * 0.14,
    }));
  }, [count]);

  useFrame((state, d) => {
    life.current = reefLife();
    const t = state.clock.elapsedTime;
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const a = t * s.speed + s.phase;
      dummy.position.set(
        Math.cos(a) * s.r,
        s.y + Math.sin(a * 2.2) * 0.5,
        s.z + Math.sin(a) * s.r * 0.35,
      );
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -a);
      dummy.rotateZ(Math.sin(a * 6) * 0.12);
      dummy.scale.setScalar(s.scale * lifeAt(dummy.position.x, dummy.position.y, dummy.position.z));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (matRef.current) matRef.current.emissiveIntensity = life.current * 0.5;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <coneGeometry args={[0.5, 1.6, 5]} />
      <meshStandardMaterial
        ref={matRef}
        color="#00C2FF"
        emissive="#0b3f38"
        emissiveIntensity={0}
        roughness={0.4}
      />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/* Volumetric light shafts                                              */
/* ------------------------------------------------------------------ */
const shaftVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const shaftFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform float uTime;
  void main() {
    float edge = smoothstep(0.0, 0.45, vUv.x) * smoothstep(1.0, 0.55, vUv.x);
    float fade = smoothstep(0.0, 0.7, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
    float flicker = 0.85 + 0.15 * sin(uTime * 0.6 + vUv.y * 3.0);
    gl_FragColor = vec4(uColor, edge * fade * uOpacity * flicker);
  }
`;

function LightShafts() {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.ShaderMaterial[]>([]);
  const life = useRef(0);

  const shafts = useMemo(
    () => [
      { x: -7, z: -14, rot: 0.22, w: 4.5 },
      { x: 1.5, z: -18, rot: -0.14, w: 6 },
      { x: 9, z: -11, rot: 0.3, w: 3.6 },
    ],
    [],
  );

  useFrame((state, d) => {
    life.current = reefLife();
    const flash = restoreFlash();
    const t = state.clock.elapsedTime;
    mats.current.forEach((m, i) => {
      if (!m) return;
      m.uniforms.uTime.value = t + i;
      m.uniforms.uOpacity.value = 0.07 + life.current * 0.22 + flash * 0.35;
      m.uniforms.uColor.value.setHex(life.current > 0.5 ? 0x8ffff0 : 0xbfd6cf);
    });
    if (group.current) group.current.rotation.y = Math.sin(t * 0.05) * 0.05;
  });

  return (
    <group ref={group}>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, 4, s.z]} rotation={[0, 0, s.rot]}>
          <planeGeometry args={[s.w, 22]} />
          <shaderMaterial
            ref={(m) => {
              if (m) mats.current[i] = m as THREE.ShaderMaterial;
            }}
            vertexShader={shaftVertex}
            fragmentShader={shaftFragment}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={{
              uOpacity: { value: 0.1 },
              uColor: { value: new THREE.Color("#bfd6cf") },
              uTime: { value: 0 },
            }}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll-linked documentary camera path                                */
/* ------------------------------------------------------------------ */
type CamKey = {
  /** scroll progress 0 -> 1 */
  at: number;
  pos: [number, number, number];
  look: [number, number, number];
};

/**
 * A slow tracking shot through the reef, keyed to the narrative beats:
 * hero → drifting in → close on coral detail during the facts → pulling
 * back wide for the transformation → settling calm and centred.
 */
const CAM_PATH: CamKey[] = [
  { at: 0.0, pos: [0, 1.9, 12.5], look: [0, -1.3, -14] },
  { at: 0.18, pos: [-2.4, 0.9, 8.6], look: [-1.4, -1.7, -13] },
  { at: 0.36, pos: [1.8, -0.6, 4.4], look: [1.0, -2.2, -9] }, // coral detail
  { at: 0.48, pos: [3.0, -1.3, 2.4], look: [1.6, -2.5, -8] }, // closest pass
  { at: 0.64, pos: [0, 3.4, 15.5], look: [0, -1.5, -16] }, // wide establishing
  { at: 0.82, pos: [0, 1.1, 8.6], look: [0, -1.1, -13] }, // calm, centred
  { at: 1.0, pos: [0, 1.4, 9.6], look: [0, -0.9, -13] },
];

const smoothstep = (v: number) => v * v * (3 - 2 * v);

function samplePath(p: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const t = p < 0 ? 0 : p > 1 ? 1 : p;
  let i = 0;
  while (i < CAM_PATH.length - 2 && t > CAM_PATH[i + 1].at) i++;
  const a = CAM_PATH[i];
  const b = CAM_PATH[i + 1];
  const k = smoothstep((t - a.at) / Math.max(b.at - a.at, 1e-4));
  outPos.set(
    a.pos[0] + (b.pos[0] - a.pos[0]) * k,
    a.pos[1] + (b.pos[1] - a.pos[1]) * k,
    a.pos[2] + (b.pos[2] - a.pos[2]) * k,
  );
  outLook.set(
    a.look[0] + (b.look[0] - a.look[0]) * k,
    a.look[1] + (b.look[1] - a.look[1]) * k,
    a.look[2] + (b.look[2] - a.look[2]) * k,
  );
}

/* ------------------------------------------------------------------ */
/* Camera drift + fog + light rig, all driven by scroll & life          */
/* ------------------------------------------------------------------ */
function Atmosphere({ low }: { low: boolean }) {
  const { scene, camera } = useThree();
  const key = useRef<THREE.PointLight>(null);
  const rim = useRef<THREE.PointLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const life = useRef(0);
  const fog = useMemo(() => new THREE.FogExp2(DEAD_FOG.getHex(), 0.085), []);

  // physics-ish smoothing state: the rig chases the path target instead of
  // snapping to it, so touch-scroll jitter never reads as robotic motion
  const targetPos = useMemo(() => new THREE.Vector3(0, 1.9, 12.5), []);
  const targetLook = useMemo(() => new THREE.Vector3(0, -1.3, -14), []);
  const curPos = useMemo(() => new THREE.Vector3(0, 1.9, 12.5), []);
  const curLook = useMemo(() => new THREE.Vector3(0, -1.3, -14), []);
  const vel = useMemo(() => new THREE.Vector3(), []);
  const lookVel = useMemo(() => new THREE.Vector3(), []);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useMemo(() => {
    scene.fog = fog;
    scene.background = DEAD_FOG.clone();
  }, [scene, fog]);

  useFrame((state, delta) => {
    life.current = reefLife();
    const l = life.current;
    const flash = restoreFlash();
    const t = state.clock.elapsedTime;
    const p = reefState.scroll;
    const d = Math.min(delta, 1 / 30);

    samplePath(p, targetPos, targetLook);

    // slow idle drift layered on top of the scripted path
    targetPos.x += Math.sin(t * 0.11) * 1.15;
    targetPos.y += Math.sin(t * 0.17) * 0.32;
    targetLook.x += Math.sin(t * 0.07) * 0.7;

    // critically damped spring — smooth deceleration, no overshoot wobble
    const spring = (
      cur: THREE.Vector3,
      target: THREE.Vector3,
      v: THREE.Vector3,
      omega: number,
    ) => {
      const k = omega * omega;
      const c = 2 * omega;
      scratch.copy(target).sub(cur).multiplyScalar(k * d);
      v.addScaledVector(scratch, 1).addScaledVector(v, -Math.min(c * d, 1));
      cur.addScaledVector(v, d);
    };

    spring(curPos, targetPos, vel, low ? 2.6 : 2.2);
    spring(curLook, targetLook, lookVel, low ? 3.0 : 2.6);

    camera.position.copy(curPos);
    camera.lookAt(curLook);

    fog.density = 0.03 - l * 0.014 - p * 0.002;
    (fog.color as THREE.Color).copy(DEAD_FOG).lerp(LIVE_FOG, l);
    (scene.background as THREE.Color).copy(DEAD_FOG).lerp(LIVE_FOG, l);

    if (amb.current) amb.current.intensity = 3.4 - l * 1.2 + flash * 2.6;
    if (key.current) {
      key.current.intensity = 520 + l * 220 + Math.sin(t * 0.8) * 12 + flash * 900;
      key.current.color.setHex(l > 0.5 ? 0x00ffa3 : 0xcfe3dc);
    }
    if (rim.current) {
      rim.current.intensity = 60 + l * 120 + flash * 260;
      rim.current.position.set(reefState.origin.x, reefState.origin.y, reefState.origin.z);
    }
  });

  return (
    <>
      <ambientLight ref={amb} intensity={3.4} color="#9fb8b1" />
      <pointLight ref={key} position={[0, 14, 4]} intensity={520} distance={160} decay={1.1} />
      <pointLight
        ref={rim}
        position={[-8, 1, -14]}
        color="#00C2FF"
        intensity={30}
        distance={90}
        decay={1.2}
      />
    </>
  );
}

function Effects({ low }: { low: boolean }) {
  return (
    <EffectComposer enableNormalPass={false} multisampling={low ? 0 : 4}>
      <Bloom
        intensity={low ? 0.55 : 1.25}
        luminanceThreshold={low ? 0.42 : 0.3}
        luminanceSmoothing={0.5}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={low ? 0.5 : 0.6} />
    </EffectComposer>
  );
}

function detectLow() {
  if (typeof window === "undefined") return true;
  const small = window.innerWidth < 820;
  const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return small || weak || coarse;
}

export default function ReefScene() {
  const [low] = useState(detectLow);

  return (
    <Canvas
      dpr={low ? [1, 1.25] : [1, 1.8]}
      camera={{ position: [0, 1.9, 12.5], fov: low ? 60 : 52, near: 0.1, far: 90 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <Atmosphere low={low} />
      <LightShafts />
      <CoralField count={low ? 20 : 54} />
      <Seafloor />
      <Kelp count={low ? 10 : 24} />
      <Anemones count={low ? 7 : 16} />
      <Urchins count={low ? 5 : 12} />
      <ParticleField low={low} />
      <Fish count={low ? 10 : 34} />
      <Rays count={low ? 1 : 2} />
      <SeaTurtle />
      <Effects low={low} />
    </Canvas>
  );
}

