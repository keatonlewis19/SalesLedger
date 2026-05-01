import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import {
  useCreateSale,
  useGetSettings,
  getListSalesQueryKey,
  getGetCurrentWeekSummaryQueryKey,
} from "@workspace/api-client-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOB_OPTIONS = [
  { value: "medicare", label: "Medicare", color: "#0d9488" },
  { value: "aca", label: "ACA", color: "#2563eb" },
  { value: "ancillary", label: "Ancillary", color: "#d97706" },
  { value: "life", label: "Life Insurance", color: "#7c3aed" },
  { value: "annuity", label: "Annuities", color: "#db2777" },
] as const;

type LobValue = typeof LOB_OPTIONS[number]["value"];

const SALES_TYPES: Record<LobValue, string[]> = {
  medicare: ["Medicare Advantage", "Medicare Supplement", "PDP", "DSNP", "MAPD"],
  aca: ["Bronze", "Silver", "Gold", "Platinum", "Catastrophic"],
  ancillary: ["Dental", "Vision", "DVH", "Hospital Indemnity", "Critical Illness", "Accident"],
  life: ["Term Life", "Whole Life", "IUL", "Final Expense", "Universal Life"],
  annuity: ["Fixed Annuity", "FIA", "MYGA", "Variable Annuity", "Income Annuity"],
};

const COMMISSION_TYPES_MEDICARE = ["Initial", "Renewal", "Prorated Renewal", "Monthly Renewal"];
const COMMISSION_TYPES_OTHER = ["Initial", "Renewal"];
const SALES_SOURCES = ["Company Provided", "Self-Generated"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontFamily: "Inter_600SemiBold",
        textTransform: "uppercase",
        letterSpacing: 0.7,
        color: "#5a6a8a",
        marginBottom: 7,
      }}
    >
      {label}
      {required && <Text style={{ color: "#ef4444" }}> *</Text>}
    </Text>
  );
}

interface ChipRowProps {
  options: readonly string[] | string[];
  selected: string;
  onSelect: (v: string) => void;
  activeColor?: string;
  colors: ReturnType<typeof useColors>;
}

function ChipRow({ options, selected, onSelect, activeColor, colors }: ChipRowProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(active ? "" : opt)}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: 13,
              paddingVertical: 8,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: active ? (activeColor ?? colors.primary) : colors.border,
              backgroundColor: active ? (activeColor ?? colors.primary) + "18" : colors.card,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                color: active ? (activeColor ?? colors.primary) : colors.foreground,
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

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  lineOfBusiness: LobValue;
  clientName: string;
  carrier: string;
  salesType: string;
  salesSource: string;
  commissionType: string;
  estimatedCommission: string;
  hra: string;
  soldDate: string;
  effectiveDate: string;
  metalTier: string;
  householdSize: string;
  comments: string;
}

function emptyForm(): FormState {
  return {
    lineOfBusiness: "medicare",
    clientName: "",
    carrier: "",
    salesType: "",
    salesSource: "",
    commissionType: "",
    estimatedCommission: "",
    hra: "",
    soldDate: todayISO(),
    effectiveDate: "",
    metalTier: "",
    householdSize: "",
    comments: "",
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddSaleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const createSale = useCreateSale();
  const { data: settings } = useGetSettings();

  const carrierNames: string[] = settings
    ? Object.keys((settings as any).carrierColors ?? {}).sort()
    : [];

  function fieldText(key: keyof FormState) {
    return (val: string) => setForm((p) => ({ ...p, [key]: val }));
  }

  function fieldPick(key: keyof FormState) {
    return (val: string) => setForm((p) => ({ ...p, [key]: val }));
  }

  const lob = form.lineOfBusiness;
  const lobOption = LOB_OPTIONS.find((o) => o.value === lob)!;
  const isMedicare = lob === "medicare";
  const isAca = lob === "aca";
  const commissionTypes = isMedicare ? COMMISSION_TYPES_MEDICARE : COMMISSION_TYPES_OTHER;

  const isValid =
    form.clientName.trim().length > 0 &&
    form.salesType.length > 0 &&
    form.soldDate.length >= 8;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    try {
      setSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await createSale.mutateAsync({
        data: {
          clientName: form.clientName.trim(),
          lineOfBusiness: lob,
          carrier: form.carrier.trim() || null,
          salesType: form.salesType,
          salesSource: form.salesSource || null,
          commissionType: isMedicare ? (form.commissionType || "") : "",
          estimatedCommission: form.estimatedCommission ? parseFloat(form.estimatedCommission) : null,
          hra: isMedicare && form.hra ? parseFloat(form.hra) : null,
          soldDate: form.soldDate,
          effectiveDate: form.effectiveDate || null,
          metalTier: isAca ? (form.metalTier || null) : null,
          householdSize: isAca && form.householdSize ? parseInt(form.householdSize, 10) : null,
          comments: form.comments.trim() || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetCurrentWeekSummaryQueryKey() });
      setSuccess(true);
      setForm(emptyForm());
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add sale. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15 as const,
    fontFamily: "Inter_400Regular" as const,
    color: colors.foreground,
    backgroundColor: colors.card,
  };

  const dividerStyle = {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  };

  const sectionLabelStyle = {
    fontSize: 11 as const,
    fontFamily: "Inter_700Bold" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: colors.mutedForeground,
    marginBottom: 16,
  };

  const totalPreview =
    (parseFloat(form.estimatedCommission) || 0) + (isMedicare ? (parseFloat(form.hra) || 0) : 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Fixed Header */}
      <View
        style={{
          paddingTop: insets.top + webTopInset + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.background,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontFamily: "Inter_700Bold",
            color: colors.foreground,
            letterSpacing: -0.3,
          }}
        >
          Log a Sale
        </Text>
        <Text
          style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}
        >
          Fields marked * are required
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Success Banner */}
        {success && (
          <View
            style={{
              backgroundColor: "#dcfce7",
              borderRadius: 12,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <Feather name="check-circle" size={18} color="#15803d" />
            <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#15803d" }}>
              Sale added successfully!
            </Text>
          </View>
        )}

        {/* ── Product Type ─────────────────────────────────────────────── */}
        <Text style={sectionLabelStyle}>Product Type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {LOB_OPTIONS.map((o) => {
            const active = lob === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                onPress={() =>
                  setForm((p) => ({
                    ...p,
                    lineOfBusiness: o.value,
                    salesType: "",
                    commissionType: "",
                    metalTier: "",
                    householdSize: "",
                  }))
                }
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  backgroundColor: active ? o.color : colors.card,
                  borderColor: active ? o.color : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Inter_600SemiBold",
                    color: active ? "#fff" : colors.foreground,
                  }}
                >
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={dividerStyle} />
        <Text style={sectionLabelStyle}>Client Info</Text>

        {/* Client Name */}
        <View style={{ marginBottom: 16 }}>
          <FieldLabel label="Client Name" required />
          <TextInput
            style={inputStyle}
            placeholder="Jane Doe"
            placeholderTextColor={colors.mutedForeground}
            value={form.clientName}
            onChangeText={fieldText("clientName")}
            autoCapitalize="words"
          />
        </View>

        {/* Plan / Sales Type */}
        <View style={{ marginBottom: 16 }}>
          <FieldLabel label="Plan / Product" required />
          <ChipRow
            options={SALES_TYPES[lob]}
            selected={form.salesType}
            onSelect={fieldPick("salesType")}
            activeColor={lobOption.color}
            colors={colors}
          />
        </View>

        {/* Carrier */}
        <View style={{ marginBottom: 16 }}>
          <FieldLabel label="Carrier" />
          {carrierNames.length > 0 ? (
            <ChipRow
              options={carrierNames}
              selected={form.carrier}
              onSelect={fieldPick("carrier")}
              activeColor={lobOption.color}
              colors={colors}
            />
          ) : (
            <TextInput
              style={inputStyle}
              placeholder="e.g. Aetna, Humana, BlueCross"
              placeholderTextColor={colors.mutedForeground}
              value={form.carrier}
              onChangeText={fieldText("carrier")}
              autoCapitalize="words"
            />
          )}
        </View>

        {/* ACA: Metal Tier + Household Size */}
        {isAca && (
          <>
            <View style={{ marginBottom: 16 }}>
              <FieldLabel label="Metal Tier" />
              <ChipRow
                options={["Catastrophic", "Bronze", "Silver", "Gold", "Platinum", "Non-Qualified"]}
                selected={form.metalTier}
                onSelect={fieldPick("metalTier")}
                activeColor={lobOption.color}
                colors={colors}
              />
            </View>
            <View style={{ marginBottom: 16 }}>
              <FieldLabel label="Household Size" />
              <TextInput
                style={inputStyle}
                placeholder="2"
                placeholderTextColor={colors.mutedForeground}
                value={form.householdSize}
                onChangeText={fieldText("householdSize")}
                keyboardType="number-pad"
              />
            </View>
          </>
        )}

        <View style={dividerStyle} />
        <Text style={sectionLabelStyle}>Commission</Text>

        {/* Sales Source */}
        <View style={{ marginBottom: 16 }}>
          <FieldLabel label="Sales Source" />
          <ChipRow
            options={SALES_SOURCES}
            selected={form.salesSource}
            onSelect={fieldPick("salesSource")}
            colors={colors}
          />
        </View>

        {/* Commission Type — Medicare only */}
        {isMedicare && (
          <View style={{ marginBottom: 16 }}>
            <FieldLabel label="Commission Type" />
            <ChipRow
              options={commissionTypes}
              selected={form.commissionType}
              onSelect={fieldPick("commissionType")}
              activeColor={lobOption.color}
              colors={colors}
            />
          </View>
        )}

        {/* Est. Commission + HRA */}
        {isMedicare ? (
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Est. Commission ($)" />
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                value={form.estimatedCommission}
                onChangeText={fieldText("estimatedCommission")}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="HRA ($)" />
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                value={form.hra}
                onChangeText={fieldText("hra")}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <FieldLabel label="Est. Commission ($)" />
            <TextInput
              style={inputStyle}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              value={form.estimatedCommission}
              onChangeText={fieldText("estimatedCommission")}
              keyboardType="decimal-pad"
            />
          </View>
        )}

        <View style={dividerStyle} />
        <Text style={sectionLabelStyle}>Dates</Text>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <FieldLabel label="Sold Date" required />
            <TextInput
              style={inputStyle}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              value={form.soldDate}
              onChangeText={fieldText("soldDate")}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel label="Effective Date" />
            <TextInput
              style={inputStyle}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              value={form.effectiveDate}
              onChangeText={fieldText("effectiveDate")}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <View style={dividerStyle} />
        <Text style={sectionLabelStyle}>Notes</Text>

        <View style={{ marginBottom: 16 }}>
          <FieldLabel label="Comments" />
          <TextInput
            style={[inputStyle, { minHeight: 80, textAlignVertical: "top", paddingTop: 12 }]}
            placeholder="Any additional notes…"
            placeholderTextColor={colors.mutedForeground}
            value={form.comments}
            onChangeText={fieldText("comments")}
            multiline
          />
        </View>

        {/* Preview card */}
        {form.clientName.trim().length > 0 && (
          <View
            style={{
              backgroundColor: lobOption.color + "12",
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: lobOption.color + "35",
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: lobOption.color, marginBottom: 2 }}
              >
                {lobOption.label}
              </Text>
              <Text
                style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}
                numberOfLines={1}
              >
                {form.clientName} · {form.salesType || "No plan selected"}
              </Text>
              {form.soldDate && (
                <Text
                  style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}
                >
                  {form.soldDate}
                </Text>
              )}
            </View>
            <Text
              style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: lobOption.color }}
            >
              {formatCurrency(totalPreview)}
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={{
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 4,
            flexDirection: "row",
            gap: 8,
            backgroundColor: isValid ? lobOption.color : colors.muted,
            opacity: isValid && !submitting ? 1 : 0.6,
          }}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" }}>
                Add Sale
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
