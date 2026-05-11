import { useEffect, useMemo, useRef, useState } from "react";

function mulberry32(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
		const Ctor = W.AudioContext ?? W.webkitAudioContext;
		if (!Ctor) return null;
		_ac = new Ctor();
	}
	return _ac;
}
function blip(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.1) {
	const a = ac();
	if (!a) return;
	const o = a.createOscillator();
	const g = a.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = vol;
	g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
	o.connect(g).connect(a.destination);
	o.start();
	o.stop(a.currentTime + dur);
}
function brushSound(intensity: number) {
	const a = ac();
	if (!a) return;
	const dur = 0.08;
	const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		const t = i / data.length;
		data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.5 * intensity;
	}
	const src = a.createBufferSource();
	src.buffer = buf;
	const g = a.createGain();
	g.gain.value = 0.3;
	const bp = a.createBiquadFilter();
	bp.type = "bandpass";
	bp.frequency.value = 1500;
	src.connect(bp).connect(g).connect(a.destination);
	src.start();
}

type Stroke = { points: { x: number; y: number }[]; dir: "h" | "v" | "d" };
type Character = { name: string; strokes: Stroke[] };

const CANVAS_SIZE = 400;

function pts(arr: number[][]): { x: number; y: number }[] {
	return arr.map(([x, y]) => ({ x, y }));
}
function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function strokeSamples(s: Stroke, n = 30) {
	const out: { x: number; y: number }[] = [];
	const total = s.points.length - 1;
	for (let i = 0; i <= n; i++) {
		const t = (i / n) * total;
		const idx = Math.min(Math.floor(t), total - 1);
		const local = t - idx;
		out.push(lerp(s.points[idx], s.points[idx + 1], local));
	}
	return out;
}

function generateCharacter(seed: number): Character {
	const rnd = mulberry32(seed);
	const ideograms: ((r: () => number) => Stroke[])[] = [
		(r) => {
			const n = 1 + Math.floor(r() * 4);
			const strokes: Stroke[] = [];
			for (let i = 0; i < n; i++) {
				const y = 0.2 + (i / Math.max(1, n - 1)) * 0.6;
				const left = 0.2 + r() * 0.05;
				const right = 0.8 - r() * 0.05;
				strokes.push({ points: pts([[left, y], [right, y]]), dir: "h" });
			}
			return strokes;
		},
		(r) => {
			const cross = r() < 0.6;
			const strokes: Stroke[] = [
				{ points: pts([[0.2, 0.5], [0.8, 0.5]]), dir: "h" },
				{ points: pts([[0.5, 0.2], [0.5, 0.8]]), dir: "v" },
			];
			if (cross) strokes.push({ points: pts([[0.3, 0.3], [0.7, 0.3]]), dir: "h" });
			return strokes;
		},
		(r) => {
			const strokes: Stroke[] = [
				{ points: pts([[0.25, 0.25], [0.25, 0.75]]), dir: "v" },
				{ points: pts([[0.25, 0.25], [0.75, 0.25]]), dir: "h" },
				{ points: pts([[0.75, 0.25], [0.75, 0.75]]), dir: "v" },
				{ points: pts([[0.25, 0.75], [0.75, 0.75]]), dir: "h" },
			];
			if (r() < 0.5) strokes.push({ points: pts([[0.5, 0.25], [0.5, 0.75]]), dir: "v" });
			return strokes;
		},
		() => [
			{ points: pts([[0.5, 0.2], [0.25, 0.8]]), dir: "d" as const },
			{ points: pts([[0.5, 0.45], [0.75, 0.8]]), dir: "d" as const },
		],
		(r) => {
			const strokes: Stroke[] = [
				{ points: pts([[0.2, 0.3], [0.5, 0.18], [0.8, 0.3]]), dir: "d" },
				{ points: pts([[0.3, 0.5], [0.7, 0.5]]), dir: "h" },
			];
			if (r() < 0.5) strokes.push({ points: pts([[0.5, 0.5], [0.5, 0.8]]), dir: "v" });
			return strokes;
		},
	];
	const ideo = ideograms[Math.floor(rnd() * ideograms.length)];
	const strokes = ideo(rnd);
	const safe = 0x4e00 + Math.floor(rnd() * 0x100);
	return { name: String.fromCharCode(safe), strokes };
}

const SCORE_KEY = "game089_calligraphy_best";

export default function Game089_Calligraphy() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const char = useMemo(() => generateCharacter(seed), [seed]);
	const [strokeIdx, setStrokeIdx] = useState(0);
	const [drawing, setDrawing] = useState(false);
	const [userStrokes, setUserStrokes] = useState<{ x: number; y: number; v: number }[][]>([]);
	const [strokeScores, setStrokeScores] = useState<{ smoothness: number; accuracy: number; correctDir: boolean }[]>([]);
	const currentRef = useRef<{ x: number; y: number; v: number; t: number }[]>([]);
	const lastPointTimeRef = useRef(0);
	const [feedback, setFeedback] = useState<string>("");
	const [best, setBest] = useState<number>(() => {
		if (typeof localStorage === "undefined") return 0;
		return Number(localStorage.getItem(SCORE_KEY) ?? 0);
	});

	const redraw = () => {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = "#f4eedb";
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		ctx.strokeStyle = "#d4c8a8";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(CANVAS_SIZE / 2, 0);
		ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
		ctx.moveTo(0, CANVAS_SIZE / 2);
		ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
		ctx.stroke();
		ctx.strokeStyle = "#e2d6b3";
		ctx.beginPath();
		ctx.moveTo(0, 0); ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE);
		ctx.moveTo(CANVAS_SIZE, 0); ctx.lineTo(0, CANVAS_SIZE);
		ctx.stroke();
		ctx.strokeStyle = "#bba070";
		ctx.lineWidth = 2;
		for (let i = strokeIdx; i < char.strokes.length; i++) {
			const s = char.strokes[i];
			ctx.beginPath();
			for (let j = 0; j < s.points.length; j++) {
				const p = s.points[j];
				const px = p.x * CANVAS_SIZE;
				const py = p.y * CANVAS_SIZE;
				if (j === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.stroke();
			const first = s.points[0];
			ctx.fillStyle = i === strokeIdx ? "#c04040" : "#bba070";
			ctx.beginPath();
			ctx.arc(first.x * CANVAS_SIZE, first.y * CANVAS_SIZE, 12, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#fff";
			ctx.font = "14px serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(String(i + 1), first.x * CANVAS_SIZE, first.y * CANVAS_SIZE);
		}
		ctx.strokeStyle = "#1a1a1a";
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		for (const us of userStrokes) {
			for (let j = 1; j < us.length; j++) {
				const a = us[j - 1];
				const b = us[j];
				const w = Math.max(2.5, 10 - Math.min(8, b.v * 0.06));
				ctx.lineWidth = w;
				ctx.beginPath();
				ctx.moveTo(a.x, a.y);
				ctx.lineTo(b.x, b.y);
				ctx.stroke();
			}
		}
		const cur = currentRef.current;
		if (cur.length > 1) {
			for (let j = 1; j < cur.length; j++) {
				const a = cur[j - 1];
				const b = cur[j];
				const w = Math.max(2.5, 10 - Math.min(8, b.v * 0.06));
				ctx.lineWidth = w;
				ctx.beginPath();
				ctx.moveTo(a.x, a.y);
				ctx.lineTo(b.x, b.y);
				ctx.stroke();
			}
		}
	};

	useEffect(() => {
		redraw();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seed, strokeIdx, userStrokes, drawing]);

	const start = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		currentRef.current = [{ x, y, v: 0, t: performance.now() }];
		lastPointTimeRef.current = performance.now();
		setDrawing(true);
	};

	const move = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!drawing) return;
		const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const now = performance.now();
		const last = currentRef.current[currentRef.current.length - 1];
		const dt = Math.max(1, now - last.t);
		const dist = Math.hypot(x - last.x, y - last.y);
		const v = (dist / dt) * 16;
		currentRef.current.push({ x, y, v, t: now });
		if (now - lastPointTimeRef.current > 60) {
			lastPointTimeRef.current = now;
			brushSound(Math.min(1, v / 8));
		}
		redraw();
	};

	const end = () => {
		if (!drawing) return;
		setDrawing(false);
		const ptsArr = currentRef.current;
		currentRef.current = [];
		if (ptsArr.length < 3 || strokeIdx >= char.strokes.length) return;
		const target = char.strokes[strokeIdx];
		const targetPts = strokeSamples(target).map((p) => ({ x: p.x * CANVAS_SIZE, y: p.y * CANVAS_SIZE }));
		let acc = 0;
		for (const p of ptsArr) {
			let m = Infinity;
			for (const tp of targetPts) {
				const d = (p.x - tp.x) ** 2 + (p.y - tp.y) ** 2;
				if (d < m) m = d;
			}
			acc += Math.sqrt(m);
		}
		acc /= ptsArr.length;
		let smooth = 0;
		for (let i = 1; i < ptsArr.length - 1; i++) {
			const a = ptsArr[i - 1];
			const b = ptsArr[i];
			const c2 = ptsArr[i + 1];
			const v1x = b.x - a.x;
			const v1y = b.y - a.y;
			const v2x = c2.x - b.x;
			const v2y = c2.y - b.y;
			const m1 = Math.hypot(v1x, v1y);
			const m2 = Math.hypot(v2x, v2y);
			if (m1 === 0 || m2 === 0) continue;
			const dot = (v1x * v2x + v1y * v2y) / (m1 * m2);
			smooth += 1 - dot;
		}
		smooth /= ptsArr.length;
		const userVec = { x: ptsArr[ptsArr.length - 1].x - ptsArr[0].x, y: ptsArr[ptsArr.length - 1].y - ptsArr[0].y };
		const tvec = { x: targetPts[targetPts.length - 1].x - targetPts[0].x, y: targetPts[targetPts.length - 1].y - targetPts[0].y };
		const dir = userVec.x * tvec.x + userVec.y * tvec.y > 0;
		const s = {
			smoothness: Math.max(0, 100 - smooth * 400),
			accuracy: Math.max(0, 100 - acc),
			correctDir: dir,
		};
		setStrokeScores((prev) => [...prev, s]);
		setFeedback(dir && acc < 50 ? "Excellent stroke." : !dir ? "Wrong direction." : "Off-line.");
		blip(dir && acc < 30 ? 880 : dir ? 660 : 220, 0.12, "triangle", 0.12);
		setUserStrokes((prev) => [...prev, ptsArr.map(({ x, y, v }) => ({ x, y, v }))]);
		const nextIdx = strokeIdx + 1;
		setStrokeIdx(nextIdx);
		if (nextIdx >= char.strokes.length) {
			const all = [...strokeScores, s];
			const total = all.reduce(
				(acc2, s2) => acc2 + (s2.accuracy + s2.smoothness) / 2 * (s2.correctDir ? 1 : 0.5),
				0,
			);
			const final = Math.round(total / char.strokes.length);
			if (final > best) {
				setBest(final);
				if (typeof localStorage !== "undefined") localStorage.setItem(SCORE_KEY, String(final));
			}
		}
	};

	const undo = () => {
		if (userStrokes.length === 0) return;
		setUserStrokes(userStrokes.slice(0, -1));
		setStrokeScores(strokeScores.slice(0, -1));
		setStrokeIdx(Math.max(0, strokeIdx - 1));
		setFeedback("");
	};

	const nextChar = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setStrokeIdx(0);
		setUserStrokes([]);
		setStrokeScores([]);
		setFeedback("");
	};
	const reset = () => {
		setStrokeIdx(0);
		setUserStrokes([]);
		setStrokeScores([]);
		setFeedback("");
	};

	const totalScore = strokeScores.length === 0 ? 0 : Math.round(
		strokeScores.reduce((a, s) => a + (s.accuracy + s.smoothness) / 2 * (s.correctDir ? 1 : 0.5), 0) / strokeScores.length,
	);

	return (
		<div style={{ fontFamily: "Georgia, serif", color: "#222", background: "#1c1410", padding: 16, minHeight: 600 }}>
			<h2 style={{ margin: 0, color: "#f4eedb" }}>89. Calligraphy</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8, color: "#f4eedb" }}>
				Trace each numbered stroke in order, in the direction of the numbered dot. Slow strokes are thicker. Smoothness + accuracy + direction.
			</div>
			<div style={{ display: "flex", gap: 16, color: "#f4eedb", alignItems: "flex-start" }}>
				<div>
					<div style={{ fontSize: 36, textAlign: "center" }}>{char.name}</div>
					<canvas
						ref={canvasRef}
						width={CANVAS_SIZE}
						height={CANVAS_SIZE}
						onMouseDown={start}
						onMouseMove={move}
						onMouseUp={end}
						onMouseLeave={end}
						style={{ border: "2px solid #5a4030", cursor: "crosshair", touchAction: "none" }}
					/>
				</div>
				<div style={{ minWidth: 220 }}>
					<div>Stroke {Math.min(strokeIdx + 1, char.strokes.length)} of {char.strokes.length}</div>
					<div style={{ marginTop: 6 }}>Score so far: <strong>{totalScore}</strong></div>
					<div style={{ marginTop: 2, opacity: 0.85 }}>Best: <strong>{best}</strong></div>
					{strokeScores.length > 0 && (
						<div style={{ marginTop: 8, fontSize: 13 }}>
							{strokeScores.map((s, i) => (
								<div key={i}>
									#{i + 1}: acc {s.accuracy.toFixed(0)} · smooth {s.smoothness.toFixed(0)} · dir {s.correctDir ? "✓" : "✗"}
								</div>
							))}
						</div>
					)}
					{feedback && <div style={{ marginTop: 8 }}>{feedback}</div>}
					<div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
						<button type="button" onClick={undo} disabled={userStrokes.length === 0} style={btn}>Undo</button>
						<button type="button" onClick={reset} style={btn}>Restart</button>
						<button type="button" onClick={nextChar} style={btn}>New character</button>
					</div>
				</div>
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
