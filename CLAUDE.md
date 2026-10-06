# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Chỉ cần tra docs Next khi đụng API của Next (route, layout, metadata, `next.config`, font). Sửa giao diện hay `lib/` thì không cần.

# Xếp chỗ nhanh

Web xếp chỗ ngồi thi (tiếng Việt): chia người dự thi vào nhiều phòng, nhiều ca; không để hai người cùng đơn vị (ĐV) ngồi cạnh nhau; người dự thi tra chỗ trên điện thoại bằng mã CC. Next.js 16 App Router + TypeScript + Tailwind v4, build tĩnh toàn bộ, deploy Vercel.
Người dùng chính là cán bộ 40–50 tuổi: chữ rõ, ít nút, câu chữ đời thường, viết tắt quen thuộc (ĐV, Mã CC, DS).

## Lệnh

- `npm run dev` · `npm run build`
- `npm run check` = `next typegen` + `tsc` + eslint + vitest. Chạy trước khi báo xong việc.
- Một test: `npx vitest run lib/seating.test.ts -t "gộp tên"`

## Kiến trúc

- **Hai trang**: `/` là wizard 3 bước (sơ đồ phòng → danh sách → xếp chỗ); `/tra-cuu` là màn điện thoại. `components/wizard.tsx` giữ toàn bộ state, các bước chỉ nhận props. Đổi phòng hay danh sách thì kết quả bị xoá (`reset()`: huỷ worker, xoá kết quả, số ca về tự động); riêng đổi tên phòng (biểu tượng bút cạnh tên ở bước 1 và bước 3, `EditableName`) thì giữ nguyên kết quả (`sameExceptName`).
- **Nhiều phòng × nhiều ca**: bước 1 có nhiều phòng (`RoomEntry[]`: ô nhập + sơ đồ, tối đa `MAX_ROOMS`), mỗi phòng có `reserve` = số máy dự phòng luôn để trống mỗi ca. Sức chứa một phòng mỗi ca = số máy − `reserve`. Số ca ít nhất = ⌈số người / tổng sức chứa⌉ (tối đa `MAX_SESSIONS`), người dùng tăng được ở bước 3. Kết quả là `slots[ca][phòng]` (`Plan`), mỗi ô là một `SlotResult` có `items` theo chỉ số ghế của phòng đó, giá trị là chỉ số người trong cả danh sách.
- **Mô hình ghế** (`lib/room.ts`): phòng = `blocks` khoang, mỗi khoang `rows` × `cols`. Khi các khoang khác nhau thì `room.sizes` (`BlockSize[]`, từ trái sang) giữ số hàng, số cột riêng từng khoang, còn `rows`/`cols` chỉ là số lớn nhất. **Luôn đọc kích thước qua `blockLayout(room)`** (`{rows, cols, start}` từng khoang), không đọc thẳng `room.rows`/`room.cols`; `roomDims(sizes)` dựng các trường này và bỏ `sizes` khi các khoang giống hệt nhau. Ở bước 1, chọn "Khác nhau" thì nhập riêng từng khoang (`Draft.sizes`). `gcol` là cột tính trên cả phòng (cộng dồn số cột các khoang bên trái); hàng tính riêng trong từng khoang, hàng 0 ở phía giám thị; khoá ô là `"row-gcol"`; `room.off` là các ô đã bỏ máy. `buildSeats` trả ghế theo thứ tự số máy, kiểu rắn hoặc thẳng (`style`): `order: "room"` (mặc định, sơ đồ cũ không có trường này) đánh số theo hàng ngang cả phòng, khoang hết hàng thì bỏ qua; `order: "block"` đánh hết khoang này mới sang khoang kia. Đổi `style`/`order`/`start` ở bước 1 thì sơ đồ đổi ngay, không cần tạo lại. **Chỉ số ghế `i` dùng chung mọi nơi**: `items[i]` = chỉ số người hoặc -1, `nb[i]` = ghế kề, `conflictSeats`. Lối đi giữa các khoang cắt quan hệ kề. Vị trí trên cả kỳ thi là `SeatRef {s, r, i}` (ca, phòng, ghế).
- **Chia ca/phòng** (`lib/sessions.ts`): `planCounts` chia đều số người cho các ca (chênh ≤ 1), trong ca chia theo sức chứa từng phòng; `distribute` rải mỗi ĐV đều khắp các ô bằng "vé cách đều", kết quả cố định theo thứ tự danh sách. Phần này nhẹ nên chạy trên luồng chính (trong `run()` của wizard); "Xếp lại", đổi kiểu kề, đổi máy trống thì **giữ nguyên ai ở ca/phòng nào** (kể cả người đã chuyển tay), chỉ xếp lại ghế; đổi số ca thì chia lại từ đầu.
- **Xếp chỗ**: mỗi lần chạy, wizard tạo Worker mới (huỷ worker cũ) và gửi `ArrangeRequest {rooms, unitOf, groups[ca][phòng], adj, spare}`. Worker xếp lần lượt từng ô bằng `arrange()`: xáo trộn rồi tìm kiếm cục bộ, mỗi ô tối đa 4s (1,2s nếu biết trước là không thể đạt 0), cả lần chạy khoảng 12s, ô xong sớm thì dồn thời gian cho ô sau (`maxTimeMs`). Worker gửi `progress` sau mỗi ô và `done` ở cuối; `Set` được đổi thành mảng khi gửi về. `spare: "tail"` chỉ dùng p ghế đầu (trống ở số lớn nhất, nên máy dự phòng nằm cuối); `"spread"` dùng mọi ghế.
- **Đổi chỗ bằng tay** (`components/move-dialog.tsx`): chọn ca, phòng, máy; máy có người thì hai người đổi chỗ (`swapSeats`), gợi ý máy trống ít người cùng ĐV kề nhất (`suggestSeat`), cảnh báo khi ngồi cạnh người cùng ĐV hoặc dùng mất máy dự phòng. Sau khi đổi, wizard tính lại xung đột của các ô bị đụng bằng `evaluate()` và đặt `edited`; xếp lại hay đổi số ca khi đã đổi tay thì hỏi xác nhận. Trên sơ đồ bước 3 còn **kéo thả** (`@dnd-kit/core`, `components/draggable-seat.tsx`): kéo máy có người thả vào máy có người khác trong cùng ca, cùng phòng, `components/swap-dialog.tsx` hỏi xác nhận rồi hai ô trượt đổi chỗ; ô trống không kéo, không thả vào được (chuyển vào máy trống thì dùng nút "Đổi chỗ" trong danh sách).
- **Bố cục bước 3** (`components/result-step.tsx`, một card, từ trên xuống): hàng công cụ (tiêu đề, trạng thái, "Tuỳ chọn xếp", "Xếp lại") → chỗ đang xem (chọn ca, chọn phòng, sơ đồ, chú thích màu ĐV) → danh sách khoang đang chọn. Số ca, kiểu kề, máy trống nằm trong khối "Tuỳ chọn xếp", mặc định đóng. Ca và phòng chọn bằng `SlotPicker`: tới `MAX_TABS` lựa chọn là thanh `Segmented`, nhiều hơn là `<select>`. Chấm đỏ ở ca = ca đó còn cặp trùng ở phòng nào đó; chấm đỏ ở phòng = phòng đó còn cặp trùng trong ca đang xem. Còn cặp trùng thì nhãn trạng thái là nút "Xem", nhảy tới ô kế tiếp còn trùng (`nextConflictSlot`). Danh sách chỉ liệt kê người; máy trống gộp một dòng cuối (`seatRanges`).
- **Giới hạn khả thi** (`maxIndependent`): tính chính xác cho kiểu kề `lr` (đường thẳng, mỗi đoạn ⌈n/2⌉) và `lrfb` (đồ thị hai phía, định lý Kőnig); kiểu `all` không tính. Vượt giới hạn thì báo `capacityIssues`.
- **Danh sách** (`lib/people.ts`): nhận hàng tiêu đề theo tên cột tiếng Việt (bỏ dấu), báo dòng thiếu và mã trùng, gộp tên ĐV chỉ khác hoa/thường/dấu/ký tự. ĐV xếp theo số người giảm dần, `unitId` = vị trí trong danh sách đó, màu lấy từ `unitColor(unitId)`. Cột "Lĩnh vực dự kiểm tra" (`Person.field`) không bắt buộc: có tiêu đề "Lĩnh vực…" thì nhận, không tiêu đề thì là cột thứ 4; để trống không phải lỗi. Lĩnh vực chỉ để hiển thị (bảng, Excel, tra cứu), không ảnh hưởng cách xếp.
- **Chia sẻ phòng thi** (bước 3 → "Chia sẻ phòng thi"): **một mã cho cả kỳ thi** (mọi phòng, mọi ca). `components/share-dialog.tsx` hiện mã phòng 6 ký tự (bảng chữ không có 0/O/1/I/L), link `/tra-cuu/<MÃ>` và mã QR (`uqr`, import động; tải PNG qua canvas). Máy khách gọi `lib/share-client.ts` (`publishRoom`: PUT nếu đã có `{id, token}` trong localStorage `xcn.share.v1` theo `shareKey(id các phòng)` = các `RoomConfig.id` sắp xếp nối bằng `+`, một phòng thì đúng là id phòng như trước; 404 hoặc chưa có thì POST) nên chia sẻ lại cùng bộ phòng vẫn giữ mã, QR đã in vẫn dùng được. Kết quả đổi sau khi chia sẻ thì so dấu vân tay (`fingerprint`) và hiện nút "Cập nhật".
  - API `app/api/phong/` (route mỏng, logic ở `lib/phong-api.ts`): `POST /api/phong` → `{id, token, expiresAt}`; `PUT /api/phong/[id]` (Bearer token, 403 sai token, 404 hết hạn); `GET /api/phong/[id]` → `{title, expiresAt}`; `GET ...?ma=XXX` thêm `{sessions, room (sơ đồ phòng của người đó), person: {code, session, seat, name, unit, field}}` hoặc 404. Payload gửi lên: `{title, rooms, people: [mã, ca, phòng, số máy, tên, ĐV, lĩnh vực][]}`; vẫn nhận dạng cũ một phòng `{room, people: [mã, máy, tên, ĐV]}`. **API không bao giờ trả cả danh sách.** Khớp mã: đúng mã đã chuẩn hoá trước, sau đó bỏ tiền tố "CC" hai phía (`findPerson`). Giới hạn 30 lần tra cứu/phút/IP/phòng và 30 lần tạo phòng/giờ/IP (429).
  - Logic thuần (kiểm tra dữ liệu, sinh id/token, dựng payload, khớp mã) ở `lib/room-share.ts`. Kho lưu ở `lib/kv.ts`: Upstash Redis qua REST bằng `fetch`, chỉ import từ route handler. Khoá `phong:{ID}` (JSON `{v:3, title, rooms, sessions, people: {mãCC chuẩn hoá: [ca, phòng, số máy, họ tên, ĐV, lĩnh vực]}, tokenHash, expiresAt}`, TTL 30 ngày, làm mới khi cập nhật) và `rl:{ip}:{id}:{phút}`. Bản `v:2` (phòng chưa có `sizes`, `order`) đọc y nguyên, bản `v:1` cũ (một phòng) được `parseStored` đổi sang dạng mới khi đọc. Token sửa chỉ lưu dạng SHA-256.
  - Biến môi trường: `KV_REST_API_URL` + `KV_REST_API_TOKEN` hoặc `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Thiếu biến: dev/test dùng Map trong bộ nhớ; production trả 503 "Chưa kết nối kho lưu trữ (Upstash Redis) trên Vercel."
  - Trang tra cứu: `/tra-cuu` (form Mã phòng + Mã CC) và `/tra-cuu/[phong]` (từ QR/link), cùng dùng `components/lookup.tsx`. Đổi cấu trúc `StoredRoom` hoặc cách đánh số ghế thì tăng `v` và xử lý dữ liệu cũ.
- Sơ đồ đã lưu nằm trong localStorage (`xcn.rooms.v1`, kèm `reserve`, `sizes`, `order`; sơ đồ cũ thiếu thì coi là 0 máy dự phòng, các khoang giống nhau, đánh số cả phòng), đọc qua `useSyncExternalStore`. Một sơ đồ đã lưu chỉ chọn được cho một phòng trong kỳ thi (trùng id sẽ lẫn mã chia sẻ).
- **Excel kết quả** (`resultXlsx`): mỗi phòng mỗi ca một trang sơ đồ (ô ghi số máy, họ tên, Mã CC, ĐV, lĩnh vực), trang "Danh sách" có cột Ca/Phòng/Lĩnh vực khi cần. Có nhiều ca hoặc nhiều phòng thì "Tải Excel" mở `components/export-dialog.tsx`: chia file theo ca (mặc định khi nhiều ca), theo phòng hoặc gộp một file, lấy hết hoặc chỉ một ca, một phòng. `excelFiles()` (thuần, có test) tính danh sách file và tên file; mỗi file gọi `resultXlsx(..., {sessions, rooms})` rồi tải lần lượt. Tên trang ghi thứ thay đổi trong file: file một ca thì là tên phòng, file một phòng thì là "Ca N", cả hai thì "Ca N · Phòng", chỉ một trang thì "Sơ đồ"; ô A1 và cột Ca luôn ghi số ca thật.
- Test xếp chỗ dùng `seededRng` + `timeBudgetMs` để kết quả ổn định.

## Quy ước

- Máy chủ chỉ lưu dữ liệu qua `/api/phong` + Upstash Redis, và chỉ khi người tổ chức bấm "Chia sẻ phòng thi". Không bao giờ để API trả cả danh sách người dự thi. Không thêm analytics hay dịch vụ ngoài nào khác nếu chưa được yêu cầu.
- Logic thuần nằm trong `lib/` và có test. Component chỉ lo hiển thị.
- Thuật toán xếp chỗ (`arrange`) chỉ chạy trong `lib/arrange.worker.ts`, không gọi trên luồng giao diện. Các hàm nhẹ (`distribute`, `evaluate`, `suggestSeat`) được gọi trên luồng chính.
- `exceljs` (~1MB) chỉ import động trong `lib/excel.ts`.
- Khoang hiển thị bằng vùng nền màu (`SeatZones`), không ghi chữ "Khoang 1…", không nhãn hàng.
- Mỗi màn chỉ một nút chính (`variant="primary"`); nút phụ dùng mặc định `secondary`.

## Giao diện (token ở `app/globals.css`)

Không viết mã màu hay `[...]` tuỳ ý trong component; thiếu thì thêm token vào `@theme`.

- Màu: `brand` (+ `-strong` `-soft` `-ink` `-line` `-wash`), `page`, `subtle`, `control` (+ `-hover`), `ink`, `muted`, `faint`, `line` (+ `-strong`), `zone` (+ `-hover` `-active`), `seat-off`, `ok`/`warn`/`danger` (+ `-bg`). Màu ĐV: `unitColor()`.
- Chữ: `text-caption` 13/20px · `text-body` 15/24px · `text-title` 22/28px (đã kèm chiều cao dòng), tiêu đề card `text-lg`; không dùng `text-sm`, `text-base`. Chữ đậm (`font-semibold`) chỉ cho tiêu đề, nút, họ tên, số máy. Chỉ số cỡ lớn ở trang tra cứu mới dùng giá trị riêng.
- Bo góc `rounded-chip` 4 / `rounded-control` 6 / `rounded-card` 8; bóng `shadow-card`, `shadow-raised`.
- Khoảng cách theo bội số của 4: giữa các khối ngoài và đệm card 24 (`gap-6`, `p-6`), giữa các phần trong một khối 12–16, đệm khối con 16 (`p-4`). Chiều cao nút: 40 mặc định, 48 cho thanh nút cuối trang.
- Tiện ích: `field` (ô nhập chuẩn), `pb-safe` (chừa thanh home trên iPhone), `italic-note` (chữ nghiêng thật cho chú thích; font nghiêng khai báo riêng trong `app/layout.tsx`, không preload).
- Component dùng chung trong `components/ui/`: `Button` (thêm `variant="ghost"`: nút chữ cho thao tác lặp lại ở từng dòng bảng), `Card`, `Pill`, `Notice` (hộp cảnh báo/lỗi), `NumberStepper` (`stacked`: nhãn nhỏ nằm trên), `Segmented` (lựa chọn có `alert` thì hiện chấm đỏ), `EditableName` (tên kèm biểu tượng bút, bấm để sửa; `iconOnly` chỉ hiện bút), icon.

## Việc có thể làm tiếp

- Khoá cố định một số người vào chỗ trước khi xếp.
- In giấy báo chỗ ngồi (kèm mã QR đã có sẵn).
- Giờ thi cho từng ca (hiện trang tra cứu chỉ ghi "Ca 2").
- Thêm test giao diện (Playwright) cho luồng 3 bước và trang tra cứu.
