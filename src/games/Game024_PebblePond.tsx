import { useEffect, useRef, useState } from "react";

// Drop pebbles. Ripples expand from each drop and "ring" any lily pad they
// pass through. You must ring lily pads in numeric order to score. Wrong
// order resets the sequence on the affected pad.

type Pebble = { x: number; y: number; t: number };
type Pad = { x: number; y: number; n: number; rung: boolean };

const WAVE_SPEED = 90; // px per second
const WAVE_LIFE = 4.5; // seconds

function buildPads(n: number, w: number, h: number): Pad[] {
	const pads: Pad[] = [];
	for (let i = 0; i < n; i++) {
		let tries = 0;
		while (tries++ < 50) {
			const x = 80 + Math.random() * (w - 160);
			const y = 80 + Math.random() * (h - 160);
			const ok = pads.every(
				(p) => Math.hypot(p.x - x, p.y - y) > 90,
			);
			if (ok) {
				pads.push({ x, y, n: i + 1, rung: false });
				break;
			}
		}
	}
	return pads;
}

export default function PebblePond() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [size] = useState({ w: 760, h: 520 });
	const [pads, setPads] = useState<Pad[]>(() => buildPads(5, 760, 520));
	const [pebbles, setPebbles] = useState<Pebble[]>([]);
	const [next, setNext] = useState(1);
	const [score, setScore] = useState(0);
	const [pebsUsed, setPebsUsed] = useState(0);
	const rafRef = useRef<number | undefined>(undefined);
	const startRef = useRef<number>(performance.now());

	// Refs to avoid stale closures inside rAF.
	const pebblesRef = useRef(pebbles);
	const padsRef = useRef(pads);
	const nextRef = useRef(next);
	pebblesRef.current = pebbles;
	padsRef.current = pads;
	nextRef.current = next;

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
			for (const p of pebblesRef.current) {
				const age = now - p.t;
				if (age > WAVE_LIFE) continue;
				const r = age * WAVE_SPEED;
				const prevR = Math.max(0, (age - 1 / 60) * WAVE_SPEED);
				for (const pad of padCopy) {
					if (pad.rung) continue;
					const d = Math.hypot(pad.x - p.x, pad.y - p.y);
					if (d <= r && d > prevR) {
						// wave passes pad this frame
						if (pad.n === nextN) {
							pad.rung = true;
							nextN++;
							scoreDelta += 20;
						} else {
							// wrong order: pad is "splashed" but stays unrung;
							// small penalty
							scoreDelta -= 3;
						}
					}
				}
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
			// soft gradient overlay
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

			// ripples
			ctx.lineWidth = 2;
			for (const p of newPebbles) {
				const age = now - p.t;
				const r = age * WAVE_SPEED;
				const alpha = Math.max(0, 1 - age / WAVE_LIFE);
				// primary ring
				ctx.strokeStyle = `rgba(180,220,255,${alpha * 0.8})`;
				ctx.beginPath();
				ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
				ctx.stroke();
				// secondary echo
				if (r > 30) {
					ctx.strokeStyle = `rgba(140,200,255,${alpha * 0.3})`;
					ctx.beginPath();
					ctx.arc(p.x, p.y, r - 18, 0, Math.PI * 2);
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
			rafRef.current = requestAnimationFrame(render);
		};
		rafRef.current = requestAnimationFrame(render);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [size.w, size.h]);

	const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const t = (performance.now() - startRef.current) / 1000;
		setPebbles((p) => [...p, { x, y, t }]);
		setPebsUsed((c) => c + 1);
	};

	const allRung = pads.every((p) => p.rung);

	const reset = () => {
		setPads(buildPads(5, size.w, size.h));
		setPebbles([]);
		setNext(1);
		setScore(0);
		setPebsUsed(0);
		startRef.current = performance.now();
	};

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
			}}
		>
			<h2 style={{ margin: 0 }}>Pebble Pond</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Click to drop pebbles. Ring lily pads in order 1→{pads.length}.
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
			<div
				style={{ marginTop: 8, display: "flex", gap: 24, fontSize: 14 }}
			>
				<div>Next: {next > pads.length ? "—" : next}</div>
				<div>Score: {score}</div>
				<div>Pebbles: {pebsUsed}</div>
				{allRung && (
					<div style={{ color: "#9bcc70" }}>
						All rung! Final: {score - pebsUsed * 2}
					</div>
				)}
				<button
					type="button"
					onClick={reset}
					style={{
						padding: "4px 12px",
						background: "#234",
						color: "#fff",
						border: "1px solid #456",
						borderRadius: 3,
						cursor: "pointer",
					}}
				>
					Reset
				</button>
			</div>
		</div>
	);
}
