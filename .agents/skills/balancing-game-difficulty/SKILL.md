---
name: balancing-game-difficulty
version: 1.0.0
description: Use when a game is "too easy," "too hard," "ramps wrong," or runs feel monotonous. Covers difficulty curves, pacing, scaling parameters, and how to tune by playtesting rather than guessing. Trigger phrases: "too hard", "too easy", "balance the game", "difficulty curve", "ramp up", "too repetitive", "feels grindy".
---

# Balancing Game Difficulty

Difficulty is not a number — it is a curve over time. A well-balanced game is barely-winnable on the player's best run and clearly-losable on their average run. Most amateur games are flat: the same difficulty for 30 seconds, then either trivial or impossible.

## When to use

- After the core loop works (see `designing-game-mechanics`) and feel is acceptable (see `game-feel-and-juice`).
- Playtest reveals "I won first try" or "I can't pass level 3."
- Runs blur together — no escalation, no climax, no memorable moment.

## The shape of a good curve

Most arcade-style games want a curve that looks like this over a run:

```
difficulty
  │                              ╱╲
  │                          ╱──╯  ╲
  │                      ╱──╯       ╲
  │                  ╱──╯
  │              ╱──╯
  │          ╱──╯
  │      ╱──╯
  │  ╱──╯
  └─────────────────────────────────── time
   onboard    learn    challenge   peak
```

- **Onboarding (first 10-20s):** player cannot fail. They learn the verb.
- **Learning (next 30-60s):** introduce one obstacle per ~15s. Player makes mistakes but recovers.
- **Challenge:** failure is plausible. Most runs end here.
- **Peak / mastery:** very few players reach this. They should feel like heroes.

Endless games approximate this with an asymptotic difficulty curve — never quite flat, never spiking, but always trending up.

## Parameters to expose

Before tuning, make every difficulty knob a named constant near the top of the file, not a magic number buried in logic. Typical knobs:

- **Spawn rate** — enemies/obstacles/items per second.
- **Enemy speed / projectile speed.**
- **Player resources** — lives, ammo, time, slowdown charges.
- **Window sizes** — reaction time, input forgiveness, hitbox sizes.
- **Reward rate** — score multipliers, drop rates.

If you can't tune a value by editing one number, you'll never tune it well. Refactor first.

## Scaling functions

Avoid linear ramps — they feel either too slow (early) or too steep (late). Better choices:

- **Logarithmic** (`difficulty = base + k * log(1 + t)`): fast early ramp, then plateau. Good for skill-introduction.
- **Stepped** (`difficulty = floor(t / wave_length)`): clear "waves" the player can recognize. Good for emotional pacing.
- **Asymptotic** (`difficulty = max - (max - base) * exp(-t/tau)`): approaches but never exceeds a cap. Good for endless modes.

Combine: stepped overall structure with logarithmic intra-step ramp.

## Player skill tracking (rubber-banding)

For accessibility, consider invisible adjustments:

- If the player dies in <10s twice in a row, reduce spawn rate 15% for one run.
- If the player exceeds last best score by 50%, accelerate the curve.

Be conservative — players notice when the game "lets them win" and feel patronized. Better to design fair difficulty than to fake it.

## Pacing rules

- **Down-time between intensity peaks.** After a wave/boss/peak, give 3-5 seconds of low-intensity so the player can breathe and feel the relief.
- **No two new ideas at once.** Introduce one new enemy/mechanic per phase. Combinations come after each is understood individually.
- **First failure should teach.** When the player loses, they should know *why* — not "the game got harder," but "I didn't dodge the red one."

## Tuning method

Do not tune by intuition. Tune by data, even if the data is just yourself:

1. **Set a target.** "Average run length: 60 seconds. Best run: 3-4x average."
2. **Play 10 runs.** Record start time, end time, cause of death, current parameter values.
3. **Adjust one parameter.** Re-run 10 times.
4. **Compare distributions, not means.** A game where every run is 60s is worse than one where runs range 20s-180s with average 60s. Variance is fun.

In code, expose a debug overlay showing run length, current difficulty value, and recent deaths. Without telemetry you are guessing.

## Anti-patterns

- **Difficulty wall.** Suddenly impossible at level N. Cause: one parameter scales much faster than the rest. Fix by scaling several parameters slowly rather than one quickly.
- **Difficulty plateau.** Player masters early game and could play forever. Add a slow but unending ramp.
- **Punishing without warning.** Insta-kill mechanics with no telegraph. Always anticipate; see `game-feel-and-juice`.
- **Same death every time.** Means one obstacle dominates. Diversify or rebalance.
- **Tuning for yourself only.** The developer is the most skilled player. Halve the difficulty before shipping; you will still find it easy.

## Quick sanity check before shipping

- Can a first-time player survive the first 15 seconds? (Should be yes.)
- Does the median run end with a *specific* moment the player remembers? (Should be yes.)
- Could a skilled player play for 5+ minutes? (Should be yes — but rare.)
- Do consecutive losses cluster around different causes? (Should be yes — single cause = imbalance.)
