import { useState } from "react";

type Car = { id: number; color: string };
type Yard = { main: Car[]; side: Car[]; out: Car[] };

const COLORS = [
	"#e63946",
	"#f4a261",
	"#e9c46a",
	"#2a9d8f",
	"#264653",
	"#a06cd5",
];
const SIDE_CAPACITY = 3;

function shuffle<T>(a: T[]): T[] {
	const r = a.slice();
	for (let i = r.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[r[i], r[j]] = [r[j], r[i]];
	}
	return r;
}

function makePuzzle(n: number): { start: Car[]; target: Car[] } {
	const target: Car[] = Array.from({ length: n }, (_, i) => ({
		id: i,
		color: COLORS[i % COLORS.length],
	}));
	let start = shuffle(target);
	// ensure not already solved
	if (start.every((c, i) => c.id === target[i].id)) start = shuffle(target);
	return { start, target };
}

export default function Game091_TrainYard() {
	const [level, setLevel] = useState(0);
	const [puzzle, setPuzzle] = useState(() => makePuzzle(5));
	const [yard, setYard] = useState<Yard>({
		main: puzzle.start.slice(),
		side: [],
		out: [],
	});
	const [moves, setMoves] = useState(0);
	const won =
		yard.out.length === puzzle.target.length &&
		yard.out.every((c, i) => c.id === puzzle.target[i].id);

	function newPuzzle(n: number) {
		const p = makePuzzle(n);
		setPuzzle(p);
		setYard({ main: p.start.slice(), side: [], out: [] });
		setMoves(0);
	}

	function move(from: "main" | "side" | "out", to: "main" | "side" | "out") {
		setYard((y) => {
			const src = y[from];
			if (src.length === 0) return y;
			// out only accepts from main; cars enter out in sequence
			if (to === "side" && y.side.length >= SIDE_CAPACITY) return y;
			const car = src[src.length - 1];
			const ny: Yard = {
				main: y.main.slice(),
				side: y.side.slice(),
				out: y.out.slice(),
			};
			ny[from] = ny[from].slice(0, -1);
			ny[to] = [...ny[to], car];
			setMoves((m) => m + 1);
			return ny;
		});
	}

	const status = won ? `Solved in ${moves} moves!` : `Moves: ${moves}`;

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui, sans-serif",
				color: "#222",
				background: "#fdf6e3",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 6px" }}>Train Yard</h2>
			<p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>
				Shunt cars from Main into Out in target order. Use Side track (cap{" "}
				{SIDE_CAPACITY}) as a stack.
			</p>

			<div style={{ marginBottom: 14, fontSize: 14 }}>
				<strong>Target order (left = first out):</strong>
				<div style={{ display: "flex", gap: 4, marginTop: 6 }}>
					{puzzle.target.map((c) => (
						<CarTile key={c.id} car={c} />
					))}
				</div>
			</div>

			<Track label={`Main (top = head)`} cars={yard.main} />
			<div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
				<button onClick={() => move("main", "side")} disabled={won}>
					Main → Side
				</button>
				<button onClick={() => move("side", "main")} disabled={won}>
					Side → Main
				</button>
				<button onClick={() => move("main", "out")} disabled={won}>
					Main → Out
				</button>
				<button onClick={() => move("side", "out")} disabled={won}>
					Side → Out
				</button>
			</div>
			<Track label={`Side (cap ${SIDE_CAPACITY})`} cars={yard.side} />
			<Track label="Out" cars={yard.out} />

			<div style={{ marginTop: 14 }}>
				<strong>{status}</strong>{" "}
				{won && (
					<button
						onClick={() => {
							setLevel(level + 1);
							newPuzzle(Math.min(8, 5 + level + 1));
						}}
						style={{ marginLeft: 12 }}
					>
						Next level
					</button>
				)}
				<button onClick={() => newPuzzle(5 + level)} style={{ marginLeft: 8 }}>
					Reset
				</button>
			</div>
		</div>
	);
}

function CarTile({ car }: { car: Car }) {
	return (
		<div
			style={{
				width: 56,
				height: 36,
				background: car.color,
				color: "#fff",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				borderRadius: 4,
				fontWeight: 600,
				boxShadow: "0 1px 2px rgba(0,0,0,.2)",
			}}
		>
			{car.id + 1}
		</div>
	);
}

function Track({ label, cars }: { label: string; cars: Car[] }) {
	return (
		<div style={{ margin: "8px 0" }}>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{label}</div>
			<div
				style={{
					display: "flex",
					gap: 4,
					padding: 8,
					background: "#eee2c0",
					borderRadius: 6,
					minHeight: 52,
					border: "1px dashed #b8a16a",
				}}
			>
				{cars.map((c, i) => (
					<CarTile key={i} car={c} />
				))}
			</div>
		</div>
	);
}
