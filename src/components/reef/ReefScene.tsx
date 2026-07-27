import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { reefState } from "./reefState";

/* ------------------------------------------------------------------ */
/* palette (kept in sync with the CSS design tokens)                    */
/* ------------------------------------------------------------------ */
const DEAD_CORAL = new THREE.Color("#E8E4D8");
const DEAD_CORAL_2 = new THREE.Color("#9AA096");
const DEAD_FOG = new THREE.Color("#04120F");
const LIVE_FOG = new THREE.Color("#001A12");
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
  const life = useRef(0);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = Math.min(1, delta * 1.1);
    life.current += (reefState.target - life.current) * t;
    const l = THREE.MathUtils.smoothstep(life.current, 0, 1);

    if (!mesh.instanceMatrix.array || mesh.count !== branches.length) {
      mesh.count = branches.length;
    }
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      mesh.setMatrixAt(i, b.matrix);
      scratch.copy(b.dead).lerp(b.live, l);
      mesh.setColorAt(i, scratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (matRef.current) {
      matRef.current.emissiveIntensity = l * 0.45;
      matRef.current.roughness = 0.9 - l * 0.4;
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
  const life = useRef(0);
  useFrame((_, d) => {
    life.current += (reefState.target - life.current) * Math.min(1, d * 1.1);
    matRef.current?.color.copy(dead).lerp(live, life.current);
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
  const life = useRef(0);

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
    life.current += (reefState.target - life.current) * Math.min(1, d * 1.1);
    const l = life.current;
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

    // colour drifts from dull grey particulate to bioluminescent glow
    const carr = geo.attributes.aColor.array as Float32Array;
    const scratch = new THREE.Color();
    for (let i = 0; i < cfg.count; i++) {
      scratch.copy(dead[i]).lerp(live[i], l);
      carr[i * 3] = scratch.r;
      carr[i * 3 + 1] = scratch.g;
      carr[i * 3 + 2] = scratch.b;
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
  const life = useRef(0);
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
    life.current += (reefState.target - life.current) * Math.min(1, d * 0.9);
    const l = life.current;
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
      dummy.scale.set(j.scale * pulse * l, j.scale * (1.15 - (pulse - 1)) * l, j.scale * pulse * l);
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
        const w = j.scale * (0.34 - k * 0.22) * l;
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
    life.current += (reefState.target - life.current) * Math.min(1, d * 0.9);
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
      dummy.scale.setScalar(s.scale * life.current);
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
    life.current += (reefState.target - life.current) * Math.min(1, d * 1.1);
    const t = state.clock.elapsedTime;
    mats.current.forEach((m, i) => {
      if (!m) return;
      m.uniforms.uTime.value = t + i;
      m.uniforms.uOpacity.value = 0.07 + life.current * 0.22;
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
/* Camera drift + fog + light rig, all driven by scroll & life          */
/* ------------------------------------------------------------------ */
function Atmosphere() {
  const { scene, camera } = useThree();
  const key = useRef<THREE.PointLight>(null);
  const rim = useRef<THREE.PointLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const life = useRef(0);
  const fog = useMemo(() => new THREE.FogExp2(DEAD_FOG.getHex(), 0.085), []);

  useMemo(() => {
    scene.fog = fog;
    scene.background = DEAD_FOG.clone();
  }, [scene, fog]);

  useFrame((state, d) => {
    life.current += (reefState.target - life.current) * Math.min(1, d * 1.1);
    const l = life.current;
    const t = state.clock.elapsedTime;
    const p = reefState.scroll;

    // slow, continuous idle drift + scroll-driven dolly
    camera.position.x = Math.sin(t * 0.11) * 1.6 + p * 1.4;
    camera.position.y = 1.6 + Math.sin(t * 0.17) * 0.4 - p * 1.4;
    camera.position.z = 11 - p * 5.5;
    camera.lookAt(Math.sin(t * 0.07) * 0.8, -1.4 + p * 0.5, -14);

    fog.density = 0.03 - l * 0.014 - p * 0.002;
    (fog.color as THREE.Color).copy(DEAD_FOG).lerp(LIVE_FOG, l);
    (scene.background as THREE.Color).copy(DEAD_FOG).lerp(LIVE_FOG, l);

    if (amb.current) amb.current.intensity = 3.4 - l * 1.2;
    if (key.current) {
      key.current.intensity = 520 + l * 220 + Math.sin(t * 0.8) * 12;
      key.current.color.setHex(l > 0.5 ? 0x00ffa3 : 0xcfe3dc);
    }
    if (rim.current) {
      rim.current.intensity = 60 + l * 120;
      rim.current.position.x = Math.sin(t * 0.2) * 8;
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
    <EffectComposer enableNormalPass={false}>
      <Bloom
        intensity={low ? 0.8 : 1.25}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.5}
        mipmapBlur
      />
      <Vignette offset={0.3} darkness={0.6} />
    </EffectComposer>
  );
}

export default function ReefScene() {
  const low =
    typeof window !== "undefined" &&
    (window.innerWidth < 820 || (navigator.hardwareConcurrency ?? 8) <= 4);

  return (
    <Canvas
      dpr={low ? [1, 1.4] : [1, 1.8]}
      camera={{ position: [0, 1.6, 11], fov: 52, near: 0.1, far: 90 }}
      gl={{ antialias: !low, powerPreference: "high-performance" }}
    >
      <Atmosphere />
      <LightShafts />
      <CoralField count={low ? 26 : 54} />
      <Seafloor />
      <ParticleField low={low} />
      <Fish count={low ? 14 : 34} />
      <Effects low={low} />
    </Canvas>
  );
}
