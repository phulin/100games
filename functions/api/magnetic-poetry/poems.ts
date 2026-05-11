interface Env {
	DB: D1Database;
}

interface PostBody {
	action?: unknown;
	theme?: unknown;
	text?: unknown;
	author?: unknown;
	day?: unknown;
	poem_id?: unknown;
}

const MAX_TEXT = 500;
const MAX_THEME = 80;
const MAX_AUTHOR = 64;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function utcDay(d = new Date()): string {
	return d.toISOString().slice(0, 10);
}

function sanitize(s: string): string {
	// Strip control chars except \n (0x0A) and \t (0x09); normalize whitespace.
	let out = "";
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if (c === 0x09 || c === 0x0a) {
			out += s[i];
		} else if (c < 0x20 || c === 0x7f) {
			// skip
		} else {
			out += s[i];
		}
	}
	return out
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method === "GET") {
		const dayParam = url.searchParams.get("day");
		const day = dayParam && DAY_RE.test(dayParam) ? dayParam : utcDay();
		const { results } = await env.DB.prepare(
			"SELECT id, theme, text, author, votes, day, created_at FROM magnetic_poems WHERE day = ? ORDER BY votes DESC, created_at DESC LIMIT 20",
		)
			.bind(day)
			.all();
		return json({ day, poems: results ?? [] });
	}

	if (request.method === "POST") {
		let body: PostBody;
		try {
			body = (await request.json()) as PostBody;
		} catch {
			return json({ error: "invalid json" }, 400);
		}

		// Vote action
		if (body.action === "vote") {
			const poemId =
				typeof body.poem_id === "number" && Number.isFinite(body.poem_id)
					? Math.floor(body.poem_id)
					: Number.NaN;
			if (!Number.isFinite(poemId) || poemId <= 0) {
				return json({ error: "bad poem_id" }, 400);
			}
			const author =
				typeof body.author === "string" && body.author.trim().length > 0
					? body.author.trim().slice(0, MAX_AUTHOR)
					: "anon";

			const ins = await env.DB.prepare(
				"INSERT OR IGNORE INTO magnetic_votes (poem_id, author) VALUES (?, ?)",
			)
				.bind(poemId, author)
				.run();

			const changed = ins.meta?.changes ?? 0;
			if (changed > 0) {
				await env.DB.prepare(
					"UPDATE magnetic_poems SET votes = votes + 1 WHERE id = ?",
				)
					.bind(poemId)
					.run();
			}

			const row = await env.DB.prepare(
				"SELECT id, votes FROM magnetic_poems WHERE id = ?",
			)
				.bind(poemId)
				.first<{ id: number; votes: number }>();

			if (!row) return json({ error: "not found" }, 404);
			return json({ id: row.id, votes: row.votes, counted: changed > 0 });
		}

		// Create poem
		const theme =
			typeof body.theme === "string" ? sanitize(body.theme).slice(0, MAX_THEME) : "";
		if (!theme) return json({ error: "theme required" }, 400);

		const rawText = typeof body.text === "string" ? body.text : "";
		const text = sanitize(rawText);
		if (!text || text.length > MAX_TEXT) {
			return json({ error: `text must be 1-${MAX_TEXT} chars` }, 400);
		}

		const author =
			typeof body.author === "string" && body.author.trim().length > 0
				? body.author.trim().slice(0, MAX_AUTHOR)
				: "anon";

		const day =
			typeof body.day === "string" && DAY_RE.test(body.day)
				? body.day
				: utcDay();

		const created_at = Date.now();
		const result = await env.DB.prepare(
			"INSERT INTO magnetic_poems (theme, text, author, votes, day, created_at) VALUES (?, ?, ?, 0, ?, ?)",
		)
			.bind(theme, text, author, day, created_at)
			.run();

		const id = result.meta?.last_row_id ?? null;
		return json(
			{ id, theme, text, author, votes: 0, day, created_at },
			201,
		);
	}

	return json({ error: "method not allowed" }, 405);
};
