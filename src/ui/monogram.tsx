import { Text, View } from "react-native";
import { monogramInitials } from "../lib/monogram";
import { makeStyles, radius } from "../theme";

/** Iniciais em quadrado neutro no lugar do logo. Decorativo: o nome sempre aparece ao lado. */
export function Monogram({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.text}>{monogramInitials(text)}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.control,
    backgroundColor: c.surfaceSoft,
  },
  text: { fontFamily: "Manrope_700Bold", fontSize: 12, lineHeight: 16, color: c.bodyText, letterSpacing: 0.2 },
}));
