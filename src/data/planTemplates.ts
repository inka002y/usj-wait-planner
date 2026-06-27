import { PlanOptions, Priority, SelectedAttraction } from "../types";

export type PlanTemplateId = "classic" | "rider" | "thirteen" | "baby";

export interface PlanTemplate {
  id: PlanTemplateId;
  label: string;
  description: string;
  options: Partial<PlanOptions>;
  selectedAttractions: SelectedAttraction[];
}

function pick(attractionId: string, priority: Priority = "normal"): SelectedAttraction {
  return { attractionId, priority };
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "classic",
    label: "一般あるある",
    description: "任天堂、ハリポタ、ミニオン、定番を押さえる",
    options: {
      pace: "efficient",
      startMinute: 9 * 60,
      endMinute: 20 * 60,
      lunchMinute: 12 * 60 + 20,
    },
    selectedAttractions: [
      pick("12061", "must"),
      pick("14402", "high"),
      pick("12071", "high"),
      pick("12065", "high"),
      pick("12068", "normal"),
      pick("12066", "normal"),
      pick("7077", "normal"),
      pick("7065", "normal"),
    ],
  },
  {
    id: "rider",
    label: "よく乗る人",
    description: "コースターと人気ライドを強めに回す",
    options: {
      pace: "efficient",
      startMinute: 9 * 60,
      endMinute: 21 * 60,
      lunchMinute: 13 * 60,
    },
    selectedAttractions: [
      pick("14402", "must"),
      pick("12061", "must"),
      pick("7092", "high"),
      pick("12070", "high"),
      pick("7077", "high"),
      pick("12065", "high"),
      pick("12073", "normal"),
      pick("15428", "normal"),
      pick("14918", "normal"),
    ],
  },
  {
    id: "thirteen",
    label: "13本級",
    description: "長時間滞在で本数を最大化するチャレンジ",
    options: {
      pace: "efficient",
      startMinute: 8 * 60 + 30,
      endMinute: 21 * 60 + 30,
      lunchMinute: null,
    },
    selectedAttractions: [
      pick("7065", "high"),
      pick("12197", "normal"),
      pick("13005", "normal"),
      pick("15427", "normal"),
      pick("12065", "high"),
      pick("7063", "normal"),
      pick("12066", "high"),
      pick("12072", "normal"),
      pick("12075", "normal"),
      pick("14919", "normal"),
      pick("12068", "normal"),
      pick("15428", "normal"),
      pick("14918", "normal"),
    ],
  },
  {
    id: "baby",
    label: "赤ちゃん/子連れ",
    description: "移動を抑えて屋内・低刺激・休憩を多めにする",
    options: {
      pace: "family",
      startMinute: 10 * 60,
      endMinute: 18 * 60,
      lunchMinute: 12 * 60,
    },
    selectedAttractions: [
      pick("7065", "must"),
      pick("12075", "high"),
      pick("14919", "high"),
      pick("7063", "normal"),
      pick("12091", "normal"),
      pick("7214", "normal"),
      pick("12072", "normal"),
    ],
  },
];
