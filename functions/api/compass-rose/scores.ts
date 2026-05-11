interface Env {
	DB: D1Database;
}

const MAX_HANDLE_LEN = 20;
const MAX_AUTHOR_LEN = 128;
const MAX_SOLVE_MS = 24 * 60 * 60 * 1000; // 24h sanity cap

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// Must match the client's derivation exactly.
function utcDayString(d = new Date()): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function seedForDay(day: string): string {
	// Deterministic 32-bit FNV-1a hash of "compass-rose:<day>".
	const input = `compass-rose:${day}`;
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return String(h >>> 0);
}

function isValidDay(s: string | null): s is string {
	return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method === "GET") {
		const day = url.searchParams.get("day") ?? utcDayString();
		if (!isValidDay(day)) {
			return json({ error: "invalid 'day' (expected YYYY-MM-DD)" }, 400);
		}
		try {
			const rs = await env.DB.prepare(
				`SELECT handle, solve_ms, created_at
				 FROM compass_scores
				 WHERE day = ?1 AND correct = 1
				 ORDER BY solve_ms ASC, created_at ASC
				 LIMIT 20`,
			)
				.bind(day)
				.all<{ handle: string; solve_ms: number; created_at: number }>();
			return json({
				day,
				seed: seedForDay(day),
				scores: rs.results ?? [],
			});
		} catch (e) {
			return json({ error: "db error", detail: String(e) }, 500);
		}
	}

	if (request.method === "POST") {
		let body: any;
		try {
			body = await request.json();
		} catch {
			return json({ error: "invalid JSON" }, 400);
		}

		const today = utcDayString();
		const expectedSeed = seedForDay(today);

		const seed = typeof body?.seed === "string" ? body.seed : null;
		const solve_ms = body?.solve_ms;
		const correct = body?.correct;
		const author = typeof body?.author === "string" ? body.author : "";
		let handle = typeof body?.handle === "string" ? body.handle.trim() : "anon";

		if (!seed || seed !== expectedSeed) {
			return json({ error: "seed mismatch (puzzle expired or invalid)" }, 400);
		}
		if (!Number.isInteger(solve_ms) || solve_ms < 0 || solve_ms > MAX_SOLVE_MS) {
			return json({ error: "'solve_ms' out of range" }, 400);
		}
		if (correct !== 0 && correct !== 1) {
			return json({ error: "'correct' must be 0 or 1" }, 400);
		}
		if (!author || author.length === 0 || author.length > MAX_AUTHOR_LEN) {
			return json({ error: "missing or invalid 'author'" }, 400);
		}
		if (handle.length === 0) handle = "anon";
		if (handle.length > MAX_HANDLE_LEN) handle = handle.slice(0, MAX_HANDLE_LEN);

		const day = today;
		const created_at = Date.now();

		try {
			// UPSERT: keep fastest correct time per (day, author).
			// If new row is correct and faster, overwrite. Always update handle.
			await env.DB.prepare(
				`INSERT INTO compass_scores (day, seed, author, handle, solve_ms, correct, created_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
				 ON CONFLICT(day, author) DO UPDATE SET
				   handle = excluded.handle,
				   solve_ms = CASE
				     WHEN excluded.correct = 1
				       AND (compass_scores.correct = 0 OR excluded.solve_ms < compass_scores.solve_ms)
				     THEN excluded.solve_ms
				     ELSE compass_scores.solve_ms
				   END,
				   correct = CASE
				     WHEN excluded.correct = 1
				       AND (compass_scores.correct = 0 OR excluded.solve_ms < compass_scores.solve_ms)
				     THEN 1
				     ELSE compass_scores.correct
				   END,
				   created_at = CASE
				     WHEN excluded.correct = 1
				       AND (compass_scores.correct = 0 OR excluded.solve_ms < compass_scores.solve_ms)
				     THEN excluded.created_at
				     ELSE compass_scores.created_at
				   END`,
			)
				.bind(day, seed, author, handle, solve_ms, correct, created_at)
				.run();

			const rs = await env.DB.prepare(
				`SELECT handle, solve_ms, created_at
				 FROM compass_scores
				 WHERE day = ?1 AND correct = 1
				 ORDER BY solve_ms ASC, created_at ASC
				 LIMIT 20`,
			)
				.bind(day)
				.all<{ handle: string; solve_ms: number; created_at: number }>();

			return json({ ok: true, day, seed, scores: rs.results ?? [] });
		} catch (e) {
			return json({ error: "db error", detail: String(e) }, 500);
		}
	}

	return json({ error: "method not allowed" }, 405);
};
