---
name: game-onboarding
version: 1.0.0
description: Use when designing how a player learns a game in the first 30-60 seconds. Covers teaching without text walls, diegetic tutorials, progressive complexity, control discovery, and avoiding the "wall of instructions" anti-pattern. Trigger phrases: "tutorial", "how to play", "onboarding", "instructions", "teach the player", "first-time experience", "players don't understand".
---

# Game Onboarding

The first 30 seconds determine whether the player keeps playing. Most amateur games waste this window on a wall of text the player skips. The result: confused players who blame the game.

Good onboarding teaches by playing. Players should learn the verb before they know they're being taught.

## When to use

- Building any game intended to be played by someone other than the developer.
- Playtesters consistently ask "what do I do?"
- The game has a "How to Play" modal on the start screen.
- The game has more than one control and the second one isn't introduced.

Especially relevant in gallery contexts (the 100-game site): visitors won't read; they click and judge in seconds.

## Three teaching channels, in priority order

### 1. Affordance — the game looks like its rules
The strongest teaching. A glowing red button asks to be clicked. A platform with spikes signals "don't touch." A blinking arrow points where to go.

Design entities so their *appearance* implies their *behavior*. A square enemy and a pointy enemy hint at different threat profiles before the player tests them.

### 2. Forced discovery — the game makes you do the thing
The level/initial state is constructed so the only meaningful action *is* the thing you need to teach. Player spawns in a corridor; only direction available is right; only key that affects anything is space. Within 3 seconds they've learned "right + jump."

This is how Mario teaches running and jumping in World 1-1 without a single instruction.

### 3. Just-in-time prompts
Tiny, contextual, removable hints — not modal walls. A "← →" graphic near the player on the first level, fading after first input. A single line of text near the new mechanic when it first appears.

Rules:
- Never block input.
- Auto-dismiss after the player demonstrates competence.
- Show one at a time. Never two simultaneously.
- Use icons where possible; words where necessary.

Only when 1 and 2 are impossible — fall back to 3. Never go directly to text.

## The 30-second contract

By the 30-second mark, the player should have:

- Performed the core verb intentionally (not by accident).
- Caused a visible state change (score, kill, clear, move).
- Survived (no premature game over).
- Reached a moment of mild surprise or delight.

If they haven't, the onboarding has failed regardless of what your text said.

## Progressive complexity

Don't teach mechanics 2-5 in the first 30 seconds. Stage them:

| Time | Player understands |
|------|----|
| 0:00-0:15 | The verb. |
| 0:15-0:45 | The verb + the obstacle. |
| 0:45-1:30 | The first variation (new enemy / power-up / move). |
| 1:30-3:00 | Combinations. |
| 3:00+ | Mastery and edge cases. |

Introduce *one* new idea at a time. Each new idea gets a brief safe space where only it matters — no other hazards.

## Patterns that work

### The empty room
The first room/level contains *only* what you want to teach. No distractions. Player can't fail. They figure out controls because nothing else is happening.

### The "do the move or wait forever"
A puzzle/obstacle that cannot be passed without using the new mechanic. No instructions; the player experiments until they discover it. Works because the failure state is "nothing happens" — not "you lost."

### Diegetic UI
Tutorial information embedded in the world: a sign in the level showing keys, a ghost replay showing what to do, a friendly NPC demonstrating before disappearing.

### Demonstration on idle
If the player hasn't moved for 5 seconds on the title screen, demo the game in attract mode. Removes the cold-start cognitive load entirely.

### Highlight the next action
A subtle glow, pulse, or arrow on the next thing the player should interact with. Removes once they engage. Especially valuable in puzzles where the player doesn't know the move set yet.

## Patterns that don't work

- **Title-screen instructions modal.** Skipped 90% of the time. Of the 10% who read, half forget by gameplay.
- **Long opening cinematic.** Players skip; they came to play.
- **Tutorial level marked "Tutorial."** Signals "boring," skipped, then players are confused.
- **A control reminder in the corner that never goes away.** Becomes UI noise.
- **Tooltips on hover.** Hover doesn't exist on touch; reveals at the wrong time on desktop.
- **Pause-and-explain pop-ups during gameplay.** Breaks flow. Information out of context.
- **Walls of lore before the player has done anything.** Story before stakes is incomprehensible.

## Special case: controls on multiple devices

If the game is playable on both keyboard and touch:

- Detect the input modality on first interaction and show only the relevant hints.
- Use icons (⬆ ⬇ ⬅ ➡ vs. swipe gestures) not English words for control names.
- Test both. A keyboard-only tutorial on a phone is unplayable.

## Testing onboarding

The most reliable test: hand the game to someone who has never seen it, *say nothing*, and watch. Specifically watch for:

- How long until they perform the core verb on purpose?
- What did they try that didn't work? (Each one is a misaffordance to fix.)
- When did they look away from the screen / sigh / scroll? (Boredom or confusion point.)
- Did they ever ask "what do I do?" (If yes: onboarding failed.)

If no humans are available, the 24-hours-cold approach in `playtesting-solo` is the next-best.

## Output of an onboarding pass

For each game:

1. The single most important thing the player must learn first. (The verb.)
2. The mechanism teaching it (affordance / forced discovery / prompt).
3. The order of subsequent mechanics, with the trigger condition for introducing each.
4. The complete list of text the game shows in the first 60 seconds — should fit in a tweet.
