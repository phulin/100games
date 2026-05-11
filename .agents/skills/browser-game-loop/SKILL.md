---
name: browser-game-loop
version: 1.0.0
description: Use when implementing real-time game logic in React/browser — game loops, input handling, deterministic state, fixed timesteps, and avoiding common pitfalls like stale closures, re-render thrash, and frame-rate-dependent physics. Trigger phrases: "game loop", "requestAnimationFrame", "delta time", "fixed timestep", "game tick", "stale closure in game", "game feels jittery", "physics is frame-rate dependent".
---

# Browser Game Loop

Real-time games are not normal React. The default React mental model — state changes drive renders, and renders are the system of record — produces stuttery, laggy, hard-to-debug games. This skill covers the patterns that actually work for browser games running inside React/Vite.

## When to use

- Building a game with continuous motion, physics, or per-frame updates.
- A game has unexplained jitter, lag, or "ghost" inputs.
- Switching tabs/windows breaks the game state.
- Game speed differs between machines or browsers.

## State that re-renders vs state that doesn't

Game state splits into two categories:

**Mutable game state (no re-render):**
- Entity positions, velocities, ages.
- Per-frame physics values.
- Input buffer.
- Animation timers.

Store in `useRef`. Mutate directly. Never call `setState` for these.

**Display state (re-render):**
- Score, lives, current level.
- Game-over flag, paused flag.
- Anything the UI chrome reads.

Store in `useState`. Update sparingly — every `setState` triggers a re-render of the whole tree.

A common shape:

```tsx
const stateRef = useRef({ player: { x: 0, y: 0, vx: 0, vy: 0 }, enemies: [], particles: [] });
const [score, setScore] = useState(0);
const [gameOver, setGameOver] = useState(false);
```

The render reads from `stateRef.current` via a refresher tick (`useState` bumped from rAF) if you're using DOM, or draws to a canvas where it doesn't need React at all.

## The animation loop

```tsx
useEffect(() => {
  let raf: number;
  let last = performance.now();

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1); // cap to avoid huge jumps after a stall
    last = now;
    update(dt);
    render(); // direct DOM/canvas write, OR a forced re-render via setTick(t => t+1)
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, []);
```

Key points:
- **Cap dt.** When a tab is backgrounded, `rAF` pauses. On resume, the first dt could be 30 seconds. Clamp to ~100ms or your physics will explode.
- **Use `performance.now()`,** not `Date.now()`. Monotonic, sub-millisecond.
- **Cleanup is mandatory.** Forgotten `rAF` loops in a gallery app are silent CPU drains.
- **Empty dep array.** The effect should set up the loop *once*. State changes inside the loop go through refs.

## Fixed timestep for physics

Variable-dt physics (movement multiplied by `dt`) drifts and is non-deterministic — two players see different outcomes from the same input. For any game with collisions, momentum, or replay/seed-determinism needs, use a fixed timestep:

```tsx
const STEP = 1 / 60; // 60 Hz simulation
let accumulator = 0;

const tick = (now: number) => {
  const frameTime = Math.min((now - last) / 1000, 0.1);
  last = now;
  accumulator += frameTime;
  while (accumulator >= STEP) {
    simulate(STEP); // always called with the same dt
    accumulator -= STEP;
  }
  render(accumulator / STEP); // optional: interpolate for smoothness
  raf = requestAnimationFrame(tick);
};
```

For arcade/casual games without physics drift concerns, `dt * velocity` is fine.

## Input

**Keyboard:** attach listeners in a `useEffect`, write into a ref-backed input state, read inside the game loop.

```tsx
const keys = useRef<Set<string>>(new Set());
useEffect(() => {
  const down = (e: KeyboardEvent) => keys.current.add(e.key);
  const up   = (e: KeyboardEvent) => keys.current.delete(e.key);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}, []);
```

- Always remove listeners on unmount. Multiple game instances will stack listeners otherwise.
- For single-shot inputs (jump, shoot), use an *event queue* in a ref rather than checking `keys.has(...)` per tick — otherwise holding the key fires every frame.
- `preventDefault` on game keys (arrows, space) so the page doesn't scroll.

**Pointer:** use `pointerdown`/`pointermove`/`pointerup` (not mouse + touch separately). Attach to the game container, not `window`.

**Focus:** games in a gallery may lose focus. On `visibilitychange` (`document.hidden`), pause the simulation; on return, reset `last = performance.now()` to avoid the giant-dt jump.

## Stale closure traps

The most common React-game bug: a callback captures `state` from render time, not the live value. Fixes:

- Use refs for any value the loop reads.
- If you must use state inside the loop, use the functional form: `setX(prev => prev + 1)`.
- Avoid `useEffect` dependencies that include game state — the loop will tear down and restart on every change.

## Canvas vs DOM

**DOM (divs, CSS transforms):**
- Easy, debuggable, accessible.
- Fine up to ~100 simultaneous entities.
- Use `transform: translate3d(x, y, 0)` for movement — GPU-composited, no layout.
- Avoid `top`/`left` for animated elements — triggers layout.

**Canvas (2D context):**
- Required for >100 entities, particles, custom rendering effects.
- Clear and redraw each frame.
- One canvas per game; sub-layers can use additional canvases.

Choose DOM by default. Switch to canvas only when DOM is measurably the bottleneck (DevTools performance tab, not vibes).

## Pausing

A real pause has three components:
1. Stop calling `update()` from the loop (keep `rAF` running so render still updates the pause overlay).
2. Reset `last = performance.now()` when resuming.
3. Disable game input handlers but keep menu input handlers.

Auto-pause on `document.hidden` to be a good citizen in a gallery.

## Anti-patterns

- **Driving the loop with `setInterval`.** Drifts, doesn't sync to refresh rate, fires while tab is hidden. Always `rAF`.
- **Movement as `setState` per frame.** Re-renders 60x/sec for every entity. Use refs and either canvas or `transform` writes.
- **Ignoring `dt`.** Hardcoding velocities as "pixels per frame" means the game plays at different speeds on 60Hz vs 120Hz monitors. Always pixels per *second*, multiplied by `dt`.
- **Not cleaning up.** Leaked `rAF`, listeners, and intervals accumulate every time the user revisits the game in the gallery.
- **Single source of truth in `useState`.** Read above. State *changes* go to refs; render-affecting *display* goes to state.

## Verification

- Open DevTools Performance, record 5 seconds of gameplay. Look for: steady frame timing, no long tasks, no layout thrash.
- Switch to another tab for 10 seconds, switch back. Game should resume cleanly, not lurch.
- Navigate away from the game page and back. CPU should drop to idle during navigation (no leaked loop).
- Throttle CPU to 4x in DevTools. Game should still be playable, just slower-feeling — not broken.
