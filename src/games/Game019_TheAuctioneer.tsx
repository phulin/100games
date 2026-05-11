import { useEffect, useState } from "react";

type Item = { name: string; trueValue: number; hint: string };
type Bidder = {
	name: string;
	willPay: number; // fraction of trueValue
	patience: number; // chance to keep raising
	color: string;
	history: string[];
};

const POSSIBLE_ITEMS: Item[] = [
	{ name: "Pocket watch", trueValue: 120, hint: "ticking faintly, gold-plated" },
	{ name: "Old map", trueValue: 80, hint: "yellowed but unremarkable" },
	{ name: "Silver locket", trueValue: 200, hint: "engraved, fits a small portrait" },
	{ name: "Wooden box", trueValue: 40, hint: "ordinary, slightly dusty" },
	{ name: "Brass telescope", trueValue: 250, hint: "scratched lens but extends smoothly" },
	{ name: "Stuffed owl", trueValue: 60, hint: "moth-eaten" },
	{ name: "Crystal goblet", trueValue: 180, hint: "rings clearly when tapped" },
	{ name: "Leather book", trueValue: 150, hint: "hand-bound, illegible script" },
];

const BIDDER_TEMPLATES: Omit<Bidder, "history">[] = [
	{ name: "Lady Ashford", willPay: 0.85, patience: 0.6, color: "#e76f51" },
	{ name: "Mr. Quill", willPay: 1.1, patience: 0.4, color: "#2a9d8f" },
	{ name: "The Stranger", willPay: 0.7, patience: 0.8, color: "#f4a261" },
];

function pickItems(seed: number, n: number): Item[] {
	const arr = POSSIBLE_ITEMS.slice();
	const rng = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 2 ** 32;
	};
	const out: Item[] = [];
	for (let i = 0; i < n; i++) {
		const idx = Math.floor(rng() * arr.length);
		out.push(arr.splice(idx, 1)[0]);
	}
	return out;
}

export default function Game019_TheAuctioneer() {
	const [items] = useState(() => pickItems(Date.now(), 3));
	const [bidders, setBidders] = useState<Bidder[]>(() =>
		BIDDER_TEMPLATES.map((b) => ({ ...b, history: [] })),
	);
	const [round, setRound] = useState(0);
	const [currentBid, setCurrentBid] = useState(10);
	const [highBidder, setHighBidder] = useState<string>("(start)");
	const [yourBid, setYourBid] = useState(20);
	const [results, setResults] = useState<{ won: boolean; price: number; trueValue: number; name: string }[]>([]);
	const [phase, setPhase] = useState<"bidding" | "won" | "lost" | "done">("bidding");
	const [auctionLog, setAuctionLog] = useState<string[]>([]);

	useEffect(() => {
		// reset bid at start of each round
		if (round < items.length) {
			setCurrentBid(10);
			setHighBidder("(start)");
			setYourBid(20);
			setAuctionLog([`Item: ${items[round].name} — ${items[round].hint}`]);
			setPhase("bidding");
		}
	}, [round, items]);

	function placeBid() {
		if (phase !== "bidding") return;
		if (yourBid <= currentBid) {
			setAuctionLog((l) => [...l, `You must bid more than ${currentBid}.`]);
			return;
		}
		const log = [...auctionLog, `You bid ${yourBid}.`];
		let topBid = yourBid;
		let topName = "You";
		const newBidders = bidders.map((b) => ({ ...b }));
		// each bidder reacts; some chain of reactions
		for (let pass = 0; pass < 3; pass++) {
			let actedThisPass = false;
			for (const b of newBidders) {
				const trueVal = items[round].trueValue;
				const max = trueVal * b.willPay;
				const nextBid = topBid + Math.max(5, Math.floor(topBid * 0.08));
				if (nextBid <= max && Math.random() < b.patience) {
					log.push(`${b.name} bids ${nextBid}.`);
					topBid = nextBid;
					topName = b.name;
					b.history.push(`bid ${nextBid} on ${items[round].name}`);
					actedThisPass = true;
				}
			}
			if (!actedThisPass) break;
		}
		setBidders(newBidders);
		setCurrentBid(topBid);
		setHighBidder(topName);
		setAuctionLog(log);
		setYourBid(topBid + 10);
	}

	function pass() {
		if (phase !== "bidding") return;
		const trueVal = items[round].trueValue;
		const log = [...auctionLog, `You pass. Hammer falls.`];
		const won = highBidder === "You";
		const newResults = [
			...results,
			{ won, price: won ? currentBid : 0, trueValue: trueVal, name: items[round].name },
		];
		setResults(newResults);
		setAuctionLog(log);
		setPhase(won ? "won" : "lost");
	}

	function nextRound() {
		if (round + 1 >= items.length) {
			setPhase("done");
			setRound(round + 1);
		} else {
			setRound(round + 1);
		}
	}

	let totalProfit = 0;
	for (const r of results) {
		if (r.won) totalProfit += r.trueValue - r.price;
	}

	return (
		<div style={{ background: "#1a1410", color: "#eee", padding: 16, fontFamily: "system-ui", minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>The Auctioneer</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Bid against three rivals. Win each item below its true value. Profile your rivals from prior rounds.
			</p>
			<div style={{ display: "flex", gap: 24 }}>
				<div style={{ flex: 1 }}>
					{phase !== "done" && round < items.length && (
						<>
							<h3>
								Item {round + 1}/3: {items[round].name}
							</h3>
							<div style={{ opacity: 0.6, marginBottom: 8 }}>{items[round].hint}</div>
							<div>
								Current bid: <b>{currentBid}</b> by <b>{highBidder}</b>
							</div>
							{phase === "bidding" && (
								<div style={{ marginTop: 12 }}>
									<input
										type="number"
										value={yourBid}
										onChange={(e) => setYourBid(parseInt(e.target.value) || 0)}
										style={{ width: 80 }}
									/>
									<button onClick={placeBid} style={{ marginLeft: 8 }}>
										Bid
									</button>
									<button onClick={pass} style={{ marginLeft: 8 }}>
										Pass / hammer
									</button>
								</div>
							)}
							{(phase === "won" || phase === "lost") && (
								<div style={{ marginTop: 12 }}>
									{phase === "won"
										? `Won! True value: ${items[round].trueValue}, profit: ${items[round].trueValue - currentBid}`
										: `Lost to ${highBidder}. True value: ${items[round].trueValue}`}
									<br />
									<button onClick={nextRound} style={{ marginTop: 8 }}>
										Next item
									</button>
								</div>
							)}
						</>
					)}
					{phase === "done" && (
						<div>
							<h3>Auction over</h3>
							{results.map((r, i) => (
								<div key={i}>
									{r.name}: {r.won ? `won at ${r.price}, value ${r.trueValue}, profit ${r.trueValue - r.price}` : "lost"}
								</div>
							))}
							<div style={{ fontSize: 22, marginTop: 12 }}>Total profit: {totalProfit}</div>
						</div>
					)}
					<div style={{ marginTop: 16, maxHeight: 200, overflowY: "auto", fontSize: 13, background: "#0a0805", padding: 8 }}>
						{auctionLog.map((l, i) => (
							<div key={i}>{l}</div>
						))}
					</div>
				</div>
				<div style={{ width: 280 }}>
					<h3>Rivals</h3>
					{bidders.map((b) => (
						<div key={b.name} style={{ marginBottom: 12, padding: 8, background: "#2a201a", borderLeft: `4px solid ${b.color}` }}>
							<div style={{ fontWeight: "bold" }}>{b.name}</div>
							<div style={{ fontSize: 11, maxHeight: 80, overflowY: "auto" }}>
								{b.history.length === 0 ? "(no history yet)" : b.history.slice(-6).map((h, i) => <div key={i}>{h}</div>)}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
