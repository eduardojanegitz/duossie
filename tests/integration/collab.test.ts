import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CaseDefinition } from "@/engine/schema";
import type { Viewer } from "@/server/auth/viewer";
import { getBoard, getMessages, markRead, runBoardCommand, sendMessage } from "@/server/game/collab";
import { GameError, startInvestigation } from "@/server/game/service";
import { loadCases } from "../../scripts/lib/load-content";
import { adminClient, deleteTestUsers, signInAs, TEST_EMAILS } from "../support/supabase";

const def: CaseDefinition = loadCases().cases.find((c) => c.definition.id === "case-001")!.definition;
const startA = def.evidence.find((e) => e.visibleTo === "A" && !e.availableWhen)!;
const startB = def.evidence.find((e) => e.visibleTo === "B" && !e.availableWhen)!;

function viewerFor(userId: string, duo: Viewer["duo"]): Viewer {
  return { userId, email: null, profile: { id: userId, codename: "x" }, duo };
}

describe("quadro de evidências e chat", () => {
  let a: Viewer;
  let b: Viewer;
  let c: Viewer;
  let sessionId: string;

  beforeAll(async () => {
    await deleteTestUsers();
    const [sa, sb, sc] = await Promise.all([signInAs(TEST_EMAILS.a), signInAs(TEST_EMAILS.b), signInAs(TEST_EMAILS.c)]);
    const { data: duoId } = await sa.client.rpc("create_duo", { p_name: "Unidade Noturna" });
    const { data: invite } = await sa.client.rpc("create_duo_invite");
    await sb.client.rpc("join_duo", { p_code: invite![0]!.code });
    const duo = { id: duoId!, name: "Unidade Noturna", members: [{ id: sa.userId, codename: "Corvo" }, { id: sb.userId, codename: "Lince" }] };
    a = viewerFor(sa.userId, duo);
    b = viewerFor(sb.userId, duo);
    c = viewerFor(sc.userId, null);
    sessionId = await startInvestigation(a, "case-001", "A");
  });

  afterAll(async () => {
    await deleteTestUsers();
  });

  it("evidência exclusiva fixada no quadro compartilhado aparece tarjada para o parceiro", async () => {
    await runBoardCommand(a, sessionId, { type: "pin", evidenceId: startA.id, visibility: "shared", body: "Olhem a poltrona" });
    const boardA = await getBoard(a, sessionId);
    const boardB = await getBoard(b, sessionId);
    expect(boardA.items[0]).toMatchObject({ mine: true, redacted: false, evidence: { id: startA.id, title: startA.title } });
    expect(boardB.items[0]).toMatchObject({ mine: false, redacted: true, evidence: null, body: "Olhem a poltrona" });
    const json = JSON.stringify(boardB);
    expect(json).not.toContain(startA.id);
    expect(json).not.toContain(startA.title);
    expect(json).not.toContain(startA.summary);
  });

  it("item privado não aparece para o parceiro", async () => {
    await runBoardCommand(a, sessionId, { type: "note", body: "Palpite secreto", visibility: "private" });
    expect((await getBoard(b, sessionId)).items.some((i) => i.body === "Palpite secreto")).toBe(false);
    expect((await getBoard(a, sessionId)).items.some((i) => i.body === "Palpite secreto")).toBe(true);
  });

  it("não deixa fixar evidência do outro papel", async () => {
    await expect(runBoardCommand(a, sessionId, { type: "pin", evidenceId: startB.id, visibility: "shared" })).rejects.toThrow(
      new GameError("evidence_unavailable"),
    );
  });

  it("organização é da dupla; texto e remoção são do autor", async () => {
    await runBoardCommand(b, sessionId, { type: "note", body: "Hipótese do Lince", visibility: "shared" });
    const note = (await getBoard(a, sessionId)).items.find((i) => i.body === "Hipótese do Lince")!;
    await runBoardCommand(a, sessionId, { type: "update", itemId: note.id, status: "confirmed", group: "Horários", highlight: true });
    expect((await getBoard(b, sessionId)).items.find((i) => i.id === note.id)).toMatchObject({ status: "confirmed", group: "Horários", highlight: true });
    await expect(runBoardCommand(a, sessionId, { type: "update", itemId: note.id, body: "editado" })).rejects.toThrow(new GameError("forbidden"));
    await expect(runBoardCommand(a, sessionId, { type: "remove", itemId: note.id })).rejects.toThrow(new GameError("forbidden"));
  });

  it("item privado de outro jogador é inalcançável (nem por id)", async () => {
    const secret = (await getBoard(a, sessionId)).items.find((i) => i.body === "Palpite secreto")!;
    await expect(runBoardCommand(b, sessionId, { type: "update", itemId: secret.id, status: "contradiction" })).rejects.toThrow(new GameError("not_found"));
  });

  it("conexões aparecem para os dois; conexão com item privado só para o autor", async () => {
    const boardA = await getBoard(a, sessionId);
    const pinned = boardA.items.find((i) => i.kind === "evidence")!;
    const note = boardA.items.find((i) => i.body === "Hipótese do Lince")!;
    const secret = boardA.items.find((i) => i.body === "Palpite secreto")!;
    await runBoardCommand(a, sessionId, { type: "link", from: pinned.id, to: note.id, label: "mesmo horário", status: "contradiction" });
    await runBoardCommand(a, sessionId, { type: "link", from: secret.id, to: note.id });
    const linksB = (await getBoard(b, sessionId)).links;
    expect(linksB).toHaveLength(1);
    expect(linksB[0]).toMatchObject({ label: "mesmo horário", status: "contradiction" });
    expect((await getBoard(a, sessionId)).links).toHaveLength(2);
    await expect(runBoardCommand(b, sessionId, { type: "link", from: note.id, to: pinned.id })).rejects.toThrow(new GameError("already_shared"));
  });

  it("chat: evidência anexada aparece tarjada para quem não a tem; contagem de não lidas", async () => {
    await sendMessage(a, sessionId, { kind: "text", body: "Veja isto", evidenceId: startA.id });
    const forB = await getMessages(b, sessionId);
    expect(forB.unread).toBe(1);
    expect(forB.messages.at(-1)).toMatchObject({ mine: false, body: "Veja isto", evidence: { redacted: true } });
    expect(JSON.stringify(forB)).not.toContain(startA.id);
    expect((await getMessages(a, sessionId)).messages.at(-1)?.evidence).toEqual({ id: startA.id, title: startA.title });
    await markRead(b, sessionId);
    expect((await getMessages(b, sessionId)).unread).toBe(0);
  });

  it("chat: não anexa evidência alheia; pedido de ajuda só em enigma aberto", async () => {
    await expect(sendMessage(a, sessionId, { kind: "text", body: "x", evidenceId: startB.id })).rejects.toThrow(new GameError("evidence_unavailable"));
    await sendMessage(b, sessionId, { kind: "help", puzzleId: def.puzzles[0]!.id });
    expect((await getMessages(a, sessionId)).messages.at(-1)).toMatchObject({ kind: "help", puzzle: { id: def.puzzles[0]!.id } });
    await expect(sendMessage(b, sessionId, { kind: "help", puzzleId: def.puzzles.at(-1)!.id })).rejects.toThrow(new GameError("puzzle_unavailable"));
  });

  it("terceiro não acessa quadro nem chat", async () => {
    await expect(getBoard(c, sessionId)).rejects.toBeInstanceOf(GameError);
    await expect(getMessages(c, sessionId)).rejects.toBeInstanceOf(GameError);
    await expect(sendMessage(c, sessionId, { kind: "text", body: "oi" })).rejects.toBeInstanceOf(GameError);
  });

  it("as tabelas de quadro e chat não são acessíveis pela API do cliente", async () => {
    const { client } = await signInAs(TEST_EMAILS.a);
    for (const table of ["board_items", "board_links", "session_messages", "session_reads"] as const) {
      const { data } = await client.from(table).select("*");
      expect(data ?? []).toHaveLength(0);
    }
    const { count } = await adminClient().from("board_items").select("*", { count: "exact", head: true }).eq("session_id", sessionId);
    expect(count).toBeGreaterThan(0);
  });
});
