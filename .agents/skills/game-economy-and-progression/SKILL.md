---
name: game-economy-and-progression
version: 1.0.0
description: Use when designing scoring, currencies, unlocks, meta-progression, or any "reason to keep playing" system that spans multiple runs. Covers economy loops, reward schedules, the difference between fun-to-earn and grindy, and the dark patterns to avoid. Trigger phrases: "scoring system", "currency", "unlock", "meta-progression", "progression", "leaderboard", "high score", "reason to play again", "engagement loop", "grindy".
---

# Game Economy and Progression

A core loop makes a single run fun. An economy makes the *next* run fun. Most casual browser games fail not because the loop is bad but because nothing changes from run to run — so players play once and leave.

## When to use

- The core loop works and runs are individually fun (see `designing-game-mechanics`, `prototyping-games`).
- Playtesters say "yeah that was cool" and don't come back.
- Designing a scoring or unlock system from scratch.
- The game has currency/XP/unlocks and they don't feel meaningful.

Do **not** use before the core loop is fun. Progression cannot fix a bad loop; it only delays the moment players notice.

## The hierarchy of reasons-to-play-again

In rough order of how powerful each is, and how cheap to implement:

1. **Personal best.** Easiest, free, universal. A single visible "BEST" number that updates is enough hook for many casual games.
2. **Randomized run state.** Each run is different (see `procedural-content`).
3. **Daily challenge.** A fresh seeded variant once per day; shareable result.
4. **Skill ceiling.** The game has depth — moves, combos, optimization — players want to master.
5. **Cosmetic unlocks.** Trophies, themes, hats. Cheap to add visual reward without affecting balance.
6. **Mechanical unlocks (meta-progression).** New starting items, new modes, new characters. Powerful but expensive to design and balance.
7. **Leaderboards / social.** Comparison drives sustained play. Requires backend.

For a 100-game gallery, 1-3 are nearly always worth it; 5 sometimes; 6 only for games you intend to develop further.

## Scoring design

Score is the most fundamental progression system. Most games get it wrong by making it:

- **Linear with time.** "+10 per second alive." Boring — score doesn't reflect skill, just patience.
- **Single-source.** Only one way to score; experts and beginners differ by a small constant.
- **Untiered.** No round numbers to chase. Players don't know if 1,000 is good.

Better scoring:

- **Multiple sources, varying magnitudes.** Killing one enemy = 10, clearing a wave = 100, perfect wave = 500. Skilled play scores 10x more, not 1.5x more.
- **Multipliers and combos.** Score × combo creates exponential rewards for skilled play. Combo drops on hit or timeout.
- **Round-number thresholds.** Show milestones — 1K, 5K, 10K — with small celebrations.
- **High-score persistence.** localStorage at minimum. Single most important UI element in many casual games.

A useful formula: `score = base * skill_multiplier^streak`. Tune so:
- 1 minute of mediocre play scores ~100.
- 1 minute of expert play scores ~10,000.
- A perfect 5-minute run scores ~1,000,000.

The two-order-of-magnitude gap is what makes mastery feel meaningful.

## Currency economies

If you add a meta-currency (coins, stars, gems):

- **One currency. Always one.** Multiple currencies are a free-to-play addiction pattern and are confusing in a casual game.
- **Earned currency must matter within 2-3 runs.** If unlocks take 50 runs, players give up at run 4.
- **Visible accumulation.** Show coin counts floating up from kills/clears. Half the fun is watching the number rise.
- **No spend-to-continue.** Don't make players spend currency to retry. Free reset, every time. (Watch-an-ad-to-revive is mobile-game cancer; don't.)

## Reward schedules

How often should rewards trigger? Apply variable-ratio reinforcement carefully — the principle behind slot machines and *also* good arcade games:

- **Predictable rewards** (every X kills): satisfying, reduces tension. Use for primary scoring.
- **Random rewards** (chance per event): hooky, addictive. Use sparingly — for drops, crits, surprise bonuses.
- **Milestone rewards** (every N points/level): pacing anchors. Bigger fanfare than per-event rewards.

A solid pattern: predictable score per action + occasional random "rare drop" + clear milestone fanfare at thresholds.

## Meta-progression: the unlock tree

If runs unlock things for future runs:

- **Every unlock changes how the game plays.** Cosmetic-only unlocks are fine but should be cheap. Meaningful unlocks must change a behavior — new starting weapon, new dodge, new map.
- **Order unlocks from "increases breadth" to "increases depth."** Early unlocks add new content; late unlocks add nuance to existing content.
- **No unlock should be strictly better.** Each should change the playstyle, not power-creep. Otherwise older content becomes obsolete.
- **Show what's locked.** Silhouettes, "???", "100 more points." Players play for visible goals.

## The grindy / fun spectrum

A reward is **fun** when:
- The player would have done the activity anyway.
- The reward is a satisfying surprise or a clear milestone.
- The path between rewards is varied.

A reward is **grindy** when:
- The activity is tolerated only because of the reward.
- The path is repetitive and known.
- The next reward is far away with no intermediate signal.

If your unlock costs are pushing players from "playing the game" to "farming the activity that earns the unlock," shorten the path or vary the source.

## Persistence

For browser games:

- **localStorage** for single-player high scores, unlocks, settings. Simple, no backend.
- **D1 (in this scaffold)** for cross-device or shared (leaderboard, daily challenge) data.
- **Always handle missing data gracefully.** New visitors should not see a broken UI because no save exists.
- **Never trust client-side scores for global leaderboards.** Validate server-side or accept cheating.

## Anti-patterns

- **Daily login bonus.** A casual web game has no daily login. Players play, leave, may return. Don't punish absence.
- **Energy / lives that regenerate over time.** Hostile to casual play. Players close the tab; they aren't coming back at 3pm to spend stamina.
- **Multiple currencies.** Confusing. Use one. If you think you need two, you need one.
- **Pay-to-progress in a non-monetized game.** Players ask "what's the catch?" and bounce. Save those mechanics for actual freemium games.
- **Score inflation without context.** Showing "523,047" without showing the player's previous best is just noise.
- **Tying progression to time-played rather than skill-shown.** Discourages mastery. Reward what the player *does*, not how long they sit there.
- **Achievement spam.** "First click! First death! First hour!" Cheapens later, real achievements. Reserve achievements for genuinely interesting milestones.

## Verification

- After one win/loss, is there a clear, visible reason to play again? (Should be yes.)
- After 10 runs, has the player's relationship to the game changed at all? (Best play, new unlocks, new strategies.)
- If you remove the meta-progression entirely, is the game still fun for one run? (Should still be yes — meta-progression is a multiplier, not a foundation.)
- A new player and a 100-run player: do their runs look meaningfully different? (Should be yes, but not so much that the new player feels hopelessly behind.)

## Output

For each game's progression system:

1. The primary "play again" hook (which of the 7 above, or which combination).
2. The scoring formula and its expected range over a typical run.
3. The persistence layer and what's stored.
4. The unlock schedule (if any), with target run counts to reach each.
5. The single number the player is asked to chase. (There must be exactly one — high score, daily rank, unlock progress. Multiple top-level goals dilute focus.)
