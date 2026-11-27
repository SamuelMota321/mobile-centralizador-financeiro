import { StyleSheet, View } from "react-native";
import Svg, { Defs, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../theme";
import { VIEW_HEIGHT, WAVES, wavePath } from "./backdrop-paths";

/** Altura da decoração no topo da tela. */
export const BACKDROP_HEIGHT = 240;
/** Largura visível de cada onda, em períodos (a onda gerada tem 2): mostra um trecho, não a onda inteira. */
const VISIBLE_PERIODS = 1.25;
/** Deslocamento de cada camada (em períodos): as cristas nunca se alinham. */
const PHASE: Record<string, number> = { l1: 0, l2: 0.4, l3: 0.7 };
const FACTOR: Record<string, number> = { l1: 1, l2: 0.7, l3: 0.45 };

/**
 * Fundo decorativo do topo das telas (Style Guide 2.3, versão estática do mobile): três ondas
 * verdes em camadas e um brilho suave no canto. Fica atrás de tudo, sem tocar nem ser lido por
 * leitor de tela. Sem animação: nada a pausar, nenhum custo de bateria.
 *
 * Só no tema escuro: no claro o texto secundário já está em 4,63:1 sobre o fundo, e qualquer
 * verde por baixo o leva abaixo de 4,5:1 (scripts/deco-contrast.py). Sem `decoColor`, não desenha.
 */
export function Backdrop({ height = BACKDROP_HEIGHT }: { height?: number }) {
  const { colors } = useTheme();
  if (!colors.decoColor) return null;
  const color = colors.decoColor;
  const alpha = colors.decoAlpha;
  const width = WAVES[0].period * VISIBLE_PERIODS;

  return (
    <View style={[styles.box, { height }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${VIEW_HEIGHT}`} preserveAspectRatio="none">
        <Defs>
          {/* Some de cima para baixo: a decoração termina antes do conteúdo. */}
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.8" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <Mask id="mask" x="0" y="0" width={width} height={VIEW_HEIGHT} maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width={width} height={VIEW_HEIGHT} fill="url(#fade)" />
          </Mask>
          <LinearGradient id="wave" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id="glow" cx={width * 0.9} cy="10" r={width * 0.55} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity={alpha * 0.9} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G mask="url(#mask)">
          <Rect x="0" y="0" width={width} height={VIEW_HEIGHT} fill="url(#glow)" />
          {/* Espelhado na vertical: as ondas pendem do topo. */}
          <G transform={`matrix(1 0 0 -1 0 ${VIEW_HEIGHT})`}>
            {WAVES.map((wave) => (
              <G key={wave.id} transform={`translate(${-wave.period * PHASE[wave.id]} 0)`} opacity={alpha * FACTOR[wave.id]}>
                <Path d={wavePath(wave.period, wave.amplitude, wave.baseline)} fill="url(#wave)" />
              </G>
            ))}
          </G>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", top: 0, left: 0, right: 0 },
});
