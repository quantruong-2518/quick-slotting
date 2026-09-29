import { getRoom, updateRoom } from "@/lib/phong-api";

export async function GET(req: Request, ctx: RouteContext<"/api/phong/[id]">) {
  return getRoom(req, (await ctx.params).id);
}

export async function PUT(req: Request, ctx: RouteContext<"/api/phong/[id]">) {
  return updateRoom(req, (await ctx.params).id);
}
