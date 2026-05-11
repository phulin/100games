import { useMemo, useState } from "react";

type Item = {
	name: string;
	hint: string;
	truePrice: number;
};

const TEMPLATES: { name: string; hint: string; base: number; spread: number }[] =
	[
		{
			name: "Victorian pocket watch",
			hint: "Engraved, working, original chain.",
			base: 800,
			spread: 600,
		},
		{
			name: "Cracked porcelain vase",
			hint: "Ming-style, but glazed too evenly.",
			base: 150,
			spread: 300,
		},
		{
			name: "Civil War letter",
			hint: "Authentic ink, dated 1863, from a private.",
			base: 400,
			spread: 300,
		},
		{
			name: "Mid-century chair",
			hint: "Eames-style, unmarked.",
			base: 250,
			spread: 250,
		},
		{
			name: "Baseball card",
			hint: "1952, slight crease, common player.",
			base: 60,
			spread: 80,
		},
		{
			name: "Antique map",
			hint: "Hand-colored, 1740, small water damage.",
			base: 1200,
			spread: 800,
		},
		{
			name: "Silver tea set",
			hint: "Sterling, 5 pieces, monogrammed.",
			base: 600,
			spread: 400,
		},
		{
			name: "Comic book #1",
			hint: "1962, fair condition, missing cover gloss.",
			base: 1500,
			spread: 1500,
		},
		{
			name: "Hand-carved decoy",
			hint: "Folk art, signed but unknown carver.",
			base: 120,
			spread: 200,
		},
		{
			name: "Brass telescope",
			hint: "Naval issue, 1880s, lens intact.",
			base: 700,
			spread: 500,
		},
		{
			name: "Quilt",
			hint: "Hand-stitched, 1920s, faded patches.",
			base: 200,
			spread: 250,
		},
		{
			name: "Movie poster",
			hint: "1977, original print, two pinholes.",
			base: 900,
			spread: 700,
		},
	];

function randItems(): Item[] {
	const picked = [...TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 4);
	return picked.map((t) => ({
		name: t.name,
		hint: t.hint,
		truePrice: Math.max(
			10,
			Math.round(t.base + (Math.random() - 0.5) * 2 * t.spread),
		),
	}));
}

export default function Game083_AntiquesRoadshow() {
	const [round, setRound] = useState(1);
	const [items, setItems] = useState<Item[]>(() => randItems());
	const [bids, setBids] = useState<string[]>(["", "", "", ""]);
	const [reveal, setReveal] = useState(false);
	const [totalErr, setTotalErr] = useState(0);

	const submit = () => {
		let err = 0;
		bids.forEach((b, i) => {
			const v = parseFloat(b) || 0;
			err += Math.abs(v - items[i].truePrice);
		});
		setTotalErr(totalErr + err);
		setReveal(true);
	};

	const next = () => {
		setRound(round + 1);
		setItems(randItems());
		setBids(["", "", "", ""]);
		setReveal(false);
	};

	const reset = () => {
		setRound(1);
		setItems(randItems());
		setBids(["", "", "", ""]);
		setReveal(false);
		setTotalErr(0);
	};

	const roundErr = useMemo(() => {
		if (!reveal) return 0;
		let err = 0;
		bids.forEach((b, i) => {
			const v = parseFloat(b) || 0;
			err += Math.abs(v - items[i].truePrice);
		});
		return err;
	}, [reveal, bids, items]);

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#f0e6d2",
				background: "#1a0f08",
				padding: 20,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>83. Antiques Roadshow</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
				Price each item. Lowest total absolute error wins.
			</div>
			<div>
				Round {round} · Cumulative error: ${totalErr.toLocaleString()}
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 16,
					marginTop: 16,
				}}
			>
				{items.map((it, i) => {
					const v = parseFloat(bids[i]) || 0;
					const err = reveal ? Math.abs(v - it.truePrice) : 0;
					return (
						<div
							key={i}
							style={{
								background: "#2c1810",
								padding: 12,
								borderRadius: 6,
								border: "1px solid #5a3a20",
							}}
						>
							<div style={{ fontWeight: "bold" }}>{it.name}</div>
							<div style={{ fontSize: 13, fontStyle: "italic", opacity: 0.85 }}>
								{it.hint}
							</div>
							<div style={{ marginTop: 8 }}>
								$
								<input
									type="number"
									value={bids[i]}
									disabled={reveal}
									onChange={(e) => {
										const b = bids.slice();
										b[i] = e.target.value;
										setBids(b);
									}}
									style={{
										width: 100,
										background: "#1a0f08",
										color: "#f0e6d2",
										border: "1px solid #5a3a20",
										padding: 4,
									}}
								/>
							</div>
							{reveal && (
								<div style={{ marginTop: 6, fontSize: 13 }}>
									Actual: ${it.truePrice.toLocaleString()} · off by $
									{err.toLocaleString()}
								</div>
							)}
						</div>
					);
				})}
			</div>
			<div style={{ marginTop: 16, display: "flex", gap: 8 }}>
				{!reveal ? (
					<button type="button" onClick={submit} style={btn}>
						Submit prices
					</button>
				) : (
					<>
						<div style={{ alignSelf: "center" }}>
							Round error: ${roundErr.toLocaleString()}
						</div>
						<button type="button" onClick={next} style={btn}>
							Next round
						</button>
					</>
				)}
				<button type="button" onClick={reset} style={btn}>
					Reset
				</button>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#5a3a20",
	color: "#fff",
	border: "1px solid #8a5a30",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};
