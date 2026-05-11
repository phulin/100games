import { useEffect, useState } from "react";

// Game 67 - The Last Word
// Turn-based: you and a (simulated async) opponent add one word at a time.
// You hold 5 hidden "word-type" cards you must use. After 50 words, guess
// their hidden cards.

type CardType = "noun" | "verb" | "adjective" | "adverb" | "place" | "color" | "number" | "name";

const ALL_CARDS: CardType[] = ["noun", "verb", "adjective", "adverb", "place", "color", "number", "name"];

const TYPE_WORDS: Record<CardType, string[]> = {
  noun: ["river", "lantern", "ship", "garden", "key", "letter", "shadow", "song", "feather", "stone", "window", "horse"],
  verb: ["ran", "whispered", "broke", "fell", "lifted", "burned", "swam", "waited", "danced", "remembered"],
  adjective: ["bright", "quiet", "salty", "ancient", "strange", "soft", "cold", "wild", "hidden", "patient"],
  adverb: ["slowly", "almost", "barely", "softly", "loudly", "finally", "carefully", "wildly"],
  place: ["Paris", "Tokyo", "harbor", "forest", "library", "rooftop", "valley", "kitchen"],
  color: ["red", "indigo", "amber", "jade", "silver", "violet", "rust", "ivory"],
  number: ["seven", "twelve", "one", "fifty", "three", "nineteen", "hundred"],
  name: ["Aldo", "Mira", "Ben", "Cleo", "Otto", "Selma", "Iris", "Jules"],
};

const CONNECTORS = ["the", "a", "and", "but", "then", "after", "into", "from", "of", "with", "she", "he", "I", "we"];

function deal(): CardType[] {
  const pool = [...ALL_CARDS];
  const hand: CardType[] = [];
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    hand.push(pool.splice(idx, 1)[0]);
  }
  return hand;
}

function classifyWord(w: string): CardType | null {
  const lw = w.toLowerCase();
  for (const t of ALL_CARDS) if (TYPE_WORDS[t].some((x) => x.toLowerCase() === lw)) return t;
  return null;
}

export default function Game067_TheLastWord() {
  const [opponentCards] = useState<CardType[]>(deal);
  const [myCards] = useState<CardType[]>(deal);
  const [story, setStory] = useState<{ word: string; by: "me" | "op" }[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"play" | "guess" | "done">("play");
  const [guess, setGuess] = useState<CardType[]>([]);
  const [result, setResult] = useState<{ myUsed: CardType[]; opUsed: CardType[]; correct: number } | null>(null);

  useEffect(() => {
    if (story.length >= 50 && phase === "play") setPhase("guess");
  }, [story.length, phase]);

  function submitWord() {
    const w = input.trim().split(/\s+/)[0];
    if (!w) return;
    setStory((s) => [...s, { word: w, by: "me" }]);
    setInput("");
    setTimeout(opponentTurn, 400);
  }

  function opponentTurn() {
    // opponent occasionally uses one of their cards; otherwise a connector or generic
    const used = countUsed(story, "op");
    const remaining = opponentCards.filter((c) => (used[c] || 0) === 0);
    const wantCard = remaining.length > 0 && Math.random() < 0.45;
    let w: string;
    if (wantCard) {
      const c = remaining[Math.floor(Math.random() * remaining.length)];
      w = TYPE_WORDS[c][Math.floor(Math.random() * TYPE_WORDS[c].length)];
    } else {
      // 50/50 between a connector and a random non-card word
      if (Math.random() < 0.55) w = CONNECTORS[Math.floor(Math.random() * CONNECTORS.length)];
      else {
        const pool = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
        w = TYPE_WORDS[pool][Math.floor(Math.random() * TYPE_WORDS[pool].length)];
      }
    }
    setStory((s) => [...s, { word: w, by: "op" }]);
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
    const opUsedMap = countUsed(story, "op");
    const myUsed = (Object.keys(myUsedMap) as CardType[]).filter((c) => myCards.includes(c));
    const opUsed = (Object.keys(opUsedMap) as CardType[]).filter((c) => opponentCards.includes(c));
    setResult({ myUsed, opUsed, correct });
    setPhase("done");
  }

  return (
    <div style={{ color: "#eee", fontFamily: "Georgia, serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>The Last Word</h2>
      <div style={{ fontFamily: "system-ui", fontSize: 13, opacity: 0.85 }}>
        Add one word per turn. Use each of your 5 secret type-cards at least once. After 50 words, guess your opponent's 5 cards.
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0", fontFamily: "system-ui", fontSize: 12 }}>
        Your cards: {myCards.map((c) => <span key={c} style={{ padding: "2px 8px", background: "#345", borderRadius: 4, marginRight: 4 }}>{c}</span>)}
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
          <div>You guessed {result.correct}/5 correctly.</div>
          <div>Opponent's cards: {opponentCards.join(", ")}</div>
          <div>Your cards used: {result.myUsed.join(", ") || "(none)"} of {myCards.join(", ")}</div>
          <div>
            Final score: {result.correct * 2 + result.myUsed.length} (2 per correct guess, 1 per own card used)
          </div>
        </div>
      )}
    </div>
  );
}
