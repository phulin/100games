import { useEffect, useRef, useState } from "react";

const W = 60;
const H = 40;
const CELL = 14;

type Terrain = "rock" | "village" | "barrier" | "lava" | "cooled";

type State = {
	terrain: Terrain[];
	lavaAmt: Float32Array; // amount per cell
	elev: Float32Array;
};

function makeState(): State {
	const t: Terrain[] = new Array(W * H).fill("rock");
	const lavaAmt = new Float32Array(W * H);
	const elev = new Float32Array(W * H);
	// Elevation: high at top, low at bottom. Add ridges.
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const baseE = (H - y) / H;
			const ridge =
				0.04 * Math.sin(x * 0.4) +
				0.03 * Math.cos(y * 0.3 + x * 0.1) +
				0.05 * Math.sin((x + y) * 0.2);
			elev[y * W + x] = baseE + ridge;
		}
	}
	// villages at bottom
	for (let i = 0; i < 4; i++) {
		const vx = 10 + Math.floor(Math.random() * (W - 20));
		const vy = H - 4 - Math.floor(Math.random() * 3);
		for (let dy = 0; dy < 2; dy++)
			for (let dx = 0; dx < 3; dx++) {
				t[(vy + dy) * W + (vx + dx)] = "village";
			}
	}
	// Initial lava at peak
	const peakX = Math.floor(W / 2);
	const peakY = 1;
	lavaAmt[peakY * W + peakX] = 5;
	t[peakY * W + peakX] = "lava";
	return { terrain: t, lavaAmt, elev };
}

export default function Game088_Volcano() {
	const [state, setState] = useState<State>(() => makeState());
	const [barriers, setBarriers] = useState(15);
	const [tick, setTick] = useState(0);
	const [running, setRunning] = useState(false);
	const stateRef = useRef(state);
	stateRef.current = state;

	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => {
			const s = stateRef.current;
			const t = s.terrain.slice();
			const a = new Float32Array(s.lavaAmt);
			// Add new lava from peak
			a[1 * W + Math.floor(W / 2)] += 1.5;
			// Flow: each cell distributes some lava to lower elevation neighbors
			const next = new Float32Array(a);
			for (let y = 0; y < H; y++) {
				for (let x = 0; x < W; x++) {
					const i = y * W + x;
					if (a[i] < 0.05) continue;
					if (t[i] === "barrier" || t[i] === "cooled") continue;
					const myE = s.elev[i] + a[i] * 0.1;
					const cands: { idx: number; drop: number }[] = [];
					const neigh = [
						[1, 0],
						[-1, 0],
						[0, 1],
						[0, -1],
					];
					for (const [dx, dy] of neigh) {
						const nx = x + dx;
						const ny = y + dy;
						if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
						const ni = ny * W + nx;
						if (t[ni] === "barrier" || t[ni] === "cooled") continue;
						const ne = s.elev[ni] + a[ni] * 0.1;
						if (ne < myE) cands.push({ idx: ni, drop: myE - ne });
					}
					if (cands.length === 0) continue;
					const sum = cands.reduce((s, c) => s + c.drop, 0);
					const flow = Math.min(a[i] * 0.5, a[i] - 0.1);
					if (flow <= 0) continue;
					for (const c of cands) {
						next[c.idx] += (flow * c.drop) / sum;
					}
					next[i] -= flow;
				}
			}
			// Cooling: cells with lava lose some each tick, and if low enough, harden.
			for (let i = 0; i < next.length; i++) {
				next[i] *= 0.985;
				if (next[i] > 0.3 && t[i] !== "village" && t[i] !== "barrier") {
					t[i] = "lava";
				} else if (next[i] < 0.05 && t[i] === "lava") {
					t[i] = "cooled";
					next[i] = 0;
				}
			}
			setState({ terrain: t, lavaAmt: next, elev: s.elev });
			setTick((tt) => tt + 1);
		}, 200);
		return () => clearInterval(id);
	}, [running]);

	const click = (i: number) => {
		const t = state.terrain.slice();
		if (t[i] === "rock") {
			if (barriers <= 0) return;
			t[i] = "barrier";
			setBarriers(barriers - 1);
			setState({ ...state, terrain: t });
		} else if (t[i] === "barrier") {
			t[i] = "rock";
			setBarriers(barriers + 1);
			setState({ ...state, terrain: t });
		}
	};

	const villagesAlive = state.terrain.filter((c) => c === "village").length;
	const initVillages = 4 * 2 * 3;

	const reset = () => {
		setState(makeState());
		setBarriers(15);
		setTick(0);
		setRunning(false);
	};

	return (
		<div
			style={{
				fontFamily: "system-ui, sans-serif",
				color: "#fee",
				background: "#100808",
				padding: 12,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>88. Volcano</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Click empty rock to place barriers (gray) — they redirect lava but
				become permanent terrain. Save the villages (cyan).
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
				<button type="button" onClick={() => setRunning((r) => !r)} style={btn}>
					{running ? "Pause" : "Erupt"}
				</button>
				<button type="button" onClick={reset} style={btn}>
					Reset
				</button>
				<div>Barriers: {barriers}</div>
				<div>Tick: {tick}</div>
				<div>
					Villages: {villagesAlive}/{initVillages}
				</div>
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: `repeat(${W}, ${CELL}px)`,
					gap: 0,
				}}
			>
				{state.terrain.map((c, i) => {
					const lava = state.lavaAmt[i];
					let bg = "#444";
					if (c === "rock") {
						const e = state.elev[i];
						const shade = Math.floor(40 + e * 80);
						bg = `rgb(${shade},${shade - 5},${shade - 10})`;
					}
					if (c === "village") bg = "#3ec1c8";
					if (c === "barrier") bg = "#888";
					if (c === "cooled") bg = "#2a1810";
					if (c === "lava" || lava > 0.1) {
						const v = Math.min(1, lava / 3);
						bg = `rgb(${200 + v * 55},${80 - v * 40},${20})`;
					}
					return (
						<div
							key={i}
							onClick={() => click(i)}
							style={{ width: CELL, height: CELL, background: bg }}
						/>
					);
				})}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "4px 10px",
	background: "#5a2010",
	color: "#fff",
	border: "1px solid #8a4030",
	borderRadius: 4,
	cursor: "pointer",
};
