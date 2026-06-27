import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppContext } from "../AppContext";
import { Chip, getTheme, PageHeader, Panel, Screen, WaitBadge } from "../components/ui";
import { getAttractionById } from "../data/attractions";

type SortMode = "wait" | "area" | "best" | "selected";
type CategoryMode = "all" | "kids" | "thrill" | "nintendo" | "indoor";

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function trendIcon(trend: string): React.ComponentProps<typeof Ionicons>["name"] {
  if (trend === "up") return "trending-up";
  if (trend === "down") return "trending-down";
  if (trend === "flat") return "remove";
  return "help";
}

export default function WaitTimesScreen() {
  const {
    colorMode,
    analyses,
    selectedAttractions,
    toggleAttraction,
    refreshLiveData,
    isRefreshing,
  } = useAppContext();
  const theme = getTheme(colorMode === "dark");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("wait");
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("all");
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
      if (categoryMode === "nintendo") return row.area.includes("Nintendo") || row.area.includes("Donkey");
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
        eyebrow="Live Board"
        title="待ち時間"
        subtitle={`${filtered.length}件 / 現在待ち時間`}
        icon="pulse"
        theme={theme}
      />

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
        <Chip label="待ち長い順" icon="time" active={sortMode === "wait"} onPress={() => setSortMode("wait")} theme={theme} />
        <Chip label="エリア" icon="albums" active={sortMode === "area"} onPress={() => setSortMode("area")} theme={theme} />
        <Chip label="狙い時" icon="flash" active={sortMode === "best"} onPress={() => setSortMode("best")} theme={theme} />
        <Chip label="選択中" icon="checkmark" active={sortMode === "selected"} onPress={() => setSortMode("selected")} theme={theme} />
      </View>

      <View style={localStyles.list}>
        {filtered.map((row) => {
          const selected = selectedIds.has(row.id);
          const attraction = getAttractionById(row.id);
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
                <Pressable
                  onPress={() => toggleAttraction(row.id)}
                  style={[
                    localStyles.selectButton,
                    {
                      backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
                    },
                  ]}
                >
                  <Ionicons name={selected ? "checkmark" : "add"} size={18} color={selected ? "#FFFFFF" : theme.colors.text} />
                </Pressable>
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
                <WaitBadge waitMinutes={row.currentWaitMinutes} status={row.currentStatus} theme={theme} />
              </View>

              <View style={localStyles.analysisRow}>
                <View style={[localStyles.analysisPill, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name="pricetag-outline" size={14} color={theme.colors.primary} />
                  <Text style={[localStyles.analysisText, { color: theme.colors.text }]}>{tagLabel}</Text>
                </View>
                <View style={[localStyles.analysisPill, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name={trendIcon(row.trend)} size={14} color={theme.colors.primary} />
                  <Text style={[localStyles.analysisText, { color: theme.colors.text }]}>
                    {row.trend === "up" ? "上昇" : row.trend === "down" ? "下降" : row.trend === "flat" ? "横ばい" : "不明"}
                  </Text>
                </View>
                <View style={[localStyles.analysisPill, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name="server-outline" size={14} color={theme.colors.blue} />
                  <Text style={[localStyles.analysisText, { color: theme.colors.text }]}>{row.sampleCount}件</Text>
                </View>
                <View style={[localStyles.analysisPill, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name="analytics-outline" size={14} color={theme.colors.green} />
                  <Text style={[localStyles.analysisText, { color: theme.colors.text }]}>狙い目 {row.bestTimeLabel}</Text>
                </View>
              </View>
            </Panel>
          );
        })}
      </View>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
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
  selectButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
});
