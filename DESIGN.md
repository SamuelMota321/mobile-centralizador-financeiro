---
name: Coinciente (mobile)
description: Clareza para cuidar do que é seu.
colors:
  background: "#f6f7f7"
  surface: "#ffffff"
  sunken: "#eff1f1"
  line: "#e2e5e5"
  line-strong: "#c9cfce"
  input-border: "#808a87"
  foreground: "#0f1413"
  text-secondary: "#434d4a"
  text-tertiary: "#5f6966"
  signal: "#087a55"
  signal-pressed: "#056746"
  on-signal: "#ffffff"
  positive: "#087a55"
  negative: "#b5473f"
  warning: "#9a5d0f"
  info: "#2b6f89"
  dark-background: "#0a0c0c"
  dark-surface: "#101313"
  dark-sunken: "#0d1010"
  dark-line: "#232828"
  dark-line-strong: "#323939"
  dark-input-border: "#5e6865"
  dark-foreground: "#e9edec"
  dark-text-secondary: "#aab3b0"
  dark-text-tertiary: "#87918e"
  dark-signal: "#55d6a4"
  dark-signal-pressed: "#7ce8bd"
  dark-on-signal: "#07140f"
  dark-negative: "#ff9188"
  dark-warning: "#f3b866"
  dark-info: "#75c4df"
typography:
  page-title:
    fontFamily: "Manrope_600SemiBold"
    fontSize: "22px"
    lineHeight: "28px"
  section-title:
    fontFamily: "Manrope_600SemiBold"
    fontSize: "16px"
    lineHeight: "22px"
  body:
    fontFamily: "Manrope_500Medium"
    fontSize: "15px"
    lineHeight: "22px"
  body-small:
    fontFamily: "Manrope_500Medium"
    fontSize: "13px"
    lineHeight: "18px"
  meta:
    fontFamily: "Manrope_500Medium"
    fontSize: "12px"
    lineHeight: "16px"
  label:
    fontFamily: "Manrope_600SemiBold"
    fontSize: "11px"
    lineHeight: "14px"
    letterSpacing: "0.66px"
    textTransform: "uppercase"
  amount:
    fontFamily: "Manrope_600SemiBold"
    fontSize: "15px"
    lineHeight: "20px"
  figure:
    fontFamily: "Manrope_600SemiBold"
    fontSize: "32px"
    lineHeight: "38px"
  display:
    fontFamily: "Newsreader_400Regular"
    fontSize: "40px"
    lineHeight: "44px"
rounded:
  marker: "1px"
  control: "8px"
  panel: "10px"
  sheet: "16px"
  avatar: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.control}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.line-strong}"
    rounded: "{rounded.control}"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.input-border}"
    rounded: "{rounded.control}"
    height: "48px"
  list-group:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.panel}"
  list-row:
    minHeight: "56px"
  tab-active:
    textColor: "{colors.foreground}"
    indicator: "2px {colors.signal}"
  marker:
    size: "6px"
    rounded: "{rounded.marker}"
    textColor: "{colors.text-secondary}"
---

# Coinciente — sistema visual do app mobile

> **Versão 2.0 aprovada; o código ainda segue a 1.x até a fase de aplicação.** Enquanto a aplicação não acontecer, `src/theme.ts` e os componentes de `src/ui/` continuam com a paleta esverdeada e as etiquetas em pílula. Telas novas devem nascer na 2.0.

Mesma identidade do web e do Style Guide 2.0 ("Instrumento de precisão"), traduzida para toque. Quando divergir do guia, o guia vence.

## Overview

App de tarefa curta ("Operate"): o número principal abre a tela e a lista vem logo abaixo, como no exemplo mobile do guia. Cabeçalho em `surface` com o símbolo e linha inferior; conteúdo em grupos de lista com divisórias; navegação por abas na parte de baixo (Movimentações, Contas, Categorias) com ícone e texto, e a aba atual marcada por uma linha `signal` de 2px. Formulários ocupam a tela inteira, com "Cancelar" no topo e a ação principal fixa no rodapé, acima do teclado. Planejado (ADR-003): tarefas curtas, como categorizar, passam a abrir em folha inferior; formulários longos continuam em tela cheia.

## Colors

Mesmos papéis e valores do web: neutros frios carregam a interface e o verde é **sinal** — só em ação primária, foco, aba ou item selecionado, marcador positivo e "+" de entradas. Positivo e negativo sempre com sinal ou texto. Tema claro e escuro seguem o sistema (`useColorScheme`); o escuro é quase preto e neutro, sem tom esverdeado. Contrastes medidos iguais aos do web (texto terciário ≥ 5,0:1; `signal` ≥ 4,7:1; `warning` ajustado para #9A5D0F, ≥ 4,69:1; borda de campo ≥ 3,14:1).

## Typography

Manrope em toda a interface, um arquivo de fonte por peso (500, 600, 700, 800), inclusive o número principal (`figure`, 32px/600). Newsreader só na tela de entrada. Todo número usa `fontVariant: ["tabular-nums"]` e fica alinhado à direita nas linhas. Rótulos de grupo e da faixa de números usam `label` (11px, caixa alta, espaçado); proveniência usa `meta` (12px). Tamanhos respeitam a fonte dinâmica do sistema (sem `allowFontScaling={false}`).

## Layout

Margem lateral de 16px; áreas seguras respeitadas no topo e no rodapé (notch e barra de gestos). Listas agrupadas em um único painel com divisórias de 1px; cada linha tem o título e o valor na primeira linha e a linha de metadados (ou o marcador) na segunda, com alvo de toque mínimo de 44pt e altura mínima de 56px. Grupos por dia com cabeçalho em `sunken`.

## Elevation & Depth

Sem sombras em conteúdo: grupos usam borda `line`. A barra de abas e o cabeçalho separam-se do conteúdo por uma linha de 1px. Só a folha inferior (planejada) e os alertas do sistema ficam por cima.

## Shapes

1px no marcador; 8px em controles; 10px em grupos de lista; 16px no topo da folha inferior; círculo só no avatar. Sem pílulas.

## Motion

Hoje: nenhuma animação. O retorno ao toque troca o estilo na hora, com valores diferentes por componente (botão 0,88 + escala 0,98; linhas 0,7; chips 0,85), e não há tratamento de redução de movimento. O que segue é planejado (F5 do Plano de Refatoração do Frontend, ADR-003 em `documentacao-centralizador-financeiro/docs/arquitetura/`) e adapta a seção Movimento do Style Guide 2.0 ao toque, com os mesmos nomes de token do web.

| Momento | Movimento | Token |
| --- | --- | --- |
| Toque | entrada no estado pressionado imediata; volta com spring; um único par de opacidade e escala para todo o app | `--motion-feedback` |
| Troca de aba | só a transição nativa das abas | — |
| Formulário longo, Regras, OFX, Conectar | transição nativa da pilha, com gesto de voltar | — |
| Tarefa curta (categorizar) | folha inferior que entra pela borda e acompanha o gesto | `--motion-reveal`, `--ease-drawer` |
| Carregando → conteúdo | esqueleto se dissolve no conteúdo | `--motion-reveal` |
| Ação concluída | haptic leve; nenhum em toque de rotina | — |

Não se movem: valores, troca de aba além do nativo, linhas de lista ao rolar. Com "Reduzir movimento" ativo no sistema (`useReducedMotion`), sai todo deslocamento e escala e ficam as mudanças de opacidade.

## Components

Botão (primário `signal`, secundário com contorno `line-strong`, perigo, texto) com altura 48 e estado carregando; campo de texto de 48 com borda `input-border`, rótulo acima e erro abaixo; grupo de escolha exposto como rádio; **marcador** (quadrado de 6px + texto, sem fundo) no lugar da etiqueta em pílula; **linha de metadados** (`Origem · ref. DD/MM · Conta`) abaixo do dado; aviso com ícone e borda à esquerda no tom do estado; estado vazio que ensina; esqueleto com a forma da lista.

## Do's and Don'ts

Faça: mostrar data e origem como linha de metadados; linguagem simples; ação nomeada em cada botão; erro com problema e recuperação; verde só como sinal. Evite: cor como único indicador; spinners no meio do conteúdo; pílulas e fundos verdes; sombras em conteúdo; texto sem acento; promessas financeiras; qualquer vocabulário de banco (enviar, Pix, pagar).
