import React from "react";
import { NativeModules, Platform, ScrollView, ScrollViewProps } from "react-native";

let KeyboardAwareScrollView: React.ComponentType<any> = ScrollView;
if ("KeyboardController" in NativeModules) {
  try {
    KeyboardAwareScrollView =
      require("react-native-keyboard-controller").KeyboardAwareScrollView;
  } catch {
    // ignore — fall back to ScrollView
  }
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
