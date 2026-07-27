import { motion, AnimatePresence } from "motion/react";

export function RestoreNode({
  restored,
  onRestore,
}: {
  restored: boolean;
  onRestore: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="relative flex flex-col items-center">
      {/* screen-wide bloom flash */}
      <AnimatePresence>
        {restored && (
          <motion.span
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.34, 0] }}
            transition={{ duration: 1.2, times: [0, 0.12, 1], ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed inset-0 z-40"
            style={{ backgroundImage: "var(--gradient-haze)", mixBlendMode: "screen" }}
          />
        )}
      </AnimatePresence>

      {/* radiating light rings from the trigger point */}
      <AnimatePresence>
        {restored &&
          [0, 0.18, 0.42].map((delay, i) => (
            <motion.span
              key={`ring-${i}`}
              initial={{ scale: 0.15, opacity: 0.85 }}
              animate={{ scale: 14, opacity: 0 }}
              transition={{ duration: 3.4, delay, ease: [0.12, 0.9, 0.24, 1] }}
              className="pointer-events-none absolute h-40 w-40 rounded-full blur-2xl"
              style={{ backgroundImage: "var(--gradient-living)" }}
            />
          ))}
      </AnimatePresence>

      <motion.button
        type="button"
        // pointerup fires for both mouse click and touch tap without the
        // 300ms delay or sticky :hover state phones leave behind
        onPointerUp={onRestore}
        disabled={restored}
        whileTap={{ scale: 0.94 }}
        aria-label={restored ? "The reef is restored" : "Restore the reef"}
        className={[
          "relative flex h-36 w-36 touch-manipulation select-none items-center justify-center",
          "rounded-full border border-primary/40 sm:h-40 sm:w-40",
          "bg-primary/10 backdrop-blur-md transition-colors duration-700",
          restored ? "" : "animate-breathe cursor-pointer active:bg-primary/25 md:hover:bg-primary/20",
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

      <p className="mt-6 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
        {restored
          ? "Light returns. Coral regains its symbionts, colour floods back, and the reef starts breathing again."
          : "Nothing here moves on its own. Tap the node — the reef only changes if you choose to change it."}
      </p>
    </div>
  );
}
