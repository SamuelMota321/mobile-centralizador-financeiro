# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Platform Notes

App Expo (React Native) para Android e iOS com a mesma linguagem visual da marca em ambos; respeita as convenções de cada sistema (área segura, gesto de voltar, teclado, leitor de tela).

## Users

Pessoas de 20 a 30 anos começando a organizar a vida financeira, que usam vários bancos, cartões e corretoras e querem continuar no mesmo produto quando a análise ficar mais sofisticada. Cada pessoa é dona exclusiva de um espaço financeiro (tenant): não há membros, convites, perfis familiares nem administrador como ator do produto.

Situação de uso: registrar e revisar contas, movimentações e categorias; entender para onde vai o dinheiro; consultar o patrimônio. Tarefas curtas e recorrentes, em desktop e no celular.

## Product Purpose

O Coinciente (nome de exibição do Centralizador Financeiro Inteligente) reúne contas, movimentações, investimentos, bens e passivos em uma leitura única, rastreável e honesta. Sucesso é o usuário compreender a própria situação financeira sem retrabalho, sabendo sempre a origem e a data de referência de cada dado.

## Positioning

Organiza dados manuais, OFX e Pluggy Sandbox sem se comportar como banco: não movimenta dinheiro, não inicia pagamentos, não oferece Pix e não aconselha investimentos. Transferências são apenas registros contábeis entre contas do próprio usuário. Projeções são determinísticas, com premissas e aviso de incerteza.

## Operating Context

- MVP acadêmico (UCB, 2026) com dados exclusivamente fictícios; a evolução para SaaS exige controles adicionais.
- Autenticação individual via Auth0; web em Next.js e app mobile em Expo, independentes e sem código compartilhado.
- Fluxos atuais: contas manuais, movimentações (receita, despesa, transferência contábil), categorias pessoais, categorização manual e regras pessoais. Dashboard, OFX, Pluggy, investimentos, patrimônio e projeções chegam em sprints seguintes.

## Capabilities and Constraints

- Estados de categorização sempre explícitos: sem categoria, categorizada (definida pelo usuário ou aplicada por regra), incerta, não reconhecida, não se aplica (transferências).
- Nenhuma precisão de categorização é declarada sem conjunto de dados e evidência executada.
- Recursos inexistentes, de outro tenant ou arquivados recebem a mesma mensagem neutra.
- Fora do MVP: PDF, impostos, alertas, notificações, cobrança, dados reais, painel administrativo. Pix e movimentação de fundos estão permanentemente excluídos.
- Saldo atual e totais pertencem ao dashboard (sprint futura); a interface não calcula nem insinua saldos consolidados antes disso.

## Brand Commitments

- Identidade definida no Style Guide 1.0 (`documentacao-centralizador-financeiro/style-guide.html`): princípios de segurança institucional, clareza progressiva e tranquilidade.
- Nome "Coinciente" (Coin + consciente); símbolo de dois "C" concêntricos com ponto central (`src/ui/brand.tsx`). Não distorcer, contornar ou recolorir com cores de status.
- Voz humana no tom e precisa no conteúdo: explica sem infantilizar, orienta sem aconselhar. Nunca promete rentabilidade, enriquecimento ou "inteligência".
- Português do Brasil correto, com acentuação.

## Evidence on Hand

- Documentação do projeto: Visão 1.3, PRD 1.4, especificações e Style Guide 1.0, com mockups de produto (web e mobile) e dados fictícios de exemplo.
- Não há depoimentos, clientes, métricas de uso nem benchmarks; nada disso deve ser inventado.

## Product Principles

1. O essencial primeiro; detalhe, origem e data de referência a um passo de distância.
2. Todo dado mostra de onde vem e quando foi referenciado; ausência e defasagem ficam visíveis.
3. Estados incertos são estados normais e acionáveis, nunca erros escondidos.
4. Firme sem alarmismo: alertas diretos, com o problema e o caminho de recuperação.
5. Nada que pareça banco, promessa ou recomendação financeira.

## Accessibility & Inclusion

Contraste mínimo de 4,5:1 para texto normal; foco por teclado sempre visível; movimento respeita a preferência de redução do sistema; cor nunca é a única forma de transmitir estado (sinal, texto ou ícone acompanham).
