import { useEffect, useMemo, useRef, useState } from "react";

// Procedural inkblot via random metaballs (symmetric). Player types a word.
// "Past players' words" mocked from a pool seeded by blot characteristics.

const SHAPES_BY_TYPE: Record<string, string[]> = {
	winged: ["bat", "butterfly", "moth", "angel", "bird", "owl", "dragonfly"],
	round: ["face", "skull", "pumpkin", "mask", "balloon"],
	tall: ["tree", "tower", "candle", "vase", "fountain"],
	wide: ["beetle", "crab", "horseshoe", "mountain", "wave"],
	jagged: ["dragon", "crown", "lightning", "antlers", "fire"],
};

type Blob = { x: number; y: number; r: number };

function genBlobs(seed: number): { blobs: Blob[]; type: keyof typeof SHAPES_BY_TYPE } {
	let s = seed;
	const r = () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	const n = 6 + Math.floor(r() * 8);
	const blobs: Blob[] = [];
	let maxX = 0;
	let maxY = 0;
	for (let i = 0; i < n; i++) {
		const x = r() * 150;
		const y = r() * 280;
		const radius = 25 + r() * 55;
		blobs.push({ x, y, r: radius });
		maxX = Math.max(maxX, x + radius);
		maxY = Math.max(maxY, y + radius);
	}
	// Classify
	const aspect = maxX / maxY;
	const type =
		aspect > 1.0
			? "wide"
			: aspect < 0.5
				? "tall"
				: blobs.length > 10
					? "jagged"
					: blobs.length > 7
						? "winged"
						: "round";
	return { blobs, type };
}

export default function Inkblot() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9999));
	const { blobs, type } = useMemo(() => genBlobs(seed), [seed]);
	const [word, setWord] = useState("");
	const [submitted, setSubmitted] = useState<string | null>(null);
	const [cloud, setCloud] = useState<{ word: string; count: number }[]>([]);
	const [score, setScore] = useState<number | null>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const cv = canvasRef.current;
		if (!cv) return;
		const ctx = cv.getContext("2d")!;
		const W = cv.width;
		const H = cv.height;
		// metaball field render: for each pixel, sum 1/d^2, threshold
		const img = ctx.createImageData(W, H);
		const cx = W / 2;
		for (let y = 0; y < H; y++) {
			for (let x = 0; x < W; x++) {
				const dx = Math.abs(x - cx);
				const px = dx; // symmetric
				let sum = 0;
				for (const b of blobs) {
					const ddx = px - b.x;
					const ddy = y - b.y;
					sum += (b.r * b.r) / (ddx * ddx + ddy * ddy + 1);
				}
				const idx = (y * W + x) * 4;
				if (sum > 1.0) {
					const v = Math.min(255, sum * 40);
					img.data[idx] = 20;
					img.data[idx + 1] = 20;
					img.data[idx + 2] = 20;
					img.data[idx + 3] = Math.min(255, v + 100);
				} else {
					img.data[idx + 3] = 0;
				}
			}
		}
		ctx.clearRect(0, 0, W, H);
		ctx.fillStyle = "#f5f0e6";
		ctx.fillRect(0, 0, W, H);
		ctx.putImageData(img, 0, 0);
	}, [blobs]);

	const submit = () => {
		if (!word.trim()) return;
		const lw = word.trim().toLowerCase();
		setSubmitted(lw);
		// Mock community cloud based on type
		const pool = SHAPES_BY_TYPE[type];
		// pseudo-counts from seed
		let s = seed;
		const r = () => {
			s = (s * 9301 + 49297) % 233280;
			return s / 233280;
		};
		const entries = pool.map((w) => ({ word: w, count: Math.floor(r() * 30) + 5 }));
		entries.sort((a, b) => b.count - a.count);
		// inject user's word if not in
		if (!entries.find((e) => e.word === lw)) entries.push({ word: lw, count: 1 });
		setCloud(entries);
		const isTop = entries[0].word === lw;
		const isUnique = entries.find((e) => e.word === lw)!.count === 1;
		const sc = isTop ? 100 : isUnique ? 70 : entries.find((e) => e.word === lw)!.count * 2;
		setScore(sc);
	};

	const newBlot = () => {
		setSeed(Math.floor(Math.random() * 9999));
		setWord("");
		setSubmitted(null);
		setCloud([]);
		setScore(null);
	};

	return (
		<div style={{ background: "#2a2522", color: "#eee", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Inkblot</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Look at the inkblot. Type a single word for what you see.
			</div>
			<div style={{ display: "flex", gap: 16 }}>
				<canvas ref={canvasRef} width={300} height={300} style={{ background: "#f5f0e6", borderRadius: 8 }} />
				<div style={{ flex: 1 }}>
					{!submitted ? (
						<>
							<input
								value={word}
								onChange={(e) => setWord(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && submit()}
								placeholder="one word..."
								style={{ width: 200, padding: 6, fontSize: 16, marginBottom: 8 }}
							/>
							<button type="button" onClick={submit}>
								Submit
							</button>
						</>
					) : (
						<>
							<div style={{ marginBottom: 8 }}>
								You said: <b>{submitted}</b>
								<span style={{ marginLeft: 12, color: "#7f7" }}>Score: {score}</span>
							</div>
							<div style={{ fontSize: 13, marginBottom: 4 }}>Past players said:</div>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
								{cloud.map((c) => (
									<span
										key={c.word}
										style={{
											fontSize: 12 + Math.min(20, c.count / 2),
											opacity: 0.6 + Math.min(0.4, c.count / 60),
											padding: "2px 6px",
											background: c.word === submitted ? "#553" : "#3a322a",
											borderRadius: 4,
										}}
									>
										{c.word}
									</span>
								))}
							</div>
							<button type="button" onClick={newBlot} style={{ marginTop: 12 }}>
								New blot
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
