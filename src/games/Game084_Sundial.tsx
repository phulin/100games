import { useEffect, useMemo, useRef, useState } from "react";

type Marker = { angle: number; label: string };

const EVENTS = [
	{ key: "dawn", label: "Dawn", hour: 6 },
	{ key: "noon", label: "Noon prayer", hour: 12 },
	{ key: "evening", label: "Evening bell", hour: 18 },
	{ key: "harvest", label: "Harvest call", hour: 9 },
	{ key: "rest", label: "Rest hour", hour: 15 },
];

// Map sun hour (0-24) to shadow angle for a vertical gnomon.
// Simplified: angle = (hour - 12) * 15 degrees, then offset by seasonal drift.
function shadowAngle(hour: number, season: number) {
	// season 0..1 -> drift -20..+20 degrees offset
	const drift = (season - 0.5) * 40;
	return (hour - 12) * 15 + drift;
}

export default function Game084_Sundial() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [season, setSeason] = useState(0.5);
	const [hour, setHour] = useState(12);
	const [markers, setMarkers] = useState<Marker[]>([]);
	const [selectedEvent, setSelectedEvent] = useState(EVENTS[0].key);
	const [autoplay, setAutoplay] = useState(false);

	useEffect(() => {
		if (!autoplay) return;
		let raf = 0;
		const start = performance.now();
		const initial = hour;
		const tick = (t: number) => {
			const elapsed = (t - start) / 1000;
			const nh = ((initial + elapsed * 2) % 18) + 6; // 6 to 24
			setHour(nh);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [autoplay]);

	useEffect(() => {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		const W = c.width;
		const H = c.height;
		ctx.fillStyle = "#0e1622";
		ctx.fillRect(0, 0, W, H);
		const cx = W / 2;
		const cy = H / 2 + 30;
		const R = 200;

		// dial face
		ctx.beginPath();
		ctx.arc(cx, cy, R, Math.PI, 0);
		ctx.fillStyle = "#d6c896";
		ctx.fill();
		ctx.strokeStyle = "#3a2a1a";
		ctx.lineWidth = 3;
		ctx.stroke();

		// hour ticks
		for (let h = 6; h <= 18; h++) {
			const a = ((h - 12) * 15 * Math.PI) / 180 - Math.PI / 2;
			const x1 = cx + Math.cos(a) * (R - 10);
			const y1 = cy + Math.sin(a) * (R - 10);
			const x2 = cx + Math.cos(a) * R;
			const y2 = cy + Math.sin(a) * R;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.strokeStyle = "#3a2a1a";
			ctx.lineWidth = 1;
			ctx.stroke();
		}

		// gnomon
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx, cy - 40);
		ctx.strokeStyle = "#222";
		ctx.lineWidth = 5;
		ctx.stroke();

		// markers
		for (const m of markers) {
			const a = (m.angle * Math.PI) / 180 - Math.PI / 2;
			const mx = cx + Math.cos(a) * (R - 20);
			const my = cy + Math.sin(a) * (R - 20);
			ctx.beginPath();
			ctx.arc(mx, my, 8, 0, Math.PI * 2);
			ctx.fillStyle = "#3060ff";
			ctx.fill();
			ctx.fillStyle = "#fff";
			ctx.font = "11px sans-serif";
			ctx.fillText(m.label, mx + 10, my);
		}

		// shadow
		const ang = (shadowAngle(hour, season) * Math.PI) / 180 - Math.PI / 2;
		const sx = cx + Math.cos(ang) * (R - 5);
		const sy = cy + Math.sin(ang) * (R - 5);
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(sx, sy);
		ctx.strokeStyle = "rgba(0,0,0,0.55)";
		ctx.lineWidth = 8;
		ctx.lineCap = "round";
		ctx.stroke();

		// labels
		ctx.fillStyle = "#fff";
		ctx.font = "14px sans-serif";
		ctx.fillText(`Hour: ${hour.toFixed(2)}`, 20, 30);
		ctx.fillText(
			`Season: ${season < 0.33 ? "Winter" : season < 0.66 ? "Spring/Fall" : "Summer"}`,
			20,
			50,
		);
	}, [hour, season, markers]);

	const place = () => {
		const a = shadowAngle(hour, season);
		const ev = EVENTS.find((e) => e.key === selectedEvent);
		if (!ev) return;
		setMarkers([
			...markers.filter((m) => m.label !== ev.label),
			{ angle: a, label: ev.label },
		]);
	};

	const score = useMemo(() => {
		// Score: average error across all seasons (sample 5 seasons) and events placed.
		if (markers.length === 0) return null;
		const seasons = [0, 0.25, 0.5, 0.75, 1];
		let totalErr = 0;
		let count = 0;
		for (const ev of EVENTS) {
			const m = markers.find((mm) => mm.label === ev.label);
			if (!m) continue;
			for (const s of seasons) {
				const ideal = shadowAngle(ev.hour, s);
				totalErr += Math.abs(((m.angle - ideal + 540) % 360) - 180);
				count++;
			}
		}
		return count > 0 ? totalErr / count : null;
	}, [markers]);

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#f0e6d2",
				background: "#0a0e15",
				padding: 16,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>84. Sundial</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Drag the season/hour. Place stones at the times of named events. The
				sun's path drifts each season — best stones average well.
			</div>
			<canvas
				ref={canvasRef}
				width={600}
				height={400}
				style={{ background: "#000", display: "block" }}
			/>
			<div
				style={{
					marginTop: 12,
					display: "flex",
					gap: 12,
					alignItems: "center",
					flexWrap: "wrap",
				}}
			>
				<label>
					Hour{" "}
					<input
						type="range"
						min={6}
						max={18}
						step={0.05}
						value={hour}
						onChange={(e) => setHour(parseFloat(e.target.value))}
					/>
				</label>
				<label>
					Season{" "}
					<input
						type="range"
						min={0}
						max={1}
						step={0.01}
						value={season}
						onChange={(e) => setSeason(parseFloat(e.target.value))}
					/>
				</label>
				<button
					type="button"
					onClick={() => setAutoplay((a) => !a)}
					style={btn}
				>
					{autoplay ? "Stop time" : "Pass time"}
				</button>
				<select
					value={selectedEvent}
					onChange={(e) => setSelectedEvent(e.target.value)}
					style={{ ...btn, padding: "6px 8px" }}
				>
					{EVENTS.map((e) => (
						<option key={e.key} value={e.key}>
							{e.label}
						</option>
					))}
				</select>
				<button type="button" onClick={place} style={btn}>
					Place stone
				</button>
				<button type="button" onClick={() => setMarkers([])} style={btn}>
					Clear
				</button>
				{score !== null && (
					<div>Avg error: {score.toFixed(1)}° (lower better)</div>
				)}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#5a3a20",
	color: "#fff",
	border: "1px solid #8a5a30",
	borderRadius: 4,
	cursor: "pointer",
};
