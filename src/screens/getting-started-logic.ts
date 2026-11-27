/** Passos em que cada um depende do anterior; regras ficam como sugestão final. */

export interface OnboardingState {
  hasAccount: boolean;
  hasMovement: boolean;
  hasCategory: boolean;
}

export type OnboardingTarget = "criar-conta" | "registrar-movimentacao" | "criar-categoria";

export interface OnboardingStep {
  key: OnboardingTarget;
  title: string;
  text: string;
  done: boolean;
  /** Ação do passo; só o passo atual a mostra como botão. */
  action: { label: string; target: OnboardingTarget };
}

/**
 * Estado dos três passos, ou null quando algum dado não carregou: sem contas, categorias ou
 * histórico conhecidos, a tela não adivinha (mostrar "crie uma conta" a quem já tem seria errado).
 */
export function onboardingState(input: {
  accounts: readonly unknown[] | null;
  categories: readonly unknown[] | null;
  historyTotal: number | null;
}): OnboardingState | null {
  if (input.accounts === null || input.categories === null || input.historyTotal === null) return null;
  return {
    hasAccount: input.accounts.length > 0,
    hasMovement: input.historyTotal > 0,
    hasCategory: input.categories.length > 0,
  };
}

export function onboardingSteps(state: OnboardingState): OnboardingStep[] {
  return [
    {
      key: "criar-conta",
      title: "Crie uma conta",
      text: "Corrente, poupança, cartão ou dinheiro. Toda movimentação pertence a uma conta.",
      done: state.hasAccount,
      action: { label: "Criar conta", target: "criar-conta" },
    },
    {
      key: "registrar-movimentacao",
      title: "Registre uma movimentação",
      text: "Receitas, despesas e transferências entre suas contas.",
      done: state.hasMovement,
      action: { label: "Registrar movimentação", target: "registrar-movimentacao" },
    },
    {
      key: "criar-categoria",
      title: "Crie suas categorias",
      text: "Comece pelas sugeridas ou crie as suas, com nomes que façam sentido para você.",
      done: state.hasCategory,
      action: { label: "Criar categoria", target: "criar-categoria" },
    },
  ];
}

export function isOnboardingComplete(state: OnboardingState): boolean {
  return state.hasAccount && state.hasMovement && state.hasCategory;
}

/** Índice do passo atual (o primeiro pendente); -1 quando tudo está feito. */
export function currentStepIndex(steps: readonly OnboardingStep[]): number {
  return steps.findIndex((step) => !step.done);
}
