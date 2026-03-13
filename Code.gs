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
  
  const systemPrompt = "Bạn là một chuyên gia ẩm thực Việt Nam lão luyện. Bạn luôn trả về kết quả dưới dạng JSON thuần túy, không có văn bản giải thích.";
  const userPrompt = `
    Hãy tạo thực đơn cho ngày hôm nay bao gồm 1 bữa Trưa (Lunch) và 1 bữa Tối (Dinner).
    Yêu cầu: Trả về một JSON Object có key là "data", chứa mảng 2 đối tượng (Lunch và Dinner).
    Mỗi đối tượng có các key: 
    - "type": "Lunch" hoặc "Dinner"
    - "menu": "Tên 3 món ăn"
    - "prompt": "Câu lệnh tiếng Anh tạo video"
    - "title": "Tiêu đề TikTok"
    - "desc": "Mô tả bữa ăn"
    - "tags": "Chuỗi hashtag cách nhau bởi dấu cách, ví dụ: '#monngon #comnha'"

    Lưu ý quan trọng: Tất cả giá trị phải nằm trong dấu ngoặc kép. Không sử dụng ký tự lạ làm hỏng cấu trúc JSON.
  `;

  try {
    const response = callDeepSeekAI(systemPrompt, userPrompt);
    // Loại bỏ markdown code blocks nếu có
    const cleanJson = response.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    // Xử lý cả trường hợp trả về trực tiếp mảng hoặc object bọc mảng
    const content = result.data || result;

    if (Array.isArray(content)) {
      content.forEach(item => {
        const newRow = [
          new Date(), 
          item.type, 
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
    } else {
      throw new Error("Kết quả AI không phải là mảng hoặc không chứa key 'data'");
    }
    
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
