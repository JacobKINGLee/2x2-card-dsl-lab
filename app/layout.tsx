import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://card-dsl-lab-2x2.caicaiqwe9.chatgpt.site"),
  title: "2×2 Card DSL Lab",
  description: "将2×2卡片UX规范转换为可校验、可实时渲染的自定义DSL。",
  openGraph: {
    title: "2×2 Card DSL Lab",
    description: "把设计规范变成可执行的界面语言。",
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
    description: "把设计规范变成可执行的界面语言。",
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
