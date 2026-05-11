import { useMemo, useRef, useState } from "react";

// Polygon-based fold simulator.
// The sheet is a list of convex polygons (initially a single square).
// A fold line in screen space reflects all points on one side across the line.

type Pt = { x: number; y: number };
type Poly = { pts: Pt[]; color: string };

const SIZE = 380;
const ORIGIN = { x: 200, y: 200 };

function reflect(p: Pt, a: Pt, b: Pt): Pt {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
	const projX = a.x + t * dx;
	const projY = a.y + t * dy;
	return { x: 2 * projX - p.x, y: 2 * projY - p.y };
}

function sideOf(p: Pt, a: Pt, b: Pt) {
	return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function splitPoly(poly: Pt[], a: Pt, b: Pt): { left: Pt[]; right: Pt[] } {
	const left: Pt[] = [];
	const right: Pt[] = [];
	for (let i = 0; i < poly.length; i++) {
		const cur = poly[i];
		const nxt = poly[(i + 1) % poly.length];
		const sCur = sideOf(cur, a, b);
		const sNxt = sideOf(nxt, a, b);
		if (sCur >= 0) left.push(cur);
		if (sCur <= 0) right.push(cur);
		if ((sCur > 0 && sNxt < 0) || (sCur < 0 && sNxt > 0)) {
			// intersection
			const t = sCur / (sCur - sNxt);
			const ix = cur.x + t * (nxt.x - cur.x);
			const iy = cur.y + t * (nxt.y - cur.y);
			left.push({ x: ix, y: iy });
			right.push({ x: ix, y: iy });
		}
	}
	return { left, right };
}

function foldPolygons(polys: Poly[], a: Pt, b: Pt, side: 1 | -1): Poly[] {
	const out: Poly[] = [];
	for (const poly of polys) {
		const { left, right } = splitPoly(poly.pts, a, b);
		const keep = side === 1 ? left : right;
		const flip = side === 1 ? right : left;
		if (keep.length >= 3) out.push({ pts: keep, color: poly.color });
		if (flip.length >= 3) {
			out.push({ pts: flip.map((p) => reflect(p, a, b)), color: poly.color });
		}
	}
	return out;
}

const TARGETS = [
	{
		name: "Triangle (half-fold)",
		minFolds: 1,
		test: (polys: Poly[]) => {
			// expect a triangular silhouette (3 polys outline forming roughly triangle)
			const allPts = polys.flatMap((p) => p.pts);
			if (allPts.length === 0) return false;
			// crude: check that bounding box has ratio near 1 and below midline empty
			const ys = allPts.map((p) => p.y);
			const minY = Math.min(...ys);
			const maxY = Math.max(...ys);
			return maxY - minY < SIZE * 0.6;
		},
	},
	{
		name: "Small square (quarter)",
		minFolds: 2,
		test: (polys: Poly[]) => {
			const allPts = polys.flatMap((p) => p.pts);
			if (allPts.length === 0) return false;
			const xs = allPts.map((p) => p.x);
			const ys = allPts.map((p) => p.y);
			const w = Math.max(...xs) - Math.min(...xs);
			const h = Math.max(...ys) - Math.min(...ys);
			return Math.abs(w - h) < 30 && w < SIZE * 0.6;
		},
	},
];

export default function Origami() {
	const square: Pt[] = [
		{ x: ORIGIN.x - SIZE / 2, y: ORIGIN.y - SIZE / 2 },
		{ x: ORIGIN.x + SIZE / 2, y: ORIGIN.y - SIZE / 2 },
		{ x: ORIGIN.x + SIZE / 2, y: ORIGIN.y + SIZE / 2 },
		{ x: ORIGIN.x - SIZE / 2, y: ORIGIN.y + SIZE / 2 },
	];
	const [polys, setPolys] = useState<Poly[]>([{ pts: square, color: "#e8d8a8" }]);
	const [folds, setFolds] = useState(0);
	const [target, setTarget] = useState(0);
	const [drag, setDrag] = useState<{ a: Pt; b: Pt | null }>({ a: { x: 0, y: 0 }, b: null });
	const svgRef = useRef<SVGSVGElement>(null);

	const toLocal = (e: React.MouseEvent): Pt => {
		const r = svgRef.current!.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};

	const onDown = (e: React.MouseEvent) => {
		setDrag({ a: toLocal(e), b: null });
	};
	const onMove = (e: React.MouseEvent) => {
		if (drag.b !== null || !drag.a) return;
		setDrag((d) => ({ a: d.a, b: toLocal(e) }));
	};
	const onUp = (e: React.MouseEvent) => {
		const b = toLocal(e);
		if (!drag.a) return;
		const dx = b.x - drag.a.x;
		const dy = b.y - drag.a.y;
		if (Math.hypot(dx, dy) < 20) {
			setDrag({ a: { x: 0, y: 0 }, b: null });
			return;
		}
		// determine which side has the click-origin (the side user is folding FROM)
		// use a point slightly perpendicular to drag direction from midpoint - actually simpler:
		// fold the side that has the smaller polygon area? Default: fold the side with the centroid that is BELOW the line based on shift key? Use button:
		const side: 1 | -1 = e.shiftKey ? -1 : 1;
		setPolys((p) => foldPolygons(p, drag.a, b, side));
		setFolds((f) => f + 1);
		setDrag({ a: { x: 0, y: 0 }, b: null });
	};

	const reset = () => {
		setPolys([{ pts: square, color: "#e8d8a8" }]);
		setFolds(0);
	};

	const t = TARGETS[target];
	const matches = useMemo(() => t.test(polys), [polys, t]);

	return (
		<div style={{ background: "#222", color: "#eee", padding: 16, fontFamily: "sans-serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Origami</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Drag across the sheet to make a fold. Shift+drag folds the other side.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}>
				<div>Folds: {folds}</div>
				<div>
					Target:{" "}
					<select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
						{TARGETS.map((t, i) => (
							<option key={i} value={i}>
								{t.name}
							</option>
						))}
					</select>
				</div>
				<button type="button" onClick={reset}>
					Reset
				</button>
				{matches && folds <= t.minFolds + 2 && folds >= t.minFolds && (
					<div style={{ color: "#7f7" }}>MATCHED in {folds} folds!</div>
				)}
			</div>
			<svg
				ref={svgRef}
				width={400}
				height={400}
				style={{ background: "#333", cursor: "crosshair" }}
				onMouseDown={onDown}
				onMouseMove={onMove}
				onMouseUp={onUp}
			>
				{polys.map((p, i) => (
					<polygon
						key={i}
						points={p.pts.map((q) => `${q.x},${q.y}`).join(" ")}
						fill={p.color}
						fillOpacity={0.7}
						stroke="#5a4a20"
						strokeWidth={1}
					/>
				))}
				{drag.b && (
					<line
						x1={drag.a.x}
						y1={drag.a.y}
						x2={drag.b.x}
						y2={drag.b.y}
						stroke="#f55"
						strokeWidth={2}
						strokeDasharray="4 3"
					/>
				)}
			</svg>
		</div>
	);
}
