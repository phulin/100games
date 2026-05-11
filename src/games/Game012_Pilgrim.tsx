import { useEffect, useRef, useState } from "react";

type Landmark = {
	x: number;
	kind: "shrine" | "sunset" | "tree" | "rock";
	worthy: boolean;
};

export default function Game012_Pilgrim() {
	const W = 900;
	const H = 400;
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const stateRef = useRef({
		x: 0,
		stopped: false,
		stopTimer: 0,
		energy: 100,
		reverence: 0,
		landmarks: [] as Landmark[],
		lastSpawnX: 0,
		gameOver: false,
		stopHeldNear: null as Landmark | null,
		earned: new Set<Landmark>(),
	});
	const [, force] = useState(0);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				e.preventDefault();
				if (stateRef.current.gameOver) {
					stateRef.current = {
						x: 0,
						stopped: false,
						stopTimer: 0,
						energy: 100,
						reverence: 0,
						landmarks: [],
						lastSpawnX: 0,
						gameOver: false,
						stopHeldNear: null,
						earned: new Set(),
					};
					return;
				}
				stateRef.current.stopped = !stateRef.current.stopped;
				if (stateRef.current.stopped) {
					stateRef.current.stopTimer = 0;
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const s = stateRef.current;
			if (!s.gameOver) {
				if (!s.stopped) {
					s.x += 80 * dt;
				} else {
					s.stopTimer += dt;
				}
				// spawn landmarks
				while (s.lastSpawnX < s.x + W) {
					const nextX = s.lastSpawnX + 200 + Math.random() * 250;
					const kinds: Landmark["kind"][] = ["shrine", "sunset", "tree", "rock"];
					const kind = kinds[Math.floor(Math.random() * 4)];
					const worthy = kind === "shrine" || kind === "sunset" || (kind === "tree" && Math.random() < 0.4);
					s.landmarks.push({ x: nextX, kind, worthy });
					s.lastSpawnX = nextX;
				}
				// reverence logic when stopped
				s.stopHeldNear = null;
				if (s.stopped) {
					const playerX = s.x + W * 0.3;
					let near: Landmark | null = null;
					let bestDist = 80;
					for (const lm of s.landmarks) {
						const d = Math.abs(lm.x - playerX);
						if (d < bestDist) {
							bestDist = d;
							near = lm;
						}
					}
					s.stopHeldNear = near;
					if (near && near.worthy && !s.earned.has(near)) {
						if (s.stopTimer > 0.8) {
							s.reverence += 10;
							s.earned.add(near);
							s.energy = Math.min(100, s.energy + 5);
						}
					} else if (s.stopTimer > 0.8) {
						s.energy -= 8 * dt;
					}
				}
				// passive energy drain when walking past worthy landmark
				for (const lm of s.landmarks) {
					if (lm.worthy && !s.earned.has(lm)) {
						const playerX = s.x + W * 0.3;
						if (lm.x < playerX - 30 && lm.x > playerX - 32 - 80 * dt) {
							// missed worthy stop
							s.energy -= 5;
						}
					}
				}
				if (s.energy <= 0) {
					s.energy = 0;
					s.gameOver = true;
				}
				// cleanup
				s.landmarks = s.landmarks.filter((l) => l.x > s.x - 50);
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
		// sky gradient
		const sky = ctx.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, "#1e2a55");
		sky.addColorStop(1, "#c97a5b");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, W, H);
		// ground
		ctx.fillStyle = "#3d2818";
		ctx.fillRect(0, H - 80, W, 80);
		// landmarks
		for (const lm of s.landmarks) {
			const px = lm.x - s.x;
			if (px < -50 || px > W + 50) continue;
			const earned = s.earned.has(lm);
			if (lm.kind === "shrine") {
				ctx.fillStyle = earned ? "#ffd166" : "#8b6f4a";
				ctx.fillRect(px - 12, H - 80 - 40, 24, 40);
				ctx.fillStyle = "#5a3a25";
				ctx.fillRect(px - 16, H - 80 - 50, 32, 10);
			} else if (lm.kind === "sunset") {
				ctx.fillStyle = earned ? "#ff8c42" : "#d97b3a";
				ctx.beginPath();
				ctx.arc(px, H - 80 - 60, 30, 0, Math.PI * 2);
				ctx.fill();
			} else if (lm.kind === "tree") {
				ctx.fillStyle = "#5a3a25";
				ctx.fillRect(px - 3, H - 80 - 40, 6, 40);
				ctx.fillStyle = earned ? "#7fc97f" : "#3a6a3a";
				ctx.beginPath();
				ctx.arc(px, H - 80 - 55, 20, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.fillStyle = "#666";
				ctx.beginPath();
				ctx.arc(px, H - 80 - 8, 14, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		// pilgrim
		const px = W * 0.3;
		ctx.fillStyle = "#222";
		ctx.fillRect(px - 8, H - 80 - 32, 16, 32);
		ctx.fillStyle = "#eee";
		ctx.beginPath();
		ctx.arc(px, H - 80 - 38, 8, 0, Math.PI * 2);
		ctx.fill();
		// UI
		ctx.fillStyle = "#fff";
		ctx.font = "16px system-ui";
		ctx.fillText(`Reverence: ${s.reverence}`, 12, 24);
		ctx.fillText(`Energy: ${Math.round(s.energy)}`, 12, 44);
		ctx.fillText(s.stopped ? "(stopped)" : "(walking)", 12, 64);
		if (s.gameOver) {
			ctx.fillStyle = "rgba(0,0,0,0.6)";
			ctx.fillRect(0, 0, W, H);
			ctx.fillStyle = "#fff";
			ctx.font = "32px system-ui";
			ctx.fillText(`Pilgrimage ended — Reverence ${s.reverence}`, 180, H / 2);
			ctx.font = "16px system-ui";
			ctx.fillText("Press SPACE to walk again", 340, H / 2 + 30);
		}
	}

	return (
		<div style={{ background: "#0b0b1a", color: "#eee", padding: 16, fontFamily: "system-ui" }}>
			<h2 style={{ margin: 0 }}>The Pilgrim</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Press SPACE to stop. Stop at shrines, sunsets, and worthy trees for reverence — wrong stops drain energy.
			</p>
			<canvas ref={canvasRef} width={W} height={H} style={{ display: "block", border: "1px solid #333" }} />
		</div>
	);
}
