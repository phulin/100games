import { useEffect, useRef, useState } from "react";

// 4 chambers in a tree: top -> via gates -> two mid -> via gates -> three bottom
// Tilt left/right biases the splits.

type Chambers = {
	top: number;
	midL: number;
	midR: number;
	b0: number;
	b1: number;
	b2: number;
};
const INIT: Chambers = { top: 100, midL: 0, midR: 0, b0: 0, b1: 0, b2: 0 };

// targets for bottom proportions (out of 100)
const TARGET = { b0: 30, b1: 50, b2: 20 };

const FLOW_RATE = 12; // sand per second per active outlet

export default function Game095_Hourglass() {
	const [c, setC] = useState<Chambers>(INIT);
	const [tilt, setTilt] = useState(0); // -1..1
	const [running, setRunning] = useState(false);
	const [done, setDone] = useState(false);
	const tiltRef = useRef(0);
	tiltRef.current = tilt;
	const lastRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (!running) return;
		function tick(now: number) {
			if (lastRef.current == null) lastRef.current = now;
			const dt = (now - lastRef.current) / 1000;
			lastRef.current = now;

			setC((s) => {
				const t = tiltRef.current;
				// top -> midL/midR. tilt -1 => all left, +1 => all right
				const topRate = FLOW_RATE * dt;
				const fromTop = Math.min(s.top, topRate);
				const leftFrac = 0.5 - t * 0.5; // 0..1
				const toL = fromTop * leftFrac;
				const toR = fromTop * (1 - leftFrac);

				// mid -> bottoms. b0 from midL, b2 from midR, b1 from both (center)
				const midLRate = Math.min(s.midL + toL, FLOW_RATE * dt);
				const midRRate = Math.min(s.midR + toR, FLOW_RATE * dt);
				// distribute midL flow between b0 and b1 by (1-tilt right shift)
				const midLToB0 = midLRate * (0.5 - t * 0.5);
				const midLToB1 = midLRate - midLToB0;
				const midRToB2 = midRRate * (0.5 + t * 0.5);
				const midRToB1 = midRRate - midRToB2;

				const ns: Chambers = {
					top: s.top - fromTop,
					midL: s.midL + toL - midLRate,
					midR: s.midR + toR - midRRate,
					b0: s.b0 + midLToB0,
					b1: s.b1 + midLToB1 + midRToB1,
					b2: s.b2 + midRToB2,
				};
				if (ns.top <= 0.01 && ns.midL <= 0.01 && ns.midR <= 0.01) {
					ns.top = 0;
					ns.midL = 0;
					ns.midR = 0;
					setRunning(false);
					setDone(true);
				}
				return ns;
			});
			if (running) rafRef.current = requestAnimationFrame(tick);
		}
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			lastRef.current = null;
		};
	}, [running]);

	function reset() {
		setC(INIT);
		setTilt(0);
		setRunning(false);
		setDone(false);
		lastRef.current = null;
	}

	function score(): number {
		const total = c.b0 + c.b1 + c.b2 || 1;
		const p0 = (c.b0 / total) * 100,
			p1 = (c.b1 / total) * 100,
			p2 = (c.b2 / total) * 100;
		const err =
			Math.abs(p0 - TARGET.b0) +
			Math.abs(p1 - TARGET.b1) +
			Math.abs(p2 - TARGET.b2);
		return Math.max(0, Math.round(100 - err));
	}

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui",
				background: "#1f1a14",
				color: "#f0e3c2",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Hourglass</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Use ← → (or the slider) to tilt and route sand. Hit target proportions:{" "}
				{TARGET.b0}% / {TARGET.b1}% / {TARGET.b2}%.
			</p>

			<div style={{ display: "flex", gap: 24 }}>
				<svg
					viewBox="0 0 360 420"
					width={360}
					height={420}
					style={{ background: "#0e0a06", borderRadius: 8 }}
				>
					{/* top chamber */}
					<Chamber
						x={120}
						y={20}
						w={120}
						h={90}
						fill={c.top / 100}
						label={`${Math.round(c.top)}`}
					/>
					{/* split lines */}
					<line x1={180} y1={110} x2={100} y2={150} stroke="#806040" />
					<line x1={180} y1={110} x2={260} y2={150} stroke="#806040" />
					{/* mid chambers */}
					<Chamber
						x={40}
						y={150}
						w={100}
						h={70}
						fill={c.midL / 50}
						label={`${Math.round(c.midL)}`}
					/>
					<Chamber
						x={220}
						y={150}
						w={100}
						h={70}
						fill={c.midR / 50}
						label={`${Math.round(c.midR)}`}
					/>
					{/* mid -> bottom links */}
					<line x1={90} y1={220} x2={50} y2={260} stroke="#806040" />
					<line x1={90} y1={220} x2={180} y2={260} stroke="#806040" />
					<line x1={270} y1={220} x2={180} y2={260} stroke="#806040" />
					<line x1={270} y1={220} x2={310} y2={260} stroke="#806040" />
					{/* bottoms */}
					<Chamber
						x={10}
						y={260}
						w={80}
						h={140}
						fill={c.b0 / 100}
						label={`${Math.round(c.b0)}`}
						target={TARGET.b0}
					/>
					<Chamber
						x={140}
						y={260}
						w={80}
						h={140}
						fill={c.b1 / 100}
						label={`${Math.round(c.b1)}`}
						target={TARGET.b1}
					/>
					<Chamber
						x={270}
						y={260}
						w={80}
						h={140}
						fill={c.b2 / 100}
						label={`${Math.round(c.b2)}`}
						target={TARGET.b2}
					/>
					{/* tilt indicator */}
					<g transform={`translate(180,410) rotate(${tilt * 20})`}>
						<line
							x1={-40}
							y1={0}
							x2={40}
							y2={0}
							stroke="#e9c46a"
							strokeWidth={3}
						/>
					</g>
				</svg>

				<div style={{ flex: 1 }}>
					<div style={{ marginBottom: 12 }}>
						<label style={{ fontSize: 12, opacity: 0.7 }}>Tilt</label>
						<br />
						<input
							type="range"
							min={-1}
							max={1}
							step={0.01}
							value={tilt}
							onChange={(e) => setTilt(parseFloat(e.target.value))}
							style={{ width: 240 }}
						/>
					</div>
					<button onClick={() => setRunning((r) => !r)} disabled={done}>
						{running ? "Pause" : "Start"}
					</button>
					<button onClick={reset} style={{ marginLeft: 8 }}>
						Reset
					</button>
					{done && (
						<div style={{ marginTop: 14, fontSize: 16 }}>
							<strong>Final score: {score()}/100</strong>
						</div>
					)}
					<div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
						Tip: tilt steers each gate. The center chamber gathers leakage from
						both sides.
					</div>
				</div>
			</div>
		</div>
	);
}

function Chamber({
	x,
	y,
	w,
	h,
	fill,
	label,
	target,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	fill: number;
	label: string;
	target?: number;
}) {
	const f = Math.max(0, Math.min(1, fill));
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={w}
				height={h}
				fill="none"
				stroke="#a07a40"
				strokeWidth={2}
				rx={4}
			/>
			<rect
				x={x + 1}
				y={y + h * (1 - f) + 1}
				width={w - 2}
				height={h * f - 2}
				fill="#e9c46a"
				rx={3}
			/>
			<text
				x={x + w / 2}
				y={y + h / 2}
				fill="#fff"
				fontSize={12}
				textAnchor="middle"
				dominantBaseline="middle"
			>
				{label}
			</text>
			{target != null && (
				<text
					x={x + w / 2}
					y={y + h + 14}
					fill="#e63946"
					fontSize={11}
					textAnchor="middle"
				>
					target {target}%
				</text>
			)}
		</g>
	);
}
