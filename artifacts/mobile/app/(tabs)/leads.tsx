import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
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
  useListLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useListLeadSources,
  useCreateLeadSource,
  getListLeadsQueryKey,
  UpdateLeadBodyStatus,
} from "@workspace/api-client-react";
import type { Lead } from "@workspace/api-client-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "new", label: "New", color: "#94a3b8" },
  { value: "in_comm", label: "In Comm", color: "#3b82f6" },
  { value: "appt_set", label: "Appt Set", color: "#f59e0b" },
  { value: "follow_up", label: "Follow Up", color: "#8b5cf6" },
  { value: "sold", label: "Sold", color: "#10b981" },
  { value: "lost", label: "Lost", color: "#ef4444" },
];

const LOB_OPTIONS = [
  { value: "all", label: "All", color: "#64748b" },
  { value: "medicare", label: "Medicare", color: "#0d9488" },
  { value: "aca", label: "ACA", color: "#2563eb" },
  { value: "ancillary", label: "Ancillary", color: "#d97706" },
  { value: "life", label: "Life", color: "#7c3aed" },
  { value: "annuity", label: "Annuity", color: "#db2777" },
] as const;

type LobFilter = typeof LOB_OPTIONS[number]["value"];
type LobValue = Exclude<LobFilter, "all">;

const LOB_ENTRY_OPTIONS = LOB_OPTIONS.filter((o) => o.value !== "all") as {
  value: LobValue;
  label: string;
  color: string;
}[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusMeta(value: string) {
  return STATUSES.find((s) => s.value === value) ?? { label: value, color: "#94a3b8" };
}

function lobMeta(value: string) {
  return LOB_OPTIONS.find((o) => o.value === value) ?? { label: value, color: "#64748b" };
}

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

// ─── Add Lead Form ────────────────────────────────────────────────────────────

interface AddLeadForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  lineOfBusiness: LobValue;
  leadOwnership: "Agency BOB" | "Self-Generated" | "";
  leadSourceId: string;
  state: string;
  county: string;
  zip: string;
  carrier: string;
  status: string;
  notes: string;
  enteredDate: string;
}

function emptyForm(): AddLeadForm {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    lineOfBusiness: "medicare",
    leadOwnership: "",
    leadSourceId: "",
    state: "",
    county: "",
    zip: "",
    carrier: "",
    status: "new",
    notes: "",
    enteredDate: todayISO(),
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LeadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const queryClient = useQueryClient();

  const { data: leadsData, isLoading, refetch, isRefetching } = useListLeads();
  const { mutateAsync: createLead } = useCreateLead();
  const { mutateAsync: updateLead } = useUpdateLead();
  const { mutateAsync: deleteLead } = useDeleteLead();
  const { data: leadSourcesData = [], refetch: refetchSources } = useListLeadSources();
  const { mutateAsync: createLeadSource } = useCreateLeadSource();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddLeadForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [addingNewSource, setAddingNewSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [statusPickLead, setStatusPickLead] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLob, setFilterLob] = useState<LobFilter>("all");

  // Exclude auto-created shadow leads (created from sale entry, not pipeline)
  const realLeads = (leadsData ?? []).filter(
    (l) => (l as any).leadOwnership !== "sale_entry"
  );

  // Apply LOB + status filters
  const filtered = realLeads.filter((l) => {
    const lobMatch = filterLob === "all" || l.lineOfBusiness === filterLob;
    const statusMatch = filterStatus === "all" || l.status === filterStatus;
    return lobMatch && statusMatch;
  });

  const isFormValid = form.firstName.trim().length > 0;

  function field<K extends keyof AddLeadForm>(key: K) {
    return (val: AddLeadForm[K]) => setForm((p) => ({ ...p, [key]: val }));
  }

  function fieldText(key: keyof AddLeadForm) {
    return (val: string) => setForm((p) => ({ ...p, [key]: val }));
  }

  async function handleSubmit() {
    if (!isFormValid) return;
    try {
      setSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await createLead({
        data: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          leadOwnership: (form.leadOwnership || null) as "Agency BOB" | "Self-Generated" | null | undefined,
          leadSourceId: form.leadSourceId ? parseInt(form.leadSourceId) : null,
          state: form.state.trim() || null,
          county: form.county.trim() || null,
          zip: form.zip.trim() || null,
          carrier: form.carrier.trim() || undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
          enteredDate: form.enteredDate || todayISO(),
          lineOfBusiness: form.lineOfBusiness,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      setForm(emptyForm());
      setShowAdd(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(leadId: number, newStatus: string) {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateLead({ id: leadId, data: { status: newStatus as typeof UpdateLeadBodyStatus[keyof typeof UpdateLeadBodyStatus] } });
      await queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update status");
    } finally {
      setStatusPickLead(null);
    }
  }

  async function handleDelete(lead: Lead) {
    Alert.alert(
      "Delete Lead",
      `Remove ${lead.firstName}${lead.lastName ? " " + lead.lastName : ""} from the pipeline?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await deleteLead({ id: lead.id });
              await queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to delete lead");
            }
          },
        },
      ]
    );
  }

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top + webTopInset,
      paddingBottom: insets.bottom + webBottomInset,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
    },
    title: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: -0.3,
    },
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    chip: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
    },
    chipText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
    },
    card: {
      marginHorizontal: 16,
      marginBottom: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    cardName: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
      marginRight: 8,
    },
    cardBadge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
    },
    cardBadgeText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    cardMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    lobTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    lobTagText: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    deleteBtn: {
      padding: 6,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 60,
      gap: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    modal: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: insets.bottom + 24,
      maxHeight: "92%",
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 20,
    },
    label: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      backgroundColor: colors.card,
      marginBottom: 14,
    },
    chipPicker: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 14,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 4,
    },
    submitText: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    statusModal: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    statusSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: insets.bottom + 24,
      gap: 10,
    },
    statusSheetTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 4,
    },
    statusOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });

  function PickChip({
    options,
    selected,
    onSelect,
    color,
  }: {
    options: { value: string; label: string; color?: string }[];
    selected: string;
    onSelect: (v: string) => void;
    color?: string;
  }) {
    return (
      <View style={s.chipPicker}>
        {options.map((opt) => {
          const active = selected === opt.value;
          const activeColor = opt.color ?? color ?? colors.primary;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                s.chip,
                {
                  backgroundColor: active ? activeColor : colors.card,
                  borderColor: active ? activeColor : colors.border,
                },
              ]}
              onPress={() => onSelect(active ? "" : opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  const countByLob = (lob: string) =>
    lob === "all"
      ? realLeads.length
      : realLeads.filter((l) => l.lineOfBusiness === lob).length;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Pipeline</Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
            {realLeads.length} total leads
          </Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* LOB filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}
      >
        {LOB_OPTIONS.map((o) => {
          const active = filterLob === o.value;
          const count = countByLob(o.value);
          return (
            <TouchableOpacity
              key={o.value}
              style={[
                s.chip,
                {
                  backgroundColor: active ? o.color : colors.card,
                  borderColor: active ? o.color : colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                },
              ]}
              onPress={() => setFilterLob(o.value)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, { color: active ? "#fff" : colors.foreground }]}>
                {o.label}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                  color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground,
                }}
              >
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
      >
        {[{ value: "all", label: "All statuses" }, ...STATUSES].map((st) => {
          const active = filterStatus === st.value;
          const stColor = (st as any).color ?? colors.primary;
          return (
            <TouchableOpacity
              key={st.value}
              style={[
                s.chip,
                {
                  backgroundColor: active ? stColor : colors.card,
                  borderColor: active ? stColor : colors.border,
                },
              ]}
              onPress={() => setFilterStatus(st.value)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lead List */}
      {isLoading ? (
        <View style={s.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Feather name="users" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>
                {filterStatus === "all" && filterLob === "all"
                  ? "No leads yet — tap + to add one"
                  : "No matching leads"}
              </Text>
            </View>
          ) : (
            filtered.map((lead) => {
              const meta = statusMeta(lead.status);
              const lob = lobMeta(lead.lineOfBusiness);
              const nameParts = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
              const metaParts = [lead.phone, lead.state && lead.county ? `${lead.county}, ${lead.state}` : (lead.state || lead.county)].filter(Boolean);
              const isSold = lead.status === "sold";

              return (
                <TouchableOpacity
                  key={lead.id}
                  style={s.card}
                  onPress={() => setStatusPickLead(lead.id)}
                  activeOpacity={0.75}
                >
                  <View style={s.cardRow}>
                    <Text style={s.cardName} numberOfLines={1}>{nameParts}</Text>
                    <TouchableOpacity
                      onPress={() => setStatusPickLead(lead.id)}
                      style={[s.cardBadge, { backgroundColor: meta.color }]}
                    >
                      <Text style={s.cardBadgeText}>{meta.label}</Text>
                    </TouchableOpacity>
                  </View>

                  {metaParts.length > 0 && (
                    <Text style={s.cardMeta} numberOfLines={1}>{metaParts.join(" · ")}</Text>
                  )}

                  {lead.carrier && (
                    <Text style={[s.cardMeta, { marginTop: 2 }]}>
                      {lead.carrier}
                      {lead.salesType ? ` · ${lead.salesType}` : ""}
                    </Text>
                  )}

                  {isSold && lead.revenue != null && lead.revenue > 0 && (
                    <Text style={[s.cardMeta, { marginTop: 2, color: colors.success, fontFamily: "Inter_600SemiBold" }]}>
                      {formatCurrency(lead.revenue)} commission
                    </Text>
                  )}

                  <View style={s.cardFooter}>
                    <View style={[s.lobTag, { backgroundColor: lob.color }]}>
                      <Text style={s.lobTagText}>{lob.label}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {lead.enteredDate && (
                        <Text style={[s.cardMeta, { fontSize: 11 }]}>
                          {new Date(lead.enteredDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={() => handleDelete(lead)}
                        style={s.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Status Picker Modal */}
      <Modal
        visible={statusPickLead !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setStatusPickLead(null)}
      >
        <View style={s.statusModal}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setStatusPickLead(null)} />
          <View style={s.statusSheet}>
            <Text style={s.statusSheetTitle}>Update Status</Text>
            {STATUSES.map((st) => (
              <TouchableOpacity
                key={st.value}
                style={s.statusOption}
                onPress={() => statusPickLead !== null && handleStatusChange(statusPickLead, st.value)}
                activeOpacity={0.75}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.color }} />
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                  {st.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.statusOption, { borderColor: "transparent", justifyContent: "center" }]}
              onPress={() => setStatusPickLead(null)}
            >
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Lead Sheet */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={s.modal} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAdd(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add Lead</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Product Type */}
              <Text style={s.label}>Product Type</Text>
              <PickChip
                options={LOB_ENTRY_OPTIONS}
                selected={form.lineOfBusiness}
                onSelect={(v) => setForm((p) => ({ ...p, lineOfBusiness: v as LobValue }))}
              />

              <Text style={s.label}>First Name *</Text>
              <TextInput
                style={s.input}
                placeholder="First name"
                placeholderTextColor={colors.mutedForeground}
                value={form.firstName}
                onChangeText={fieldText("firstName")}
                autoCapitalize="words"
              />

              <Text style={s.label}>Last Name</Text>
              <TextInput
                style={s.input}
                placeholder="Last name"
                placeholderTextColor={colors.mutedForeground}
                value={form.lastName}
                onChangeText={fieldText("lastName")}
                autoCapitalize="words"
              />

              <Text style={s.label}>Phone</Text>
              <TextInput
                style={s.input}
                placeholder="(555) 000-0000"
                placeholderTextColor={colors.mutedForeground}
                value={form.phone}
                onChangeText={fieldText("phone")}
                keyboardType="phone-pad"
              />

              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="jane@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={form.email}
                onChangeText={fieldText("email")}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.label}>Lead Ownership</Text>
              <PickChip
                options={[
                  { value: "Agency BOB", label: "Agency BOB" },
                  { value: "Self-Generated", label: "Self-Generated" },
                ]}
                selected={form.leadOwnership}
                onSelect={(v) => {
                  const next = v as AddLeadForm["leadOwnership"];
                  setForm((p) => ({
                    ...p,
                    leadOwnership: next,
                    leadSourceId: next !== "Self-Generated" ? "" : p.leadSourceId,
                  }));
                  if (v !== "Self-Generated") { setAddingNewSource(false); setNewSourceName(""); }
                }}
              />

              {form.leadOwnership === "Self-Generated" && (
                <>
                  <Text style={s.label}>Lead Source</Text>
                  {addingNewSource ? (
                    <View style={{ marginBottom: 14 }}>
                      <TextInput
                        style={[s.input, { marginBottom: 8 }]}
                        placeholder="New source name…"
                        placeholderTextColor={colors.mutedForeground}
                        value={newSourceName}
                        onChangeText={setNewSourceName}
                        autoFocus
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: colors.primary,
                            borderRadius: 8,
                            paddingVertical: 10,
                            alignItems: "center",
                          }}
                          onPress={async () => {
                            if (!newSourceName.trim()) return;
                            try {
                              const src = await createLeadSource({ data: { name: newSourceName.trim(), costPerLead: 0, isPaid: false } }) as any;
                              await refetchSources();
                              setForm((p) => ({ ...p, leadSourceId: String(src.id) }));
                              setAddingNewSource(false);
                              setNewSourceName("");
                            } catch (e: any) {
                              Alert.alert("Error", e?.message ?? "Failed to create source");
                            }
                          }}
                        >
                          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 8,
                            paddingVertical: 10,
                            alignItems: "center",
                          }}
                          onPress={() => { setAddingNewSource(false); setNewSourceName(""); }}
                        >
                          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ marginBottom: 14 }}>
                      <TouchableOpacity
                        style={[s.input, { justifyContent: "center" }]}
                        onPress={() => setShowSourcePicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: form.leadSourceId ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
                          {form.leadSourceId
                            ? (leadSourcesData as any[]).find((s: any) => String(s.id) === form.leadSourceId)?.name ?? "Select source…"
                            : "Select source…"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setAddingNewSource(true)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}
                      >
                        <Feather name="plus-circle" size={13} color={colors.primary} />
                        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.primary }}>
                          New source
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <Text style={s.label}>State</Text>
              <TextInput
                style={s.input}
                placeholder="FL"
                placeholderTextColor={colors.mutedForeground}
                value={form.state}
                onChangeText={fieldText("state")}
                autoCapitalize="characters"
              />

              <Text style={s.label}>County</Text>
              <TextInput
                style={s.input}
                placeholder="Miami-Dade"
                placeholderTextColor={colors.mutedForeground}
                value={form.county}
                onChangeText={fieldText("county")}
                autoCapitalize="words"
              />

              <Text style={s.label}>Zip</Text>
              <TextInput
                style={s.input}
                placeholder="33101"
                placeholderTextColor={colors.mutedForeground}
                value={form.zip}
                onChangeText={fieldText("zip")}
                keyboardType="number-pad"
              />

              <Text style={s.label}>Carrier</Text>
              <TextInput
                style={s.input}
                placeholder="e.g. Aetna"
                placeholderTextColor={colors.mutedForeground}
                value={form.carrier}
                onChangeText={fieldText("carrier")}
                autoCapitalize="words"
              />

              <Text style={s.label}>Initial Status</Text>
              <PickChip
                options={STATUSES}
                selected={form.status}
                onSelect={(v) => setForm((p) => ({ ...p, status: v }))}
              />

              <Text style={s.label}>Notes</Text>
              <TextInput
                style={[s.input, { minHeight: 72, textAlignVertical: "top" }]}
                placeholder="Any notes…"
                placeholderTextColor={colors.mutedForeground}
                value={form.notes}
                onChangeText={fieldText("notes")}
                multiline
              />

              <TouchableOpacity
                style={[s.submitBtn, { opacity: isFormValid && !submitting ? 1 : 0.5 }]}
                onPress={handleSubmit}
                disabled={!isFormValid || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.submitText}>Add Lead</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lead Source Picker (nested modal) */}
      <Modal visible={showSourcePicker} animationType="slide" transparent onRequestClose={() => setShowSourcePicker(false)}>
        <View style={s.statusModal}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSourcePicker(false)} />
          <View style={[s.statusSheet, { gap: 0 }]}>
            <Text style={[s.statusSheetTitle, { marginBottom: 12 }]}>Select Lead Source</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {(leadSourcesData as any[]).map((src: any) => (
                <TouchableOpacity
                  key={src.id}
                  style={[s.statusOption, { marginBottom: 8 }]}
                  onPress={() => {
                    setForm((p) => ({ ...p, leadSourceId: String(src.id) }));
                    setShowSourcePicker(false);
                  }}
                >
                  <Feather name="tag" size={14} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                    {src.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {(leadSourcesData as any[]).length === 0 && (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingVertical: 20 }}>
                  No lead sources yet
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={{ paddingVertical: 14, alignItems: "center" }}
              onPress={() => setShowSourcePicker(false)}
            >
              <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
