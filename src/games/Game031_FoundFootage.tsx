import { useEffect, useRef, useState } from "react";

type Anomaly = {
	id: number;
	x: number; // 0..1
	y: number; // 0..1
	r: number; // radius in px
	phase: number; // start time within loop (0..1)
	duration: number; // visible fraction of loop
	kind: "shimmer" | "shift" | "ghost" | "flicker" | "pulse";
	found: boolean;
};

const LOOP_MS = 6000;

function rand(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

function genAnomalies(seed: number): Anomaly[] {
	const r = rand(seed);
	const kinds: Anomaly["kind"][] = ["shimmer", "shift", "ghost", "flicker", "pulse"];
	return Array.from({ length: 5 }, (_, i) => ({
		id: i,
		x: 0.12 + r() * 0.76,
		y: 0.15 + r() * 0.7,
		r: 28 + r() * 16,
		phase: r(),
		duration: 0.18 + r() * 0.22,
		kind: kinds[i],
		found: false,
	}));
}

export default function FoundFootage() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [anomalies, setAnomalies] = useState<Anomaly[]>(() => genAnomalies(seed));
	const [t, setT] = useState(0); // 0..1 loop position
	const [misses, setMisses] = useState(0);
	const [startTime] = useState(() => performance.now());
	const startRef = useRef(performance.now());
	const canvasRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let raf = 0;
		const tick = () => {
			const elapsed = (performance.now() - startRef.current) % LOOP_MS;
			setT(elapsed / LOOP_MS);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	const newClip = () => {
		const s = Math.floor(Math.random() * 1e9);
		setSeed(s);
		setAnomalies(genAnomalies(s));
		setMisses(0);
		startRef.current = performance.now();
	};

	const isVisible = (a: Anomaly) => {
		const local = (t - a.phase + 1) % 1;
		return local < a.duration;
	};

	const handleClick = (e: React.MouseEvent) => {
		const rect = canvasRef.current!.getBoundingClientRect();
		const cx = (e.clientX - rect.left) / rect.width;
		const cy = (e.clientY - rect.top) / rect.height;
		let hit = false;
		setAnomalies((prev) =>
			prev.map((a) => {
				if (a.found) return a;
				const dx = (cx - a.x) * rect.width;
				const dy = (cy - a.y) * rect.height;
				if (Math.hypot(dx, dy) < a.r + 8 && isVisible(a)) {
					hit = true;
					return { ...a, found: true };
				}
				return a;
			}),
		);
		if (!hit) setMisses((m) => m + 1);
	};

	const foundCount = anomalies.filter((a) => a.found).length;
	const won = foundCount === 5;
	const score = Math.max(0, 500 - misses * 30 - Math.floor((performance.now() - startTime) / 100));

	// Background "footage" - moving gradient + grain
	const bgPhase = t * Math.PI * 2;

	return (
		<div style={{ background: "#0a0a0c", color: "#ddd", padding: 16, fontFamily: "monospace" }}>
			<h2 style={{ margin: "0 0 4px" }}>Found Footage</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Click the 5 subtle anomalies hidden in the loop. Misses cost score.
			</div>
			<div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8 }}>
				<div>Found: {foundCount}/5</div>
				<div>Misses: {misses}</div>
				<div>Loop: {(t * 100).toFixed(0)}%</div>
				<button type="button" onClick={newClip} style={btn}>
					New Clip
				</button>
				{won && <div style={{ color: "#7f7" }}>SOLVED · {score}</div>}
			</div>
			<div
				ref={canvasRef}
				onClick={handleClick}
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 860,
					aspectRatio: "16 / 10",
					background: `radial-gradient(circle at ${50 + Math.sin(bgPhase) * 10}% ${50 + Math.cos(bgPhase) * 10}%, #2a2a35, #0c0c10 70%)`,
					border: "2px solid #333",
					overflow: "hidden",
					cursor: "crosshair",
					filter: "contrast(1.05)",
				}}
			>
				{/* scanlines */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						backgroundImage:
							"repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px)",
						pointerEvents: "none",
					}}
				/>
				{/* grain */}
				<div
					style={{
						position: "absolute",
						inset: 0,
						opacity: 0.18,
						mixBlendMode: "overlay",
						backgroundImage:
							"radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1px)",
						backgroundSize: "3px 3px, 5px 5px",
						backgroundPosition: `${Math.floor(t * 200)}px ${Math.floor(t * 300)}px, 0 0`,
						pointerEvents: "none",
					}}
				/>
				{/* anomalies */}
				{anomalies.map((a) => {
					const vis = isVisible(a);
					if (!vis && !a.found) return null;
					const local = (t - a.phase + 1) % 1;
					const phaseT = local / a.duration; // 0..1
					const alpha = Math.sin(phaseT * Math.PI); // fade in/out
					return (
						<div
							key={a.id}
							style={{
								position: "absolute",
								left: `calc(${a.x * 100}% - ${a.r}px)`,
								top: `calc(${a.y * 100}% - ${a.r}px)`,
								width: a.r * 2,
								height: a.r * 2,
								borderRadius: "50%",
								background: a.found
									? "rgba(120,255,140,0.35)"
									: a.kind === "shimmer"
										? `radial-gradient(circle, rgba(255,255,255,${alpha * 0.35}), transparent 70%)`
										: a.kind === "shift"
											? `radial-gradient(circle, rgba(180,200,255,${alpha * 0.35}), transparent 70%)`
											: a.kind === "ghost"
												? `radial-gradient(circle, rgba(255,180,180,${alpha * 0.32}), transparent 70%)`
												: a.kind === "flicker"
													? `radial-gradient(circle, rgba(255,255,180,${alpha * (Math.sin(phaseT * 30) * 0.5 + 0.5) * 0.4}), transparent 70%)`
													: `radial-gradient(circle, rgba(200,160,255,${alpha * 0.34}), transparent 70%)`,
								border: a.found ? "2px solid #6f6" : "none",
								pointerEvents: "none",
								transition: a.found ? "all 0.3s" : undefined,
							}}
						/>
					);
				})}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#222",
	color: "#ddd",
	border: "1px solid #444",
	padding: "4px 10px",
	cursor: "pointer",
	fontFamily: "monospace",
};
