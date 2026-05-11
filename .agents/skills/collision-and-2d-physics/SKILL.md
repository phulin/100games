---
name: collision-and-2d-physics
version: 1.0.0
description: Use when a game needs hit detection, collision response, or basic 2D physics — arcade games, platformers, shooters, pinball-likes, breakout-likes. Covers AABB, circle-circle, swept tests, spatial hashing, tunneling, coyote time, and arcade vs. simulation tradeoffs. Trigger phrases: "collision detection", "hit detection", "AABB", "bullet phasing through enemy", "tunneling", "platformer physics", "gravity", "bounce", "swept", "fast-moving objects", "missed hit".
---

# Collision and 2D Physics

Most browser arcade games don't need a physics engine — they need a few hundred lines of well-chosen geometry. But that geometry has well-known pitfalls (tunneling, jitter, edge-cases at corners) that destroy game feel if you don't know them.

## When to use

- Adding hit detection, projectiles, or contact-based gameplay.
- Bullets/players phasing through walls or enemies.
- Platformer character sticking on walls, jittering on the ground, or falling through floors.
- Considering a physics library — usually wrong choice for casual games; see decision below.

## The arcade-vs-simulation decision

**Don't reach for matter.js / box2d / planck.js by default.** A full physics engine introduces nondeterminism, frame-rate sensitivity, and overkill behavior (objects piling realistically) for games that don't want it. Use arcade physics — custom code that *cheats* to feel right — unless:

- You actually need realistic stacking, ropes, joints, gears, or fluid.
- The "physical correctness" *is* the gameplay (Angry Birds, World of Goo).

For 99% of casual browser games: write 200 lines yourself.

## Shape primitives

Pick the simplest shape per entity. Cheaper is faster and easier to debug.

- **AABB (axis-aligned bounding box):** the workhorse. Players, platforms, tiles, most enemies.
- **Circle:** projectiles, round enemies, ball-style games. Rotation-invariant.
- **Point-vs-rect / point-vs-circle:** for cheap projectiles or click hit-tests.
- **Polygon:** avoid unless you must. Cost in code and CPU rarely pays off.

You can mix: AABB world + circle players + point bullets.

## Core tests

### AABB vs. AABB
```ts
function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
```

### Circle vs. circle
```ts
function circleOverlap(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const r = a.r + b.r;
  return dx*dx + dy*dy < r*r; // squared, no sqrt
}
```

### Circle vs. AABB
Clamp the circle center to the rect bounds, distance from clamped point to center < radius.

Always work with squared distances when possible; `Math.sqrt` is expensive.

## The tunneling problem (and the fix)

A bullet moving 600 px/frame past a 10 px enemy will skip over it without ever overlapping on a tested frame. Symptom: "bullets sometimes miss for no reason."

Fixes, in order of effort:

### 1. Substepping
Split the frame's motion into N small steps and test each. Cheap and usually sufficient. Use when relative speeds exceed object sizes.

```ts
const steps = Math.ceil(maxSpeed * dt / minObjectSize);
const subDt = dt / steps;
for (let i = 0; i < steps; i++) updateAndCollide(subDt);
```

### 2. Swept tests
Compute the actual collision time within the frame (parametrically, t in [0, 1]). More correct, more code. The standard reference is "swept AABB" — Google has good explainers.

### 3. Raycast for fast projectiles
Treat bullets as line segments from previous position to current position; test segment-vs-target. Bypasses tunneling entirely for thin objects.

For a 100-game project, substepping handles 95% of cases.

## Collision response (for arcade physics)

After detecting overlap, *resolve* it: move objects so they no longer overlap. The basic move-and-resolve pattern:

```ts
// Move X axis first; check; resolve.
entity.x += entity.vx * dt;
for (const obstacle of obstacles) {
  if (aabbOverlap(entity, obstacle)) {
    if (entity.vx > 0) entity.x = obstacle.x - entity.w;
    else if (entity.vx < 0) entity.x = obstacle.x + obstacle.w;
    entity.vx = 0;
  }
}
// Now Y axis: same dance.
```

**Separating X and Y movement is the single most important platformer-physics trick.** Doing both together produces sticking-to-walls and weird corner behavior. One axis at a time gives clean wall-slides and clean ground contact.

## Platformer essentials

If you're building anything jump-and-run:

- **Gravity is constant**, applied as acceleration: `vy += GRAVITY * dt`. Cap to a terminal velocity to avoid tunneling.
- **Jump is an instantaneous velocity set**, not a force. `if (jumpPressed && onGround) vy = -JUMP_VELOCITY;`
- **Variable jump height:** if the player releases jump while still going up, halve `vy`. Holding = higher jump.
- **Coyote time (~80-120ms):** allow jump shortly after leaving a platform. Players will swear the game cheats them otherwise.
- **Jump buffering (~80-120ms):** if the player pressed jump shortly before landing, jump on touchdown. Removes the "I pressed it and nothing happened" frustration.
- **Grounded check:** test if a tiny AABB just below the player overlaps a platform. Not "vy == 0."

These four tricks (gravity, variable jump, coyote, buffer) are what separates "feels right" from "feels like an amateur platformer."

## Spatial partitioning

When you have many entities, naive O(n²) pair checks become a bottleneck around n ≈ 100-300.

- **Uniform grid:** divide space into cells; each entity registers in cells it overlaps; only test pairs within the same cell. Simple, fast for evenly distributed entities. Cell size ≈ 2× typical entity size.
- **Quadtree:** better for highly non-uniform distributions. More code; rarely needed for browser games.

Profile first — don't add partitioning before n exceeds ~100 simultaneous entities.

## Determinism

If your game has replays, daily challenges, or networked play:

- Use a fixed timestep (see `browser-game-loop`).
- Use a seeded PRNG (see `procedural-content`).
- Avoid `Math.atan2` cascades that compound floating-point error; structure code to minimize chained transcendental math.
- Iterate collision pairs in a deterministic order (sorted by id, not insertion order in a Set).

## Hitbox tuning

The collision shape should *not* match the visual exactly. Tune for feel:

- **Player hitbox:** smaller than the sprite. Players blame "unfair hits" before they blame their own movement; a slightly forgiving hitbox feels right.
- **Enemy hitbox:** sometimes larger than the sprite. Easier hits feel satisfying.
- **Projectile hitbox:** larger than the sprite, especially for fast bullets. "Did that hit?" should usually answer yes.

This is asymmetric on purpose. Symmetric hitboxes feel punishing; asymmetric ones feel fair.

## Anti-patterns

- **Comparing `distance < threshold` without squaring.** Wasted `sqrt` calls in the hot loop. Compare squared.
- **Checking collisions in `render`.** Belongs in update, with fixed timestep.
- **One giant collision pass for everything.** Separate concerns: player-vs-world, bullet-vs-enemy, player-vs-pickup. Different rules, different sets, different responses.
- **Floating-point equality in collision.** `if (vy === 0)` is a trap. Use thresholds (`Math.abs(vy) < EPSILON`) or boolean state flags.
- **Forgetting to reset onGround.** Compute "am I grounded?" *each frame* from collision results; don't leave it stale from last frame.
- **Reaching for a physics engine for a simple game.** Always start with hand-rolled.

## Verification

- Spawn a bullet moving 5x faster than the target's width. Does it hit reliably? (If no: substep / raycast.)
- Walk into a wall while jumping. Do you stick to the wall? (If yes: separate-axis collision.)
- Run the game at 30fps and 144fps. Does the player jump the same height? (If no: physics is frame-rate dependent — fix dt usage or use fixed timestep.)
- Spawn 200 entities. Does the game stay above 60fps? (If no: spatial partitioning.)
- Release jump halfway up. Does it cut the jump short? (If no: implement variable jump height.)
- Walk off a ledge, press jump 1 frame late. Does it work? (If no: implement coyote time.)
