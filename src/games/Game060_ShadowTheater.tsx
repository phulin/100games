import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 60: Shadow Theater — procedurally generated shapes (seeded), delta-time motion, audio cues,
// perfect-match bonus, persistent best.

const W = 900;
const H = 600;
const BEST_KEY = "shadow-theater:best";

type Shape = {
	name: string;
	polys: { x: number; y: number }[][];
};

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

function hashStr(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h >>> 0;
}

const SYLLABLES_A = ["Ra", "Mu", "Lo", "Ki", "Vo", "Ze", "Pa", "Ny", "Sa", "Tu"];
const SYLLABLES_B = ["bin", "lin", "ko", "ra", "vi", "mo", "thur", "lar", "fen", "dox"];

function generateShape(seed: string): Shape {
	const rng = mulberry32(hashStr(`st-shape:${seed}`));
	const lobes = 2 + Math.floor(rng() * 3);
	const polys: { x: number; y: number }[][] = [];
	const baseN = 8 + Math.floor(rng() * 6);
	const baseR = 45 + rng() * 20;
	const body: { x: number; y: number }[] = [];
	for (let i = 0; i < baseN; i++) {
		const a = (i / baseN) * Math.PI * 2;
		const r = baseR * (0.7 + rng() * 0.6);
		body.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * (0.6 + rng() * 0.4) });
	}
	polys.push(body);
	for (let l = 0; l < lobes; l++) {
		const baseAngle = rng() * Math.PI * 2;
		const baseDist = baseR * (0.4 + rng() * 0.6);
		const bx = Math.cos(baseAngle) * baseDist;
		const by = Math.sin(baseAngle) * baseDist;
		const tipDist = baseR * (0.6 + rng() * 0.9);
		const tx = Math.cos(baseAngle) * (baseDist + tipDist);
		const ty = Math.sin(baseAngle) * (baseDist + tipDist);
		const perp = { x: -Math.sin(baseAngle), y: Math.cos(baseAngle) };
		const width = baseR * (0.15 + rng() * 0.25);
		polys.push([
			{ x: bx + perp.x * width, y: by + perp.y * width },
			{ x: tx, y: ty },
			{ x: bx - perp.x * width, y: by - perp.y * width },
		]);
	}
	const name = `${SYLLABLES_A[Math.floor(rng() * SYLLABLES_A.length)]}${SYLLABLES_B[Math.floor(rng() * SYLLABLES_B.length)]}`;
	return { name, polys };
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, cx: number, cy: number, scale: number, rot: number, fill: string) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(rot);
	ctx.scale(scale, scale);
	ctx.fillStyle = fill;
	for (const poly of shape.polys) {
		ctx.beginPath();
		poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

function pixelOverlap(a: ImageData, b: ImageData) {
	let aCount = 0;
	let bCount = 0;
	let both = 0;
	const al = a.data;
	const bl = b.data;
	for (let i = 3; i < al.length; i += 4) {
		const ap = al[i] > 50;
		const bp = bl[i] > 50;
		if (ap) aCount++;
		if (bp) bCount++;
		if (ap && bp) both++;
	}
	if (aCount + bCount === 0) return 0;
	return (2 * both) / (aCount + bCount);
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = useCallback(() => {
		if (!ctxRef.current) {
			try {
				const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
					?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
				if (Ctor) ctxRef.current = new Ctor();
			} catch {}
		}
		return ctxRef.current;
	}, []);
	const tick = useCallback(() => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "square";
		o.frequency.value = 1200;
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.002);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.06);
	}, [ensure]);
	const lock = useCallback((pct: number) => {
		const ctx = ensure();
		if (!ctx) return;
		const freqs = pct > 0.85 ? [523.25, 659.25, 783.99, 1046.5] : pct > 0.6 ? [440, 554.37, 659.25] : [220, 196];
		freqs.forEach((f, i) => {
			setTimeout(() => {
				const o = ctx.createOscillator();
				const g = ctx.createGain();
				o.type = "triangle";
				o.frequency.value = f;
				g.gain.setValueAtTime(0.0001, ctx.currentTime);
				g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.01);
				g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
				o.connect(g).connect(ctx.destination);
				o.start();
				o.stop(ctx.currentTime + 0.42);
			}, i * 90);
		});
	}, [ensure]);
	return { tick, lock };
}

export default function ShadowTheater() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [runSeed, setRunSeed] = useState(() => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
	const [round, setRound] = useState(1);
	const shape = useMemo(() => generateShape(`${runSeed}:${round}`), [runSeed, round]);
	const targetState = useMemo(() => {
		const rng = mulberry32(hashStr(`st-tgt:${runSeed}:${round}`));
		return {
			x: 200 + rng() * 200,
			y: 250 + rng() * 150,
			scale: 1 + rng() * 1 + Math.min(0.5, round * 0.05),
			rot: (rng() - 0.5) * (0.8 + round * 0.05),
		};
	}, [runSeed, round]);
	const [target, setTarget] = useState(targetState);
	const [player, setPlayer] = useState({ x: 650, y: 320, scale: 1, rot: 0 });
	const [score, setScore] = useState(0);
	const [time, setTime] = useState(20);
	const [over, setOver] = useState(false);
	const [matchPct, setMatchPct] = useState(0);
	const keysRef = useRef<Record<string, boolean>>({});
	const audio = useAudio();
	const tickedTimeRef = useRef(20);
	const [best, setBest] = useState<number>(() => {
		try {
			return Number.parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
		} catch {
			return 0;
		}
	});

	useEffect(() => {
		setTarget(targetState);
		setPlayer({ x: 650, y: 320, scale: 1, rot: 0 });
		setTime(20);
		setOver(false);
		tickedTimeRef.current = 20;
	}, [targetState]);

	useEffect(() => {
		const kd = (e: KeyboardEvent) => {
			keysRef.current[e.key.toLowerCase()] = true;
		};
		const ku = (e: KeyboardEvent) => {
			keysRef.current[e.key.toLowerCase()] = false;
		};
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);
		return () => {
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
		};
	}, []);

	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const k = keysRef.current;
			const moveSpeed = 200 * dt;
			const rotSpeed = 2.4 * dt;
			const scaleSpeed = 1.2 * dt;
			setPlayer((p) => {
				const np = { ...p };
				if (k.a || k.arrowleft) np.x -= moveSpeed;
				if (k.d || k.arrowright) np.x += moveSpeed;
				if (k.w || k.arrowup) np.y -= moveSpeed;
				if (k.s || k.arrowdown) np.y += moveSpeed;
				if (k.q) np.rot -= rotSpeed;
				if (k.e) np.rot += rotSpeed;
				if (k.z) np.scale = Math.max(0.5, np.scale - scaleSpeed);
				if (k.x) np.scale = Math.min(2.5, np.scale + scaleSpeed);
				np.x = Math.max(50, Math.min(W - 50, np.x));
				np.y = Math.max(50, Math.min(H - 50, np.y));
				return np;
			});
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, []);

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			setTime((t) => {
				const nt = t - 0.1;
				if (nt <= 5 && Math.floor(nt) < Math.floor(tickedTimeRef.current) && nt > 0) {
					audio.tick();
				}
				tickedTimeRef.current = nt;
				if (nt <= 0) {
					setOver(true);
					return 0;
				}
				return nt;
			});
		}, 100);
		return () => clearInterval(id);
	}, [over, audio]);

	useEffect(() => {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		const grad = ctx.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, "#f5d77a");
		grad.addColorStop(1, "#d8a85a");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, W, H);
		ctx.fillStyle = "#7b1818";
		for (let i = 0; i < 6; i++) {
			ctx.beginPath();
			ctx.moveTo(i * 30, 0);
			ctx.quadraticCurveTo(i * 30 + 15, H * 0.4, i * 30, H);
			ctx.lineTo(i * 30 + 30, H);
			ctx.lineTo(i * 30 + 30, 0);
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(W - i * 30, 0);
			ctx.quadraticCurveTo(W - i * 30 - 15, H * 0.4, W - i * 30, H);
			ctx.lineTo(W - i * 30 - 30, H);
			ctx.lineTo(W - i * 30 - 30, 0);
			ctx.fill();
		}
		drawShape(ctx, shape, target.x, target.y, target.scale, target.rot, "rgba(0,0,0,0.35)");
		drawShape(ctx, shape, player.x, player.y, player.scale, player.rot, "rgba(0,0,0,0.85)");

		const off1 = document.createElement("canvas");
		off1.width = W;
		off1.height = H;
		const c1 = off1.getContext("2d");
		if (!c1) return;
		drawShape(c1, shape, target.x, target.y, target.scale, target.rot, "#000");
		const off2 = document.createElement("canvas");
		off2.width = W;
		off2.height = H;
		const c2 = off2.getContext("2d");
		if (!c2) return;
		drawShape(c2, shape, player.x, player.y, player.scale, player.rot, "#000");
		const a = c1.getImageData(0, 0, W, H);
		const b = c2.getImageData(0, 0, W, H);
		setMatchPct(pixelOverlap(a, b));
	}, [player, target, shape]);

	function nextRound() {
		setRound((r) => r + 1);
	}

	function lockIn() {
		if (over) return;
		const pct = matchPct;
		const base = Math.round(pct * 100);
		const bonus = pct > 0.9 ? 50 : pct > 0.75 ? 20 : 0;
		const timeBonus = Math.round(time * 2);
		const total = base + bonus + timeBonus;
		setScore((s) => s + total);
		audio.lock(pct);
		setOver(true);
	}

	function reset() {
		setRunSeed(`${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
		setRound(1);
		setScore(0);
	}

	useEffect(() => {
		if (score > best) {
			setBest(score);
			try {
				localStorage.setItem(BEST_KEY, String(score));
			} catch {}
		}
	}, [score, best]);

	return (
		<div style={{ background: "#2a0a0a", color: "#fde2a0", padding: 14, fontFamily: "'Times New Roman', serif" }}>
			<h2 style={{ margin: 0 }}>Shadow Theater</h2>
			<div style={{ fontSize: 13, opacity: 0.9 }}>
				Move your shadow to match the faint target shape. WASD/arrows to move, Q/E to rotate, Z/X to scale. Lock in for points. Each shape is a unique creature.
			</div>
			<div style={{ display: "flex", gap: 14, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
				<div>Shape: {shape.name}</div>
				<div>Round: {round}</div>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div>Match: {(matchPct * 100).toFixed(0)}%</div>
				<div>Time: {time.toFixed(1)}s</div>
				<button type="button" onClick={lockIn} disabled={over} style={{ background: "#c0a050", color: "#2a0a0a", border: 0, padding: "4px 12px", borderRadius: 4, cursor: over ? "default" : "pointer" }}>
					Lock In
				</button>
				{over && (
					<>
						<button type="button" onClick={nextRound} style={{ background: "#7b1818", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
							Next Shape
						</button>
						<button type="button" onClick={reset} style={{ background: "#5a3a3a", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
							New Sky / Reset
						</button>
					</>
				)}
			</div>
			<canvas ref={canvasRef} width={W} height={H} style={{ display: "block", marginTop: 8, borderRadius: 6, border: "4px solid #4a1010" }} />
		</div>
	);
}
