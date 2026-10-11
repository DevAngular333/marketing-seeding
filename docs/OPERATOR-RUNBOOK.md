# Runbook vận hành

## Khởi động và kiểm tra

```powershell
cd D:\build-agentic-AI
.\Invoke-Agentic.cmd -Action status
.\Invoke-Agentic.cmd -Action seeding-test
.\Invoke-Agentic.cmd -Action seeding-start
.\Invoke-Agentic.cmd -Action seeding-status
```

Dashboard: `http://127.0.0.1:4318`.

## Luồng mỗi ngày

1. Orca automation tạo artifact Blender trong productRepo và kiểm chứng/hash file.
2. Đăng ký artifact vào campaign.
3. AI tạo story có grounding; người vận hành đọc disclosure/claim.
4. Tạo biến thể riêng theo từng target ở trạng thái `draft`.
5. Người vận hành duyệt target rules, consent và nội dung.
6. Dashboard chỉ sao chép nội dung và mở composer allowlisted; người vận hành tự submit.
7. Sau submit, ghi permalink cụ thể và bằng chứng; nếu không có thì trạng thái không được là `published`.
8. 23:30 mỗi ngày theo giờ Asia/Saigon, Orca chỉ theo dõi bài có `status=published` và `publicationUrl`, mở đúng permalink trong Chrome đã đăng nhập, đọc mọi counter hiển thị rõ cho impressions/views, reactions, comments/replies, shares/reposts, clicks và leads, rồi lưu screenshot/hash. Counter thiếu hoặc mơ hồ phải giữ `UNKNOWN`, không suy ra 0. Comment/reply chỉ được ghi khi có `externalId` ổn định và không tự soạn hoặc gửi phản hồi. Login wall và CAPTCHA không được vượt qua; API chính thức là tùy chọn, không phải điều kiện vận hành.

## Email

Chỉ active email target khi có nguồn audience opt-in, căn cứ đồng ý nhận tin và cơ chế unsubscribe. Không nhập danh sách mua ngoài, không dùng tài khoản cũ để né spam filter, không tự động gửi từ browser session.

## Recovery

Windows task `Jang Global Seeding Dashboard` chạy supervisor từ `D:\project-all\marketing-seeding`. Runtime state không nằm trong project source nên việc cập nhật/rebuild source không làm mất campaign history.
