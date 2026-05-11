import { useEffect, useMemo, useRef, useState } from "react";

// Static Symphony — reproduce a procedurally-generated audio loop by ear.

const STEPS = 16;
const PITCHES = 8;
const NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

type Voice = "lead" | "bass" | "drum";

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function todaySeed(): number {
	const d = new Date();
	return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function makeTarget(seed: number, density: number): boolean[][] {
	const r = mulberry32(seed);
	const grid: boolean[][] = [];
	for (let p = 0; p < PITCHES; p++) {
		const row: boolean[] = [];
		const rowWeight = p === 0 || p === 4 || p === 7 ? 1.4 : p === 2 ? 1.2 : 0.85;
		for (let s = 0; s < STEPS; s++) {
			const beat = s % 4 === 0 ? 1.6 : s % 2 === 0 ? 1.1 : 0.7;
			row.push(r() < density * rowWeight * beat);
		}
		grid.push(row);
	}
	return grid;
}

type Difficulty = "easy" | "medium" | "hard";
const DIFF_CFG: Record<Difficulty, { density: number; label: string }> = {
	easy: { density: 0.1, label: "sparse" },
	medium: { density: 0.18, label: "balanced" },
	hard: { density: 0.28, label: "dense" },
};

function voiceForPitch(p: number): Voice {
	if (p <= 1) return "bass";
	if (p >= 6) return "drum";
	return "lead";
}

export default function Game045_StaticSymphony() {
	const [diff, setDiff] = useState<Difficulty>("medium");
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [mode, setMode] = useState<"daily" | "random">("random");
	const target = useMemo(() => makeTarget(seed, DIFF_CFG[diff].density), [seed, diff]);
	const [user, setUser] = useState<boolean[][]>(() =>
		Array.from({ length: PITCHES }, () => Array.from({ length: STEPS }, () => false))
	);
	const [muted, setMuted] = useState<boolean[]>(() => Array.from({ length: PITCHES }, () => false));
	const [soloed, setSoloed] = useState<number | null>(null);
	const [step, setStep] = useState(0);
	const [playing, setPlaying] = useState<"user" | "target" | "off">("off");
	const [bpm, setBpm] = useState(120);
	const [revealed, setRevealed] = useState(false);
	const audioCtx = useRef<AudioContext | null>(null);

	const ensureCtx = () => {
		if (!audioCtx.current) {
			try {
				audioCtx.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* no audio */
			}
		}
		return audioCtx.current;
	};

	const playStep = (grid: boolean[][], s: number) => {
		const ctx = ensureCtx();
		if (!ctx) return;
		const stepLen = 60 / bpm / 4;
		for (let p = 0; p < PITCHES; p++) {
			if (!grid[p][s]) continue;
			if (soloed !== null && p !== soloed) continue;
			if (soloed === null && muted[p]) continue;
			const voice = voiceForPitch(p);
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			if (voice === "bass") {
				o.type = "sawtooth";
				o.frequency.value = NOTES[p] / 2;
			} else if (voice === "drum") {
				o.type = "square";
				o.frequency.value = NOTES[p] * 1.5;
			} else {
				o.type = "triangle";
				o.frequency.value = NOTES[p];
			}
			g.gain.setValueAtTime(0.0001, ctx.currentTime);
			const peak = voice === "drum" ? 0.12 : 0.16;
			g.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + 0.01);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + stepLen * (voice === "drum" ? 0.4 : 0.9));
			o.connect(g).connect(ctx.destination);
			o.start();
			o.stop(ctx.currentTime + stepLen);
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
	}, [playing, user, target, bpm, muted, soloed]);

	const toggle = (p: number, s: number) => {
		setUser((u) => u.map((row, pp) => row.map((v, ss) => (pp === p && ss === s ? !v : v))));
	};

	const score = useMemo(() => {
		let hits = 0;
		let miss = 0;
		let extra = 0;
		for (let p = 0; p < PITCHES; p++) {
			for (let s = 0; s < STEPS; s++) {
				if (target[p][s] && user[p][s]) hits++;
				else if (target[p][s]) miss++;
				else if (user[p][s]) extra++;
			}
		}
		const total = hits + miss + extra;
		if (total === 0) return 100;
		return Math.round((hits / total) * 100);
	}, [target, user]);

	const totalTargetCells = useMemo(() => {
		let n = 0;
		for (let p = 0; p < PITCHES; p++) for (let s = 0; s < STEPS; s++) if (target[p][s]) n++;
		return n;
	}, [target]);

	const newSeed = (m: "daily" | "random" = mode) => {
		setMode(m);
		const ns = m === "daily" ? todaySeed() : Math.floor(Math.random() * 1e9);
		setSeed(ns);
		setUser(Array.from({ length: PITCHES }, () => Array.from({ length: STEPS }, () => false)));
		setRevealed(false);
		setPlaying("off");
		setStep(-1);
	};

	const saveSlot = () => {
		try {
			localStorage.setItem("ssymph_slot", JSON.stringify({ seed, diff, mode, user }));
		} catch {
			/* ignore */
		}
	};

	const loadSlot = () => {
		try {
			const raw = localStorage.getItem("ssymph_slot");
			if (!raw) return;
			const d = JSON.parse(raw);
			if (typeof d.seed === "number") setSeed(d.seed);
			if (d.diff) setDiff(d.diff);
			if (d.mode) setMode(d.mode);
			if (Array.isArray(d.user)) setUser(d.user);
			setRevealed(false);
		} catch {
			/* ignore */
		}
	};

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
				Listen, then reproduce by ear. Seed {seed} · {mode} · {diff} ({DIFF_CFG[diff].label}) · target uses{" "}
				{totalTargetCells} cells
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", justifyContent: "center" }}>
				<button
					type="button"
					onClick={() => {
						ensureCtx();
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
						ensureCtx();
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
						onChange={(e) => {
							const n = parseInt(e.target.value, 10);
							if (Number.isFinite(n) && n >= 20 && n <= 400) setBpm(n);
						}}
						style={{ width: 50 }}
					/>
				</label>
				<div style={{ alignSelf: "center", marginLeft: 12 }}>Match: {score}%</div>
				<button type="button" onClick={() => setRevealed((r) => !r)} style={btn}>
					{revealed ? "Hide target" : "Reveal target"}
				</button>
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", justifyContent: "center" }}>
				{(Object.keys(DIFF_CFG) as Difficulty[]).map((d) => (
					<button
						key={d}
						type="button"
						onClick={() => {
							setDiff(d);
							setUser(Array.from({ length: PITCHES }, () => Array.from({ length: STEPS }, () => false)));
							setRevealed(false);
						}}
						style={{ ...btn, background: d === diff ? "#445" : "#2a3045" }}
					>
						{d}
					</button>
				))}
				<button type="button" onClick={() => newSeed("random")} style={btn}>
					New random
				</button>
				<button type="button" onClick={() => newSeed("daily")} style={btn}>
					Daily
				</button>
				<button type="button" onClick={saveSlot} style={btn}>
					Save
				</button>
				<button type="button" onClick={loadSlot} style={btn}>
					Load
				</button>
			</div>
			<div style={{ display: "flex", gap: 6 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 2, justifyContent: "flex-end" }}>
					{Array.from({ length: PITCHES }).map((_, pRev) => {
						const p = PITCHES - 1 - pRev;
						const isSolo = soloed === p;
						const isMute = muted[p];
						return (
							<div key={p} style={{ display: "flex", gap: 2, height: cellSize, alignItems: "center" }}>
								<button
									type="button"
									onClick={() => setMuted((m) => m.map((v, i) => (i === p ? !v : v)))}
									title="Mute row"
									style={{
										width: 22,
										height: 22,
										border: "1px solid #445",
										background: isMute ? "#522" : "#1a1f28",
										color: "#dcd",
										fontSize: 10,
										cursor: "pointer",
										borderRadius: 3,
									}}
								>
									M
								</button>
								<button
									type="button"
									onClick={() => setSoloed((s) => (s === p ? null : p))}
									title="Solo row"
									style={{
										width: 22,
										height: 22,
										border: "1px solid #445",
										background: isSolo ? "#552" : "#1a1f28",
										color: "#dcd",
										fontSize: 10,
										cursor: "pointer",
										borderRadius: 3,
									}}
								>
									S
								</button>
								<div
									style={{
										fontSize: 9,
										opacity: 0.5,
										width: 24,
										textAlign: "right",
										color: voiceForPitch(p) === "drum" ? "#fc6" : voiceForPitch(p) === "bass" ? "#6cf" : "#dcd",
									}}
								>
									{voiceForPitch(p)[0].toUpperCase()}
								</div>
							</div>
						);
					})}
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
							const targetOn = target[p][s];
							const isStep = step === s && playing !== "off";
							let bg = "#1d2230";
							if (on) bg = `hsl(${200 + p * 12} 70% ${isStep ? 70 : 50}%)`;
							else if (isStep) bg = "#3a4150";
							else if (s % 4 === 0) bg = "#252a35";
							const showTarget = revealed && targetOn;
							const showMismatch = revealed && targetOn !== on;
							return (
								<div
									key={`${p}-${s}`}
									onClick={() => {
										ensureCtx();
										toggle(p, s);
									}}
									style={{
										width: cellSize,
										height: cellSize,
										background: bg,
										cursor: "pointer",
										borderRadius: 3,
										boxShadow: showTarget ? "inset 0 0 0 2px #fc6" : undefined,
										outline: showMismatch && !on ? "1px dashed #fc6" : showMismatch && on ? "1px dashed #f33" : "none",
									}}
								/>
							);
						});
					})}
				</div>
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
