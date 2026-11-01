阳光钱（DQT） – Nói tiếng Trung tự tin hơn

BẢN GEMINI AI
- Giữ giao diện chibi, các chủ đề HSK 1–6, đăng nhập Supabase và lưu tiến độ.
- 小猫老师 dùng Gemini API thật để phản hồi câu hỏi theo ngữ cảnh, duy trì hội thoại và hỏi tiếp.
- AI chấm bài theo thang 100, phân tích lỗi ngữ pháp/từ vựng/diễn đạt, đề xuất cách sửa, cấu trúc thay thế và bài mẫu.
- Có ghi âm/nghe lại và nhận diện giọng nói trên trình duyệt (tùy trình duyệt hỗ trợ).

CÀI ĐẶT AI GEMINI
1. Mở https://aistudio.google.com/app/apikey và tạo API key Gemini.
2. Trong Netlify > Site configuration > Environment variables, thêm:
   GEMINI_API_KEY = khóa Gemini (giữ bí mật, không đưa vào index.html)
   GEMINI_MODEL = gemini-2.5-flash
   SUPABASE_URL = URL dự án Supabase hiện tại
   SUPABASE_ANON_KEY = publishable/anon key của Supabase
   ALLOWED_EMAIL = tiengameytb@gmail.com
3. Lưu biến môi trường và deploy lại website để Netlify Function nhận cấu hình mới.
4. Kiểm tra hạn mức miễn phí trong Google AI Studio. Free tier có giới hạn theo model và tài khoản; khi hết hạn mức, AI có thể báo lỗi 429 hoặc cần đợi hạn mức làm mới. Không phải miễn phí vô hạn.

LƯU Ý QUAN TRỌNG
- Bản này gọi Gemini ở Netlify Function, API key chỉ nằm ở máy chủ Netlify, không nằm trong mã frontend.
- Google nêu rõ dữ liệu dùng ở Free Tier có thể được dùng để cải thiện sản phẩm; tránh gửi thông tin cá nhân/nhạy cảm trong bài luyện.
- Điểm 100 là đánh giá tham khảo trên nội dung văn bản. Chưa phải chấm phát âm, thanh điệu hay chất lượng âm thanh.
- Ghi âm hiện cho phép ghi và nghe lại trên trình duyệt; file âm thanh chưa được tải lên máy chủ để AI phân tích phát âm.
- Khi dùng vượt Free Tier, không tự động bật thanh toán nếu bạn không liên kết tài khoản thanh toán. Hãy theo dõi hạn mức trong AI Studio.

TRIỂN KHAI
- Giải nén ZIP và triển khai thư mục dự án lên Netlify theo cách có hỗ trợ Netlify Functions (Netlify CLI hoặc Git-based deploy được khuyến nghị).
- Không chỉ tải riêng index.html; thư mục netlify/functions/coach.mjs và netlify.toml phải được triển khai cùng.
- Sau khi thêm biến môi trường, chạy deploy lại.
