import { useEffect, useMemo, useRef, useState } from "react";

// Game 72 — Shard Garden
// Drop colored shards into a kaleidoscope. Each tessellates symmetrically.
// Match a target pattern. Pixel distance after symmetry.

type Shard = { x: number; y: number; r: number; color: string };

const COLORS = ["#e76f51", "#2a9d8f", "#e9c46a", "#f4a261", "#264653", "#9d4edd"];
const SECTORS = 8;
const SIZE = 480;
const CX = SIZE / 2;

function rand(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

function makeTarget(seed: number): Shard[] {
	const r = rand(seed);
	const n = 4 + Math.floor(r() * 3);
	const arr: Shard[] = [];
	for (let i = 0; i < n; i++) {
		arr.push({
			x: 40 + r() * (CX - 60),
			y: -((CX / SECTORS) * (0.2 + r() * 0.4)) + r() * (CX / 3),
			r: 10 + r() * 24,
			color: COLORS[Math.floor(r() * COLORS.length)],
		});
	}
	return arr;
}

function renderToCanvas(shards: Shard[], canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d")!;
	ctx.clearRect(0, 0, SIZE, SIZE);
	ctx.save();
	ctx.translate(CX, CX);
	for (let s = 0; s < SECTORS; s++) {
		ctx.save();
		ctx.rotate(((Math.PI * 2) / SECTORS) * s);
		if (s % 2 === 1) ctx.scale(1, -1);
		// clip wedge
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.arc(0, 0, CX, 0, (Math.PI * 2) / SECTORS);
		ctx.closePath();
		ctx.clip();
		for (const sh of shards) {
			ctx.beginPath();
			ctx.arc(sh.x, sh.y, sh.r, 0, Math.PI * 2);
			ctx.fillStyle = sh.color;
			ctx.globalAlpha = 0.78;
			ctx.fill();
		}
		ctx.restore();
	}
	ctx.restore();
}

function pixelDistance(a: HTMLCanvasElement, b: HTMLCanvasElement) {
	const ca = a.getContext("2d")!.getImageData(0, 0, SIZE, SIZE).data;
	const cb = b.getContext("2d")!.getImageData(0, 0, SIZE, SIZE).data;
	let total = 0;
	const step = 16; // sample every 4 pixels for speed
	for (let i = 0; i < ca.length; i += step) {
		const da = Math.abs(ca[i] - cb[i]) + Math.abs(ca[i + 1] - cb[i + 1]) + Math.abs(ca[i + 2] - cb[i + 2]);
		total += da;
	}
	return total;
}

export default function Game072_ShardGarden() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
	const target = useMemo(() => makeTarget(seed), [seed]);
	const [shards, setShards] = useState<Shard[]>([]);
	const [color, setColor] = useState(COLORS[0]);
	const [size, setSize] = useState(20);
	const [score, setScore] = useState<number | null>(null);

	const playerCanvas = useRef<HTMLCanvasElement>(null);
	const targetCanvas = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (targetCanvas.current) renderToCanvas(target, targetCanvas.current);
	}, [target]);

	useEffect(() => {
		if (playerCanvas.current) renderToCanvas(shards, playerCanvas.current);
	}, [shards]);

	const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left - CX;
		const y = e.clientY - rect.top - CX;
		// place into wedge 0 by rotating clicked point
		const ang = Math.atan2(y, x);
		const r = Math.hypot(x, y);
		const wedgeAng = ((ang % ((Math.PI * 2) / SECTORS)) + (Math.PI * 2) / SECTORS) %
			((Math.PI * 2) / SECTORS);
		const lx = Math.cos(wedgeAng) * r;
		const ly = Math.sin(wedgeAng) * r;
		setShards((s) => [...s, { x: lx, y: ly, r: size, color }]);
	};

	const evaluate = () => {
		if (!playerCanvas.current || !targetCanvas.current) return;
		const d = pixelDistance(playerCanvas.current, targetCanvas.current);
		// turn distance into 0-100 score
		const norm = Math.max(0, 100 - d / 200000);
		setScore(Math.round(norm));
	};

	const reset = () => {
		setShards([]);
		setScore(null);
	};

	const nextPuzzle = () => {
		setSeed(Math.floor(Math.random() * 1e6));
		setShards([]);
		setScore(null);
	};

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "#1a1a23",
				color: "#eee",
				fontFamily: "system-ui, sans-serif",
				display: "flex",
				gap: 12,
				padding: 12,
				boxSizing: "border-box",
			}}
		>
			<div>
				<div style={{ fontWeight: "bold" }}>Target</div>
				<canvas
					ref={targetCanvas}
					width={SIZE}
					height={SIZE}
					style={{ background: "#000", borderRadius: SIZE / 2, width: 280, height: 280 }}
				/>
				<div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
					Shard Garden — click to drop colored shards. Match the target pattern.
				</div>
			</div>
			<div>
				<div style={{ fontWeight: "bold" }}>Your kaleidoscope</div>
				<canvas
					ref={playerCanvas}
					width={SIZE}
					height={SIZE}
					onClick={onClick}
					style={{
						background: "#000",
						borderRadius: SIZE / 2,
						width: SIZE,
						height: SIZE,
						cursor: "crosshair",
					}}
				/>
			</div>
			<div style={{ width: 120, display: "flex", flexDirection: "column", gap: 8 }}>
				<div>Color</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
					{COLORS.map((c) => (
						<div
							key={c}
							onClick={() => setColor(c)}
							style={{
								width: 24,
								height: 24,
								background: c,
								border: color === c ? "2px solid #fff" : "2px solid #444",
								cursor: "pointer",
							}}
						/>
					))}
				</div>
				<div>Size: {size}</div>
				<input
					type="range"
					min={6}
					max={40}
					value={size}
					onChange={(e) => setSize(parseInt(e.target.value))}
				/>
				<button onClick={evaluate}>Score</button>
				<button onClick={reset}>Reset</button>
				<button onClick={nextPuzzle}>New target</button>
				{score != null && (
					<div style={{ fontSize: 18, marginTop: 12 }}>
						Score: <b>{score}</b>
					</div>
				)}
			</div>
		</div>
	);
}
