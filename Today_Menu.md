cấu trúc mã nguồn cho dự án "Menu Today" của bạn.Dưới đây là đặc tả kỹ thuật chi tiết để bạn triển khai vào Google Apps Script và liên kết với GitHub repo.1. Cấu trúc Database (Google Sheets)Tại Sheet có ID 1GyEo-OVIV4J2hospqVHJDRgjBzZyf5aHFbge7Xe0xJ0, bạn cần thiết lập các tiêu đề cột chính xác tại hàng 1:CộtTên cột (Header)Diễn giảiADateĐịnh dạng DD/MM/YYYYBTypeLunch hoặc DinnerCMenu_ItemsDanh sách 3 món (dạng text/JSON)DPrompt_VideoCâu lệnh chi tiết để gen video/ảnhETikTok_TitleTiêu đề giật gân (Hook)FDescriptionMô tả videoGHashtagsBộ hashtag tối ưu theo ngàyHStatusPending hoặc Posted2. File Backend: Code.gs (Google Apps Script)File này xử lý logic quét dữ liệu, gen nội dung qua AI và trả về giao diện cho Web App.JavaScript/**
 * CONFIGURATION
 */
const SPREADSHEET_ID = '1GyEo-OVIV4J2hospqVHJDRgjBzZyf5aHFbge7Xe0xJ0';
const SHEET_NAME = 'Sheet1';

// Hàm khởi tạo Web App
function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Menu Today - Admin Dashboard')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Hàm lấy dữ liệu thực đơn ngày hôm nay để show lên Web App
function getTodayMenu() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
  
  // Lọc lấy các hàng của ngày hôm nay
  const todayRows = data.filter(row => Utilities.formatDate(new Date(row[0]), "GMT+7", "dd/MM/yyyy") === today);
  
  return todayRows.map(row => ({
    date: row[0],
    type: row[1],
    menu: row[2],
    prompt: row[3],
    title: row[4],
    desc: row[5],
    tags: row[6],
    status: row[7]
  }));
}

// Hàm chạy tự động hàng ngày (Trigger 00:00)
// Ở đây bạn sẽ tích hợp API của Gemini để gen nội dung không trùng lặp
function generateDailyContent() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const promptAI = "Hãy tạo 3 thực đơn trưa và 3 thực đơn tối cho người Việt lười suy nghĩ, kèm prompt hình ảnh và hashtag TikTok.";
  
  // Logic gọi API AI (Placeholder - bạn cần điền API Key)
  // Sau khi có kết quả, appendRow vào Sheet
  const newRow = [
    new Date(), 
    "Lunch", 
    "1. Cơm gà, 2. Bún cá, 3. Phở trộn", 
    "High-end food photography, Vietnamese cuisine...", 
    "Trưa nay ăn gì? Khỏi nghĩ!", 
    "Gợi ý bữa trưa nhanh gọn cho bạn.", 
    "#menutoday #anvat #lunch", 
    "Pending"
  ];
  sheet.appendRow(newRow);
}
3. File Frontend: index.html (Giao diện Web App)Được thiết kế tối giản, hỗ trợ Copy-paste nhanh để bạn tối ưu hóa năng lượng khi làm nội dung TikTok.HTML<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background: #f4f7f6; font-family: 'Segoe UI', sans-serif; }
    .card-menu { border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .copy-btn { cursor: pointer; transition: 0.3s; }
    .copy-btn:active { transform: scale(0.95); }
    .badge-status { font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="container py-4">
    <h2 class="text-center mb-4">🍱 Menu Today Manager</h2>
    <div id="loading" class="text-center">Đang lấy thực đơn hôm nay...</div>
    <div id="content"></div>
  </div>

  <script>
    window.onload = function() {
      google.script.run.withSuccessHandler(renderMenu).getTodayMenu();
    };

    function renderMenu(menus) {
      const container = document.getElementById('content');
      document.getElementById('loading').style.display = 'none';
      
      if (menus.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">Chưa có dữ liệu cho hôm nay. Hãy chạy script generate!</div>';
        return;
      }

      menus.forEach(item => {
        const card = `
          <div class="card card-menu p-3 bg-white">
            <div class="d-flex justify-content-between">
              <h4 class="text-primary">${item.type === 'Lunch' ? '☀️ Bữa Trưa' : '🌙 Bữa Tối'}</h4>
              <span class="badge ${item.status === 'Pending' ? 'bg-warning' : 'bg-success'} badge-status">${item.status}</span>
            </div>
            <hr>
            <p><strong>Thực đơn:</strong> ${item.menu}</p>
            
            <div class="mb-3">
              <label class="form-label text-muted small">Prompt tạo Video/Ảnh</label>
              <div class="input-group">
                <input type="text" class="form-control" value="${item.prompt}" readonly id="p-${item.type}">
                <button class="btn btn-outline-secondary copy-btn" onclick="copyText('p-${item.type}')">Copy</button>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small">TikTok Title & Desc</label>
              <textarea class="form-control mb-2" readonly id="t-${item.type}">${item.title}\n\n${item.desc}\n${item.tags}</textarea>
              <button class="btn btn-dark w-100 copy-btn" onclick="copyText('t-${item.type}')">Copy Toàn bộ Cap & Hashtag</button>
            </div>
          </div>
        `;
        container.innerHTML += card;
      });
    }

    function copyText(id) {
      var copyText = document.getElementById(id);
      copyText.select();
      document.execCommand("copy");
      alert("Đã copy!");
    }
  </script>
</body>
</html>
4. Quy trình triển khai (Step-by-Step)Bước 1 (GSheet): Tạo file Sheet với ID và các cột như mục 1.Bước 2 (Apps Script): Paste code vào Code.gs và tạo mới file index.html trong trình chỉnh sửa Script.Bước 3 (Deploy): Chọn Deploy > New Deployment. Loại hình: Web App. Quyền truy cập: Anyone.Bước 4 (Trigger): Trong Apps Script, chọn biểu tượng đồng hồ (Triggers) > Add Trigger > Chọn hàm generateDailyContent > Time-driven > Day timer > 00:00 to 01:00.Bước 5 (GitHub): Đẩy các file này lên repo 9dpi/menu-today để quản lý phiên bản.5. Logic "Qua mặt TikTok" trong ContentWatcher (AI): Sẽ không gen các từ khóa bị cấm (bán hàng, điều hướng link).Prompt (Image/Video): Tập trung vào style "POV" hoặc "Cinematic" để tăng tính chân thực, giảm tỷ lệ bị đánh dấu là "re-up" hoặc "spam content".