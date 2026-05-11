---
name: procedural-content
version: 1.0.0
description: Use when a game needs generated content — levels, layouts, puzzles, enemy waves, item drops, daily challenges — instead of hand-authored ones. Covers seeded randomness, generation constraints, solvability checks, and variety vs. fairness tradeoffs. Trigger phrases: "procedural", "random level", "generate a puzzle", "daily challenge", "seed", "endless mode", "spawn wave", "random map".
---

# Procedural Content

Random is not the same as procedural. Random produces noise; procedural produces variety the player perceives as designed. Most "random level generators" fail by being either too random (unfair, ugly, unsolvable) or not random enough (visibly repetitive).

## When to use

- A game needs more levels than you'd want to hand-author.
- Replay value depends on each run feeling different.
- Daily/weekly challenges need shared seeds so players can compare.
- Endless modes need fresh content indefinitely.

## Seeded randomness, always

Use a seeded pseudo-random number generator, not `Math.random()`. Two reasons:

1. **Reproducibility.** Same seed → same level. Required for daily challenges and bug reports.
2. **Determinism.** Same seed + same code = same outcome across machines.

Drop-in seeded PRNG (mulberry32, ~10 lines):

```ts
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Derive a daily seed from the date: `hash(YYYY-MM-DD)`. Every player gets the same daily.

## Generate, then validate

The naive loop — generate a level, hand it to the player — produces broken content. The correct loop:

1. **Generate** a candidate using the PRNG.
2. **Validate** against rules (solvable, fair, varied).
3. **Reject and regenerate** if validation fails.
4. **Cap retries** — if 100 attempts fail, the constraints are too tight; relax them or fall back to a known-good template.

Validations are domain-specific:

- **Sokoban-style puzzle:** is there at least one solution? Run a solver.
- **Roguelike map:** are all rooms reachable from spawn? Run flood-fill.
- **Match-3 board:** does the initial layout have no pre-made matches? And is there at least one possible move?
- **Wave shooter:** does the spawn pattern give the player ≥1 second of safe windows?

Without validation, the player will eventually hit an unsolvable level and quit.

## Generation patterns

### Template + variation
Start from hand-authored templates; randomize within slots. A "room" template has fixed walls and a set of `{spawn-here}` markers — the generator chooses which to fill. Combines author control with variety.

### Wave Function Collapse / tile constraints
Each tile has a set of allowed neighbors. Place tiles one at a time, narrowing options as you go. Produces coherent results from small rule sets. Overkill for prototypes; worth it for production-quality tile maps.

### Drunkard's walk / cellular automata
Start from noise or a single point, evolve by simple rules. Good for caves, organic shapes. Easy to implement.

### BSP / room-and-corridor
Subdivide a rectangle recursively, place rooms in leaves, connect with corridors. Standard for dungeon layouts.

### Weighted pools
For enemy waves, item drops, etc.: each entry has a weight; sample proportionally. Add anti-streak logic (don't repeat the last pick; bump weights of un-picked entries) to avoid clusters that feel unfair.

### Difficulty-aware sampling
Tag each piece of content with a difficulty number. The generator picks pieces whose total difficulty matches the current target (see `balancing-game-difficulty`). Same generator, escalating output.

## Fairness rules

Procedural content frequently feels unfair even when it isn't, because the player attributes "I lost" to "the game cheated" more readily when content varies. Bake fairness in:

- **Pity timers.** If the player hasn't gotten a rare drop in N attempts, increase its weight.
- **Difficulty caps per run.** Don't let three random spikes stack into an unwinnable moment.
- **Forbidden adjacencies.** "Don't spawn two hazards within X pixels," "don't put a bottomless pit immediately after a spawn point."
- **Guaranteed resources.** Always spawn one health pickup per N seconds, regardless of random rolls.

The goal: procedurally generated runs should have variance within a fair envelope, not lottery outcomes.

## Variety perception

Players notice repetition long before the algorithm has actually repeated. Cheap variety tricks:

- **Rotate / mirror.** Same layout, four flipped versions.
- **Recolor.** Different palette per biome/level, same shapes.
- **Reorder.** Same set of waves, different sequence.
- **Substitute.** Swap one enemy type for another with similar mechanics.

These are honest design tools, not cheating. Players see "different level," not "asset reuse."

## Anti-patterns

- **`Math.random()` everywhere.** Non-reproducible. Daily challenges impossible. Bug reports unfixable.
- **No validation step.** Eventually generates an unsolvable level. Single bad experience drives churn.
- **Validation is the solver run on the player.** Validation must run *before* the level is shown. Don't make the player be the test.
- **Too many parameters.** "Generator has 47 knobs" → no one can tune it. Start with 3-5 named parameters and add only when needed.
- **Generation in render.** Generating on every render is both slow and non-deterministic. Generate once on level start, store the result.
- **Ignoring streaks.** Unweighted random produces clusters humans perceive as biased. Always have anti-streak protection on player-affecting rolls.

## Output of a good generator

- Same seed produces the same level, always.
- Generation completes in <50ms (a hitch at level start is okay; mid-game stutter is not).
- The validation step rejects ≥1% but ≤10% of candidates (≥10% means constraints are too tight; ≤1% means validation isn't doing much).
- A human playing 10 generated levels can describe what made each one *different* — not just "harder."
