import { useEffect, useRef, useState } from "react";

type Dipole = { x: number; y: number; angle: number; strength: number };
const W = 720,
	H = 460;

function makeTarget(): Dipole[] {
	// a known config to match
	return [
		{ x: 240, y: 230, angle: 0, strength: 1 },
		{ x: 480, y: 230, angle: Math.PI, strength: 1 },
	];
}

function fieldAt(x: number, y: number, dipoles: Dipole[]): [number, number] {
	let fx = 0,
		fy = 0;
	for (const d of dipoles) {
		const dx = x - d.x,
			dy = y - d.y;
		const r2 = dx * dx + dy * dy + 100;
		const r = Math.sqrt(r2);
		const ux = Math.cos(d.angle),
			uy = Math.sin(d.angle);
		const dot = (dx * ux + dy * uy) / r;
		// simple dipole field: B = (3 (m·r̂) r̂ - m) / r^3
		const bx = ((3 * dot * dx) / r - ux) / r2;
		const by = ((3 * dot * dy) / r - uy) / r2;
		fx += bx * d.strength * 50000;
		fy += by * d.strength * 50000;
	}
	return [fx, fy];
}

function compareFields(a: Dipole[], b: Dipole[]): number {
	// sample grid, compare angles
	let err = 0,
		n = 0;
	for (let x = 40; x < W; x += 40) {
		for (let y = 40; y < H; y += 40) {
			const [ax, ay] = fieldAt(x, y, a);
			const [bx, by] = fieldAt(x, y, b);
			const angA = Math.atan2(ay, ax);
			const angB = Math.atan2(by, bx);
			let d = Math.abs(angA - angB);
			if (d > Math.PI) d = 2 * Math.PI - d;
			err += d;
			n++;
		}
	}
	return err / n; // 0..pi
}

export default function Game099_MagneticField() {
	const target = useRef(makeTarget());
	const [dipoles, setDipoles] = useState<Dipole[]>([
		{ x: 200, y: 230, angle: 0, strength: 1 },
		{ x: 520, y: 230, angle: 0, strength: 1 },
	]);
	const [dragIdx, setDragIdx] = useState<number | null>(null);
	const [rotIdx, setRotIdx] = useState<number | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const targetCanvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		drawField(canvasRef.current!, dipoles, "#2a6df4");
		drawField(targetCanvasRef.current!, target.current, "#999");
	}, [dipoles]);

	function onMouseDown(e: React.MouseEvent) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left,
			y = e.clientY - rect.top;
		for (let i = 0; i < dipoles.length; i++) {
			const d = dipoles[i];
			const dist = Math.hypot(d.x - x, d.y - y);
			if (dist < 20) {
				if (e.shiftKey) setRotIdx(i);
				else setDragIdx(i);
				return;
			}
		}
	}
	function onMouseMove(e: React.MouseEvent) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left,
			y = e.clientY - rect.top;
		if (dragIdx != null) {
			setDipoles((ds) =>
				ds.map((d, i) => (i === dragIdx ? { ...d, x, y } : d)),
			);
		} else if (rotIdx != null) {
			setDipoles((ds) =>
				ds.map((d, i) =>
					i === rotIdx ? { ...d, angle: Math.atan2(y - d.y, x - d.x) } : d,
				),
			);
		}
	}
	function onMouseUp() {
		setDragIdx(null);
		setRotIdx(null);
	}

	const err = compareFields(dipoles, target.current);
	const score = Math.max(0, Math.round((1 - err / Math.PI) * 100));

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui",
				background: "#0a0d1a",
				color: "#dde",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Magnetic Field</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Drag dipoles to move; Shift-drag to rotate. Match the target field
				pattern.
			</p>

			<div style={{ display: "flex", gap: 16 }}>
				<div>
					<div style={{ fontSize: 12, opacity: 0.7 }}>Target</div>
					<canvas
						ref={targetCanvasRef}
						width={W / 2}
						height={H / 2}
						style={{ background: "#000", borderRadius: 4 }}
					/>
				</div>
				<div>
					<div style={{ fontSize: 12, opacity: 0.7 }}>
						Yours — match: <strong>{score}%</strong>
					</div>
					<canvas
						ref={canvasRef}
						width={W}
						height={H}
						style={{
							background: "#000",
							borderRadius: 4,
							cursor: dragIdx != null ? "grabbing" : "crosshair",
						}}
						onMouseDown={onMouseDown}
						onMouseMove={onMouseMove}
						onMouseUp={onMouseUp}
						onMouseLeave={onMouseUp}
					/>
				</div>
			</div>
			<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
				Tip: dipole alignment matters as much as position. Shift+drag to rotate.
			</div>
		</div>
	);
}

function drawField(
	canvas: HTMLCanvasElement,
	dipoles: Dipole[],
	color: string,
) {
	const ctx = canvas.getContext("2d")!;
	const w = canvas.width,
		h = canvas.height;
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, w, h);

	// scale dipole positions when target canvas is half size
	const scale = w / W;
	const ds = dipoles.map((d) => ({ ...d, x: d.x * scale, y: d.y * scale }));

	ctx.strokeStyle = color;
	ctx.globalAlpha = 0.7;
	const step = 22 * scale;
	for (let x = step / 2; x < w; x += step) {
		for (let y = step / 2; y < h; y += step) {
			// compute in original coord space
			const ox = x / scale,
				oy = y / scale;
			const [fx, fy] = fieldAt(ox, oy, dipoles);
			const mag = Math.hypot(fx, fy);
			const len = Math.min(step * 0.45, Math.log(1 + mag) * 2);
			const ang = Math.atan2(fy, fx);
			const ex = x + Math.cos(ang) * len,
				ey = y + Math.sin(ang) * len;
			ctx.beginPath();
			ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
			ctx.lineTo(ex, ey);
			ctx.stroke();
			// arrowhead
			ctx.beginPath();
			ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		}
	}
	ctx.globalAlpha = 1;

	// draw dipoles
	for (const d of ds) {
		const r = 12 * scale;
		ctx.save();
		ctx.translate(d.x, d.y);
		ctx.rotate(d.angle);
		ctx.fillStyle = "#e63946";
		ctx.fillRect(-r, -r / 3, r, r / 1.5); // N
		ctx.fillStyle = "#2a6df4";
		ctx.fillRect(0, -r / 3, r, r / 1.5); // S
		ctx.strokeStyle = "#fff";
		ctx.strokeRect(-r, -r / 3, 2 * r, ((r / 1.5) * 2) / 2);
		ctx.restore();
	}
}
