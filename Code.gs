/**
 * CONFIGURATION
 */
const SPREADSHEET_ID = '1GyEo-OVIV4J2hospqVHJDRgjBzZyf5aHFbge7Xe0xJ0';
const SHEET_NAME = 'Sheet1';
const DEEPSEEK_API_KEY = 'YOUR_DEEPSEEK_API_KEY'; // Thay thế bằng API Key của bạn

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
 * Hoàn thiện: Tích hợp AI DeepSeek để tìm kiếm/tạo thực đơn Việt Nam phong phú
 */
function generateDailyContent() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  
  const systemPrompt = "Bạn là một chuyên gia ẩm thực Việt Nam lão luyện.";
  const userPrompt = `
    Hãy tạo thực đơn cho ngày hôm nay bao gồm 1 bữa Trưa (Lunch) và 1 bữa Tối (Dinner).
    Yêu cầu cho mỗi bữa:
    1. Menu_Items: Danh sách 3 món ăn Việt Nam truyền thống hoặc hiện đại phổ biến, dễ làm.
    2. Prompt_Video: Câu lệnh chi tiết bằng tiếng Anh để tạo video/ảnh món ăn theo phong cách cinematic photography, high-end food style.
    3. TikTok_Title: Tiêu đề giật gân, thu hút (Hook).
    4. Description: Mô tả ngắn gọn, hấp dẫn về thực đơn.
    5. Hashtags: Bộ 5-10 hashtag tối ưu (ví dụ: #menutoday #vietnamesefood #comnha...).

    TRẢ VỀ KẾT QUẢ DUY NHẤT DƯỚI DẠNG JSON MẢNG có 2 đối tượng (Lunch và Dinner) với các key: type, menu, prompt, title, desc, tags. 
    Không thêm văn bản giải thích.
  `;

  try {
    const response = callDeepSeekAI(systemPrompt, userPrompt);
    // DeepSeek đôi khi trả về markdown code block, cần lọc bỏ
    const cleanJson = response.replace(/```json|```/g, '').trim();
    const content = JSON.parse(cleanJson);

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
    
    Logger.log("Đã tạo thực đơn thành công với DeepSeek!");
  } catch (e) {
    Logger.log("Lỗi khi gọi AI hoặc lưu dữ liệu: " + e.message);
  }
}

/**
 * Hàm phụ trợ gọi API DeepSeek (OpenAI-compatible)
 */
function callDeepSeekAI(systemContent, userContent) {
  const url = "https://api.deepseek.com/chat/completions";
  
  const payload = {
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": systemContent},
      {"role": "user", "content": userContent}
    ],
    "stream": false,
    "response_format": {
      "type": "json_object"
    }
  };

  const options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + DEEPSEEK_API_KEY,
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  if (responseCode !== 200) {
    throw new Error(`DeepSeek API Error (${responseCode}): ${responseText}`);
  }

  const json = JSON.parse(responseText);
  return json.choices[0].message.content;
}
