import { useEffect, useRef, useState } from "react";

type Params = {
	branchLength: number;
	branchAngle: number;
	subBranches: number;
	subAngle: number;
	subLength: number;
	thickness: number;
	tipShape: number;
	recursion: number;
	rotationSwirl: number;
};

const DEFAULTS: Params = {
	branchLength: 100,
	branchAngle: 0,
	subBranches: 3,
	subAngle: 50,
	subLength: 30,
	thickness: 2,
	tipShape: 0.3,
	recursion: 0,
	rotationSwirl: 0,
};

function mulberry32(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function dailySeed() {
	return Math.floor(Date.now() / 86400000);
}

// Use the daily seed to derive a starting Params point so each day has a different "seed" flake.
function startingParams(seed: number): Params {
	const rng = mulberry32(seed);
	return {
		branchLength: 50 + Math.round(rng() * 50),
		branchAngle: Math.round((rng() - 0.5) * 40),
		subBranches: Math.floor(rng() * 6),
		subAngle: Math.round(20 + rng() * 50),
		subLength: Math.round(10 + rng() * 30),
		thickness: 1 + rng() * 3,
		tipShape: rng(),
		recursion: Math.floor(rng() * 3),
		rotationSwirl: Math.round((rng() - 0.5) * 30),
	};
}

function drawFlake(ctx: CanvasRenderingContext2D, p: Params, size: number) {
	ctx.save();
	ctx.translate(size / 2, size / 2);
	ctx.strokeStyle = "#cbe7ff";
	ctx.lineWidth = p.thickness;
	ctx.lineCap = "round";
	for (let arm = 0; arm < 6; arm++) {
		ctx.save();
		ctx.rotate((arm * Math.PI * 2) / 6 + (p.rotationSwirl * Math.PI) / 180);
		drawBranch(ctx, p, 0, 0, 0, p.branchLength, 1);
		ctx.restore();
	}
	ctx.restore();
}

function drawBranch(
	ctx: CanvasRenderingContext2D,
	p: Params,
	x: number,
	y: number,
	rot: number,
	length: number,
	depth: number,
) {
	const ang = rot + (p.branchAngle * Math.PI) / 180;
	const endX = x + Math.sin(ang) * length;
	const endY = y - Math.cos(ang) * length;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(endX, endY);
	ctx.stroke();
	for (let s = 1; s <= p.subBranches; s++) {
		const t = s / (p.subBranches + 1);
		const bx = x + (endX - x) * t;
		const by = y + (endY - y) * t;
		for (const side of [-1, 1]) {
			const subRot = ang + (side * p.subAngle * Math.PI) / 180;
			const sx = bx + Math.sin(subRot) * p.subLength;
			const sy = by - Math.cos(subRot) * p.subLength;
			ctx.beginPath();
			ctx.moveTo(bx, by);
			ctx.lineTo(sx, sy);
			ctx.stroke();
			if (depth < p.recursion) {
				drawBranch(ctx, p, sx, sy, subRot, p.subLength * 0.6, depth + 1);
			}
		}
	}
	ctx.beginPath();
	ctx.arc(endX, endY, 2 + p.tipShape * 6, 0, Math.PI * 2);
	ctx.stroke();
}

let audioCtx: AudioContext | null = null;
function chime() {
	if (typeof window === "undefined") return;
	if (!audioCtx) {
		try {
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
		} catch {
			return;
		}
	}
	const ctx = audioCtx;
	for (const [freq, t0] of [
		[880, 0],
		[1108, 0.07],
		[1318, 0.15],
	] as [number, number][]) {
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = "sine";
		osc.frequency.value = freq;
		g.gain.value = 0.06;
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + 0.5);
		osc.connect(g).connect(ctx.destination);
		osc.start(ctx.currentTime + t0);
		osc.stop(ctx.currentTime + t0 + 0.5);
	}
}

type GalleryFlake = {
	id: number;
	params: Params;
	author: string | null;
	daily_seed: number | null;
	novelty: number;
	created_at: number;
};

const STORAGE_AUTHOR = "snowflake_author";

export default function Game020_SnowflakeLab() {
	const W = 500;
	const [todaySeed] = useState(dailySeed);
	const [params, setParams] = useState<Params>(() => ({ ...DEFAULTS, ...startingParams(dailySeed()) }));
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [author, setAuthor] = useState("");
	const [novelty, setNovelty] = useState<number | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [view, setView] = useState<"lab" | "daily" | "gallery">("lab");
	const [galleryDaily, setGalleryDaily] = useState<GalleryFlake[]>([]);
	const [galleryAll, setGalleryAll] = useState<GalleryFlake[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		try {
			const a = localStorage.getItem(STORAGE_AUTHOR);
			if (a) setAuthor(a);
		} catch {}
	}, []);

	useEffect(() => {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = "#0a1a2e";
		ctx.fillRect(0, 0, W, W);
		drawFlake(ctx, params, W);
	}, [params]);

	useEffect(() => {
		if (view === "daily") fetchDaily();
		else if (view === "gallery") fetchAll();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [view]);

	async function fetchDaily() {
		setLoading(true);
		setError(null);
		try {
			const r = await fetch(`/api/snowflake-lab/gallery?daily=${todaySeed}`);
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			const d = await r.json();
			setGalleryDaily(d.flakes ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}

	async function fetchAll() {
		setLoading(true);
		setError(null);
		try {
			const r = await fetch("/api/snowflake-lab/gallery");
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			const d = await r.json();
			setGalleryAll(d.flakes ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}

	async function submit() {
		setSubmitting(true);
		setError(null);
		try {
			const r = await fetch("/api/snowflake-lab/gallery", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					params,
					author: author || null,
					daily_seed: todaySeed,
				}),
			});
			if (!r.ok) {
				const d = await r.json().catch(() => ({}));
				throw new Error((d as { error?: string }).error ?? `HTTP ${r.status}`);
			}
			const data = await r.json();
			setNovelty(data.novelty);
			if (author) localStorage.setItem(STORAGE_AUTHOR, author);
			chime();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Submit failed");
			setNovelty(null);
		} finally {
			setSubmitting(false);
		}
	}

	function set<K extends keyof Params>(k: K, v: number) {
		setParams({ ...params, [k]: v });
		setNovelty(null);
	}

	function randomize() {
		setParams({ ...DEFAULTS, ...startingParams(Math.floor(Math.random() * 1e9)) });
		setNovelty(null);
	}

	function resetToDaily() {
		setParams({ ...DEFAULTS, ...startingParams(todaySeed) });
		setNovelty(null);
	}

	const sliders: { key: keyof Params; min: number; max: number; step: number; label: string }[] = [
		{ key: "branchLength", min: 40, max: 100, step: 1, label: "Branch length" },
		{ key: "branchAngle", min: -30, max: 30, step: 1, label: "Branch lean" },
		{ key: "subBranches", min: 0, max: 5, step: 1, label: "Sub-branch count" },
		{ key: "subAngle", min: 10, max: 80, step: 1, label: "Sub-branch angle" },
		{ key: "subLength", min: 5, max: 45, step: 1, label: "Sub-branch length" },
		{ key: "thickness", min: 1, max: 5, step: 0.2, label: "Line thickness" },
		{ key: "tipShape", min: 0, max: 1, step: 0.05, label: "Tip size" },
		{ key: "recursion", min: 0, max: 3, step: 1, label: "Recursion depth" },
		{ key: "rotationSwirl", min: -30, max: 30, step: 1, label: "Swirl" },
	];

	function renderGalleryCard(f: GalleryFlake) {
		return (
			<MiniFlake key={f.id} flake={f} />
		);
	}

	return (
		<div style={{ background: "#04081a", color: "#eee", padding: 16, fontFamily: "system-ui" }}>
			<h2 style={{ margin: 0 }}>Snowflake Lab</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Tweak growth parameters. Score = how different your flake is from every other one ever submitted.
			</p>
			<div style={{ marginBottom: 8 }}>
				<button onClick={() => setView("lab")}>Lab</button>
				<button onClick={() => setView("daily")} style={{ marginLeft: 8 }}>
					Today's gallery
				</button>
				<button onClick={() => setView("gallery")} style={{ marginLeft: 8 }}>
					All-time gallery
				</button>
				<span style={{ marginLeft: 16, fontSize: 12, opacity: 0.6 }}>Daily seed #{todaySeed}</span>
				{error && <span style={{ color: "#ff6b6b", marginLeft: 12 }}>{error}</span>}
				{loading && <span style={{ marginLeft: 12, opacity: 0.6 }}>loading…</span>}
			</div>
			{view === "lab" && (
				<div style={{ display: "flex", gap: 16 }}>
					<canvas
						ref={canvasRef}
						width={W}
						height={W}
						style={{ background: "#0a1a2e", border: "1px solid #223" }}
					/>
					<div style={{ flex: 1 }}>
						{sliders.map((s) => (
							<div key={s.key} style={{ marginBottom: 8 }}>
								<label>
									{s.label}: {params[s.key].toFixed(2)}
								</label>
								<input
									type="range"
									min={s.min}
									max={s.max}
									step={s.step}
									value={params[s.key]}
									onChange={(e) => set(s.key, parseFloat(e.target.value))}
									style={{ width: "100%" }}
								/>
							</div>
						))}
						<div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
							<input
								value={author}
								onChange={(e) =>
									setAuthor(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
								}
								placeholder="Your name (optional)"
								style={{ padding: 6, width: 160 }}
							/>
							<button onClick={submit} disabled={submitting} style={{ padding: "6px 14px", fontSize: 16 }}>
								Crystallize
							</button>
							<button onClick={randomize}>Random</button>
							<button onClick={resetToDaily}>Daily start</button>
						</div>
						{novelty !== null && (
							<div style={{ marginTop: 12, fontSize: 20 }}>
								Novelty: <b>{novelty}/100</b>
							</div>
						)}
					</div>
				</div>
			)}
			{view === "daily" && (
				<div>
					<div style={{ marginBottom: 8, opacity: 0.7 }}>
						Top novelty flakes submitted for today's seed.
					</div>
					{galleryDaily.length === 0 && !loading && <div>No flakes submitted for today yet.</div>}
					<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
						{galleryDaily.map(renderGalleryCard)}
					</div>
				</div>
			)}
			{view === "gallery" && (
				<div>
					<div style={{ marginBottom: 8, opacity: 0.7 }}>Most recent flakes from everyone.</div>
					{galleryAll.length === 0 && !loading && <div>No flakes yet.</div>}
					<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
						{galleryAll.map(renderGalleryCard)}
					</div>
				</div>
			)}
		</div>
	);
}

function MiniFlake({ flake }: { flake: GalleryFlake }) {
	const ref = useRef<HTMLCanvasElement | null>(null);
	const size = 140;
	useEffect(() => {
		const c = ref.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = "#0a1a2e";
		ctx.fillRect(0, 0, size, size);
		// scale params for the mini canvas
		const p = {
			...flake.params,
			branchLength: flake.params.branchLength * 0.45,
			subLength: flake.params.subLength * 0.45,
			thickness: Math.max(0.5, flake.params.thickness * 0.6),
		};
		drawFlake(ctx, p, size);
	}, [flake]);
	return (
		<div style={{ background: "#0a1a2e", padding: 6, border: "1px solid #223" }}>
			<canvas ref={ref} width={size} height={size} />
			<div style={{ fontSize: 11, opacity: 0.8 }}>
				by {flake.author ?? "anon"} · novelty {flake.novelty}
			</div>
		</div>
	);
}
