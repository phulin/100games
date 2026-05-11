interface Env {
	DB: D1Database;
}

interface PostBody {
	name?: unknown;
	truths?: unknown;
	lies?: unknown;
	author?: unknown;
}

const MAX_NAME = 80;
const MAX_FRAG = 200;
const MAX_TRUTHS = 12;
const MAX_LIES = 10;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

async function hashAuthor(raw: string): Promise<string> {
	const buf = new TextEncoder().encode(`witness:${raw}`);
	const digest = await crypto.subtle.digest("SHA-256", buf);
	const bytes = new Uint8Array(digest);
	let hex = "";
	for (let i = 0; i < 8; i++) {
		hex += bytes[i].toString(16).padStart(2, "0");
	}
	return hex;
}

function isStringArray(v: unknown, maxLen: number, minCount: number, maxCount: number): v is string[] {
	if (!Array.isArray(v)) return false;
	if (v.length < minCount || v.length > maxCount) return false;
	return v.every((x) => typeof x === "string" && x.length > 0 && x.length <= maxLen);
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method === "GET") {
		const mode = url.searchParams.get("mode");
		if (mode === "random") {
			const row = await env.DB.prepare(
				"SELECT id, name, truths, lies, author, solves, attempts, created_at FROM witness_cases ORDER BY RANDOM() LIMIT 1",
			).first();
			if (!row) return json({ case: null });
			return json({ case: row });
		}
		const idParam = url.searchParams.get("id");
		if (idParam) {
			const id = Number.parseInt(idParam, 10);
			if (!Number.isFinite(id) || id <= 0) return json({ error: "bad id" }, 400);
			const row = await env.DB.prepare(
				"SELECT id, name, truths, lies, author, solves, attempts, created_at FROM witness_cases WHERE id = ?",
			)
				.bind(id)
				.first();
			if (!row) return json({ error: "not found" }, 404);
			return json({ case: row });
		}
		const { results } = await env.DB.prepare(
			"SELECT id, name, author, solves, attempts, created_at FROM witness_cases ORDER BY created_at DESC LIMIT 30",
		).all();
		return json({ cases: results ?? [] });
	}

	if (request.method === "POST") {
		const action = url.searchParams.get("action");
		if (action === "solve" || action === "attempt") {
			const idParam = url.searchParams.get("id");
			const id = idParam ? Number.parseInt(idParam, 10) : NaN;
			if (!Number.isFinite(id) || id <= 0) return json({ error: "bad id" }, 400);
			if (action === "solve") {
				await env.DB.prepare(
					"UPDATE witness_cases SET solves = solves + 1, attempts = attempts + 1 WHERE id = ?",
				)
					.bind(id)
					.run();
			} else {
				await env.DB.prepare(
					"UPDATE witness_cases SET attempts = attempts + 1 WHERE id = ?",
				)
					.bind(id)
					.run();
			}
			return json({ ok: true });
		}

		let body: PostBody;
		try {
			body = (await request.json()) as PostBody;
		} catch {
			return json({ error: "invalid json" }, 400);
		}

		const name = typeof body.name === "string" ? body.name.trim() : "";
		if (!name || name.length > MAX_NAME) return json({ error: "name 1-80 chars" }, 400);

		if (!isStringArray(body.truths, MAX_FRAG, 3, MAX_TRUTHS)) {
			return json({ error: `truths must be 3-${MAX_TRUTHS} strings (<= ${MAX_FRAG} chars)` }, 400);
		}
		if (!isStringArray(body.lies, MAX_FRAG, 1, MAX_LIES)) {
			return json({ error: `lies must be 1-${MAX_LIES} strings (<= ${MAX_FRAG} chars)` }, 400);
		}

		const truthsStr = JSON.stringify(body.truths);
		const liesStr = JSON.stringify(body.lies);
		if (truthsStr.length > 4096 || liesStr.length > 4096) {
			return json({ error: "payload too large" }, 400);
		}

		const rawAuthor =
			typeof body.author === "string" && body.author.length > 0
				? body.author.slice(0, 128)
				: "anon";
		const author = await hashAuthor(rawAuthor);
		const created_at = Date.now();

		const result = await env.DB.prepare(
			"INSERT INTO witness_cases (name, truths, lies, author, solves, attempts, created_at) VALUES (?, ?, ?, ?, 0, 0, ?)",
		)
			.bind(name, truthsStr, liesStr, author, created_at)
			.run();

		const id = result.meta?.last_row_id ?? null;
		return json({ id, name, author, solves: 0, attempts: 0, created_at }, 201);
	}

	return json({ error: "method not allowed" }, 405);
};
