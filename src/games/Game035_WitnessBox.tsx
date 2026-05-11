import { useMemo, useState } from "react";

type Fragment = {
	id: number;
	text: string;
	trueOrder: number; // 1..N, 0 means false fragment
	witness: 0 | 1 | 2;
};

const CASES = [
	{
		name: "The Stolen Cake",
		truth: [
			"A man in a blue coat entered the bakery.",
			"He spoke to the cashier briefly.",
			"He picked up a chocolate cake from the counter.",
			"He walked out without paying.",
			"The cashier shouted but he was already gone.",
		],
		lies: [
			"He had a small dog with him.",
			"He paid with a hundred-dollar bill.",
			"He left through the back door.",
		],
	},
	{
		name: "The Park Bench",
		truth: [
			"A woman sat on the bench reading a newspaper.",
			"A child ran past chasing a red ball.",
			"The woman picked up the ball and returned it.",
			"The child's parent thanked her warmly.",
			"The woman folded her paper and left.",
		],
		lies: [
			"The woman was wearing a yellow hat.",
			"She bought ice cream from a vendor.",
			"A pigeon landed on her shoulder.",
		],
	},
];

function buildFragments(caseIdx: number): Fragment[] {
	const c = CASES[caseIdx];
	const out: Fragment[] = [];
	let id = 0;
	c.truth.forEach((t, i) => {
		// each truth assigned to a random witness
		out.push({ id: id++, text: t, trueOrder: i + 1, witness: Math.floor(Math.random() * 3) as 0 | 1 | 2 });
	});
	c.lies.forEach((l) => {
		out.push({ id: id++, text: l, trueOrder: 0, witness: Math.floor(Math.random() * 3) as 0 | 1 | 2 });
	});
	// shuffle
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

export default function WitnessBox() {
	const [caseIdx, setCaseIdx] = useState(0);
	const [seed, setSeed] = useState(0);
	const fragments = useMemo(() => buildFragments(caseIdx), [caseIdx, seed]);
	const [timeline, setTimeline] = useState<number[]>([]); // fragment ids
	const [flagged, setFlagged] = useState<Set<number>>(new Set());
	const [verdict, setVerdict] = useState<string | null>(null);

	const fragMap = useMemo(() => new Map(fragments.map((f) => [f.id, f])), [fragments]);
	const inTimeline = new Set(timeline);

	const addToTimeline = (id: number) => {
		if (inTimeline.has(id)) return;
		setTimeline([...timeline, id]);
	};
	const removeFromTimeline = (id: number) => {
		setTimeline(timeline.filter((x) => x !== id));
	};
	const toggleFlag = (id: number) => {
		const ns = new Set(flagged);
		if (ns.has(id)) ns.delete(id);
		else ns.add(id);
		setFlagged(ns);
	};

	const check = () => {
		let correctOrder = true;
		let lastOrder = 0;
		for (const id of timeline) {
			const f = fragMap.get(id)!;
			if (f.trueOrder === 0) {
				correctOrder = false;
				break;
			}
			if (f.trueOrder <= lastOrder) {
				correctOrder = false;
				break;
			}
			lastOrder = f.trueOrder;
		}
		const trueCount = CASES[caseIdx].truth.length;
		const allTrueIncluded =
			timeline.filter((id) => fragMap.get(id)!.trueOrder > 0).length === trueCount;
		const lieIds = fragments.filter((f) => f.trueOrder === 0).map((f) => f.id);
		const correctFlags =
			lieIds.every((id) => flagged.has(id)) && [...flagged].every((id) => lieIds.includes(id));

		if (correctOrder && allTrueIncluded && correctFlags) {
			setVerdict("CASE CLOSED. Timeline correct, all lies flagged.");
		} else {
			const parts = [];
			if (!correctOrder) parts.push("timeline out of order or includes a lie");
			if (!allTrueIncluded) parts.push("missing true fragments");
			if (!correctFlags) parts.push("lies not correctly flagged");
			setVerdict("Not quite: " + parts.join("; "));
		}
	};

	const newCase = () => {
		setSeed((s) => s + 1);
		setTimeline([]);
		setFlagged(new Set());
		setVerdict(null);
	};

	const witnessColors = ["#ffb86b", "#8be9fd", "#ff79c6"];

	return (
		<div style={{ background: "#1c1620", color: "#eee", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Witness Box</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Build the timeline (click fragments). Right-click to flag a fragment as a lie.
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
				<select value={caseIdx} onChange={(e) => { setCaseIdx(Number(e.target.value)); newCase(); }}>
					{CASES.map((c, i) => (
						<option key={i} value={i}>
							{c.name}
						</option>
					))}
				</select>
				<button type="button" onClick={newCase}>
					New scramble
				</button>
				<button type="button" onClick={check}>
					Submit
				</button>
				{verdict && (
					<div style={{ color: verdict.startsWith("CASE CLOSED") ? "#7f7" : "#fc6" }}>{verdict}</div>
				)}
			</div>
			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
				<div>
					<h4>Statements</h4>
					{fragments.map((f) => (
						<div
							key={f.id}
							onClick={() => addToTimeline(f.id)}
							onContextMenu={(e) => {
								e.preventDefault();
								toggleFlag(f.id);
							}}
							style={{
								padding: 6,
								margin: "4px 0",
								background: inTimeline.has(f.id) ? "#2a2030" : "#2a2438",
								borderLeft: `4px solid ${witnessColors[f.witness]}`,
								opacity: inTimeline.has(f.id) ? 0.4 : 1,
								textDecoration: flagged.has(f.id) ? "line-through" : "none",
								color: flagged.has(f.id) ? "#f88" : "#eee",
								cursor: "pointer",
								fontSize: 13,
							}}
						>
							<span style={{ opacity: 0.6, fontSize: 11 }}>W{f.witness + 1}:</span> {f.text}
						</div>
					))}
				</div>
				<div>
					<h4>Timeline</h4>
					{timeline.length === 0 && <div style={{ opacity: 0.5 }}>Empty</div>}
					{timeline.map((id, i) => {
						const f = fragMap.get(id)!;
						return (
							<div
								key={id}
								onClick={() => removeFromTimeline(id)}
								style={{
									padding: 6,
									margin: "4px 0",
									background: "#1a2030",
									borderLeft: `4px solid ${witnessColors[f.witness]}`,
									cursor: "pointer",
									fontSize: 13,
								}}
							>
								<span style={{ opacity: 0.6 }}>{i + 1}.</span> {f.text}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
