import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://card-dsl-lab-2x2.caicaiqwe9.chatgpt.site"),
  title: "2×2 Card DSL Lab",
  description: "用UX约束引擎把任意少量语义元素转换为可校验的2×2卡片坐标布局。",
  openGraph: {
    title: "2×2 Card DSL Lab",
    description: "不给模板，只给元素；让UX规则求解出可执行坐标。",
    url: "https://card-dsl-lab-2x2.caicaiqwe9.chatgpt.site",
    type: "website",
    images: [
      {
        url: "https://card-dsl-lab-2x2.caicaiqwe9.chatgpt.site/og.png",
        width: 1729,
        height: 877,
        alt: "2×2 Card DSL Lab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "2×2 Card DSL Lab",
    description: "不给模板，只给元素；让UX规则求解出可执行坐标。",
    images: ["https://card-dsl-lab-2x2.caicaiqwe9.chatgpt.site/og.png"],
  },
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
