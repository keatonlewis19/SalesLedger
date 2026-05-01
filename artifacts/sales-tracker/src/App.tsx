import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import History from "@/pages/history";
import SettingsPage from "@/pages/settings";
import TeamPage from "@/pages/team";
import LandingPage from "@/pages/landing";
import LeadsPage from "@/pages/leads";
import MetricsPage from "@/pages/metrics";
import AdminSalesPage from "@/pages/admin-sales";
import CallsPage from "@/pages/calls";
import { BrandingProvider } from "@/contexts/branding";
import { ViewModeProvider } from "@/contexts/view-mode";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#0d9488",
    colorBackground: "#f8fafc",
    colorInputBackground: "#ffffff",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    colorInputText: "#0f172a",
    colorNeutral: "#94a3b8",
    borderRadius: "0.75rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "15px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-xl border border-slate-200 rounded-2xl w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: "#0f172a", fontWeight: "700" },
    headerSubtitle: { color: "#64748b" },
    socialButtonsBlockButtonText: { color: "#0f172a" },
    formFieldLabel: { color: "#374151", fontWeight: "500" },
    footerActionLink: { color: "#0d9488" },
    footerActionText: { color: "#64748b" },
    dividerText: { color: "#94a3b8" },
    identityPreviewEditButton: { color: "#0d9488" },
    formFieldSuccessText: { color: "#059669" },
    alertText: { color: "#dc2626" },
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10 w-auto object-contain",
    socialButtonsBlockButton: "border border-slate-200 hover:bg-slate-50",
    formButtonPrimary: "bg-teal-600 hover:bg-teal-700 text-white rounded-lg",
    formFieldInput: "border-slate-200 rounded-lg focus:ring-teal-500 focus:border-teal-500",
    footerAction: "border-t border-slate-100 bg-slate-50/50",
    dividerLine: "bg-slate-200",
    alert: "border border-red-100 bg-red-50",
    otpCodeFieldInput: "border-slate-200 rounded-lg",
    formFieldRow: "mb-4",
    main: "p-2",
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
        />
      </div>
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
        />
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your agency account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join the CRM Group Insurance platform",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <BrandingProvider>
          <ViewModeProvider>
          <TooltipProvider>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/dashboard" component={() => <ProtectedRoute component={Home} />} />
              <Route path="/history" component={() => <ProtectedRoute component={History} />} />
              <Route path="/leads" component={() => <ProtectedRoute component={LeadsPage} />} />
              <Route path="/metrics" component={() => <ProtectedRoute component={MetricsPage} />} />
              <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
              <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
              <Route path="/admin-sales" component={() => <ProtectedRoute component={AdminSalesPage} />} />
              <Route path="/calls" component={() => <ProtectedRoute component={CallsPage} />} />
              <Route component={NotFound} />
            </Switch>
            <Toaster />
          </TooltipProvider>
          </ViewModeProvider>
        </BrandingProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
