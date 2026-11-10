import { describe, expect, it } from "vitest";
import { caseStatus, formatDuration } from "./case-status";

const none = { completed: new Set<string>(), inProgress: new Set<string>() };

describe("caseStatus", () => {
  const c1 = { id: "case-001", isPlayable: true, unlockRequires: [] };
  const c2 = { id: "case-002", isPlayable: true, unlockRequires: ["case-001"] };

  it("caso sem requisitos e jogável está disponível", () => {
    expect(caseStatus(c1, none)).toBe("available");
  });

  it("caso sem definição publicada está em preparação", () => {
    expect(caseStatus({ ...c1, isPlayable: false }, none)).toBe("in_preparation");
  });

  it("requisito não concluído bloqueia, mesmo se jogável", () => {
    expect(caseStatus(c2, none)).toBe("locked");
  });

  it("requisito concluído libera", () => {
    expect(caseStatus(c2, { ...none, completed: new Set(["case-001"]) })).toBe("available");
  });

  it("andamento e conclusão têm prioridade sobre o resto", () => {
    expect(caseStatus(c2, { ...none, inProgress: new Set(["case-002"]) })).toBe("in_progress");
    expect(caseStatus(c1, { ...none, completed: new Set(["case-001"]) })).toBe("completed");
  });
});

describe("formatDuration", () => {
  it("formata intervalos e valores únicos", () => {
    expect(formatDuration(20, 40)).toBe("20–40 min");
    expect(formatDuration(30, 30)).toBe("~30 min");
    expect(formatDuration(null, null)).toBeNull();
  });
});
