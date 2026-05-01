import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useListSales, useGetMe } from "@workspace/api-client-react";

const LOB_COLORS: Record<string, string> = {
  medicare: "#0d9488",
  aca: "#2563eb",
  ancillary: "#d97706",
  life: "#7c3aed",
  annuity: "#db2777",
};

const LOB_LABELS: Record<string, string> = {
  medicare: "Medicare",
  aca: "ACA",
  ancillary: "Ancillary",
  life: "Life",
  annuity: "Annuity",
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  iconColor?: string;
  colors: ReturnType<typeof useColors>;
}

function StatCard({ label, value, sub, icon, iconColor, colors }: StatCardProps) {
  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[cardStyles.iconWrap, { backgroundColor: colors.accent }]}>
        <Feather name={icon as never} size={18} color={iconColor ?? colors.primary} />
      </View>
      <Text style={[cardStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[cardStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {sub ? <Text style={[cardStyles.sub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    minWidth: 140,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function getWeekLabel() {
  const now = new Date();
  const day = now.getDay();
  const diffToFriday = (day - 5 + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diffToFriday);
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(friday)} – ${fmt(thursday)}`;
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const hPad = isTablet ? Math.max(24, (width - 720) / 2) : 16;
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const { data: me, isLoading: meLoading } = useGetMe();
  const { isViewingAsAgent, toggleViewMode } = useViewMode();
  const isActualAdmin = me?.role === "admin";
  const isAdmin = isActualAdmin && !isViewingAsAgent;

  const {
    data: salesData,
    isLoading: salesLoading,
    refetch,
    isRefetching,
  } = useListSales();

  const sales = salesData ?? [];
  const mySales = isAdmin
    ? sales
    : sales.filter((s) => s.userId === me?.clerkUserId);

  const totalSales = mySales.length;
  const paidSales = mySales.filter((s) => s.paid).length;
  const unpaidSales = totalSales - paidSales;
  const totalCommission = mySales.reduce((sum, s) => sum + (s.estimatedCommission ?? 0) + (s.hra ?? 0), 0);
  const pendingCommission = mySales
    .filter((s) => !s.paid)
    .reduce((sum, s) => sum + (s.estimatedCommission ?? 0) + (s.hra ?? 0), 0);

  const isLoading = meLoading || salesLoading;

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingTop: insets.top + webTopInset + 8,
      paddingBottom: insets.bottom + webBottomInset + 100,
      paddingHorizontal: hPad,
      gap: 20,
    },
    header: {
      gap: 2,
    },
    greeting: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    week: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    statsRow: {
      flexDirection: "row",
      gap: 12,
    },
    unpaidBanner: {
      backgroundColor: "#fef9ec",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#fde68a",
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    unpaidBannerText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: "#92400e",
      flex: 1,
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 32,
      alignItems: "center",
      gap: 8,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    emptySubText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    loader: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
    },
    recentItem: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    recentLeft: {
      flex: 1,
      gap: 4,
    },
    recentTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    recentClient: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    recentMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    recentRight: {
      alignItems: "flex-end",
      gap: 4,
    },
    recentCommission: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    lobBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    lobBadgeText: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    paidDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });

  if (isLoading) {
    return (
      <View style={[s.container, s.loader]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const recentSales = [...mySales]
    .sort((a, b) => new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime())
    .slice(0, 8);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      <View style={[s.header, { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>
            {me ? `Hello, ${me.fullName?.split(" ")[0] ?? "Agent"}` : "Dashboard"}
          </Text>
          <Text style={s.week}>{getWeekLabel()}</Text>
        </View>
        {isActualAdmin && (
          <TouchableOpacity
            onPress={toggleViewMode}
            style={{
              marginTop: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: isViewingAsAgent ? colors.accent : colors.primary + "20",
              borderWidth: 1,
              borderColor: isViewingAsAgent ? colors.border : colors.primary,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
            }}
            accessibilityRole="button"
          >
            <Feather
              name={isViewingAsAgent ? "user" : "shield"}
              size={11}
              color={isViewingAsAgent ? colors.mutedForeground : colors.primary}
            />
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_500Medium",
                color: isViewingAsAgent ? colors.mutedForeground : colors.primary,
              }}
            >
              {isViewingAsAgent ? "Agent view" : "Admin view"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {unpaidSales > 0 && (
        <View style={s.unpaidBanner}>
          <Feather name="alert-triangle" size={16} color="#d97706" />
          <Text style={s.unpaidBannerText}>
            {unpaidSales} {unpaidSales === 1 ? "sale" : "sales"} unpaid — {formatCurrency(pendingCommission)} pending
          </Text>
        </View>
      )}

      <View>
        <Text style={s.sectionTitle}>This Week</Text>
        <View style={s.statsRow}>
          <StatCard
            label="Sales"
            value={String(totalSales)}
            sub={`${paidSales} paid`}
            icon="trending-up"
            colors={colors}
          />
          <StatCard
            label="Est. Commission"
            value={formatCurrency(totalCommission)}
            sub={`${formatCurrency(pendingCommission)} pending`}
            icon="dollar-sign"
            iconColor={colors.success}
            colors={colors}
          />
        </View>
      </View>

      <View>
        <Text style={s.sectionTitle}>Recent Sales</Text>
        {recentSales.length === 0 ? (
          <View style={s.emptyCard}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>No sales this week</Text>
            <Text style={s.emptySubText}>Tap Add Sale to log your first sale</Text>
          </View>
        ) : (
          recentSales.map((sale) => {
            const lob = sale.lineOfBusiness ?? "medicare";
            const lobColor = LOB_COLORS[lob] ?? colors.primary;
            const lobLabel = LOB_LABELS[lob] ?? lob;
            const metaParts = [sale.carrier, sale.salesType].filter(Boolean);
            const dateStr = sale.soldDate
              ? new Date(sale.soldDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "";
            return (
              <View key={sale.id} style={s.recentItem}>
                <View style={s.recentLeft}>
                  <View style={s.recentTopRow}>
                    <View style={[s.paidDot, { backgroundColor: sale.paid ? colors.success : colors.warning }]} />
                    <Text style={s.recentClient} numberOfLines={1}>{sale.clientName}</Text>
                  </View>
                  <Text style={s.recentMeta} numberOfLines={1}>
                    {metaParts.length > 0 ? metaParts.join(" · ") : lobLabel}
                    {dateStr ? ` · ${dateStr}` : ""}
                  </Text>
                </View>
                <View style={s.recentRight}>
                  <Text style={s.recentCommission}>
                    {formatCurrency((sale.estimatedCommission ?? 0) + (sale.hra ?? 0))}
                  </Text>
                  <View style={[s.lobBadge, { backgroundColor: lobColor }]}>
                    <Text style={s.lobBadgeText}>{lobLabel}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
