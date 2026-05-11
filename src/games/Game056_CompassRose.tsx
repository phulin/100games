import { useEffect, useState } from "react";

// Game 56: Compass Rose
// You're blindfolded! Each round you're given a starting heading and a sequence of N/E/S/W steps.
// Mentally track your position and click the final tile.

const GRID = 7;

function rngSeed(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}

type Round = {
	start: { x: number; y: number };
	steps: ("N" | "E" | "S" | "W")[];
	end: { x: number; y: number };
};

function generate(level: number, seed: number): Round {
	const rng = rngSeed(seed);
	const sx = Math.floor(rng() * GRID);
	const sy = Math.floor(rng() * GRID);
	let x = sx;
	let y = sy;
	const stepCount = 3 + level;
	const steps: ("N" | "E" | "S" | "W")[] = [];
	for (let i = 0; i < stepCount; i++) {
		const opts: ("N" | "E" | "S" | "W")[] = [];
		if (y > 0) opts.push("N");
		if (y < GRID - 1) opts.push("S");
		if (x > 0) opts.push("W");
		if (x < GRID - 1) opts.push("E");
		const dir = opts[Math.floor(rng() * opts.length)];
		steps.push(dir);
		if (dir === "N") y--;
		if (dir === "S") y++;
		if (dir === "E") x++;
		if (dir === "W") x--;
	}
	return { start: { x: sx, y: sy }, steps, end: { x, y } };
}

export default function CompassRose() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
	const [level, setLevel] = useState(1);
	const [round, setRound] = useState<Round>(() => generate(1, seed));
	const [showing, setShowing] = useState(true);
	const [stepIdx, setStepIdx] = useState(0);
	const [score, setScore] = useState(0);
	const [msg, setMsg] = useState("");
	const [picked, setPicked] = useState<{ x: number; y: number } | null>(null);

	useEffect(() => {
		setShowing(true);
		setStepIdx(0);
		setPicked(null);
		setMsg("");
		const total = round.steps.length;
		let i = 0;
		const id = setInterval(() => {
			i++;
			setStepIdx(i);
			if (i >= total) {
				clearInterval(id);
				setTimeout(() => setShowing(false), 700);
			}
		}, 700);
		return () => clearInterval(id);
	}, [round]);

	function pick(x: number, y: number) {
		if (showing || picked) return;
		setPicked({ x, y });
		if (x === round.end.x && y === round.end.y) {
			setScore((s) => s + level * 10);
			setMsg("Correct!");
			setTimeout(() => {
				const lv = level + 1;
				setLevel(lv);
				const ns = seed + 1;
				setSeed(ns);
				setRound(generate(lv, ns));
			}, 900);
		} else {
			setMsg(`Wrong! Target was (${round.end.x},${round.end.y}). Level reset.`);
			setTimeout(() => {
				setLevel(1);
				const ns = seed + 1;
				setSeed(ns);
				setRound(generate(1, ns));
			}, 1500);
		}
	}

	const size = 60;
	const W = GRID * size;
	const H = GRID * size;

	const arrow: Record<string, string> = { N: "↑", E: "→", S: "↓", W: "←" };

	return (
		<div style={{ background: "#1b2230", color: "#eaeefa", padding: 16, fontFamily: "'Lucida Console', monospace" }}>
			<h2 style={{ margin: 0 }}>Compass Rose</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Watch the start tile, then track the arrow directions in your head. Click where you ended up.
			</div>
			<div style={{ display: "flex", gap: 18, marginTop: 6 }}>
				<div>Level: {level}</div>
				<div>Score: {score}</div>
				<div style={{ color: "#ffd07a" }}>{msg}</div>
			</div>
			<div style={{ display: "flex", gap: 20, marginTop: 12 }}>
				<svg width={W} height={H} style={{ background: "#0d121b", borderRadius: 6 }}>
					{Array.from({ length: GRID }).map((_, y) =>
						Array.from({ length: GRID }).map((__, x) => {
							const isStart = showing && x === round.start.x && y === round.start.y;
							const isPicked = picked && picked.x === x && picked.y === y;
							const isEnd = picked && x === round.end.x && y === round.end.y;
							let fill = "#1b2939";
							if (isStart) fill = "#ffd07a";
							if (isPicked) fill = isEnd ? "#7be0a0" : "#ff5e7e";
							else if (isEnd && picked) fill = "#7be0a0";
							return (
								<rect
									key={`${x}-${y}`}
									x={x * size + 2}
									y={y * size + 2}
									width={size - 4}
									height={size - 4}
									fill={fill}
									stroke="#2a3a55"
									onClick={() => pick(x, y)}
									style={{ cursor: showing ? "default" : "pointer" }}
								/>
							);
						}),
					)}
				</svg>
				<div style={{ minWidth: 200 }}>
					<div style={{ marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
						{showing ? `Step ${stepIdx}/${round.steps.length}` : "Click your destination"}
					</div>
					<div style={{ fontSize: 56, textAlign: "center", height: 90 }}>
						{showing && stepIdx > 0 ? arrow[round.steps[stepIdx - 1]] : ""}
					</div>
					<div style={{ opacity: 0.6, fontSize: 12 }}>Memorize, don't follow on the board!</div>
				</div>
			</div>
		</div>
	);
}
