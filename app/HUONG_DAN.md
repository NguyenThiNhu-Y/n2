# Luyện thi JLPT N2

Web học N2 gồm từ vựng, ngữ pháp, đề thi thật và đọc hiểu. Mở thẳng `index.html` bằng trình duyệt là chạy, không cần cài gì.

## Có gì trong app

| Tab | Nội dung |
|---|---|
| **Hôm nay** | Đếm ngược ngày thi, việc nên làm hôm nay: 20 từ mới, 5 mẫu ngữ pháp mới, thẻ đến hạn ôn, câu đề sai cần làm lại |
| **Từ vựng** | 1160 từ sách *Mimi Kara Oboeru N2*, chia 13 unit. Thẻ học có chữ Hán, cách đọc, nghĩa, âm Hán Việt, câu ví dụ có furigana kèm bản dịch, từ liên quan. Quiz 5 dạng: nghĩa, cách đọc (đáp án nhiễu kiểu JLPT), chữ Hán, điền từ vào câu, chọn từ theo nghĩa |
| **Ngữ pháp** | 141 mẫu *Shinkanzen N2* và 110 mẫu N3 để ôn lại. Mỗi mẫu có cách kết nối, giải thích, ví dụ, thẻ học có lịch ôn, và 2 câu quiz kiểu 文法形式 |
| **Luyện đề** | 31 đề JLPT N2 thật từ 7/2010 tới 12/2025, phần 言語知識 (問題1–9). Làm nguyên đề hoặc theo từng dạng; có đồng hồ; chấm xong có dịch câu, giải thích từng lựa chọn. Câu sai quay lại theo lịch 1 → 3 → 7 → 14 → 30 ngày |
| **Đọc hiểu** | 348 bài đọc (問題10–14) từ 31 đề. Có hướng dẫn cách làm, đồng hồ theo thời gian mục tiêu, furigana hỗ trợ, nghe bài, tô vàng căn cứ đáp án sau khi chấm, bản dịch và từ vựng của bài |
| **Tra từ** | Tìm theo kana, chữ Hán, nghĩa hoặc Hán Việt |
| **⚙︎** | Ngày thi, cách hiện thẻ, đồng bộ nhiều máy, xuất/nhập tiến độ |

## Mẹo ôn

- **Mỗi ngày:** 20 từ mới + 5 mẫu ngữ pháp mới; tối bấm *Ôn* ở trang Hôm nay.
- **Mỗi tuần:** 1–2 đề thật bấm giờ, đọc kỹ giải thích câu sai.
- **Đọc hiểu:** 1–2 bài mỗi ngày. Lần đầu tắt furigana và canh giờ, sau đó xem chỗ tô vàng và bản dịch.
- Phím tắt khi học thẻ: `Space` lật thẻ, `1` chưa nhớ, `2` nhớ rồi, `←` `→` thẻ trước/sau.

## Cấu trúc thư mục

```
index.html, style.css           giao diện
app.js                          từ vựng, ngữ pháp, thẻ học, quiz, luyện đề
reading.js                      đọc hiểu
sync.js, sync-config.js         đồng bộ qua Firebase
vocab/*.jsonl                   từ vựng (Mimi Kara)
grammar/*.jsonl                 ngữ pháp (n2_*, n3_*)
past/<năm-tháng>.jsonl          đề thật, phần 言語知識
reading/<năm-tháng>.jsonl       đề thật, phần đọc hiểu
build_data.py                   gộp các thư mục trên -> data.js
data.js                         file sinh tự động, đừng sửa tay
```

## Sửa dữ liệu

1. Sửa file `.jsonl` tương ứng (mỗi dòng một bản ghi).
2. Chạy `python3 build_data.py`.
3. Tăng số `?v=` trong `index.html` để trình duyệt tải lại file mới.

Ký hiệu trong bài đọc và câu ví dụ: `{漢字|よみ}` là furigana in sẵn trong đề; `[漢字|よみ]` là furigana hỗ trợ (bật/tắt được); `__…__` là phần gạch chân; `[…]` trong câu ví dụ là từ đang học.

## Đưa lên GitHub Pages

Thư mục `n2/` có sẵn `.gitignore` (bỏ qua mp3, pdf, rar, zip, vì nặng hơn 1 GB) và `index.html` ở gốc, tự chuyển vào `app/`.

```bash
cd n2
git init && git add . && git commit -m "Luyện thi N2"
git branch -M main
git remote add origin https://github.com/<tên-github>/<tên-repo>.git
git push -u origin main
```

Trên GitHub vào **Settings → Pages → Branch: main / (root) → Save**. Web có ở `https://<tên-github>.github.io/<tên-repo>/`.

Trước khi `git add .`, nên chạy `git status` để chắc không có file nặng nào lọt vào.

## Đồng bộ nhiều máy

Dùng chung Firebase project `tuvungn4` với app N4 và HSK. Tiến độ N2 lưu ở document `users/{username}.n2`, không đè lên app khác. Username tối đa 27 ký tự. Muốn tách project riêng: thay `projectId` và `apiKey` trong `sync-config.js`.

## Lưu ý về dữ liệu

- **Phần nghe (聴解) không có**, và đề thi thử (Thaolejp) chưa đưa vào.
- Đa số file đề là bản gõ lại bằng Word nên có lỗi gõ. Các lỗi rõ ràng đã được sửa và ghi trong trường `note` của câu đó. Đề 12/2018 chỉ có 73 câu vì bản gõ lại thiếu 2 câu 問題4.
- Đáp án đã đối chiếu với bảng đáp án chính thức. Có 2 chỗ khác biệt: đề 7/2011 câu 75 (bản gõ lại có thể đảo nhãn sơ đồ) đã bỏ khỏi bài đọc; đề 7/2019 câu 43 và 12/2019 câu 46, ô ★ đã chỉnh theo đáp án chính thức.
- Giải thích tiếng Việt, bản dịch và âm Hán Việt được soạn thêm, không có trong sách gốc. Nếu thấy chỗ nào chưa đúng, sửa trong `.jsonl` như hướng dẫn ở trên.
