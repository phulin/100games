import { useEffect, useMemo, useRef, useState } from "react";

const W = 14;
const H = 10;
type Tile = "floor" | "creak" | "wall" | "exit";
type Item = { x: number; y: number; got: boolean };
type Guard = {
	x: number;
	y: number;
	path: { x: number; y: number }[];
	step: number;
};

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hashStr(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function todayKey(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type MapState = {
	tiles: Tile[][];
	items: Item[];
	guards: Guard[];
	start: { x: number; y: number };
	exit: { x: number; y: number };
};

function bfs(tiles: Tile[][], sx: number, sy: number): number[][] {
	const dist: number[][] = Array.from({ length: H }, () => Array(W).fill(-1));
	dist[sy][sx] = 0;
	const q: [number, number][] = [[sx, sy]];
	while (q.length) {
		const [x, y] = q.shift()!;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		]) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
			if (tiles[ny][nx] === "wall") continue;
			if (dist[ny][nx] !== -1) continue;
			dist[ny][nx] = dist[y][x] + 1;
			q.push([nx, ny]);
		}
	}
	return dist;
}

function makeMap(seed: number, level: number): MapState {
	const rng = mulberry32(seed);
	for (let attempt = 0; attempt < 30; attempt++) {
		const tiles: Tile[][] = Array.from({ length: H }, () =>
			Array<Tile>(W).fill("floor"),
		);
		for (let x = 0; x < W; x++) {
			tiles[0][x] = "wall";
			tiles[H - 1][x] = "wall";
		}
		for (let y = 0; y < H; y++) {
			tiles[y][0] = "wall";
			tiles[y][W - 1] = "wall";
		}
		const wallCount = 10 + level * 2;
		for (let i = 0; i < wallCount; i++) {
			const x = 1 + Math.floor(rng() * (W - 2));
			const y = 1 + Math.floor(rng() * (H - 2));
			tiles[y][x] = "wall";
		}
		const creakCount = 14 + level * 3;
		for (let i = 0; i < creakCount; i++) {
			const x = 1 + Math.floor(rng() * (W - 2));
			const y = 1 + Math.floor(rng() * (H - 2));
			if (tiles[y][x] === "floor") tiles[y][x] = "creak";
		}
		const start = { x: 1, y: 1 };
		const exit = { x: W - 2, y: H - 2 };
		tiles[start.y][start.x] = "floor";
		tiles[exit.y][exit.x] = "exit";

		const dist = bfs(tiles, start.x, start.y);
		if (dist[exit.y][exit.x] < 0) continue;

		const itemCount = 1 + Math.min(2, Math.floor(level / 2));
		const items: Item[] = [];
		let ok = true;
		for (let i = 0; i < itemCount; i++) {
			let placed = false;
			for (let tries = 0; tries < 80; tries++) {
				const x = 1 + Math.floor(rng() * (W - 2));
				const y = 1 + Math.floor(rng() * (H - 2));
				if (
					tiles[y][x] === "floor" &&
					!(x === start.x && y === start.y) &&
					dist[y][x] > 0 &&
					!items.some((it) => it.x === x && it.y === y)
				) {
					items.push({ x, y, got: false });
					placed = true;
					break;
				}
			}
			if (!placed) {
				ok = false;
				break;
			}
		}
		if (!ok) continue;

		const guardCount = Math.min(3, Math.floor(level / 2));
		const guards: Guard[] = [];
		for (let g = 0; g < guardCount; g++) {
			for (let tries = 0; tries < 60; tries++) {
				const x = 2 + Math.floor(rng() * (W - 4));
				const y = 2 + Math.floor(rng() * (H - 4));
				if (
					tiles[y][x] !== "floor" ||
					(x === start.x && y === start.y) ||
					items.some((it) => it.x === x && it.y === y)
				)
					continue;
				const horiz = rng() < 0.5;
				const len = 2 + Math.floor(rng() * 3);
				const path: { x: number; y: number }[] = [];
				let bad = false;
				for (let k = 0; k < len; k++) {
					const px = horiz ? x + k : x;
					const py = horiz ? y : y + k;
					if (!tiles[py] || tiles[py][px] === "wall") {
						bad = true;
						break;
					}
					path.push({ x: px, y: py });
				}
				if (bad || path.length < 2) continue;
				guards.push({ x: path[0].x, y: path[0].y, path, step: 0 });
				break;
			}
		}
		return { tiles, items, guards, start, exit };
	}
	const tiles: Tile[][] = Array.from({ length: H }, () =>
		Array<Tile>(W).fill("floor"),
	);
	for (let x = 0; x < W; x++) {
		tiles[0][x] = "wall";
		tiles[H - 1][x] = "wall";
	}
	for (let y = 0; y < H; y++) {
		tiles[y][0] = "wall";
		tiles[y][W - 1] = "wall";
	}
	tiles[H - 2][W - 2] = "exit";
	return {
		tiles,
		items: [{ x: 5, y: 5, got: false }],
		guards: [],
		start: { x: 1, y: 1 },
		exit: { x: W - 2, y: H - 2 },
	};
}

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		try {
			_ac = new (window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext)();
		} catch {
			return null;
		}
	}
	return _ac;
}
function noiseBurst(dur: number, freq: number, vol: number) {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const n = Math.floor(c.sampleRate * dur);
	const b = c.createBuffer(1, n, c.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < n; i++) {
		const env = 1 - i / n;
		d[i] = (Math.random() * 2 - 1) * env;
	}
	const src = c.createBufferSource();
	src.buffer = b;
	const f = c.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = freq;
	f.Q.value = 1.5;
	const g = c.createGain();
	g.gain.value = vol;
	src.connect(f).connect(g).connect(c.destination);
	src.start(t);
	src.stop(t + dur + 0.02);
}
function footstep() {
	noiseBurst(0.05, 600, 0.08);
}
function creakSnd() {
	noiseBurst(0.25, 320, 0.18);
}
function chime(freq: number) {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "sine";
	o.frequency.value = freq;
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + 0.45);
}

export default function Game092_TipToes() {
	const [seedInput, setSeedInput] = useState<string>(() => todayKey());
	const [level, setLevel] = useState(0);
	const seed = useMemo(
		() => hashStr(`${seedInput}|L${level}`),
		[seedInput, level],
	);
	const [map, setMap] = useState<MapState>(() => makeMap(seed, level));
	const [pos, setPos] = useState({ x: 1, y: 1 });
	const [noise, setNoise] = useState(0);
	const [state, setState] = useState<"play" | "win" | "lose">("play");
	const [steps, setSteps] = useState(0);
	const mapRef = useRef(map);
	mapRef.current = map;
	const posRef = useRef(pos);
	posRef.current = pos;

	useEffect(() => {
		const m = makeMap(seed, level);
		setMap(m);
		setPos(m.start);
		setNoise(0);
		setState("play");
		setSteps(0);
	}, [seed, level]);

	const allItemsGot = map.items.every((i) => i.got);

	useEffect(() => {
		function tickGuards(playerNoise: number) {
			setMap((m) => {
				const guards = m.guards.map((g) => {
					const np = g.path[(g.step + 1) % g.path.length];
					return {
						...g,
						x: np.x,
						y: np.y,
						step: (g.step + 1) % g.path.length,
					};
				});
				const px = posRef.current.x;
				const py = posRef.current.y;
				const seen = guards.some((g) => {
					if (g.x === px && g.y === py) return true;
					if (playerNoise < 4) return false;
					if (g.x === px && Math.abs(g.y - py) <= 2) return true;
					if (g.y === py && Math.abs(g.x - px) <= 2) return true;
					return false;
				});
				if (seen) {
					setState("lose");
					noiseBurst(0.5, 180, 0.28);
				}
				return { ...m, guards };
			});
		}
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
				" ": [0, 0],
			};
			const d = dirs[e.key];
			if (!d) return;
			e.preventDefault();
			const p = posRef.current;
			if (d[0] === 0 && d[1] === 0) {
				tickGuards(0);
				setSteps((n) => n + 1);
				return;
			}
			const nx = p.x + d[0];
			const ny = p.y + d[1];
			const t = mapRef.current.tiles[ny]?.[nx];
			if (!t || t === "wall") return;
			let dn = 1;
			if (t === "creak") {
				dn = 8;
				creakSnd();
			} else {
				footstep();
			}
			let noiseLost = false;
			setNoise((n) => {
				const total = n + dn;
				if (total >= 100) noiseLost = true;
				return Math.min(100, total);
			});
			if (noiseLost) {
				setState("lose");
				noiseBurst(0.6, 200, 0.3);
				setPos({ x: nx, y: ny });
				setSteps((n) => n + 1);
				return;
			}
			const itemHere = mapRef.current.items.find(
				(it) => !it.got && it.x === nx && it.y === ny,
			);
			if (itemHere) {
				chime(880);
				// Sync mapRef immediately so the exit check below sees this pickup.
				mapRef.current = {
					...mapRef.current,
					items: mapRef.current.items.map((it) =>
						it.x === nx && it.y === ny ? { ...it, got: true } : it,
					),
				};
				setMap(mapRef.current);
			}
			if (
				nx === mapRef.current.exit.x &&
				ny === mapRef.current.exit.y
			) {
				const stillMissing = mapRef.current.items.some((it) => !it.got);
				if (!stillMissing) {
					setState("win");
					chime(1320);
				}
			}
			setPos({ x: nx, y: ny });
			setSteps((n) => n + 1);
			tickGuards(dn);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [state]);

	useEffect(() => {
		if (state !== "play") return;
		const id = setInterval(() => setNoise((n) => Math.max(0, n - 1)), 250);
		return () => clearInterval(id);
	}, [state]);

	function reset() {
		setSeedInput(`r${Math.floor(Math.random() * 1e9)}`);
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
			<p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.7 }}>
				Arrows/WASD to move, Space to wait. Grab all keys, reach the door.
				Watch the patrols.
			</p>
			<div
				style={{
					display: "flex",
					gap: 10,
					alignItems: "center",
					marginBottom: 8,
					fontSize: 12,
				}}
			>
				<label>
					Seed:{" "}
					<input
						value={seedInput}
						onChange={(e) => setSeedInput(e.target.value)}
						style={{ width: 120 }}
					/>
				</label>
				<button onClick={() => setSeedInput(todayKey())}>Daily</button>
				<button onClick={reset}>New house</button>
				<span>
					Level {level + 1} · {map.items.filter((i) => i.got).length}/
					{map.items.length} keys · steps {steps}
				</span>
				<button onClick={() => setLevel((l) => Math.max(0, l - 1))}>−</button>
				<button onClick={() => setLevel((l) => Math.min(6, l + 1))}>+</button>
			</div>
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
					{allItemsGot ? "Head to the door" : "Find the keys"}
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
				{map.tiles.map((row, y) => (
					<div key={y} style={{ display: "flex" }}>
						{row.map((t, x) => {
							const player = pos.x === x && pos.y === y;
							const guard = map.guards.find((g) => g.x === x && g.y === y);
							const item = map.items.find(
								(i) => !i.got && i.x === x && i.y === y,
							);
							let bg = "#2a2f36";
							if (t === "wall") bg = "#1a1f24";
							else if (t === "creak") bg = "#3a2630";
							else if (t === "exit") bg = allItemsGot ? "#2a9d8f" : "#2a5a55";
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
										: guard
											? "👁"
											: item
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
						{state === "win"
							? `Escaped silently in ${steps} steps.`
							: "Caught!"}
					</strong>
					<button onClick={reset} style={{ marginLeft: 12 }}>
						New house
					</button>
					{state === "win" && (
						<button
							onClick={() => setLevel((l) => Math.min(6, l + 1))}
							style={{ marginLeft: 8 }}
						>
							Next level
						</button>
					)}
				</div>
			)}
		</div>
	);
}
