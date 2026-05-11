import { useEffect, useRef, useState } from "react";

// Game 57: Glass Garden
// Grow delicate glass flowers by clicking to water. Don't over-water (they shatter), don't under-water (they wilt).

const W = 900;
const H = 600;

type Plant = {
	id: number;
	x: number;
	y: number;
	water: number; // 0..1.5 — sweet spot 0.4..0.9
	growth: number; // 0..1
	alive: boolean;
	hue: number;
};

let PID = 0;

export default function GlassGarden() {
	const [plants, setPlants] = useState<Plant[]>(() => seed());
	const [score, setScore] = useState(0);
	const [time, setTime] = useState(60);
	const [over, setOver] = useState(false);
	const rafRef = useRef(0);

	function seed(): Plant[] {
		return Array.from({ length: 6 }, (_, i) => ({
			id: PID++,
			x: 100 + i * 130,
			y: H - 120,
			water: 0.6,
			growth: 0.05,
			alive: true,
			hue: Math.floor(Math.random() * 360),
		}));
	}

	useEffect(() => {
		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(60, now - last) / 1000;
			last = now;
			if (!over) {
				setPlants((ps) =>
					ps.map((p) => {
						if (!p.alive) return p;
						// Water drains
						const nw = p.water - dt * 0.06;
						let nl: boolean = p.alive;
						let ng = p.growth;
						if (nw < 0.1) nl = false;
						else if (nw > 1.3) nl = false;
						else if (nw >= 0.4 && nw <= 0.9) ng = Math.min(1, p.growth + dt * 0.04);
						return { ...p, water: nw, growth: ng, alive: nl };
					}),
				);
				setTime((t) => {
					const nt = t - dt;
					if (nt <= 0) {
						setOver(true);
						return 0;
					}
					return nt;
				});
			}
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, [over]);

	useEffect(() => {
		// Score from fully grown plants
		const fully = plants.filter((p) => p.alive && p.growth >= 1).length;
		setScore(fully);
	}, [plants]);

	function water(id: number) {
		if (over) return;
		setPlants((ps) =>
			ps.map((p) => (p.id === id && p.alive ? { ...p, water: Math.min(1.5, p.water + 0.15) } : p)),
		);
	}

	function reset() {
		setPlants(seed());
		setScore(0);
		setTime(60);
		setOver(false);
	}

	return (
		<div style={{ background: "linear-gradient(#1a0f2a,#3a1a4a)", color: "#fde2ff", padding: 14, minHeight: 600, fontFamily: "Palatino, serif" }}>
			<h2 style={{ margin: 0 }}>Glass Garden</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Click a flower to water it. Keep water in the green zone (40-90%) so it grows. Too dry or too wet shatters it.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4 }}>
				<div>Fully bloomed: {score}</div>
				<div>Time: {time.toFixed(1)}s</div>
				{over && (
					<button type="button" onClick={reset} style={{ background: "#c060c0", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
						Restart
					</button>
				)}
			</div>
			<svg width={W} height={H} style={{ display: "block", marginTop: 8, background: "radial-gradient(ellipse at 50% 90%, #4a2266, #1a0a2a)", borderRadius: 6 }}>
				{/* Ground */}
				<rect x={0} y={H - 60} width={W} height={60} fill="#0a0414" />
				{plants.map((p) => {
					const stemH = 60 + p.growth * 200;
					const flowerR = 8 + p.growth * 28;
					const zone = p.water >= 0.4 && p.water <= 0.9;
					const danger = p.water < 0.2 || p.water > 1.1;
					return (
						<g key={p.id} onClick={() => water(p.id)} style={{ cursor: p.alive ? "pointer" : "default" }}>
							{/* Stem */}
							<line x1={p.x} y1={H - 60} x2={p.x} y2={H - 60 - stemH} stroke={p.alive ? "#7be0a0" : "#444"} strokeWidth={4} />
							{/* Petals */}
							{p.alive && (
								<g transform={`translate(${p.x},${H - 60 - stemH})`}>
									{Array.from({ length: 6 }).map((_, k) => {
										const a = (k / 6) * Math.PI * 2;
										return (
											<ellipse
												key={k}
												cx={Math.cos(a) * flowerR * 0.7}
												cy={Math.sin(a) * flowerR * 0.7}
												rx={flowerR * 0.6}
												ry={flowerR * 0.4}
												fill={`hsla(${p.hue},80%,70%,0.7)`}
												stroke={`hsl(${p.hue},80%,85%)`}
												transform={`rotate(${(a * 180) / Math.PI})`}
											/>
										);
									})}
									<circle r={flowerR * 0.35} fill={`hsl(${(p.hue + 60) % 360},90%,75%)`} />
								</g>
							)}
							{!p.alive && (
								<g transform={`translate(${p.x},${H - 90})`}>
									{Array.from({ length: 5 }).map((_, k) => (
										<polygon key={k} points={`0,0 ${-8 + k * 4},${15 + k * 3} ${8 - k * 4},${20 + k * 3}`} fill="#333" opacity={0.5} />
									))}
								</g>
							)}
							{/* Water gauge */}
							<rect x={p.x - 30} y={H - 50} width={60} height={8} fill="#0006" />
							<rect x={p.x - 30 + 60 * 0.4} y={H - 50} width={60 * 0.5} height={8} fill="#0a4030" />
							<rect x={p.x - 30} y={H - 50} width={60 * Math.min(1, p.water / 1.5)} height={8} fill={danger ? "#ff5e7e" : zone ? "#5eff8d" : "#ffd75e"} />
							{/* Growth */}
							<rect x={p.x - 30} y={H - 38} width={60} height={4} fill="#0006" />
							<rect x={p.x - 30} y={H - 38} width={60 * p.growth} height={4} fill="#c0a8ff" />
						</g>
					);
				})}
			</svg>
		</div>
	);
}
