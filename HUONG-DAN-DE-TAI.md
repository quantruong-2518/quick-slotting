# [TÊN ĐỀ TÀI – TỰ ĐIỀN]

> **Đề tài sáng tạo:** [TÊN ĐỀ TÀI – TỰ ĐIỀN]
> **Tác giả:** [Họ tên] · **Đơn vị:** [Đơn vị] · **Năm:** [Năm]

---

## Mục lục

1. [Vấn đề thực tế](#1-vấn-đề-thực-tế)
2. [Giải pháp trong một câu](#2-giải-pháp-trong-một-câu)
3. [Sản phẩm trông như thế nào](#3-sản-phẩm-trông-như-thế-nào)
4. [Luồng sử dụng từ đầu đến cuối](#4-luồng-sử-dụng-từ-đầu-đến-cuối)
5. [Bên trong hoạt động thế nào (giải thích cho người không rành kỹ thuật)](#5-bên-trong-hoạt-động-thế-nào)
6. [Công nghệ đã dùng và lý do chọn](#6-công-nghệ-đã-dùng-và-lý-do-chọn)
7. [Vài đoạn code đáng khoe](#7-vài-đoạn-code-đáng-khoe)
8. [Cách xây dựng thật nhanh](#8-cách-xây-dựng-thật-nhanh)
9. [Bảo mật và quyền riêng tư](#9-bảo-mật-và-quyền-riêng-tư)
10. [Kết quả, hạn chế và hướng phát triển](#10-kết-quả-hạn-chế-và-hướng-phát-triển)
11. [Hướng dẫn tự chạy lại sản phẩm](#11-hướng-dẫn-tự-chạy-lại-sản-phẩm)

---

## 1. Vấn đề thực tế

Mỗi kỳ thi trên máy tính, người tổ chức phải làm một việc rất mất công:

- Có **hàng trăm thí sinh** đến từ nhiều đơn vị (ĐV) khác nhau.
- Yêu cầu: **hai người cùng ĐV không được ngồi cạnh nhau** (để hạn chế trao đổi bài).
- Cách làm cũ: ngồi tay với bảng Excel, xếp rồi sửa, sửa rồi lại vướng. Một phòng 100 máy có thể mất **cả buổi**, và vẫn dễ sót.
- Ngày thi, thí sinh đứng chen nhau trước cửa phòng để dò tờ giấy dán tên, hỏi mãi vẫn không thấy chỗ của mình.

**Hai nỗi đau chính:**

| Ai | Nỗi đau |
|---|---|
| Cán bộ tổ chức | Xếp chỗ thủ công chậm, dễ sai, đổi phòng là làm lại từ đầu |
| Người dự thi | Không biết mình ngồi máy số mấy, phải chen chúc dò danh sách |

---

## 2. Giải pháp trong một câu

> Một trang web **tự động xếp chỗ trong vài giây** sao cho không ai cùng ĐV ngồi cạnh nhau, rồi cho mỗi người **tự tra chỗ bằng điện thoại** chỉ với Mã CC hoặc quét mã QR.

**Điểm khác biệt:**

- **Nhanh:** 3 bước, vài giây ra kết quả.
- **Dễ dùng:** ít nút, chữ to, tiếng Việt đời thường, dành cho cán bộ 40–50 tuổi.
- **Không cần cài đặt:** mở trình duyệt là dùng.
- **Không cần tài khoản:** không đăng ký, không đăng nhập.
- **Chính xác:** biết trước khi nào *không thể* xếp được và báo rõ lý do (xem mục 7.2).

---

## 3. Sản phẩm trông như thế nào

Sản phẩm gồm **hai màn hình**:

### Màn 1 – Dành cho người tổ chức (máy tính)

Một "trợ lý" 3 bước:

```
  ① Sơ đồ phòng  ──►  ② Danh sách  ──►  ③ Xếp chỗ
  (vẽ phòng thi)      (nhập người thi)    (bấm nút, nhận kết quả)
```

### Màn 2 – Dành cho người dự thi (điện thoại)

Nhập **Mã phòng + Mã CC** (hoặc quét QR) → thấy ngay **họ tên, đơn vị, số máy, vị trí** (khoang nào, hàng nào, ghế nào) bằng chữ cỡ lớn.

> 📷 *[Chèn ảnh chụp màn hình bước 1]*
> 📷 *[Chèn ảnh chụp màn hình bước 2]*
> 📷 *[Chèn ảnh chụp màn hình bước 3 – có màu theo từng ĐV]*
> 📷 *[Chèn ảnh chụp màn hình trang tra cứu trên điện thoại]*

---

## 4. Luồng sử dụng từ đầu đến cuối

```
NGƯỜI TỔ CHỨC (máy tính)                       NGƯỜI DỰ THI (điện thoại)
────────────────────────                       ─────────────────────────

① Vẽ sơ đồ phòng
   số khoang · số hàng · số cột
   bỏ máy hỏng · chọn cách đánh số
        │
        ▼
② Đưa danh sách vào
   dán từ Excel / tải file .xlsx
   web tự kiểm tra: thiếu dòng? trùng mã?
   web tự gộp tên ĐV viết khác nhau
        │
        ▼
③ Bấm "Xếp chỗ"
   máy tính toán vài giây
   hiển thị sơ đồ có tô màu theo ĐV
   báo nếu có cặp không tránh được
        │
        ▼
④ Bấm "Chia sẻ phòng thi"
   nhận Mã phòng 6 ký tự + link + mã QR ─────► Quét QR / nhập Mã phòng
   in QR dán ngoài cửa phòng                     │
                                                 ▼
                                          Nhập Mã CC của mình
                                                 │
                                                 ▼
                                          Thấy: "Nguyễn Văn A · ĐV X
                                                 Máy số 27
                                                 Khoang 2 · Hàng 4 · Ghế 3"
```

### Chi tiết từng bước

**Bước ① – Sơ đồ phòng.** Người dùng chỉ cần nhập vài con số: phòng có mấy *khoang* (dãy bàn tách bởi lối đi), mỗi khoang mấy *hàng*, mấy *cột*. Máy nào hỏng thì bấm bỏ đi. Có 2 kiểu đánh số máy: *thẳng* (1→2→3 mỗi hàng đều từ trái sang phải) hoặc *rắn* (hàng lẻ đi ngược lại, giống lối đi của người phát bài). Sơ đồ được **lưu ngay trên máy** để lần sau dùng lại.

**Bước ② – Danh sách.** Dán thẳng từ Excel hoặc tải file lên. Web tự nhận ra cột nào là *họ tên, Mã CC, đơn vị* (kể cả khi tên cột viết không dấu hay hơi khác), rồi **báo lỗi bằng lời dễ hiểu**: "Dòng 15 thiếu Mã CC", "Mã CC001 bị trùng ở dòng 8 và 32". Tên đơn vị như *"Sở Y tế"* và *"SỞ Y TẾ."* được tự gộp làm một.

**Bước ③ – Xếp chỗ.** Chọn thế nào là "ngồi cạnh" (chỉ trái–phải; cả trước–sau; hay cả chéo). Bấm nút. Kết quả hiện ra dạng sơ đồ, mỗi ĐV một màu nên nhìn là biết không có hai ô cùng màu chạm nhau. Nếu **không thể** xếp hoàn hảo (ví dụ một ĐV có 60 người mà phòng chỉ đủ chỗ cho 40 người không kề nhau), web nói rõ ĐV nào, bao nhiêu người, tối đa bao nhiêu.

**Bước ④ – Chia sẻ.** Một cú bấm tạo Mã phòng + link + QR. Chia sẻ lại sau khi sửa vẫn **giữ nguyên mã**, nên QR đã in không bị vô hiệu.

---

## 5. Bên trong hoạt động thế nào

Phần này giải thích ý tưởng, chưa cần biết lập trình.

### 5.1. Biến "cái phòng" thành các con số

Với máy tính, một phòng thi chỉ là **danh sách các ghế được đánh số 0, 1, 2, 3…**. Mỗi ghế có một danh sách "hàng xóm" (ghế nào ngồi kề nó). Mọi thứ trong web đều dùng **cùng một cách đánh số ghế này** – nhờ vậy các phần ghép với nhau rất khớp và ít lỗi.

> Lối đi giữa hai khoang được coi như **bức tường**: người ngồi hai bên lối đi *không* bị tính là ngồi cạnh nhau.

### 5.2. Xếp chỗ bằng cách "xáo bài rồi sửa lỗi"

Thay vì tính toán phức tạp, ta làm giống cách một người khéo tay làm:

1. **Xáo ngẫu nhiên** toàn bộ người vào các ghế.
2. **Tìm những chỗ đang sai** (hai người cùng ĐV ngồi kề).
3. **Đổi chỗ** người đang sai với một người khác, nếu đổi xong ít sai hơn thì giữ.
4. Lặp lại cho tới khi **hết sai** hoặc **hết 4 giây**.
5. Nếu kẹt, **xáo lại từ đầu** và thử lần nữa, giữ kết quả tốt nhất.

Cách này rất nhanh, và với đa số phòng thi cho ra kết quả hoàn hảo trong chưa đầy một giây.

### 5.3. Biết trước khi nào "bất khả thi"

Đây là điểm sáng tạo của đề tài. Có những trường hợp **toán học chứng minh là không thể** (ví dụ một hàng 10 ghế thì một ĐV chỉ đặt được tối đa 5 người không kề nhau). Thay vì để máy chạy mãi rồi báo "không được", web **tính trước giới hạn** và báo ngay điều đó, kèm con số cụ thể để người tổ chức tự quyết định (tăng phòng, đổi cách tính "kề", hoặc chấp nhận).

### 5.4. Tra chỗ mà không lộ danh sách

Khi chia sẻ, máy chủ chỉ lưu dữ liệu tối thiểu, và **chỉ trả lời từng người một** ("Mã CC này ngồi đâu?"). **Không có cách nào** lấy về cả danh sách thí sinh. Mỗi phòng tự **hết hạn sau 30 ngày**.

---

## 6. Công nghệ đã dùng và lý do chọn

| Thành phần | Công nghệ | Nói đơn giản | Vì sao chọn |
|---|---|---|---|
| Khung web | **Next.js 16** (React 19) | Bộ khung để dựng trang web hiện đại | Phổ biến, nhanh, một dự án chứa cả giao diện lẫn phần máy chủ nhỏ |
| Ngôn ngữ | **TypeScript** | JavaScript có "kiểm tra chính tả" | Bắt lỗi ngay khi viết, không đợi đến lúc chạy |
| Giao diện | **Tailwind CSS v4** | Bộ "màu và kích thước" dựng sẵn | Đồng bộ màu, chữ, bo góc toàn sản phẩm bằng một bảng quy ước |
| Tính toán nặng | **Web Worker** | Một "nhân viên chạy nền" trong trình duyệt | Xếp chỗ chạy ở nền, trang không bị đơ |
| Đọc/ghi Excel | **ExcelJS** | Đọc file .xlsx | Người dùng quen Excel; chỉ tải khi cần để trang vào nhanh |
| Mã QR | **uqr** | Vẽ mã QR | Nhỏ, không phụ thuộc dịch vụ ngoài |
| Lưu dữ liệu chia sẻ | **Upstash Redis** | Một "tủ lưu trữ" trên mạng, tự xoá theo hạn | Miễn phí ở quy mô nhỏ, hỗ trợ hết hạn tự động |
| Kiểm thử | **Vitest** | Chương trình tự kiểm tra chương trình | Sửa code không sợ làm hỏng chỗ khác |
| Triển khai | **Vercel** | Nơi đưa web lên mạng | Đẩy code là web tự cập nhật, có địa chỉ công khai |

### Nguyên tắc thiết kế

1. **Không cần máy chủ cho phần lớn công việc.** Vẽ phòng, nhập danh sách, xếp chỗ đều chạy *ngay trong trình duyệt* của người dùng. Máy chủ chỉ tham gia khi bấm "Chia sẻ".
2. **Tách "bộ não" khỏi "giao diện".** Toàn bộ logic nằm trong thư mục `lib/` và đều có bài kiểm tra tự động. Giao diện chỉ hiển thị.
3. **Một nút chính mỗi màn hình.** Người dùng không bao giờ phải đoán bấm gì tiếp.
4. **Ngôn ngữ đời thường.** Dùng "ĐV", "Mã CC", "DS" – những từ cán bộ vốn quen dùng.

---

## 7. Vài đoạn code đáng khoe

> Các đoạn dưới đây được lược bớt và chú thích tiếng Anh để dễ trình bày.

### 7.1. Biến căn phòng thành bản đồ "ghế kề ghế"

Chỉ khoảng 20 dòng, nhưng đây là nền cho mọi thứ còn lại: cách tính "ngồi kề" thay đổi chỉ bằng việc đổi danh sách hướng.

```ts
// Build the "who sits next to whom" graph for a room.
// nb[i] = list of seat indexes adjacent to seat i.
export function buildNeighbors(room: RoomConfig, seats: Seat[], adj: Adjacency): number[][] {
  const index = new Map(seats.map((s, i) => [s.key, i]));

  // The rule "what counts as adjacent" is just a list of directions:
  //   lr   = left/right only
  //   lrfb = left/right + front/back
  //   all  = plus both diagonals
  const dirs: [number, number][] =
    adj === "lr"   ? [[0, 1]] :
    adj === "lrfb" ? [[0, 1], [1, 0]] :
                     [[0, 1], [1, 0], [1, 1], [1, -1]];

  const nb: number[][] = seats.map(() => []);
  seats.forEach((s, i) => {
    for (const [dr, dc] of dirs) {
      const r2 = s.row + dr;
      const c2 = s.gcol + dc;
      if (r2 >= room.rows || c2 < 0 || c2 >= room.blocks * room.cols) continue;

      // The aisle between blocks acts as a wall: no adjacency across it.
      if (Math.floor(c2 / room.cols) !== s.block) continue;

      const j = index.get(seatKey(r2, c2));
      if (j === undefined) continue;   // that machine is switched off
      nb[i].push(j);                    // link both ways at once
      nb[j].push(i);
    }
  });
  return nb;
}
```

**Điểm hay:** muốn thêm luật "kề" mới (ví dụ chỉ tính chéo), chỉ cần thêm một dòng hướng – không phải viết lại thuật toán.

### 7.2. Chứng minh trước "không thể xếp" bằng toán

Đây là phần "ăn tiền" nhất: thay vì chạy thử rồi thất bại, web dùng một **định lý toán học** để biết chắc giới hạn.

```ts
// Max number of people from ONE unit that can sit with nobody adjacent.
// Returns null when there is no fast exact answer.
export function maxIndependent(nb: number[][], usable: number, bipartiteColor?: (i: number) => 0 | 1) {

  // Case 1: seats form simple lines (left/right only).
  // A line of n seats fits at most ceil(n / 2) non-adjacent people.
  const isPath = nb.slice(0, usable).every((n) => n.filter((j) => j < usable).length <= 2);
  if (isPath && !bipartiteColor) {
    /* ...walk each line, add Math.ceil(size / 2) per line... */
  }
  if (!bipartiteColor) return null;

  // Case 2: a grid (front/back too) is a two-colour "chessboard" graph.
  // Kőnig's theorem: max independent set = seats - maximum matching.
  // So we only need a maximum matching, found with Kuhn's augmenting paths.
  const matchR = new Int32Array(usable).fill(-1);
  const tryKuhn = (u: number, vis: Uint8Array): boolean => {
    for (const v of nb[u]) {
      if (v >= usable || vis[v]) continue;
      vis[v] = 1;
      // Take v if it is free, or if its current partner can move elsewhere.
      if (matchR[v] < 0 || tryKuhn(matchR[v], vis)) { matchR[v] = u; return true; }
    }
    return false;
  };
  let match = 0;
  for (let k = 0; k < usable; k++)
    if (bipartiteColor(k) === 0 && tryKuhn(k, new Uint8Array(usable))) match++;
  return usable - match;
}
```

**Nói cho người không rành:** giống ván cờ vua – các ô đen chỉ kề ô trắng. Toán học cho phép đếm "tối đa bao nhiêu quân đặt không chạm nhau" rất nhanh mà không phải thử từng cách.

### 7.3. Xếp chỗ: xáo bài rồi sửa lỗi thông minh

```ts
// Repeat: shuffle -> repair -> keep the best -> stop at zero conflicts or timeout.
while (true) {
  const pool = [...people, ...emptySeats];
  shuffle(pool, rng);                       // 1. random start
  const r = localSearch(items, movable, nb, unitOfPerson, deadline, rng, now);  // 2. repair
  if (r.total < bestTotal) { bestTotal = r.total; best = r.items; }             // 3. keep best
  if (bestTotal === 0 || now() > deadline) break;                               // 4. stop
}
```

Phần "sửa lỗi" chỉ nhìn **những ghế đang sai**, chứ không nhìn cả phòng:

```ts
// Pick a random seat that is currently in conflict.
const a = list[Math.floor(rng() * list.length)];

// Try 6 random swap partners, keep the one that helps most.
for (let t = 0; t < 6; t++) {
  const b = movable[Math.floor(rng() * m)];
  const before = pairCost(a, b);
  swap(a, b);
  const delta = pairCost(a, b) - before;   // negative = fewer conflicts
  swap(a, b);                               // undo, this was only a trial
  /* remember the best candidate */
}

// Accept improving swaps; occasionally (3%) accept a worse one
// to escape dead ends, like shaking a jammed drawer.
if (bestDelta <= 0 || rng() < 0.03) { swap(a, bestPartner); /* update conflict list */ }
```

**Điểm hay:** chỉ tính lại chi phí của **hai ghế bị đổi và hàng xóm của chúng**, không đếm lại cả phòng – nên mỗi bước rất rẻ, xếp cả nghìn người vẫn nhanh.

### 7.4. Chạy nền để trang không bị đơ

```ts
// arrange.worker.ts — runs in a background thread, never on the UI thread.
self.onmessage = (e: MessageEvent<ArrangeRequest>) => {
  const { room, unitOfPerson, adj, spare } = e.data;

  // Rebuild seats and neighbours from the plain room config we were sent.
  const seats = buildSeats(room);
  const nb = buildNeighbors(room, seats, adj);

  const r = arrange({ unitOfPerson, seatCount: seats.length, nb, spare, /* ... */ });

  // A Set cannot be posted as-is in every case, so send it as an array.
  self.postMessage({ items: r.items, conflictSeats: [...r.conflictSeats], /* ... */ });
};
```

Mỗi lần bấm "Xếp chỗ", giao diện tạo một worker mới và **huỷ worker cũ** – bấm liên tục cũng không bị chồng chéo.

### 7.5. Mã phòng dễ đọc, dễ gõ, an toàn

```ts
// No 0/O, 1/I/L: people read these codes aloud and type them on phones.
export const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomId(): string {
  let id = "";
  // Reject bytes that would make some letters more likely than others
  // (256 is not divisible by 31), so every character is equally random.
  const limit = 256 - (256 % ID_ALPHABET.length);
  while (id.length < 6) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit && id.length < 6) id += ID_ALPHABET[b % ID_ALPHABET.length];
    }
  }
  return id;
}
```

**Điểm hay:** vừa thân thiện với người dùng (không nhầm chữ O với số 0), vừa đúng chuẩn mật mã (dùng bộ sinh số ngẫu nhiên của trình duyệt, loại bỏ độ lệch thống kê).

### 7.6. Tra cứu linh hoạt: gõ "CC001" hay "001" đều ra

```ts
const stripCC = (s: string) => s.replace(/^CC/, "");

// Exact match first; if that fails, ignore the "CC" prefix on both sides.
export function findPerson(people: StoredRoom["people"], input: string) {
  const code = normalizeCode(input);
  let hit = people[code];
  if (!hit) {
    const bare = stripCC(code);
    const key = Object.keys(people).find((k) => stripCC(k) === bare);
    if (key) hit = people[key];
  }
  return hit ? { seat: hit[0], name: hit[1], unit: hit[2] } : null;
}
```

### 7.7. Gộp tên đơn vị viết khác nhau

```ts
// Remove Vietnamese accents so "Sở Y tế" and "SO Y TE" compare equal.
const stripVN = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")   // split letters from accent marks, drop marks
   .replace(/đ/g, "d").replace(/Đ/g, "D");             // đ is a separate letter, handle it by hand

// Key used to decide "these two unit names are the same unit":
// lowercase, no accents, punctuation collapsed into single spaces.
const unitKey = (s: string) => stripVN(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
```

### 7.8. Bảo vệ token chỉnh sửa và chống dò mã

```ts
// The edit token is shown to the organiser once; the server only stores its hash.
// Even if the database leaked, nobody could use it to edit a room.
export async function hashToken(token: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Compare in constant time, so an attacker cannot guess the token
// character by character by measuring how fast the server answers.
export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

---

## 8. Cách xây dựng thật nhanh

Bí quyết nằm ở **thứ tự làm việc** và **những thứ cố tình không làm**.

### 8.1. Nguyên tắc "nhanh"

| Nguyên tắc | Áp dụng |
|---|---|
| **Làm phần khó nhất trước** | Thuật toán xếp chỗ làm và kiểm thử xong *trước khi* vẽ bất kỳ nút bấm nào |
| **Không backend nếu chưa cần** | Ban đầu mọi thứ chạy trong trình duyệt; máy chủ chỉ thêm ở giai đoạn cuối, khi có tính năng chia sẻ |
| **Tái sử dụng một mô hình duy nhất** | "Ghế số i" được dùng chung cho xếp chỗ, hiển thị, chia sẻ, tra cứu → viết ít, sửa ít |
| **Có bảng quy ước giao diện** | Màu, cỡ chữ, bo góc định nghĩa một lần, không chọn lại từng nút |
| **Dùng thư viện có sẵn cho việc "ai cũng làm"** | Excel, QR, lưu trữ – không tự phát minh lại |
| **Kiểm thử tự động cho phần logic** | Đổi thuật toán vẫn yên tâm |
| **Có trợ lý AI cùng làm** | AI viết nháp, người quyết định hướng đi và kiểm tra kết quả |

### 8.2. Các chặng xây dựng

```
Chặng 1 ─ Bộ não (logic thuần, chưa có giao diện)
   ├─ Mô hình phòng → ghế → hàng xóm
   ├─ Thuật toán xếp chỗ
   └─ Bài kiểm tra tự động cho cả hai
        ▼
Chặng 2 ─ Nhập liệu
   ├─ Đọc CSV / dán từ Excel / file .xlsx
   ├─ Tự nhận cột, báo thiếu, báo trùng
   └─ Gộp tên ĐV viết khác nhau
        ▼
Chặng 3 ─ Giao diện 3 bước
   ├─ Bảng quy ước màu/chữ
   ├─ Sơ đồ phòng, tô màu theo ĐV
   └─ Chạy thuật toán ở nền (Web Worker)
        ▼
Chặng 4 ─ Tra cứu trên điện thoại
   ├─ Bản đầu: nhét dữ liệu vào link (sau dấu #), không cần máy chủ
   └─ Bản sau: mã phòng + QR + máy chủ nhỏ (mục 9)
        ▼
Chặng 5 ─ Hoàn thiện
   ├─ Bắt lỗi nhập liệu bằng lời dễ hiểu
   ├─ Kiểm tra trên điện thoại thật
   └─ Đưa lên Vercel
```

### 8.3. Một quyết định đáng kể: bản tra cứu đầu tiên và bản hiện tại

- **Bản đầu:** toàn bộ dữ liệu được **nén và nhét vào chính đường link**. Ưu điểm: không cần máy chủ, không lưu gì ở đâu. Nhược điểm: link rất dài, khó tạo QR đẹp, khó cập nhật.
- **Bản hiện tại:** link ngắn dạng `/tra-cuu/ABC123`, dữ liệu lưu tạm 30 ngày, tra từng người. Ưu điểm: QR gọn, cập nhật không đổi mã, giới hạn số lần tra để chống dò.

Việc **chấp nhận đổi hướng** khi thấy bản đầu chưa đủ tốt là một phần của làm nhanh: làm bản đơn giản nhất chạy được, dùng thử, rồi nâng cấp đúng chỗ đau.

---

## 9. Bảo mật và quyền riêng tư

Vì dữ liệu thí sinh là dữ liệu nhạy cảm, sản phẩm tuân theo các cam kết:

1. **Xử lý tại chỗ.** Nhập danh sách, xếp chỗ đều diễn ra ngay trong trình duyệt của người tổ chức.
2. **Chỉ gửi lên máy chủ khi bấm "Chia sẻ phòng thi"** – và chỉ những thông tin cần cho việc tra chỗ (mã, số máy, tên, ĐV).
3. **Không bao giờ có chức năng tải cả danh sách.** Người tra chỉ nhận đúng dòng của mình.
4. **Giới hạn 30 lần tra/phút** cho mỗi người trên mỗi phòng → không thể dò đoán hàng loạt Mã CC.
5. **Tự hết hạn sau 30 ngày.**
6. **Chỉ chủ phòng mới sửa được** (nhờ mã bí mật chỉ lưu dưới dạng băm một chiều).
7. **Kiểm tra chặt mọi dữ liệu gửi lên** (kiểu dữ liệu, độ dài, số lượng tối đa 2.000 người, kích thước tối đa) để chống dữ liệu bẩn.
8. **Không có quảng cáo, không theo dõi, không dịch vụ phân tích bên thứ ba.**

---

## 10. Kết quả, hạn chế và hướng phát triển

### Kết quả (điền số liệu thực tế của bạn)

| Chỉ tiêu | Trước đây | Với sản phẩm |
|---|---|---|
| Thời gian xếp 1 phòng | [… giờ] | [… giây / … phút] |
| Số lỗi xếp sai (cùng ĐV kề nhau) | […] | 0 (hoặc được báo rõ lý do) |
| Thời gian thí sinh tìm chỗ | [… phút] | [… giây] |
| Số người hỗ trợ trước cửa phòng | […] | […] |

### Hạn chế hiện tại

- Mới xếp cho **một phòng** mỗi lần.
- Cần có mạng để tra cứu bằng điện thoại.
- Kết quả xếp mỗi lần chạy có thể khác nhau (vì có yếu tố ngẫu nhiên) – vẫn đúng luật, chỉ khác cách xếp.

### Hướng phát triển

- Xếp **nhiều phòng / nhiều đợt** trong một lần.
- **Khoá cố định** một số người vào chỗ trước khi xếp (ví dụ người khuyết tật cần ngồi gần cửa).
- **In giấy báo chỗ ngồi** có sẵn mã QR.
- Thêm bộ kiểm thử giao diện tự động cho toàn bộ luồng 3 bước.

---

## 11. Hướng dẫn tự chạy lại sản phẩm

Dành cho người có kiến thức cơ bản về máy tính.

**Yêu cầu:** cài Node.js phiên bản 20.9 trở lên.

```bash
# 1. Install the dependencies
npm install

# 2. Run in development mode, then open http://localhost:3000
npm run dev

# 3. Run every automatic check (types, style, tests)
npm run check

# 4. Build the production version
npm run build
```

**Bật tính năng chia sẻ khi đưa lên mạng (Vercel):** tạo một cơ sở dữ liệu Upstash Redis miễn phí và khai báo hai biến môi trường:

```
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Không khai báo thì khi chạy thử trên máy, dữ liệu chia sẻ được giữ tạm trong bộ nhớ; còn trên bản chính thức, nút chia sẻ sẽ báo "Chưa kết nối kho lưu trữ".

**Cấu trúc thư mục (để tìm nhanh):**

```
app/          Các trang và API nhỏ (/, /tra-cuu, /api/phong)
components/   Các mảnh giao diện (3 bước, hộp chia sẻ, trang tra cứu)
lib/          Toàn bộ "bộ não": xếp chỗ, sơ đồ phòng, đọc danh sách, chia sẻ
              (mỗi file có bài kiểm tra đi kèm)
```

---

*[Tên đề tài – tự điền] · [Tác giả] · [Ngày hoàn thành]*
