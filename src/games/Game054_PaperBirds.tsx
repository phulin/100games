import { useCallback, useEffect, useRef, useState } from "react";

// Game 54: Paper Birds
// Launch origami birds by dragging. Hit floating rings for points.
// Improvements:
//   1. Seeded mulberry32 RNG for ring placement (daily seed + level seed)
//   2. Gold rings (3x) and small rings (2x) introduce risk/reward
//   3. Trajectory preview arc while dragging
//   4. WebAudio: launch whoosh + ring chime + ambient breeze
//   5. Wind drift + ammo refill on 3-in-a-row hit combo + persistent best

const W = 900;
const H = 600;

type Bird = { id: number; x: number; y: number; vx: number; vy: number; rot: number; life: number };
type Ring = { id: number; x: number; y: number; r: number; vy: number; passed: boolean; kind: "normal" | "gold" | "small" };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; ttl: number; color: string };

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function todayUTCSeed(): number {
	const d = new Date();
	return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

let BID = 0;
let RID = 0;

export default function PaperBirds() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const audioRef = useRef<AudioContext | null>(null);
	const breezeRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
	const [seed, setSeed] = useState<number>(() => todayUTCSeed());
	const [best, setBest] = useState(() => parseInt(localStorage.getItem("g54_best") || "0", 10));
	const rngRef = useRef<() => number>(mulberry32(seed));

	const makeRing = useCallback((): Ring => {
		const rng = rngRef.current;
		const roll = rng();
		const kind: "normal" | "gold" | "small" = roll < 0.15 ? "gold" : roll < 0.35 ? "small" : "normal";
		const baseR = kind === "gold" ? 40 + rng() * 12 : kind === "small" ? 18 + rng() * 8 : 30 + rng() * 16;
		return {
			id: RID++,
			x: 300 + rng() * 500,
			y: 100 + rng() * 350,
			r: baseR,
			vy: (rng() - 0.5) * 0.8,
			passed: false,
			kind,
		};
	}, []);

	const stateRef = useRef({
		birds: [] as Bird[],
		rings: [] as Ring[],
		particles: [] as Particle[],
		drag: null as null | { x0: number; y0: number; x: number; y: number },
		score: 0,
		combo: 0,
		ammo: 12,
		time: 45,
		over: false,
		wind: 0,
		lastHitTime: 0,
	});
	const [, setTick] = useState(0);

	function ensureAudio() {
		if (!audioRef.current) {
			try {
				audioRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* ignore */
			}
		}
		const ac = audioRef.current;
		if (ac && !breezeRef.current) {
			const o = ac.createOscillator();
			const g = ac.createGain();
			o.type = "triangle";
			o.frequency.value = 90;
			g.gain.value = 0.015;
			o.connect(g);
			g.connect(ac.destination);
			o.start();
			breezeRef.current = { osc: o, gain: g };
		}
	}
	function blip(freq: number, dur = 0.2, type: OscillatorType = "sine", vol = 0.18) {
		const ac = audioRef.current;
		if (!ac) return;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = type;
		o.frequency.value = freq;
		o.connect(g);
		g.connect(ac.destination);
		g.gain.setValueAtTime(0.0001, ac.currentTime);
		g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
		o.start();
		o.stop(ac.currentTime + dur + 0.05);
	}

	const reset = useCallback(() => {
		const s = stateRef.current;
		rngRef.current = mulberry32(seed);
		s.birds = [];
		s.particles = [];
		s.rings = Array.from({ length: 5 }, () => makeRing());
		s.score = 0;
		s.combo = 0;
		s.ammo = 12;
		s.time = 45;
		s.over = false;
		s.wind = (rngRef.current() - 0.5) * 0.1;
		s.lastHitTime = 0;
	}, [seed, makeRing]);

	useEffect(() => {
		reset();
	}, [reset]);

	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(40, now - last);
			last = now;
			const s = stateRef.current;
			if (!s.over) {
				s.time -= dt / 1000;
				if (s.time <= 0) {
					s.time = 0;
					s.over = true;
					if (s.score > best) {
						setBest(s.score);
						localStorage.setItem("g54_best", String(s.score));
					}
				}
			}
			const f = dt / 16;
			s.wind += (rngRef.current() - 0.5) * 0.004 * f;
			s.wind = Math.max(-0.18, Math.min(0.18, s.wind));

			for (const b of s.birds) {
				b.vy += 0.04 * f;
				b.vx *= 0.999;
				b.vx += s.wind * f * 0.1;
				b.x += b.vx * f;
				b.y += b.vy * f;
				b.rot = Math.atan2(b.vy, b.vx);
				b.life += dt / 1000;
			}
			s.birds = s.birds.filter((b) => b.x > -50 && b.x < W + 50 && b.y < H + 50 && b.life < 8);

			for (const r of s.rings) {
				r.y += r.vy * f;
				if (r.y < 60 || r.y > H - 60) r.vy *= -1;
				for (const b of s.birds) {
					if (!r.passed && Math.hypot(b.x - r.x, b.y - r.y) < r.r * 0.6) {
						r.passed = true;
						const points = r.kind === "gold" ? 3 : r.kind === "small" ? 2 : 1;
						s.score += points;
						s.combo += 1;
						s.lastHitTime = now;
						if (s.combo > 0 && s.combo % 3 === 0) {
							s.ammo += 1;
						}
						for (let i = 0; i < 12; i++) {
							const ang = rngRef.current() * Math.PI * 2;
							const sp = 1 + rngRef.current() * 3;
							s.particles.push({
								x: r.x,
								y: r.y,
								vx: Math.cos(ang) * sp,
								vy: Math.sin(ang) * sp,
								life: 0,
								ttl: 0.5,
								color: r.kind === "gold" ? "#ffe28a" : r.kind === "small" ? "#cdf" : "#fff",
							});
						}
						blip(400 + points * 200, 0.18, "triangle", 0.2);
					}
				}
			}
			if (now - s.lastHitTime > 3000) s.combo = 0;

			s.rings = s.rings.map((r) => (r.passed ? makeRing() : r));

			for (const p of s.particles) {
				p.x += p.vx * f;
				p.y += p.vy * f;
				p.vy += 0.05 * f;
				p.life += dt / 1000;
			}
			s.particles = s.particles.filter((p) => p.life < p.ttl);

			const br = breezeRef.current;
			if (br && audioRef.current) {
				const target = 0.005 + Math.abs(s.wind) * 0.4;
				br.gain.gain.setTargetAtTime(target, audioRef.current.currentTime, 0.3);
			}

			const ctx = canvasRef.current?.getContext("2d");
			if (ctx) draw(ctx, s);
			setTick((t) => t + 1);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [makeRing, best]);

	useEffect(() => {
		return () => {
			breezeRef.current?.osc.stop();
			breezeRef.current = null;
			audioRef.current?.close().catch(() => {});
			audioRef.current = null;
		};
	}, []);

	function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
		const sky = ctx.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, "#ffd6a5");
		sky.addColorStop(1, "#c9e7ff");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, W, H);
		ctx.fillStyle = "#fff3c4";
		ctx.beginPath();
		ctx.arc(700, 130, 60, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#6a4a2a88";
		ctx.font = "12px 'Courier New', monospace";
		ctx.fillText(`wind ${s.wind > 0 ? "→" : "←"} ${Math.abs(s.wind).toFixed(2)}`, 12, H - 12);

		for (const r of s.rings) {
			const outer = r.kind === "gold" ? "#fff099" : "#fff";
			const inner = r.kind === "gold" ? "#d8a630" : r.kind === "small" ? "#9bb6d0" : "#ffb84d";
			ctx.strokeStyle = outer;
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
			ctx.stroke();
			ctx.strokeStyle = inner;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.r - 5, 0, Math.PI * 2);
			ctx.stroke();
		}

		for (const p of s.particles) {
			const a = 1 - p.life / p.ttl;
			ctx.fillStyle = p.color;
			ctx.globalAlpha = a;
			ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
			ctx.globalAlpha = 1;
		}

		for (const b of s.birds) {
			ctx.save();
			ctx.translate(b.x, b.y);
			ctx.rotate(b.rot);
			ctx.fillStyle = "#f5e6cc";
			ctx.strokeStyle = "#6a4a2a";
			ctx.beginPath();
			ctx.moveTo(-12, -6);
			ctx.lineTo(14, 0);
			ctx.lineTo(-12, 6);
			ctx.lineTo(-6, 0);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-6, 0);
			ctx.lineTo(-12, -6);
			ctx.lineTo(-12, 6);
			ctx.closePath();
			ctx.fillStyle = "#d4bfa3";
			ctx.fill();
			ctx.stroke();
			ctx.restore();
		}

		if (s.drag) {
			const dx = (s.drag.x0 - s.drag.x) * 0.12;
			const dy = (s.drag.y0 - s.drag.y) * 0.12;
			let px = s.drag.x0;
			let py = s.drag.y0;
			let pvx = dx;
			let pvy = dy;
			ctx.strokeStyle = "rgba(60,40,20,0.5)";
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(px, py);
			for (let i = 0; i < 60; i++) {
				pvy += 0.04;
				pvx *= 0.999;
				pvx += s.wind * 0.1;
				px += pvx;
				py += pvy;
				if (px < 0 || px > W || py > H) break;
				if (i % 2 === 0) ctx.lineTo(px, py);
			}
			ctx.stroke();
			ctx.setLineDash([]);

			ctx.strokeStyle = "#0006";
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.beginPath();
			ctx.moveTo(s.drag.x0, s.drag.y0);
			ctx.lineTo(s.drag.x, s.drag.y);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		if (s.combo >= 2) {
			ctx.fillStyle = "rgba(255,160,40,0.9)";
			ctx.font = "bold 20px 'Courier New', monospace";
			ctx.fillText(`Combo x${s.combo}`, W - 150, 30);
		}
	}

	function getPos(e: React.PointerEvent) {
		const r = canvasRef.current!.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
	}
	const onDown = (e: React.PointerEvent) => {
		ensureAudio();
		const s = stateRef.current;
		if (s.over || s.ammo <= 0) return;
		const p = getPos(e);
		s.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y };
	};
	const onMove = (e: React.PointerEvent) => {
		const s = stateRef.current;
		if (!s.drag) return;
		const p = getPos(e);
		s.drag.x = p.x;
		s.drag.y = p.y;
	};
	const onUp = (e: React.PointerEvent) => {
		const s = stateRef.current;
		if (!s.drag) return;
		const p = getPos(e);
		const dx = (s.drag.x0 - p.x) * 0.12;
		const dy = (s.drag.y0 - p.y) * 0.12;
		s.birds.push({ id: BID++, x: s.drag.x0, y: s.drag.y0, vx: dx, vy: dy, rot: 0, life: 0 });
		s.ammo -= 1;
		s.drag = null;
		blip(260 + Math.hypot(dx, dy) * 20, 0.12, "triangle", 0.16);
	};

	const s = stateRef.current;
	return (
		<div style={{ background: "#3d2a18", color: "#fff", padding: 12, fontFamily: "'Courier New', monospace" }}>
			<h2 style={{ margin: 0 }}>Paper Birds</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Drag to launch. Gold rings = 3pts, small = 2pts. Every 3-hit combo refills ammo.
			</div>
			<div style={{ marginTop: 4, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
				<div>Score: {s.score}</div>
				<div>Best: {best}</div>
				<div>Ammo: {s.ammo}</div>
				<div>Combo: {s.combo}</div>
				<div>Time: {s.time.toFixed(1)}s</div>
				<div style={{ opacity: 0.7 }}>Seed {seed}</div>
				<button type="button" onClick={() => setSeed(todayUTCSeed())} style={{ background: "#c48a4a", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					Daily
				</button>
				<button type="button" onClick={() => setSeed(Math.floor(Math.random() * 0x7fffffff))} style={{ background: "#8a4a7a", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					New Seed
				</button>
				{s.over && (
					<button type="button" onClick={reset} style={{ background: "#4ac88a", color: "#000", border: 0, padding: "2px 10px", borderRadius: 4 }}>
						Restart
					</button>
				)}
			</div>
			<canvas
				ref={canvasRef}
				width={W}
				height={H}
				onPointerDown={onDown}
				onPointerMove={onMove}
				onPointerUp={onUp}
				style={{ display: "block", marginTop: 8, borderRadius: 6, cursor: "crosshair", touchAction: "none" }}
			/>
		</div>
	);
}
