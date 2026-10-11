# Yêu cầu 07/10/2026 — Jang Trịnh

## Nội dung chốt từ Zalo

1. Nghiên cứu mô hình “24/7 outreach agent” của Explee như một tham chiếu sản phẩm, không sao chép tuyên bố chưa kiểm chứng.
2. Product Hunt và Indie Hackers: chuẩn bị nguồn/kênh trước, test quy trình cho mượt, sau đó mới tăng quy mô trong giới hạn chính sách.
3. Dashboard chạy liên tục, theo dõi Facebook, Reddit, Threads; LinkedIn là kênh bắt buộc và email là một nhánh riêng.
4. Pipeline chuẩn: `một sản phẩm -> AI dựng câu chuyện/kịch bản -> biến thể theo kênh -> chạy theo lịch`.
5. Lớp AI phải viết tự nhiên, phù hợp từng cộng đồng và dựa trên bằng chứng trong repository.
6. Traffic, reaction, comment, reply và trạng thái từng bài phải được cập nhật theo chu kỳ bốn giờ và hiển thị trên dashboard.

## Diễn giải an toàn bắt buộc

- “Human-like” nghĩa là văn phong tự nhiên, có ngữ cảnh và trung thực; không giả danh con người và không che giấu automation khi nền tảng yêu cầu công bố.
- Không mua/farm tài khoản cũ, không né trust gate, không giải CAPTCHA tự động, không join hàng loạt, không spam hoặc dùng email không có opt-in.
- Tool chỉ tạo bản nháp, mở composer cho người vận hành và ghi bằng chứng sau khi người đó tự bấm đăng/gửi.
- Mọi publication cần permalink cụ thể và evidence. Mọi reply cần grounding hash, phê duyệt và evidence gửi.
- API chính thức chỉ dùng khi chủ tài khoản đã cấp quyền. Thiếu quyền phải hiện `UNKNOWN/UNVERIFIED`, không thay bằng số 0 giả.

## Acceptance contract

- Bảy kênh có policy riêng: Facebook Groups, Threads, Reddit, Product Hunt, Indie Hackers, LinkedIn và email opt-in.
- Artifact phải nằm trong `campaign.productRepo`, được resolve realpath và hash SHA-256.
- Story phải có ít nhất một grounding file nằm trong productRepo; biến thể kênh sinh ở `draft`.
- Schedule luôn có `mode=draft_only` và `requiresHumanPublishApproval=true`.
- Email target chỉ active khi có `consentBasis`, `audienceSource` và `unsubscribeMechanism`.
- Canonical flow graph không được bỏ mất reference; mọi reference không resolve được phải tăng counter.
- State v1 nâng lên v2 theo kiểu additive, giữ nguyên campaign/post/metric/audit cũ.
