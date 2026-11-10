import { describe, expect, it } from "vitest";
import { seasonCatalogSchema, validateCatalogReferences, type SeasonCatalog } from "./catalog-schema";
import { loadSeasonCatalogs } from "../../scripts/lib/load-content";

const baseCase = {
  code: "001",
  title: "Caso",
  synopsis: "Sinopse",
  category: "Teste",
  difficulty: "easy",
  cover: "train",
} as const;

function season(cases: Record<string, unknown>[]): SeasonCatalog {
  return seasonCatalogSchema.parse({ id: "s99", number: 99, title: "Teste", cases });
}

describe("catálogo de temporadas", () => {
  it("o conteúdo versionado do repositório é válido", () => {
    const { seasons, problems } = loadSeasonCatalogs();
    expect(problems).toEqual([]);
    expect(seasons.length).toBeGreaterThan(0);
  });

  it("rejeita campos desconhecidos (evita erro de digitação silencioso)", () => {
    expect(() => season([{ ...baseCase, id: "aa", tittle: "x" }])).toThrow();
  });

  it("rejeita ids e códigos duplicados", () => {
    expect(() => season([{ ...baseCase, id: "aa" }, { ...baseCase, id: "aa", code: "002" }])).toThrow(/id duplicado/);
    expect(() => season([{ ...baseCase, id: "aa" }, { ...baseCase, id: "bb" }])).toThrow(/código duplicado/);
  });

  it("detecta requisito inexistente", () => {
    const s = season([{ ...baseCase, id: "aa", unlockRequires: ["fantasma"] }]);
    expect(validateCatalogReferences([s])).toContain("aa exige fantasma, que não existe");
  });

  it("detecta ciclo de desbloqueio", () => {
    const s = season([
      { ...baseCase, id: "aa", unlockRequires: ["bb"] },
      { ...baseCase, id: "bb", code: "002", unlockRequires: ["aa"] },
    ]);
    expect(validateCatalogReferences([s]).some((p) => p.startsWith("ciclo de desbloqueio"))).toBe(true);
  });
});
