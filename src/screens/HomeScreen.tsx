import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useAppContext } from "../AppContext";
import { formatScheduleLabel } from "../services/waitApi";
import {
  getTheme,
  IconButton,
  PageHeader,
  Panel,
  Screen,
  StatTile,
  WaitBadge,
} from "../components/ui";
import { formatMinuteOfDay, formatRelativeTime } from "../utils/time";

type TabName = "Waits" | "Planner" | "Settings";

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const {
    colorMode,
    parkSummary,
    schedule,
    isRefreshing,
    refreshLiveData,
    refreshError,
    lastRefreshAt,
    savedPlans,
    deletePlan,
    databaseStats,
    analyses,
  } = useAppContext();
  const theme = getTheme(colorMode === "dark");
  const longest = parkSummary.longest;
  const shortest = parkSummary.shortest;
  const recommendations = analyses
    .filter((row) => row.currentStatus === "operating")
    .sort((left, right) => (left.currentWaitMinutes ?? 999) - (right.currentWaitMinutes ?? 999))
    .slice(0, 3);

  function navigateTo(tabName: TabName) {
    navigation.navigate(tabName);
  }

  return (
    <Screen isDark={colorMode === "dark"}>
      <PageHeader
        eyebrow="Universal Studios Japan"
        title="USJガイド"
        subtitle={`${formatScheduleLabel(schedule)}  /  ${formatRelativeTime(lastRefreshAt)}更新`}
        icon="film"
        theme={theme}
      />

      <View style={[localStyles.hero, { backgroundColor: theme.colors.primary }]}>
        <View style={localStyles.heroTop}>
          <View>
            <Text style={localStyles.heroLabel}>TODAY'S PARK HOURS</Text>
            <Text style={localStyles.heroHours}>{formatScheduleLabel(schedule).replace("営業時間 ", "")}</Text>
          </View>
          <IconButton
            icon="refresh"
            label="更新"
            onPress={refreshLiveData}
            loading={isRefreshing}
            theme={theme}
          />
        </View>
        <View style={localStyles.heroBottom}>
          <View>
            <Text style={localStyles.heroSmall}>最長待ち時間</Text>
            <Text style={localStyles.heroRide} numberOfLines={1}>
              {longest?.name ?? "取得待ち"}
            </Text>
          </View>
          <WaitBadge waitMinutes={longest?.waitMinutes ?? null} status={longest?.status ?? "unknown"} theme={theme} />
        </View>
      </View>

      <View style={localStyles.quickGrid}>
        <QuickAction icon="time" label="待ち時間" theme={theme} onPress={() => navigateTo("Waits")} />
        <QuickAction icon="map" label="エリア別" theme={theme} onPress={() => navigateTo("Waits")} />
        <QuickAction icon="sparkles" label="プラン" theme={theme} onPress={() => navigateTo("Planner")} />
        <QuickAction icon="server" label="データ" theme={theme} onPress={() => navigateTo("Settings")} />
      </View>

      <View style={localStyles.statGrid}>
        <StatTile
          label="運営中"
          value={`${parkSummary.operatingCount}`}
          icon="radio-button-on"
          theme={theme}
          accent={theme.colors.green}
        />
        <StatTile
          label="平均待ち"
          value={`${parkSummary.averageWaitMinutes}分`}
          icon="speedometer"
          theme={theme}
          accent={theme.colors.primary}
        />
        <StatTile
          label="DB件数"
          value={`${databaseStats.sampleCount}`}
          icon="server"
          theme={theme}
          accent={theme.colors.blue}
        />
      </View>

      <Panel theme={theme}>
        <View style={localStyles.panelHeader}>
          <View>
            <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>待ち時間サマリー</Text>
            <Text style={[localStyles.panelSub, { color: theme.colors.subtext }]}>Powered by Queue-Times.com</Text>
          </View>
          <Ionicons name="pulse-outline" size={22} color={theme.colors.primary} />
        </View>

        {refreshError ? <Text style={[localStyles.errorText, { color: theme.colors.danger }]}>{refreshError}</Text> : null}

        <View style={localStyles.livePair}>
          <View style={[localStyles.liveBox, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[localStyles.liveLabel, { color: theme.colors.subtext }]}>長い</Text>
            <Text style={[localStyles.liveName, { color: theme.colors.text }]} numberOfLines={2}>
              {longest?.name ?? "取得待ち"}
            </Text>
            <WaitBadge waitMinutes={longest?.waitMinutes ?? null} status={longest?.status ?? "unknown"} theme={theme} />
          </View>
          <View style={[localStyles.liveBox, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text style={[localStyles.liveLabel, { color: theme.colors.subtext }]}>短い</Text>
            <Text style={[localStyles.liveName, { color: theme.colors.text }]} numberOfLines={2}>
              {shortest?.name ?? "取得待ち"}
            </Text>
            <WaitBadge waitMinutes={shortest?.waitMinutes ?? null} status={shortest?.status ?? "unknown"} theme={theme} />
          </View>
        </View>
      </Panel>

      <Panel theme={theme}>
        <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>今すぐ狙いやすい</Text>
        <View style={localStyles.recommendList}>
          {recommendations.map((row, index) => (
            <View key={row.id} style={[localStyles.recommendRow, { borderColor: theme.colors.border }]}>
              <View style={[localStyles.rank, { backgroundColor: index === 0 ? theme.colors.yellow : theme.colors.surfaceAlt }]}>
                <Text style={[localStyles.rankText, { color: index === 0 ? theme.colors.ink : theme.colors.text }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={localStyles.recommendText}>
                <Text style={[localStyles.recommendName, { color: theme.colors.text }]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[localStyles.recommendMeta, { color: theme.colors.subtext }]} numberOfLines={1}>
                  {row.area} / ベスト {row.bestTimeLabel}
                </Text>
              </View>
              <WaitBadge waitMinutes={row.currentWaitMinutes} status={row.currentStatus} theme={theme} />
            </View>
          ))}
        </View>
      </Panel>

      <Panel theme={theme}>
        <View style={localStyles.panelHeader}>
          <View>
            <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>保存プラン</Text>
            <Text style={[localStyles.panelSub, { color: theme.colors.subtext }]}>最大8件まで端末に保存</Text>
          </View>
          <Ionicons name="map-outline" size={22} color={theme.colors.primary} />
        </View>

        {savedPlans.length === 0 ? (
          <View style={localStyles.emptyState}>
            <Ionicons name="ticket-outline" size={30} color={theme.colors.muted} />
            <Text style={[localStyles.emptyText, { color: theme.colors.subtext }]}>まだ保存プランはありません</Text>
          </View>
        ) : (
          <View style={localStyles.savedList}>
            {savedPlans.map((plan) => (
              <View key={plan.id} style={[localStyles.savedRow, { borderColor: theme.colors.border }]}>
                <View style={localStyles.savedMain}>
                  <Text style={[localStyles.savedName, { color: theme.colors.text }]} numberOfLines={1}>
                    {plan.name}
                  </Text>
                  <Text style={[localStyles.savedMeta, { color: theme.colors.subtext }]} numberOfLines={1}>
                    {formatMinuteOfDay(plan.options.startMinute)}-{formatMinuteOfDay(plan.options.endMinute)}
                    {` / ${plan.items.filter((item) => item.type === "ride").length}件 / 待ち${plan.totalExpectedWaitMinutes}分`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    deletePlan(plan.id).catch(() => {});
                  }}
                  hitSlop={10}
                  style={[localStyles.deleteButton, { backgroundColor: theme.colors.surfaceAlt }]}
                >
                  <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Panel>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  theme,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  theme: ReturnType<typeof getTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[localStyles.quickAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      <View style={[localStyles.quickIcon, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View>
      <Text style={[localStyles.quickLabel, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  hero: {
    borderRadius: 8,
    padding: 16,
    gap: 18,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: "900",
  },
  heroHours: {
    marginTop: 3,
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
  },
  heroBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroSmall: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "900",
  },
  heroRide: {
    marginTop: 3,
    maxWidth: 230,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickAction: {
    width: "47.9%",
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    justifyContent: "space-between",
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: "900",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
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
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "800",
  },
  livePair: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  liveBox: {
    flex: 1,
    minHeight: 116,
    borderRadius: 8,
    padding: 12,
    justifyContent: "space-between",
  },
  liveLabel: {
    fontSize: 12,
    fontWeight: "900",
  },
  liveName: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 19,
  },
  recommendList: {
    marginTop: 10,
    gap: 10,
  },
  recommendRow: {
    minHeight: 58,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontWeight: "900",
  },
  recommendText: {
    flex: 1,
  },
  recommendName: {
    fontSize: 14,
    fontWeight: "900",
  },
  recommendMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 22,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "800",
  },
  savedList: {
    marginTop: 10,
    gap: 9,
  },
  savedRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  savedMain: {
    flex: 1,
  },
  savedName: {
    fontSize: 14,
    fontWeight: "900",
  },
  savedMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
