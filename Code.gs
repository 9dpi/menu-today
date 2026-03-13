/**
 * CONFIGURATION
 */
const SPREADSHEET_ID = '1GyEo-OVIV4J2hospqVHJDRgjBzZyf5aHFbge7Xe0xJ0';
const SHEET_NAME = 'Sheet1';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY'; // Thay thế bằng API Key của bạn

/**
 * Hàm khởi tạo Web App
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Menu Today - Admin Dashboard')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Hàm lấy dữ liệu thực đơn ngày hôm nay để show lên Web App
 */
function getTodayMenu() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), "GMT+7", "dd/MM/yyyy");
  
  // Bỏ qua header (hàng 1) và lọc theo ngày
  const todayRows = data.slice(1).filter(row => {
    try {
      const rowDate = row[0] instanceof Date ? row[0] : new Date(row[0]);
      return Utilities.formatDate(rowDate, "GMT+7", "dd/MM/yyyy") === today;
    } catch (e) {
      return false;
    }
  });
  
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

/**
 * Hàm chạy tự động hàng ngày (Trigger 00:00)
 * Hoàn thiện: Tích hợp AI Gemini để tìm kiếm/tạo thực đơn Việt Nam phong phú
 */
function generateDailyContent() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  
  const promptAI = `
    Bạn là một chuyên gia ẩm thực Việt Nam. Hãy tạo thực đơn cho ngày hôm nay bao gồm 1 bữa Trưa (Lunch) và 1 bữa Tối (Dinner).
    Yêu cầu cho mỗi bữa:
    1. Menu_Items: Danh sách 3 món ăn Việt Nam truyền thống hoặc hiện đại phổ biến, dễ làm.
    2. Prompt_Video: Câu lệnh chi tiết bằng tiếng Anh để tạo video/ảnh món ăn theo phong cách cinematic photography, high-end food style.
    3. TikTok_Title: Tiêu đề giật gân, thu hút (Hook).
    4. Description: Mô tả ngắn gọn, hấp dẫn về thực đơn.
    5. Hashtags: Bộ 5-10 hashtag tối ưu (ví dụ: #menutoday #vietnamesefood #comnha...).

    Trả về kết quả dưới dạng JSON mảng có 2 đối tượng (Lunch và Dinner) với các key: type, menu, prompt, title, desc, tags.
  `;

  try {
    const response = callGeminiAI(promptAI);
    const content = JSON.parse(response);

    content.forEach(item => {
      const newRow = [
        new Date(), 
        item.type, // "Lunch" hoặc "Dinner"
        item.menu, 
        item.prompt, 
        item.title, 
        item.desc, 
        item.tags, 
        "Pending"
      ];
      sheet.appendRow(newRow);
    });
    
    Logger.log("Đã tạo thực đơn thành công!");
  } catch (e) {
    Logger.log("Lỗi khi gọi AI hoặc lưu dữ liệu: " + e.message);
  }
}

/**
 * Hàm phụ trợ gọi API Gemini
 */
function callGeminiAI(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    "contents": [{
      "parts": [{
        "text": prompt
      }]
    }],
    "generationConfig": {
      "response_mime_type": "application/json"
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  return json.candidates[0].content.parts[0].text;
}
