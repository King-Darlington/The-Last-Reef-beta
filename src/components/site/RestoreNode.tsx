import { motion, AnimatePresence } from "motion/react";

export function RestoreNode({
  restored,
  onRestore,
  audioOn,
  onToggleAudio,
}: {
  restored: boolean;
  onRestore: (e: React.MouseEvent<HTMLButtonElement>) => void;
  audioOn: boolean;
  onToggleAudio: () => void;
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

      <button
        type="button"
        onClick={onToggleAudio}
        aria-pressed={audioOn}
        className="mt-6 cursor-pointer rounded-full border border-border px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {audioOn ? "Sound on" : "Sound off"}
      </button>

      <p className="mt-6 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
        {restored
          ? "Light returns. Coral regains its symbionts, colour floods back, and the reef starts breathing again."
          : "Nothing here moves on its own. The reef only changes if you choose to change it."}
      </p>
    </div>
  );
}
