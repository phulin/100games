---
name: game-feel-and-juice
version: 1.0.0
description: Use after a game's core mechanic works but it feels flat, stiff, or unsatisfying. Adds responsiveness, feedback, and polish — screen shake, easing, particles, sound, hit-pause, color flashes. Trigger phrases: "feels flat", "feels lifeless", "add juice", "make it satisfying", "polish the game", "feels stiff", "needs more feedback".
---

# Game Feel and Juice

Two games can have identical rules and feel completely different. "Juice" is the layer of immediate, redundant, slightly-overdone feedback that makes player actions feel powerful. It is not optional — flat games feel broken even when they're working correctly.

## When to use

- The mechanic is correct but playtesting feels unrewarding.
- Clicks/keypresses produce a result but the result is invisible until the next frame.
- The game looks like a spreadsheet with movement.

Do **not** add juice before the core loop is fun (see `designing-game-mechanics`). Juice multiplies fun; it does not create it.

## The juice budget

Every meaningful player action should trigger feedback in **at least three channels**. Pick from:

- **Motion** — the actor moves, scales, rotates, or squashes briefly.
- **Color** — flash, tint shift, or saturation pulse.
- **Particles** — small ephemeral sprites/divs emitted at the action point.
- **Camera/screen** — shake, zoom, slight pan.
- **Time** — hit-pause (freeze 50-100ms on impact), slow-mo on key moments.
- **Sound** — short sample, ideally pitch-randomized ±10%.
- **Number popups** — floating "+10" or damage numbers that arc and fade.
- **Trail/afterimage** — fast-moving objects leave a streak.

A bullet hitting an enemy might: enemy flashes white, screen shakes 2px, hit-pause 60ms, particle burst, +score popup, hit sound. That's six channels for one event. This is correct.

## Concrete techniques (browser/React)

### Squash & stretch
Scale non-uniformly on action. A button press: `transform: scale(0.92, 1.08)` for 80ms, then bounce back via easing. Tetris pieces locking: brief squash on impact.

### Easing > linear
Never animate with linear timing for player-affecting motion. Use cubic-bezier or spring physics. CSS: `transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoots — feels alive). Linear is reserved for backgrounds, scrolling, and progress bars.

### Hit-pause (a.k.a. freeze frame)
On significant impacts, pause the simulation for 50-120ms. The brain reads this as weight. Implement with a `frozenUntil` timestamp checked in the update loop.

### Screen shake
Translate the game container by a random offset that decays over ~200ms. Two pixels is enough. Reserve large shakes for rare events or they lose meaning.

### Camera zoom punch
On critical hits/level-ups, scale the whole viewport to 1.03 for 100ms then back. Cheap, dramatic.

### Particles
Spawn 5-15 small divs/sprites with randomized velocity and gravity, fade over 400-800ms. Pool them or use a single canvas — never let particle GC stutter the game.

### Color flash
On hit/spawn/score, briefly tint the sprite white or invert it for 1-2 frames. The eye reads this as impact even when other feedback is subtle.

### Pitch-randomized SFX
The same sound played at the same pitch 50 times in a row sounds like a malfunction. Randomize playbackRate ±10%. Stack multiple short layers (a "thump" + a "click") for richer hits.

### Anticipation
Before a big action, telegraph it. Enemy windup, charge-up flash, brief pause before a jump. Anticipation makes the payoff feel earned.

### Trails and afterimages
Fast-moving objects need motion clues. Either a CSS `box-shadow` streak, multiple semi-transparent copies trailing, or a canvas trail buffer.

## What to juice first

Rank by frequency × importance:

1. The thing the player does most often (movement, clicking, the primary verb).
2. The moment of success (scoring, clearing, leveling).
3. The moment of failure (game over, taking damage).
4. State transitions (start of run, new wave, phase change).

Polish in that order. A perfectly-juiced game-over screen does nothing if every movement feels dead.

## Anti-patterns

- **Symmetric juice.** Win and lose both get a 5-particle confetti — neither feels distinct. Make them visually opposite.
- **Juice without consistency.** One enemy flashes on hit, another doesn't. Players notice.
- **Audio without volume control.** Always provide a mute. Always start muted on web games or autoplay policies will silence everything inconsistently.
- **60fps animations on 30fps logic.** If the simulation steps in chunks, smooth the *render* between steps — don't ship a stuttery game with juice on top.
- **GC stutters from particles.** Pre-allocate pools. A garbage-collection pause kills feel more than missing particles would.

## Verification

Record a 10-second clip of the core verb being performed. Mute the audio. Can a stranger tell what's happening, what succeeded, and what failed, from motion alone? If not, more juice — or different juice — is needed.
