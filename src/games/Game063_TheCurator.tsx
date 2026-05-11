import { useMemo, useState } from "react";

// Game 63 - The Curator
// 5 rooms x 4 paintings. Place 20 paintings. Visitors rate based on hidden
// adjacency preferences you discover from feedback.

type Painting = {
  id: number;
  period: "renaissance" | "modern" | "baroque" | "impressionist";
  palette: "warm" | "cool" | "monochrome" | "vivid";
  subject: "portrait" | "landscape" | "still" | "abstract";
  title: string;
};

const PERIODS = ["renaissance", "modern", "baroque", "impressionist"] as const;
const PALETTES = ["warm", "cool", "monochrome", "vivid"] as const;
const SUBJECTS = ["portrait", "landscape", "still", "abstract"] as const;

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function gen(seed: number): { paintings: Painting[]; rule: { kind: "period" | "palette" | "subject"; same: boolean; tag: string } } {
  const r = seededRand(seed);
  const paintings: Painting[] = [];
  const titles = [
    "Dawn", "Echoes", "Garden", "Storm", "Idyll", "Veil", "Mirror", "Quiet", "Fall", "Bloom",
    "Vessel", "Pilgrim", "Frost", "Ember", "Tide", "Vault", "Lantern", "Cinder", "Threshold", "Reverie",
  ];
  for (let i = 0; i < 20; i++) {
    paintings.push({
      id: i,
      period: PERIODS[Math.floor(r() * 4)],
      palette: PALETTES[Math.floor(r() * 4)],
      subject: SUBJECTS[Math.floor(r() * 4)],
      title: titles[i],
    });
  }
  const kind = (["period", "palette", "subject"] as const)[Math.floor(r() * 3)];
  const same = r() > 0.4;
  const pool = kind === "period" ? PERIODS : kind === "palette" ? PALETTES : SUBJECTS;
  const tag = pool[Math.floor(r() * pool.length)];
  return { paintings, rule: { kind, same, tag } };
}

export default function Game063_TheCurator() {
  const [seed, setSeed] = useState(7);
  const { paintings, rule } = useMemo(() => gen(seed), [seed]);
  // rooms[r] = array of 4 painting ids or null
  const [rooms, setRooms] = useState<(number | null)[][]>(() =>
    Array.from({ length: 5 }, () => [null, null, null, null])
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [hint, setHint] = useState("");

  function available(id: number) {
    return !rooms.some((r) => r.includes(id));
  }

  function placeAt(roomIdx: number, slot: number) {
    if (picked == null) return;
    if (!available(picked)) return;
    setRooms((rs) => {
      const next = rs.map((r) => r.slice());
      next[roomIdx][slot] = picked;
      return next;
    });
    setPicked(null);
  }

  function remove(roomIdx: number, slot: number) {
    setRooms((rs) => {
      const next = rs.map((r) => r.slice());
      next[roomIdx][slot] = null;
      return next;
    });
  }

  // Score each room: pairs within room that obey hidden rule
  function scoreRoom(room: (number | null)[]) {
    const inside = room.filter((x) => x != null).map((id) => paintings[id as number]);
    let s = 0;
    for (let i = 0; i < inside.length; i++)
      for (let j = i + 1; j < inside.length; j++) {
        const a = inside[i];
        const b = inside[j];
        const av = (a as any)[rule.kind];
        const bv = (b as any)[rule.kind];
        if (rule.same) {
          if (av === bv && av === rule.tag) s += 2;
          else if (av === bv) s += 1;
        } else {
          if (av !== bv) s += 1;
        }
      }
    return s;
  }

  const totalPlaced = rooms.flat().filter((x) => x != null).length;
  const roomScores = rooms.map(scoreRoom);
  const total = roomScores.reduce((a, b) => a + b, 0);

  function reveal() {
    setHint(
      `Visitors preferred ${rule.same ? "rooms where paintings shared the same" : "rooms where paintings varied in"} ${rule.kind}${rule.same ? ` (especially "${rule.tag}")` : ""}.`
    );
  }

  function newGallery() {
    setSeed((s) => s + 1);
    setRooms(Array.from({ length: 5 }, () => [null, null, null, null]));
    setPicked(null);
    setHint("");
  }

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>The Curator</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Click a painting then click a slot. Visitors rate each room by a hidden adjacency rule (period/palette/subject). Reveal after placing all 20.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Storage</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
            {paintings.map((p) => {
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
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                Room {ri + 1} · rating {roomScores[ri]}
              </div>
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
        <button onClick={reveal} disabled={totalPlaced < 20}>
          Open to Visitors
        </button>
        <button onClick={newGallery}>New Collection</button>
        <span>Placed: {totalPlaced}/20 · Total rating: {total}</span>
      </div>
      {hint && <div style={{ marginTop: 8, padding: 10, background: "#1f2c3a", borderRadius: 6 }}>{hint}</div>}
    </div>
  );
}
