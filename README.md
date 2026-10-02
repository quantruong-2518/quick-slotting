# Xếp chỗ nhanh

Ứng dụng web xếp chỗ ngồi thi tự động: không để hai người cùng đơn vị ngồi cạnh nhau.
Người dự thi tra chỗ ngồi của mình trên điện thoại bằng mã công chức.

## Chức năng

1. **Sơ đồ phòng**: thêm một hay nhiều phòng; mỗi phòng nhập số khoang, số hàng, số cột mỗi khoang; bấm vào ô để bỏ/thêm máy; đánh số kiểu rắn hoặc thẳng; đặt số **máy dự phòng** (mỗi ca luôn để trống); lưu và mở lại sơ đồ (lưu trong trình duyệt).
2. **Danh sách**: kéo thả hoặc chọn file `.xlsx`/`.csv`, hoặc dán từ Excel; tải file mẫu 4 cột (Họ tên, Mã CC, Đơn vị, Lĩnh vực dự kiểm tra; lĩnh vực có thể để trống); tự nhận cột, báo dòng thiếu và mã trùng, gộp tên đơn vị viết khác nhau. Đông hơn số chỗ thì báo cần mấy ca.
3. **Xếp chỗ**: tự chia người vào các ca và các phòng (các ca đông gần bằng nhau, mỗi đơn vị rải đều), rồi xếp chỗ trong từng phòng; có thể tăng số ca. Bảng tổng Ca × Phòng cho biết mỗi ô bao nhiêu người, còn cặp nào cùng đơn vị ngồi cạnh không. Chọn cách tính "ngồi cạnh" (trái-phải / thêm trước-sau / thêm chéo), xếp lại ngẫu nhiên, xem chi tiết từng khoang (họ tên, Mã CC, đơn vị, lĩnh vực), tìm người theo tên hoặc Mã CC, **đổi chỗ** một người sang phòng khác, ca khác (máy có người thì hai người đổi cho nhau). Tải Excel (mỗi phòng mỗi ca một trang sơ đồ tô màu + danh sách), chia sẻ (mã phòng, link và mã QR).
4. **Tra cứu**: bấm "Chia sẻ phòng thi" ở bước 3 để có mã phòng (ví dụ `K7M2QX`) dùng chung cho mọi phòng, mọi ca, link `/tra-cuu/K7M2QX` và mã QR. Người dự thi quét mã hoặc mở link, nhập Mã CC để xem ca, phòng, số máy, khoang, hàng, ghế, lĩnh vực và vị trí trên sơ đồ (màn điện thoại). Vào `/tra-cuu` không kèm mã thì nhập cả Mã phòng và Mã CC. Link dùng được 30 ngày; xếp lại rồi bấm "Cập nhật" thì mã cũ vẫn dùng được.

## Quyền riêng tư

Danh sách chỉ xử lý trong trình duyệt cho tới khi bạn bấm **Chia sẻ phòng thi**. Lúc đó tên, mã CC,
đơn vị, lĩnh vực, ca, phòng và số máy được lưu trên kho Upstash Redis trong **30 ngày** rồi tự xoá. Người dự thi chỉ tra được
từng người một khi biết mã phòng và Mã CC; máy chủ không bao giờ trả cả danh sách, và có giới hạn
30 lần tra cứu mỗi phút. Trang tra cứu gắn `noindex`. Chỉ gửi mã phòng cho đúng người dự thi.

## Chạy trên máy

Cần Node.js 20.9 trở lên.

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # kiểm tra kiểu + lint + test
npm run build
```

## Đưa lên Vercel

1. Đẩy mã nguồn lên GitHub.
2. Vào vercel.com → Add New → Project → chọn repo → Deploy.
3. Kết nối kho lưu trữ (bắt buộc để dùng "Chia sẻ phòng thi"), xem bên dưới rồi Redeploy.
4. Hoặc dùng CLI: `npx vercel` rồi `npx vercel --prod`.

### Kết nối Upstash Redis trên Vercel

1. Vào project trên Vercel → **Storage** → **Upstash for Redis** → **Connect** (chọn gói Free).
2. Vercel tự thêm biến môi trường `KV_REST_API_URL` và `KV_REST_API_TOKEN` (hoặc `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`).
3. **Redeploy** để biến có hiệu lực.

Chạy trên máy (`npm run dev`) không cần Redis: dữ liệu chia sẻ nằm trong bộ nhớ và mất khi tắt máy chủ.
Muốn dùng Redis thật khi chạy máy: `npx vercel env pull .env.local`.

Bản đồ mã nguồn và quy ước: xem `CLAUDE.md`.
