import { useEffect, useMemo, useRef, useState } from "react";

// Static Symphony — match a target audio loop by toggling cells in a sequencer grid.

const STEPS = 16;
const PITCHES = 8;
const NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]; // C4..C5

function makeTarget(seed: number, density = 0.18): boolean[][] {
	let s = seed;
	const r = () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
	const grid: boolean[][] = [];
	for (let p = 0; p < PITCHES; p++) {
		grid.push(Array.from({ length: STEPS }, () => r() < density));
	}
	return grid;
}

export default function Game045_StaticSymphony() {
	const [target] = useState(() => makeTarget(42));
	const [user, setUser] = useState<boolean[][]>(() =>
		Array.from({ length: PITCHES }, () => Array.from({ length: STEPS }, () => false))
	);
	const [step, setStep] = useState(0);
	const [playing, setPlaying] = useState<"user" | "target" | "off">("off");
	const [bpm, setBpm] = useState(120);
	const audioCtx = useRef<AudioContext | null>(null);

	const ensureCtx = () => {
		if (!audioCtx.current) {
			audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
		}
		return audioCtx.current;
	};

	const playStep = (grid: boolean[][], s: number) => {
		const ctx = ensureCtx();
		const stepLen = 60 / bpm / 4; // 16th notes
		for (let p = 0; p < PITCHES; p++) {
			if (grid[p][s]) {
				const o = ctx.createOscillator();
				const g = ctx.createGain();
				o.frequency.value = NOTES[p];
				o.type = "triangle";
				g.gain.setValueAtTime(0.0001, ctx.currentTime);
				g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
				g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + stepLen * 0.9);
				o.connect(g).connect(ctx.destination);
				o.start();
				o.stop(ctx.currentTime + stepLen);
			}
		}
	};

	useEffect(() => {
		if (playing === "off") return;
		const grid = playing === "user" ? user : target;
		const intervalMs = (60 / bpm / 4) * 1000;
		const id = window.setInterval(() => {
			setStep((s) => {
				const ns = (s + 1) % STEPS;
				playStep(grid, ns);
				return ns;
			});
		}, intervalMs);
		return () => clearInterval(id);
	}, [playing, user, target, bpm]);

	const toggle = (p: number, s: number) => {
		setUser((u) => u.map((row, pp) => row.map((v, ss) => (pp === p && ss === s ? !v : v))));
	};

	// score: exact-cell match percentage
	const score = useMemo(() => {
		let correct = 0;
		let total = 0;
		for (let p = 0; p < PITCHES; p++) {
			for (let s = 0; s < STEPS; s++) {
				if (target[p][s] || user[p][s]) {
					total++;
					if (target[p][s] === user[p][s]) correct++;
				}
			}
		}
		return total === 0 ? 100 : Math.round((correct / total) * 100);
	}, [target, user]);

	const cellSize = 32;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#0a0e14",
				color: "#dcd",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<h2 style={{ margin: 4 }}>Static Symphony</h2>
			<div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>
				Listen to the target, then toggle cells to reproduce it. By ear only.
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
				<button
					type="button"
					onClick={() => {
						setPlaying("target");
						setStep(-1);
					}}
					style={btn}
				>
					▶ Play target
				</button>
				<button
					type="button"
					onClick={() => {
						setPlaying("user");
						setStep(-1);
					}}
					style={btn}
				>
					▶ Play mine
				</button>
				<button type="button" onClick={() => setPlaying("off")} style={btn}>
					◼ Stop
				</button>
				<label style={{ alignSelf: "center", fontSize: 12 }}>
					BPM:&nbsp;
					<input
						type="number"
						value={bpm}
						onChange={(e) => setBpm(parseInt(e.target.value || "120", 10))}
						style={{ width: 50 }}
					/>
				</label>
				<div style={{ alignSelf: "center", marginLeft: 12 }}>Match: {score}%</div>
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: `repeat(${STEPS}, ${cellSize}px)`,
					gap: 2,
					background: "#1a1f28",
					padding: 6,
				}}
			>
				{Array.from({ length: PITCHES }).map((_, pRev) => {
					const p = PITCHES - 1 - pRev;
					return Array.from({ length: STEPS }).map((_, s) => {
						const on = user[p][s];
						const isStep = step === s && playing !== "off";
						return (
							<div
								key={`${p}-${s}`}
								onClick={() => toggle(p, s)}
								style={{
									width: cellSize,
									height: cellSize,
									background: on
										? `hsl(${200 + p * 12} 70% ${isStep ? 70 : 50}%)`
										: isStep
											? "#3a4150"
											: s % 4 === 0
												? "#252a35"
												: "#1d2230",
									cursor: "pointer",
									borderRadius: 3,
								}}
							/>
						);
					});
				})}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "6px 12px",
	borderRadius: 6,
	cursor: "pointer",
};
