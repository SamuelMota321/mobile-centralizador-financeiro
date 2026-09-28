# Definition of Done — telas (mobile)

Critério mínimo antes de considerar uma tela pronta. Curto de propósito; detalhe de cada item mora em
`UX_PRINCIPLES.md` e `DESIGN.md`, não aqui.

## UX

- [ ] Objetivo da tela claro no `AppScreen title`/`subtitle`
- [ ] Uma ação primária fixa no rodapé
- [ ] Loading, vazio, erro e sucesso implementados (não só o caminho feliz)
- [ ] Ação destrutiva confirmada com `Alert.alert`

## Visual

- [ ] Sem cor, radius ou tipografia fora de `theme.ts`/`DESIGN.md`
- [ ] Componente reaproveitado de `src/ui/` antes de criar um novo

## Responsivo

- [ ] Área segura respeitada no topo e no rodapé (`useSafeAreaInsets`)
- [ ] Alvo de toque mínimo 44pt
- [ ] Testado com Fonte Dinâmica grande (texto não corta nem sobrepõe)

## Acessibilidade

- [ ] `accessibilityRole`/`accessibilityLabel` em todo elemento interativo
- [ ] Estado (`busy`, `disabled`, `selected`) refletido em `accessibilityState`
- [ ] Cor nunca é o único sinal de estado

## Validação

- [ ] `pnpm typecheck && pnpm test` sem erro
- [ ] `npx expo export --platform android` sem erro
- [ ] `git diff --check` limpo
- [ ] Conferência em aparelho ou emulador quando a mudança é visual (sem automação neste ambiente)
