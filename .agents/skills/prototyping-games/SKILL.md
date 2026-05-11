---
name: prototyping-games
version: 1.0.0
description: Use when starting a new game and tempted to build the "real" version first. Forces a minimum playable prototype that proves the core loop is fun before any art, polish, or scope expansion. Trigger phrases: "build a game", "implement a game", "start coding a game", "make a prototype", "MVP for a game".
---

# Prototyping Games

The first version of a game must answer one question: **is the core loop fun?** Everything else — art, menus, scoring systems, animations, levels — is a waste of time until that question is answered yes. Most games that fail were polished before they were proven.

## When to use

- Starting any new game.
- Tempted to add a second mechanic, theme, art pass, or settings menu before the first verb works.
- Stuck on which game to build — prototype the one whose core loop you can prove fastest.

## The 30-minute rule

Your first playable build should exist within **30 minutes of starting**. If it doesn't, you are over-engineering. The prototype's job is to be deletable.

Allowed in the prototype:
- The core verb (clicking, moving, dragging, whatever).
- The win/lose condition.
- Coarse difficulty (one number).
- Whatever feedback is *strictly* required to play (a score display; a game-over message).

Not allowed in the prototype:
- A title screen.
- Multiple levels.
- Sound (yet).
- Settings/options.
- Persistent storage.
- Custom art beyond colored rectangles or unicode/emoji.
- Animations beyond CSS transitions.
- A second mechanic.

## Visual budget

For the prototype, use the cheapest possible visuals that communicate what each entity is:

- **Colored divs / rectangles** — the workhorse. A red square is an enemy, a blue square is the player.
- **Unicode glyphs / emoji** — instantly recognizable, free, scalable. ⬛ 🟥 🟢 ⚔️ ⭐
- **One-color SVG shapes** — circles, triangles, polygons.
- **Geometric primitives on canvas** — for games with many entities.

Skip: spritesheets, animations beyond ease-in-out, gradients, shadows.

This is not lazy — it is intentional. Visuals can lie about whether a game is fun. Strip them so the verdict on the mechanic is honest.

## The "ugly fun" test

Play the prototype for 60 seconds. Then ask:

1. Did you want to keep playing at the 60-second mark?
2. Was there a moment you felt tension, satisfaction, or surprise?
3. Did you naturally try to improve on your previous attempt?

**Three yeses:** the loop works. Now you can invest in juice (`game-feel-and-juice`), balance (`balancing-game-difficulty`), and visuals.

**Any no:** the loop is broken. Do not polish. Change one of: the verb, the obstacle, the failure state, the feedback. Re-prototype. Polish cannot save a loop that isn't fun ugly.

## Iteration discipline

Once the loop is proven, expand in this order:

1. **Feedback channels** — add 2-3 juice layers (see `game-feel-and-juice`).
2. **Balance** — tune the difficulty curve (see `balancing-game-difficulty`).
3. **Visual identity** — replace placeholders with intentional art. The game already plays well; now make it *look* like itself.
4. **Replay drivers** — score persistence, leaderboards, daily challenges, unlocks.
5. **Polish** — title screen, transitions, settings, accessibility.

Skipping ahead is the most common failure mode. A beautiful title screen on a boring game is wasted work.

## React/Vite-specific prototyping tips

- One file. The prototype lives in a single component until proven. Splitting files is premature.
- `useRef` for game state, `useState` only for what triggers re-render. A game loop driven by `setState` will lag.
- `requestAnimationFrame` for continuous updates; `setTimeout` for discrete-tick games (Tetris, turn-based).
- `useEffect` cleanup is mandatory — leaked `rAF` loops will haunt the gallery page.
- Keyboard input: `useEffect` with `window.addEventListener('keydown', ...)` and a corresponding `removeEventListener` in cleanup.
- Bounds: a single fixed-size container (e.g. `400×600`) avoids responsive headaches during prototyping. Make it responsive after the game is fun.

## Anti-patterns

- **Engine-first.** Building a generic "game framework" before any game exists. Always wrong. The framework should emerge from 3+ games, not precede the first.
- **Asset-first.** Drawing the player sprite before the player can move. Visuals should be the *last* thing finalized.
- **Two mechanics out of the gate.** "It's a platformer but also a card game." Build one. If the first is fun, then add the second and re-test.
- **Premature scoring systems.** Combo multipliers, perfect bonuses, S-ranks — none of these matter until base scoring is satisfying.
- **Skipping the play test.** Writing the prototype and immediately starting v2 without actually playing v1 for 60 seconds. Always play your own prototype. Notice what your hands want to do.

## Output of a prototype session

- One file, runnable in the gallery.
- A one-line answer to "is this fun ugly?": yes / no / kind of.
- If yes: a list of the next 2-3 things to polish (feedback first).
- If no: a one-sentence hypothesis of what to change, and a plan to re-prototype.
