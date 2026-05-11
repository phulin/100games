import { useEffect, useRef, useState } from "react";

// Game 54: Paper Birds
// Launch origami birds by dragging. Hit floating rings for points.

const W = 900;
const H = 600;

type Bird = {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	rot: number;
	life: number;
};
type Ring = { x: number; y: number; r: number; vy: number; passed: boolean };

let BID = 0;

export default function PaperBirds() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const stateRef = useRef({
		birds: [] as Bird[],
		rings: [] as Ring[],
		drag: null as null | { x0: number; y0: number; x: number; y: number },
		score: 0,
		ammo: 12,
		time: 45,
		over: false,
	});
	const [, setTick] = useState(0);

	useEffect(() => {
		// Init rings
		const s = stateRef.current;
		s.rings = Array.from({ length: 5 }, () => ({
			x: 300 + Math.random() * 500,
			y: 100 + Math.random() * 350,
			r: 30 + Math.random() * 20,
			vy: (Math.random() - 0.5) * 0.6,
			passed: false,
		}));
	}, []);

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
				}
			}
			for (const b of s.birds) {
				b.vy += 0.04 * (dt / 16);
				b.vx *= 0.999;
				b.x += b.vx * (dt / 16);
				b.y += b.vy * (dt / 16);
				b.rot = Math.atan2(b.vy, b.vx);
				b.life += dt / 1000;
			}
			s.birds = s.birds.filter((b) => b.x > -50 && b.x < W + 50 && b.y < H + 50 && b.life < 8);
			for (const r of s.rings) {
				r.y += r.vy * (dt / 16);
				if (r.y < 60 || r.y > H - 60) r.vy *= -1;
				for (const b of s.birds) {
					if (!r.passed && Math.hypot(b.x - r.x, b.y - r.y) < r.r * 0.6) {
						r.passed = true;
						s.score += 1;
					}
				}
			}
			// Respawn passed rings
			s.rings = s.rings.map((r) =>
				r.passed
					? {
							x: 300 + Math.random() * 500,
							y: 100 + Math.random() * 350,
							r: 30 + Math.random() * 20,
							vy: (Math.random() - 0.5) * 0.6,
							passed: false,
						}
					: r,
			);

			const ctx = canvasRef.current?.getContext("2d");
			if (ctx) draw(ctx, s);
			setTick((t) => t + 1);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
		// Sky
		const sky = ctx.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, "#ffd6a5");
		sky.addColorStop(1, "#c9e7ff");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, W, H);
		// Sun
		ctx.fillStyle = "#fff3c4";
		ctx.beginPath();
		ctx.arc(700, 130, 60, 0, Math.PI * 2);
		ctx.fill();
		// Rings
		for (const r of s.rings) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
			ctx.stroke();
			ctx.strokeStyle = "#ffb84d";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(r.x, r.y, r.r - 5, 0, Math.PI * 2);
			ctx.stroke();
		}
		// Birds
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
		// Drag indicator
		if (s.drag) {
			ctx.strokeStyle = "#0006";
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.beginPath();
			ctx.moveTo(s.drag.x0, s.drag.y0);
			ctx.lineTo(s.drag.x, s.drag.y);
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}

	function getPos(e: React.PointerEvent) {
		const r = canvasRef.current!.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
	}
	const onDown = (e: React.PointerEvent) => {
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
	};

	function reset() {
		const s = stateRef.current;
		s.birds = [];
		s.score = 0;
		s.ammo = 12;
		s.time = 45;
		s.over = false;
	}

	const s = stateRef.current;
	return (
		<div style={{ background: "#3d2a18", color: "#fff", padding: 12, fontFamily: "'Courier New', monospace" }}>
			<h2 style={{ margin: 0 }}>Paper Birds</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Drag and release to launch origami birds through floating rings. 12 birds, 45 seconds.
			</div>
			<div style={{ marginTop: 4, display: "flex", gap: 16 }}>
				<div>Score: {s.score}</div>
				<div>Ammo: {s.ammo}</div>
				<div>Time: {s.time.toFixed(1)}s</div>
				{s.over && (
					<button type="button" onClick={reset} style={{ background: "#c48a4a", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
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
