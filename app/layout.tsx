import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const vietnam = Be_Vietnam_Pro({
  variable: "--font-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Chữ nghiêng chỉ dùng cho vài dòng chú thích nên tách riêng và không preload.
const vietnamItalic = Be_Vietnam_Pro({
  variable: "--font-vietnam-italic",
  subsets: ["latin", "vietnamese"],
  weight: ["400"],
  style: "italic",
  display: "swap",
  preload: false,
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Xếp chỗ nhanh", template: "%s · Xếp chỗ nhanh" },
  description: "Tự động xếp chỗ ngồi thi, không để hai người cùng đơn vị ngồi cạnh nhau.",
};

export const viewport: Viewport = {
  themeColor: "#2451d6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${vietnam.variable} ${vietnamItalic.variable} ${code.variable} h-full`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
