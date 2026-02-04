import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YC Advisor - Y Combinator 创业咨询助手",
  description: "基于 Y Combinator 443+ 创业资源的 AI 咨询助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
