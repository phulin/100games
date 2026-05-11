import { useEffect, useRef, useState } from "react";

// Game 59: Star Cartographer
// A constellation pattern is shown. Click stars in the correct order to trace it.
// Connect in shortest-path-from-start order.

const W = 900;
const H = 600;

type Star = { x: number; y: number; r: number; idx: number };

function generatePattern(level: number): Star[] {
	const n = 4 + level;
	const stars: Star[] = [];
	const cx = W / 2;
	const cy = H / 2;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
		const r = 120 + Math.random() * 150;
		stars.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r: 5 + Math.random() * 3, idx: i });
	}
	return stars;
}

function generateDecoys(n: number, existing: Star[]): Star[] {
	const decoys: { x: number; y: number; r: number }[] = [];
	for (let i = 0; i < n; i++) {
		let x = 0;
		let y = 0;
		let tries = 0;
		do {
			x = 50 + Math.random() * (W - 100);
			y = 50 + Math.random() * (H - 100);
			tries++;
		} while (tries < 20 && existing.some((s) => Math.hypot(s.x - x, s.y - y) < 35));
		decoys.push({ x, y, r: 2 + Math.random() * 3 });
	}
	return decoys.map((d, i) => ({ ...d, idx: 1000 + i }));
}

export default function StarCartographer() {
	const [level, setLevel] = useState(1);
	const [pattern, setPattern] = useState<Star[]>(() => generatePattern(1));
	const [decoys, setDecoys] = useState<Star[]>(() => generateDecoys(30, pattern));
	const [shown, setShown] = useState(true);
	const [progress, setProgress] = useState(0);
	const [score, setScore] = useState(0);
	const [msg, setMsg] = useState("");
	const twinkleRef = useRef(0);

	useEffect(() => {
		setShown(true);
		setProgress(0);
		setMsg("");
		const id = setTimeout(() => setShown(false), 3500);
		return () => clearTimeout(id);
	}, [pattern]);

	useEffect(() => {
		const id = setInterval(() => {
			twinkleRef.current = (twinkleRef.current + 1) % 1000;
		}, 200);
		return () => clearInterval(id);
	}, []);

	function click(s: Star) {
		if (shown) return;
		if (s.idx >= 1000) {
			setMsg("That's not part of the constellation. Try again from start.");
			setProgress(0);
			return;
		}
		if (s.idx === progress) {
			const np = progress + 1;
			if (np >= pattern.length) {
				setScore((sc) => sc + level * 20);
				setMsg("Constellation traced!");
				const lv = level + 1;
				setTimeout(() => {
					setLevel(lv);
					const np2 = generatePattern(lv);
					setPattern(np2);
					setDecoys(generateDecoys(30 + lv * 3, np2));
				}, 1200);
			} else {
				setProgress(np);
			}
		} else {
			setMsg("Wrong star. Restart from index 0.");
			setProgress(0);
		}
	}

	function reveal() {
		setShown(true);
		setTimeout(() => setShown(false), 1800);
	}

	return (
		<div style={{ background: "#02030c", color: "#dde6ff", padding: 14, fontFamily: "Cambria, serif" }}>
			<h2 style={{ margin: 0 }}>Star Cartographer</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				A constellation is shown briefly. Click the stars in order (start → end) to trace it. Avoid decoy stars.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4 }}>
				<div>Level: {level}</div>
				<div>Stars: {progress}/{pattern.length}</div>
				<div>Score: {score}</div>
				<button type="button" onClick={reveal} style={{ background: "#4a5a8a", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					Peek (briefly)
				</button>
				<div style={{ color: "#ffe07a" }}>{msg}</div>
			</div>
			<svg
				width={W}
				height={H}
				style={{
					display: "block",
					marginTop: 8,
					background: "radial-gradient(ellipse at 30% 20%, #1a1a3a, #02030c 70%)",
					borderRadius: 6,
				}}
			>
				{/* Background stars decoration */}
				{Array.from({ length: 80 }).map((_, i) => (
					<circle key={`bg${i}`} cx={(i * 37) % W} cy={(i * 71) % H} r={0.7} fill="#fff" opacity={0.3 + ((i + twinkleRef.current) % 5) * 0.1} />
				))}
				{/* Pattern preview lines */}
				{shown &&
					pattern.slice(1).map((s, i) => (
						<line
							key={`p${i}`}
							x1={pattern[i].x}
							y1={pattern[i].y}
							x2={s.x}
							y2={s.y}
							stroke="#7ad6ff"
							strokeWidth={1.5}
							strokeDasharray="4 4"
							opacity={0.7}
						/>
					))}
				{/* Drawn lines */}
				{Array.from({ length: progress - 1 }).map((_, i) => (
					<line key={`d${i}`} x1={pattern[i].x} y1={pattern[i].y} x2={pattern[i + 1].x} y2={pattern[i + 1].y} stroke="#ffd07a" strokeWidth={2} />
				))}
				{decoys.map((d) => (
					<circle key={`dec${d.idx}`} cx={d.x} cy={d.y} r={d.r} fill="#fff" opacity={0.7} onClick={() => click(d)} style={{ cursor: shown ? "default" : "pointer" }} />
				))}
				{pattern.map((s) => {
					const done = s.idx < progress;
					const next = s.idx === progress;
					return (
						<g key={`s${s.idx}`} onClick={() => click(s)} style={{ cursor: shown ? "default" : "pointer" }}>
							<circle cx={s.x} cy={s.y} r={s.r + 8} fill={shown || done || next ? "#ffd07a" : "#fff"} opacity={0.15} />
							<circle cx={s.x} cy={s.y} r={s.r + 2} fill={done ? "#ffd07a" : next ? "#7ad6ff" : "#fff"} />
							{shown && <text x={s.x + 8} y={s.y - 6} fill="#7ad6ff" fontSize={12}>{s.idx}</text>}
						</g>
					);
				})}
			</svg>
		</div>
	);
}
