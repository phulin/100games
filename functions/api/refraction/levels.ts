interface Env {
	DB: D1Database;
}

interface PostBody {
	title?: unknown;
	grid?: unknown;
	author?: unknown;
}

const MAX_TITLE = 60;
const MAX_GRID_BYTES = 8192;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

async function hashAuthor(raw: string): Promise<string> {
	const buf = new TextEncoder().encode(`refraction:${raw}`);
	const digest = await crypto.subtle.digest("SHA-256", buf);
	const bytes = new Uint8Array(digest);
	let hex = "";
	for (let i = 0; i < 8; i++) {
		hex += bytes[i].toString(16).padStart(2, "0");
	}
	return hex;
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method === "GET") {
		const idParam = url.searchParams.get("id");
		if (idParam) {
			const id = Number.parseInt(idParam, 10);
			if (!Number.isFinite(id) || id <= 0) {
				return json({ error: "bad id" }, 400);
			}
			const row = await env.DB.prepare(
				"SELECT id, title, grid, author, solves, created_at FROM refraction_levels WHERE id = ?",
			)
				.bind(id)
				.first();
			if (!row) return json({ error: "not found" }, 404);
			return json({ level: row });
		}
		const { results } = await env.DB.prepare(
			"SELECT id, title, author, solves, created_at FROM refraction_levels ORDER BY created_at DESC LIMIT 20",
		).all();
		return json({ levels: results ?? [] });
	}

	if (request.method === "POST") {
		let body: PostBody;
		try {
			body = (await request.json()) as PostBody;
		} catch {
			return json({ error: "invalid json" }, 400);
		}

		const title =
			typeof body.title === "string" ? body.title.trim() : "";
		if (!title || title.length > MAX_TITLE) {
			return json({ error: "title must be 1-60 chars" }, 400);
		}

		if (typeof body.grid !== "string") {
			return json({ error: "grid must be a JSON string" }, 400);
		}
		const gridStr = body.grid;
		if (gridStr.length === 0 || gridStr.length > MAX_GRID_BYTES) {
			return json({ error: "grid too large" }, 400);
		}
		try {
			const parsed = JSON.parse(gridStr);
			if (!parsed || typeof parsed !== "object") {
				return json({ error: "grid not a JSON object" }, 400);
			}
		} catch {
			return json({ error: "grid not valid JSON" }, 400);
		}

		const rawAuthor =
			typeof body.author === "string" && body.author.length > 0
				? body.author.slice(0, 128)
				: "anon";
		const author = await hashAuthor(rawAuthor);

		const created_at = Date.now();
		const result = await env.DB.prepare(
			"INSERT INTO refraction_levels (title, grid, author, solves, created_at) VALUES (?, ?, ?, 0, ?)",
		)
			.bind(title, gridStr, author, created_at)
			.run();

		const id = result.meta?.last_row_id ?? null;
		return json(
			{ id, title, author, solves: 0, created_at },
			201,
		);
	}

	return json({ error: "method not allowed" }, 405);
};
