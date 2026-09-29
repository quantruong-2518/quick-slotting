import type { Metadata } from "next";
import Lookup from "@/components/lookup";
import { parseRoomId } from "@/lib/room-share";

export const metadata: Metadata = {
  title: "Tra cứu chỗ ngồi",
  robots: { index: false, follow: false },
};

export default async function RoomLookupPage({ params }: PageProps<"/tra-cuu/[phong]">) {
  const { phong } = await params;
  // Mã sai dạng vẫn hiện trang; máy chủ trả lỗi "không tìm thấy" bằng tiếng Việt.
  return <Lookup roomId={parseRoomId(phong) ?? phong.toUpperCase().slice(0, 12)} />;
}
