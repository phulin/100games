import { useEffect, useRef, useState } from "react";

// A "character" is a list of strokes, each stroke is a polyline.
type Stroke = { points: { x: number; y: number }[]; dir: "h" | "v" | "d" };
type Character = { name: string; strokes: Stroke[] };

const CANVAS_SIZE = 400;

// Define a few procedural kanji-like characters (in normalized 0..1 coords).
const CHARS: Character[] = [
	{
		name: "三",
		strokes: [
			{ points: pts([[0.2, 0.3], [0.8, 0.3]]), dir: "h" },
			{ points: pts([[0.2, 0.5], [0.8, 0.5]]), dir: "h" },
			{ points: pts([[0.2, 0.7], [0.8, 0.7]]), dir: "h" },
		],
	},
	{
		name: "十",
		strokes: [
			{ points: pts([[0.2, 0.5], [0.8, 0.5]]), dir: "h" },
			{ points: pts([[0.5, 0.2], [0.5, 0.8]]), dir: "v" },
		],
	},
	{
		name: "口",
		strokes: [
			{ points: pts([[0.25, 0.25], [0.25, 0.75]]), dir: "v" },
			{ points: pts([[0.25, 0.25], [0.75, 0.25]]), dir: "h" },
			{ points: pts([[0.75, 0.25], [0.75, 0.75]]), dir: "v" },
			{ points: pts([[0.25, 0.75], [0.75, 0.75]]), dir: "h" },
		],
	},
	{
		name: "人",
		strokes: [
			{ points: pts([[0.5, 0.2], [0.25, 0.8]]), dir: "d" },
			{ points: pts([[0.5, 0.45], [0.75, 0.8]]), dir: "d" },
		],
	},
];

function pts(arr: number[][]): { x: number; y: number }[] {
	return arr.map(([x, y]) => ({ x, y }));
}

function lerp(
	a: { x: number; y: number },
	b: { x: number; y: number },
	t: number,
) {
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

export default function Game089_Calligraphy() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [charIdx, setCharIdx] = useState(0);
	const [strokeIdx, setStrokeIdx] = useState(0);
	const [drawing, setDrawing] = useState(false);
	const [userStrokes, setUserStrokes] = useState<
		{ x: number; y: number }[][]
	>([]);
	const currentRef = useRef<{ x: number; y: number }[]>([]);
	const [score, setScore] = useState<{ smoothness: number; accuracy: number; correctDir: boolean } | null>(
		null,
	);
	const [feedback, setFeedback] = useState<string>("");

	const char = CHARS[charIdx];

	const redraw = () => {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = "#f4eedb";
		ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		// grid
		ctx.strokeStyle = "#d4c8a8";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(CANVAS_SIZE / 2, 0);
		ctx.lineTo(CANVAS_SIZE / 2, CANVAS_SIZE);
		ctx.moveTo(0, CANVAS_SIZE / 2);
		ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE / 2);
		ctx.stroke();
		// faint outline of remaining strokes
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
			// stroke number bubble at the start
			const first = s.points[0];
			ctx.fillStyle = "#bba070";
			ctx.beginPath();
			ctx.arc(first.x * CANVAS_SIZE, first.y * CANVAS_SIZE, 12, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#fff";
			ctx.font = "14px serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(
				String(i + 1),
				first.x * CANVAS_SIZE,
				first.y * CANVAS_SIZE,
			);
		}
		// user-completed strokes
		ctx.strokeStyle = "#1a1a1a";
		ctx.lineWidth = 6;
		ctx.lineCap = "round";
		for (const us of userStrokes) {
			ctx.beginPath();
			for (let j = 0; j < us.length; j++) {
				const p = us[j];
				if (j === 0) ctx.moveTo(p.x, p.y);
				else ctx.lineTo(p.x, p.y);
			}
			ctx.stroke();
		}
		// active drawing
		if (currentRef.current.length > 1) {
			ctx.beginPath();
			for (let j = 0; j < currentRef.current.length; j++) {
				const p = currentRef.current[j];
				if (j === 0) ctx.moveTo(p.x, p.y);
				else ctx.lineTo(p.x, p.y);
			}
			ctx.stroke();
		}
	};

	useEffect(() => {
		redraw();
	}, [charIdx, strokeIdx, userStrokes, drawing]);

	const start = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
		currentRef.current = [
			{ x: e.clientX - rect.left, y: e.clientY - rect.top },
		];
		setDrawing(true);
	};

	const move = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!drawing) return;
		const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
		currentRef.current.push({
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
		});
		redraw();
	};

	const end = () => {
		if (!drawing) return;
		setDrawing(false);
		const pts = currentRef.current;
		currentRef.current = [];
		if (pts.length < 3 || strokeIdx >= char.strokes.length) return;
		// Evaluate
		const target = char.strokes[strokeIdx];
		const targetPts = strokeSamples(target).map((p) => ({
			x: p.x * CANVAS_SIZE,
			y: p.y * CANVAS_SIZE,
		}));
		// Accuracy: average dist of user samples to nearest target point
		let acc = 0;
		for (const p of pts) {
			let m = Infinity;
			for (const tp of targetPts) {
				const d = (p.x - tp.x) ** 2 + (p.y - tp.y) ** 2;
				if (d < m) m = d;
			}
			acc += Math.sqrt(m);
		}
		acc /= pts.length;
		// Smoothness: angle variance
		let smooth = 0;
		for (let i = 1; i < pts.length - 1; i++) {
			const a = pts[i - 1];
			const b = pts[i];
			const c = pts[i + 1];
			const v1x = b.x - a.x;
			const v1y = b.y - a.y;
			const v2x = c.x - b.x;
			const v2y = c.y - b.y;
			const m1 = Math.hypot(v1x, v1y);
			const m2 = Math.hypot(v2x, v2y);
			if (m1 === 0 || m2 === 0) continue;
			const dot = (v1x * v2x + v1y * v2y) / (m1 * m2);
			smooth += 1 - dot;
		}
		smooth /= pts.length;
		// Direction: compare start->end vector to target
		const userVec = {
			x: pts[pts.length - 1].x - pts[0].x,
			y: pts[pts.length - 1].y - pts[0].y,
		};
		const tvec = {
			x: targetPts[targetPts.length - 1].x - targetPts[0].x,
			y: targetPts[targetPts.length - 1].y - targetPts[0].y,
		};
		const dot =
			userVec.x * tvec.x + userVec.y * tvec.y > 0;
		setScore({
			smoothness: Math.max(0, 100 - smooth * 400),
			accuracy: Math.max(0, 100 - acc),
			correctDir: dot,
		});
		setFeedback(
			dot && acc < 50 ? "Excellent stroke." : !dot ? "Wrong direction." : "Off-line.",
		);
		setUserStrokes([...userStrokes, pts]);
		setStrokeIdx(strokeIdx + 1);
	};

	const nextChar = () => {
		setCharIdx((charIdx + 1) % CHARS.length);
		setStrokeIdx(0);
		setUserStrokes([]);
		setScore(null);
		setFeedback("");
	};
	const reset = () => {
		setStrokeIdx(0);
		setUserStrokes([]);
		setScore(null);
		setFeedback("");
	};

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#222",
				background: "#1c1410",
				padding: 16,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0, color: "#f4eedb" }}>89. Calligraphy</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8, color: "#f4eedb" }}>
				Trace each numbered stroke in order, in the direction of the numbered
				dot. Smoothness + accuracy.
			</div>
			<div
				style={{
					display: "flex",
					gap: 16,
					color: "#f4eedb",
					alignItems: "flex-start",
				}}
			>
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
						style={{ border: "2px solid #5a4030", cursor: "crosshair" }}
					/>
				</div>
				<div style={{ minWidth: 200 }}>
					<div>
						Stroke {Math.min(strokeIdx + 1, char.strokes.length)} of{" "}
						{char.strokes.length}
					</div>
					{score && (
						<div style={{ marginTop: 8 }}>
							<div>Accuracy: {score.accuracy.toFixed(0)}</div>
							<div>Smoothness: {score.smoothness.toFixed(0)}</div>
							<div>Direction: {score.correctDir ? "✓" : "✗"}</div>
						</div>
					)}
					{feedback && <div style={{ marginTop: 8 }}>{feedback}</div>}
					<div style={{ display: "flex", gap: 8, marginTop: 12 }}>
						<button type="button" onClick={reset} style={btn}>
							Restart
						</button>
						<button type="button" onClick={nextChar} style={btn}>
							Next char
						</button>
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
