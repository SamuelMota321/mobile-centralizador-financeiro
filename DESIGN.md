---
name: Coinciente (mobile)
description: Clareza para cuidar do que é seu.
colors:
  background: "#f2f6f4"
  surface: "#ffffff"
  surface-soft: "#f7faf8"
  foreground: "#14231e"
  body-text: "#354a42"
  muted: "#60736b"
  line: "#dbe5e0"
  input-border: "#7a8f86"
  primary: "#087a55"
  primary-pressed: "#056746"
  primary-tint: "#e6f1ec"
  on-primary: "#ffffff"
  positive: "#087a55"
  negative: "#b5473f"
  warning: "#a86512"
  info: "#2b6f89"
  dark-background: "#0c1714"
  dark-surface: "#13231e"
  dark-surface-soft: "#192c26"
  dark-foreground: "#edf6f2"
  dark-body-text: "#d0dfd8"
  dark-muted: "#a6b9b0"
  dark-line: "#284038"
  dark-input-border: "#5f7a70"
  dark-primary: "#55d6a4"
  dark-primary-pressed: "#7ce8bd"
  dark-primary-tint: "#1b3a30"
  dark-on-primary: "#07140f"
  dark-negative: "#ff9188"
  dark-warning: "#f3b866"
  dark-info: "#75c4df"
typography:
  page-title:
    fontFamily: "Manrope_700Bold"
    fontSize: "24px"
    lineHeight: "30px"
  section-title:
    fontFamily: "Manrope_700Bold"
    fontSize: "16px"
    lineHeight: "22px"
  body:
    fontFamily: "Manrope_500Medium"
    fontSize: "15px"
    lineHeight: "22px"
  body-small:
    fontFamily: "Manrope_500Medium"
    fontSize: "14px"
    lineHeight: "20px"
  label:
    fontFamily: "Manrope_600SemiBold"
    fontSize: "13px"
    lineHeight: "18px"
  micro:
    fontFamily: "Manrope_600SemiBold"
    fontSize: "12px"
    lineHeight: "16px"
  amount:
    fontFamily: "Manrope_800ExtraBold"
    fontSize: "15px"
    lineHeight: "20px"
  display:
    fontFamily: "Newsreader_400Regular"
    fontSize: "40px"
    lineHeight: "44px"
rounded:
  control: "10px"
  panel: "14px"
  frame: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "48px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "48px"
  list-group:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  tab-active:
    textColor: "{colors.primary}"
---

# Coinciente — sistema visual do app mobile

Mesma identidade do web e do Style Guide 1.0, traduzida para toque. Quando divergir do guia, o guia vence.

## Overview

App de tarefa curta ("Operate"): resumo primeiro, profundidade quando solicitada, como no exemplo mobile do guia. Cabeçalho com o símbolo Coinciente; conteúdo em grupos de lista; navegação por abas na parte de baixo (Movimentações, Contas, Categorias) com ícone e texto. Formulários ocupam a tela inteira, com "Cancelar" no topo e a ação principal fixa no rodapé, acima do teclado.

## Colors

Mesmos papéis do web: neutros esverdeados; verde só em ação, seleção e estado; positivo e negativo sempre com sinal ou texto. Tema claro e escuro seguem o sistema (`useColorScheme`); o escuro preserva temperatura e hierarquia, nunca preto puro.

## Typography

Manrope em toda a interface, um arquivo de fonte por peso (500, 600, 700, 800). Newsreader só na tela de entrada. Números em coluna usam `fontVariant: ["tabular-nums"]`. Tamanhos respeitam a fonte dinâmica do sistema (sem `allowFontScaling={false}`).

## Layout

Margem lateral de 20px; áreas seguras respeitadas no topo e no rodapé (notch e barra de gestos). Listas agrupadas em um único painel com divisórias; linhas com alvo de toque mínimo de 44px.

## Elevation & Depth

Sem sombras em conteúdo: grupos usam borda `line`. A barra de abas separa-se do conteúdo por uma borda superior.

## Shapes

10px em controles, 14px em grupos de lista, 20px em molduras. Pílula só em etiquetas de status.

## Components

Botão (primário, secundário, perigo, texto) com altura 48, retorno ao toque (opacidade e escala 0,98) e estado carregando; campo de texto com rótulo acima e erro abaixo; grupo de escolha exposto como rádio; etiqueta de status com ponto + texto; aviso com ícone; estado vazio que ensina; esqueleto durante o carregamento.

## Do's and Don'ts

Faça: mostrar data e origem; linguagem simples; ação nomeada em cada botão; erro com problema e recuperação. Evite: cor como único indicador; spinners no meio do conteúdo; texto sem acento; promessas financeiras; qualquer vocabulário de banco (enviar, Pix, pagar).
