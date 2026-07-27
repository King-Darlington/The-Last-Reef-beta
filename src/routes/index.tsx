import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, useTransform } from "motion/react";
import { ReefCanvas } from "@/components/reef/ReefCanvas";
import { Reveal } from "@/components/site/Reveal";
import { FactCard, type Fact } from "@/components/site/FactCard";
import { RestoreNode } from "@/components/site/RestoreNode";
import { SoundToggle } from "@/components/site/SoundToggle";
import { reefLife, setScroll, triggerRestore } from "@/components/reef/reefState";
import {
  hasAudioChoice,
  isAudioEnabled,
  playRestoreCue,
  setAmbienceLife,
  setAudioEnabled,
  startAmbience,
} from "@/lib/reefAudio";

const TITLE = "The Last Reef — An Interactive Story of Coral Loss and Recovery";
const DESCRIPTION =
  "A scroll-driven 3D story about coral bleaching. Watch a bleached reef come back to life — and learn what restoration really takes.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LastReef,
});

const FACTS: Fact[] = [
  {
    value: "84%",
    label: "Reef area under heat stress",
    body: "The bleaching event that began in 2023 has exposed roughly 84% of the world's reef area to bleaching-level heat stress — the largest event ever recorded.",
    source: "ICRI / NOAA Coral Reef Watch, 2025",
  },
  {
    value: "14%",
    label: "Coral lost in a decade",
    body: "Between 2009 and 2018 the world lost about 14% of its living coral — roughly 11,700 km², more coral than covers all of Australia's reefs.",
    source: "GCRMN Status of Coral Reefs of the World, 2020",
  },
  {
    value: "70–90%",
    label: "Projected decline at 1.5°C",
    body: "At 1.5°C of warming, 70–90% of tropical reefs are projected to decline. At 2°C, more than 99% are lost.",
    source: "IPCC Special Report on Global Warming of 1.5°C",
  },
];

function LastReef() {
  const [restored, setRestored] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.12], [0, -60]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setScroll(v);
  });

  useEffect(() => {
    setScroll(0);
    setAudioOn(isAudioEnabled());
  }, []);

  const restore = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (restored) return;
    const r = e.currentTarget.getBoundingClientRect();
    // normalised device coords of the trigger, so the wave radiates from it
    triggerRestore({
      x: ((r.left + r.width / 2) / window.innerWidth) * 2 - 1,
      y: -(((r.top + r.height / 2) / window.innerHeight) * 2 - 1),
    });
    playRestoreCue();
    setRestored(true);
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioOn);
    setAudioOn(!audioOn);
  };

  return (
    <div ref={containerRef} className="relative">
      <ReefCanvas />

      {/* ---------------------------------------------------------- HERO */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-xs uppercase tracking-[0.5em] text-muted-foreground"
          >
            An interactive story
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 28, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 font-display text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl md:text-8xl"
          >
            The Reef
            <br />
            <span className="italic text-living">Remembers Light</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.3, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Coral reefs support 25% of all marine life — and we're losing them. Scroll to see what's
            happening, and what's still possible.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.3, delay: 1.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 flex flex-col items-center gap-6"
          >
            <a
              href="#what-we-had"
              className="group relative inline-flex items-center gap-3 rounded-full border border-primary/40 bg-primary/10 px-9 py-4 text-sm uppercase tracking-[0.3em] text-foreground backdrop-blur-md transition-all duration-500 hover:bg-primary/20"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              Begin
            </a>
            <span className="animate-drift-down text-2xl leading-none text-primary/70">↓</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ------------------------------------------------ BEAT 1 */}
      <section id="what-we-had" className="relative mx-auto max-w-3xl px-6 py-40 sm:py-56">
        <Reveal className="text-xs uppercase tracking-[0.45em] text-primary/80">
          I — What we had
        </Reveal>
        <Reveal
          as="h2"
          index={1}
          className="mt-8 font-display text-4xl font-light leading-tight sm:text-6xl"
        >
          A reef is not scenery. It is a city.
        </Reveal>
        <div className="mt-10 space-y-6 text-lg leading-relaxed text-muted-foreground">
          <Reveal as="p" index={2}>
            Coral covers less than one percent of the ocean floor, yet about a quarter of all marine
            species pass through it — sheltering, spawning, hunting, hiding. Remove the structure
            and the city empties.
          </Reveal>
          <Reveal as="p" index={3}>
            The colour you remember from photographs was never the coral itself. It came from algae
            living inside the polyps, trading sugar for shelter. When the water grows too warm, that
            trade collapses. The coral expels the algae and turns white — bleached, starving, still
            alive for a while.
          </Reveal>
          <Reveal as="p" index={4}>
            What you're looking at is that moment, held still.
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ BEAT 2 — FACTS */}
      <section className="relative mx-auto max-w-6xl px-6 py-24 sm:py-40">
        <Reveal className="text-xs uppercase tracking-[0.45em] text-primary/80">
          II — What's happening
        </Reveal>
        <Reveal
          as="h2"
          index={1}
          className="mt-8 max-w-2xl font-display text-4xl font-light leading-tight sm:text-6xl"
        >
          The ocean has been absorbing our heat for a century.
        </Reveal>
        <Reveal as="p" index={2} className="mt-6 max-w-2xl text-lg text-muted-foreground">
          More than 90% of the excess heat trapped by greenhouse gases has gone into the sea. Reefs
          are where that number stops being abstract.
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {FACTS.map((fact, i) => (
            <FactCard key={fact.value} fact={fact} index={i} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ TURNING POINT */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-32 text-center">
        <Reveal className="text-xs uppercase tracking-[0.45em] text-primary/80">
          III — The turning point
        </Reveal>
        <Reveal
          as="h2"
          index={1}
          className="mt-8 max-w-2xl font-display text-4xl font-light leading-tight sm:text-6xl"
        >
          Bleached is not dead. Not yet.
        </Reveal>
        <Reveal as="p" index={2} className="mt-6 max-w-xl text-lg text-muted-foreground">
          Coral can take its algae back if the water cools in time. Divers are already replanting
          nursery-grown fragments onto damaged reefs — and some of them are spawning again.
        </Reveal>

        <div className="mt-20">
          <RestoreNode
            restored={restored}
            onRestore={restore}
            audioOn={audioOn}
            onToggleAudio={toggleAudio}
          />
        </div>
      </section>

      {/* ------------------------------------------------ BEAT 3 */}
      <section className="relative mx-auto max-w-3xl px-6 py-40 sm:py-56">
        <Reveal className="text-xs uppercase tracking-[0.45em] text-accent">
          IV — What's possible
        </Reveal>
        <Reveal
          as="h2"
          index={1}
          className="mt-8 font-display text-4xl font-light leading-tight sm:text-6xl"
        >
          Recovery looks slower than loss — and it still works.
        </Reveal>
        <div className="mt-10 space-y-6 text-lg leading-relaxed text-muted-foreground">
          <Reveal as="p" index={2}>
            Restoration crews grow coral fragments on underwater trees, then attach them back onto
            bare reef rock. Fast-growing staghorn and elkhorn can be outplanted by the thousand, and
            some outplanted colonies have reached reproductive age and spawned in the wild.
          </Reveal>
          <Reveal as="p" index={3}>
            Reefs have also rebounded on their own where heat stress eased — regional coral cover in
            parts of the world recovered measurably in the years after the 2016 bleaching event.
          </Reveal>
          <Reveal as="p" index={4}>
            Planting coral does not cool the ocean. It buys time for the coral that can survive what
            we've already done — and keeps the genetic material alive until we stop the warming.
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------ CTA */}
      <section className="relative mx-auto max-w-3xl px-6 py-32 text-center">
        <Reveal
          as="h2"
          className="font-display text-5xl font-light leading-tight sm:text-7xl text-living"
        >
          This Story Isn't Over
        </Reveal>
        <Reveal as="p" index={1} className="mx-auto mt-8 max-w-xl text-lg text-muted-foreground">
          The reef you just restored took one click. The real one takes divers, nurseries, decades —
          and people who decide it's worth it. You can be part of that.
        </Reveal>
        <Reveal index={2} className="mt-12 flex flex-col items-center gap-6">
          <a
            href="https://www.coralrestoration.org/"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-3 rounded-full px-10 py-4 text-sm font-semibold uppercase tracking-[0.25em] text-primary-foreground transition-transform duration-500 hover:scale-[1.03]"
            style={{
              backgroundImage: "var(--gradient-living)",
              boxShadow: "var(--shadow-glow-strong)",
            }}
          >
            Support Coral Restoration
          </a>
          <a
            href="https://icriforum.org/documents/global-coral-bleaching-event-2023-2025/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs uppercase tracking-[0.25em] text-muted-foreground underline-offset-8 transition-colors hover:text-foreground hover:underline"
          >
            Read the sources
          </a>
        </Reveal>
      </section>

      {/* ------------------------------------------------ FOOTER */}
      <footer className="relative mt-20 border-t border-border/60 px-6 py-14">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
          style={{ backgroundImage: "var(--gradient-living)" }}
        />
        <div className="mx-auto flex max-w-6xl flex-col gap-8 text-sm text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-xl text-foreground">The Last Reef</p>
            <p className="mt-2 max-w-md leading-relaxed">
              An interactive narrative about coral bleaching and restoration. All statistics are
              sourced from ICRI, NOAA Coral Reef Watch, GCRMN and the IPCC.
            </p>
          </div>
          <div className="space-y-2 sm:text-right">
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary/80">Built with</p>
            <p>Three.js · React Three Fiber · Motion · TanStack Start · Tailwind CSS</p>
            <p className="text-xs text-muted-foreground/70">Built for the Hackathon, 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
