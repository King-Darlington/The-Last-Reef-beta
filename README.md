# The Last Reef

**The Last Reef** is a cinematic, single-page immersive web experience about coral bleaching and reef restoration. It opens on a silent, bone-white reef — a graveyard of coral skeletons suspended in murky water — and invites the visitor to scroll through the story of what was lost. Nothing in the scene recovers on its own. At the turning point of the narrative there is a single interactive node, and only when the visitor chooses to press it does light radiate outward across the reef: colour floods back into the coral, plankton ignites into bioluminescence, fish return, and the water clears. The interaction is deliberately reversible — the reef can be allowed to fade again and restored as many times as the visitor likes, because the point of the piece is that the outcome is a choice, not an inevitability.

The site is built as a scroll-driven narrative layered over a live 3D scene. A real-time Three.js reef renders behind the page at all times, and the camera moves through it like a slow documentary tracking shot tied directly to scroll progress: drifting close to coral detail during the fact sections, pulling back into a wide establishing shot at the moment of transformation, and settling into calm, centred framing for the closing "What's Possible" section. Camera motion runs on critically damped spring interpolation rather than linear mapping, so it never feels mechanical, and scroll position is written into a mutable, render-free state bridge that the frame loop reads each tick — meaning scrolling never triggers a React re-render and the scene holds a smooth frame rate.

The reef itself is procedurally generated and populated with living organisms: instanced coral colonies, swaying anemones, spiny urchins, kelp and seagrass beds, shoaling fish, drifting jellyfish with trailing light, a gliding sea turtle, and manta rays flapping through the upper water column. Bioluminescence is rendered as three depth-separated particle layers — tiny slow plankton in the background, pulsing light motes mid-ground, and sparse near-field embers — each driven by custom GLSL shaders with soft additive cores, per-particle flicker, and colour variation between cyan and warm coral. Every layer responds to scroll velocity, drifting faster under fast scrolling and settling when the visitor pauses. The restoration itself is spatial rather than uniform: a feathered wave front expands from the exact world-space point the visitor pressed, carrying an over-bright leading edge through the bloom pass, and materials, colours, lights and organisms flip from bleached to living as it sweeps past them over roughly three and a half seconds.

Sound is entirely synthesised at runtime through the Web Audio API — no audio files are shipped. A continuous underwater ambience of filtered brown noise and low oscillators sits behind the experience, shifting from murky and muffled in the dead state to clear and rich in the living one, timed to the transformation. The restore trigger fires a layered cue: a sub-bass sweep, a rising bandpass whoosh, and a shimmer on release. Audio is muted on load per browser autoplay best practice, with a minimal glowing corner toggle and a one-time gentle invitation to unmute; the choice is remembered between visits.

Throughout, the interface aims to feel premium rather than decorative. Fact cards tilt subtly in 3D toward the cursor with a specular highlight and border glow tracking the same point, like light sliding across glass, springing back when the cursor leaves. On touch devices those hover behaviours are replaced by tap equivalents, and the whole scene scales down gracefully: fewer particles and organisms, lighter post-processing, reduced pixel ratio, and text sections that stack cleanly and stay legible over the moving background at any viewport size.

## Tech stack

- **Framework** — TanStack Start v1 (React 19, SSR) with TanStack Router, Vite 7, TypeScript
- **3D** — Three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing (Bloom, Vignette), custom GLSL shaders, instanced meshes throughout
- **Motion & UI** — Motion (Framer Motion) for scroll reveals and card interaction, Tailwind CSS v4 with an OKLCH design-token system spanning paired "dead reef" and "living reef" palettes
- **Audio** — Web Audio API, fully procedural; localStorage for mute persistence
- **Performance** — render-free state bridge for scroll, device-capability detection for mobile tuning, damped-spring camera interpolation

No backend and no database — the entire experience runs client-side.

## Development

```sh
npm i
npm run dev
```

Then open the local URL printed by Vite.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/routes/index.tsx` | The full narrative page and scroll wiring |
| `src/routes/__root.tsx` | App shell, head metadata, favicon |
| `src/components/reef/ReefCanvas.tsx` | Client-only lazy wrapper around the 3D canvas |
| `src/components/reef/ReefScene.tsx` | Scene graph: corals, organisms, particles, camera path, effects |
| `src/components/reef/reefState.ts` | Render-free scroll and transformation state bridge |
| `src/components/site/` | FactCard, Reveal, RestoreNode, SoundToggle |
| `src/lib/reefAudio.ts` | Procedural ambience and restoration sound cues |
| `src/styles.css` | Design tokens, palettes, glass and glow utilities |
