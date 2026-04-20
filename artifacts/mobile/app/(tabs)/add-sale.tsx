import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useCreateSale } from "@workspace/api-client-react";

const CARRIERS = [
  "Ambetter",
  "BlueCross BlueShield",
  "Cigna",
  "Humana",
  "Molina",
  "Oscar",
  "United Healthcare",
  "WellCare",
  "Other",
];

const PLAN_TYPES = ["HMO", "PPO", "EPO", "POS", "HSA", "Other"];

interface FieldProps {
  label: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
  required?: boolean;
}

function Field({ label, children, colors, required }: FieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          fontSize: 13,
          fontFamily: "Inter_600SemiBold",
          color: colors.mutedForeground,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
        {required ? " *" : ""}
      </Text>
      {children}
    </View>
  );
}

interface ChipGroupProps {
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  colors: ReturnType<typeof useColors>;
}

function ChipGroup({ options, selected, onSelect, colors }: ChipGroupProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.accent : colors.card,
            }}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                color: active ? colors.primary : colors.foreground,
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function todayISO() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

export default function AddSaleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const [clientName, setClientName] = useState("");
  const [carrier, setCarrier] = useState("");
  const [planType, setPlanType] = useState("");
  const [commission, setCommission] = useState("");
  const [saleDate, setSaleDate] = useState(todayISO());
  const [members, setMembers] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const { mutateAsync: createSale } = useCreateSale();

  const isValid =
    clientName.trim().length > 0 &&
    carrier.length > 0 &&
    planType.length > 0 &&
    !Number.isNaN(Number(commission)) &&
    commission.trim().length > 0;

  async function handleSubmit() {
    if (!isValid) return;
    try {
      setSubmitting(true);
      await createSale({
        data: {
          client_name: clientName.trim(),
          carrier,
          plan_type: planType,
          commission: Number(commission),
          sale_date: saleDate,
          members: Number(members) || 1,
        },
      });
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Sale Logged", "Your sale has been recorded successfully.", [
        {
          text: "OK",
          onPress: () => {
            setClientName("");
            setCarrier("");
            setPlanType("");
            setCommission("");
            setSaleDate(todayISO());
            setMembers("1");
            router.push("/(tabs)/history");
          },
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save sale";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

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
    pageTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    input: {
      height: 48,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    submitButton: {
      height: 52,
      borderRadius: colors.radius,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.primaryForeground,
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    rowField: {
      flex: 1,
      gap: 6,
    },
  });

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.pageTitle}>Log a Sale</Text>

      <Field label="Client Name" colors={colors} required>
        <TextInput
          style={s.input}
          value={clientName}
          onChangeText={setClientName}
          placeholder="Full name"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
          autoCapitalize="words"
          testID="client-name-input"
        />
      </Field>

      <Field label="Insurance Carrier" colors={colors} required>
        <ChipGroup
          options={CARRIERS}
          selected={carrier}
          onSelect={setCarrier}
          colors={colors}
        />
      </Field>

      <Field label="Plan Type" colors={colors} required>
        <ChipGroup
          options={PLAN_TYPES}
          selected={planType}
          onSelect={setPlanType}
          colors={colors}
        />
      </Field>

      <View style={s.row}>
        <View style={s.rowField}>
          <Field label="Commission ($)" colors={colors} required>
            <TextInput
              style={s.input}
              value={commission}
              onChangeText={setCommission}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              returnKeyType="next"
              testID="commission-input"
            />
          </Field>
        </View>
        <View style={s.rowField}>
          <Field label="Members" colors={colors}>
            <TextInput
              style={s.input}
              value={members}
              onChangeText={setMembers}
              placeholder="1"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              returnKeyType="done"
              testID="members-input"
            />
          </Field>
        </View>
      </View>

      <Field label="Sale Date" colors={colors} required>
        <TextInput
          style={s.input}
          value={saleDate}
          onChangeText={setSaleDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          testID="sale-date-input"
        />
      </Field>

      <TouchableOpacity
        style={[s.submitButton, (!isValid || submitting) && s.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || submitting}
        activeOpacity={0.8}
        testID="submit-sale-button"
      >
        {submitting ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="check" size={18} color={colors.primaryForeground} />
            <Text style={s.submitButtonText}>Save Sale</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
