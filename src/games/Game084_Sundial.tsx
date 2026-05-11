import { useEffect, useMemo, useRef, useState } from "react";

type Marker = { angle: number; label: string };
type EventDef = { key: string; label: string; hour: number };

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

function dailySeed() {
	const d = new Date();
	return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const EVENT_NAMES = [
	"Dawn watch", "First plow", "Mid prayer", "Noon meal", "Trade bell",
	"Court session", "Tea ritual", "Evening hymn", "Vespers", "Lamp lighting",
	"Watchman's call", "Harvest call", "Rest hour", "Market open",
];

function makeEvents(seed: number, count: number): EventDef[] {
	const rng = mulberry32(seed);
	const names = EVENT_NAMES.slice().sort(() => rng() - 0.5);
	const out: EventDef[] = [];
	for (let i = 0; i < count; i++) {
		const hour = 6 + rng() * 12;
		out.push({ key: `ev${i}`, label: names[i % names.length], hour: Math.round(hour * 2) / 2 });
	}
	return out;
}

function shadowAngle(hour: number, season: number, latitude: number) {
	const drift = (season - 0.5) * 60 * latitude;
	return (hour - 12) * 15 + drift;
}

let audioCtx: AudioContext | null = null;
function bell(freq: number) {
	if (typeof window === "undefined") return;
	try {
		if (!audioCtx)
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
	} catch { return; }
	const ctx = audioCtx; if (!ctx) return;
	const o = ctx.createOscillator();
	const o2 = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = "sine"; o2.type = "sine";
	o.frequency.value = freq;
	o2.frequency.value = freq * 2.01;
	g.gain.value = 0.12;
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
	o.connect(g); o2.connect(g); g.connect(ctx.destination);
	o.start(); o2.start();
	o.stop(ctx.currentTime + 1.2);
	o2.stop(ctx.currentTime + 1.2);
}

export default function Game084_Sundial() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [seed, setSeed] = useState(() => dailySeed());
	const events = useMemo(() => makeEvents(seed, 5), [seed]);
	const [season, setSeason] = useState(0.5);
	const [hour, setHour] = useState(12);
	const [latitude, setLatitude] = useState(0.5);
	const [cloud, setCloud] = useState(0);
	const [markers, setMarkers] = useState<Marker[]>([]);
	const [selectedEvent, setSelectedEvent] = useState(events[0].key);
	const [autoplay, setAutoplay] = useState(false);
	const lastHourRef = useRef(hour);

	useEffect(() => {
		setMarkers([]);
		setSelectedEvent(events[0].key);
	}, [seed, events]);

	useEffect(() => {
		if (!autoplay) return;
		let raf = 0;
		const start = performance.now();
		const initial = hour;
		const tick = (t: number) => {
			const elapsed = (t - start) / 1000;
			const nh = 6 + ((initial - 6 + elapsed * 2) % 12);
			setHour(nh);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoplay]);

	useEffect(() => {
		const prev = lastHourRef.current;
		const ph = Math.floor(prev);
		const ch = Math.floor(hour);
		if (ch !== ph && ch >= 6 && ch <= 18) bell(400 + (ch - 6) * 20);
		lastHourRef.current = hour;
	}, [hour]);

	useEffect(() => {
		const c = canvasRef.current; if (!c) return;
		const ctx = c.getContext("2d"); if (!ctx) return;
		const W = c.width; const H = c.height;
		const grad = ctx.createLinearGradient(0, 0, 0, H);
		const dayness = 1 - cloud * 0.6;
		grad.addColorStop(0, `rgb(${(20 * dayness) | 0},${(30 * dayness) | 0},${(50 + 30 * dayness) | 0})`);
		grad.addColorStop(1, "#0e1622");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, W, H);
		const cx = W / 2; const cy = H / 2 + 30; const R = 200;

		ctx.beginPath();
		ctx.arc(cx, cy, R, Math.PI, 0);
		ctx.fillStyle = "#d6c896"; ctx.fill();
		ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 3; ctx.stroke();

		for (let h = 6; h <= 18; h++) {
			const a = ((h - 12) * 15 * Math.PI) / 180 - Math.PI / 2;
			const x1 = cx + Math.cos(a) * (R - 10);
			const y1 = cy + Math.sin(a) * (R - 10);
			const x2 = cx + Math.cos(a) * R;
			const y2 = cy + Math.sin(a) * R;
			ctx.beginPath();
			ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
			ctx.strokeStyle = "#3a2a1a";
			ctx.lineWidth = h % 3 === 0 ? 2 : 1;
			ctx.stroke();
		}

		ctx.beginPath();
		ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 40);
		ctx.strokeStyle = "#222"; ctx.lineWidth = 5; ctx.stroke();

		for (const m of markers) {
			const a = (m.angle * Math.PI) / 180 - Math.PI / 2;
			const mx = cx + Math.cos(a) * (R - 20);
			const my = cy + Math.sin(a) * (R - 20);
			ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2);
			ctx.fillStyle = "#3060ff"; ctx.fill();
			ctx.fillStyle = "#fff"; ctx.font = "11px sans-serif";
			ctx.fillText(m.label, mx + 10, my);
		}

		const ang = (shadowAngle(hour, season, latitude) * Math.PI) / 180 - Math.PI / 2;
		const sx = cx + Math.cos(ang) * (R - 5);
		const sy = cy + Math.sin(ang) * (R - 5);
		ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy);
		ctx.strokeStyle = `rgba(0,0,0,${0.55 - cloud * 0.45})`;
		ctx.lineWidth = 8; ctx.lineCap = "round"; ctx.stroke();

		ctx.fillStyle = "#fff"; ctx.font = "14px sans-serif";
		ctx.fillText(`Hour: ${hour.toFixed(2)}`, 20, 30);
		ctx.fillText(`Season: ${season < 0.33 ? "Winter" : season < 0.66 ? "Spring/Fall" : "Summer"}`, 20, 50);
		ctx.fillText(`Latitude: ${(latitude * 90).toFixed(0)}°`, 20, 70);
		if (cloud > 0.5) ctx.fillText("Overcast — shadows faint", 20, 90);
	}, [hour, season, latitude, cloud, markers]);

	const place = () => {
		const a = shadowAngle(hour, season, latitude);
		const ev = events.find((e) => e.key === selectedEvent);
		if (!ev) return;
		setMarkers([...markers.filter((m) => m.label !== ev.label), { angle: a, label: ev.label }]);
		bell(520);
	};

	const score = useMemo(() => {
		if (markers.length === 0) return null;
		const seasons = [0, 0.25, 0.5, 0.75, 1];
		let totalErr = 0; let count = 0;
		const breakdown: { label: string; err: number }[] = [];
		for (const ev of events) {
			const m = markers.find((mm) => mm.label === ev.label);
			if (!m) continue;
			let evErr = 0; let evCount = 0;
			for (const s of seasons) {
				const ideal = shadowAngle(ev.hour, s, latitude);
				const d = Math.abs(((m.angle - ideal + 540) % 360) - 180);
				evErr += d; totalErr += d; evCount++; count++;
			}
			breakdown.push({ label: ev.label, err: evErr / evCount });
		}
		return { avg: count > 0 ? totalErr / count : 0, breakdown };
	}, [markers, events, latitude]);

	const newSeed = () => setSeed(Math.floor(Math.random() * 1e9));
	const daily = () => setSeed(dailySeed());

	return (
		<div style={{ fontFamily: "Georgia, serif", color: "#f0e6d2", background: "#0a0e15", padding: 16, minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>84. Sundial</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Drag hour, season, latitude. Place stones for named events generated from the seed. The sun's path drifts each season.
			</div>
			<canvas ref={canvasRef} width={600} height={400} style={{ background: "#000", display: "block" }} />
			<div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
				<label>Hour <input type="range" min={6} max={18} step={0.05} value={hour} onChange={(e) => setHour(parseFloat(e.target.value))} /></label>
				<label>Season <input type="range" min={0} max={1} step={0.01} value={season} onChange={(e) => setSeason(parseFloat(e.target.value))} /></label>
				<label>Latitude <input type="range" min={0} max={1} step={0.01} value={latitude} onChange={(e) => setLatitude(parseFloat(e.target.value))} /></label>
				<label>Clouds <input type="range" min={0} max={1} step={0.01} value={cloud} onChange={(e) => setCloud(parseFloat(e.target.value))} /></label>
				<button type="button" onClick={() => setAutoplay((a) => !a)} style={btn}>{autoplay ? "Stop time" : "Pass time"}</button>
				<select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} style={{ ...btn, padding: "6px 8px" }}>
					{events.map((e) => (<option key={e.key} value={e.key}>{e.label} ({e.hour}h)</option>))}
				</select>
				<button type="button" onClick={place} style={btn}>Place stone</button>
				<button type="button" onClick={() => setMarkers([])} style={btn}>Clear</button>
				<button type="button" onClick={daily} style={btn}>Daily</button>
				<button type="button" onClick={newSeed} style={btn}>New seed</button>
			</div>
			{score !== null && (
				<div style={{ marginTop: 12, fontSize: 13 }}>
					<div>Avg error: {score.avg.toFixed(1)}° (lower better)</div>
					<ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
						{score.breakdown.map((b) => (<li key={b.label}>{b.label}: {b.err.toFixed(1)}°</li>))}
					</ul>
				</div>
			)}
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
