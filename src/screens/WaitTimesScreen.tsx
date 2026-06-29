import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppContext } from "../AppContext";
import { Chip, getTheme, PageHeader, Panel, Screen } from "../components/ui";
import { getAttractionById } from "../data/attractions";
import { formatVisitDayType } from "../utils/japanHoliday";
import { formatDateLabel, formatMinuteOfDay } from "../utils/time";

type SortMode = "wait" | "area" | "best" | "selected";
type CategoryMode = "all" | "kids" | "thrill" | "nintendo" | "indoor";

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

export default function WaitTimesScreen() {
  const {
    colorMode,
    analyses,
    planOptions,
    selectedAttractions,
    toggleAttraction,
    refreshLiveData,
    isRefreshing,
  } = useAppContext();
  const theme = getTheme(colorMode === "dark");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("wait");
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("all");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const selectedIds = new Set(selectedAttractions.map((row) => row.attractionId));

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    const rows = analyses.filter((row) => {
      if (!q) return true;
      return normalizeSearch(`${row.name}${row.area}`).includes(q);
    }).filter((row) => {
      const attraction = getAttractionById(row.id);
      const tags = attraction?.tags ?? [];
      if (categoryMode === "all") return true;
      if (categoryMode === "kids") return tags.includes("family") || tags.includes("kids");
      if (categoryMode === "thrill") return tags.includes("thrill") || tags.includes("coaster");
      if (categoryMode === "nintendo") return tags.includes("nintendo");
      if (categoryMode === "indoor") return tags.includes("indoor") || tags.includes("show");
      return true;
    });

    return rows.sort((left, right) => {
      if (sortMode === "selected") {
        return Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id));
      }
      if (sortMode === "area") {
        return left.area.localeCompare(right.area, "ja");
      }
      if (sortMode === "best") {
        return (left.bestHour ?? 99) - (right.bestHour ?? 99);
      }
      return (right.currentWaitMinutes ?? right.averageWaitMinutes) - (left.currentWaitMinutes ?? left.averageWaitMinutes);
    });
  }, [analyses, categoryMode, query, selectedIds, sortMode]);

  return (
    <Screen isDark={colorMode === "dark"}>
      <PageHeader
        eyebrow="待ち時間ボード"
        title="待ち時間"
        subtitle={`${formatDateLabel(planOptions.visitDateISO)} / ${formatVisitDayType(planOptions.dayType)}データで表示`}
        icon="pulse"
        theme={theme}
      />

      <View style={[localStyles.contextNotice, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Ionicons name="calendar-outline" size={17} color={theme.colors.primary} />
        <Text style={[localStyles.contextText, { color: theme.colors.subtext }]}>
          {formatVisitDayType(planOptions.dayType)}の来園日として、直近{planOptions.dayType === "holiday" ? 21 : 7}日間の同じ条件を参考にしています。
        </Text>
      </View>

      <View style={localStyles.searchRow}>
        <View style={[localStyles.searchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={18} color={theme.colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="アトラクション・エリア検索"
            placeholderTextColor={theme.colors.muted}
            style={[localStyles.searchInput, { color: theme.colors.text }]}
            returnKeyType="search"
          />
        </View>
        <Pressable
          onPress={() => {
            refreshLiveData().catch(() => {});
          }}
          style={[localStyles.refreshSquare, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name={isRefreshing ? "hourglass" : "refresh"} size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={localStyles.chips}>
        <Chip label="すべて" active={categoryMode === "all"} onPress={() => setCategoryMode("all")} theme={theme} />
        <Chip label="キッズ" active={categoryMode === "kids"} onPress={() => setCategoryMode("kids")} theme={theme} />
        <Chip label="スリル" active={categoryMode === "thrill"} onPress={() => setCategoryMode("thrill")} theme={theme} />
        <Chip label="任天堂" active={categoryMode === "nintendo"} onPress={() => setCategoryMode("nintendo")} theme={theme} />
        <Chip label="屋内/ショー" active={categoryMode === "indoor"} onPress={() => setCategoryMode("indoor")} theme={theme} />
      </View>

      <View style={localStyles.chips}>
        <Chip label="待ち時間順" icon="time" active={sortMode === "wait"} onPress={() => setSortMode("wait")} theme={theme} />
        <Chip label="エリア順" icon="albums" active={sortMode === "area"} onPress={() => setSortMode("area")} theme={theme} />
        <Chip label="空きやすい順" icon="flash" active={sortMode === "best"} onPress={() => setSortMode("best")} theme={theme} />
        <Chip label="追加済み" icon="checkmark" active={sortMode === "selected"} onPress={() => setSortMode("selected")} theme={theme} />
      </View>

      <View style={localStyles.list}>
        {filtered.map((row) => {
          const selected = selectedIds.has(row.id);
          const attraction = getAttractionById(row.id);
          const historyMaxWait = Math.max(20, ...row.hourlyProfile.map((point) => point.waitMinutes ?? 0));
          const tagLabel = attraction?.tags.includes("thrill")
            ? "スリル"
            : attraction?.tags.includes("family") || attraction?.tags.includes("kids")
              ? "キッズ向け"
              : attraction?.tags.includes("show")
                ? "ショー"
                : attraction?.tags.includes("indoor")
                  ? "屋内"
                  : "アトラクション";
          return (
            <Panel
              key={row.id}
              theme={theme}
              style={{
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                padding: 0,
                overflow: "hidden",
              }}
            >
              <View style={[localStyles.waitRibbon, { backgroundColor: row.currentStatus === "operating" ? theme.colors.primary : theme.colors.surfaceAlt }]}>
                <Text style={[localStyles.waitRibbonText, { color: row.currentStatus === "operating" ? "#FFFFFF" : theme.colors.subtext }]}>
                  {row.currentStatus === "operating" && typeof row.currentWaitMinutes === "number"
                    ? `${row.currentWaitMinutes}分待ち`
                    : row.currentStatus === "operating"
                      ? "運営中"
                      : row.currentStatus === "unknown"
                        ? "確認中"
                        : "休止中"}
                </Text>
              </View>
              <View style={localStyles.rideTop}>
                <View style={[localStyles.thumbnail, { borderColor: attraction?.accentColor ?? theme.colors.primary }]}>
                  <Ionicons name={attraction?.tags.includes("show") ? "musical-notes" : "sparkles"} size={18} color={attraction?.accentColor ?? theme.colors.primary} />
                </View>
                <View style={localStyles.rideTitle}>
                  <Text style={[localStyles.rideName, { color: theme.colors.text }]} numberOfLines={2}>
                    {row.name}
                  </Text>
                  <Text style={[localStyles.rideMeta, { color: theme.colors.subtext }]} numberOfLines={1}>
                    {row.area}
                  </Text>
                </View>
              </View>

              <View style={localStyles.analysisRow}>
                <View style={[localStyles.analysisPill, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name="pricetag-outline" size={14} color={theme.colors.primary} />
                  <Text style={[localStyles.analysisText, { color: theme.colors.text }]}>{tagLabel}</Text>
                </View>
                <View style={[localStyles.analysisPill, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name="analytics-outline" size={14} color={theme.colors.green} />
                  <Text style={[localStyles.analysisText, { color: theme.colors.text }]}>空きやすい {row.bestTimeLabel}</Text>
                </View>
              </View>

              <View style={localStyles.cardActions}>
                <Pressable
                  onPress={() => toggleAttraction(row.id)}
                  style={[
                    localStyles.planActionButton,
                    {
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
                    },
                  ]}
                >
                  <Ionicons name={selected ? "checkmark-circle" : "add-circle-outline"} size={17} color={selected ? "#FFFFFF" : theme.colors.text} />
                  <Text style={[localStyles.planActionText, { color: selected ? "#FFFFFF" : theme.colors.text }]}>
                    {selected ? "プランに追加済み" : "プランに追加"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setExpandedHistoryId((current) => (current === row.id ? null : row.id))}
                  style={[localStyles.historyActionButton, { backgroundColor: theme.colors.surfaceAlt }]}
                >
                  <Ionicons name="stats-chart" size={16} color={theme.colors.primary} />
                  <Text style={[localStyles.historyActionText, { color: theme.colors.text }]}>
                    {expandedHistoryId === row.id ? "傾向を閉じる" : "過去の傾向"}
                  </Text>
                </Pressable>
              </View>

              {expandedHistoryId === row.id ? (
                <View style={[localStyles.historyBox, { borderTopColor: theme.colors.border }]}>
                  <View style={localStyles.historyHeader}>
                    <Text style={[localStyles.historyTitle, { color: theme.colors.text }]}>過去の待ち時間傾向</Text>
                    <Text style={[localStyles.historyMeta, { color: theme.colors.subtext }]}>
                      {formatVisitDayType(row.dayType)}の直近{row.historyWindowDays}日
                    </Text>
                  </View>
                  <Text style={[localStyles.historyHelp, { color: theme.colors.subtext }]}>
                    来園日の曜日条件に合わせた過去データです。各行はその時間帯に並んだ場合の目安です。
                  </Text>
                  <View style={localStyles.historyRows}>
                    {row.hourlyProfile.map((point) => {
                      const width = `${Math.max(8, Math.round(((point.waitMinutes ?? 0) / historyMaxWait) * 100))}%` as `${number}%`;
                      return (
                        <View key={`${row.id}-${point.hour}`} style={localStyles.historyRow}>
                          <Text style={[localStyles.historyTime, { color: theme.colors.text }]}>
                            {formatMinuteOfDay(point.minuteOfDay)}台
                          </Text>
                          <View style={[localStyles.historyTrack, { backgroundColor: theme.colors.surfaceAlt }]}>
                            <View
                              style={[
                                localStyles.historyFill,
                                {
                                  width,
                                  backgroundColor: point.source === "database" ? theme.colors.primary : theme.colors.muted,
                                },
                              ]}
                            />
                          </View>
                          <Text style={[localStyles.historyWait, { color: theme.colors.text }]}>
                            {point.waitMinutes ?? 0}分
                          </Text>
                          <Text style={[localStyles.historySource, { color: theme.colors.subtext }]}>
                            {point.source === "database" ? "実績" : "推定"}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </Panel>
          );
        })}
      </View>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  contextNotice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contextText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    fontSize: 15,
    fontWeight: "800",
  },
  refreshSquare: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  list: {
    gap: 10,
  },
  waitRibbon: {
    alignSelf: "flex-start",
    minWidth: 96,
    height: 32,
    borderBottomRightRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  waitRibbonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  rideTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },

  thumbnail: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rideTitle: {
    flex: 1,
  },
  rideName: {
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 20,
  },
  rideMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  analysisRow: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  analysisPill: {
    height: 30,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  analysisText: {
    fontSize: 12,
    fontWeight: "900",
  },
  cardActions: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  planActionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  planActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  historyActionButton: {
    minWidth: 112,
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  historyActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  historyBox: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  historyMeta: {
    fontSize: 11,
    fontWeight: "800",
  },
  historyHelp: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  historyRows: {
    gap: 8,
  },
  historyRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyTime: {
    width: 64,
    fontSize: 12,
    fontWeight: "900",
  },
  historyTrack: {
    flex: 1,
    height: 10,
    borderRadius: 8,
    overflow: "hidden",
  },
  historyFill: {
    height: "100%",
    borderRadius: 8,
  },
  historyWait: {
    width: 42,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "900",
  },
  historySource: {
    width: 28,
    fontSize: 10,
    fontWeight: "800",
  },
});
