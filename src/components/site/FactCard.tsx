import { useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { Reveal } from "./Reveal";

export type Fact = {
  value: string;
  label: string;
  body: string;
  source: string;
};

const SPRING = { stiffness: 170, damping: 18, mass: 0.6 } as const;

/**
 * Premium, restrained 3D tilt: the card leans a couple of degrees toward the
 * cursor while a specular highlight and the border glow track the same point,
 * like light sliding across glass. Pointer devices only — touch gets a plain
 * tap-friendly card with no hover state to get stuck in.
 */
export function FactCard({ fact, index }: { fact: Fact; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  // -1 .. 1 normalised cursor position within the card
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const glow = useMotionValue(0);

  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);
  const sGlow = useSpring(glow, { stiffness: 120, damping: 20 });

  const rotateX = useTransform(sy, [-1, 1], [6.5, -6.5]);
  const rotateY = useTransform(sx, [-1, 1], [-7.5, 7.5]);

  // highlight + border sheen follow the cursor across the surface
  const hx = useTransform(sx, [-1, 1], ["0%", "100%"]);
  const hy = useTransform(sy, [-1, 1], ["0%", "100%"]);
  const sheen = useMotionTemplate`radial-gradient(340px circle at ${hx} ${hy}, oklch(0.9 0.14 190 / 0.22), transparent 62%)`;
  const border = useMotionTemplate`radial-gradient(220px circle at ${hx} ${hy}, oklch(0.92 0.16 185 / 0.85), transparent 70%)`;

  // content lifts slightly against the card for a parallax feel
  const contentX = useTransform(sx, [-1, 1], [7, -7]);
  const contentY = useTransform(sy, [-1, 1], [5, -5]);

  const shadow = useTransform(
    sGlow,
    [0, 1],
    [
      "0 12px 30px -18px oklch(0 0 0 / 0.7)",
      "0 34px 70px -28px oklch(0.55 0.14 190 / 0.55), 0 0 42px -12px oklch(0.7 0.15 185 / 0.32)",
    ],
  );

  const handleMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const handleEnter = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    setActive(true);
    glow.set(1);
  };

  const handleLeave = () => {
    setActive(false);
    // spring back to rest
    px.set(0);
    py.set(0);
    glow.set(0);
  };

  return (
    <Reveal index={index}>
      <div style={{ perspective: 1100 }} className="h-full">
        <motion.article
          ref={ref}
          onPointerMove={handleMove}
          onPointerEnter={handleEnter}
          onPointerLeave={handleLeave}
          onPointerCancel={handleLeave}
          style={{
            rotateX,
            rotateY,
            boxShadow: shadow,
            transformStyle: "preserve-3d",
          }}
          animate={{ scale: active ? 1.028 : 1, y: active ? -6 : 0 }}
          transition={{ type: "spring", stiffness: 210, damping: 20, mass: 0.6 }}
          className="group relative h-full overflow-hidden rounded-2xl glass-panel p-7 sm:p-8 will-change-transform"
        >
          {/* moving light reflection across the glass */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ backgroundImage: sheen, opacity: sGlow }}
          />
          {/* border sheen: a masked ring lit from the cursor position */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              backgroundImage: border,
              opacity: sGlow,
              padding: 1,
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60 transition-opacity duration-700 group-hover:opacity-100"
            style={{ backgroundImage: "var(--gradient-living)" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-24 blur-3xl"
            style={{ backgroundImage: "var(--gradient-living)", opacity: useTransform(sGlow, [0, 1], [0, 0.22]) }}
          />

          <motion.div style={{ x: contentX, y: contentY, transformStyle: "preserve-3d" }}>
            <p className="relative font-display text-5xl leading-none text-living sm:text-6xl">
              {fact.value}
            </p>
            <h3 className="relative mt-5 text-sm uppercase tracking-[0.28em] text-primary/90">
              {fact.label}
            </h3>
            <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">
              {fact.body}
            </p>
            <p className="relative mt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
              {fact.source}
            </p>
          </motion.div>
        </motion.article>
      </div>
    </Reveal>
  );
}
