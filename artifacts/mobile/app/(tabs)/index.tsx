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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useGetSales, useGetMe } from "@workspace/api-client-react";

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
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const { data: me, isLoading: meLoading } = useGetMe();
  const {
    data: salesData,
    isLoading: salesLoading,
    refetch,
    isRefetching,
  } = useGetSales();

  const sales = salesData ?? [];
  const mySales = me ? sales.filter((s) => s.agent_id === me.id) : sales;

  const totalSales = mySales.length;
  const paidSales = mySales.filter((s) => s.paid).length;
  const unpaidSales = totalSales - paidSales;
  const totalCommission = mySales.reduce((sum, s) => sum + (s.commission ?? 0), 0);
  const pendingCommission = mySales.filter((s) => !s.paid).reduce((sum, s) => sum + (s.commission ?? 0), 0);

  const isLoading = meLoading || salesLoading;

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingTop: insets.top + webTopInset + 8,
      paddingBottom: insets.bottom + webBottomInset + 100,
      paddingHorizontal: 16,
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
    recentDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    recentInfo: {
      flex: 1,
      gap: 2,
    },
    recentClient: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    recentMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    recentCommission: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
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
    .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())
    .slice(0, 5);

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
      <View style={s.header}>
        <Text style={s.greeting}>
          {me ? `Hello, ${me.first_name ?? "Agent"}` : "Dashboard"}
        </Text>
        <Text style={s.week}>{getWeekLabel()}</Text>
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
            label="Commission"
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
            <Text style={s.emptyText}>No sales yet</Text>
            <Text style={s.emptySubText}>Tap the + tab to log your first sale</Text>
          </View>
        ) : (
          recentSales.map((sale) => (
            <View key={sale.id} style={s.recentItem}>
              <View
                style={[
                  s.recentDot,
                  { backgroundColor: sale.paid ? colors.success : colors.warning },
                ]}
              />
              <View style={s.recentInfo}>
                <Text style={s.recentClient}>{sale.client_name}</Text>
                <Text style={s.recentMeta}>
                  {sale.carrier} · {sale.plan_type} ·{" "}
                  {new Date(sale.sale_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <Text style={s.recentCommission}>{formatCurrency(sale.commission ?? 0)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
