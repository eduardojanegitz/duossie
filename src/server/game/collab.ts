import "server-only";
import { z } from "zod";
import { projectView } from "@/engine";
import type { Viewer } from "@/server/auth/viewer";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import type { Database } from "@/server/supabase/database.types";

type ItemPatch = Database["public"]["Tables"]["board_items"]["Update"];
type LinkPatch = Database["public"]["Tables"]["board_links"]["Update"];
import { GameError, loadContext, type PlayerContext } from "./service";

/**
 * Colaboração da dupla dentro de uma investigação: quadro de evidências e chat.
 * Regras de privacidade:
 *  - Itens privados só aparecem para o autor.
 *  - Um item que aponta para evidência que o leitor NÃO pode acessar aparece "tarjado":
 *    sem id, título ou conteúdo da evidência — só a nota do autor e o fato de existir.
 *  - Mensagens com evidência anexada seguem a mesma regra.
 */

const STATUS = ["hypothesis", "confirmed", "contradiction"] as const;
export type BoardStatus = (typeof STATUS)[number];

export type BoardItemView = {
  id: string;
  mine: boolean;
  kind: "evidence" | "note";
  visibility: "private" | "shared";
  /** Evidência visível para o leitor, ou `null` (nota ou evidência que ele não acessa). */
  evidence: { id: string; title: string; kind: string; summary: string } | null;
  redacted: boolean;
  body: string | null;
  group: string | null;
  status: BoardStatus;
  highlight: boolean;
  x: number;
  y: number;
};

export type BoardLinkView = { id: string; from: string; to: string; label: string | null; status: BoardStatus; mine: boolean };
export type BoardView = { items: BoardItemView[]; links: BoardLinkView[] };

export type MessageView = {
  id: string;
  mine: boolean;
  kind: "text" | "help";
  body: string | null;
  evidence: { id: string; title: string } | { redacted: true } | null;
  puzzle: { id: string; title: string } | null;
  at: string;
};

function accessibleEvidence(ctx: PlayerContext) {
  const view = projectView(ctx.def, ctx.session.state, ctx.role);
  return new Map(view.evidence.map((e) => [e.id, e]));
}

async function signal(ctx: PlayerContext, event: "board_updated" | "message_created") {
  const db = createSupabaseAdminClient();
  await db.rpc("notify_duo", { p_duo_id: ctx.session.duo_id, p_event: event, p_payload: { sessionId: ctx.session.id } });
}

// ---------------------------------------------------------------------------
// Quadro
// ---------------------------------------------------------------------------
export async function getBoard(viewer: Viewer, sessionId: string): Promise<BoardView> {
  const ctx = await loadContext(viewer, sessionId);
  const db = createSupabaseAdminClient();
  const [{ data: items }, { data: links }] = await Promise.all([
    db.from("board_items").select("*").eq("session_id", sessionId).order("created_at"),
    db.from("board_links").select("*").eq("session_id", sessionId).order("created_at"),
  ]);
  const access = accessibleEvidence(ctx);

  const visible: BoardItemView[] = (items ?? [])
    .filter((i) => i.author_id === viewer.userId || i.visibility === "shared")
    .map((i) => {
      const ev = i.evidence_id ? access.get(i.evidence_id) : undefined;
      return {
        id: i.id,
        mine: i.author_id === viewer.userId,
        kind: i.kind,
        visibility: i.visibility,
        evidence: ev ? { id: ev.id, title: ev.title, kind: ev.kind, summary: ev.summary } : null,
        redacted: i.kind === "evidence" && !ev,
        body: i.body,
        group: i.group_label,
        status: i.status,
        highlight: i.highlight,
        x: i.x,
        y: i.y,
      };
    });
  const ids = new Set(visible.map((i) => i.id));
  return {
    items: visible,
    links: (links ?? [])
      .filter((l) => ids.has(l.from_item) && ids.has(l.to_item))
      .map((l) => ({ id: l.id, from: l.from_item, to: l.to_item, label: l.label, status: l.status, mine: l.author_id === viewer.userId })),
  };
}

const text = (max: number) => z.string().trim().min(1).max(max);

export const boardCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pin"), evidenceId: z.string().max(60), visibility: z.enum(["private", "shared"]), body: text(500).optional() }).strict(),
  z.object({ type: z.literal("note"), body: text(500), visibility: z.enum(["private", "shared"]), group: text(40).optional() }).strict(),
  z
    .object({
      type: z.literal("update"),
      itemId: z.uuid(),
      body: text(500).nullable().optional(),
      visibility: z.enum(["private", "shared"]).optional(),
      group: text(40).nullable().optional(),
      status: z.enum(STATUS).optional(),
      highlight: z.boolean().optional(),
      x: z.number().min(-5000).max(5000).optional(),
      y: z.number().min(-5000).max(5000).optional(),
    })
    .strict(),
  z.object({ type: z.literal("remove"), itemId: z.uuid() }).strict(),
  z.object({ type: z.literal("link"), from: z.uuid(), to: z.uuid(), label: text(80).optional(), status: z.enum(STATUS).optional() }).strict(),
  z.object({ type: z.literal("update_link"), linkId: z.uuid(), label: text(80).nullable().optional(), status: z.enum(STATUS).optional() }).strict(),
  z.object({ type: z.literal("unlink"), linkId: z.uuid() }).strict(),
]);
export type BoardCommand = z.infer<typeof boardCommandSchema>;

/** Posição inicial em grade (4 colunas) para novos cartões não se sobreporem na mesa. */
async function nextSlot(sessionId: string) {
  const db = createSupabaseAdminClient();
  const { count } = await db.from("board_items").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
  const n = count ?? 0;
  return { x: 32 + (n % 4) * 260, y: 32 + Math.floor(n / 4) * 150 };
}

export async function runBoardCommand(viewer: Viewer, sessionId: string, raw: unknown): Promise<void> {
  const command = boardCommandSchema.parse(raw);
  const ctx = await loadContext(viewer, sessionId);
  const db = createSupabaseAdminClient();
  const me = viewer.userId;

  const loadItem = async (id: string) => {
    const { data } = await db.from("board_items").select("*").eq("id", id).eq("session_id", sessionId).maybeSingle();
    // Item privado de outro jogador "não existe" para quem pergunta.
    if (!data || (data.author_id !== me && data.visibility === "private")) throw new GameError("not_found");
    return data;
  };

  switch (command.type) {
    case "pin": {
      if (!accessibleEvidence(ctx).has(command.evidenceId)) throw new GameError("evidence_unavailable");
      const { error } = await db.from("board_items").insert({
        session_id: sessionId,
        author_id: me,
        kind: "evidence",
        evidence_id: command.evidenceId,
        body: command.body ?? null,
        visibility: command.visibility,
        ...(await nextSlot(sessionId)),
      });
      if (error?.code === "23505") throw new GameError("already_shared");
      if (error) throw error;
      break;
    }
    case "note": {
      const { error } = await db.from("board_items").insert({
        session_id: sessionId,
        author_id: me,
        kind: "note",
        body: command.body,
        visibility: command.visibility,
        group_label: command.group ?? null,
        ...(await nextSlot(sessionId)),
      });
      if (error) throw error;
      break;
    }
    case "update": {
      const item = await loadItem(command.itemId);
      const mine = item.author_id === me;
      // Texto e visibilidade são do autor; organização (grupo, status, destaque, posição) é da dupla.
      if ((command.body !== undefined || command.visibility !== undefined) && !mine) throw new GameError("forbidden");
      if (command.body === null && item.kind === "note") throw new GameError("forbidden");
      const patch: ItemPatch = {};
      if (command.body !== undefined) patch.body = command.body;
      if (command.visibility !== undefined) patch.visibility = command.visibility;
      if (command.group !== undefined) patch.group_label = command.group;
      if (command.status !== undefined) patch.status = command.status;
      if (command.highlight !== undefined) patch.highlight = command.highlight;
      if (command.x !== undefined) patch.x = command.x;
      if (command.y !== undefined) patch.y = command.y;
      const { error } = await db.from("board_items").update(patch).eq("id", item.id);
      if (error) throw error;
      if (command.visibility === "private") {
        // Ao tornar privado, conexões com itens do parceiro deixam de fazer sentido.
        await db.from("board_links").delete().or(`from_item.eq.${item.id},to_item.eq.${item.id}`).neq("author_id", me);
      }
      break;
    }
    case "remove": {
      const item = await loadItem(command.itemId);
      if (item.author_id !== me) throw new GameError("forbidden");
      await db.from("board_items").delete().eq("id", item.id);
      break;
    }
    case "link": {
      const [from, to] = await Promise.all([loadItem(command.from), loadItem(command.to)]);
      const { error } = await db.from("board_links").insert({
        session_id: sessionId,
        author_id: me,
        from_item: from.id,
        to_item: to.id,
        label: command.label ?? null,
        status: command.status ?? "hypothesis",
      });
      if (error?.code === "23505") throw new GameError("already_shared");
      if (error) throw error;
      break;
    }
    case "update_link":
    case "unlink": {
      const { data: link } = await db.from("board_links").select("*").eq("id", command.linkId).eq("session_id", sessionId).maybeSingle();
      if (!link) throw new GameError("not_found");
      await Promise.all([loadItem(link.from_item), loadItem(link.to_item)]);
      if (command.type === "unlink") {
        await db.from("board_links").delete().eq("id", link.id);
      } else {
        const patch: LinkPatch = {};
        if (command.label !== undefined) patch.label = command.label;
        if (command.status !== undefined) patch.status = command.status;
        await db.from("board_links").update(patch).eq("id", link.id);
      }
      break;
    }
  }
  await signal(ctx, "board_updated");
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
export const messageCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), body: text(1000), evidenceId: z.string().max(60).optional() }).strict(),
  z.object({ kind: z.literal("help"), puzzleId: z.string().max(60), body: text(300).optional() }).strict(),
]);

export async function getMessages(viewer: Viewer, sessionId: string): Promise<{ messages: MessageView[]; unread: number }> {
  const ctx = await loadContext(viewer, sessionId);
  const db = createSupabaseAdminClient();
  const [{ data: rows }, { data: read }] = await Promise.all([
    db.from("session_messages").select("*").eq("session_id", sessionId).order("created_at").limit(300),
    db.from("session_reads").select("last_read_at").eq("session_id", sessionId).eq("user_id", viewer.userId).maybeSingle(),
  ]);
  const access = accessibleEvidence(ctx);
  const puzzles = new Map(ctx.def.puzzles.map((p) => [p.id, p.title]));
  const lastRead = read ? new Date(read.last_read_at).getTime() : 0;

  const messages: MessageView[] = (rows ?? []).map((m) => {
    const ev = m.evidence_id ? access.get(m.evidence_id) : undefined;
    return {
      id: m.id,
      mine: m.author_id === viewer.userId,
      kind: m.kind as "text" | "help",
      body: m.body,
      evidence: m.evidence_id ? (ev ? { id: ev.id, title: ev.title } : { redacted: true }) : null,
      puzzle: m.puzzle_id && puzzles.has(m.puzzle_id) ? { id: m.puzzle_id, title: puzzles.get(m.puzzle_id)! } : null,
      at: m.created_at,
    };
  });
  const unread = (rows ?? []).filter((m) => m.author_id !== viewer.userId && new Date(m.created_at).getTime() > lastRead).length;
  return { messages, unread };
}

export async function sendMessage(viewer: Viewer, sessionId: string, raw: unknown): Promise<void> {
  const command = messageCommandSchema.parse(raw);
  const ctx = await loadContext(viewer, sessionId);
  const db = createSupabaseAdminClient();

  const { data: allowed } = await db.rpc("consume_rate_limit", { p_key: `chat:${viewer.userId}`, p_max: 60, p_window_seconds: 60 });
  if (allowed === false) throw new GameError("rate_limited");

  if (command.kind === "text") {
    if (command.evidenceId && !accessibleEvidence(ctx).has(command.evidenceId)) throw new GameError("evidence_unavailable");
    const { error } = await db.from("session_messages").insert({
      session_id: sessionId,
      author_id: viewer.userId,
      kind: "text",
      body: command.body,
      evidence_id: command.evidenceId ?? null,
    });
    if (error) throw error;
  } else {
    const view = projectView(ctx.def, ctx.session.state, ctx.role);
    if (!view.puzzles.some((p) => p.id === command.puzzleId && !p.solved)) throw new GameError("puzzle_unavailable");
    const { error } = await db.from("session_messages").insert({
      session_id: sessionId,
      author_id: viewer.userId,
      kind: "help",
      body: command.body ?? null,
      puzzle_id: command.puzzleId,
    });
    if (error) throw error;
  }
  await markRead(viewer, sessionId, ctx);
  await signal(ctx, "message_created");
}

export async function markRead(viewer: Viewer, sessionId: string, known?: PlayerContext): Promise<void> {
  if (!known) await loadContext(viewer, sessionId);
  const db = createSupabaseAdminClient();
  await db.from("session_reads").upsert({ session_id: sessionId, user_id: viewer.userId, last_read_at: new Date().toISOString() });
}

