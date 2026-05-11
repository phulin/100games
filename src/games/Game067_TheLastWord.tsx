import { useEffect, useMemo, useRef, useState } from "react";

// Game 67 - The Last Word
// Turn-based: you and a simulated opponent add one word at a time.
// You hold 5 hidden word-type cards. After 50 words, guess theirs;
// they guess yours too.

type CardType = "noun" | "verb" | "adjective" | "adverb" | "place" | "color" | "number" | "name";

const ALL_CARDS: CardType[] = ["noun", "verb", "adjective", "adverb", "place", "color", "number", "name"];

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIT_NOUN_PREFIX = ["riv", "lan", "ship", "gar", "key", "let", "shad", "song", "feath", "stone", "wind", "horse", "moun", "cloud", "tide", "flame", "bridge", "vault"];
const KIT_NOUN_SUFFIX = ["er", "ern", "den", "ow", "ter", "ed", "let", "or", "y"];
const KIT_VERB = ["ran", "whispered", "broke", "fell", "lifted", "burned", "swam", "waited", "danced", "remembered", "kneeled", "leaped", "drifted", "snarled"];
const KIT_ADJ = ["bright", "quiet", "salty", "ancient", "strange", "soft", "cold", "wild", "hidden", "patient", "weary", "brisk", "luminous"];
const KIT_ADV = ["slowly", "almost", "barely", "softly", "loudly", "finally", "carefully", "wildly", "scarcely", "endlessly"];
const KIT_PLACE_A = ["Par", "Tok", "Ber", "Lis", "Pra", "Kyo", "Bom", "Cai", "Mal", "Riy"];
const KIT_PLACE_B = ["is", "yo", "lin", "bon", "gue", "to", "bay", "ro", "ta", "adh"];
const KIT_COLOR = ["red", "indigo", "amber", "jade", "silver", "violet", "rust", "ivory", "cobalt", "ochre", "umber", "saffron"];
const KIT_NUMBER = ["seven", "twelve", "one", "fifty", "three", "nineteen", "hundred", "forty", "thirteen", "eighty"];
const KIT_NAME_A = ["Al", "Mir", "Be", "Cle", "Ot", "Sel", "Ir", "Jul", "Ros", "Lu", "Fre"];
const KIT_NAME_B = ["do", "a", "n", "o", "to", "ma", "is", "es", "i", "ne", "ya"];

function buildVocab(seed: number): Record<CardType, string[]> {
  const r = mulberry32(seed ^ 0x57a3);
  const draw = (arr: string[], n: number) => {
    const pool = arr.slice();
    const out: string[] = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };
  const nouns = new Set<string>();
  while (nouns.size < 14) {
    nouns.add(KIT_NOUN_PREFIX[Math.floor(r() * KIT_NOUN_PREFIX.length)] + KIT_NOUN_SUFFIX[Math.floor(r() * KIT_NOUN_SUFFIX.length)]);
  }
  const places = new Set<string>();
  while (places.size < 10) {
    places.add(KIT_PLACE_A[Math.floor(r() * KIT_PLACE_A.length)] + KIT_PLACE_B[Math.floor(r() * KIT_PLACE_B.length)]);
  }
  const names = new Set<string>();
  while (names.size < 10) {
    names.add(KIT_NAME_A[Math.floor(r() * KIT_NAME_A.length)] + KIT_NAME_B[Math.floor(r() * KIT_NAME_B.length)]);
  }
  return {
    noun: Array.from(nouns),
    verb: draw(KIT_VERB, 10),
    adjective: draw(KIT_ADJ, 10),
    adverb: draw(KIT_ADV, 8),
    place: Array.from(places),
    color: draw(KIT_COLOR, 8),
    number: draw(KIT_NUMBER, 8),
    name: Array.from(names),
  };
}

const CONNECTORS = ["the", "a", "and", "but", "then", "after", "into", "from", "of", "with", "she", "he", "I", "we"];

function dealFromRand(rand: () => number): CardType[] {
  const pool = [...ALL_CARDS];
  const hand: CardType[] = [];
  for (let i = 0; i < 5; i++) hand.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return hand;
}

export default function Game067_TheLastWord() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const vocab = useMemo(() => buildVocab(seed), [seed]);
  const [opponentCards, setOpponentCards] = useState<CardType[]>(() => dealFromRand(mulberry32(seed ^ 0xbeef)));
  const [myCards, setMyCards] = useState<CardType[]>(() => {
    const r = mulberry32(seed ^ 0xbeef);
    dealFromRand(r);
    return dealFromRand(r);
  });

  function classifyWord(w: string): CardType | null {
    const lw = w.toLowerCase();
    for (const t of ALL_CARDS) if (vocab[t].some((x) => x.toLowerCase() === lw)) return t;
    return null;
  }

  const [story, setStory] = useState<{ word: string; by: "me" | "op" }[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"play" | "guess" | "done">("play");
  const [guess, setGuess] = useState<CardType[]>([]);
  const [oppGuess, setOppGuess] = useState<CardType[]>([]);
  const [result, setResult] = useState<{ myUsed: CardType[]; correct: number; theirCorrect: number; stealth: number } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const r = mulberry32(seed ^ 0xbeef);
    setOpponentCards(dealFromRand(r));
    setMyCards(dealFromRand(r));
    setStory([]);
    setGuess([]);
    setOppGuess([]);
    setResult(null);
    setPhase("play");
  }, [seed]);

  function ensureCtx() {
    if (!audioRef.current) {
      try {
        audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {}
    }
    return audioRef.current;
  }

  function click(freq: number, dur = 0.06) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "square";
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.01);
  }

  function chime(freq: number) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "triangle";
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  useEffect(() => {
    if (story.length >= 50 && phase === "play") setPhase("guess");
  }, [story.length, phase]);

  function submitWord() {
    const w = input.trim().split(/\s+/)[0];
    if (!w) return;
    const t = classifyWord(w);
    const usedBefore = countUsed(story, "me");
    const newlyMine = t && myCards.includes(t) && (usedBefore[t] || 0) === 0;
    setStory((s) => [...s, { word: w, by: "me" }]);
    setInput("");
    if (newlyMine) chime(660);
    else click(420);
    setTimeout(opponentTurn, 380);
  }

  function opponentTurn() {
    setStory((cur) => {
      const usedSelf = countUsed(cur, "op");
      const remaining = opponentCards.filter((c) => (usedSelf[c] || 0) === 0);
      const usedYou = countUsed(cur, "me");
      const yourLikely: CardType[] = (Object.keys(usedYou) as CardType[]).filter((c) => usedYou[c] >= 2);
      const wantCard = remaining.length > 0 && Math.random() < (0.35 + remaining.length * 0.08);
      let w: string;
      if (wantCard) {
        const c = remaining[Math.floor(Math.random() * remaining.length)];
        w = vocab[c][Math.floor(Math.random() * vocab[c].length)];
      } else if (yourLikely.length > 0 && Math.random() < 0.4) {
        const c = yourLikely[Math.floor(Math.random() * yourLikely.length)];
        w = vocab[c][Math.floor(Math.random() * vocab[c].length)];
      } else if (Math.random() < 0.55) {
        w = CONNECTORS[Math.floor(Math.random() * CONNECTORS.length)];
      } else {
        const pool = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
        w = vocab[pool][Math.floor(Math.random() * vocab[pool].length)];
      }
      click(280);
      return [...cur, { word: w, by: "op" }];
    });
  }

  function countUsed(s: typeof story, by: "me" | "op"): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of s) {
      if (e.by !== by) continue;
      const t = classifyWord(e.word);
      if (t) out[t] = (out[t] || 0) + 1;
    }
    return out;
  }

  function toggleGuess(c: CardType) {
    setGuess((g) => (g.includes(c) ? g.filter((x) => x !== c) : g.length < 5 ? [...g, c] : g));
  }

  function submitGuess() {
    const correct = guess.filter((c) => opponentCards.includes(c)).length;
    const myUsedMap = countUsed(story, "me");
    const myUsed = (Object.keys(myUsedMap) as CardType[]).filter((c) => myCards.includes(c));
    const sortedByMyUse = (Object.keys(myUsedMap) as CardType[]).sort((a, b) => (myUsedMap[b] || 0) - (myUsedMap[a] || 0));
    const theirGuess: CardType[] = sortedByMyUse.slice(0, 5);
    while (theirGuess.length < 5) {
      const c = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
      if (!theirGuess.includes(c)) theirGuess.push(c);
    }
    setOppGuess(theirGuess);
    const theirCorrect = theirGuess.filter((c) => myCards.includes(c)).length;
    const stealth = 5 - theirCorrect;
    setResult({ myUsed, correct, theirCorrect, stealth });
    setPhase("done");
    chime(880);
  }

  return (
    <div style={{ color: "#eee", fontFamily: "Georgia, serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>The Last Word</h2>
      <div style={{ fontFamily: "system-ui", fontSize: 13, opacity: 0.85 }}>
        Add one word per turn. Use each of your 5 secret cards once — but don't be obvious; your opponent guesses yours too.
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0", fontFamily: "system-ui", fontSize: 12, alignItems: "center" }}>
        Your cards: {myCards.map((c) => <span key={c} style={{ padding: "2px 8px", background: "#345", borderRadius: 4, marginRight: 4 }}>{c}</span>)}
        <button style={{ marginLeft: "auto" }} onClick={() => setSeed((s) => s + 1)}>New Game</button>
      </div>
      <div style={{ background: "#f4eed2", color: "#2a230d", padding: 14, borderRadius: 4, minHeight: 120, fontSize: 17, lineHeight: 1.5 }}>
        {story.map((s, i) => (
          <span key={i} style={{ background: s.by === "me" ? "#dde7ff" : "#ffe7d9", padding: "1px 3px", marginRight: 3 }}>
            {s.word}
          </span>
        ))}
        {story.length === 0 && <span style={{ opacity: 0.5 }}>The story will appear here…</span>}
      </div>
      <div style={{ marginTop: 8, fontFamily: "system-ui", fontSize: 12 }}>Words: {story.length} / 50</div>
      {phase === "play" && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, fontFamily: "system-ui" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitWord();
            }}
            placeholder="one word…"
            style={{ flex: 1, padding: 6, background: "#0d1320", color: "#eee", border: "1px solid #345", borderRadius: 4 }}
          />
          <button onClick={submitWord}>Add</button>
        </div>
      )}
      {phase === "guess" && (
        <div style={{ marginTop: 10, fontFamily: "system-ui" }}>
          <div>Guess your opponent's 5 cards:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {ALL_CARDS.map((c) => (
              <button key={c} onClick={() => toggleGuess(c)} style={{ background: guess.includes(c) ? "#345" : "#223" }}>
                {c}
              </button>
            ))}
          </div>
          <button style={{ marginTop: 8 }} onClick={submitGuess} disabled={guess.length !== 5}>Lock in guesses</button>
        </div>
      )}
      {phase === "done" && result && (
        <div style={{ marginTop: 10, padding: 10, background: "#1f2c3a", borderRadius: 6, fontFamily: "system-ui" }}>
          <div>You guessed {result.correct}/5 correctly. Opponent's cards: {opponentCards.join(", ")}</div>
          <div>Opponent guessed {result.theirCorrect}/5 of yours: {oppGuess.join(", ")} (your cards: {myCards.join(", ")})</div>
          <div>Cards you used: {result.myUsed.join(", ") || "(none)"}</div>
          <div style={{ marginTop: 6, fontWeight: 700 }}>
            Score: {result.correct * 2 + result.myUsed.length + result.stealth} (2× reads + own cards used + stealth {result.stealth})
          </div>
        </div>
      )}
    </div>
  );
}
