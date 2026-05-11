interface Env {
	DB: D1Database;
}

const MAX_FRAMES_BYTES = 64 * 1024; // 64KB
const MAX_AUTHOR_LEN = 128;
const MAX_HANDLE_LEN = 32;
const MAX_LEVEL_LEN = 256;
const MAX_TOP_N = 25;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function sanitizeHandle(h: unknown): string | null {
	if (typeof h !== "string") return null;
	const trimmed = h.trim().slice(0, MAX_HANDLE_LEN);
	if (trimmed.length === 0) return null;
	// strip control chars
	return trimmed.replace(/[\x00-\x1f\x7f]/g, "");
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method === "GET") {
		const level = url.searchParams.get("level");
		if (!level || level.length > MAX_LEVEL_LEN) {
			return json({ error: "missing or invalid 'level'" }, 400);
		}
		const topParam = url.searchParams.get("top");
		const top = topParam ? Math.max(1, Math.min(MAX_TOP_N, parseInt(topParam, 10) || 1)) : 1;
		const includeFrames = url.searchParams.get("frames") !== "0";

		try {
			if (top === 1 && includeFrames) {
				// Back-compat shape: { run: {...} }
				const row = await env.DB.prepare(
					"SELECT id, level_seed, finish_ms, frames, author, handle, created_at FROM ghost_runs WHERE level_seed = ?1 ORDER BY finish_ms ASC LIMIT 1",
				)
					.bind(level)
					.first<{
						id: number;
						level_seed: string;
						finish_ms: number;
						frames: string;
						author: string;
						handle: string | null;
						created_at: number;
					}>();
				if (!row) return json({ run: null });
				let frames: unknown = [];
				try {
					frames = JSON.parse(row.frames);
				} catch {
					frames = [];
				}
				return json({
					run: {
						id: row.id,
						level: row.level_seed,
						finish_ms: row.finish_ms,
						author: row.author,
						handle: row.handle,
						created_at: row.created_at,
						frames,
					},
				});
			}

			// Top-N (frames optional, default included only if top===1).
			const cols = includeFrames
				? "id, level_seed, finish_ms, frames, author, handle, created_at"
				: "id, level_seed, finish_ms, author, handle, created_at";
			const res = await env.DB.prepare(
				`SELECT ${cols} FROM ghost_runs WHERE level_seed = ?1 ORDER BY finish_ms ASC LIMIT ?2`,
			)
				.bind(level, top)
				.all<{
					id: number;
					level_seed: string;
					finish_ms: number;
					frames?: string;
					author: string;
					handle: string | null;
					created_at: number;
				}>();
			const rows = res.results || [];
			const runs = rows.map((row) => {
				let frames: unknown = undefined;
				if (includeFrames && row.frames !== undefined) {
					try {
						frames = JSON.parse(row.frames);
					} catch {
						frames = [];
					}
				}
				return {
					id: row.id,
					level: row.level_seed,
					finish_ms: row.finish_ms,
					author: row.author,
					handle: row.handle,
					created_at: row.created_at,
					...(includeFrames ? { frames } : {}),
				};
			});
			return json({ runs });
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
		const level = typeof body?.level === "string" ? body.level : null;
		const finish_ms = body?.finish_ms;
		const frames = body?.frames;
		const author = typeof body?.author === "string" ? body.author : "anon";
		const handle = sanitizeHandle(body?.handle);

		if (!level || level.length === 0 || level.length > MAX_LEVEL_LEN) {
			return json({ error: "missing or invalid 'level'" }, 400);
		}
		if (!Number.isInteger(finish_ms) || finish_ms < 0 || finish_ms > 1e9) {
			return json({ error: "'finish_ms' must be a non-negative integer" }, 400);
		}
		if (!Array.isArray(frames)) {
			return json({ error: "'frames' must be an array" }, 400);
		}
		const framesJson = JSON.stringify(frames);
		if (framesJson.length > MAX_FRAMES_BYTES) {
			return json({ error: "'frames' exceeds 64KB limit" }, 413);
		}
		if (author.length > MAX_AUTHOR_LEN) {
			return json({ error: "'author' too long" }, 400);
		}

		const created_at = Date.now();
		try {
			const res = await env.DB.prepare(
				"INSERT INTO ghost_runs (level_seed, finish_ms, frames, author, handle, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			)
				.bind(level, finish_ms, framesJson, author, handle, created_at)
				.run();
			return json({ ok: true, id: (res as any)?.meta?.last_row_id ?? null, created_at });
		} catch (e) {
			return json({ error: "db error", detail: String(e) }, 500);
		}
	}

	return json({ error: "method not allowed" }, 405);
};
