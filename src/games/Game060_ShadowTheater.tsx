import { useEffect, useRef, useState } from "react";

// Game 60: Shadow Theater
// Move your hand-shape silhouette to match the target shadow within the time limit.
// Score based on overlap %.

const W = 900;
const H = 600;

type Shape = {
	name: string;
	// each shape is a set of polygons drawn relative to (cx,cy) at scale=1
	polys: { x: number; y: number }[][];
};

const SHAPES: Shape[] = [
	{
		name: "Rabbit",
		polys: [
			[
				{ x: -40, y: 0 },
				{ x: -20, y: -60 },
				{ x: -10, y: -50 },
				{ x: -5, y: -10 },
				{ x: 30, y: 5 },
				{ x: 30, y: 30 },
				{ x: -40, y: 30 },
			],
			[
				{ x: -25, y: -30 },
				{ x: -15, y: -90 },
				{ x: -5, y: -85 },
				{ x: -5, y: -25 },
			],
		],
	},
	{
		name: "Bird",
		polys: [
			[
				{ x: -50, y: 0 },
				{ x: -10, y: -30 },
				{ x: 30, y: -10 },
				{ x: 50, y: 5 },
				{ x: 30, y: 20 },
				{ x: -20, y: 25 },
				{ x: -40, y: 15 },
			],
			[
				{ x: 30, y: 0 },
				{ x: 60, y: -2 },
				{ x: 30, y: 8 },
			],
		],
	},
	{
		name: "Dog",
		polys: [
			[
				{ x: -50, y: 0 },
				{ x: -50, y: -25 },
				{ x: -20, y: -25 },
				{ x: -20, y: -10 },
				{ x: 40, y: -10 },
				{ x: 40, y: -40 },
				{ x: 55, y: -40 },
				{ x: 55, y: 30 },
				{ x: 30, y: 30 },
				{ x: 30, y: 10 },
				{ x: -30, y: 10 },
				{ x: -30, y: 30 },
				{ x: -50, y: 30 },
			],
		],
	},
];

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, cx: number, cy: number, scale: number, rot: number, fill: string) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(rot);
	ctx.scale(scale, scale);
	ctx.fillStyle = fill;
	for (const poly of shape.polys) {
		ctx.beginPath();
		poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}

function pixelOverlap(a: ImageData, b: ImageData) {
	let aCount = 0;
	let bCount = 0;
	let both = 0;
	const al = a.data;
	const bl = b.data;
	for (let i = 3; i < al.length; i += 4) {
		const ap = al[i] > 50;
		const bp = bl[i] > 50;
		if (ap) aCount++;
		if (bp) bCount++;
		if (ap && bp) both++;
	}
	if (aCount + bCount === 0) return 0;
	return (2 * both) / (aCount + bCount);
}

export default function ShadowTheater() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [shapeIdx, setShapeIdx] = useState(0);
	const [target, setTarget] = useState({ x: 250, y: 320, scale: 1.4, rot: 0.2 });
	const [player, setPlayer] = useState({ x: 650, y: 320, scale: 1, rot: 0 });
	const [score, setScore] = useState(0);
	const [round, setRound] = useState(1);
	const [time, setTime] = useState(20);
	const [over, setOver] = useState(false);
	const [matchPct, setMatchPct] = useState(0);
	const keysRef = useRef<Record<string, boolean>>({});

	useEffect(() => {
		const kd = (e: KeyboardEvent) => {
			keysRef.current[e.key.toLowerCase()] = true;
		};
		const ku = (e: KeyboardEvent) => {
			keysRef.current[e.key.toLowerCase()] = false;
		};
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);
		return () => {
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
		};
	}, []);

	useEffect(() => {
		let raf = 0;
		const loop = () => {
			const k = keysRef.current;
			setPlayer((p) => {
				let np = { ...p };
				if (k["a"] || k["arrowleft"]) np.x -= 3;
				if (k["d"] || k["arrowright"]) np.x += 3;
				if (k["w"] || k["arrowup"]) np.y -= 3;
				if (k["s"] || k["arrowdown"]) np.y += 3;
				if (k["q"]) np.rot -= 0.04;
				if (k["e"]) np.rot += 0.04;
				if (k["z"]) np.scale = Math.max(0.5, np.scale - 0.02);
				if (k["x"]) np.scale = Math.min(2.5, np.scale + 0.02);
				np.x = Math.max(50, Math.min(W - 50, np.x));
				np.y = Math.max(50, Math.min(H - 50, np.y));
				return np;
			});
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, []);

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			setTime((t) => {
				const nt = t - 0.1;
				if (nt <= 0) {
					setOver(true);
					return 0;
				}
				return nt;
			});
		}, 100);
		return () => clearInterval(id);
	}, [over]);

	useEffect(() => {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d")!;
		// Draw stage
		const grad = ctx.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, "#f5d77a");
		grad.addColorStop(1, "#d8a85a");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, W, H);
		// Curtains
		ctx.fillStyle = "#7b1818";
		for (let i = 0; i < 6; i++) {
			ctx.beginPath();
			ctx.moveTo(i * 30, 0);
			ctx.quadraticCurveTo(i * 30 + 15, H * 0.4, i * 30, H);
			ctx.lineTo(i * 30 + 30, H);
			ctx.lineTo(i * 30 + 30, 0);
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo(W - i * 30, 0);
			ctx.quadraticCurveTo(W - i * 30 - 15, H * 0.4, W - i * 30, H);
			ctx.lineTo(W - i * 30 - 30, H);
			ctx.lineTo(W - i * 30 - 30, 0);
			ctx.fill();
		}
		// Target shadow (semi-transparent outline)
		drawShape(ctx, SHAPES[shapeIdx], target.x, target.y, target.scale, target.rot, "rgba(0,0,0,0.35)");
		// Player shadow
		drawShape(ctx, SHAPES[shapeIdx], player.x, player.y, player.scale, player.rot, "rgba(0,0,0,0.85)");

		// Compute match (offscreen)
		const off1 = document.createElement("canvas");
		off1.width = W;
		off1.height = H;
		const c1 = off1.getContext("2d")!;
		drawShape(c1, SHAPES[shapeIdx], target.x, target.y, target.scale, target.rot, "#000");
		const off2 = document.createElement("canvas");
		off2.width = W;
		off2.height = H;
		const c2 = off2.getContext("2d")!;
		drawShape(c2, SHAPES[shapeIdx], player.x, player.y, player.scale, player.rot, "#000");
		const a = c1.getImageData(0, 0, W, H);
		const b = c2.getImageData(0, 0, W, H);
		const pct = pixelOverlap(a, b);
		setMatchPct(pct);
	}, [player, target, shapeIdx]);

	function nextRound() {
		const ns = (shapeIdx + 1) % SHAPES.length;
		setShapeIdx(ns);
		setTarget({
			x: 200 + Math.random() * 200,
			y: 250 + Math.random() * 150,
			scale: 1 + Math.random() * 1,
			rot: (Math.random() - 0.5) * 0.8,
		});
		setRound((r) => r + 1);
		setTime(20);
		setOver(false);
	}

	function lockIn() {
		if (over) return;
		const pts = Math.round(matchPct * 100);
		setScore((s) => s + pts);
		setOver(true);
	}

	function reset() {
		setScore(0);
		setRound(1);
		setShapeIdx(0);
		setTime(20);
		setOver(false);
	}

	return (
		<div style={{ background: "#2a0a0a", color: "#fde2a0", padding: 14, fontFamily: "'Times New Roman', serif" }}>
			<h2 style={{ margin: 0 }}>Shadow Theater</h2>
			<div style={{ fontSize: 13, opacity: 0.9 }}>
				Move your shadow to match the faint target shape. WASD/arrows to move, Q/E to rotate, Z/X to scale. Lock in for points.
			</div>
			<div style={{ display: "flex", gap: 14, marginTop: 4, alignItems: "center" }}>
				<div>Shape: {SHAPES[shapeIdx].name}</div>
				<div>Round: {round}</div>
				<div>Score: {score}</div>
				<div>Match: {(matchPct * 100).toFixed(0)}%</div>
				<div>Time: {time.toFixed(1)}s</div>
				<button type="button" onClick={lockIn} disabled={over} style={{ background: "#c0a050", color: "#2a0a0a", border: 0, padding: "4px 12px", borderRadius: 4, cursor: over ? "default" : "pointer" }}>
					Lock In
				</button>
				{over && (
					<>
						<button type="button" onClick={nextRound} style={{ background: "#7b1818", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
							Next Shape
						</button>
						<button type="button" onClick={reset} style={{ background: "#5a3a3a", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
							Reset Score
						</button>
					</>
				)}
			</div>
			<canvas ref={canvasRef} width={W} height={H} style={{ display: "block", marginTop: 8, borderRadius: 6, border: "4px solid #4a1010" }} />
		</div>
	);
}
