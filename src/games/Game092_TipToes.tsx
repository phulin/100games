import { useEffect, useRef, useState } from "react";

const W = 14;
const H = 10;
type Tile = "floor" | "creak" | "wall" | "item" | "exit";

function makeMap(): Tile[][] {
	const m: Tile[][] = Array.from({ length: H }, () =>
		Array<Tile>(W).fill("floor"),
	);
	// border walls
	for (let x = 0; x < W; x++) {
		m[0][x] = "wall";
		m[H - 1][x] = "wall";
	}
	for (let y = 0; y < H; y++) {
		m[y][0] = "wall";
		m[y][W - 1] = "wall";
	}
	// interior walls
	for (let i = 0; i < 12; i++) {
		const x = 1 + Math.floor(Math.random() * (W - 2));
		const y = 1 + Math.floor(Math.random() * (H - 2));
		m[y][x] = "wall";
	}
	// creaky boards
	for (let i = 0; i < 16; i++) {
		const x = 1 + Math.floor(Math.random() * (W - 2));
		const y = 1 + Math.floor(Math.random() * (H - 2));
		if (m[y][x] === "floor") m[y][x] = "creak";
	}
	m[1][1] = "floor";
	m[H - 2][W - 2] = "exit";
	// item somewhere
	while (true) {
		const x = 1 + Math.floor(Math.random() * (W - 2));
		const y = 1 + Math.floor(Math.random() * (H - 2));
		if (m[y][x] === "floor" && !(x === 1 && y === 1)) {
			m[y][x] = "item";
			break;
		}
	}
	return m;
}

export default function Game092_TipToes() {
	const [map, setMap] = useState<Tile[][]>(makeMap);
	const [pos, setPos] = useState({ x: 1, y: 1 });
	const [noise, setNoise] = useState(0);
	const [hasItem, setHasItem] = useState(false);
	const [state, setState] = useState<"play" | "win" | "lose">("play");
	const mapRef = useRef(map);
	mapRef.current = map;

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (state !== "play") return;
			const dirs: Record<string, [number, number]> = {
				ArrowUp: [0, -1],
				ArrowDown: [0, 1],
				ArrowLeft: [-1, 0],
				ArrowRight: [1, 0],
				w: [0, -1],
				s: [0, 1],
				a: [-1, 0],
				d: [1, 0],
			};
			const d = dirs[e.key];
			if (!d) return;
			e.preventDefault();
			setPos((p) => {
				const nx = p.x + d[0];
				const ny = p.y + d[1];
				const t = mapRef.current[ny]?.[nx];
				if (!t || t === "wall") return p;
				let dn = 1; // base step noise
				if (t === "creak") dn = 8;
				setNoise((n) => {
					const total = n + dn;
					if (total >= 100) setState("lose");
					return Math.min(100, total);
				});
				if (t === "item") {
					setHasItem(true);
					setMap((m) =>
						m.map((row, ry) =>
							row.map((c, cx) => (cx === nx && ry === ny ? "floor" : c)),
						),
					);
				}
				if (t === "exit" && hasItem) setState("win");
				return { x: nx, y: ny };
			});
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [state, hasItem]);

	// noise slowly decays
	useEffect(() => {
		if (state !== "play") return;
		const id = setInterval(() => setNoise((n) => Math.max(0, n - 1)), 250);
		return () => clearInterval(id);
	}, [state]);

	function reset() {
		setMap(makeMap());
		setPos({ x: 1, y: 1 });
		setNoise(0);
		setHasItem(false);
		setState("play");
	}

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui",
				background: "#0d1117",
				color: "#cdd6e1",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Tip Toes</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Arrows to move. Grab the key, then reach the door. Dark tiles creak
				loudly.
			</p>
			<div style={{ marginBottom: 8 }}>
				Noise:{" "}
				<div
					style={{
						display: "inline-block",
						width: 240,
						height: 12,
						background: "#222",
						verticalAlign: "middle",
						border: "1px solid #444",
					}}
				>
					<div
						style={{
							width: `${noise}%`,
							height: "100%",
							background: noise > 75 ? "#e63946" : "#f4a261",
						}}
					/>
				</div>
				<span style={{ marginLeft: 12, fontSize: 12 }}>
					{hasItem ? "Key in hand" : "Find the key"}
				</span>
			</div>
			<div
				style={{
					display: "inline-block",
					background: "#1b1f24",
					padding: 6,
					borderRadius: 4,
				}}
			>
				{map.map((row, y) => (
					<div key={y} style={{ display: "flex" }}>
						{row.map((t, x) => {
							const player = pos.x === x && pos.y === y;
							let bg = "#2a2f36";
							if (t === "wall") bg = "#1a1f24";
							else if (t === "creak") bg = "#3a2630";
							else if (t === "exit") bg = "#2a9d8f";
							else if (t === "item") bg = "#e9c46a";
							return (
								<div
									key={x}
									style={{
										width: 36,
										height: 36,
										background: bg,
										border: "1px solid #11151a",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: 18,
									}}
								>
									{player
										? "🧦"
										: t === "item"
											? "🔑"
											: t === "exit"
												? "🚪"
												: ""}
								</div>
							);
						})}
					</div>
				))}
			</div>
			{state !== "play" && (
				<div style={{ marginTop: 12 }}>
					<strong>
						{state === "win" ? "You escaped silently." : "The dog awoke!"}
					</strong>
					<button onClick={reset} style={{ marginLeft: 12 }}>
						New house
					</button>
				</div>
			)}
		</div>
	);
}
