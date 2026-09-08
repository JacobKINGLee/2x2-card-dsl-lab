export const CARD_ICONS = [
  { name: "cloud-rain", label: "云雨", usage: "天气、降雨" },
  { name: "droplets", label: "水滴", usage: "湿度、空气" },
  { name: "navigation", label: "导航", usage: "位置、出行" },
  { name: "moon", label: "月亮", usage: "睡眠、夜间" },
  { name: "sparkles", label: "闪光", usage: "智能、优化" },
  { name: "battery", label: "电池", usage: "电量、充电" },
  { name: "zap", label: "闪电", usage: "能源、快捷操作" },
  { name: "calendar", label: "日历", usage: "日程、会议" },
  { name: "bell-off", label: "静音", usage: "通知、专注" },
  { name: "activity", label: "活动", usage: "健康、运动" },
  { name: "headphones", label: "耳机", usage: "音频、设备" },
  { name: "clock", label: "时钟", usage: "时间、计时" },
  { name: "footprints", label: "足迹", usage: "步数、行走" },
  { name: "check", label: "完成", usage: "确认、完成" },
] as const;

export type CardIconName = typeof CARD_ICONS[number]["name"];

export function SemanticIcon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "cloud-rain":
      return <svg {...common}><path d="M16 13a4 4 0 0 0-.8-7.9A6 6 0 0 0 4.3 8.2 3.5 3.5 0 0 0 5.5 15H16" /><path d="m8 19 .7-2M12 19l.7-2M16 19l.7-2" /></svg>;
    case "droplets":
      return <svg {...common}><path d="M12 3 7.5 8.5a6 6 0 1 0 9 0L12 3Z" /><path d="M5 5 3.5 7a2.3 2.3 0 0 0 2.8 3.5" /></svg>;
    case "navigation":
      return <svg {...common}><path d="m3 11 18-8-8 18-2-8-8-2Z" /></svg>;
    case "moon":
      return <svg {...common}><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /><path d="M17 4v3M15.5 5.5h3" /></svg>;
    case "sparkles":
      return <svg {...common}><path d="m12 3 1.1 3.4L16.5 8l-3.4 1.6L12 13l-1.1-3.4L7.5 8l3.4-1.6L12 3Z" /><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14ZM19 12l.6 1.4L21 14l-1.4.6L19 16l-.6-1.4L17 14l1.4-.6L19 12Z" /></svg>;
    case "battery":
      return <svg {...common}><rect x="3" y="7" width="16" height="10" rx="2" /><path d="M21 10v4M6 10h7v4H6z" /></svg>;
    case "zap":
      return <svg {...common}><path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>;
    case "bell-off":
      return <svg {...common}><path d="m2 2 20 20M6.3 6.3A6 6 0 0 1 18 9v4l2 3H9M13.7 18a2 2 0 0 1-3.4 0M5 13V9c0-.5.1-1 .2-1.5" /></svg>;
    case "activity":
      return <svg {...common}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>;
    case "headphones":
      return <svg {...common}><path d="M4 14a8 8 0 0 1 16 0M4 14v4a2 2 0 0 0 2 2h2v-7H6a2 2 0 0 0-2 1ZM20 14v4a2 2 0 0 1-2 2h-2v-7h2a2 2 0 0 1 2 1Z" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "footprints":
      return <svg {...common}><path d="M7 16.5c-1.8 0-3 1.1-3 2.4 0 1.2 1 2.1 2.4 2.1 1.8 0 3.6-1.4 3.6-2.7 0-1-1.2-1.8-3-1.8ZM8 13c1.5 0 2.5-2.2 2.5-4.7S9.6 4 8.1 4 5.5 6 5.5 8.5 6.5 13 8 13ZM17 11.5c1.8 0 3 1.1 3 2.4 0 1.2-1 2.1-2.4 2.1-1.8 0-3.6-1.4-3.6-2.7 0-1 1.2-1.8 3-1.8ZM16 8c-1.5 0-2.5-1.7-2.5-3.7S14.4 1 15.9 1s2.6 1.5 2.6 3.5S17.5 8 16 8Z" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    default:
      return <span className="icon-fallback">{name}</span>;
  }
}
