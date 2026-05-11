---
name: playtesting-solo
version: 1.0.0
description: Use when you've built a game and need to honestly evaluate it without external testers. Covers self-playtesting methodology, observation protocols, what to record, and how to fight the developer-blindness that makes your own games seem better than they are. Trigger phrases: "is this game fun", "playtest", "evaluate the game", "self-test", "what's wrong with this game", "the game feels off but I don't know why".
---

# Playtesting Solo

The developer is the worst playtester of their own game. You know the rules, you anticipate the next wave, your hands have practiced the controls for hours. To get useful signal from solo playtesting you must work *against* that knowledge.

## When to use

- A game runs end-to-end and you need to decide what to fix next.
- You think the game is fun but can't articulate why.
- You think the game is broken but can't articulate why.
- Before declaring a game "done."

## Core principle: capture, don't remember

You cannot trust your in-the-moment evaluation. The brain rationalizes friction away mid-play and remembers a smoother experience than what actually happened. Counter this by capturing data *as it happens* — through recording, written notes, or instrumentation.

The minimum capture setup:
1. **Screen recording** of every session (QuickTime, built-in OS recorder, OBS).
2. A scratchpad open in another window — type a single character/word the moment something feels off, regardless of whether you understand why.
3. Optional: a tiny in-game debug overlay logging run length, deaths, score.

Review the recording *after* the play session, not during.

## The first-30-seconds test

The most valuable solo playtest. Open the game cold (or have a friend open it on your laptop). Within the first 30 seconds:

- Did the player know what the verb was?
- Did the player know what the goal was?
- Did the player do the verb on purpose, or by accident?
- Did the player encounter feedback that confirmed the verb was working?

Most failures live here. A game that fails the 30-second test loses 90% of its audience.

## Methods

### Cold-start sessions
Don't play for 24+ hours. Then play once, *all the way through*, with the recorder running. The 24-hour gap dulls your mastery enough to notice friction you'd otherwise filter out.

### Hands-off observation
If anyone else is available — partner, friend, child — sit them down with no instructions and *do not talk*. Resist the urge to explain. Every time you want to intervene, write down what you wanted to say. That note is a UX bug.

### The "what just happened" test
After any death, loss, or unexpected event, immediately ask yourself: "Do I know why that happened?" If the answer is no, the player won't know either. The game owes them a legible cause.

### The bored-stretch test
Play the game for 5 minutes straight. Mark every moment where attention drifted, you wanted to skip, or you noticed yourself thinking about something else. These are the dead spots — pacing problems, not mechanic problems.

### Variant playthroughs
Play the game three ways:
- **Optimal:** play to win.
- **Casual:** play distractedly, like a first-time visitor.
- **Adversarial:** try to break it. Spam inputs, idle for a minute, lose intentionally, win intentionally, refresh mid-game.

The casual and adversarial runs surface bugs and UX failures that optimal play hides.

## What to record per session

A short log per run:

```
Session: 2025-11-08, build 4f2c
Run 1: 47s, died to spike-wave-3, cause clear
Run 2: 12s, didn't realize jump was on space, cause unclear (UX)
Run 3: 89s, won, last 20s felt grindy
Notes: Score popup is hard to read against red enemies. Music loop is too short — noticed seam at ~30s.
```

Three runs is enough to spot patterns. One run is anecdote.

## Interpreting results

A few useful heuristics:

- **If three runs die to the same cause:** balance or telegraphing issue. Not "the player should learn."
- **If you can't remember what happened in a run:** the run was forgettable. Increase intensity peaks.
- **If you reflexively reach for the refresh button after winning:** the win wasn't satisfying. Add reward feedback.
- **If you reflexively reach for the close-tab button after losing:** the loss felt unfair. Improve telegraphing or reduce instakill.
- **If you find yourself playing past your scheduled stop time:** the loop has hooks. Note what you were chasing — that's your replay driver.

## Anti-patterns

- **Playing without recording.** Your memory will lie. Always record.
- **Iterating between every run.** Tempting, but breaks the session. Finish your three runs, *then* iterate.
- **Playing only the parts you like.** Force yourself through every state — title, settings, loss screen, post-win. Bugs hide in the rooms you don't visit.
- **Evaluating juice with the sound off.** Audio is half the feel. Test with audio on, at normal volume.
- **Trusting your "this is fun" verdict on day-of-build.** The endorphin rush of "it works!" will fool you. Wait a day, then re-test cold.
- **Asking "is this fun?" as the only question.** Too vague. Ask: "What did I feel at second 5? Second 30? Second 90? What did I want to do that I couldn't?"

## Output of a playtest session

After three runs and a recording review, produce:

1. A list of *moments* — timestamped friction or delight points. Not opinions.
2. A ranked list of fixes by frequency (how often the moment recurred) × severity (how much it disrupted play).
3. One sentence on the *biggest* problem and the *biggest* strength.
4. The next single change to make. One, not five.
