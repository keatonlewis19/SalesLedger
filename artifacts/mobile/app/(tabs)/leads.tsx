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

import { useColors } from "@/hooks/useColors";
import {
  useListLeads,
  useCreateLead,
  useUpdateLead,
} from "@workspace/api-client-react";

const STATUSES = [
  { value: "new", label: "New", color: "#94a3b8" },
  { value: "in_comm", label: "In Comm", color: "#3b82f6" },
  { value: "appt_set", label: "Appt Set", color: "#f59e0b" },
  { value: "follow_up", label: "Follow Up", color: "#8b5cf6" },
  { value: "sold", label: "Sold", color: "#10b981" },
  { value: "lost", label: "Lost", color: "#ef4444" },
];

function statusMeta(value: string) {
  return STATUSES.find((s) => s.value === value) ?? { label: value, color: "#94a3b8" };
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

interface AddLeadForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  leadOwnership: "Agency BOB" | "Self-Generated" | "";
  state: string;
  county: string;
  zip: string;
  carrier: string;
  status: string;
  notes: string;
  enteredDate: string;
}

const emptyForm = (): AddLeadForm => ({
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  leadOwnership: "",
  state: "",
  county: "",
  zip: "",
  carrier: "",
  status: "new",
  notes: "",
  enteredDate: todayISO(),
});

export default function LeadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const { data: leadsData, isLoading, refetch, isRefetching } = useListLeads();
  const { mutateAsync: createLead } = useCreateLead();
  const { mutateAsync: updateLead } = useUpdateLead();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddLeadForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [statusPickLead, setStatusPickLead] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const leads = (leadsData ?? []).filter(
    (l: any) => !l.lineOfBusiness || l.lineOfBusiness === "medicare"
  );

  const filtered =
    filterStatus === "all" ? leads : leads.filter((l: any) => l.status === filterStatus);

  const isFormValid = form.firstName.trim().length > 0;

  function field(key: keyof AddLeadForm) {
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
          state: form.state.trim() || null,
          county: form.county.trim() || null,
          zip: form.zip.trim() || null,
          carrier: form.carrier.trim() || undefined,
          status: form.status,
          notes: form.notes.trim() || undefined,
          enteredDate: form.enteredDate || todayISO(),
          lineOfBusiness: "medicare",
        },
      });
      await refetch();
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
      await updateLead({ id: String(leadId), data: { status: newStatus } });
      await refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update status");
    } finally {
      setStatusPickLead(null);
    }
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
      paddingTop: 24,
      paddingBottom: 16,
    },
    title: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    addBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    filterRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      gap: 8,
      paddingTop: 4,
      paddingBottom: 14,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
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
    },
    name: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
    },
    badgeText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    meta: {
      marginTop: 6,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
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
      maxHeight: "90%",
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
      fontSize: 12,
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
    statusPicker: {
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
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusOptionText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Leads</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8 }}>
        {[{ value: "all", label: "All" }, ...STATUSES].map((s_) => {
          const active = filterStatus === s_.value;
          return (
            <TouchableOpacity
              key={s_.value}
              style={[s.chip, {
                backgroundColor: active ? (s_.value === "all" ? colors.primary : (s_ as any).color ?? colors.primary) : colors.card,
                borderColor: active ? "transparent" : colors.border,
              }]}
              onPress={() => setFilterStatus(s_.value)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                {s_.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
                {filterStatus === "all" ? "No leads yet — tap + to add one" : `No ${statusMeta(filterStatus).label} leads`}
              </Text>
            </View>
          ) : (
            filtered.map((lead: any) => {
              const meta = statusMeta(lead.status);
              const parts = [lead.carrier, lead.phone].filter(Boolean);
              return (
                <TouchableOpacity
                  key={lead.id}
                  style={s.card}
                  onPress={() => setStatusPickLead(lead.id)}
                  activeOpacity={0.75}
                >
                  <View style={s.cardRow}>
                    <Text style={s.name} numberOfLines={1}>
                      {lead.firstName}{lead.lastName ? ` ${lead.lastName}` : ""}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setStatusPickLead(lead.id)}
                      style={[s.badge, { backgroundColor: meta.color }]}
                    >
                      <Text style={s.badgeText}>{meta.label}</Text>
                    </TouchableOpacity>
                  </View>
                  {parts.length > 0 && (
                    <Text style={s.meta}>{parts.join(" · ")}</Text>
                  )}
                  {lead.enteredDate && (
                    <Text style={s.meta}>Added {lead.enteredDate}</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add Lead bottom sheet */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={s.modal} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAdd(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Add Lead</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>First Name *</Text>
              <TextInput
                style={s.input}
                placeholder="First name"
                placeholderTextColor={colors.mutedForeground}
                value={form.firstName}
                onChangeText={field("firstName")}
                autoCapitalize="words"
              />

              <Text style={s.label}>Last Name</Text>
              <TextInput
                style={s.input}
                placeholder="Last name"
                placeholderTextColor={colors.mutedForeground}
                value={form.lastName}
                onChangeText={field("lastName")}
                autoCapitalize="words"
              />

              <Text style={s.label}>Phone</Text>
              <TextInput
                style={s.input}
                placeholder="(555) 000-0000"
                placeholderTextColor={colors.mutedForeground}
                value={form.phone}
                onChangeText={field("phone")}
                keyboardType="phone-pad"
              />

              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                placeholder="jane@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={form.email}
                onChangeText={field("email")}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={s.label}>Lead Ownership</Text>
              <View style={[s.statusPicker, { marginBottom: 12 }]}>
                {(["Agency BOB", "Self-Generated"] as const).map((opt) => {
                  const active = form.leadOwnership === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[s.badge, {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }]}
                      onPress={() => setForm((p) => ({ ...p, leadOwnership: active ? "" : opt }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.badgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>State</Text>
              <TextInput
                style={s.input}
                placeholder="FL"
                placeholderTextColor={colors.mutedForeground}
                value={form.state}
                onChangeText={field("state")}
                autoCapitalize="characters"
              />

              <Text style={s.label}>County</Text>
              <TextInput
                style={s.input}
                placeholder="Miami-Dade"
                placeholderTextColor={colors.mutedForeground}
                value={form.county}
                onChangeText={field("county")}
                autoCapitalize="words"
              />

              <Text style={s.label}>Zip</Text>
              <TextInput
                style={s.input}
                placeholder="33101"
                placeholderTextColor={colors.mutedForeground}
                value={form.zip}
                onChangeText={field("zip")}
                keyboardType="number-pad"
              />

              <Text style={s.label}>Status</Text>
              <View style={s.statusPicker}>
                {STATUSES.map((st) => {
                  const active = form.status === st.value;
                  return (
                    <TouchableOpacity
                      key={st.value}
                      style={[s.badge, {
                        backgroundColor: active ? st.color : colors.card,
                        borderWidth: 1,
                        borderColor: active ? st.color : colors.border,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }]}
                      onPress={() => setForm((p) => ({ ...p, status: st.value }))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.badgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>Notes</Text>
              <TextInput
                style={[s.input, { minHeight: 72, textAlignVertical: "top" }]}
                placeholder="Any notes…"
                placeholderTextColor={colors.mutedForeground}
                value={form.notes}
                onChangeText={field("notes")}
                multiline
              />

              <TouchableOpacity
                style={[s.submitBtn, { opacity: isFormValid && !submitting ? 1 : 0.5 }]}
                onPress={handleSubmit}
                disabled={!isFormValid || submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitText}>Add Lead</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Status change picker */}
      <Modal
        visible={statusPickLead !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setStatusPickLead(null)}
      >
        <TouchableOpacity style={s.statusModal} activeOpacity={1} onPress={() => setStatusPickLead(null)}>
          <View style={s.statusSheet}>
            <Text style={s.statusSheetTitle}>Change Status</Text>
            {STATUSES.map((st) => (
              <TouchableOpacity
                key={st.value}
                style={s.statusOption}
                onPress={() => statusPickLead !== null && handleStatusChange(statusPickLead, st.value)}
                activeOpacity={0.75}
              >
                <View style={[s.statusDot, { backgroundColor: st.color }]} />
                <Text style={s.statusOptionText}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
