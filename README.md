# Xếp chỗ nhanh

Ứng dụng web xếp chỗ ngồi thi tự động: không để hai người cùng đơn vị ngồi cạnh nhau.
Người dự thi tra chỗ ngồi của mình trên điện thoại bằng mã công chức.

## Chức năng

1. **Sơ đồ phòng**: nhập số khoang, số hàng, số cột mỗi khoang; bấm vào ô để bỏ/thêm máy; đánh số kiểu rắn hoặc thẳng; lưu và mở lại sơ đồ (lưu trong trình duyệt).
2. **Danh sách**: kéo thả hoặc chọn file `.xlsx`/`.csv`, hoặc dán từ Excel; tải file mẫu; tự nhận cột, báo dòng thiếu và mã trùng, gộp tên đơn vị viết khác nhau.
3. **Xếp chỗ**: chọn cách tính "ngồi cạnh" (trái-phải / thêm trước-sau / thêm chéo), xếp lại ngẫu nhiên, xem chi tiết từng khoang, tải Excel (sơ đồ tô màu + danh sách theo số máy), sao chép link tra cứu.
4. **Tra cứu (`/tra-cuu`)**: màn điện thoại, nhập mã CC để xem khoang, hàng, ghế và vị trí trên sơ đồ.

## Quyền riêng tư

Không có máy chủ lưu dữ liệu. Danh sách chỉ xử lý trong trình duyệt. Link tra cứu chứa dữ liệu
đã nén trong phần `#...` của URL: phần này **không bao giờ được gửi lên máy chủ**
(kể cả Vercel), và trang tra cứu gắn `noindex`. Chỉ gửi link cho đúng người dự thi.

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
2. Vào vercel.com → Add New → Project → chọn repo → Deploy. Không cần biến môi trường.
3. Hoặc dùng CLI: `npx vercel` rồi `npx vercel --prod`.

Toàn bộ trang được build tĩnh (Static), chạy nhanh và gần như không tốn chi phí.

Bản đồ mã nguồn và quy ước: xem `CLAUDE.md`.
