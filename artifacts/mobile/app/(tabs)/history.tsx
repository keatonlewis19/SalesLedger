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
import { useListSales, useGetMe } from "@workspace/api-client-react";

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

interface SaleItemProps {
  sale: {
    id: number;
    client_name: string;
    carrier: string;
    plan_type: string;
    commission: number | null;
    sale_date: string;
    paid: boolean;
  };
  colors: ReturnType<typeof useColors>;
}

function SaleItem({ sale, colors }: SaleItemProps) {
  const s = StyleSheet.create({
    row: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: sale.paid ? colors.border : "#fde68a",
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    indicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: sale.paid ? colors.success : colors.warning,
      marginTop: 2,
    },
    info: {
      flex: 1,
      gap: 3,
    },
    client: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    meta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    right: {
      alignItems: "flex-end",
      gap: 4,
    },
    commission: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: sale.paid ? colors.accent : "#fef9ec",
    },
    badgeText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: sale.paid ? colors.primary : "#92400e",
    },
  });

  const dateStr = new Date(sale.sale_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View style={s.row}>
      <View style={s.indicator} />
      <View style={s.info}>
        <Text style={s.client}>{sale.client_name}</Text>
        <Text style={s.meta}>
          {sale.carrier} · {sale.plan_type} · {dateStr}
        </Text>
      </View>
      <View style={s.right}>
        <Text style={s.commission}>{formatCurrency(sale.commission ?? 0)}</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>{sale.paid ? "Paid" : "Unpaid"}</Text>
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
  const {
    data: salesData,
    isLoading,
    refetch,
    isRefetching,
  } = useListSales();

  const allMySales = salesData
    ? salesData.filter((s) => (me ? s.agent_id === me.id : true))
    : [];

  const sorted = [...allMySales].sort(
    (a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()
  );

  const filtered =
    filter === "paid"
      ? sorted.filter((s) => s.paid)
      : filter === "unpaid"
      ? sorted.filter((s) => !s.paid)
      : sorted;

  const totalCommission = filtered.reduce((sum, s) => sum + (s.commission ?? 0), 0);

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
        scrollEnabled={filtered.length > 0}
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
