import { describe, expect, it } from "vitest";
import { currentStepIndex, isOnboardingComplete, onboardingState, onboardingSteps } from "./getting-started-logic";

describe("onboardingState", () => {
  it("lê o estado das contas, do histórico e das categorias", () => {
    expect(onboardingState({ accounts: [{}], categories: [], historyTotal: 0 })).toEqual({ hasAccount: true, hasMovement: false, hasCategory: false });
    expect(onboardingState({ accounts: [], categories: [{}], historyTotal: 3 })).toEqual({ hasAccount: false, hasMovement: true, hasCategory: true });
  });

  it("dado que não carregou desliga o bloco em vez de adivinhar", () => {
    expect(onboardingState({ accounts: null, categories: [], historyTotal: 0 })).toBeNull();
    expect(onboardingState({ accounts: [], categories: null, historyTotal: 0 })).toBeNull();
    expect(onboardingState({ accounts: [], categories: [], historyTotal: null })).toBeNull();
  });
});

describe("passos", () => {
  const nothing = { hasAccount: false, hasMovement: false, hasCategory: false };

  it("três passos, em ordem, com a ação de cada um", () => {
    const steps = onboardingSteps(nothing);
    expect(steps.map((s) => s.key)).toEqual(["criar-conta", "registrar-movimentacao", "criar-categoria"]);
    expect(steps.map((s) => s.action.target)).toEqual(["criar-conta", "registrar-movimentacao", "criar-categoria"]);
  });

  it("o passo atual é o primeiro pendente", () => {
    expect(currentStepIndex(onboardingSteps(nothing))).toBe(0);
    expect(currentStepIndex(onboardingSteps({ hasAccount: true, hasMovement: false, hasCategory: false }))).toBe(1);
    expect(currentStepIndex(onboardingSteps({ hasAccount: true, hasMovement: true, hasCategory: false }))).toBe(2);
  });

  it("completo quando os três estão feitos; aí o bloco some", () => {
    const done = { hasAccount: true, hasMovement: true, hasCategory: true };
    expect(isOnboardingComplete(done)).toBe(true);
    expect(currentStepIndex(onboardingSteps(done))).toBe(-1);
    expect(isOnboardingComplete({ ...done, hasCategory: false })).toBe(false);
  });
});
