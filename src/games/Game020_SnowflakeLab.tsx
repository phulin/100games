import { useEffect, useRef, useState } from "react";

type Params = {
	branchLength: number;
	branchAngle: number;
	subBranches: number;
	subAngle: number;
	subLength: number;
	thickness: number;
	tipShape: number; // 0..1
};

const DEFAULTS: Params = {
	branchLength: 100,
	branchAngle: 0,
	subBranches: 3,
	subAngle: 50,
	subLength: 30,
	thickness: 2,
	tipShape: 0.3,
};

function paramsToVec(p: Params): number[] {
	return [
		p.branchLength / 100,
		p.branchAngle / 60,
		p.subBranches / 5,
		p.subAngle / 90,
		p.subLength / 50,
		p.thickness / 5,
		p.tipShape,
	];
}

function similarity(a: number[], b: number[]): number {
	let d = 0;
	for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
	return Math.sqrt(d);
}

function drawFlake(ctx: CanvasRenderingContext2D, p: Params, size: number) {
	ctx.save();
	ctx.translate(size / 2, size / 2);
	ctx.strokeStyle = "#cbe7ff";
	ctx.lineWidth = p.thickness;
	ctx.lineCap = "round";
	for (let arm = 0; arm < 6; arm++) {
		ctx.save();
		ctx.rotate((arm * Math.PI * 2) / 6);
		// main branch
		const endX = p.branchLength * Math.cos((p.branchAngle * Math.PI) / 180);
		const endY = -p.branchLength;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(endX, endY);
		ctx.stroke();
		// sub-branches along main
		for (let s = 1; s <= p.subBranches; s++) {
			const t = s / (p.subBranches + 1);
			const bx = endX * t;
			const by = endY * t;
			for (const side of [-1, 1]) {
				const ang = (side * p.subAngle * Math.PI) / 180;
				const sx = bx + Math.sin(ang) * p.subLength;
				const sy = by - Math.cos(ang) * p.subLength;
				ctx.beginPath();
				ctx.moveTo(bx, by);
				ctx.lineTo(sx, sy);
				ctx.stroke();
			}
		}
		// tip
		ctx.beginPath();
		ctx.arc(endX, endY, 2 + p.tipShape * 6, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}
	ctx.restore();
}

export default function Game020_SnowflakeLab() {
	const W = 500;
	const [params, setParams] = useState<Params>(DEFAULTS);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [archive, setArchive] = useState<{ params: Params; novelty: number }[]>([]);
	const [novelty, setNovelty] = useState<number | null>(null);

	useEffect(() => {
		try {
			const data = localStorage.getItem("snowflakes");
			if (data) setArchive(JSON.parse(data));
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

	function submit() {
		const vec = paramsToVec(params);
		let minSim = Infinity;
		for (const a of archive) {
			const d = similarity(vec, paramsToVec(a.params));
			if (d < minSim) minSim = d;
		}
		const nov = archive.length === 0 ? 100 : Math.min(100, Math.round(minSim * 60));
		setNovelty(nov);
		const next = [...archive, { params, novelty: nov }].slice(-30);
		setArchive(next);
		localStorage.setItem("snowflakes", JSON.stringify(next));
	}

	function set<K extends keyof Params>(k: K, v: number) {
		setParams({ ...params, [k]: v });
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
	];

	return (
		<div style={{ background: "#04081a", color: "#eee", padding: 16, fontFamily: "system-ui" }}>
			<h2 style={{ margin: 0 }}>Snowflake Lab</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Tweak growth parameters. Submit your flake — score higher by being different from past designs.
			</p>
			<div style={{ display: "flex", gap: 16 }}>
				<canvas ref={canvasRef} width={W} height={W} style={{ background: "#0a1a2e", border: "1px solid #223" }} />
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
					<button onClick={submit} style={{ padding: "6px 14px", fontSize: 16 }}>
						Crystallize
					</button>
					{novelty !== null && (
						<div style={{ marginTop: 12, fontSize: 20 }}>
							Novelty: <b>{novelty}/100</b>
						</div>
					)}
					<div style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
						Archive: {archive.length} flakes
					</div>
				</div>
			</div>
		</div>
	);
}
