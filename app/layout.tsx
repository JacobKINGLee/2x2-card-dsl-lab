import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2×2 Card DSL Lab",
  description: "将2×2卡片UX规范转换为可校验、可实时渲染的自定义DSL。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
