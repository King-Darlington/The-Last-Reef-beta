import { motion } from "motion/react";
import { Reveal } from "./Reveal";

export type Fact = {
  value: string;
  label: string;
  body: string;
  source: string;
};

export function FactCard({ fact, index }: { fact: Fact; index: number }) {
  return (
    <Reveal index={index}>
      <motion.article
        whileHover={{ y: -8 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="group relative h-full overflow-hidden rounded-2xl glass-panel p-8"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60 transition-opacity duration-700 group-hover:opacity-100"
          style={{ backgroundImage: "var(--gradient-living)" }}
        />
        <div
          className="pointer-events-none absolute -inset-24 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-25"
          style={{ backgroundImage: "var(--gradient-living)" }}
        />
        <p className="relative font-display text-6xl leading-none text-living">{fact.value}</p>
        <h3 className="relative mt-5 text-sm uppercase tracking-[0.28em] text-primary/90">
          {fact.label}
        </h3>
        <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground">{fact.body}</p>
        <p className="relative mt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
          {fact.source}
        </p>
      </motion.article>
    </Reveal>
  );
}
