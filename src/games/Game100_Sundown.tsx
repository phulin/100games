import { useEffect, useRef, useState } from "react";

// Daily-seeded sun descent. Press space when sun fully below horizon.
function seedFromDate(): number {
	const d = new Date();
	return (
		d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
	);
}
function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const W = 720,
	H = 460;
const DURATION = 12000; // ms — sun travels from start to fully below

export default function Game100_Sundown() {
	const seed = seedFromDate();
	const rng = useRef(mulberry32(seed));
	const startedAt = useRef<number | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
	const [result, setResult] = useState<{ err: number; score: number } | null>(
		null,
	);
	const elapsedRef = useRef(0);

	// landscape (deterministic from seed)
	const landscape = useRef<{ horizon: number; hills: number[] }>({
		horizon: 0,
		hills: [],
	});

	useEffect(() => {
		const r = rng.current;
		const horizon = H * (0.55 + r() * 0.1);
		const hills: number[] = [];
		for (let i = 0; i <= 40; i++) {
			hills.push(horizon - (r() * 18 + Math.sin(i * 0.5 + r() * 6) * 10));
		}
		landscape.current = { horizon, hills };
		draw(0);
	}, [draw]);

	useEffect(() => {
		let raf = 0;
		function tick(now: number) {
			if (phase !== "running") return;
			if (startedAt.current == null) startedAt.current = now;
			elapsedRef.current = now - startedAt.current;
			draw(elapsedRef.current);
			if (elapsedRef.current < DURATION + 2000)
				raf = requestAnimationFrame(tick);
			else if (phase === "running") {
				// ran out
				setPhase("done");
				setResult({ err: 9999, score: 0 });
			}
		}
		if (phase === "running") raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [phase, draw]);

	function start() {
		setPhase("running");
		startedAt.current = null;
		setResult(null);
	}
	function tap() {
		if (phase !== "running") return;
		const t = elapsedRef.current / DURATION; // 0..1
		// sun fully below when sunY (top edge) > horizon — let's analytically compute target t
		// sun travels from y=80 to y=horizon+80 (radius=40), fully below when y - 40 >= horizon
		const sunRadius = 40;
		const startY = 80;
		const endY = landscape.current.horizon + 80;
		// y(t) = startY + t * (endY - startY); we want y(t) - sunRadius = horizon => t* = (horizon + r - startY) / (endY - startY)
		const targetT =
			(landscape.current.horizon + sunRadius - startY) / (endY - startY);
		const err = Math.abs(t - targetT);
		const errPx = err * (endY - startY);
		const score = Math.max(0, Math.round(1000 - errPx * 50));
		setResult({ err: errPx, score });
		setPhase("done");
	}

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.code !== "Space") return;
			e.preventDefault();
			if (phase === "idle") start();
			else if (phase === "running") tap();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [phase, start, tap]);

	function draw(ms: number) {
		const cnv = canvasRef.current;
		if (!cnv) return;
		const ctx = cnv.getContext("2d")!;
		const t = Math.min(1.2, ms / DURATION);
		// sky gradient shifts
		const grad = ctx.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, lerpColor([20, 30, 70], [60, 30, 40], t));
		grad.addColorStop(1, lerpColor([240, 160, 80], [120, 60, 80], t));
		ctx.fillStyle = grad as any;
		ctx.fillRect(0, 0, W, H);

		// sun
		const sunRadius = 40;
		const startY = 80;
		const endY = landscape.current.horizon + 80;
		const sunY = startY + t * (endY - startY);
		const sunX = W * 0.5;
		ctx.fillStyle = "#fff2c0";
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#ffd56a";
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunRadius * 0.85, 0, Math.PI * 2);
		ctx.fill();

		// landscape silhouette
		ctx.fillStyle = "#0a0612";
		ctx.beginPath();
		ctx.moveTo(0, H);
		const step = W / (landscape.current.hills.length - 1);
		landscape.current.hills.forEach((y, i) => ctx.lineTo(i * step, y));
		ctx.lineTo(W, H);
		ctx.closePath();
		ctx.fill();
	}

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "Georgia, serif",
				background: "#0a0612",
				color: "#f4e9d8",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Sundown</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Watch carefully. Press SPACE the moment the sun is fully below the
				horizon. Daily seed: {seed}.
			</p>
			<canvas
				ref={canvasRef}
				width={W}
				height={H}
				style={{ background: "#000", borderRadius: 6, display: "block" }}
			/>

			<div style={{ marginTop: 12, minHeight: 40 }}>
				{phase === "idle" && (
					<button onClick={start}>Begin (or press space)</button>
				)}
				{phase === "running" && <button onClick={tap}>Now! (space)</button>}
				{phase === "done" && result && (
					<>
						<strong>
							{result.err > 999
								? "Missed entirely."
								: `Off by ${result.err.toFixed(1)} pixels.`}
						</strong>{" "}
						Score: <strong>{result.score}</strong>
						<button
							onClick={() => {
								setPhase("idle");
								setResult(null);
							}}
							style={{ marginLeft: 12 }}
						>
							Try again
						</button>
					</>
				)}
			</div>
		</div>
	);
}

function lerpColor(a: number[], b: number[], t: number): string {
	const tt = Math.max(0, Math.min(1, t));
	const r = Math.round(a[0] + (b[0] - a[0]) * tt);
	const g = Math.round(a[1] + (b[1] - a[1]) * tt);
	const bl = Math.round(a[2] + (b[2] - a[2]) * tt);
	return `rgb(${r},${g},${bl})`;
}
