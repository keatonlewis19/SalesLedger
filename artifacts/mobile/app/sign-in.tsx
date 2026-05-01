import { useOAuth } from "@clerk/clerk-expo";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startEmailFlow } = useOAuth({ strategy: "oauth_microsoft" });

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const redirectUrl = Linking.createURL("/");
      const { createdSessionId, setActive } = await startGoogleFlow({ redirectUrl });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [startGoogleFlow]);

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      <View style={s.top}>
        <View style={s.iconContainer}>
          <Image
            source={require("../assets/images/icon.png")}
            style={s.icon}
            resizeMode="contain"
          />
        </View>
        <Text style={s.title}>SalesLedger</Text>
        <Text style={s.subtitle}>Insurance Sales Portal</Text>
      </View>

      <View style={s.bottom}>
        {error ? (
          <View style={s.errorBadge}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[s.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.button, s.googleButton, loading && s.disabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.8}
          testID="sign-in-google"
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <>
              <Feather name="globe" size={18} color={colors.foreground} />
              <Text style={[s.buttonText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={s.legalText}>
          By signing in, you agree to your agency&apos;s terms and usage policies.
        </Text>
      </View>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  insets: { top: number; bottom: number }
) {
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top + webTopInset,
      paddingBottom: insets.bottom + webBottomInset,
      paddingHorizontal: 28,
      justifyContent: "space-between",
    },
    top: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    iconContainer: {
      width: 88,
      height: 88,
      borderRadius: 22,
      overflow: "hidden",
      marginBottom: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
    icon: {
      width: 88,
      height: 88,
    },
    title: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      letterSpacing: 0.2,
    },
    bottom: {
      gap: 12,
      paddingBottom: 8,
    },
    button: {
      height: 52,
      borderRadius: colors.radius,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    googleButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    disabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    errorBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#fef2f2",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    errorText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      flex: 1,
    },
    legalText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 18,
    },
  });
}
