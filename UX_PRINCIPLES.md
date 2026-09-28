# Princípios de UX — Coinciente (mobile)

Consolida padrões de experiência já implementados no app, espalhados hoje entre `PRODUCT.md` e `DESIGN.md`.
Não redefine tokens visuais — isso é `DESIGN.md`. Fonte para as skills `ux-critic` e `visual-audit`, e para
qualquer tela nova.

## Hierarquia e ações

- Uma ação primária por tela, fixa no rodapé acima das abas (`AppScreen footer`) ou acima do teclado nos
  formulários (`FormScreen footer`) — nunca dentro do conteúdo que rola.
- Ações secundárias ficam como botão de texto (`variant="text"`), a destrutiva sempre em `variant="textDanger"`
  e por último na linha.
- Confirmação destrutiva usa `Alert.alert` nativo do sistema — é o padrão da plataforma, não recriar como
  modal próprio.

## Feedback

- Sucesso e erro de lista usam `Notice` inline com botão "Fechar" — não existe toast; é a escolha certa porque
  nem iOS nem Android têm um primitivo de toast comum aos dois.
- Toque responde na hora: `Pressable` com `pressed &&` (opacidade/escala), nunca só no `onPress` completo.
- Botão em envio mostra `ActivityIndicator` no lugar do rótulo (`loading` prop do `Button`), com
  `accessibilityState={{ busy }}`.

## Estados

| Estado | Como aparece |
|---|---|
| Carregando | `SkeletonList`, forma do conteúdo final |
| Vazio | `EmptyState`: ícone + título + texto + ação, quando existe próximo passo |
| Erro | `Notice tone="error"` com "Tentar de novo" |
| Sucesso | `Notice tone="success"`, some ao fechar ou ao recarregar |
| Categorização | Mesmos 5 estados explícitos do domínio, nunca inferidos |

## Divulgação progressiva

- Criar/editar abre em `FormScreen` de tela cheia — nunca um modal pequeno sobre a lista.
- Voltar do Android e "Cancelar" no topo do formulário fazem a mesma coisa: fecha sem salvar.

## Plataforma

- Tema claro/escuro segue `useColorScheme()` do sistema — **hoje travado em claro por `app.json`
  (`userInterfaceStyle: "light"`), correção pendente** (ver extensão de melhoria de interface do mobile).
- Fonte Dinâmica do sistema respeitada (sem `allowFontScaling={false}`).
- Alvo de toque mínimo 44pt em todo elemento interativo.

## Consistência

- Mesmo vocabulário de rótulo de estado (`categorizationLabel`, `StatusChip`) em toda tela.
- Data sempre DD/MM/AAAA digitada com máscara, nunca o seletor nativo do sistema.

## TODO

- [ ] Agrupamento por dia no histórico de Movimentações, destaque de linha recém-criada e bloco "Primeiros
      passos" — planejados em
      `documentacao-centralizador-financeiro/prompts/sprint2/dev2/dev-2-sprint-2-melhoria-interface-mobile.md`,
      ainda não implementados.
