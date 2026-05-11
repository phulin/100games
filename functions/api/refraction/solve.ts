interface Env {
	DB: D1Database;
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

// Record a community-level solve. Increments the solve counter. Best effort,
// no auth — clients can spam, but the counter is purely informational. The
// puzzle itself is verified solvable on share, so this only inflates rank.
export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
	let body: { id?: unknown };
	try {
		body = (await request.json()) as { id?: unknown };
	} catch {
		return json({ error: "invalid json" }, 400);
	}
	const id = typeof body.id === "number" ? body.id : Number.parseInt(String(body.id), 10);
	if (!Number.isFinite(id) || id <= 0) return json({ error: "bad id" }, 400);
	const result = await env.DB.prepare(
		"UPDATE refraction_levels SET solves = solves + 1 WHERE id = ?",
	).bind(id).run();
	const changed = result.meta?.changes ?? 0;
	if (changed === 0) return json({ error: "not found" }, 404);
	const row = await env.DB.prepare(
		"SELECT solves FROM refraction_levels WHERE id = ?",
	).bind(id).first<{ solves: number }>();
	return json({ id, solves: row?.solves ?? 0 });
};
