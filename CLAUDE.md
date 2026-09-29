# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Chỉ cần tra docs Next khi đụng API của Next (route, layout, metadata, `next.config`, font). Sửa giao diện hay `lib/` thì không cần.

# Xếp chỗ nhanh

Web xếp chỗ ngồi thi (tiếng Việt): không để hai người cùng đơn vị (ĐV) ngồi cạnh nhau; người dự thi tra chỗ trên điện thoại bằng mã CC. Next.js 16 App Router + TypeScript + Tailwind v4, build tĩnh toàn bộ, deploy Vercel.
Người dùng chính là cán bộ 40–50 tuổi: chữ rõ, ít nút, câu chữ đời thường, viết tắt quen thuộc (ĐV, Mã CC, DS).

## Lệnh

- `npm run dev` · `npm run build`
- `npm run check` = `next typegen` + `tsc` + eslint + vitest. Chạy trước khi báo xong việc.
- Một test: `npx vitest run lib/seating.test.ts -t "gộp tên"`

## Kiến trúc

- **Hai trang**: `/` là wizard 3 bước (sơ đồ phòng → danh sách → xếp chỗ); `/tra-cuu` là màn điện thoại. `components/wizard.tsx` giữ toàn bộ state, các bước chỉ nhận props. Đổi phòng hay danh sách thì kết quả bị xoá (`setRoom`/`setList` bọc lại).
- **Mô hình ghế** (`lib/room.ts`): phòng = `blocks` khoang × `rows` × `cols`. `gcol` là cột tính trên cả phòng; khoá ô là `"row-gcol"`; `room.off` là các ô đã bỏ máy. `buildSeats` trả ghế theo thứ tự số máy (kiểu rắn hoặc thẳng). **Chỉ số ghế `i` dùng chung mọi nơi**: `items[i]` = chỉ số người hoặc -1, `nb[i]` = ghế kề, `conflictSeats`. Lối đi giữa các khoang cắt quan hệ kề.
- **Xếp chỗ**: mỗi lần chạy, wizard tạo Worker mới (huỷ worker cũ) và gửi `ArrangeRequest`. Worker dựng lại ghế và danh sách kề rồi gọi `arrange()`: xáo trộn rồi tìm kiếm cục bộ, hết giờ sau 4s (1,2s nếu biết trước là không thể đạt 0). `Set` được đổi thành mảng khi gửi về. `spare: "tail"` chỉ dùng p ghế đầu (trống ở số lớn nhất); `"spread"` dùng mọi ghế.
- **Giới hạn khả thi** (`maxIndependent`): tính chính xác cho kiểu kề `lr` (đường thẳng, mỗi đoạn ⌈n/2⌉) và `lrfb` (đồ thị hai phía, định lý Kőnig); kiểu `all` không tính. Vượt giới hạn thì báo `capacityIssues`.
- **Danh sách** (`lib/people.ts`): nhận hàng tiêu đề theo tên cột tiếng Việt (bỏ dấu), báo dòng thiếu và mã trùng, gộp tên ĐV chỉ khác hoa/thường/dấu/ký tự. ĐV xếp theo số người giảm dần, `unitId` = vị trí trong danh sách đó, màu lấy từ `unitColor(unitId)`.
- **Link tra cứu** (`lib/share.ts`): `/tra-cuu#<lz-string>` chứa `ShareData` v1 = phòng (không có id) + các dòng `[mã CC, số máy, họ tên, ĐV]`. Trang tra cứu dựng lại ghế từ phòng để tìm vị trí. Đổi cấu trúc này hay cách đánh số thì link cũ sẽ hỏng: tăng `v`.
- Sơ đồ đã lưu nằm trong localStorage (`xcn.rooms.v1`), đọc qua `useSyncExternalStore`.
- Test xếp chỗ dùng `seededRng` + `timeBudgetMs` để kết quả ổn định.

## Quy ước

- Không có backend. Dữ liệu người dự thi chỉ xử lý trong trình duyệt; link tra cứu dùng phần `#`. Không thêm API route, analytics hay dịch vụ gửi dữ liệu ra ngoài nếu chưa được yêu cầu.
- Logic thuần nằm trong `lib/` và có test. Component chỉ lo hiển thị.
- Thuật toán xếp chỗ chỉ chạy trong `lib/arrange.worker.ts`, không gọi trên luồng giao diện.
- `exceljs` (~1MB) chỉ import động trong `lib/excel.ts`.
- Khoang hiển thị bằng vùng nền màu (`SeatZones`), không ghi chữ "Khoang 1…", không nhãn hàng.
- Mỗi màn chỉ một nút chính (`variant="primary"`); nút phụ dùng mặc định `secondary`.

## Giao diện (token ở `app/globals.css`)

Không viết mã màu hay `[...]` tuỳ ý trong component; thiếu thì thêm token vào `@theme`.

- Màu: `brand` (+ `-strong` `-soft` `-ink` `-line` `-wash`), `page`, `subtle`, `control` (+ `-hover`), `ink`, `muted`, `faint`, `line` (+ `-strong`), `zone` (+ `-hover` `-active`), `seat-off`, `ok`/`warn`/`danger` (+ `-bg`). Màu ĐV: `unitColor()`.
- Chữ: `text-caption` 13px · `text-body` 15px · `text-title` 22px, ngoài ra dùng thang mặc định. Chỉ số cỡ lớn ở trang tra cứu mới dùng giá trị riêng.
- Bo góc `rounded-chip` 4 / `rounded-control` 6 / `rounded-card` 8; bóng `shadow-card`, `shadow-raised`.
- Tiện ích: `field` (ô nhập chuẩn), `pb-safe` (chừa thanh home trên iPhone).
- Component dùng chung trong `components/ui/`: `Button`, `Card`, `Pill`, `Notice` (hộp cảnh báo/lỗi), `NumberStepper`, `Segmented`, icon.

## Việc có thể làm tiếp

- Nhiều phòng thi / nhiều đợt trong một lần xếp.
- Khoá cố định một số người vào chỗ trước khi xếp.
- Mã QR cho link tra cứu; in giấy báo chỗ ngồi.
- Thêm test giao diện (Playwright) cho luồng 3 bước và trang tra cứu.
