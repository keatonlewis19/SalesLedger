import React from "react";
import { Platform, ScrollView, ScrollViewProps } from "react-native";

let KeyboardAwareScrollView: React.ComponentType<any> = ScrollView;
try {
  KeyboardAwareScrollView =
    require("react-native-keyboard-controller").KeyboardAwareScrollView;
} catch {
  // Native module not available (e.g. Expo Go) — fall back to ScrollView
}

type Props = ScrollViewProps & {
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
};

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
