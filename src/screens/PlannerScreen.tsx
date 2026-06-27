import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppContext } from "../AppContext";
import { Chip, getTheme, IconButton, PageHeader, Panel, Screen, WaitBadge } from "../components/ui";
import { PLAN_TEMPLATES, PlanTemplate } from "../data/planTemplates";
import { buildUsjPlan } from "../services/planner";
import { PlanOptions, PlanPace, Priority, SelectedAttraction, UsjPlan } from "../types";
import { formatMinuteOfDay, parseClock } from "../utils/time";

const PRIORITY_LABEL: Record<Priority, string> = {
  must: "絶対",
  high: "高め",
  normal: "通常",
};

const PACE_LABEL: Record<PlanPace, string> = {
  efficient: "効率",
  distance: "移動少なめ",
  balanced: "標準",
  family: "ゆったり",
};

const PACE_ICON: Record<PlanPace, React.ComponentProps<typeof Ionicons>["name"]> = {
  efficient: "flash",
  distance: "navigate",
  balanced: "walk",
  family: "happy",
};

export default function PlannerScreen() {
  const {
    colorMode,
    analyses,
    selectedAttractions,
    setSelectedAttractions,
    setAttractionPriority,
    toggleAttraction,
    planOptions,
    setPlanOptions,
    savePlan,
  } = useAppContext();
  const theme = getTheme(colorMode === "dark");
  const [generatedPlan, setGeneratedPlan] = useState<UsjPlan | null>(null);
  const [lastGenerationMs, setLastGenerationMs] = useState<number | null>(null);
  const [planName, setPlanName] = useState("USJプラン");
  const selectedIds = new Set(selectedAttractions.map((row) => row.attractionId));

  const selectedRows = useMemo(
    () => analyses.filter((row) => selectedIds.has(row.id)),
    [analyses, selectedIds],
  );

  const popularRows = analyses
    .filter((row) => row.currentStatus === "operating" || row.dataSource !== "baseline")
    .slice(0, 10);

  function generate(
    nextSelectedAttractions: SelectedAttraction[] = selectedAttractions,
    nextOptions: PlanOptions = planOptions,
  ) {
    const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    const plan = buildUsjPlan({
      selectedAttractions: nextSelectedAttractions,
      analyses,
      options: nextOptions,
    });
    const endedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    setGeneratedPlan(plan);
    setLastGenerationMs(Math.max(1, Math.round(endedAt - startedAt)));
  }

  function applyTemplate(template: PlanTemplate) {
    const nextOptions = { ...planOptions, ...template.options };
    setSelectedAttractions(template.selectedAttractions);
    setPlanOptions(nextOptions);
    setPlanName(template.label);
    generate(template.selectedAttractions, nextOptions);
  }

  function applyPace(pace: PlanPace) {
    const nextOptions = { ...planOptions, pace };
    setPlanOptions(nextOptions);
    if (generatedPlan) {
      generate(selectedAttractions, nextOptions);
    }
  }

  return (
    <Screen isDark={colorMode === "dark"}>
      <PageHeader
        eyebrow="Studio Route"
        title="プラン作成"
        subtitle={`${selectedAttractions.length}件選択中`}
        icon="map"
        theme={theme}
      />

      <Panel theme={theme}>
        <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>時間とペース</Text>
        <View style={localStyles.timeRow}>
          <View style={[localStyles.timeField, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[localStyles.inputLabel, { color: theme.colors.subtext }]}>開始</Text>
            <TextInput
              value={formatMinuteOfDay(planOptions.startMinute)}
              onChangeText={(value) =>
                setPlanOptions((current) => ({ ...current, startMinute: parseClock(value, current.startMinute) }))
              }
              style={[localStyles.timeInput, { color: theme.colors.text }]}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[localStyles.timeField, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[localStyles.inputLabel, { color: theme.colors.subtext }]}>終了</Text>
            <TextInput
              value={formatMinuteOfDay(planOptions.endMinute)}
              onChangeText={(value) =>
                setPlanOptions((current) => ({ ...current, endMinute: parseClock(value, current.endMinute) }))
              }
              style={[localStyles.timeInput, { color: theme.colors.text }]}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[localStyles.timeField, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[localStyles.inputLabel, { color: theme.colors.subtext }]}>ランチ</Text>
            <TextInput
              value={planOptions.lunchMinute === null ? "" : formatMinuteOfDay(planOptions.lunchMinute)}
              onChangeText={(value) =>
                setPlanOptions((current) => ({
                  ...current,
                  lunchMinute: value.trim() ? parseClock(value, current.lunchMinute ?? 12 * 60) : null,
                }))
              }
              style={[localStyles.timeInput, { color: theme.colors.text }]}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>
        <View style={localStyles.chips}>
          {(Object.keys(PACE_LABEL) as PlanPace[]).map((pace) => (
            <Chip
              key={pace}
              label={PACE_LABEL[pace]}
              active={planOptions.pace === pace}
              onPress={() => applyPace(pace)}
              theme={theme}
              icon={PACE_ICON[pace]}
            />
          ))}
        </View>
      </Panel>

      <Panel theme={theme}>
        <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>おすすめパターン</Text>
        <View style={localStyles.templateGrid}>
          {PLAN_TEMPLATES.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => applyTemplate(template)}
              style={[localStyles.templateButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Text style={[localStyles.templateTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {template.label}
              </Text>
              <Text style={[localStyles.templateDescription, { color: theme.colors.subtext }]} numberOfLines={2}>
                {template.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </Panel>

      <Panel theme={theme}>
        <View style={localStyles.panelHeader}>
          <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>選択中</Text>
          <IconButton
            icon="sparkles"
            label="生成"
            onPress={() => generate()}
            theme={theme}
            disabled={selectedAttractions.length === 0}
          />
        </View>

        {selectedRows.length === 0 ? (
          <View style={localStyles.empty}>
            <Ionicons name="add-circle-outline" size={30} color={theme.colors.muted} />
            <Text style={[localStyles.emptyText, { color: theme.colors.subtext }]}>待ち時間タブ、または下の候補から追加</Text>
          </View>
        ) : (
          <View style={localStyles.selectedList}>
            {selectedRows.map((row) => {
              const selected = selectedAttractions.find((item) => item.attractionId === row.id);
              return (
                <View key={row.id} style={[localStyles.selectedRow, { borderColor: theme.colors.border }]}>
                  <Pressable
                    onPress={() => toggleAttraction(row.id)}
                    style={[localStyles.removeButton, { backgroundColor: theme.colors.surfaceAlt }]}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.danger} />
                  </Pressable>
                  <View style={localStyles.selectedMain}>
                    <Text style={[localStyles.selectedName, { color: theme.colors.text }]} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={[localStyles.selectedMeta, { color: theme.colors.subtext }]} numberOfLines={1}>
                      {row.area} / {row.bestTimeLabel}
                    </Text>
                  </View>
                  <View style={localStyles.priorityRow}>
                    {(Object.keys(PRIORITY_LABEL) as Priority[]).map((priority) => (
                      <Pressable
                        key={priority}
                        onPress={() => setAttractionPriority(row.id, priority)}
                        style={[
                          localStyles.priorityButton,
                          {
                            backgroundColor:
                              selected?.priority === priority ? theme.colors.primary : theme.colors.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            localStyles.priorityText,
                            { color: selected?.priority === priority ? "#FFFFFF" : theme.colors.subtext },
                          ]}
                        >
                          {PRIORITY_LABEL[priority]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Panel>

      <Panel theme={theme}>
        <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>候補</Text>
        <View style={localStyles.candidateList}>
          {popularRows.map((row) => {
            const selected = selectedIds.has(row.id);
            return (
              <Pressable
                key={row.id}
                onPress={() => toggleAttraction(row.id)}
                style={[
                  localStyles.candidateRow,
                  {
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? `${theme.colors.primary}12` : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name={selected ? "checkmark-circle" : "add-circle-outline"}
                  size={22}
                  color={selected ? theme.colors.primary : theme.colors.muted}
                />
                <View style={localStyles.candidateMain}>
                  <Text style={[localStyles.candidateName, { color: theme.colors.text }]} numberOfLines={1}>
                    {row.name}
                  </Text>
                  <Text style={[localStyles.candidateMeta, { color: theme.colors.subtext }]} numberOfLines={1}>
                    {row.area}
                  </Text>
                </View>
                <WaitBadge waitMinutes={row.currentWaitMinutes} status={row.currentStatus} theme={theme} />
              </Pressable>
            );
          })}
        </View>
      </Panel>

      {generatedPlan ? (
        <Panel theme={theme}>
          <View style={localStyles.panelHeader}>
            <View>
              <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>生成結果</Text>
              <Text style={[localStyles.panelSub, { color: theme.colors.subtext }]}>
                {generatedPlan.items.filter((item) => item.type === "ride").length}件 / 待ち
                {generatedPlan.totalExpectedWaitMinutes}分 / 移動{generatedPlan.totalTravelMinutes}分
                {lastGenerationMs !== null ? ` / 生成${lastGenerationMs}ms` : ""}
              </Text>
            </View>
            <View style={localStyles.saveBox}>
              <TextInput
                value={planName}
                onChangeText={(value) => setPlanName(value.slice(0, 18))}
                style={[localStyles.nameInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
              />
              <IconButton
                icon="bookmark"
                label="保存"
                onPress={() => {
                  savePlan(planName, generatedPlan).catch(() => {});
                }}
                theme={theme}
              />
            </View>
          </View>

          <View style={localStyles.timeline}>
            {generatedPlan.items.map((item) => (
              <View key={item.id} style={localStyles.timelineRow}>
                <View style={[localStyles.timelineTime, { backgroundColor: theme.colors.ink }]}>
                  <Text style={[localStyles.timelineTimeText, { color: theme.colors.yellow }]}>
                    {formatMinuteOfDay(item.startMinute)}
                  </Text>
                </View>
                <View style={[localStyles.timelineCard, { borderColor: theme.colors.border }]}>
                  <Text style={[localStyles.timelineName, { color: theme.colors.text }]}>{item.name}</Text>
                  <Text style={[localStyles.timelineMeta, { color: theme.colors.subtext }]}>
                    {formatMinuteOfDay(item.startMinute)}-{formatMinuteOfDay(item.endMinute)}
                    {item.type === "ride" && typeof item.expectedWaitMinutes === "number"
                      ? ` / 待ち${item.expectedWaitMinutes}分 / 移動${item.travelMinutes ?? 0}分`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {generatedPlan.unscheduledNames.length > 0 ? (
            <Text style={[localStyles.warning, { color: theme.colors.danger }]}>
              入りきらない候補: {generatedPlan.unscheduledNames.join("、")}
            </Text>
          ) : null}
        </Panel>
      ) : null}
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  panelSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "800",
  },
  timeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  timeField: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "900",
  },
  timeInput: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "900",
    padding: 0,
  },
  chips: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateButton: {
    width: "48%",
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  templateDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  empty: {
    paddingVertical: 22,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "800",
  },
  selectedList: {
    marginTop: 10,
    gap: 10,
  },
  selectedRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  selectedMain: {
    paddingRight: 38,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: "900",
  },
  selectedMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  priorityRow: {
    flexDirection: "row",
    gap: 6,
  },
  priorityButton: {
    height: 32,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "900",
  },
  candidateList: {
    marginTop: 10,
    gap: 8,
  },
  candidateRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  candidateMain: {
    flex: 1,
  },
  candidateName: {
    fontSize: 14,
    fontWeight: "900",
  },
  candidateMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  saveBox: {
    flex: 1,
    maxWidth: 220,
    gap: 8,
  },
  nameInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: "900",
  },
  timeline: {
    marginTop: 14,
    gap: 10,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
  },
  timelineTime: {
    width: 54,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineTimeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  timelineCard: {
    flex: 1,
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingBottom: 4,
  },
  timelineName: {
    fontSize: 14,
    fontWeight: "900",
  },
  timelineMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  warning: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "800",
  },
});
