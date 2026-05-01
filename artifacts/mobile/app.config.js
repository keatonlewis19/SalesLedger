// app.config.js is evaluated at build time by Metro/EAS, giving us access to
// ALL process.env variables (not just EXPO_PUBLIC_* ones). We read secrets here
// and expose them through `extra` so the app can retrieve them via expo-constants.
const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  "";

// Production API domain. Priority:
//  1. EXPO_PUBLIC_DOMAIN — set as an EAS env var for custom domains
//  2. REPLIT_DEV_DOMAIN  — available during local Replit dev
//  3. Hard-coded production domain as final fallback for EAS builds
const apiDomain =
  process.env.EXPO_PUBLIC_DOMAIN ||
  process.env.REPLIT_DEV_DOMAIN ||
  "salesledger.crmgroupinsurance.com";

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: "CRM Group Mobile",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mobile",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.crmgroupinsurance.salesledger",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.crmgroupinsurance.salesledger",
    },
    web: {
      favicon: "./assets/images/icon.png",
    },
    plugins: [
      [
        "expo-router",
        {
          origin: "https://replit.com/",
        },
      ],
      "expo-font",
      "expo-web-browser",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      clerkPublishableKey,
      apiDomain,
      eas: {
        projectId: "ae7709fa-fd91-434f-8730-e271defe25ee",
      },
    },
  },
};
