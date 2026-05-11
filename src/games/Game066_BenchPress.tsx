import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";

// Game 66 - Bench Press
// People sit on a bench and chat. Place props nearby to steer conversation.
// Score: longest sustained conversation across the day.

type Person = {
  id: number;
  name: string;
  likes: string[];
  dislikes: string[];
  sittingSince: number;
  px: number;
  tx: number;
};

type PropItem = { tag: string; x: number; y: number };

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

const SYL_A = ["mi", "ot", "se", "cy", "in", "br", "pi", "ro", "li", "ni", "ka", "to", "ve", "al", "fre"];
const SYL_B = ["ra", "to", "la", "ril", "es", "am", "a", "an", "la", "ko", "ya", "rin", "no", "do", "via"];

function genName(rand: () => number) {
  const a = SYL_A[Math.floor(rand() * SYL_A.length)];
  const b = SYL_B[Math.floor(rand() * SYL_B.length)];
  return (a + b).replace(/^./, (c) => c.toUpperCase());
}

const TAG_LIB: { tag: string; icon: string }[] = [
  { tag: "pigeon", icon: "🕊" },
  { tag: "newspaper", icon: "📰" },
  { tag: "umbrella", icon: "☂" },
  { tag: "flowers", icon: "🌼" },
  { tag: "coffee", icon: "☕" },
  { tag: "radio", icon: "📻" },
  { tag: "balloon", icon: "🎈" },
  { tag: "book", icon: "📖" },
  { tag: "guitar", icon: "🎸" },
  { tag: "kite", icon: "🪁" },
  { tag: "lantern", icon: "🏮" },
  { tag: "icecream", icon: "🍦" },
];

function getTagsForSeed(seed: number) {
  const r = mulberry32(seed ^ 0xa17e);
  const pool = TAG_LIB.slice();
  const out: { tag: string; icon: string }[] = [];
  while (out.length < 6 && pool.length) {
    out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  }
  return out;
}

const BENCH_Y = 380;

export default function Game066_BenchPress() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const TAGS = useMemo(() => getTagsForSeed(seed), [seed]);
  const TAG_NAMES = useMemo(() => TAGS.map((t) => t.tag), [TAGS]);
  const ICONS = useMemo<Record<string, string>>(
    () => Object.fromEntries(TAGS.map((t) => [t.tag, t.icon])),
    [TAGS],
  );

  const [props, setProps] = useState<PropItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [conversation, setConversation] = useState(0);
  const [bestStreak, setBestStreak] = useState(() => {
    if (typeof window === "undefined") return 0;
    const v = localStorage.getItem("g66_best");
    return v ? parseFloat(v) : 0;
  });
  const [streak, setStreak] = useState(0);
  const [time, setTime] = useState(0);
  const [picked, setPicked] = useState<string>(TAG_NAMES[0] ?? "pigeon");
  const [wind, setWind] = useState(0);
  const lastTick = useRef(performance.now());
  const randRef = useRef(mulberry32(seed));
  const timeRef = useRef(0);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  const dayLen = 60;
  const dayPhase = (time % dayLen) / dayLen;

  useEffect(() => {
    randRef.current = mulberry32(seed);
    setProps([]);
    setPeople([]);
    setStreak(0);
    setConversation(0);
    setTime(0);
    timeRef.current = 0;
    setPicked(TAG_NAMES[0]);
  }, [seed, TAG_NAMES]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ensureAudio() {
    if (audioRef.current) return audioRef.current;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 600;
      filter.Q.value = 1.5;
      noise.connect(filter).connect(gain);
      noise.start();
      audioRef.current = { ctx, gain };
      return audioRef.current;
    } catch {
      return null;
    }
  }

  useEffect(() => () => {
    try {
      audioRef.current?.ctx.close();
    } catch {}
  }, []);

  function tick(dt: number) {
    timeRef.current += dt;
    const tNow = timeRef.current;
    setTime(tNow);
    setWind((w) => {
      const r = randRef.current();
      return Math.max(-1, Math.min(1, w + (r - 0.5) * dt * 0.3));
    });
    if (randRef.current() < dt * 0.5) spawnPerson(tNow);

    setPeople((ps) => {
      const filtered = ps.filter((p) => tNow - p.sittingSince < 28);
      return filtered.map((p, i) => {
        const seatX = 290 + i * 90;
        const px = p.px + (seatX - p.px) * Math.min(1, dt * 2);
        return { ...p, tx: seatX, px };
      });
    });

    setPeople((ps) => {
      let intensity = 0;
      if (ps.length >= 2) {
        for (const p of ps) {
          for (const pr of props) {
            const effX = pr.x + wind * 30;
            const dist = Math.hypot(effX - p.px, pr.y - BENCH_Y);
            if (dist < 160) {
              const w = 1 - dist / 160;
              if (p.likes.includes(pr.tag)) intensity += 0.55 * w;
              if (p.dislikes.includes(pr.tag)) intensity -= 0.45 * w;
            }
          }
        }
        intensity = Math.max(0, Math.min(1, 0.22 + intensity / Math.max(1, ps.length)));
      }
      setConversation(intensity);
      const a = audioRef.current;
      if (a) a.gain.gain.setTargetAtTime(intensity * 0.18, a.ctx.currentTime, 0.15);
      setStreak((st) => {
        const next = intensity > 0.4 ? st + dt : 0;
        setBestStreak((b) => {
          const nb = Math.max(b, next);
          if (nb > b) {
            try {
              localStorage.setItem("g66_best", String(nb));
            } catch {}
          }
          return nb;
        });
        return next;
      });
      return ps;
    });
  }

  function spawnPerson(tNow: number) {
    setPeople((ps) => {
      if (ps.length >= 4) return ps;
      const r = randRef.current;
      const likes: string[] = [];
      const dislikes: string[] = [];
      for (const t of TAG_NAMES) {
        const rv = r();
        if (rv < 0.32) likes.push(t);
        else if (rv > 0.86) dislikes.push(t);
      }
      const id = Math.floor(r() * 1e9);
      const seatX = 290 + ps.length * 90;
      const fromLeft = r() < 0.5;
      return [
        ...ps,
        {
          id,
          name: genName(r),
          likes,
          dislikes,
          sittingSince: tNow,
          px: fromLeft ? -30 : 930,
          tx: seatX,
        },
      ];
    });
  }

  function placeProp(e: MouseEvent<SVGSVGElement>) {
    const a = ensureAudio();
    if (a && a.ctx.state === "suspended") a.ctx.resume();
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 900;
    const y = ((e.clientY - rect.top) / rect.height) * 540;
    setProps((p) => [...p.filter((q) => Math.hypot(q.x - x, q.y - y) > 30), { tag: picked, x, y }]);
    if (a) {
      const osc = a.ctx.createOscillator();
      const g = a.ctx.createGain();
      osc.frequency.value = 600 + Math.random() * 200;
      g.gain.setValueAtTime(0.15, a.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + 0.18);
      osc.connect(g).connect(a.ctx.destination);
      osc.start();
      osc.stop(a.ctx.currentTime + 0.2);
    }
  }

  function clearProps() {
    setProps([]);
  }

  const sunAngle = Math.PI * dayPhase;
  const sunX = 100 + 700 * dayPhase;
  const sunY = 80 + Math.cos(sunAngle - Math.PI / 2) * -40;
  const skyR = Math.floor(20 + Math.sin(sunAngle) * 90);
  const skyG = Math.floor(30 + Math.sin(sunAngle) * 100);
  const skyB = Math.floor(40 + Math.sin(sunAngle) * 70);
  const skyFill = `rgb(${skyR}, ${skyG}, ${skyB})`;

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Bench Press</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Pick a prop and click to place it. Wind drifts props' effective position. Sustain conversation across the day.
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0", flexWrap: "wrap", alignItems: "center" }}>
        {TAGS.map((t) => (
          <button key={t.tag} onClick={() => setPicked(t.tag)} style={{ background: picked === t.tag ? "#345" : "#223" }}>
            {t.icon} {t.tag}
          </button>
        ))}
        <button onClick={clearProps}>Clear</button>
        <button onClick={() => setSeed((s) => s + 1)}>New Day</button>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>
          Streak: {streak.toFixed(1)}s | Best: {bestStreak.toFixed(1)}s | Wind: {wind.toFixed(2)}
        </span>
      </div>
      <svg viewBox="0 0 900 540" width="100%" style={{ background: skyFill, borderRadius: 8 }} onClick={placeProp}>
        <circle cx={sunX} cy={sunY + 40} r={28} fill="rgba(255,220,140,0.8)" />
        <rect x={0} y={420} width={900} height={120} fill="#324d2d" />
        <rect x={250} y={BENCH_Y} width={400} height={14} fill="#7a4d2a" />
        <rect x={260} y={BENCH_Y + 14} width={10} height={50} fill="#7a4d2a" />
        <rect x={630} y={BENCH_Y + 14} width={10} height={50} fill="#7a4d2a" />
        <line x1={50} y1={120} x2={50 + wind * 40} y2={120} stroke="#fff" strokeWidth={2} />
        {props.map((p, i) => (
          <text key={i} x={p.x + wind * 30} y={p.y} textAnchor="middle" fontSize={26}>
            {ICONS[p.tag] ?? "•"}
          </text>
        ))}
        {people.map((p) => (
          <g key={p.id}>
            <circle cx={p.px} cy={BENCH_Y - 20} r={16} fill="#f1d4a3" />
            <rect x={p.px - 14} y={BENCH_Y - 6} width={28} height={24} fill="#5b8def" />
            <text x={p.px} y={BENCH_Y - 36} textAnchor="middle" fontSize={11} fill="#fff">{p.name}</text>
          </g>
        ))}
        {people.length >= 2 && (
          <g>
            <rect x={400} y={260} width={100 * (0.5 + conversation)} height={30} rx={14} fill={`rgba(255,255,255,${0.2 + conversation * 0.7})`} />
            <text x={410} y={280} fontSize={14} fill="#000">{"..".repeat(Math.max(1, Math.round(conversation * 8)))}</text>
          </g>
        )}
      </svg>
      <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
        People: {people.length} · Conversation: {(conversation * 100).toFixed(0)}% · Time: {time.toFixed(0)}s
      </div>
    </div>
  );
}
