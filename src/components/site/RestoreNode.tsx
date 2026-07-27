import { motion, AnimatePresence } from "motion/react";

export function RestoreNode({ restored, onRestore }: { restored: boolean; onRestore: () => void }) {
  return (
    <div className="relative flex flex-col items-center">
      <AnimatePresence>
        {restored && (
          <motion.span
            key="burst"
            initial={{ scale: 0.2, opacity: 0.9 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute h-40 w-40 rounded-full blur-2xl"
            style={{ backgroundImage: "var(--gradient-living)" }}
          />
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={onRestore}
        disabled={restored}
        whileTap={{ scale: 0.94 }}
        aria-label={restored ? "The reef is restored" : "Restore the reef"}
        className={[
          "relative flex h-40 w-40 items-center justify-center rounded-full border border-primary/40",
          "bg-primary/10 backdrop-blur-md transition-colors duration-700",
          restored ? "" : "animate-breathe cursor-pointer hover:bg-primary/20",
        ].join(" ")}
      >
        <span
          className="absolute inset-3 rounded-full opacity-30 blur-xl"
          style={{ backgroundImage: "var(--gradient-living)" }}
        />
        <span className="relative font-display text-2xl tracking-wide text-foreground">
          {restored ? "Alive" : "Restore"}
        </span>
      </motion.button>

      <p className="mt-8 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
        {restored
          ? "Light returns. Coral regains its symbionts, colour floods back, and the reef starts breathing again."
          : "Nothing here moves on its own. The reef only changes if you choose to change it."}
      </p>
    </div>
  );
}
