import { useEffect, useMemo, useState } from "react";

type Star = { x: number; y: number; r: number };

type SavedConst = { stars: Star[]; edges: [number, number][]; name: string; votes: number; total: number };

const W = 700;
const H = 500;

function genStars(seed: number): Star[] {
	let s = seed;
	const rng = () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
	const n = 12 + Math.floor(rng() * 8);
	const stars: Star[] = [];
	for (let i = 0; i < n; i++) {
		stars.push({
			x: 40 + rng() * (W - 80),
			y: 40 + rng() * (H - 80),
			r: 2 + rng() * 3,
		});
	}
	return stars;
}

export default function Game017_Constellation() {
	const [seed] = useState(() => Math.floor(Date.now() / 86400000));
	const stars = useMemo(() => genStars(seed), [seed]);
	const [edges, setEdges] = useState<[number, number][]>([]);
	const [selected, setSelected] = useState<number | null>(null);
	const [name, setName] = useState("");
	const [submitted, setSubmitted] = useState<SavedConst | null>(null);
	const [archive, setArchive] = useState<SavedConst[]>([]);
	const [view, setView] = useState<"create" | "archive">("create");
	const [voted, setVoted] = useState<Set<number>>(new Set());

	useEffect(() => {
		try {
			const data = localStorage.getItem("constellations");
			if (data) setArchive(JSON.parse(data));
		} catch {}
	}, []);

	function saveArchive(a: SavedConst[]) {
		setArchive(a);
		localStorage.setItem("constellations", JSON.stringify(a));
	}

	function clickStar(i: number) {
		if (submitted) return;
		if (selected === null) {
			setSelected(i);
		} else if (selected === i) {
			setSelected(null);
		} else {
			const exists = edges.some((e) => (e[0] === i && e[1] === selected) || (e[0] === selected && e[1] === i));
			if (!exists) setEdges([...edges, [selected, i]]);
			setSelected(null);
		}
	}

	function submit() {
		if (!name.trim() || edges.length === 0) return;
		const saved: SavedConst = { stars, edges, name: name.trim(), votes: 1, total: 1 };
		setSubmitted(saved);
		saveArchive([saved, ...archive].slice(0, 50));
	}

	function reset() {
		setEdges([]);
		setName("");
		setSubmitted(null);
		setSelected(null);
	}

	function vote(idx: number, fits: boolean) {
		if (voted.has(idx)) return;
		const a = archive.slice();
		a[idx] = { ...a[idx], votes: a[idx].votes + (fits ? 1 : 0), total: a[idx].total + 1 };
		saveArchive(a);
		setVoted(new Set([...voted, idx]));
	}

	return (
		<div style={{ background: "#000010", color: "#eee", padding: 16, fontFamily: "system-ui" }}>
			<h2 style={{ margin: 0 }}>Constellation</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Click two stars to draw a line between them. Name your constellation, then vote on past ones.
			</p>
			<div style={{ marginBottom: 8 }}>
				<button onClick={() => setView("create")}>Create</button>
				<button onClick={() => setView("archive")} style={{ marginLeft: 8 }}>
					Archive ({archive.length})
				</button>
			</div>
			{view === "create" && (
				<>
					<svg width={W} height={H} style={{ background: "#04081a", border: "1px solid #222", display: "block" }}>
						{edges.map(([a, b], i) => (
							<line
								key={i}
								x1={stars[a].x}
								y1={stars[a].y}
								x2={stars[b].x}
								y2={stars[b].y}
								stroke="rgba(255,255,255,0.6)"
								strokeWidth={1.5}
							/>
						))}
						{stars.map((s, i) => (
							<circle
								key={i}
								cx={s.x}
								cy={s.y}
								r={selected === i ? s.r + 4 : s.r + 2}
								fill={selected === i ? "#ffd166" : "white"}
								onClick={() => clickStar(i)}
								style={{ cursor: "pointer" }}
							/>
						))}
					</svg>
					<div style={{ marginTop: 12 }}>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Name your constellation..."
							style={{ padding: 6, width: 240 }}
						/>
						<button onClick={submit} style={{ marginLeft: 8 }} disabled={!!submitted}>
							Submit
						</button>
						<button onClick={reset} style={{ marginLeft: 8 }}>
							Reset
						</button>
					</div>
					{submitted && (
						<div style={{ marginTop: 12 }}>
							Saved "{submitted.name}" to the archive. Switch tabs to see how others vote.
						</div>
					)}
				</>
			)}
			{view === "archive" && (
				<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
					{archive.length === 0 && <div>No constellations yet — submit one.</div>}
					{archive.map((c, i) => (
						<div key={i} style={{ background: "#04081a", padding: 8, border: "1px solid #222" }}>
							<svg width={220} height={160} style={{ background: "#000" }}>
								{c.edges.map(([a, b], j) => (
									<line
										key={j}
										x1={(c.stars[a].x / W) * 220}
										y1={(c.stars[a].y / H) * 160}
										x2={(c.stars[b].x / W) * 220}
										y2={(c.stars[b].y / H) * 160}
										stroke="white"
										strokeWidth={1}
									/>
								))}
								{c.stars.map((s, j) => (
									<circle key={j} cx={(s.x / W) * 220} cy={(s.y / H) * 160} r={1.5} fill="white" />
								))}
							</svg>
							<div style={{ fontWeight: "bold" }}>{c.name}</div>
							<div style={{ fontSize: 12, opacity: 0.7 }}>
								Fit: {c.total > 0 ? Math.round((c.votes / c.total) * 100) : 0}% ({c.total} votes)
							</div>
							{!voted.has(i) && (
								<div>
									<button onClick={() => vote(i, true)}>Fits</button>
									<button onClick={() => vote(i, false)} style={{ marginLeft: 4 }}>
										Doesn't
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
