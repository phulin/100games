import { useCallback, useEffect, useRef, useState } from "react";

// Daily-seeded sun descent. Press space when sun fully below horizon.
function todayUTC(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
function seedFromDate(): number {
	const d = new Date();
	return (
		d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
	);
}
function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const W = 720,
	H = 460;
const DURATION = 12000;

function getOrCreateAuthor(): string {
	try {
		const k = "sundown_author_id";
		let v = localStorage.getItem(k);
		if (!v) {
			v =
				"anon_" +
				Math.random().toString(36).slice(2, 10) +
				Date.now().toString(36);
			localStorage.setItem(k, v);
		}
		return v;
	} catch {
		return "anon_" + Math.random().toString(36).slice(2, 10);
	}
}

type LbEntry = {
	rank: number;
	handle: string;
	offset_ms: number;
	abs_offset_ms: number;
	created_at: number;
};
type Histogram = {
	bucket_width_ms: number;
	centers_ms: number[];
	counts: number[];
	total: number;
};
type AuthorInfo = {
	rank: number | null;
	percentile: number | null;
	best_abs_offset_ms: number | null;
	current_streak: number;
	longest_streak: number;
	total_plays: number;
};

const LS_BEST_KEY = "sundown_local_best";

function playTone(
	ref: React.MutableRefObject<AudioContext | null>,
	freq: number,
	dur = 0.18,
	type: OscillatorType = "sine",
	gainV = 0.15,
) {
	try {
		if (!ref.current) ref.current = new AudioContext();
		const ctx = ref.current;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.value = 0.0001;
		g.gain.linearRampToValueAtTime(gainV, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	} catch {
		/* ignore */
	}
}

export default function Game100_Sundown() {
	const day = todayUTC();
	const seed = seedFromDate();
	const rng = useRef(mulberry32(seed));
	const startedAt = useRef<number | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const audio = useRef<AudioContext | null>(null);
	const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
	const [result, setResult] = useState<{
		offset_ms: number;
		errPx: number;
		score: number;
	} | null>(null);
	const elapsedRef = useRef(0);
	const [handle, setHandle] = useState<string>(() => {
		try {
			return localStorage.getItem("sundown_handle") || "";
		} catch {
			return "";
		}
	});
	const author = useRef<string>(getOrCreateAuthor());
	const [leaderboard, setLeaderboard] = useState<LbEntry[]>([]);
	const [histogram, setHistogram] = useState<Histogram | null>(null);
	const [authorInfo, setAuthorInfo] = useState<AuthorInfo | null>(null);
	const [submitState, setSubmitState] = useState<
		"idle" | "submitting" | "ok" | "err"
	>("idle");
	const [shareCopied, setShareCopied] = useState(false);
	const [localBest, setLocalBest] = useState<{
		day: string;
		offset_ms: number;
		abs_offset_ms: number;
	} | null>(() => {
		try {
			const raw = localStorage.getItem(LS_BEST_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (parsed?.day === todayUTC()) return parsed;
			return null;
		} catch {
			return null;
		}
	});

	const landscape = useRef<{ horizon: number; hills: number[] }>({
		horizon: 0,
		hills: [],
	});

	const draw = useCallback((ms: number) => {
		const cnv = canvasRef.current;
		if (!cnv) return;
		const ctx = cnv.getContext("2d");
		if (!ctx) return;
		const t = Math.min(1.2, ms / DURATION);
		const grad = ctx.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, lerpColor([20, 30, 70], [60, 30, 40], t));
		grad.addColorStop(1, lerpColor([240, 160, 80], [120, 60, 80], t));
		ctx.fillStyle = grad as unknown as string;
		ctx.fillRect(0, 0, W, H);

		// stars after dusk
		if (t > 0.7) {
			const a = Math.min(1, (t - 0.7) / 0.3);
			ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
			const sr = mulberry32(424242);
			for (let i = 0; i < 60; i++) {
				const sx = sr() * W;
				const sy = sr() * (landscape.current.horizon - 20);
				const r = sr() * 1.2 + 0.3;
				ctx.beginPath();
				ctx.arc(sx, sy, r, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		const sunRadius = 40;
		const startY = 80;
		const endY = landscape.current.horizon + 80;
		const sunY = startY + t * (endY - startY);
		const sunX = W * 0.5;
		// glow
		const glow = ctx.createRadialGradient(
			sunX,
			sunY,
			sunRadius * 0.6,
			sunX,
			sunY,
			sunRadius * 2.2,
		);
		glow.addColorStop(0, "rgba(255,210,120,0.55)");
		glow.addColorStop(1, "rgba(255,210,120,0)");
		ctx.fillStyle = glow as unknown as string;
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunRadius * 2.2, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#fff2c0";
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#ffd56a";
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunRadius * 0.85, 0, Math.PI * 2);
		ctx.fill();

		ctx.fillStyle = "#0a0612";
		ctx.beginPath();
		ctx.moveTo(0, H);
		const step = W / (landscape.current.hills.length - 1);
		landscape.current.hills.forEach((y, i) => ctx.lineTo(i * step, y));
		ctx.lineTo(W, H);
		ctx.closePath();
		ctx.fill();
	}, []);

	useEffect(() => {
		const r = rng.current;
		const horizon = H * (0.55 + r() * 0.1);
		const hills: number[] = [];
		for (let i = 0; i <= 40; i++) {
			hills.push(horizon - (r() * 18 + Math.sin(i * 0.5 + r() * 6) * 10));
		}
		landscape.current = { horizon, hills };
		draw(0);
	}, [draw]);

	// soft ambient cue: low hum during running, pitch nudge as sun approaches.
	const lastCueRef = useRef(0);
	useEffect(() => {
		let raf = 0;
		function tick(now: number) {
			if (phase !== "running") return;
			if (startedAt.current == null) startedAt.current = now;
			elapsedRef.current = now - startedAt.current;
			draw(elapsedRef.current);
			// audio cue every ~600ms
			if (now - lastCueRef.current > 600) {
				lastCueRef.current = now;
				const t = elapsedRef.current / DURATION;
				playTone(audio, 180 + t * 80, 0.18, "sine", 0.04);
			}
			if (elapsedRef.current < DURATION + 2000)
				raf = requestAnimationFrame(tick);
			else if (phase === "running") {
				setPhase("done");
				setResult({ offset_ms: 9999, errPx: 9999, score: 0 });
			}
		}
		if (phase === "running") raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [phase, draw]);

	const targetMs = useCallback(() => {
		const sunRadius = 40;
		const startY = 80;
		const endY = landscape.current.horizon + 80;
		const targetT =
			(landscape.current.horizon + sunRadius - startY) / (endY - startY);
		return targetT * DURATION;
	}, []);

	const fetchLeaderboard = useCallback(async () => {
		try {
			const res = await fetch(
				`/api/sundown/scores?day=${encodeURIComponent(day)}&author=${encodeURIComponent(author.current)}`,
			);
			if (!res.ok) return;
			const data = (await res.json()) as {
				leaderboard: LbEntry[];
				histogram: Histogram;
				author: AuthorInfo | null;
			};
			setLeaderboard(data.leaderboard || []);
			setHistogram(data.histogram || null);
			setAuthorInfo(data.author || null);
		} catch {
			/* network fail */
		}
	}, [day]);

	useEffect(() => {
		fetchLeaderboard();
	}, [fetchLeaderboard]);

	const start = useCallback(() => {
		setPhase("running");
		startedAt.current = null;
		setResult(null);
		setSubmitState("idle");
		setShareCopied(false);
		playTone(audio, 320, 0.12, "triangle", 0.1);
	}, []);

	const submitScore = useCallback(
		async (offset_ms: number) => {
			setSubmitState("submitting");
			try {
				const res = await fetch("/api/sundown/scores", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						day,
						offset_ms,
						author: author.current,
						handle: handle || "anon",
					}),
				});
				if (!res.ok) {
					setSubmitState("err");
					return;
				}
				setSubmitState("ok");
				fetchLeaderboard();
			} catch {
				setSubmitState("err");
			}
		},
		[day, handle, fetchLeaderboard],
	);

	const tap = useCallback(() => {
		if (phase !== "running") return;
		const tMs = elapsedRef.current;
		const tgt = targetMs();
		const offset_ms = Math.round(tMs - tgt);
		const startY = 80;
		const endY = landscape.current.horizon + 80;
		const errFrac = Math.abs(offset_ms) / DURATION;
		const errPx = errFrac * (endY - startY);
		const score = Math.max(0, Math.round(1000 - Math.abs(offset_ms) / 2));
		setResult({ offset_ms, errPx, score });
		setPhase("done");

		const a = Math.abs(offset_ms);
		if (a < 50) playTone(audio, 1320, 0.4, "sine", 0.18);
		else if (a < 200) playTone(audio, 880, 0.3, "triangle", 0.14);
		else playTone(audio, 220, 0.25, "sawtooth", 0.08);

		try {
			const absv = Math.abs(offset_ms);
			const cur = localBest;
			if (!cur || absv < cur.abs_offset_ms) {
				const nb = { day, offset_ms, abs_offset_ms: absv };
				localStorage.setItem(LS_BEST_KEY, JSON.stringify(nb));
				setLocalBest(nb);
			}
		} catch {
			/* ignore */
		}

		if (Math.abs(offset_ms) < 60000) {
			void submitScore(offset_ms);
		}
	}, [phase, targetMs, day, localBest, submitScore]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.code !== "Space") return;
			const tag = (e.target as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			e.preventDefault();
			if (phase === "idle") start();
			else if (phase === "running") tap();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [phase, start, tap]);

	function onHandleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const v = e.target.value.slice(0, 20);
		setHandle(v);
		try {
			localStorage.setItem("sundown_handle", v);
		} catch {
			/* ignore */
		}
	}

	function buildShare(): string {
		if (!result) return "";
		const sign =
			result.offset_ms === 0 ? "" : result.offset_ms > 0 ? "+" : "−";
		const abs = Math.abs(result.offset_ms);
		const pctTxt =
			authorInfo?.percentile != null ? ` • top ${100 - authorInfo.percentile + 1}%` : "";
		const streakTxt =
			authorInfo && authorInfo.current_streak > 1
				? ` • ${authorInfo.current_streak}-day streak`
				: "";
		return `Sundown ${day} — ${sign}${abs}ms${pctTxt}${streakTxt}`;
	}

	async function copyShare() {
		try {
			await navigator.clipboard.writeText(buildShare());
			setShareCopied(true);
			setTimeout(() => setShareCopied(false), 1500);
		} catch {
			/* ignore */
		}
	}

	const maxBucket = Math.max(1, ...(histogram?.counts ?? [1]));

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "Georgia, serif",
				background: "#0a0612",
				color: "#f4e9d8",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Sundown</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Watch carefully. Press SPACE the moment the sun is fully below the
				horizon. Daily seed: {seed} ({day} UTC).
			</p>
			<canvas
				ref={canvasRef}
				width={W}
				height={H}
				style={{ background: "#000", borderRadius: 6, display: "block" }}
				onClick={() => {
					if (phase === "idle") start();
					else if (phase === "running") tap();
				}}
			/>

			<div style={{ marginTop: 12, minHeight: 40 }}>
				{phase === "idle" && (
					<>
						<button onClick={start}>Begin (or press space)</button>
						<label style={{ marginLeft: 12, fontSize: 13, opacity: 0.85 }}>
							Handle:{" "}
							<input
								type="text"
								value={handle}
								onChange={onHandleChange}
								placeholder="anon"
								maxLength={20}
								style={{
									background: "#1a1320",
									color: "#f4e9d8",
									border: "1px solid #443",
									borderRadius: 4,
									padding: "2px 6px",
									width: 140,
								}}
							/>
						</label>
					</>
				)}
				{phase === "running" && <button onClick={tap}>Now! (space)</button>}
				{phase === "done" && result && (
					<>
						<strong>
							{Math.abs(result.offset_ms) >= 9999
								? "Missed entirely."
								: `${result.offset_ms === 0 ? "Perfect!" : `${result.offset_ms > 0 ? "Late" : "Early"} by ${Math.abs(result.offset_ms)} ms`}`}
						</strong>{" "}
						Score: <strong>{result.score}</strong>
						{submitState === "submitting" && (
							<span style={{ marginLeft: 8, opacity: 0.7 }}>submitting…</span>
						)}
						{submitState === "ok" && (
							<span style={{ marginLeft: 8, color: "#8fd" }}>submitted</span>
						)}
						{submitState === "err" && (
							<span style={{ marginLeft: 8, color: "#f88" }}>
								offline — kept locally
							</span>
						)}
						<button
							onClick={() => {
								setPhase("idle");
								setResult(null);
							}}
							style={{ marginLeft: 12 }}
						>
							Try again
						</button>
						{Math.abs(result.offset_ms) < 60000 && (
							<button onClick={copyShare} style={{ marginLeft: 8 }}>
								{shareCopied ? "Copied!" : "Copy share"}
							</button>
						)}
					</>
				)}
			</div>

			{authorInfo && (
				<div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
					{authorInfo.current_streak > 0 && (
						<>
							Streak: <strong>{authorInfo.current_streak}</strong> day
							{authorInfo.current_streak === 1 ? "" : "s"} (longest{" "}
							{authorInfo.longest_streak}) •{" "}
						</>
					)}
					Plays: {authorInfo.total_plays}
					{authorInfo.best_abs_offset_ms != null && (
						<>
							{" "}
							• Lifetime best |{authorInfo.best_abs_offset_ms}|ms
						</>
					)}
					{authorInfo.percentile != null && (
						<> • Today percentile: {authorInfo.percentile}%</>
					)}
				</div>
			)}

			{localBest && (
				<div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
					Your best today (local): {localBest.offset_ms >= 0 ? "+" : ""}
					{localBest.offset_ms} ms (|{localBest.abs_offset_ms}| ms)
				</div>
			)}

			<div
				style={{
					marginTop: 20,
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 20,
				}}
			>
				<div>
					<h3 style={{ margin: "0 0 6px", fontSize: 16 }}>
						Daily leaderboard
					</h3>
					{leaderboard.length === 0 ? (
						<div style={{ fontSize: 13, opacity: 0.6 }}>
							No scores yet today. Be first.
						</div>
					) : (
						<table style={{ fontSize: 13, borderCollapse: "collapse" }}>
							<thead>
								<tr style={{ opacity: 0.7 }}>
									<th style={{ textAlign: "left", paddingRight: 12 }}>#</th>
									<th style={{ textAlign: "left", paddingRight: 12 }}>
										handle
									</th>
									<th style={{ textAlign: "right", paddingRight: 12 }}>
										offset
									</th>
									<th style={{ textAlign: "right" }}>|err|</th>
								</tr>
							</thead>
							<tbody>
								{leaderboard.map((e) => (
									<tr key={`${e.rank}-${e.created_at}`}>
										<td style={{ paddingRight: 12 }}>{e.rank}</td>
										<td style={{ paddingRight: 12 }}>{e.handle}</td>
										<td
											style={{
												paddingRight: 12,
												textAlign: "right",
												fontFamily: "monospace",
											}}
										>
											{e.offset_ms >= 0 ? "+" : ""}
											{e.offset_ms} ms
										</td>
										<td
											style={{
												textAlign: "right",
												fontFamily: "monospace",
											}}
										>
											{e.abs_offset_ms} ms
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>

				<div>
					<h3 style={{ margin: "0 0 6px", fontSize: 16 }}>
						Timing histogram ({histogram?.total ?? 0} scores)
					</h3>
					{histogram ? (
						<div style={{ fontFamily: "monospace", fontSize: 12 }}>
							{histogram.counts.map((c, i) => {
								const center = histogram.centers_ms[i];
								const isEdge = i === 0 || i === histogram.counts.length - 1;
								const label = isEdge
									? i === 0
										? `≤${center + histogram.bucket_width_ms / 2}`
										: `≥${center - histogram.bucket_width_ms / 2}`
									: `${center >= 0 ? "+" : ""}${center}`;
								const width = Math.round((c / maxBucket) * 120);
								const youHere =
									result &&
									Math.abs(result.offset_ms) < 60000 &&
									Math.round(result.offset_ms / 100) + 5 === i;
								return (
									<div
										key={i}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 6,
											lineHeight: "16px",
										}}
									>
										<span
											style={{
												width: 52,
												textAlign: "right",
												opacity: 0.7,
											}}
										>
											{label}
										</span>
										<span
											style={{
												display: "inline-block",
												height: 10,
												width: Math.max(c > 0 ? 4 : 0, width),
												background:
													center === 0
														? "#ffd56a"
														: center < 0
															? "#7aa6e6"
															: "#e67a7a",
												borderRadius: 2,
												outline: youHere ? "2px solid #fff" : "none",
											}}
										/>
										<span style={{ opacity: 0.8 }}>{c}</span>
										{youHere && (
											<span style={{ marginLeft: 4, color: "#fff" }}>
												← you
											</span>
										)}
									</div>
								);
							})}
							<div style={{ marginTop: 4, opacity: 0.55, fontSize: 11 }}>
								Negative = early • Positive = late • Center = perfect
							</div>
						</div>
					) : (
						<div style={{ fontSize: 13, opacity: 0.6 }}>Loading…</div>
					)}
				</div>
			</div>
		</div>
	);
}

function lerpColor(a: number[], b: number[], t: number): string {
	const tt = Math.max(0, Math.min(1, t));
	const r = Math.round(a[0] + (b[0] - a[0]) * tt);
	const g = Math.round(a[1] + (b[1] - a[1]) * tt);
	const bl = Math.round(a[2] + (b[2] - a[2]) * tt);
	return `rgb(${r},${g},${bl})`;
}
