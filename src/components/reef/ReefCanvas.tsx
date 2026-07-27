import { Suspense, lazy, useEffect, useState } from "react";

const ReefScene = lazy(() => import("./ReefScene"));

/**
 * Client-only gate for the WebGL reef. The scene module is never imported
 * during SSR — it is dynamically loaded after hydration.
 */
export function ReefCanvas() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-background" />
      {mounted ? (
        <Suspense fallback={null}>
          <ReefScene />
        </Suspense>
      ) : null}
      {/* soft depth vignette + top/bottom fades over the scene */}
      <div className="pointer-events-none absolute inset-0 haze" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32"
        style={{ backgroundImage: "var(--gradient-fade-top)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ backgroundImage: "var(--gradient-fade-bottom)" }}
      />
    </div>
  );
}
