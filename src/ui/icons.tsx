import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// Icones proprios: traco de 1,75, cantos arredondados, significado literal. Sempre ao
// lado de um rotulo, por isso ficam fora da arvore de acessibilidade.

interface IconProps {
  size?: number;
  color: string;
}

function stroke(color: string) {
  return {
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
}

function Frame({ size = 22, children }: { size?: number; children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
    </Svg>
  );
}

export const IconMovements = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4m0 16-3.5-3.5M17 20l3.5-3.5" {...stroke(color)} />
  </Frame>
);

export const IconAccounts = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Rect x="3" y="6" width="18" height="13" rx="2.5" {...stroke(color)} />
    <Path d="M3 10h18M7 15h4" {...stroke(color)} />
  </Frame>
);

export const IconCategories = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path
      d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7a2 2 0 0 1 1.4.6l7.3 7.3a2 2 0 0 1 0 2.8l-6.7 6.7a2 2 0 0 1-2.8 0l-7.3-7.3a2 2 0 0 1-.6-1.4Z"
      {...stroke(color)}
    />
    <Circle cx="8.5" cy="8.5" r="1.4" {...stroke(color)} />
  </Frame>
);

export const IconPlus = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M12 5v14M5 12h14" {...stroke(color)} />
  </Frame>
);

export const IconClose = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="m6 6 12 12M18 6 6 18" {...stroke(color)} />
  </Frame>
);

export const IconSignOut = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 16l-4-4 4-4M6 12h10" {...stroke(color)} />
  </Frame>
);

export const IconInflow = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M17 7 7 17M7 9v8h8" {...stroke(color)} />
  </Frame>
);

export const IconOutflow = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M7 17 17 7M9 7h8v8" {...stroke(color)} />
  </Frame>
);

export const IconTransfer = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" {...stroke(color)} />
  </Frame>
);

export const IconCheck = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Circle cx="12" cy="12" r="8.5" {...stroke(color)} />
    <Path d="m8.5 12.2 2.3 2.3 4.7-4.9" {...stroke(color)} />
  </Frame>
);

export const IconInfo = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Circle cx="12" cy="12" r="8.5" {...stroke(color)} />
    <Path d="M12 11v5M12 8h.01" {...stroke(color)} />
  </Frame>
);

export const IconAlert = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" {...stroke(color)} />
    <Path d="M12 9.5v4M12 16.5h.01" {...stroke(color)} />
  </Frame>
);
