import { createRoom } from "@/lib/phong-api";

export function POST(req: Request) {
  return createRoom(req);
}
