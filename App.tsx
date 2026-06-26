import "react-native-gesture-handler";

import React from "react";
import { Platform, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProvider, useAppContext } from "./src/AppContext";
import { getTheme } from "./src/components/ui";
import HomeScreen from "./src/screens/HomeScreen";
import PlannerScreen from "./src/screens/PlannerScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import WaitTimesScreen from "./src/screens/WaitTimesScreen";

type RootTabParamList = {
  Home: undefined;
  Waits: undefined;
  Planner: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<keyof RootTabParamList, { focused: IconName; outline: IconName; label: string }> = {
  Home: { focused: "film", outline: "film-outline", label: "ホーム" },
  Waits: { focused: "pulse", outline: "pulse-outline", label: "待ち時間" },
  Planner: { focused: "map", outline: "map-outline", label: "プラン" },
  Settings: { focused: "settings", outline: "settings-outline", label: "設定" },
};

function AppTabs() {
  const { colorMode } = useAppContext();
  const theme = getTheme(colorMode === "dark");
  const navTheme = colorMode === "dark" ? DarkTheme : DefaultTheme;

  return (
    <>
      <StatusBar style={colorMode === "dark" ? "light" : "dark"} />
      <NavigationContainer
        theme={{
          ...navTheme,
          colors: {
            ...navTheme.colors,
            background: theme.colors.background,
            primary: theme.colors.primary,
            card: theme.colors.surface,
            text: theme.colors.text,
            border: "transparent",
          },
        }}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.muted,
            tabBarLabel: TAB_ICONS[route.name].label,
            tabBarLabelStyle: styles.tabLabel,
            tabBarIcon: ({ focused, color, size }) => {
              const icon = focused ? TAB_ICONS[route.name].focused : TAB_ICONS[route.name].outline;
              return <Ionicons name={icon} size={size} color={color} />;
            },
            tabBarStyle: {
              position: "absolute",
              height: Platform.select({ ios: 86, default: 72 }),
              paddingTop: 8,
              paddingBottom: Platform.select({ ios: 22, default: 10 }),
              borderTopWidth: 0,
              backgroundColor: colorMode === "dark" ? "rgba(16,17,20,0.72)" : "rgba(255,255,255,0.72)",
              elevation: 0,
            },
            tabBarBackground: () => (
              <BlurView
                intensity={86}
                tint={colorMode === "dark" ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ),
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Waits" component={WaitTimesScreen} />
          <Tab.Screen name="Planner" component={PlannerScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppProvider>
          <AppTabs />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
});
