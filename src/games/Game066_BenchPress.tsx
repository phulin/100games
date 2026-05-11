import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

// Game 66 - Bench Press
// People sit on a bench and chat. Place props nearby to steer conversation.
// Score: longest sustained conversation across the day.

type Person = {
  id: number;
  name: string;
  likes: string[]; // prop tags they like
  dislikes: string[];
  sittingSince: number;
};

const NAMES = ["Mira", "Otto", "Sela", "Cyril", "Ines", "Bram", "Pia", "Roan", "Lila", "Niko"];
const TAGS = ["pigeon", "newspaper", "umbrella", "flowers", "coffee", "radio"];

export default function Game066_BenchPress() {
  const [props, setProps] = useState<{ tag: string; x: number; y: number }[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [conversation, setConversation] = useState(0); // current intensity 0..1
  const [bestStreak, setBestStreak] = useState(0);
  const [streak, setStreak] = useState(0);
  const [time, setTime] = useState(0);
  const [picked, setPicked] = useState<string>("pigeon");
  const benchY = 380;
  const lastTick = useRef(performance.now());

  useEffect(() => {
    let id: number;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - lastTick.current) / 1000);
      lastTick.current = t;
      tick(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  function tick(dt: number) {
    setTime((s) => s + dt);
    // people arrive
    if (Math.random() < dt * 0.4) spawnPerson();
    // remove people sitting too long if no conversation
    setPeople((ps) => ps.filter((p) => time - p.sittingSince < 25));

    setPeople((ps) => {
      // compute conversation intensity from props near bench and people likes
      let intensity = 0;
      if (ps.length >= 2) {
        for (const p of ps) {
          for (const pr of props) {
            if (Math.abs(pr.y - benchY) < 120) {
              if (p.likes.includes(pr.tag)) intensity += 0.5;
              if (p.dislikes.includes(pr.tag)) intensity -= 0.4;
            }
          }
        }
        intensity = Math.max(0, Math.min(1, 0.2 + intensity / Math.max(1, ps.length)));
      }
      setConversation(intensity);
      setStreak((st) => {
        const next = intensity > 0.4 ? st + dt : 0;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      return ps;
    });
  }

  function spawnPerson() {
    setPeople((ps) => {
      if (ps.length >= 4) return ps;
      const likes: string[] = [];
      const dislikes: string[] = [];
      for (const t of TAGS) {
        const r = Math.random();
        if (r < 0.3) likes.push(t);
        else if (r > 0.85) dislikes.push(t);
      }
      const id = Math.floor(Math.random() * 1000000);
      return [
        ...ps,
        { id, name: NAMES[Math.floor(Math.random() * NAMES.length)], likes, dislikes, sittingSince: time },
      ];
    });
  }

  function placeProp(e: MouseEvent<SVGSVGElement>) {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 900;
    const y = ((e.clientY - rect.top) / rect.height) * 540;
    setProps((p) => [...p.filter((q) => Math.hypot(q.x - x, q.y - y) > 30), { tag: picked, x, y }]);
  }

  function clearProps() {
    setProps([]);
  }

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Bench Press</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Select a prop, click to place it near the park bench. Props steer conversation: when matched well, the chat sustains. Aim for the longest streak.
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0", flexWrap: "wrap" }}>
        {TAGS.map((t) => (
          <button key={t} onClick={() => setPicked(t)} style={{ background: picked === t ? "#345" : "#223" }}>
            {t}
          </button>
        ))}
        <button onClick={clearProps} style={{ marginLeft: "auto" }}>Clear Props</button>
        <span>Streak: {streak.toFixed(1)}s | Best: {bestStreak.toFixed(1)}s</span>
      </div>
      <svg viewBox="0 0 900 540" width="100%" style={{ background: "#1d2c1c", borderRadius: 8 }} onClick={placeProp}>
        {/* ground */}
        <rect x={0} y={420} width={900} height={120} fill="#324d2d" />
        {/* bench */}
        <rect x={250} y={benchY} width={400} height={14} fill="#7a4d2a" />
        <rect x={260} y={benchY + 14} width={10} height={50} fill="#7a4d2a" />
        <rect x={630} y={benchY + 14} width={10} height={50} fill="#7a4d2a" />
        {/* props */}
        {props.map((p, i) => (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" fontSize={26}>
            {p.tag === "pigeon" ? "🕊" : p.tag === "newspaper" ? "📰" : p.tag === "umbrella" ? "☂" : p.tag === "flowers" ? "🌼" : p.tag === "coffee" ? "☕" : "📻"}
          </text>
        ))}
        {/* people */}
        {people.map((p, i) => {
          const x = 290 + i * 90;
          return (
            <g key={p.id}>
              <circle cx={x} cy={benchY - 20} r={16} fill="#f1d4a3" />
              <rect x={x - 14} y={benchY - 6} width={28} height={24} fill="#5b8def" />
              <text x={x} y={benchY - 36} textAnchor="middle" fontSize={11} fill="#fff">{p.name}</text>
            </g>
          );
        })}
        {/* speech bubble */}
        {people.length >= 2 && (
          <g>
            <rect x={400} y={260} width={100 * (0.5 + conversation)} height={30} rx={14} fill={`rgba(255,255,255,${0.2 + conversation * 0.7})`} />
            <text x={410} y={280} fontSize={14} fill="#000">{"..".repeat(Math.max(1, Math.round(conversation * 8)))}</text>
          </g>
        )}
      </svg>
      <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
        People: {people.length} · Conversation: {(conversation * 100).toFixed(0)}%
      </div>
    </div>
  );
}
