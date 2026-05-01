import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, NativeModules, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// KeyboardController requires a custom native build — not available in Expo Go.
// Check the native module registry before loading to avoid a crash.
const _NoopKeyboardProvider: React.ComponentType<{ children: React.ReactNode }> =
  ({ children }) => <>{children}</>;
let KeyboardProvider: React.ComponentType<{ children: React.ReactNode }> =
  _NoopKeyboardProvider;
if ("KeyboardController" in NativeModules) {
  try {
    KeyboardProvider = require("react-native-keyboard-controller").KeyboardProvider;
  } catch {
    // ignore — stay with noop
  }
}

// Point the shared API client at the correct domain for this environment.
// apiDomain is baked in at build time via app.config.js → extra.apiDomain,
// which reads EXPO_PUBLIC_DOMAIN (prod EAS) or REPLIT_DEV_DOMAIN (local dev).
const _apiDomain: string =
  Constants.expoConfig?.extra?.apiDomain ||
  process.env.EXPO_PUBLIC_DOMAIN ||
  "";
if (_apiDomain) {
  setBaseUrl(`https://${_apiDomain}`);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Read the Clerk publishable key baked in at build time via app.config.js extra.
// Falls back to the EXPO_PUBLIC_* env var so local dev still works.
const publishableKey: string =
  Constants.expoConfig?.extra?.clerkPublishableKey ||
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "";

// Wire the Clerk session token into every API request made by the generated
// React Query hooks. The getter is called lazily before each request.
function AuthTokenWirer({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [getToken]);

  return <>{children}</>;
}

function RootLayoutNav() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#0d8a8a" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="sign-in"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
        redirect={isSignedIn}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey}>
          <AuthTokenWirer>
            <QueryClientProvider client={queryClient}>
              <ViewModeProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </ViewModeProvider>
            </QueryClientProvider>
          </AuthTokenWirer>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
