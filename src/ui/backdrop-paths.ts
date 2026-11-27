// Ondas da decoração de fundo (Style Guide 2.3). Cada onda repete a cada `period` unidades e o
// SVG tem 2 períodos de largura: deslocar -50% (= 1 período) volta ao ponto de partida, então o
// laço da animação não tem emenda. Q + T desenham uma senoide suave.

export const VIEW_HEIGHT = 300;

export interface WaveSpec {
  id: "l1" | "l2" | "l3";
  period: number;
  amplitude: number;
  baseline: number;
}

/** Três camadas com períodos diferentes: as cristas nunca se alinham, e o movimento não parece mecânico. */
export const WAVES: readonly WaveSpec[] = [
  { id: "l1", period: 900, amplitude: 70, baseline: 120 },
  { id: "l2", period: 1300, amplitude: 90, baseline: 150 },
  { id: "l3", period: 1700, amplitude: 60, baseline: 90 },
];

export function wavePath(period: number, amplitude: number, baseline: number, height: number = VIEW_HEIGHT): string {
  let path = `M0,${baseline} Q${period / 4},${baseline - amplitude} ${period / 2},${baseline}`;
  for (let half = 2; half <= 4; half += 1) path += ` T${(half * period) / 2},${baseline}`;
  return `${path} V${height} H0 Z`;
}
