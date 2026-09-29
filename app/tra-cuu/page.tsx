import type { Metadata } from "next";
import Lookup from "@/components/lookup";

export const metadata: Metadata = {
  title: "Tra cứu chỗ ngồi",
  robots: { index: false, follow: false },
};

export default function LookupPage() {
  return <Lookup roomId={null} />;
}
