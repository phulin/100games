---
name: game-audio
version: 1.0.0
description: Use when adding sound effects, music, or audio feedback to a browser game. Covers Web Audio API patterns, sample-vs-synthesis tradeoffs, pitch randomization, audio pooling, autoplay policies, and audio that doesn't annoy. Trigger phrases: "add sound", "sound effects", "SFX", "music for the game", "audio feedback", "Web Audio", "the game is silent", "autoplay blocked".
---

# Game Audio

Audio carries roughly half a game's perceived feel, but it is the easiest pillar to do badly. Bad audio is worse than silent — it's the first thing players mute, and they don't come back to unmute it.

## When to use

- Adding sound effects to player actions, hits, scores, deaths.
- Adding music or ambient loops.
- A game is "missing something" and feel improvements have plateaued.
- Audio works in dev but is broken/silent on a deployed page (autoplay policy).

Pair with `game-feel-and-juice` — sound is one of the feedback channels in the juice budget.

## The two audio paths

### HTMLAudioElement (`new Audio('foo.wav')`)
- **Use for:** music tracks, long ambient loops.
- **Pros:** trivial, supports streaming, native loop.
- **Cons:** one playback per element, scheduling is sloppy, cannot mix or modulate.

### Web Audio API (`AudioContext`)
- **Use for:** all SFX, anything that needs to play multiple times overlapping, anything that needs pitch/volume modulation, generated audio.
- **Pros:** precise scheduling, pitch and gain modulation, can mix many sources, supports synthesis.
- **Cons:** more code, must handle autoplay/resume.

Default: Web Audio for SFX, HTMLAudioElement for music. Both share the same autoplay constraints.

## Autoplay policy — the universal trap

**Browsers will block audio playback until the user has interacted with the page.** This is non-negotiable. Symptoms: silence on first load, fine after first click.

Pattern:

```ts
const audioCtx = new AudioContext();

function unlockAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
```

Do this once per page load. Music should also wait for first user input before playing, or it will start silently and never resume.

Always provide a mute toggle and **default to muted on web games** — players' tolerance for surprise audio in a gallery context is zero.

## Pitch randomization

The single biggest fix for amateur-sounding SFX: vary the pitch ±10-15% on each play.

```ts
function playSample(buffer: AudioBuffer, pitchVariance = 0.1) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * pitchVariance;
  src.connect(gainNode);
  src.start();
}
```

This single change makes a stock "click" sound stop sounding like a malfunction when fired rapidly. Apply to *every* recurring SFX.

## Layering

A single hit sound at full volume is okay. A hit sound that layers a punchy transient + a body thump + a hi-frequency sparkle is *great*. Each layer is short (50-300ms), individually pitch-randomized, and mixed at different volumes.

You don't need three audio files to do this — you need *one mental model*. Even simple SFX libraries like sfxr/jsfxr can be used to generate two or three short variants and mixed together.

## Generation vs. samples

For 100-game-style rapid prototypes, *generated* audio (sfxr-style) is often the right call:

- **[jsfxr](https://github.com/loov/jsfxr)** — generates classic 8-bit SFX in the browser, no asset files.
- **Web Audio oscillators + envelopes** — for tones, beeps, sweeps, woodblocks.
- **Noise + bandpass** — for hits, explosions, footsteps.

Example simple synth-hit:

```ts
function blip(freq: number, duration: number) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}
```

For richer or more grounded sounds, samples win. Use freesound.org / OpenGameArt / generated assets; cite licenses.

## Music

Browser-game music rules:

- **Loop must be seamless.** A perceptible seam every 30s drives players to mute. Cross-fade endpoints or use a loop point precise to the sample.
- **Loop must be long *enough*.** A 15-second loop in a 10-minute game is torture. Aim for 60-120s minimum, or layer multiple loops.
- **Duck under SFX.** When an important SFX fires, dip music volume briefly. Keeps SFX legible.
- **Pause on tab hidden.** Use `document.visibilitychange` to mute music when the tab isn't visible.
- **Volume curve is logarithmic.** A 50% slider should *sound* like half. Use `gainNode.gain.value = sliderValue ** 2`.

## Pooling and rate-limiting

If a hit can fire 30 times in one frame (bullet hell), playing 30 overlapping copies is awful. Mitigations:

- **Rate-limit per SFX:** "this sound can play at most once per 30ms."
- **Voice cap:** max N concurrent voices total; oldest wins.
- **Per-source mixing:** layer instead of stack — one hit sound at the moment of the first impact, scaled in volume by simultaneous-hit count.

## Anti-patterns

- **No mute button.** Always present, always reachable in 1 click.
- **Default unmuted.** Web games have no permission to interrupt the user. Default muted, let them unmute.
- **Same pitch every time.** Sounds like a bug. Always randomize ±10%.
- **Music starts before SFX is ready.** If music plays on load but SFX requires user gesture, you get an inconsistent experience. Gate both behind the same user-gesture unlock.
- **One giant audio asset preloaded synchronously.** Hangs the page. Lazy-load music after the game is interactive.
- **No volume separation.** Music and SFX share a single gain. Player wants to keep SFX but lower music — give them two sliders.
- **High-frequency sting on every UI click.** Annoying within 10 seconds. Save piercing sounds for *important* events; use mellow clicks for routine ones.

## Verification

- Play the game with audio on for 3 full minutes. Did you reach for the mute button? Why?
- Load the deployed page. Does audio work on first click? (Not before.)
- Trigger the loudest SFX 20 times in a row. Is it tolerable? (If no, pitch-randomize harder or rate-limit.)
- Switch tabs for 30 seconds. Does music pause? Does it resume?
- Open at 50% volume slider. Does it sound roughly half as loud?
