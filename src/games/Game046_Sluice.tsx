import { useEffect, useMemo, useState } from "react";

// The Sluice — route water and logs through gates to mills with target volume + log count.

type Gate = { id: number; x: number; y: number; angle: number /* 0..1, 0 = left, 1 = right */ };
type Mill = {
	id: number;
	x: number;
	y: number;
	targetWater: number;
	targetLogs: number;
	gotWater: number;
	gotLogs: number;
};

const SOURCE_X = 440;
const SOURCE_Y = 30;

// Logical "tree" of gates: each gate sends fraction to left/right child gate or mill.
// 3-level binary tree → 7 gates → 8 leaves (mills). We use 4 mills (group pairs).

const GATE_POSITIONS: { x: number; y: number }[] = [
	{ x: 440, y: 100 }, // g0
	{ x: 240, y: 220 }, // g1 (left of g0)
	{ x: 640, y: 220 }, // g2 (right of g0)
	{ x: 140, y: 340 }, // g3
	{ x: 340, y: 340 }, // g4
	{ x: 540, y: 340 }, // g5
	{ x: 740, y: 340 }, // g6
];

const MILL_X = [100, 240, 380, 520, 660, 780];

// Tree: child indices for [left,right] per gate
const CHILDREN: ([number, "g" | "m"] | null)[][] = [
	[
		[1, "g"],
		[2, "g"],
	],
	[
		[3, "g"],
		[4, "g"],
	],
	[
		[5, "g"],
		[6, "g"],
	],
	[
		[0, "m"],
		[1, "m"],
	],
	[
		[1, "m"],
		[2, "m"],
	],
	[
		[2, "m"],
		[3, "m"],
	],
	[
		[3, "m"],
		[4, "m"],
	],
];

const MILL_POS = MILL_X.slice(0, 5).map((x) => ({ x, y: 440 }));

export default function Game046_Sluice() {
	const [gates, setGates] = useState<Gate[]>(() =>
		GATE_POSITIONS.map((p, i) => ({ id: i, x: p.x, y: p.y, angle: 0.5 }))
	);
	const [mills, setMills] = useState<Mill[]>(() => [
		{ id: 0, ...MILL_POS[0], targetWater: 20, targetLogs: 2, gotWater: 0, gotLogs: 0 },
		{ id: 1, ...MILL_POS[1], targetWater: 30, targetLogs: 1, gotWater: 0, gotLogs: 0 },
		{ id: 2, ...MILL_POS[2], targetWater: 25, targetLogs: 3, gotWater: 0, gotLogs: 0 },
		{ id: 3, ...MILL_POS[3], targetWater: 15, targetLogs: 2, gotWater: 0, gotLogs: 0 },
		{ id: 4, ...MILL_POS[4], targetWater: 10, targetLogs: 1, gotWater: 0, gotLogs: 0 },
	]);
	const [released, setReleased] = useState(false);
	const [time, setTime] = useState(0);

	// Simulate continuous water flow & discrete logs given current gate config
	const flow = useMemo(() => {
		// returns per-mill water rate and per-mill log probability weights
		const waterByMill: number[] = mills.map(() => 0);
		const logWeightByMill: number[] = mills.map(() => 0);
		const propagate = (gateIdx: number, vol: number) => {
			const g = gates[gateIdx];
			const leftFrac = 1 - g.angle;
			const rightFrac = g.angle;
			const children = CHILDREN[gateIdx];
			[
				{ frac: leftFrac, side: 0 },
				{ frac: rightFrac, side: 1 },
			].forEach(({ frac, side }) => {
				const c = children[side];
				if (!c) return;
				const [idx, type] = c;
				if (type === "g") propagate(idx, vol * frac);
				else if (idx < mills.length) {
					waterByMill[idx] += vol * frac;
					logWeightByMill[idx] += frac;
				}
			});
		};
		propagate(0, 50); // total 50 units/sec from source
		return { waterByMill, logWeightByMill };
	}, [gates, mills.length]);

	useEffect(() => {
		if (!released) return;
		let raf = 0;
		let last = 0;
		const totalDuration = 8;
		const step = (t: number) => {
			if (!last) last = t;
			const dt = (t - last) / 1000;
			last = t;
			setTime((tt) => {
				const nt = tt + dt;
				if (nt >= totalDuration) {
					setReleased(false);
					return totalDuration;
				}
				return nt;
			});
			setMills((ms) =>
				ms.map((m, i) => ({
					...m,
					gotWater: m.gotWater + flow.waterByMill[i] * dt,
				}))
			);
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [released, flow]);

	// Logs released at discrete intervals while flowing
	useEffect(() => {
		if (!released) return;
		const id = window.setInterval(() => {
			// choose a mill by weight
			const weights = flow.logWeightByMill;
			const sum = weights.reduce((a, b) => a + b, 0);
			if (sum === 0) return;
			let r = Math.random() * sum;
			let chosen = 0;
			for (let i = 0; i < weights.length; i++) {
				r -= weights[i];
				if (r <= 0) {
					chosen = i;
					break;
				}
			}
			setMills((ms) => ms.map((m, i) => (i === chosen ? { ...m, gotLogs: m.gotLogs + 1 } : m)));
		}, 800);
		return () => clearInterval(id);
	}, [released, flow]);

	const setGate = (id: number, angle: number) => {
		if (released) return;
		setGates((gs) => gs.map((g) => (g.id === id ? { ...g, angle } : g)));
	};

	const release = () => {
		setMills((ms) => ms.map((m) => ({ ...m, gotWater: 0, gotLogs: 0 })));
		setTime(0);
		setReleased(true);
	};

	const reset = () => {
		setMills((ms) => ms.map((m) => ({ ...m, gotWater: 0, gotLogs: 0 })));
		setTime(0);
		setReleased(false);
	};

	const totalScore = mills.reduce((acc, m) => {
		const wErr = Math.abs(m.gotWater - m.targetWater);
		const lErr = Math.abs(m.gotLogs - m.targetLogs) * 8;
		return acc - wErr - lErr;
	}, 200);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#0e1820",
				color: "#cee",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<h2 style={{ margin: 4 }}>The Sluice</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Drag gate handles left/right. Release water — each mill needs target water AND logs.
			</div>
			<svg width={880} height={520} style={{ background: "#0a141a", borderRadius: 8 }}>
				{/* source */}
				<circle cx={SOURCE_X} cy={SOURCE_Y} r={14} fill="#48a" />
				<line x1={SOURCE_X} y1={SOURCE_Y} x2={gates[0].x} y2={gates[0].y} stroke="#48a" strokeWidth={6} />
				{/* gate->child lines */}
				{gates.map((g, i) => {
					const ch = CHILDREN[i];
					return ch.map((c, side) => {
						if (!c) return null;
						const [idx, type] = c;
						const tgt = type === "g" ? gates[idx] : mills[idx];
						if (!tgt) return null;
						return (
							<line
								key={`${i}-${side}`}
								x1={g.x}
								y1={g.y}
								x2={tgt.x}
								y2={tgt.y}
								stroke={side === 0 ? "#356" : "#365"}
								strokeWidth={3}
								opacity={side === 0 ? 1 - g.angle : g.angle}
							/>
						);
					});
				})}
				{/* gates */}
				{gates.map((g) => (
					<g key={g.id}>
						<rect x={g.x - 30} y={g.y - 10} width={60} height={20} fill="#234" rx={4} />
						<rect
							x={g.x - 30 + g.angle * 50}
							y={g.y - 14}
							width={10}
							height={28}
							fill="#ec6"
							onMouseDown={(e) => {
								const startX = e.clientX;
								const startA = g.angle;
								const onMove = (ev: MouseEvent) => {
									const dx = ev.clientX - startX;
									setGate(g.id, Math.max(0, Math.min(1, startA + dx / 50)));
								};
								const onUp = () => {
									window.removeEventListener("mousemove", onMove);
									window.removeEventListener("mouseup", onUp);
								};
								window.addEventListener("mousemove", onMove);
								window.addEventListener("mouseup", onUp);
							}}
							style={{ cursor: "ew-resize" }}
						/>
					</g>
				))}
				{/* mills */}
				{mills.map((m) => {
					const wOk = Math.abs(m.gotWater - m.targetWater) < 3;
					const lOk = m.gotLogs === m.targetLogs;
					return (
						<g key={m.id}>
							<rect
								x={m.x - 32}
								y={m.y - 25}
								width={64}
								height={50}
								fill={wOk && lOk ? "#2a5a2a" : "#43342a"}
								stroke="#876"
								rx={4}
							/>
							<text x={m.x} y={m.y - 6} textAnchor="middle" fill="#fff" fontSize={11}>
								water {m.gotWater.toFixed(0)}/{m.targetWater}
							</text>
							<text x={m.x} y={m.y + 8} textAnchor="middle" fill="#fff" fontSize={11}>
								logs {m.gotLogs}/{m.targetLogs}
							</text>
						</g>
					);
				})}
			</svg>
			<div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
				<button type="button" onClick={release} disabled={released} style={btn}>
					{released ? `Flowing... ${time.toFixed(1)}s` : "Release water (8s)"}
				</button>
				<button type="button" onClick={reset} style={btn}>
					Reset
				</button>
				<div>Score: {totalScore.toFixed(0)}</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "6px 12px",
	borderRadius: 6,
	cursor: "pointer",
};
