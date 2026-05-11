import { useMemo, useState } from "react";

// Game 63 - The Curator
// 5 rooms x 4 paintings. Multiple hidden visitor preferences procedurally generated.
// Players get hints by previewing rooms before final visitor open.

type Painting = {
  id: number;
  period: "renaissance" | "modern" | "baroque" | "impressionist";
  palette: "warm" | "cool" | "monochrome" | "vivid";
  subject: "portrait" | "landscape" | "still" | "abstract";
  title: string;
};

type Rule = { kind: "period" | "palette" | "subject"; same: boolean; tag: string; weight: number };

const PERIODS = ["renaissance", "modern", "baroque", "impressionist"] as const;
const PALETTES = ["warm", "cool", "monochrome", "vivid"] as const;
const SUBJECTS = ["portrait", "landscape", "still", "abstract"] as const;

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

const TITLE_ROOTS = [
  "Dawn", "Echo", "Garden", "Storm", "Idyll", "Veil", "Mirror", "Quiet", "Fall", "Bloom",
  "Vessel", "Pilgrim", "Frost", "Ember", "Tide", "Vault", "Lantern", "Cinder", "Threshold", "Reverie",
  "Salt", "Aria", "Hollow", "Spire", "Anchor", "Loom", "Cradle", "Hearth", "Brook", "Crown",
];
const TITLE_SUFFIX = ["", " no. 3", " in Blue", " at Night", " (study)", " II", " (after rain)", " of the West", " unfinished"];

function gen(seed: number): { paintings: Painting[]; rules: Rule[] } {
  const r = mulberry32(seed);
  const paintings: Painting[] = [];
  const usedTitles = new Set<string>();
  for (let i = 0; i < 20; i++) {
    let title = "";
    let tries = 0;
    while (tries++ < 30) {
      const root = TITLE_ROOTS[Math.floor(r() * TITLE_ROOTS.length)];
      const suf = TITLE_SUFFIX[Math.floor(r() * TITLE_SUFFIX.length)];
      title = root + suf;
      if (!usedTitles.has(title)) break;
    }
    usedTitles.add(title);
    paintings.push({
      id: i,
      period: PERIODS[Math.floor(r() * 4)],
      palette: PALETTES[Math.floor(r() * 4)],
      subject: SUBJECTS[Math.floor(r() * 4)],
      title,
    });
  }
  const ruleCount = 2 + (r() > 0.5 ? 1 : 0);
  const kinds = (["period", "palette", "subject"] as const).slice();
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const rules: Rule[] = [];
  for (let i = 0; i < ruleCount; i++) {
    const kind = kinds[i];
    const same = r() > 0.4;
    const pool = kind === "period" ? PERIODS : kind === "palette" ? PALETTES : SUBJECTS;
    const tag = pool[Math.floor(r() * pool.length)];
    rules.push({ kind, same, tag, weight: 1 + Math.floor(r() * 2) });
  }
  return { paintings, rules };
}

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}
function blip(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.06) {
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

export default function Game063_TheCurator() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const { paintings, rules } = useMemo(() => gen(seed), [seed]);
  const [rooms, setRooms] = useState<(number | null)[][]>(() =>
    Array.from({ length: 5 }, () => [null, null, null, null])
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState<{ kind: "period" | "palette" | "subject" | "all"; value: string }>({ kind: "all", value: "" });
  const [previewRoom, setPreviewRoom] = useState<number | null>(null);

  function available(id: number) {
    return !rooms.some((r) => r.includes(id));
  }

  function placeAt(roomIdx: number, slot: number) {
    if (picked == null) return;
    if (!available(picked)) return;
    blip(500 + roomIdx * 60, 0.07, "triangle", 0.05);
    setRooms((rs) => {
      const next = rs.map((r) => r.slice());
      next[roomIdx][slot] = picked;
      return next;
    });
    setPicked(null);
  }

  function remove(roomIdx: number, slot: number) {
    blip(320, 0.05, "square", 0.04);
    setRooms((rs) => {
      const next = rs.map((r) => r.slice());
      next[roomIdx][slot] = null;
      return next;
    });
  }

  function scoreRoom(room: (number | null)[]) {
    const inside = room.filter((x) => x != null).map((id) => paintings[id as number]);
    let s = 0;
    for (let i = 0; i < inside.length; i++) {
      for (let j = i + 1; j < inside.length; j++) {
        const a = inside[i];
        const b = inside[j];
        for (const rule of rules) {
          const av = (a as unknown as Record<string, string>)[rule.kind];
          const bv = (b as unknown as Record<string, string>)[rule.kind];
          if (rule.same) {
            if (av === bv && av === rule.tag) s += 2 * rule.weight;
            else if (av === bv) s += 1 * rule.weight;
          } else {
            if (av !== bv) s += 1 * rule.weight;
          }
        }
      }
    }
    return s;
  }

  function previewHint(room: (number | null)[]) {
    const inside = room.filter((x) => x != null).map((id) => paintings[id as number]);
    if (inside.length < 2) return "Add at least two paintings to preview.";
    const perRule = rules.map((rule) => {
      let s = 0;
      for (let i = 0; i < inside.length; i++)
        for (let j = i + 1; j < inside.length; j++) {
          const av = (inside[i] as unknown as Record<string, string>)[rule.kind];
          const bv = (inside[j] as unknown as Record<string, string>)[rule.kind];
          if (rule.same) {
            if (av === bv && av === rule.tag) s += 2;
            else if (av === bv) s += 1;
          } else {
            if (av !== bv) s += 1;
          }
        }
      return { rule, s };
    });
    perRule.sort((a, b) => b.s - a.s);
    const top = perRule[0];
    if (top.s === 0) return "Visitors seem indifferent to this room.";
    return `Visitors react to the ${top.rule.kind} of paintings in this room.`;
  }

  const totalPlaced = rooms.flat().filter((x) => x != null).length;
  const roomScores = rooms.map(scoreRoom);
  const total = roomScores.reduce((a, b) => a + b, 0);

  function openGallery() {
    setOpened(true);
    blip(660, 0.15, "sine", 0.06);
    setTimeout(() => blip(880, 0.18, "sine", 0.06), 120);
  }

  function newGallery() {
    setSeed(Math.floor(Math.random() * 1e9));
    setRooms(Array.from({ length: 5 }, () => [null, null, null, null]));
    setPicked(null);
    setOpened(false);
    setPreviewRoom(null);
  }

  const filtered = paintings.filter((p) => {
    if (filter.kind === "all") return true;
    return (p as unknown as Record<string, string>)[filter.kind] === filter.value;
  });

  const filterOpts: { kind: "period" | "palette" | "subject"; values: readonly string[] }[] = [
    { kind: "period", values: PERIODS },
    { kind: "palette", values: PALETTES },
    { kind: "subject", values: SUBJECTS },
  ];

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>The Curator</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Click a painting then a slot. Visitors react to multiple hidden adjacency rules (period/palette/subject). Preview a room to get a vague hint.
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0", flexWrap: "wrap", fontSize: 12 }}>
        <span>Filter:</span>
        <button onClick={() => setFilter({ kind: "all", value: "" })} style={{ background: filter.kind === "all" ? "#345" : "#223" }}>all</button>
        {filterOpts.map((opt) =>
          opt.values.map((v) => (
            <button
              key={`${opt.kind}-${v}`}
              onClick={() => setFilter({ kind: opt.kind, value: v })}
              style={{ background: filter.kind === opt.kind && filter.value === v ? "#345" : "#223" }}
            >
              {v}
            </button>
          ))
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Storage ({filtered.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {filtered.map((p) => {
              const avail = available(p.id);
              return (
                <button
                  key={p.id}
                  disabled={!avail}
                  onClick={() => setPicked(p.id)}
                  style={{
                    padding: 8,
                    background: picked === p.id ? "#445" : avail ? "#223" : "#111",
                    color: avail ? "#fff" : "#555",
                    border: "1px solid #345",
                    borderRadius: 4,
                    textAlign: "left",
                    fontSize: 11,
                    cursor: avail ? "pointer" : "default",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div>{p.period}</div>
                  <div>{p.palette} / {p.subject}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Gallery</div>
          {rooms.map((room, ri) => (
            <div key={ri} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, opacity: 0.7, display: "flex", justifyContent: "space-between" }}>
                <span>Room {ri + 1} - rating {roomScores[ri]}</span>
                <button onClick={() => setPreviewRoom(previewRoom === ri ? null : ri)} style={{ fontSize: 10, padding: "0 6px" }}>
                  {previewRoom === ri ? "hide" : "preview"}
                </button>
              </div>
              {previewRoom === ri && (
                <div style={{ fontSize: 11, padding: 4, background: "#0d1320", borderRadius: 4, opacity: 0.85 }}>
                  {previewHint(room)}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                {room.map((id, si) => (
                  <div
                    key={si}
                    onClick={() => (id == null ? placeAt(ri, si) : remove(ri, si))}
                    style={{
                      height: 56,
                      border: "1px dashed #456",
                      borderRadius: 4,
                      padding: 4,
                      background: id == null ? "#0d1320" : "#284059",
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    {id == null ? <span style={{ opacity: 0.4 }}>(empty)</span> : (
                      <>
                        <div style={{ fontWeight: 700 }}>{paintings[id].title}</div>
                        <div>{paintings[id].period}</div>
                        <div>{paintings[id].palette}/{paintings[id].subject}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
        <button onClick={openGallery} disabled={totalPlaced < 20}>Open to Visitors</button>
        <button onClick={newGallery}>New Collection</button>
        <span>Placed: {totalPlaced}/20 - Total rating: {total}</span>
      </div>
      {opened && (
        <div style={{ marginTop: 8, padding: 10, background: "#1f2c3a", borderRadius: 6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Visitor reactions:</div>
          {rules.map((rule, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              - {rule.same ? "Loved rooms where paintings shared the same" : "Loved rooms where paintings varied in"} {rule.kind}
              {rule.same ? ` (especially "${rule.tag}")` : ""} {rule.weight > 1 ? "[strong]" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
