import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { GET, PUT } from "./[id]/route";

const room = (name: string) => ({ name, blocks: 1, rows: 2, cols: 2, style: "snake", start: 1, off: [] });
const body = (extra: object = {}) => ({
  title: "Kỳ thi",
  rooms: [room("P1"), room("P2")],
  people: [["CC1038", 1, 0, 3, "Nguyễn An", "Sở A", "Kế toán"], ["CC2001", 2, 1, 4, "Trần Bình", "Sở B", ""]],
  ...extra,
});
const post = (b: unknown, ip = "2.2.2.2") =>
  POST(new Request("http://t/api/phong", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(b) }));
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const get = (id: string, qs = "", ip = "1.1.1.1") =>
  GET(new Request(`http://t/api/phong/${id}${qs}`, { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } }), ctx(id));
const put = (id: string, token: string, b: unknown) =>
  PUT(new Request(`http://t/api/phong/${id}`, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(b) }), ctx(id));

describe("/api/phong", () => {
  it("luồng tạo, xem, tra cứu, cập nhật", async () => {
    const created = await post(body());
    expect(created.status).toBe(201);
    const { id, token } = await created.json();
    expect(id).toMatch(/^[A-Z2-9]{6}$/);

    const meta = await (await get(id)).json();
    expect(meta.title).toBe("Kỳ thi");
    expect(JSON.stringify(meta)).not.toContain("Nguyễn An");
    expect(meta.people).toBeUndefined();

    const hit = await get(id, "?ma=cc1038");
    expect(hit.status).toBe(200);
    const found = await hit.json();
    expect(found.person).toEqual({ code: "CC1038", session: 1, seat: 3, name: "Nguyễn An", unit: "Sở A", field: "Kế toán" });
    expect(found.sessions).toBe(2);
    expect(found.room.name).toBe("P1");
    expect(JSON.stringify(found)).not.toContain("Trần Bình");
    const other = await (await get(id, "?ma=2001")).json();
    expect(other.person).toMatchObject({ name: "Trần Bình", session: 2 });
    expect(other.room.name).toBe("P2");
    expect((await get(id, "?ma=zzz")).status).toBe(404);

    expect((await put(id, "sai-token", body())).status).toBe(403);
    const next = body({ people: [["CC1038", 1, 0, 9, "Nguyễn An", "Sở A", ""]] });
    expect((await put(id, token, next)).status).toBe(200);
    expect((await (await get(id, "?ma=CC1038")).json()).person.seat).toBe(9);
    expect((await get(id, "?ma=CC2001")).status).toBe(404);
  });

  it("vẫn nhận dữ liệu dạng cũ một phòng", async () => {
    const legacy = { title: "P1", room: room("P1"), people: [["CC1038", 3, "Nguyễn An", "Sở A"]] };
    const { id } = await (await post(legacy, "3.3.3.3")).json();
    const found = await (await get(id, "?ma=CC1038")).json();
    expect(found.person).toEqual({ code: "CC1038", session: 1, seat: 3, name: "Nguyễn An", unit: "Sở A", field: "" });
    expect(found.sessions).toBe(1);
  });

  it("từ chối dữ liệu sai và phòng không tồn tại", async () => {
    expect((await post(body({ people: [] }))).status).toBe(400);
    expect((await post({ x: 1 })).status).toBe(400);
    expect((await get("ABCDEF")).status).toBe(404);
    expect((await get("bad")).status).toBe(404);
    expect((await put("ABCDEF", "t", body())).status).toBe(404);
  });

  it("giới hạn 30 lần tra cứu mỗi phút cho mỗi IP và phòng", async () => {
    const { id } = await (await post(body())).json();
    for (let i = 0; i < 30; i++) expect((await get(id, "?ma=CC1038", "9.9.9.9")).status).toBe(200);
    expect((await get(id, "?ma=CC1038", "9.9.9.9")).status).toBe(429);
    expect((await get(id, "?ma=CC1038", "8.8.8.8")).status).toBe(200);
  });

  it("giới hạn 30 lần tạo phòng mỗi giờ cho mỗi IP", async () => {
    for (let i = 0; i < 30; i++) expect((await post(body(), "7.7.7.7")).status).toBe(201);
    expect((await post(body(), "7.7.7.7")).status).toBe(429);
    expect((await post(body(), "6.6.6.6")).status).toBe(201);
  });
});
