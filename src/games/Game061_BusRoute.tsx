import { useMemo, useState } from "react";

// Game 61 - Bus Route
// Plan a single bus route across a city of stops with passenger demands.

type Stop = {
  id: number;
  x: number;
  y: number;
  passengers: number; // waiting
  dest: number; // destination stop id
};

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function generateCity(seed: number): Stop[] {
  const rand = seededRand(seed);
  const n = 10;
  const stops: Stop[] = [];
  for (let i = 0; i < n; i++) {
    stops.push({
      id: i,
      x: 60 + rand() * 780,
      y: 60 + rand() * 480,
      passengers: 1 + Math.floor(rand() * 6),
      dest: 0,
    });
  }
  for (let i = 0; i < n; i++) {
    let d = Math.floor(rand() * n);
    if (d === i) d = (d + 1) % n;
    stops[i].dest = d;
  }
  return stops;
}

function dist(a: Stop, b: Stop) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function Game061_BusRoute() {
  const [seed, setSeed] = useState(todaySeed());
  const stops = useMemo(() => generateCity(seed), [seed]);
  const [route, setRoute] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const totalPassengers = stops.reduce((a, s) => a + s.passengers, 0);

  function toggle(id: number) {
    if (submitted) return;
    setRoute((r) => {
      if (r.includes(id)) return r.filter((x) => x !== id);
      return [...r, id];
    });
  }

  function score() {
    // Time = total distance in route + 8s per stop
    let time = 0;
    for (let i = 1; i < route.length; i++) time += dist(stops[route[i - 1]], stops[route[i]]);
    time = time / 60; // scale
    time += route.length * 8;

    // Served passengers: a passenger is served if their stop is in route AND their dest also in route AND dest comes after pickup
    let served = 0;
    for (const id of route) {
      const s = stops[id];
      const pickupIdx = route.indexOf(id);
      const destIdx = route.indexOf(s.dest);
      if (destIdx > pickupIdx) served += s.passengers;
    }
    const unserved = totalPassengers - served;
    const reputation = 100 - unserved * 5 - Math.floor(time / 3);
    return { time: Math.round(time), served, unserved, reputation };
  }

  const result = score();

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", color: "#eee", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: "8px 0" }}>Bus Route</h2>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
        Click stops in pickup order. Passengers want to go to their destination stop (arrow). Each stop costs time; unserved passengers cost reputation. Submit when ready.
      </div>
      <svg width="100%" viewBox="0 0 900 560" style={{ background: "#16202b", borderRadius: 8 }}>
        {/* destination arrows */}
        {stops.map((s) => {
          const d = stops[s.dest];
          return (
            <line key={`l-${s.id}`} x1={s.x} y1={s.y} x2={d.x} y2={d.y} stroke="#314156" strokeWidth={1} strokeDasharray="3 4" />
          );
        })}
        {/* route */}
        {route.map((id, i) => {
          if (i === 0) return null;
          const a = stops[route[i - 1]];
          const b = stops[id];
          return <line key={`r-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f4c542" strokeWidth={3} />;
        })}
        {stops.map((s) => {
          const order = route.indexOf(s.id);
          const fill = order >= 0 ? "#f4c542" : "#5b8def";
          return (
            <g key={s.id} onClick={() => toggle(s.id)} style={{ cursor: "pointer" }}>
              <circle cx={s.x} cy={s.y} r={18} fill={fill} stroke="#fff" strokeWidth={2} />
              <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#000">
                {s.passengers}
              </text>
              {order >= 0 && (
                <text x={s.x + 22} y={s.y - 14} fontSize={11} fill="#f4c542">
                  #{order + 1}
                </text>
              )}
              <text x={s.x} y={s.y + 32} textAnchor="middle" fontSize={10} fill="#aab">
                →{s.dest}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setSubmitted(true)} disabled={submitted || route.length < 2} style={{ padding: "6px 14px" }}>
          Submit Route
        </button>
        <button
          onClick={() => {
            setRoute([]);
            setSubmitted(false);
            setSeed((s) => s + 1);
          }}
          style={{ padding: "6px 14px" }}
        >
          New City
        </button>
        <button onClick={() => setRoute([])} style={{ padding: "6px 14px" }} disabled={submitted}>
          Clear
        </button>
        <span style={{ marginLeft: "auto" }}>
          Stops: {route.length} | Time: {result.time}m | Served: {result.served}/{totalPassengers}
        </span>
      </div>
      {submitted && (
        <div style={{ marginTop: 10, padding: 10, background: "#1f2c3a", borderRadius: 6 }}>
          <b>Reputation: {result.reputation}</b> — {result.served} passengers delivered, {result.unserved} stranded, route {result.time} minutes.
        </div>
      )}
    </div>
  );
}
