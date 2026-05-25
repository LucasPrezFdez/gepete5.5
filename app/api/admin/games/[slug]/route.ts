import { jsonError, jsonOk } from "@/lib/api";
import { parseBody, v } from "@/lib/validation";
import { requireAdminFromRequest } from "@/services/community";
import { createSqlClient } from "@/services/database";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("api/admin/games/[slug]");

type Params = Promise<{ slug: string }>;

const patchSchema = {
  isFeatured: v.boolean({ optional: true }),
  featuredRank: v.integer({ min: 0, max: 9999, optional: true }),
  isHidden: v.boolean({ optional: true }),
  hiddenReason: v.string({ max: 240, optional: true })
};

export async function PATCH(request: Request, { params }: { params: Params }) {
  const auth = await requireAdminFromRequest(request);
  if (auth.response) return auth.response;

  const { slug } = await params;
  if (!slug?.trim()) return jsonError("Slug requerido.", 400);

  const body = await parseBody(patchSchema, request);
  if (!body.ok) return jsonError(body.error, 400);

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.value.isFeatured !== undefined) {
    updates.push(`is_featured = $${idx}`);
    values.push(body.value.isFeatured);
    idx += 1;
  }
  if (body.value.featuredRank !== undefined) {
    updates.push(`featured_rank = $${idx}`);
    values.push(body.value.featuredRank);
    idx += 1;
  }
  if (body.value.isHidden !== undefined) {
    updates.push(`is_hidden = $${idx}`);
    values.push(body.value.isHidden);
    idx += 1;
  }
  if (body.value.hiddenReason !== undefined) {
    updates.push(`hidden_reason = $${idx}`);
    values.push(body.value.hiddenReason?.trim() || null);
    idx += 1;
  }

  if (updates.length === 0) return jsonError("Nada que actualizar.", 400);

  updates.push("updated_at = now()");
  values.push(slug);

  try {
    const sql = createSqlClient();
    const rows = (await sql.query(
      `update games set ${updates.join(", ")} where slug = $${idx} returning id, slug, is_featured, featured_rank, is_hidden, hidden_reason`,
      values
    )) as Array<{ id: string; slug: string; is_featured: boolean; featured_rank: number | null; is_hidden: boolean; hidden_reason: string | null }>;
    if (!rows.length) return jsonError("Juego no encontrado.", 404);
    log.info("game overrides updated", { adminId: auth.user!.id, slug, ...body.value });
    return jsonOk({ ok: true, game: rows[0] });
  } catch (error) {
    log.error("game patch failed", { error: error instanceof Error ? error.message : String(error) });
    return jsonError("No se pudo actualizar el juego.", 500);
  }
}
