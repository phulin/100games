interface Env {
	DB: D1Database;
}

const MAX_HANDLE_LEN = 20;
const MAX_AUTHOR_LEN = 128;
const MAX_WORD_LEN = 64;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WORD_RE = /^[a-z]+$/;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function todayUTC(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method === "GET") {
		const day = url.searchParams.get("day") || todayUTC();
		if (!DAY_RE.test(day)) {
			return json({ error: "invalid 'day' format, want YYYY-MM-DD" }, 400);
		}
		try {
			const lbRes = await env.DB.prepare(
				"SELECT handle, chain_len, word, created_at FROM wordweaver_chains WHERE day = ?1 ORDER BY chain_len DESC, created_at ASC LIMIT 20",
			)
				.bind(day)
				.all<{
					handle: string;
					chain_len: number;
					word: string;
					created_at: number;
				}>();
			return json({
				day,
				leaderboard: (lbRes.results ?? []).map((r, i) => ({
					rank: i + 1,
					handle: r.handle,
					chain_len: r.chain_len,
					word: r.word,
					created_at: r.created_at,
				})),
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
		const day = typeof body?.day === "string" ? body.day : null;
		const chain_len = body?.chain_len;
		const word = typeof body?.word === "string" ? body.word.toLowerCase() : "";
		const author = typeof body?.author === "string" ? body.author : "";
		const rawHandle = typeof body?.handle === "string" ? body.handle : "";
		const handle = rawHandle.trim().slice(0, MAX_HANDLE_LEN) || "anon";

		if (!day || !DAY_RE.test(day)) {
			return json({ error: "missing or invalid 'day'" }, 400);
		}
		if (day !== todayUTC()) {
			return json({ error: "'day' must match today UTC" }, 400);
		}
		if (
			!Number.isInteger(chain_len) ||
			chain_len < 1 ||
			chain_len > 100
		) {
			return json({ error: "'chain_len' must be integer in 1..100" }, 400);
		}
		if (!word || word.length === 0 || word.length > MAX_WORD_LEN || !WORD_RE.test(word)) {
			return json({ error: "'word' must be lowercase a-z, <=64 chars" }, 400);
		}
		if (!author || author.length === 0 || author.length > MAX_AUTHOR_LEN) {
			return json({ error: "missing or invalid 'author'" }, 400);
		}
		const created_at = Date.now();

		try {
			// Keep best chain_len per (day, author).
			await env.DB.prepare(
				`INSERT INTO wordweaver_chains (day, author, handle, chain_len, word, created_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
				 ON CONFLICT(day, author) DO UPDATE SET
				   handle = excluded.handle,
				   chain_len = excluded.chain_len,
				   word = excluded.word,
				   created_at = excluded.created_at
				 WHERE excluded.chain_len > wordweaver_chains.chain_len`,
			)
				.bind(day, author, handle, chain_len, word, created_at)
				.run();

			const best = await env.DB.prepare(
				"SELECT chain_len, word FROM wordweaver_chains WHERE day = ?1 AND author = ?2",
			)
				.bind(day, author)
				.first<{ chain_len: number; word: string }>();

			return json({ ok: true, day, submitted: { chain_len, word }, best });
		} catch (e) {
			return json({ error: "db error", detail: String(e) }, 500);
		}
	}

	return json({ error: "method not allowed" }, 405);
};
