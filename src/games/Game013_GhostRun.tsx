import { useEffect, useRef, useState } from "react";

type Frame = { x: number; y: number };

const LEVEL_SEED = "v1:default";
const API_URL = "/api/ghost-run/runs";

function getAnonId(): string {
	try {
		let id = localStorage.getItem("ghostrun_anon_id");
		if (!id) {
			const rand =
				typeof crypto !== "undefined" && crypto.randomUUID
					? crypto.randomUUID()
					: Math.random().toString(36).slice(2) + Date.now().toString(36);
			id = `anon_${rand}`;
			localStorage.setItem("ghostrun_anon_id", id);
		}
		return id;
	} catch {
		return "anon";
	}
}

const W = 900;
const H = 500;
const GROUND = H - 60;
const PLATFORMS: { x: number; y: number; w: number }[] = [
	{ x: 180, y: GROUND - 80, w: 90 },
	{ x: 340, y: GROUND - 140, w: 90 },
	{ x: 500, y: GROUND - 100, w: 120 },
	{ x: 700, y: GROUND - 180, w: 80 },
];
const GOAL_X = 840;

export default function Game013_GhostRun() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const keys = useRef({ left: false, right: false, jump: false });
	const stateRef = useRef({
		px: 30,
		py: GROUND - 30,
		vx: 0,
		vy: 0,
		onGround: false,
		frame: 0,
		recording: [] as Frame[],
		ghost: [] as Frame[],
		ghostOffset: 0, // ghost starts 1 second earlier => ghost frame = (frame + 60)
		finished: false,
		startTime: 0,
		finishFrame: 0,
		ghostFinishFrame: Infinity,
		best: Infinity,
	});
	const [, force] = useState(0);

	useEffect(() => {
		// Always load local best first as a baseline / fallback.
		const stored = localStorage.getItem("ghostrun_best");
		if (stored) {
			try {
				const data = JSON.parse(stored);
				stateRef.current.ghost = data.frames || [];
				stateRef.current.ghostFinishFrame = data.frames?.length || Infinity;
				stateRef.current.best = data.frames?.length || Infinity;
			} catch {}
		}
		// Then try to fetch the global best ghost from the server.
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`${API_URL}?level=${encodeURIComponent(LEVEL_SEED)}`);
				if (!res.ok) return;
				const data = await res.json();
				const run = data?.run;
				if (cancelled || !run || !Array.isArray(run.frames) || run.frames.length === 0) return;
				const globalFrames: Frame[] = run.frames;
				// Use the global best as the ghost. It's the canonical "best ghost on this level".
				stateRef.current.ghost = globalFrames;
				stateRef.current.ghostFinishFrame = globalFrames.length;
				// Track the local best separately; only beating it triggers an upload.
				if (globalFrames.length < stateRef.current.best) {
					// Don't overwrite the player's personal best — just race the global ghost.
				}
			} catch {
				// Network failure — keep localStorage fallback already loaded above.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const dn = (e: KeyboardEvent) => {
			if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = true;
			if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = true;
			if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") keys.current.jump = true;
			if (e.code === "KeyR") restart();
		};
		const up = (e: KeyboardEvent) => {
			if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = false;
			if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = false;
			if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") keys.current.jump = false;
		};
		window.addEventListener("keydown", dn);
		window.addEventListener("keyup", up);
		return () => {
			window.removeEventListener("keydown", dn);
			window.removeEventListener("keyup", up);
		};
	}, []);

	function restart() {
		const s = stateRef.current;
		s.px = 30;
		s.py = GROUND - 30;
		s.vx = 0;
		s.vy = 0;
		s.frame = 0;
		s.recording = [];
		s.finished = false;
		s.finishFrame = 0;
	}

	useEffect(() => {
		let raf = 0;
		const tick = () => {
			const s = stateRef.current;
			if (!s.finished) {
				const accel = 0.6;
				if (keys.current.left) s.vx -= accel;
				if (keys.current.right) s.vx += accel;
				s.vx *= 0.85;
				if (Math.abs(s.vx) < 0.05) s.vx = 0;
				if (keys.current.jump && s.onGround) {
					s.vy = -11;
					s.onGround = false;
				}
				s.vy += 0.55;
				s.px += s.vx;
				s.py += s.vy;
				// collisions with ground
				s.onGround = false;
				if (s.py + 15 >= GROUND) {
					s.py = GROUND - 15;
					s.vy = 0;
					s.onGround = true;
				}
				// platforms (only from above)
				for (const p of PLATFORMS) {
					if (
						s.px + 12 > p.x &&
						s.px - 12 < p.x + p.w &&
						s.py + 15 >= p.y &&
						s.py + 15 - s.vy <= p.y + 1 &&
						s.vy >= 0
					) {
						s.py = p.y - 15;
						s.vy = 0;
						s.onGround = true;
					}
				}
				if (s.px < 12) s.px = 12;
				s.recording.push({ x: s.px, y: s.py });
				s.frame++;
				if (s.px >= GOAL_X) {
					s.finished = true;
					s.finishFrame = s.frame;
					if (s.frame < s.best) {
						s.best = s.frame;
						const framesSnapshot = s.recording.slice();
						localStorage.setItem("ghostrun_best", JSON.stringify({ frames: framesSnapshot }));
						s.ghost = framesSnapshot;
						s.ghostFinishFrame = framesSnapshot.length;
						// Submit personal best to server. Fire-and-forget; ignore failures.
						(async () => {
							try {
								await fetch(API_URL, {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify({
										level: LEVEL_SEED,
										finish_ms: s.finishFrame,
										frames: framesSnapshot,
										author: getAnonId(),
									}),
								});
							} catch {
								// offline / unavailable — localStorage still has the run
							}
						})();
					}
				}
			}
			draw();
			force((n) => (n + 1) % 1e9);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	function draw() {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		const s = stateRef.current;
		ctx.fillStyle = "#1c2540";
		ctx.fillRect(0, 0, W, H);
		ctx.fillStyle = "#2d3a60";
		ctx.fillRect(0, GROUND, W, H - GROUND);
		for (const p of PLATFORMS) {
			ctx.fillStyle = "#4a5a85";
			ctx.fillRect(p.x, p.y, p.w, 14);
		}
		// goal
		ctx.fillStyle = "#ffd166";
		ctx.fillRect(GOAL_X, GROUND - 60, 10, 60);
		// ghost
		const ghostFrame = s.frame + 60; // ghost started 1s (60 frames) earlier
		if (s.ghost.length > 0 && ghostFrame < s.ghost.length) {
			const g = s.ghost[ghostFrame];
			ctx.fillStyle = "rgba(180, 200, 255, 0.45)";
			ctx.beginPath();
			ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
			ctx.fill();
		}
		// player
		ctx.fillStyle = "#ff6b6b";
		ctx.beginPath();
		ctx.arc(s.px, s.py, 13, 0, Math.PI * 2);
		ctx.fill();
		// UI
		ctx.fillStyle = "#fff";
		ctx.font = "16px system-ui";
		ctx.fillText(`Time: ${(s.frame / 60).toFixed(2)}s`, 12, 24);
		if (s.best !== Infinity) ctx.fillText(`Best: ${(s.best / 60).toFixed(2)}s`, 12, 44);
		else ctx.fillText("No ghost yet — run once to record", 12, 44);
		if (s.finished) {
			ctx.fillStyle = "rgba(0,0,0,0.6)";
			ctx.fillRect(0, 0, W, H);
			ctx.fillStyle = "#fff";
			ctx.font = "32px system-ui";
			ctx.fillText(`Finished in ${(s.finishFrame / 60).toFixed(2)}s`, 280, H / 2);
			ctx.font = "16px system-ui";
			ctx.fillText("Press R to run again", 380, H / 2 + 30);
		}
	}

	return (
		<div style={{ background: "#0b0b1a", color: "#eee", padding: 16, fontFamily: "system-ui" }}>
			<h2 style={{ margin: 0 }}>Ghost Run</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Arrows/WASD to move, Space to jump. Beat your previous run (which starts 1 second earlier). Press R to restart.
			</p>
			<canvas ref={canvasRef} width={W} height={H} style={{ display: "block", border: "1px solid #333" }} />
		</div>
	);
}
