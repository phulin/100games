import { useEffect, useRef, useState } from "react";

// Game 52: Tide Pool
// Click creatures to feed/save them as the tide changes. Keep your pool alive.

type Creature = {
	id: number;
	type: "anemone" | "crab" | "fish" | "urchin";
	x: number;
	y: number;
	hunger: number; // 0..1, 1 = starving
	alive: boolean;
};

const W = 900;
const H = 600;
const TICK = 1000 / 30;

let CID = 0;

export default function TidePool() {
	const [creatures, setCreatures] = useState<Creature[]>(() => seed());
	const [tide, setTide] = useState(0.5); // 0=low,1=high
	const [score, setScore] = useState(0);
	const [time, setTime] = useState(60);
	const [over, setOver] = useState(false);
	const ref = useRef({ tideDir: 1 });

	function seed(): Creature[] {
		const out: Creature[] = [];
		for (let i = 0; i < 8; i++) {
			out.push({
				id: CID++,
				type: (["anemone", "crab", "fish", "urchin"] as const)[i % 4],
				x: 80 + Math.random() * (W - 160),
				y: 120 + Math.random() * (H - 200),
				hunger: 0.2 + Math.random() * 0.3,
				alive: true,
			});
		}
		return out;
	}

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			setTide((t) => {
				let nd = ref.current.tideDir;
				let nt = t + nd * 0.005;
				if (nt > 1) {
					nt = 1;
					nd = -1;
				}
				if (nt < 0) {
					nt = 0;
					nd = 1;
				}
				ref.current.tideDir = nd;
				return nt;
			});
			setCreatures((cs) =>
				cs.map((c) => {
					if (!c.alive) return c;
					// Hunger rises faster at low tide; fish prefer high, crabs prefer low
					const t = tide;
					let rate = 0.004;
					if (c.type === "fish") rate += (1 - t) * 0.012;
					if (c.type === "crab") rate += t * 0.008;
					if (c.type === "anemone") rate += (1 - t) * 0.01;
					if (c.type === "urchin") rate += 0.003;
					const h = c.hunger + rate;
					if (h >= 1) return { ...c, hunger: 1, alive: false };
					return { ...c, hunger: h };
				}),
			);
			setTime((t) => {
				const nt = t - TICK / 1000;
				if (nt <= 0) {
					setOver(true);
					return 0;
				}
				return nt;
			});
		}, TICK);
		return () => clearInterval(id);
	}, [tide, over]);

	useEffect(() => {
		// Occasionally spawn a new creature
		if (over) return;
		const id = setInterval(() => {
			setCreatures((cs) => {
				const alive = cs.filter((c) => c.alive).length;
				if (alive > 14) return cs;
				return [
					...cs,
					{
						id: CID++,
						type: (["anemone", "crab", "fish", "urchin"] as const)[Math.floor(Math.random() * 4)],
						x: 80 + Math.random() * (W - 160),
						y: 120 + Math.random() * (H - 200),
						hunger: 0.4,
						alive: true,
					},
				];
			});
		}, 2200);
		return () => clearInterval(id);
	}, [over]);

	function feed(c: Creature) {
		if (!c.alive || over) return;
		setCreatures((cs) => cs.map((x) => (x.id === c.id ? { ...x, hunger: Math.max(0, x.hunger - 0.5) } : x)));
		setScore((s) => s + 1);
	}

	function reset() {
		setCreatures(seed());
		setScore(0);
		setTime(60);
		setOver(false);
		setTide(0.5);
	}

	const aliveCount = creatures.filter((c) => c.alive).length;
	const waterLevel = 80 + tide * 80;

	return (
		<div style={{ background: "#04222b", color: "#cfeef5", padding: 12, fontFamily: "Verdana, sans-serif" }}>
			<h2 style={{ margin: 0 }}>Tide Pool</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Click creatures to feed them. Different species struggle at different tide levels. Survive 60 seconds.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4 }}>
				<div>Score: {score}</div>
				<div>Alive: {aliveCount}</div>
				<div>Tide: {(tide * 100).toFixed(0)}%</div>
				<div>Time: {time.toFixed(1)}s</div>
				{over && (
					<button onClick={reset} type="button" style={{ background: "#2b8a9c", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
						Restart
					</button>
				)}
			</div>
			<svg
				width={W}
				height={H}
				style={{ display: "block", marginTop: 8, borderRadius: 6, background: "linear-gradient(#08384a,#021820)" }}
			>
				<defs>
					<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="rgba(100,200,230,0.3)" />
						<stop offset="100%" stopColor="rgba(20,80,120,0.6)" />
					</linearGradient>
				</defs>
				<rect x={0} y={H - waterLevel - 200} width={W} height={waterLevel + 200} fill="url(#water)" />
				{/* Rocks */}
				{[150, 350, 600, 800].map((x, i) => (
					<ellipse key={i} cx={x} cy={H - 30} rx={70} ry={28} fill="#1a2a30" />
				))}
				{creatures.map((c) => {
					const color =
						c.type === "fish" ? "#ffb84d" : c.type === "crab" ? "#e25a3c" : c.type === "anemone" ? "#c060c0" : "#2a2a3a";
					const opacity = c.alive ? 1 : 0.25;
					const size = c.type === "urchin" ? 16 : 14;
					return (
						<g
							key={c.id}
							transform={`translate(${c.x},${c.y})`}
							onClick={() => feed(c)}
							style={{ cursor: c.alive ? "pointer" : "default", opacity }}
						>
							{c.type === "fish" && (
								<>
									<ellipse cx={0} cy={0} rx={size} ry={size * 0.55} fill={color} />
									<polygon points={`${-size},0 ${-size - 8},${-6} ${-size - 8},6`} fill={color} />
								</>
							)}
							{c.type === "crab" && (
								<>
									<ellipse cx={0} cy={0} rx={size} ry={size * 0.7} fill={color} />
									<circle cx={-size} cy={-4} r={4} fill={color} />
									<circle cx={size} cy={-4} r={4} fill={color} />
								</>
							)}
							{c.type === "anemone" && (
								<g>
									<circle cx={0} cy={0} r={size} fill={color} />
									{Array.from({ length: 8 }).map((_, k) => {
										const a = (k / 8) * Math.PI * 2;
										return <line key={k} x1={0} y1={0} x2={Math.cos(a) * (size + 8)} y2={Math.sin(a) * (size + 8)} stroke={color} strokeWidth={2} />;
									})}
								</g>
							)}
							{c.type === "urchin" && (
								<g>
									<circle cx={0} cy={0} r={size * 0.6} fill={color} />
									{Array.from({ length: 12 }).map((_, k) => {
										const a = (k / 12) * Math.PI * 2;
										return <line key={k} x1={0} y1={0} x2={Math.cos(a) * size} y2={Math.sin(a) * size} stroke="#444" strokeWidth={2} />;
									})}
								</g>
							)}
							<rect x={-size} y={size + 4} width={size * 2} height={3} fill="#fff3" />
							<rect x={-size} y={size + 4} width={size * 2 * (1 - c.hunger)} height={3} fill={c.hunger > 0.7 ? "#ff5a5a" : "#7be0a0"} />
						</g>
					);
				})}
			</svg>
		</div>
	);
}
