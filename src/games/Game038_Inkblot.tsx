import { useEffect, useMemo, useRef, useState } from "react";

// Procedural inkblot via seeded metaballs (symmetric). Player types a word
// describing what they see. Local history per-blot is kept in localStorage
// (empty by default — no preprogrammed word pool). Players can re-roll,
// rotate, drip-reveal, mirror toggle, and hear an ambient drone seeded by
// the blot.

type Blob = { x: number; y: number; r: number };

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

function genBlobs(seed: number): { blobs: Blob[]; aspect: number; complexity: number } {
	const r = mulberry32(seed);
	const n = 6 + Math.floor(r() * 8);
	const blobs: Blob[] = [];
	let maxX = 0;
	let maxY = 0;
	for (let i = 0; i < n; i++) {
		const x = r() * 150;
		const y = r() * 280;
		const radius = 25 + r() * 55;
		blobs.push({ x, y, r: radius });
		maxX = Math.max(maxX, x + radius);
		maxY = Math.max(maxY, y + radius);
	}
	const aspect = maxX / Math.max(1, maxY);
	return { blobs, aspect, complexity: n };
}

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!audioCtx) {
		try {
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
		} catch {
			return null;
		}
	}
	return audioCtx;
}

function blotDrone(seed: number, blobs: Blob[]): { stop: () => void } | null {
	const ctx = getAudio();
	if (!ctx) return null;
	const r = mulberry32(seed ^ 0xabc);
	const base = 60 + r() * 50;
	const oscs: OscillatorNode[] = [];
	const g = ctx.createGain();
	g.gain.value = 0;
	g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.2);
	const filt = ctx.createBiquadFilter();
	filt.type = "lowpass";
	filt.frequency.value = 600 + blobs.length * 30;
	for (let i = 0; i < 3; i++) {
		const o = ctx.createOscillator();
		o.type = i === 0 ? "sawtooth" : "triangle";
		o.frequency.value = base * (1 + i * (0.5 + r() * 0.5));
		o.connect(filt);
		o.start();
		oscs.push(o);
	}
	filt.connect(g).connect(ctx.destination);
	return {
		stop: () => {
			g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
			for (const o of oscs) o.stop(ctx.currentTime + 0.5);
		},
	};
}

interface LocalEntry {
	word: string;
	at: number;
}

function loadHistory(seed: number): LocalEntry[] {
	try {
		const raw = localStorage.getItem(`inkblot_hist_${seed}`);
		if (!raw) return [];
		return JSON.parse(raw) as LocalEntry[];
	} catch {
		return [];
	}
}

function saveHistory(seed: number, entries: LocalEntry[]) {
	try {
		localStorage.setItem(`inkblot_hist_${seed}`, JSON.stringify(entries));
	} catch {
		/* ignore */
	}
}

export default function Inkblot() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const { blobs, aspect, complexity } = useMemo(() => genBlobs(seed), [seed]);
	const [word, setWord] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);
	const [history, setHistory] = useState<LocalEntry[]>(() => loadHistory(seed));
	const [rotation, setRotation] = useState(0);
	const [revealT, setRevealT] = useState(0);
	const [mirrored, setMirrored] = useState(true);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const droneRef = useRef<{ stop: () => void } | null>(null);

	useEffect(() => {
		setHistory(loadHistory(seed));
		setSubmitted(null);
		setWord("");
		setRevealT(0);
	}, [seed]);

	useEffect(() => {
		let raf = 0;
		const start = performance.now();
		const tick = () => {
			const t = Math.min(1, (performance.now() - start) / 1400);
			setRevealT(t);
			if (t < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [seed, mirrored, rotation]);

	useEffect(() => {
		if (droneRef.current) {
			droneRef.current.stop();
			droneRef.current = null;
		}
		const d = blotDrone(seed, blobs);
		droneRef.current = d;
		return () => {
			if (droneRef.current) {
				droneRef.current.stop();
				droneRef.current = null;
			}
		};
	}, [seed, blobs]);

	useEffect(() => {
		const cv = canvasRef.current;
		if (!cv) return;
		const ctx = cv.getContext("2d");
		if (!ctx) return;
		const Wc = cv.width;
		const Hc = cv.height;
		const img = ctx.createImageData(Wc, Hc);
		const cx = Wc / 2;
		const cy = Hc / 2;
		const cosR = Math.cos(rotation);
		const sinR = Math.sin(rotation);
		const revealRow = revealT * Hc * 1.1;
		for (let y = 0; y < Hc; y++) {
			for (let x = 0; x < Wc; x++) {
				const idx = (y * Wc + x) * 4;
				if (y > revealRow) {
					img.data[idx + 3] = 0;
					continue;
				}
				const rx = x - cx;
				const ry = y - cy;
				const sx = cx + rx * cosR - ry * sinR;
				const sy = cy + rx * sinR + ry * cosR;
				const dx = mirrored ? Math.abs(sx - cx) : sx - cx;
				let sum = 0;
				for (const b of blobs) {
					const ddx = dx - b.x;
					const ddy = sy - b.y;
					sum += (b.r * b.r) / (ddx * ddx + ddy * ddy + 1);
				}
				if (sum > 1.0) {
					const v = Math.min(255, sum * 40);
					img.data[idx] = 18;
					img.data[idx + 1] = 16;
					img.data[idx + 2] = 22;
					img.data[idx + 3] = Math.min(255, v + 100);
				} else {
					img.data[idx + 3] = 0;
				}
			}
		}
		ctx.clearRect(0, 0, Wc, Hc);
		ctx.fillStyle = "#f5f0e6";
		ctx.fillRect(0, 0, Wc, Hc);
		ctx.putImageData(img, 0, 0);
	}, [blobs, rotation, mirrored, revealT]);

	const submit = () => {
		if (!word.trim()) return;
		const lw = word.trim().toLowerCase();
		setSubmitted(lw);
		const updated = [...history, { word: lw, at: Date.now() }];
		setHistory(updated);
		saveHistory(seed, updated);
	};

	const newBlot = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setRotation(0);
	};

	const cloud = useMemo(() => {
		const counts = new Map<string, number>();
		for (const e of history) counts.set(e.word, (counts.get(e.word) ?? 0) + 1);
		return [...counts.entries()]
			.map(([w, c]) => ({ word: w, count: c }))
			.sort((a, b) => b.count - a.count);
	}, [history]);

	return (
		<div style={{ background: "#2a2522", color: "#eee", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Inkblot</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Look at the inkblot. Type a single word for what you see.
			</div>
			<div style={{ display: "flex", gap: 16 }}>
				<div>
					<canvas ref={canvasRef} width={300} height={300} style={{ background: "#f5f0e6", borderRadius: 8 }} />
					<div style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 11, alignItems: "center", flexWrap: "wrap" }}>
						<button type="button" onClick={() => setRotation((r) => r + Math.PI / 6)}>
							Rotate
						</button>
						<button type="button" onClick={() => setMirrored((m) => !m)}>
							{mirrored ? "Asymmetric" : "Mirror"}
						</button>
						<span style={{ opacity: 0.5 }}>
							seed {seed} · {complexity} forms · aspect {aspect.toFixed(2)}
						</span>
					</div>
				</div>
				<div style={{ flex: 1 }}>
					{!submitted ? (
						<>
							<input
								value={word}
								onChange={(e) => setWord(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && submit()}
								placeholder="one word..."
								style={{ width: 200, padding: 6, fontSize: 16, marginBottom: 8 }}
							/>
							<button type="button" onClick={submit}>
								Submit
							</button>
							<div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
								{history.length === 0
									? "No prior impressions for this blot."
									: `${history.length} prior impression${history.length === 1 ? "" : "s"} (yours)`}
							</div>
						</>
					) : (
						<>
							<div style={{ marginBottom: 8 }}>
								You said: <b>{submitted}</b>
							</div>
							<div style={{ fontSize: 13, marginBottom: 4 }}>Your impressions for this blot:</div>
							{cloud.length === 0 ? (
								<div style={{ opacity: 0.6, fontSize: 12 }}>(none yet)</div>
							) : (
								<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
									{cloud.map((c) => (
										<span
											key={c.word}
											style={{
												fontSize: 12 + Math.min(20, c.count * 4),
												opacity: 0.6 + Math.min(0.4, c.count / 10),
												padding: "2px 6px",
												background: c.word === submitted ? "#553" : "#3a322a",
												borderRadius: 4,
											}}
										>
											{c.word}{" "}
											<span style={{ opacity: 0.6, fontSize: 10 }}>×{c.count}</span>
										</span>
									))}
								</div>
							)}
							<div style={{ display: "flex", gap: 8, marginTop: 12 }}>
								<button type="button" onClick={newBlot}>
									New blot
								</button>
								<button
									type="button"
									onClick={() => {
										setSubmitted(null);
										setWord("");
									}}
								>
									Add another word
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
