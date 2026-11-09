import { describe, expect, it } from "vitest";
import { isAtLeast, onboardingStage, pathForStage } from "./onboarding";

const base = { profile: { codename: "Corvo" }, duo: { members: [1, 2] } };

describe("onboardingStage", () => {
  it("sem sessão é anônimo", () => {
    expect(onboardingStage(null)).toBe("anonymous");
  });

  it("exige codinome antes da dupla", () => {
    expect(onboardingStage({ ...base, profile: { codename: null }, duo: null })).toBe("profile");
  });

  it("sem dupla pede formação da dupla", () => {
    expect(onboardingStage({ ...base, duo: null })).toBe("duo");
  });

  it("dupla com um membro aguarda parceiro", () => {
    expect(onboardingStage({ ...base, duo: { members: [1] } })).toBe("partner");
  });

  it("dupla completa está pronta", () => {
    expect(onboardingStage(base)).toBe("ready");
  });
});

describe("isAtLeast / pathForStage", () => {
  it("compara etapas pela ordem do onboarding", () => {
    expect(isAtLeast("ready", "duo")).toBe(true);
    expect(isAtLeast("partner", "duo")).toBe(true);
    expect(isAtLeast("profile", "duo")).toBe(false);
    expect(isAtLeast("anonymous", "profile")).toBe(false);
  });

  it("mapeia cada etapa para sua rota", () => {
    expect(pathForStage("anonymous")).toBe("/entrar");
    expect(pathForStage("partner")).toBe("/dupla");
    expect(pathForStage("ready")).toBe("/central");
  });
});
