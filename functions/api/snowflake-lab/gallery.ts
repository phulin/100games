interface Env {
	DB: D1Database;
}

interface FlakeRow {
	id: number;
	params: string;
	author: string | null;
	daily_seed: number | null;
	novelty: number;
	created_at: number;
}

const LIMIT = 60;
const FETCH_LIMIT = 500; // for novelty computation

function sanitizeAuthor(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const c = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
	return c.length > 0 ? c : null;
}

function validParams(input: unknown): Record<string, number> | null {
	if (!input || typeof input !== "object") return null;
	const allowed = [
		"branchLength",
		"branchAngle",
		"subBranches",
		"subAngle",
		"subLength",
		"thickness",
		"tipShape",
	];
	const out: Record<string, number> = {};
	const rec = input as Record<string, unknown>;
	for (const k of allowed) {
		const v = Number(rec[k]);
		if (!Number.isFinite(v)) return null;
		if (Math.abs(v) > 10000) return null;
		out[k] = v;
	}
	return out;
}

function paramsToVec(p: Record<string, number>): number[] {
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

function distance(a: number[], b: number[]): number {
	let d = 0;
	for (let i = 0; i < a.length; i++) d += (a[i] - b[i]) ** 2;
	return Math.sqrt(d);
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", "cache-control": "no-store" },
	});
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	if (!env.DB) return jsonResponse({ error: "Database not bound" }, 500);

	try {
		const url = new URL(request.url);

		if (request.method === "GET") {
			const daily = url.searchParams.get("daily");
			let result;
			if (daily !== null) {
				const seed = parseInt(daily, 10);
				if (!Number.isFinite(seed)) return jsonResponse({ error: "Invalid daily" }, 400);
				result = await env.DB.prepare(
					"SELECT id, params, author, daily_seed, novelty, created_at FROM snowflakes WHERE daily_seed = ? ORDER BY novelty DESC, created_at DESC LIMIT ?",
				)
					.bind(seed, LIMIT)
					.all<FlakeRow>();
			} else {
				result = await env.DB.prepare(
					"SELECT id, params, author, daily_seed, novelty, created_at FROM snowflakes ORDER BY created_at DESC LIMIT ?",
				)
					.bind(LIMIT)
					.all<FlakeRow>();
			}
			const rows = (result.results ?? []).map((r) => ({
				id: r.id,
				params: JSON.parse(r.params),
				author: r.author,
				daily_seed: r.daily_seed,
				novelty: r.novelty,
				created_at: r.created_at,
			}));
			return jsonResponse({ flakes: rows });
		}

		if (request.method === "POST") {
			let body: Record<string, unknown>;
			try {
				body = (await request.json()) as Record<string, unknown>;
			} catch {
				return jsonResponse({ error: "Invalid JSON" }, 400);
			}

			const params = validParams(body.params);
			if (!params) return jsonResponse({ error: "Invalid params" }, 400);
			const author = sanitizeAuthor(body.author);
			const dailyRaw = body.daily_seed;
			const daily = typeof dailyRaw === "number" && Number.isFinite(dailyRaw) ? Math.floor(dailyRaw) : null;
			const createdAt = Date.now();

			// Compute novelty server-side from recent flakes
			const recent = await env.DB.prepare(
				"SELECT params FROM snowflakes ORDER BY id DESC LIMIT ?",
			)
				.bind(FETCH_LIMIT)
				.all<{ params: string }>();

			const myVec = paramsToVec(params);
			let minSim = Infinity;
			for (const row of recent.results ?? []) {
				try {
					const other = paramsToVec(JSON.parse(row.params));
					const d = distance(myVec, other);
					if (d < minSim) minSim = d;
				} catch {}
			}
			const novelty = !Number.isFinite(minSim) ? 100 : Math.min(100, Math.round(minSim * 60));

			const insert = await env.DB.prepare(
				"INSERT INTO snowflakes (params, author, daily_seed, novelty, created_at) VALUES (?, ?, ?, ?, ?)",
			)
				.bind(JSON.stringify(params), author, daily, novelty, createdAt)
				.run();

			const id = insert.meta?.last_row_id ?? 0;
			return jsonResponse({ id, novelty, comparison_count: recent.results?.length ?? 0 }, 201);
		}

		return jsonResponse({ error: "Method not allowed" }, 405);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Unknown error";
		return jsonResponse({ error: msg }, 500);
	}
};
