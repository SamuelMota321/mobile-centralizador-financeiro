// Ícone de categoria escolhido pelo nome, porque a categoria é criada pelo usuário com nome
// livre e o backend não guarda ícone. Compara palavras inteiras, sem acento e sem caixa,
// na ordem da lista: a primeira regra que bate decide. Sem regra, ícone genérico.

export type CategoryIconKey =
  | "home"
  | "groceries"
  | "food"
  | "transport"
  | "care"
  | "health"
  | "leisure"
  | "education"
  | "shopping"
  | "bills"
  | "salary"
  | "income"
  | "generic";

const RULES: readonly (readonly [CategoryIconKey, readonly string[]])[] = [
  ["home", ["moradia", "casa", "aluguel", "condominio", "imovel", "lar"]],
  ["groceries", ["mercado", "supermercado", "feira", "hortifruti", "atacado"]],
  ["food", ["alimentacao", "comida", "restaurante", "padaria", "lanche", "lanchonete", "delivery"]],
  ["transport", ["transporte", "combustivel", "gasolina", "uber", "taxi", "onibus", "metro", "estacionamento", "carro", "veiculo"]],
  ["care", ["cuidados", "beleza", "higiene", "salao", "barbearia", "estetica"]],
  ["health", ["saude", "farmacia", "medico", "consulta", "exame", "hospital", "dentista", "remedio", "academia"]],
  ["leisure", ["lazer", "entretenimento", "cinema", "streaming", "viagem", "viagens", "passeio", "show", "jogos"]],
  ["education", ["educacao", "curso", "cursos", "escola", "faculdade", "livro", "livros", "estudo", "estudos"]],
  ["shopping", ["compras", "compra", "roupa", "roupas", "vestuario", "presente", "presentes"]],
  ["bills", ["contas", "conta", "luz", "energia", "agua", "internet", "telefone", "celular", "gas", "servicos"]],
  ["salary", ["salario", "salarios", "folha", "pagamento", "trabalho"]],
  ["income", ["renda", "receita", "receitas", "rendimento", "rendimentos", "freela", "freelance"]],
];

function words(name: string): Set<string> {
  return new Set(
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

export function categoryIconKey(name: string | null | undefined): CategoryIconKey {
  if (!name) return "generic";
  const tokens = words(name);
  return RULES.find(([, keywords]) => keywords.some((word) => tokens.has(word)))?.[0] ?? "generic";
}
