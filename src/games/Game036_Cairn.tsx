import { useEffect, useRef, useState } from "react";

// Stack 10 uneven stones. Simple 2D physics: rectangles with rotation, gravity,
// resting on each other or the ground. After placement they settle.
// Goal: place all 10 and have the tower hold steady (no stone moving) for 3 seconds.

type Stone = {
	x: number;
	y: number;
	w: number;
	h: number;
	angle: number; // radians
	vx: number;
	vy: number;
	va: number;
	settled: boolean;
};

const W = 700;
const H = 540;
const GROUND_Y = 510;

function rand() {
	return Math.random();
}

function genStone(): { w: number; h: number } {
	const w = 50 + rand() * 80;
	const h = 22 + rand() * 30;
	return { w, h };
}

function getCorners(s: Stone) {
	const cos = Math.cos(s.angle);
	const sin = Math.sin(s.angle);
	const hw = s.w / 2;
	const hh = s.h / 2;
	const pts = [
		[-hw, -hh],
		[hw, -hh],
		[hw, hh],
		[-hw, hh],
	];
	return pts.map(([px, py]) => ({ x: s.x + px * cos - py * sin, y: s.y + px * sin + py * cos }));
}

function rectsOverlap(a: Stone, b: Stone) {
	// SAT for OBB
	const axes = [a, b].flatMap((s) => {
		const c = Math.cos(s.angle);
		const sn = Math.sin(s.angle);
		return [
			{ x: c, y: sn },
			{ x: -sn, y: c },
		];
	});
	const ac = getCorners(a);
	const bc = getCorners(b);
	for (const axis of axes) {
		let minA = Infinity,
			maxA = -Infinity,
			minB = Infinity,
			maxB = -Infinity;
		for (const p of ac) {
			const d = p.x * axis.x + p.y * axis.y;
			minA = Math.min(minA, d);
			maxA = Math.max(maxA, d);
		}
		for (const p of bc) {
			const d = p.x * axis.x + p.y * axis.y;
			minB = Math.min(minB, d);
			maxB = Math.max(maxB, d);
		}
		if (maxA < minB || maxB < minA) return false;
	}
	return true;
}

export default function Cairn() {
	const [stones, setStones] = useState<Stone[]>([]);
	const [next, setNext] = useState<{ w: number; h: number }>(genStone);
	const [placed, setPlaced] = useState(0);
	const [previewX, setPreviewX] = useState(W / 2);
	const [holdTime, setHoldTime] = useState(0);
	const [status, setStatus] = useState<"playing" | "won" | "fallen">("playing");
	const lastT = useRef(performance.now());
	const stonesRef = useRef(stones);
	stonesRef.current = stones;

	useEffect(() => {
		let raf = 0;
		const step = (now: number) => {
			const dt = Math.min(0.033, (now - lastT.current) / 1000);
			lastT.current = now;
			setStones((prev) => {
				const ns = prev.map((s) => ({ ...s }));
				for (const s of ns) {
					if (s.settled) continue;
					s.vy += 800 * dt;
					s.x += s.vx * dt;
					s.y += s.vy * dt;
					s.angle += s.va * dt;
					s.va *= 0.99;
					// ground collision (lowest corner)
					const corners = getCorners(s);
					const lowest = Math.max(...corners.map((c) => c.y));
					if (lowest > GROUND_Y) {
						const overlap = lowest - GROUND_Y;
						s.y -= overlap;
						s.vy *= -0.2;
						// torque from ground contact point: find lowest corner index
						const idx = corners.findIndex((c) => c.y === lowest);
						const lp = corners[idx];
						const dx = lp.x - s.x;
						s.va += dx * 0.001;
						s.vy *= 0.7;
						s.vx *= 0.85;
						if (Math.abs(s.vy) < 5 && Math.abs(s.va) < 0.05) {
							s.vy = 0;
							s.va *= 0.5;
						}
					}
				}
				// pairwise: stop falling on collision with settled or any other stone below
				for (let i = 0; i < ns.length; i++) {
					for (let j = 0; j < ns.length; j++) {
						if (i === j) continue;
						const a = ns[i];
						const b = ns[j];
						if (a.settled) continue;
						if (rectsOverlap(a, b)) {
							// push a upward
							const dy = a.y - b.y;
							const push = Math.min(5, b.h * 0.5 + a.h * 0.5 - Math.abs(dy));
							a.y -= push;
							a.vy = Math.min(a.vy, 0) * 0.3;
							// tip torque based on contact offset
							const offset = a.x - b.x;
							a.va += offset * 0.0008;
							a.vx += offset * 0.1 * dt;
						}
					}
				}
				// mark settled
				for (const s of ns) {
					if (!s.settled && Math.abs(s.vy) < 3 && Math.abs(s.vx) < 3 && Math.abs(s.va) < 0.04) {
						// don't auto-settle - we need to detect movement for win
					}
				}
				return ns;
			});

			// detect stillness and falls
			const cur = stonesRef.current;
			const anyMoving = cur.some(
				(s) => Math.abs(s.vy) > 3 || Math.abs(s.vx) > 3 || Math.abs(s.va) > 0.04,
			);
			const anyFallen = cur.some((s) => {
				const corners = getCorners(s);
				return corners.every((c) => c.x < 0 || c.x > W);
			});
			if (anyFallen) {
				setStatus((st) => (st === "playing" ? "fallen" : st));
			}
			if (placed >= 10 && !anyMoving && status === "playing") {
				setHoldTime((t) => t + dt);
			} else if (anyMoving) {
				setHoldTime(0);
			}
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [placed, status]);

	useEffect(() => {
		if (holdTime >= 3 && status === "playing" && placed >= 10) setStatus("won");
	}, [holdTime, placed, status]);

	const handleClick = () => {
		if (placed >= 10 || status !== "playing") return;
		const stone: Stone = {
			x: previewX,
			y: 60,
			w: next.w,
			h: next.h,
			angle: (rand() - 0.5) * 0.4,
			vx: 0,
			vy: 0,
			va: 0,
			settled: false,
		};
		setStones((s) => [...s, stone]);
		setPlaced((p) => p + 1);
		setNext(genStone());
		setHoldTime(0);
	};

	const reset = () => {
		setStones([]);
		setPlaced(0);
		setHoldTime(0);
		setStatus("playing");
		setNext(genStone());
	};

	return (
		<div style={{ background: "#181a1f", color: "#eee", padding: 16, fontFamily: "sans-serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Cairn</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Move mouse to aim, click to drop a stone. Stack all 10; hold for 3 seconds to win.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
				<div>Placed: {placed}/10</div>
				<div>Hold: {holdTime.toFixed(1)}s / 3.0s</div>
				<button type="button" onClick={reset}>
					Reset
				</button>
				{status === "won" && <span style={{ color: "#7f7" }}>YOU WIN</span>}
				{status === "fallen" && <span style={{ color: "#f77" }}>Toppled!</span>}
			</div>
			<svg
				width={W}
				height={H}
				style={{ background: "linear-gradient(#1a2030, #20242a)", cursor: "crosshair", display: "block" }}
				onMouseMove={(e) => {
					const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
					setPreviewX(e.clientX - r.left);
				}}
				onClick={handleClick}
			>
				<rect x={0} y={GROUND_Y} width={W} height={H - GROUND_Y} fill="#3a2a1a" />
				{placed < 10 && status === "playing" && (
					<rect
						x={previewX - next.w / 2}
						y={40 - next.h / 2}
						width={next.w}
						height={next.h}
						fill="rgba(180,160,140,0.35)"
						stroke="#aaa"
						strokeDasharray="3 3"
					/>
				)}
				{stones.map((s, i) => {
					const corners = getCorners(s);
					const pts = corners.map((c) => `${c.x},${c.y}`).join(" ");
					return <polygon key={i} points={pts} fill="#888070" stroke="#3a3025" strokeWidth={1.5} />;
				})}
			</svg>
		</div>
	);
}
