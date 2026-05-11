import { useEffect, useRef, useState } from "react";

const PIN_COUNT = 5;
const PIN_SPACING = 90;
const KEY_X = 100;
const KEY_Y = 350;
const KEY_W = PIN_COUNT * PIN_SPACING + 60;
const PIN_TOLERANCE = 6; // pixels

type Pin = {
	targetDepth: number; // 20..70
	keyDepth: number; // current cut, starts 0
};

function makeLevel(): Pin[] {
	return Array.from({ length: PIN_COUNT }, () => ({
		targetDepth: 20 + Math.random() * 50,
		keyDepth: 0,
	}));
}

export default function Game015_LocksmithsApprentice() {
	const W = 900;
	const H = 500;
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [pins, setPins] = useState<Pin[]>(makeLevel);
	const [filing, setFiling] = useState(false);
	const [level, setLevel] = useState(1);
	const [solved, setSolved] = useState(false);
	const [over, setOver] = useState(false);
	const lastX = useRef<number | null>(null);

	useEffect(() => {
		draw();
	});

	function draw() {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;
		ctx.fillStyle = "#1a1a28";
		ctx.fillRect(0, 0, W, H);

		// lock body
		ctx.fillStyle = "#3a3a4a";
		ctx.fillRect(80, 60, KEY_W, 200);
		// pins area
		for (let i = 0; i < PIN_COUNT; i++) {
			const px = KEY_X + i * PIN_SPACING + PIN_SPACING / 2;
			// chamber
			ctx.fillStyle = "#222";
			ctx.fillRect(px - 16, 60, 32, 200);
			// pin
			const p = pins[i];
			const clicked = Math.abs(p.targetDepth - p.keyDepth) < PIN_TOLERANCE;
			// driver pin (top) - falls into target slot if matched
			ctx.fillStyle = clicked ? "#7fc97f" : "#aaa";
			const pinTop = 60;
			const pinBottom = clicked ? 260 - p.targetDepth - 20 : 60 + 80;
			ctx.fillRect(px - 10, pinTop, 20, pinBottom - pinTop);
			// target marker on side
			ctx.strokeStyle = "rgba(255,255,255,0.2)";
			ctx.beginPath();
			ctx.moveTo(KEY_X - 5, 260 - p.targetDepth);
			ctx.lineTo(KEY_X + KEY_W + 5, 260 - p.targetDepth);
			ctx.stroke();
		}
		// key blank
		ctx.fillStyle = "#c9a566";
		ctx.fillRect(KEY_X, KEY_Y, KEY_W, 80);
		// key bow
		ctx.beginPath();
		ctx.arc(KEY_X - 20, KEY_Y + 40, 30, 0, Math.PI * 2);
		ctx.fillStyle = "#c9a566";
		ctx.fill();
		// cuts on top of key
		ctx.fillStyle = "#1a1a28";
		ctx.beginPath();
		ctx.moveTo(KEY_X, KEY_Y);
		for (let i = 0; i < PIN_COUNT; i++) {
			const px = KEY_X + i * PIN_SPACING;
			const cx = px + PIN_SPACING / 2;
			ctx.lineTo(cx - 20, KEY_Y);
			ctx.lineTo(cx, KEY_Y + pins[i].keyDepth);
			ctx.lineTo(cx + 20, KEY_Y);
		}
		ctx.lineTo(KEY_X + KEY_W, KEY_Y);
		ctx.lineTo(KEY_X + KEY_W, KEY_Y - 20);
		ctx.lineTo(KEY_X, KEY_Y - 20);
		ctx.closePath();
		ctx.fill();

		// instructions / status
		ctx.fillStyle = "#fff";
		ctx.font = "16px system-ui";
		ctx.fillText(
			"Drag horizontally over the key to file. Move slowly past each cut; deeper if you hold longer.",
			20,
			30,
		);
		ctx.fillText(`Level ${level} — pins clicked: ${pins.filter((p) => Math.abs(p.targetDepth - p.keyDepth) < PIN_TOLERANCE).length}/${PIN_COUNT}`, 20, 470);
		if (solved) {
			ctx.fillStyle = "#7fc97f";
			ctx.font = "28px system-ui";
			ctx.fillText("LOCK OPEN — click to advance", 280, 250);
		}
		if (over) {
			ctx.fillStyle = "#ff6b6b";
			ctx.font = "28px system-ui";
			ctx.fillText("Key broken — click to reset", 280, 250);
		}
	}

	function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
		if (solved || over) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * W;
		const y = ((e.clientY - rect.top) / rect.height) * H;
		if (!filing) {
			lastX.current = x;
			return;
		}
		if (y < KEY_Y - 30 || y > KEY_Y + 80) {
			lastX.current = x;
			return;
		}
		// determine which pin
		const i = Math.floor((x - KEY_X) / PIN_SPACING);
		if (i < 0 || i >= PIN_COUNT) {
			lastX.current = x;
			return;
		}
		const speed = lastX.current != null ? Math.abs(x - lastX.current) : 0;
		lastX.current = x;
		// filing rate: small per movement
		setPins((prev) => {
			const next = prev.map((p) => ({ ...p }));
			const filedAmount = Math.min(2, speed * 0.15);
			next[i].keyDepth += filedAmount;
			// over-file: if past target+PIN_TOLERANCE+10, break
			if (next[i].keyDepth > next[i].targetDepth + PIN_TOLERANCE + 12) {
				setOver(true);
			}
			// check solve
			if (next.every((p) => Math.abs(p.targetDepth - p.keyDepth) < PIN_TOLERANCE)) {
				setSolved(true);
			}
			return next;
		});
	}

	function onClick() {
		if (solved) {
			setPins(makeLevel());
			setSolved(false);
			setLevel((l) => l + 1);
		} else if (over) {
			setPins(makeLevel());
			setOver(false);
		}
	}

	return (
		<div style={{ background: "#0b0b1a", color: "#eee", padding: 16, fontFamily: "system-ui" }}>
			<h2 style={{ margin: 0 }}>The Locksmith's Apprentice</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Drag across the key blank to file cuts. Match each pin's notch — too deep and the key snaps.
			</p>
			<canvas
				ref={canvasRef}
				width={W}
				height={H}
				onMouseDown={() => setFiling(true)}
				onMouseUp={() => setFiling(false)}
				onMouseLeave={() => setFiling(false)}
				onMouseMove={onMove}
				onClick={onClick}
				style={{ display: "block", border: "1px solid #333", cursor: "crosshair" }}
			/>
		</div>
	);
}
