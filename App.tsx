import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { AccountsScreen } from "./src/screens/AccountsScreen";
import { SignInScreen } from "./src/screens/SignInScreen";
import { theme } from "./src/theme";

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={theme.consciencia} />
      </View>
    );
  }

  return status === "authenticated" ? <AccountsScreen /> : <SignInScreen />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.respiro,
  },
});
