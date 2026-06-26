import React from "react";
import { Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAppContext } from "../AppContext";
import { getTheme, IconButton, PageHeader, Panel, Screen, StatTile } from "../components/ui";
import { formatRelativeTime } from "../utils/time";

export default function SettingsScreen() {
  const {
    colorMode,
    setColorMode,
    databaseStats,
    clearDatabase,
    refreshLiveData,
    isRefreshing,
    lastRefreshAt,
  } = useAppContext();
  const isDark = colorMode === "dark";
  const theme = getTheme(isDark);

  return (
    <Screen isDark={isDark}>
      <PageHeader
        eyebrow="Control Room"
        title="設定"
        subtitle={`最終更新 ${formatRelativeTime(lastRefreshAt)}`}
        icon="settings"
        theme={theme}
      />

      <Panel theme={theme}>
        <View style={localStyles.settingRow}>
          <View style={localStyles.settingText}>
            <Text style={[localStyles.settingTitle, { color: theme.colors.text }]}>ダークモード</Text>
            <Text style={[localStyles.settingSub, { color: theme.colors.subtext }]}>夜の待ち時間チェック向け</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(value) => setColorMode(value ? "dark" : "light")}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Panel>

      <View style={localStyles.statGrid}>
        <StatTile
          label="保存サンプル"
          value={`${databaseStats.sampleCount}`}
          icon="server"
          theme={theme}
          accent={theme.colors.blue}
        />
        <StatTile
          label="対象施設"
          value={`${databaseStats.attractionCount}`}
          icon="albums"
          theme={theme}
          accent={theme.colors.green}
        />
      </View>

      <Panel theme={theme}>
        <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>データ</Text>
        <View style={localStyles.buttonStack}>
          <IconButton
            icon="refresh"
            label="ライブデータ更新"
            onPress={refreshLiveData}
            loading={isRefreshing}
            theme={theme}
          />
          <IconButton
            icon="trash"
            label="端末内DBをクリア"
            onPress={() => {
              clearDatabase().catch(() => {});
            }}
            theme={theme}
            tone="danger"
          />
        </View>
      </Panel>

      <Panel theme={theme}>
        <Text style={[localStyles.panelTitle, { color: theme.colors.text }]}>クレジット</Text>
        <Pressable
          onPress={() => {
            Linking.openURL("https://queue-times.com/").catch(() => {});
          }}
          style={[localStyles.linkRow, { borderColor: theme.colors.border }]}
        >
          <Ionicons name="open-outline" size={18} color={theme.colors.primary} />
          <View style={localStyles.linkText}>
            <Text style={[localStyles.linkTitle, { color: theme.colors.text }]}>Powered by Queue-Times.com</Text>
            <Text style={[localStyles.linkSub, { color: theme.colors.subtext }]}>ライブ待ち時間データ</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => {
            Linking.openURL("https://www.themeparks.wiki/").catch(() => {});
          }}
          style={[localStyles.linkRow, { borderColor: theme.colors.border }]}
        >
          <Ionicons name="open-outline" size={18} color={theme.colors.primary} />
          <View style={localStyles.linkText}>
            <Text style={[localStyles.linkTitle, { color: theme.colors.text }]}>ThemeParks.wiki</Text>
            <Text style={[localStyles.linkSub, { color: theme.colors.subtext }]}>営業時間データ</Text>
          </View>
        </Pressable>
        <Text style={[localStyles.notice, { color: theme.colors.subtext }]}>
          このアプリは非公式です。入場制限、休止、整理券、ショー時刻は公式情報も確認してください。
        </Text>
      </Panel>
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  settingRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  settingSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  statGrid: {
    flexDirection: "row",
    gap: 10,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },
  buttonStack: {
    gap: 10,
  },
  linkRow: {
    borderTopWidth: 1,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  linkText: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  linkSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  notice: {
    marginTop: 4,
    lineHeight: 19,
    fontSize: 12,
    fontWeight: "700",
  },
});
