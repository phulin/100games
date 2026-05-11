import { useEffect, useMemo, useRef, useState } from "react";

// Drop pebbles. Ripples expand from each drop and "ring" any lily pad they
// pass through. You must ring lily pads in numeric order to score. Wrong
// order resets the sequence on the affected pad.
//
// Pad layouts are seeded — every player on the same seed gets the same pond.
// A daily seed makes the puzzle identical for everyone visiting today.

// ---------- seeded RNG ----------
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hashSeed(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

type Pebble = { x: number; y: number; t: number; id: number };
type Pad = { x: number; y: number; n: number; rung: boolean };

const WAVE_SPEED = 90; // px per second
const WAVE_LIFE = 4.5; // seconds

function buildPads(
	rng: () => number,
	n: number,
	w: number,
	h: number,
	shape: "rect" | "circle",
): Pad[] {
	const pads: Pad[] = [];
	for (let i = 0; i < n; i++) {
		let tries = 0;
		while (tries++ < 100) {
			let x: number;
			let y: number;
			if (shape === "rect") {
				x = 80 + rng() * (w - 160);
				y = 80 + rng() * (h - 160);
			} else {
				const cx = w / 2;
				const cy = h / 2;
				const R = Math.min(w, h) / 2 - 70;
				const r = Math.sqrt(rng()) * R;
				const th = rng() * Math.PI * 2;
				x = cx + Math.cos(th) * r;
				y = cy + Math.sin(th) * r;
			}
			const ok = pads.every((p) => Math.hypot(p.x - x, p.y - y) > 90);
			if (ok) {
				pads.push({ x, y, n: i + 1, rung: false });
				break;
			}
		}
	}
	// shuffle the number labels so order isn't just left-to-right
	for (let i = pads.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = pads[i].n;
		pads[i].n = pads[j].n;
		pads[j].n = tmp;
	}
	return pads;
}

function todayUTC(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
function dailySeed(): number {
	return hashSeed("pebblepond-daily:" + todayUTC());
}

export default function PebblePond() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [size] = useState({ w: 760, h: 520 });
	const [seed, setSeed] = useState<number>(() => (Math.random() * 1e9) >>> 0);
	const [mode, setMode] = useState<"daily" | "free">("free");
	const [shape, setShape] = useState<"rect" | "circle">("rect");
	const [padCount, setPadCount] = useState(5);
	const [currentStrength, setCurrentStrength] = useState(0); // 0..1: drift

	const initialPads = useMemo(
		() => buildPads(mulberry32(seed), padCount, size.w, size.h, shape),
		[seed, padCount, size.w, size.h, shape],
	);

	const [pads, setPads] = useState<Pad[]>(initialPads);
	const [pebbles, setPebbles] = useState<Pebble[]>([]);
	const [next, setNext] = useState(1);
	const [score, setScore] = useState(0);
	const [pebsUsed, setPebsUsed] = useState(0);
	const [bestPerSeed, setBestPerSeed] = useState<Record<string, number>>(() => {
		try {
			return JSON.parse(localStorage.getItem("pebblepond_best") || "{}");
		} catch {
			return {};
		}
	});
	const rafRef = useRef<number | undefined>(undefined);
	const startRef = useRef<number>(performance.now());

	const pebblesRef = useRef(pebbles);
	const padsRef = useRef(pads);
	const nextRef = useRef(next);
	// Per-pebble previous wave radius, kept outside React state so it
	// survives across re-renders and isn't clobbered when setPebbles fires.
	const lastRRef = useRef<Map<number, number>>(new Map());
	const pebbleIdRef = useRef(0);
	pebblesRef.current = pebbles;
	padsRef.current = pads;
	nextRef.current = next;

	// reset on seed/options change
	useEffect(() => {
		setPads(initialPads);
		setPebbles([]);
		lastRRef.current.clear();
		setNext(1);
		setScore(0);
		setPebsUsed(0);
		startRef.current = performance.now();
	}, [initialPads]);

	// --- audio ---
	const audioRef = useRef<AudioContext | null>(null);
	const ensureAudio = () => {
		if (audioRef.current) return audioRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext })
				.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		audioRef.current = new Ctor();
		return audioRef.current;
	};
	useEffect(
		() => () => {
			audioRef.current?.close();
		},
		[],
	);
	const splash = () => {
		const ctx = audioRef.current;
		if (!ctx) return;
		// Short noise burst with low-pass; small downward chirp.
		const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
		}
		const src = ctx.createBufferSource();
		src.buffer = buf;
		const filter = ctx.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = 1200;
		const g = ctx.createGain();
		g.gain.value = 0.15;
		src.connect(filter);
		filter.connect(g);
		g.connect(ctx.destination);
		src.start();
	};
	const ringTone = (n: number) => {
		const ctx = audioRef.current;
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = "sine";
		// each pad has a pitch in a pentatonic ascending scale
		const scale = [261, 294, 329, 392, 440, 523, 587, 659, 784, 880];
		osc.frequency.value = scale[(n - 1) % scale.length];
		g.gain.value = 0.18;
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
		osc.connect(g);
		g.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + 0.5);
	};
	const wrongTone = () => {
		const ctx = audioRef.current;
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = "sawtooth";
		osc.frequency.value = 110;
		g.gain.value = 0.12;
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
		osc.connect(g);
		g.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + 0.2);
	};

	useEffect(() => {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;

		const render = () => {
			const now = (performance.now() - startRef.current) / 1000;
			// physics: detect rings as wave radius crosses pad distance
			const newPebbles: Pebble[] = [];
			let nextN = nextRef.current;
			let scoreDelta = 0;
			const padCopy = padsRef.current.map((p) => ({ ...p }));
			const drift = currentStrength * 15; // px/sec horizontal drift
			for (const p of pebblesRef.current) {
				const age = now - p.t;
				if (age > WAVE_LIFE) {
					lastRRef.current.delete(p.id);
					continue;
				}
				const r = age * WAVE_SPEED;
				// Track each pebble's previous wave radius from the prior
				// frame, instead of assuming a fixed 1/60s frame interval.
				// At low frame rates the wave would otherwise step past a
				// pad's distance without our crossing test ever firing,
				// silently missing rings.
				const prevR = lastRRef.current.get(p.id) ?? 0;
				// center drifts to the right with the "current"
				const cx = p.x + drift * age;
				const cy = p.y;
				for (const pad of padCopy) {
					if (pad.rung) continue;
					const d = Math.hypot(pad.x - cx, pad.y - cy);
					if (d <= r && d > prevR) {
						if (pad.n === nextN) {
							pad.rung = true;
							nextN++;
							scoreDelta += 20;
							ringTone(pad.n);
						} else {
							scoreDelta -= 3;
							wrongTone();
						}
					}
				}
				lastRRef.current.set(p.id, r);
				newPebbles.push(p);
			}
			if (scoreDelta !== 0) setScore((s) => s + scoreDelta);
			if (nextN !== nextRef.current) {
				setNext(nextN);
				setPads(padCopy);
			} else if (padCopy.some((pp, i) => pp.rung !== padsRef.current[i].rung)) {
				setPads(padCopy);
			}
			if (newPebbles.length !== pebblesRef.current.length)
				setPebbles(newPebbles);

			// draw
			ctx.fillStyle = "#0e2a44";
			ctx.fillRect(0, 0, size.w, size.h);
			const grad = ctx.createRadialGradient(
				size.w / 2,
				size.h / 2,
				20,
				size.w / 2,
				size.h / 2,
				size.w / 1.2,
			);
			grad.addColorStop(0, "rgba(80,140,180,0.25)");
			grad.addColorStop(1, "rgba(0,0,0,0.3)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, size.w, size.h);

			// current arrows (subtle)
			if (currentStrength > 0) {
				ctx.strokeStyle = "rgba(180,220,255,0.12)";
				ctx.lineWidth = 1;
				for (let yy = 40; yy < size.h; yy += 60) {
					for (let xx = 30; xx < size.w; xx += 80) {
						ctx.beginPath();
						ctx.moveTo(xx, yy);
						ctx.lineTo(xx + 18 * currentStrength, yy);
						ctx.stroke();
					}
				}
			}

			// ripples
			ctx.lineWidth = 2;
			for (const p of newPebbles) {
				const age = now - p.t;
				const r = age * WAVE_SPEED;
				const alpha = Math.max(0, 1 - age / WAVE_LIFE);
				const cx = p.x + drift * age;
				ctx.strokeStyle = `rgba(180,220,255,${alpha * 0.8})`;
				ctx.beginPath();
				ctx.arc(cx, p.y, r, 0, Math.PI * 2);
				ctx.stroke();
				if (r > 30) {
					ctx.strokeStyle = `rgba(140,200,255,${alpha * 0.3})`;
					ctx.beginPath();
					ctx.arc(cx, p.y, r - 18, 0, Math.PI * 2);
					ctx.stroke();
				}
			}
			// pads
			for (const pad of padCopy) {
				ctx.fillStyle = pad.rung ? "#9bcc70" : "#3e7a3a";
				ctx.beginPath();
				ctx.ellipse(pad.x, pad.y, 28, 18, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.strokeStyle = "rgba(0,0,0,0.4)";
				ctx.stroke();
				ctx.fillStyle = "#fff";
				ctx.font = "bold 16px sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(String(pad.n), pad.x, pad.y);
			}
			// "next pad" highlight glow so the player knows their target
			const target = padCopy.find((pp) => pp.n === nextN);
			if (target && !target.rung) {
				ctx.strokeStyle = "rgba(255,210,80,0.7)";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.ellipse(target.x, target.y, 34, 24, 0, 0, Math.PI * 2);
				ctx.stroke();
				ctx.lineWidth = 2;
			}

			rafRef.current = requestAnimationFrame(render);
		};
		rafRef.current = requestAnimationFrame(render);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [size.w, size.h, currentStrength]);

	const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		ensureAudio();
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const t = (performance.now() - startRef.current) / 1000;
		const id = ++pebbleIdRef.current;
		setPebbles((p) => [...p, { x, y, t, id }]);
		setPebsUsed((c) => c + 1);
		splash();
	};

	const allRung = pads.length > 0 && pads.every((p) => p.rung);
	const finalScore = score - pebsUsed * 2;

	// Track best per seed when win achieved
	useEffect(() => {
		if (!allRung) return;
		const key = String(seed);
		if ((bestPerSeed[key] ?? -Infinity) < finalScore) {
			const m = { ...bestPerSeed, [key]: finalScore };
			setBestPerSeed(m);
			try {
				localStorage.setItem("pebblepond_best", JSON.stringify(m));
			} catch {
				/* ignore */
			}
		}
	}, [allRung, finalScore, seed, bestPerSeed]);

	const reset = () => {
		setSeed(mode === "daily" ? dailySeed() : (Math.random() * 1e9) >>> 0);
	};

	const switchMode = (m: "daily" | "free") => {
		setMode(m);
		setSeed(m === "daily" ? dailySeed() : (Math.random() * 1e9) >>> 0);
	};

	const bestForSeed = bestPerSeed[String(seed)];

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#06121d",
				color: "#cfe4f5",
				fontFamily: "Georgia, serif",
				padding: 16,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				overflow: "auto",
			}}
		>
			<h2 style={{ margin: 0 }}>Pebble Pond</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Click to drop pebbles. Ring lily pads in order 1→{pads.length}.
			</div>
			<div
				style={{
					marginTop: 6,
					display: "flex",
					gap: 6,
					flexWrap: "wrap",
					justifyContent: "center",
					fontSize: 12,
				}}
			>
				<button
					type="button"
					onClick={() => switchMode("free")}
					style={modeBtn(mode === "free")}
				>
					Free
				</button>
				<button
					type="button"
					onClick={() => switchMode("daily")}
					style={modeBtn(mode === "daily")}
				>
					Daily ({todayUTC()})
				</button>
				<span style={{ alignSelf: "center", opacity: 0.7 }}>
					Shape:
				</span>
				<button type="button" onClick={() => setShape("rect")} style={modeBtn(shape === "rect")}>
					Rect
				</button>
				<button type="button" onClick={() => setShape("circle")} style={modeBtn(shape === "circle")}>
					Round
				</button>
				<span style={{ alignSelf: "center", opacity: 0.7 }}>Pads:</span>
				{[3, 5, 7, 9].map((n) => (
					<button
						key={n}
						type="button"
						onClick={() => setPadCount(n)}
						style={modeBtn(padCount === n)}
					>
						{n}
					</button>
				))}
				<span style={{ alignSelf: "center", opacity: 0.7 }}>Current:</span>
				<input
					type="range"
					min={0}
					max={100}
					value={Math.round(currentStrength * 100)}
					onChange={(e) => setCurrentStrength(Number(e.target.value) / 100)}
					style={{ width: 80, alignSelf: "center" }}
				/>
			</div>
			<canvas
				ref={canvasRef}
				width={size.w}
				height={size.h}
				onClick={onClick}
				style={{
					marginTop: 8,
					borderRadius: 8,
					boxShadow: "0 0 30px rgba(0,0,0,0.6)",
					cursor: "crosshair",
				}}
			/>
			<div style={{ marginTop: 8, display: "flex", gap: 24, fontSize: 14, flexWrap: "wrap", justifyContent: "center" }}>
				<div>Next: {next > pads.length ? "—" : next}</div>
				<div>Score: {score}</div>
				<div>Pebbles: {pebsUsed}</div>
				{allRung && (
					<div style={{ color: "#9bcc70" }}>
						All rung! Final: {finalScore}
					</div>
				)}
				<button type="button" onClick={reset} style={modeBtn(false)}>
					Reset
				</button>
				<span style={{ opacity: 0.6 }}>
					seed: <code>{seed.toString(36)}</code>
					{bestForSeed !== undefined && ` · best: ${bestForSeed}`}
				</span>
			</div>
		</div>
	);
}

function modeBtn(active: boolean): React.CSSProperties {
	return {
		padding: "4px 10px",
		background: active ? "#5a8db5" : "#234",
		color: "#fff",
		border: "1px solid #456",
		borderRadius: 3,
		cursor: "pointer",
		fontSize: 12,
	};
}
