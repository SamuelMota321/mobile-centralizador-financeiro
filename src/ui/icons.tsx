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

export const IconOverview = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M4 4v16h16M8 15l4-5 3 2 5-6" {...stroke(color)} />
  </Frame>
);

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

export const IconRules = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M4 6h9M4 12h6M4 18h9" {...stroke(color)} />
    <Path d="m15.5 10.5 2.2 2.2 3.8-4.2" {...stroke(color)} />
    <Path d="M16 18h4" {...stroke(color)} />
  </Frame>
);

// ---------- Ícones de categoria (mesmos desenhos do web) ----------

export const IconHome = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" {...stroke(color)} />
  </Frame>
);

export const IconCart = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1" {...stroke(color)} />
    <Circle cx="9.5" cy="19.5" r="1.2" {...stroke(color)} />
    <Circle cx="17" cy="19.5" r="1.2" {...stroke(color)} />
  </Frame>
);

export const IconUtensils = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M7 3v6a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-2.2 1.3-3 4-3 7v3h3" {...stroke(color)} />
  </Frame>
);

export const IconCar = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M5 16v-4l2-5h10l2 5v4M4 16h16M6 16v2.5M18 16v2.5M3.5 11H5M19 11h1.5" {...stroke(color)} />
    <Circle cx="8.5" cy="13" r="0.8" {...stroke(color)} />
    <Circle cx="15.5" cy="13" r="0.8" {...stroke(color)} />
  </Frame>
);

export const IconFlower = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M12 20c-4.4 0-7.5-3-7.5-6.5 2.6 0 5.2 1 7.5 3.3 2.3-2.3 4.9-3.3 7.5-3.3C19.5 17 16.4 20 12 20Z" {...stroke(color)} />
    <Path d="M12 16.8c-2-1.8-2.8-4.2-2.8-6.3C9.2 7.7 12 4 12 4s2.8 3.7 2.8 6.5c0 2.1-.8 4.5-2.8 6.3Z" {...stroke(color)} />
  </Frame>
);

export const IconHeartPulse = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M12 20s-7.5-4.5-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.5 12 20 12 20Z" {...stroke(color)} />
    <Path d="M7.5 12.5h2.2l1.3-2.2 2 4 1.3-1.8h2.2" {...stroke(color)} />
  </Frame>
);

export const IconTicket = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M3.5 7.5h17v3a1.8 1.8 0 0 0 0 3v3h-17v-3a1.8 1.8 0 0 0 0-3Z" {...stroke(color)} />
    <Path d="M14.5 7.5v1.5M14.5 11.25v1.5M14.5 15v1.5" {...stroke(color)} />
  </Frame>
);

export const IconGraduation = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M2.5 9.5 12 5l9.5 4.5L12 14Z" {...stroke(color)} />
    <Path d="M6.5 11.6V16c1.4 1.4 3.4 2.2 5.5 2.2s4.1-.8 5.5-2.2v-4.4M21.5 9.5V15" {...stroke(color)} />
  </Frame>
);

export const IconShoppingBag = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M5.5 8h13l-1 12h-11Z" {...stroke(color)} />
    <Path d="M9 10V7a3 3 0 0 1 6 0v3" {...stroke(color)} />
  </Frame>
);

export const IconReceipt = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z" {...stroke(color)} />
    <Path d="M9 8h6M9 11.5h6M9 15h3.5" {...stroke(color)} />
  </Frame>
);

export const IconBriefcase = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Rect x="3.5" y="7.5" width="17" height="12" rx="1.5" {...stroke(color)} />
    <Path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17M11 12.5v1.5h2v-1.5" {...stroke(color)} />
  </Frame>
);

export const IconStar = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8Z" {...stroke(color)} />
  </Frame>
);

// ---------- Ícones de interface ----------

export const IconPencil = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" {...stroke(color)} />
    <Path d="m14.5 7.5 3 3" {...stroke(color)} />
  </Frame>
);

export const IconSparkles = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M10 4.5 11.6 9 16 10.5 11.6 12 10 16.5 8.4 12 4 10.5 8.4 9Z" {...stroke(color)} />
    <Path d="M17.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8ZM17.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z" {...stroke(color)} />
  </Frame>
);

export const IconLightbulb = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M9 17.5h6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.5.4.8 1 .8 1.6v.5h5v-.5c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 12 3.5Z" {...stroke(color)} />
  </Frame>
);

export const IconPause = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M8.5 5.5v13M15.5 5.5v13" {...stroke(color)} />
  </Frame>
);

export const IconPlay = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M8 5.5v13l10.5-6.5Z" {...stroke(color)} />
  </Frame>
);

export const IconTrash = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" {...stroke(color)} />
  </Frame>
);

export const IconChevronDown = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="m6 9.5 6 6 6-6" {...stroke(color)} />
  </Frame>
);

export const IconChevronLeft = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="m14.5 6-6 6 6 6" {...stroke(color)} />
  </Frame>
);

export const IconChevronRight = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="m9.5 6 6 6-6 6" {...stroke(color)} />
  </Frame>
);

export const IconArrowRight = ({ size, color }: IconProps) => (
  <Frame size={size}>
    <Path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" {...stroke(color)} />
  </Frame>
);
