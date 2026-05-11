import { useEffect, useMemo, useRef, useState } from "react";

// Game 71 — Drift Trade
// A small ring of ports. Commodity prices oscillate on visible rhythms.
// Sail between, buying low and selling high.

type Port = {
	name: string;
	x: number;
	y: number;
	// price profile per commodity: amplitude/phase
	profile: Array<{ base: number; amp: number; phase: number; period: number }>;
};

const COMMODITIES = ["Silk", "Spice", "Iron", "Rum"];
const COLORS = ["#e7c46b", "#c8553d", "#7d8a9b", "#a05a2c"];

function makePorts(): Port[] {
	const center = { x: 450, y: 300 };
	const r = 200;
	const names = ["Aelir", "Borth", "Cazil", "Drun", "Esper"];
	return names.map((name, i) => {
		const a = (i / names.length) * Math.PI * 2 - Math.PI / 2;
		return {
			name,
			x: center.x + Math.cos(a) * r,
			y: center.y + Math.sin(a) * r,
			profile: COMMODITIES.map((_, j) => ({
				base: 30 + ((i * 7 + j * 13) % 30),
				amp: 12 + ((i * 5 + j * 11) % 12),
				phase: ((i + j * 2) * Math.PI) / 3,
				period: 14 + ((i + j * 3) % 8),
			})),
		};
	});
}

function priceAt(p: Port, c: number, t: number) {
	const pr = p.profile[c];
	return Math.round(pr.base + pr.amp * Math.sin((t / pr.period) * Math.PI * 2 + pr.phase));
}

export default function Game071_DriftTrade() {
	const [ports] = useState<Port[]>(() => makePorts());
	const [t, setT] = useState(0); // simulated time
	const [pos, setPos] = useState({ x: ports[0].x, y: ports[0].y });
	const [destIdx, setDestIdx] = useState<number | null>(null);
	const [atPort, setAtPort] = useState<number | null>(0);
	const [gold, setGold] = useState(100);
	const [fuel, setFuel] = useState(100);
	const [hold, setHold] = useState<number[]>(COMMODITIES.map(() => 0));
	const [, setHoldCost] = useState<number[]>(COMMODITIES.map(() => 0));
	const [log, setLog] = useState<string[]>(["Welcome to the trade ring."]);
	const [storm, setStorm] = useState<{ x: number; y: number } | null>(null);
	const [over, setOver] = useState(false);
	const raf = useRef<number | null>(null);
	const lastTs = useRef<number | null>(null);

	const holdCap = 8;
	const heldUnits = hold.reduce((a, b) => a + b, 0);

	useEffect(() => {
		const step = (ts: number) => {
			if (lastTs.current == null) lastTs.current = ts;
			const dt = (ts - lastTs.current) / 1000;
			lastTs.current = ts;
			setT((tt) => tt + dt);
			if (destIdx != null) {
				setPos((p) => {
					const dx = ports[destIdx].x - p.x;
					const dy = ports[destIdx].y - p.y;
					const d = Math.hypot(dx, dy);
					if (d < 3) {
						setAtPort(destIdx);
						setDestIdx(null);
						setLog((l) => [`Arrived at ${ports[destIdx].name}.`, ...l].slice(0, 6));
						return { x: ports[destIdx].x, y: ports[destIdx].y };
					}
					const v = 60 * dt;
					return { x: p.x + (dx / d) * v, y: p.y + (dy / d) * v };
				});
				setFuel((f) => Math.max(0, f - 4 * dt));
				// storm random
				if (Math.random() < 0.004) {
					setStorm({ x: 200 + Math.random() * 500, y: 100 + Math.random() * 400 });
					setTimeout(() => setStorm(null), 3000);
				}
			}
			raf.current = requestAnimationFrame(step);
		};
		raf.current = requestAnimationFrame(step);
		return () => {
			if (raf.current) cancelAnimationFrame(raf.current);
			lastTs.current = null;
		};
	}, [destIdx, ports]);

	useEffect(() => {
		if (!storm || destIdx == null) return;
		const d = Math.hypot(storm.x - pos.x, storm.y - pos.y);
		if (d < 50) {
			// damage: lose 1 hold item & some fuel
			setFuel((f) => Math.max(0, f - 5));
			setHold((h) => {
				const idx = h.findIndex((q) => q > 0);
				if (idx < 0) return h;
				const cp = [...h];
				cp[idx] -= 1;
				setLog((l) => [`Storm! Lost 1 ${COMMODITIES[idx]}.`, ...l].slice(0, 6));
				return cp;
			});
		}
	}, [pos, storm, destIdx]);

	useEffect(() => {
		if (fuel <= 0 && !over) {
			setOver(true);
			setLog((l) => ["Out of fuel. Adrift forever.", ...l].slice(0, 6));
		}
	}, [fuel, over]);

	const sailTo = (i: number) => {
		if (over || destIdx != null || atPort === i) return;
		setAtPort(null);
		setDestIdx(i);
	};

	const buy = (c: number) => {
		if (atPort == null || over) return;
		const price = priceAt(ports[atPort], c, t);
		if (gold < price || heldUnits >= holdCap) return;
		setGold((g) => g - price);
		setHold((h) => h.map((q, j) => (j === c ? q + 1 : q)));
		setHoldCost((h) => h.map((q, j) => (j === c ? q + price : q)));
	};

	const sell = (c: number) => {
		if (atPort == null || over || hold[c] <= 0) return;
		const price = priceAt(ports[atPort], c, t);
		setGold((g) => g + price);
		setHold((h) => h.map((q, j) => (j === c ? q - 1 : q)));
		setHoldCost((h) =>
			h.map((q, j) => (j === c ? Math.max(0, q - q / Math.max(1, hold[c])) : q))
		);
		setLog((l) =>
			[`Sold ${COMMODITIES[c]} @ ${price} in ${ports[atPort].name}.`, ...l].slice(0, 6)
		);
	};

	const refuel = () => {
		if (atPort == null || over) return;
		const cost = Math.ceil(100 - fuel);
		if (gold < cost) return;
		setGold((g) => g - cost);
		setFuel(100);
		setLog((l) => [`Refueled for ${cost}g.`, ...l].slice(0, 6));
	};

	const wave = useMemo(() => {
		if (atPort == null) return null;
		const p = ports[atPort];
		return COMMODITIES.map((_, i) => {
			const pts: string[] = [];
			for (let s = 0; s <= 40; s++) {
				const tt = t + s * 0.5;
				const y = 20 - (priceAt(p, i, tt) - p.profile[i].base) / 1.5;
				pts.push(`${s * 4},${y + 20}`);
			}
			return pts.join(" ");
		});
	}, [t, atPort, ports]);

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#0b2a3a,#1c4a63)",
				color: "#e8efe7",
				fontFamily: "system-ui, sans-serif",
				position: "relative",
				userSelect: "none",
			}}
		>
			<div style={{ position: "absolute", top: 8, left: 12, fontSize: 14 }}>
				<b>Drift Trade</b> — click a port to sail there. Buy low, sell high.
			</div>
			<svg width={620} height={540} style={{ position: "absolute", top: 40, left: 0 }}>
				{ports.map((p, i) => (
					<g key={i} onClick={() => sailTo(i)} style={{ cursor: "pointer" }}>
						<circle cx={p.x} cy={p.y} r={20} fill="#d9c79b" stroke="#7a6034" />
						<text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fill="#332">
							{p.name}
						</text>
					</g>
				))}
				{storm && (
					<circle cx={storm.x} cy={storm.y} r={40} fill="rgba(80,80,120,0.5)" />
				)}
				<circle cx={pos.x} cy={pos.y} r={6} fill="#fff" stroke="#222" />
			</svg>

			<div
				style={{
					position: "absolute",
					right: 0,
					top: 0,
					width: 280,
					height: 600,
					background: "rgba(0,0,0,0.45)",
					padding: 12,
					boxSizing: "border-box",
					fontSize: 13,
				}}
			>
				<div>Gold: <b>{gold}</b></div>
				<div>Fuel: <b>{fuel.toFixed(0)}</b></div>
				<div>
					Hold: <b>{heldUnits}/{holdCap}</b>
				</div>
				<hr />
				{atPort != null ? (
					<>
						<div style={{ fontWeight: "bold" }}>At {ports[atPort].name}</div>
						<svg width={170} height={50} style={{ background: "#0008", marginTop: 6 }}>
							{wave?.map((pts, i) => (
								<polyline key={i} fill="none" stroke={COLORS[i]} points={pts} />
							))}
							<line x1={0} y1={20} x2={170} y2={20} stroke="#fff3" />
						</svg>
						{COMMODITIES.map((c, i) => {
							const pr = priceAt(ports[atPort!], i, t);
							return (
								<div key={i} style={{ marginTop: 4 }}>
									<span style={{ color: COLORS[i] }}>■</span> {c} — {pr}g (have {hold[i]})
									<button
										onClick={() => buy(i)}
										style={{ marginLeft: 6 }}
										disabled={gold < pr || heldUnits >= holdCap || over}
									>
										Buy
									</button>
									<button
										onClick={() => sell(i)}
										style={{ marginLeft: 2 }}
										disabled={hold[i] <= 0 || over}
									>
										Sell
									</button>
								</div>
							);
						})}
						<button onClick={refuel} style={{ marginTop: 8 }} disabled={over}>
							Refuel ({Math.ceil(100 - fuel)}g)
						</button>
					</>
				) : (
					<div style={{ marginTop: 12 }}>Sailing…</div>
				)}
				<hr />
				<div style={{ fontSize: 11, opacity: 0.85 }}>
					{log.map((l, i) => (
						<div key={i}>· {l}</div>
					))}
				</div>
				{over && (
					<div style={{ color: "#f88", fontWeight: "bold", marginTop: 8 }}>
						Game over. Final gold: {gold}
					</div>
				)}
			</div>
		</div>
	);
}
