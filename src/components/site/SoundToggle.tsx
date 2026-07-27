import { AnimatePresence, motion } from "motion/react";

/**
 * Minimal, glowing volume toggle fixed to the corner, plus a one-time gentle
 * invitation to unmute (audio is muted by default per autoplay best practice).
 */
export function SoundToggle({
  on,
  onToggle,
  showPrompt,
}: {
  on: boolean;
  onToggle: () => void;
  showPrompt: boolean;
}) {
  return (
    <div className="fixed bottom-5 right-4 z-50 flex items-center gap-3 sm:bottom-7 sm:right-7">
      <AnimatePresence>
        {showPrompt && !on && (
          <motion.span
            key="prompt"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="hidden rounded-full border border-primary/25 bg-background/60 px-4 py-2 text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-md sm:inline-block"
          >
            Sound makes this better
          </motion.span>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        aria-label={on ? "Mute ambient sound" : "Unmute ambient sound"}
        whileTap={{ scale: 0.9 }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-primary/35 bg-background/50 backdrop-blur-md transition-colors duration-500 hover:border-primary/70"
        style={{ boxShadow: on ? "var(--shadow-glow)" : undefined }}
      >
        {!on && showPrompt && (
          <span
            aria-hidden
            className="absolute inset-0 animate-breathe rounded-full opacity-40 blur-md"
            style={{ backgroundImage: "var(--gradient-living)" }}
          />
        )}
        <svg
          viewBox="0 0 24 24"
          className={`relative h-5 w-5 transition-colors duration-500 ${
            on ? "text-living" : "text-muted-foreground"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
          {on ? (
            <>
              <path d="M15.6 9.2a4 4 0 0 1 0 5.6" />
              <path d="M18.2 6.8a7.6 7.6 0 0 1 0 10.4" />
            </>
          ) : (
            <path d="M16.5 9.8l4 4.4M20.5 9.8l-4 4.4" />
          )}
        </svg>
      </motion.button>
    </div>
  );
}
