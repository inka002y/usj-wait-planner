import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const LIGHT_COLORS = {
  background: "#F4F7FB",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF5FC",
  text: "#17202A",
  subtext: "#536575",
  muted: "#8BA0B2",
  border: "#D8E4EF",
  primary: "#0072CE",
  primaryDark: "#004B93",
  yellow: "#FFC72C",
  green: "#00865A",
  blue: "#005EB8",
  cyan: "#00A3AD",
  ink: "#003B78",
  danger: "#C2410C",
};

export const DARK_COLORS: typeof LIGHT_COLORS = {
  background: "#071526",
  surface: "#102238",
  surfaceAlt: "#18314E",
  text: "#F4F7FB",
  subtext: "#C8D7E6",
  muted: "#7D94AA",
  border: "#274361",
  primary: "#58AFFF",
  primaryDark: "#8AC7FF",
  yellow: "#FFD166",
  green: "#2FD181",
  blue: "#4EA3FF",
  cyan: "#35D0D7",
  ink: "#F7F7F2",
  danger: "#FB923C",
};

export function getTheme(isDark: boolean) {
  return {
    isDark,
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
  };
}

export type Theme = ReturnType<typeof getTheme>;
type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function useThemeStyles(isDark: boolean) {
  return getTheme(isDark);
}

export function Screen({
  children,
  isDark,
  scroll = true,
}: {
  children: React.ReactNode;
  isDark: boolean;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = getTheme(isDark);
  const contentStyle = [
    styles.screenContent,
    {
      paddingTop: insets.top + 14,
      paddingBottom: insets.bottom + 104,
    },
  ];

  if (!scroll) {
    return <View style={[styles.screen, { backgroundColor: theme.colors.background }, contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function BouncyPressable({
  children,
  onPress,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: Platform.OS !== "web", speed: 34, bounciness: 4 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 28, bounciness: 5 }).start();
  };

  return (
    <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }], opacity: disabled ? 0.45 : 1 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  theme,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: IconName;
  theme: Theme;
}) {
  return (
    <View style={styles.header}>
      <View style={[styles.headerIcon, { backgroundColor: theme.colors.ink }]}>
        <Ionicons name={icon} size={19} color={theme.colors.yellow} />
      </View>
      <View style={styles.headerText}>
        <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.subtext }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Panel({
  children,
  theme,
  style,
}: {
  children: React.ReactNode;
  theme: Theme;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  theme,
  disabled,
  loading,
  tone = "primary",
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  theme: Theme;
  disabled?: boolean;
  loading?: boolean;
  tone?: "primary" | "neutral" | "danger";
}) {
  const background =
    tone === "primary" ? theme.colors.primary : tone === "danger" ? theme.colors.danger : theme.colors.surfaceAlt;
  const textColor = tone === "neutral" ? theme.colors.text : "#FFFFFF";

  return (
    <BouncyPressable onPress={onPress} disabled={disabled || loading}>
      <View style={[styles.button, { backgroundColor: background }]}>
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <Ionicons name={icon} size={17} color={textColor} />
        )}
        <Text style={[styles.buttonText, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </BouncyPressable>
  );
}

export function StatTile({
  label,
  value,
  icon,
  theme,
  accent,
}: {
  label: string;
  value: string;
  icon: IconName;
  theme: Theme;
  accent?: string;
}) {
  return (
    <View style={[styles.statTile, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: accent ?? theme.colors.primary }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <Text style={[styles.statValue, { color: theme.colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.colors.subtext }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  theme,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  theme: Theme;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? theme.colors.primary : theme.colors.border,
          backgroundColor: active ? `${theme.colors.primary}18` : theme.colors.surface,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? theme.colors.primary : theme.colors.subtext} /> : null}
      <Text style={[styles.chipText, { color: active ? theme.colors.primary : theme.colors.subtext }]}>{label}</Text>
    </Pressable>
  );
}

export function WaitBadge({
  waitMinutes,
  status,
  theme,
}: {
  waitMinutes: number | null;
  status: string;
  theme: Theme;
}) {
  const isOpen = status === "operating";
  const label = isOpen && typeof waitMinutes === "number" ? `${waitMinutes}分` : "休止";
  const background = isOpen ? (waitMinutes !== null && waitMinutes >= 70 ? theme.colors.primary : theme.colors.green) : theme.colors.surfaceAlt;
  const color = isOpen ? "#FFFFFF" : theme.colors.subtext;

  return (
    <View style={[styles.waitBadge, { backgroundColor: background }]}>
      <Text style={[styles.waitBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function MiniBarChart({
  values,
  theme,
}: {
  values: Array<{ label: string; value: number | null; active?: boolean }>;
  theme: Theme;
}) {
  const maxValue = Math.max(20, ...values.map((row) => row.value ?? 0));
  return (
    <View style={styles.chartRow}>
      {values.map((row) => {
        const height = `${Math.max(12, Math.round(((row.value ?? 0) / maxValue) * 100))}%` as `${number}%`;
        return (
          <View key={row.label} style={styles.chartColumn}>
            <View style={[styles.chartTrack, { backgroundColor: theme.colors.surfaceAlt }]}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height,
                    backgroundColor: row.active ? theme.colors.primary : theme.colors.cyan,
                  },
                ]}
              />
            </View>
            <Text style={[styles.chartLabel, { color: theme.colors.muted }]}>{row.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 16,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 4,
    paddingBottom: 2,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "700",
  },
  panel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  button: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "900",
  },
  statTile: {
    flex: 1,
    minWidth: 104,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
  },
  chip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "900",
  },
  waitBadge: {
    minWidth: 58,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  waitBadgeText: {
    fontSize: 14,
    fontWeight: "900",
  },
  chartRow: {
    height: 118,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  chartColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    gap: 5,
  },
  chartTrack: {
    flex: 1,
    width: "100%",
    maxWidth: 18,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  chartLabel: {
    fontSize: 10,
    fontWeight: "800",
  },
});
