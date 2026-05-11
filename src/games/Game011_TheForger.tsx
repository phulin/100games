import { useEffect, useRef, useState } from "react";

type Shape = {
	x: number;
	y: number;
	r: number;
	hue: number;
	sat: number;
	light: number;
	kind: "circle" | "square" | "triangle";
};

type Painting = { shapes: Shape[]; seed: number };

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makePainting(seed: number, W: number, H: number): Painting {
	const rng = mulberry32(seed);
	const n = 8 + Math.floor(rng() * 6);
	const baseHue = rng() * 360;
	const shapes: Shape[] = [];
	for (let i = 0; i < n; i++) {
		shapes.push({
			x: rng() * (W - 40) + 20,
			y: rng() * (H - 40) + 20,
			r: 14 + rng() * 36,
			hue: (baseHue + rng() * 60 - 30 + 360) % 360,
			sat: 50 + rng() * 40,
			light: 40 + rng() * 30,
			kind: (["circle", "square", "triangle"] as const)[
				Math.floor(rng() * 3)
			],
		});
	}
	return { shapes, seed };
}

function mutate(p: Painting, count: number, seed: number): { painting: Painting; changed: number[] } {
	const rng = mulberry32(seed);
	const shapes = p.shapes.map((s) => ({ ...s }));
	const indices = Array.from({ length: shapes.length }, (_, i) => i);
	// shuffle
	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[indices[i], indices[j]] = [indices[j], indices[i]];
	}
	const changed = indices.slice(0, count);
	for (const idx of changed) {
		const s = shapes[idx];
		const kind = Math.floor(rng() * 4);
		if (kind === 0) s.hue = (s.hue + 60 + rng() * 60) % 360;
		else if (kind === 1) s.r *= 0.6 + rng() * 0.3;
		else if (kind === 2) {
			s.x += (rng() - 0.5) * 40;
			s.y += (rng() - 0.5) * 40;
		} else {
			const opts: Shape["kind"][] = ["circle", "square", "triangle"];
			s.kind = opts.filter((k) => k !== s.kind)[Math.floor(rng() * 2)];
		}
	}
	return { painting: { shapes, seed: p.seed }, changed };
}

function drawPainting(ctx: CanvasRenderingContext2D, p: Painting, W: number, H: number) {
	ctx.fillStyle = "#1a1a2e";
	ctx.fillRect(0, 0, W, H);
	for (const s of p.shapes) {
		ctx.fillStyle = `hsl(${s.hue}, ${s.sat}%, ${s.light}%)`;
		if (s.kind === "circle") {
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
			ctx.fill();
		} else if (s.kind === "square") {
			ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
		} else {
			ctx.beginPath();
			ctx.moveTo(s.x, s.y - s.r);
			ctx.lineTo(s.x + s.r, s.y + s.r);
			ctx.lineTo(s.x - s.r, s.y + s.r);
			ctx.closePath();
			ctx.fill();
		}
	}
}

export default function Game011_TheForger() {
	const W = 200;
	const H = 200;
	const [round, setRound] = useState(0);
	const [score, setScore] = useState(0);
	const [phase, setPhase] = useState<"pickForgery" | "markChanges" | "result">("pickForgery");
	const [forgeryIdx, setForgeryIdx] = useState(0);
	const [originals, setOriginals] = useState<Painting[]>([]);
	const [forgery, setForgery] = useState<Painting | null>(null);
	const [changedIndices, setChangedIndices] = useState<number[]>([]);
	const [pickedIdx, setPickedIdx] = useState<number | null>(null);
	const [marks, setMarks] = useState<Set<number>>(new Set());
	const [timeLeft, setTimeLeft] = useState(30);

	const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

	useEffect(() => {
		const seed = Date.now() + round * 13;
		const rng = mulberry32(seed);
		const base = makePainting(Math.floor(rng() * 1e9), W, H);
		const which = Math.floor(rng() * 3);
		setForgeryIdx(which);
		const numChanges = 2 + Math.floor(rng() * 2);
		const m = mutate(base, numChanges, Math.floor(rng() * 1e9));
		const arr = [base, base, base];
		setOriginals(arr);
		setForgery(m.painting);
		setChangedIndices(m.changed);
		setPhase("pickForgery");
		setPickedIdx(null);
		setMarks(new Set());
		setTimeLeft(30);
	}, [round]);

	useEffect(() => {
		if (phase === "result") return;
		const id = setInterval(() => {
			setTimeLeft((t) => {
				if (t <= 1) {
					setPhase("result");
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [phase]);

	useEffect(() => {
		if (!forgery || originals.length === 0) return;
		for (let i = 0; i < 3; i++) {
			const c = canvasRefs.current[i];
			if (!c) continue;
			const ctx = c.getContext("2d");
			if (!ctx) continue;
			const p = i === forgeryIdx ? forgery : originals[i];
			drawPainting(ctx, p, W, H);
		}
	}, [forgery, originals, forgeryIdx]);

	function pickPainting(i: number) {
		if (phase !== "pickForgery") return;
		setPickedIdx(i);
		setPhase("markChanges");
	}

	function clickForgery(e: React.MouseEvent<HTMLCanvasElement>) {
		if (phase !== "markChanges" || !forgery) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * W;
		const y = ((e.clientY - rect.top) / rect.height) * H;
		let best = -1;
		let bestDist = Infinity;
		for (let i = 0; i < forgery.shapes.length; i++) {
			const s = forgery.shapes[i];
			const d = Math.hypot(s.x - x, s.y - y);
			if (d < s.r + 8 && d < bestDist) {
				bestDist = d;
				best = i;
			}
		}
		if (best >= 0) {
			const next = new Set(marks);
			if (next.has(best)) next.delete(best);
			else next.add(best);
			setMarks(next);
		}
	}

	function submit() {
		let pts = 0;
		if (pickedIdx === forgeryIdx) pts += 50;
		const truth = new Set(changedIndices);
		let hits = 0;
		let wrongs = 0;
		for (const m of marks) {
			if (truth.has(m)) hits++;
			else wrongs++;
		}
		pts += hits * 25 - wrongs * 10 + timeLeft;
		setScore((s) => s + Math.max(0, pts));
		setPhase("result");
	}

	return (
		<div style={{ background: "#0b0b1a", color: "#eee", padding: 16, fontFamily: "system-ui", minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>The Forger</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Two paintings are identical originals; one is a forgery. Click the forgery, then mark every changed shape on it.
			</p>
			<div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
				<span>Round {round + 1}</span>
				<span>Score: {score}</span>
				<span>Time: {timeLeft}s</span>
				{phase === "markChanges" && <button onClick={submit}>Submit</button>}
				{phase === "result" && <button onClick={() => setRound(round + 1)}>Next</button>}
			</div>
			<div style={{ display: "flex", gap: 16 }}>
				{[0, 1, 2].map((i) => (
					<div key={i} style={{ textAlign: "center" }}>
						<canvas
							ref={(el) => {
								canvasRefs.current[i] = el;
							}}
							width={W}
							height={H}
							onClick={() => (phase === "pickForgery" ? pickPainting(i) : null)}
							onMouseDown={(e) => (phase === "markChanges" && i === pickedIdx ? clickForgery(e) : null)}
							style={{
								border:
									phase === "pickForgery"
										? "2px solid #555"
										: i === pickedIdx
											? "3px solid gold"
											: "2px solid #333",
								cursor: phase === "pickForgery" ? "pointer" : i === pickedIdx ? "crosshair" : "default",
								background: "#000",
							}}
						/>
						<div>{phase === "result" && i === forgeryIdx ? "Forgery" : `#${i + 1}`}</div>
					</div>
				))}
			</div>
			{phase === "markChanges" && forgery && pickedIdx !== null && (
				<svg
					width={W}
					height={H}
					style={{
						position: "relative",
						marginTop: -H - 24,
						marginLeft: pickedIdx * (W + 16),
						pointerEvents: "none",
					}}
				>
					{Array.from(marks).map((i) => (
						<circle key={i} cx={forgery.shapes[i].x} cy={forgery.shapes[i].y} r={forgery.shapes[i].r + 6} fill="none" stroke="red" strokeWidth={2} />
					))}
				</svg>
			)}
			{phase === "result" && (
				<div style={{ marginTop: 16 }}>
					{pickedIdx === forgeryIdx ? "Correct forgery!" : `Wrong — forgery was #${forgeryIdx + 1}`}
					<div>Changes: {changedIndices.length}, you marked {marks.size}</div>
				</div>
			)}
		</div>
	);
}
