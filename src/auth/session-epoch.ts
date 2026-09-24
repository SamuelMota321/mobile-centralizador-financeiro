/**
 * Numera as sessões do app. Cada login, logout ou sessão restaurada avança o número.
 * Uma resposta que chega depois da troca de sessão carrega o número antigo e é
 * ignorada: um 401 atrasado do usuário A não pode encerrar a sessão do usuário B.
 */
export class SessionEpoch {
  private value = 0;

  advance(): number {
    this.value += 1;
    return this.value;
  }

  get current(): number {
    return this.value;
  }

  isCurrent(epoch: number): boolean {
    return epoch === this.value;
  }
}
