import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Theme } from "./ui";
import { getVisitDayType } from "../utils/japanHoliday";
import { fromISODate, toISODate } from "../utils/time";

type VisitDatePickerProps = {
  visible: boolean;
  selectedISO: string;
  minISO: string;
  maxISO: string;
  theme: Theme;
  onClose: () => void;
  onSelect: (dateISO: string) => void;
};

type DayCell = {
  key: string;
  iso: string | null;
  day: number | null;
  disabled: boolean;
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addMonths(date: Date, diff: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1, 12, 0, 0, 0);
}

function monthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function monthRangeISO(date: Date): { startISO: string; endISO: string } {
  return {
    startISO: toISODate(new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0)),
    endISO: toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0)),
  };
}

function hasSelectableMonth(date: Date, minISO: string, maxISO: string): boolean {
  const range = monthRangeISO(date);
  return range.endISO >= minISO && range.startISO <= maxISO;
}

export function VisitDatePicker({
  visible,
  selectedISO,
  minISO,
  maxISO,
  theme,
  onClose,
  onSelect,
}: VisitDatePickerProps) {
  const [monthCursor, setMonthCursor] = useState(startOfMonth(fromISODate(selectedISO)));

  useEffect(() => {
    if (visible) {
      setMonthCursor(startOfMonth(fromISODate(selectedISO)));
    }
  }, [selectedISO, visible]);

  const cells = useMemo<DayCell[]>(() => {
    const firstWeekday = monthCursor.getDay();
    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 12, 0, 0, 0).getDate();
    const totalCellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const cellsNext: DayCell[] = [];

    for (let index = 0; index < totalCellCount; index += 1) {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > daysInMonth) {
        cellsNext.push({ key: `spacer-${index}`, iso: null, day: null, disabled: true });
        continue;
      }
      const iso = toISODate(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day, 12, 0, 0, 0));
      cellsNext.push({ key: iso, iso, day, disabled: iso < minISO || iso > maxISO });
    }

    return cellsNext;
  }, [maxISO, minISO, monthCursor]);

  const previousMonth = addMonths(monthCursor, -1);
  const nextMonth = addMonths(monthCursor, 1);
  const previousDisabled = !hasSelectableMonth(previousMonth, minISO, maxISO);
  const nextDisabled = !hasSelectableMonth(nextMonth, minISO, maxISO);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.headerRow}>
            <Pressable
              disabled={previousDisabled}
              style={[styles.navButton, { backgroundColor: theme.colors.surfaceAlt, opacity: previousDisabled ? 0.35 : 1 }]}
              onPress={() => setMonthCursor(previousMonth)}
            >
              <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
            </Pressable>
            <Text style={[styles.monthText, { color: theme.colors.text }]}>{monthLabel(monthCursor)}</Text>
            <Pressable
              disabled={nextDisabled}
              style={[styles.navButton, { backgroundColor: theme.colors.surfaceAlt, opacity: nextDisabled ? 0.35 : 1 }]}
              onPress={() => setMonthCursor(nextMonth)}
            >
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text key={label} style={[styles.weekdayText, { color: index === 0 || index === 6 ? theme.colors.danger : theme.colors.subtext }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              if (!cell.iso || cell.day === null) {
                return <View key={cell.key} style={styles.dayCell} />;
              }
              const selected = cell.iso === selectedISO;
              const holiday = getVisitDayType(cell.iso) === "holiday";
              return (
                <Pressable
                  key={cell.key}
                  disabled={cell.disabled}
                  style={[
                    styles.dayCell,
                    {
                      backgroundColor: selected ? theme.colors.primary : holiday ? `${theme.colors.danger}12` : theme.colors.surfaceAlt,
                      opacity: cell.disabled ? 0.35 : 1,
                    },
                  ]}
                  onPress={() => onSelect(cell.iso as string)}
                >
                  <Text style={[styles.dayText, { color: selected ? "#FFFFFF" : holiday ? theme.colors.danger : theme.colors.text }]}>
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 18, 30, 0.42)",
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  monthText: {
    fontSize: 17,
    fontWeight: "900",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dayCell: {
    width: "13.45%",
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "900",
  },
});
