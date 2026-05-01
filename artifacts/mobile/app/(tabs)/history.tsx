import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useViewMode } from "@/contexts/ViewModeContext";
import { useListSales, useGetMe } from "@workspace/api-client-react";
import type { SaleEntry } from "@workspace/api-client-react";

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

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

interface SaleItemProps {
  sale: SaleEntry;
  colors: ReturnType<typeof useColors>;
}

function SaleItem({ sale, colors }: SaleItemProps) {
  const lob = sale.lineOfBusiness ?? "medicare";
  const lobColor = LOB_COLORS[lob] ?? colors.primary;
  const lobLabel = LOB_LABELS[lob] ?? lob;

  const dateStr = sale.soldDate
    ? new Date(sale.soldDate + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const metaParts = [sale.carrier, sale.salesType].filter(Boolean);
  const commission = (sale.estimatedCommission ?? 0) + (sale.hra ?? 0);

  const s = StyleSheet.create({
    row: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: sale.paid ? colors.border : "#fde68a",
      padding: 14,
      marginBottom: 8,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    leftTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    indicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: sale.paid ? colors.success : colors.warning,
    },
    client: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    commission: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    meta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      flex: 1,
    },
    rightMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    lobBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: lobColor,
    },
    lobBadgeText: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    paidBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: sale.paid ? colors.accent : "#fef9ec",
    },
    paidBadgeText: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      color: sale.paid ? colors.primary : "#92400e",
    },
  });

  return (
    <View style={s.row}>
      <View style={s.topRow}>
        <View style={s.leftTop}>
          <View style={s.indicator} />
          <Text style={s.client} numberOfLines={1}>{sale.clientName}</Text>
        </View>
        <Text style={s.commission}>{formatCurrency(commission)}</Text>
      </View>
      <View style={s.bottomRow}>
        <Text style={s.meta} numberOfLines={1}>
          {metaParts.length > 0 ? metaParts.join(" · ") : lobLabel}
          {dateStr ? ` · ${dateStr}` : ""}
        </Text>
        <View style={s.rightMeta}>
          <View style={s.lobBadge}>
            <Text style={s.lobBadgeText}>{lobLabel}</Text>
          </View>
          <View style={s.paidBadge}>
            <Text style={s.paidBadgeText}>{sale.paid ? "Paid" : "Unpaid"}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

type FilterType = "all" | "paid" | "unpaid";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [filter, setFilter] = useState<FilterType>("all");

  const { data: me } = useGetMe();
  const { isViewingAsAgent } = useViewMode();
  const isAdmin = me?.role === "admin" && !isViewingAsAgent;

  const {
    data: salesData,
    isLoading,
    refetch,
    isRefetching,
  } = useListSales();

  const allMySales = salesData
    ? isAdmin
      ? salesData
      : salesData.filter((s) => s.userId === me?.clerkUserId)
    : [];

  const sorted = [...allMySales].sort(
    (a, b) => new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime()
  );

  const filtered =
    filter === "paid"
      ? sorted.filter((s) => s.paid)
      : filter === "unpaid"
      ? sorted.filter((s) => !s.paid)
      : sorted;

  const totalCommission = filtered.reduce(
    (sum, s) => sum + (s.estimatedCommission ?? 0) + (s.hra ?? 0),
    0
  );

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + webTopInset + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: colors.background,
      gap: 12,
    },
    title: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
    },
    filterChipText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
    },
    summary: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    summaryValue: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: insets.bottom + webBottomInset + 100,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
      gap: 10,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    loader: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "paid", label: "Paid" },
    { key: "unpaid", label: "Unpaid" },
  ];

  if (isLoading) {
    return (
      <View style={[s.container, s.loader]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Sales History</Text>
        <View style={s.filterRow}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  s.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.filterChipText,
                    { color: active ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.summary}>
          <Text style={s.summaryLabel}>
            {filtered.length} {filtered.length === 1 ? "sale" : "sales"}
          </Text>
          <Text style={s.summaryValue}>{formatCurrency(totalCommission)}</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <SaleItem sale={item} colors={colors} />}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="clipboard" size={40} color={colors.mutedForeground} />
            <Text style={s.emptyText}>No sales found</Text>
          </View>
        }
      />
    </View>
  );
}
