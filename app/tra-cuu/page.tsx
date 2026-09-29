import type { Metadata } from "next";
import Lookup from "@/components/lookup";

export const metadata: Metadata = {
  title: "Tra cứu chỗ ngồi",
  // Trang tra cứu chứa dữ liệu cá nhân trong link, không cho công cụ tìm kiếm lập chỉ mục.
  robots: { index: false, follow: false },
};

export default function LookupPage() {
  return <Lookup />;
}
