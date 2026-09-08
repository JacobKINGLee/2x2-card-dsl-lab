import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://card-dsl-lab-2x2.caicaiqwe9.chatgpt.site"),
  title: "2×2 Card DSL Lab",
  description: "把任意自然语言内容编译为 Semantic DSL，再通过确定性约束引擎生成可校验的2×2卡片。",
  openGraph: {
    title: "2×2 Card DSL Lab",
    description: "内容驱动语义，规则求解设计；生成稳定、可解释的2×2卡片。",
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
    description: "内容驱动语义，规则求解设计；生成稳定、可解释的2×2卡片。",
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
