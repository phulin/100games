---
name: designing-game-mechanics
version: 1.0.0
description: Use before implementing a new game or adding a new mechanic to an existing game. Forces explicit design of the core loop, win/lose conditions, and player verbs before any code is written. Trigger phrases: "design a game", "new game idea", "game mechanic", "core loop", "what should this game do", "build a game where".
---

# Designing Game Mechanics

A game is not a concept — it is a verb the player performs, a goal that verb advances toward, and a tension that makes the verb interesting. Skip this step and you ship a toy, not a game.

## When to use

- Starting a new game from an idea or prompt.
- Adding a new mechanic to an existing game and you can't state in one sentence why it makes the game better.
- Reviewing a game that "feels boring" — usually the core loop is broken or absent.

## Define before coding

Write these down (in the game's checklist file or a comment at the top of the component). Do not start implementing until all six are answered concretely.

### 1. Player verb
The primary thing the player *does* every few seconds. One verb. "Dodge." "Stack." "Match." "Aim and release." If you need a conjunction, you have two verbs — pick the one that drives the rest.

### 2. Goal
What state is the player trying to reach? "Survive as long as possible," "reach the highest score before the grid fills," "clear all blocks." Goals should be visible on screen at all times.

### 3. Obstacle / tension
What makes the verb hard? Without tension the verb is a toy. Tension comes from time pressure, scarce resources, escalating difficulty, opposing agents, or imperfect information.

### 4. Feedback per action
What does the player see/hear within ~100ms of acting? If nothing, the verb feels dead. Every action needs a confirmation — a color flash, a sound, a number, a movement.

### 5. Failure state
How does the player lose, get punished, or reset? A game with no failure is a sandbox. Define what ends a run.

### 6. Why play again
What changes between runs? Higher difficulty, new seed, unlocked content, personal-best chasing. If runs are identical, players play once.

## The one-sentence test

Once the six are answered, write the game as: **"You [verb] to [goal] while [obstacle], and you lose when [failure]."**

If you can't write that sentence cleanly, the design isn't ready. Examples:
- "You **stack falling blocks** to **clear lines** while **the fall accelerates**, and you lose when **blocks reach the top**." (Tetris)
- "You **flick a ball at pegs** to **clear all orange pegs** while **balls are limited**, and you lose when **you run out of balls**." (Peggle)

## Anti-patterns

- **"It's like X but with Y."** — Fine as shorthand, not as a design. State the six explicitly anyway.
- **No failure state.** Endless number-go-up without losing is a clicker, and clickers need meta-progression to stay interesting.
- **Verb-goal mismatch.** Player verb is "explore" but goal is "score high" — exploration doesn't advance the goal, so the verb feels pointless.
- **Hidden feedback.** Score updates only on game-over screen, hits don't flash, correct answers look identical to wrong ones. Fix before tuning anything else.
- **Designing the second mechanic first.** Power-ups, combos, multipliers all come *after* the core loop is fun on its own. If the base verb isn't fun for 30 seconds, no power-up will save it.

## Output

Before writing any component code, produce:

1. The six answers above.
2. The one-sentence summary.
3. A list of the 3-5 *smallest* visible/audible feedbacks the game needs.
4. The shortest possible playable version — what's the prototype that proves the loop works? (See `prototyping-games`.)
