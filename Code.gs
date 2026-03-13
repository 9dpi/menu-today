/**
 * CONFIGURATION
 */
const SPREADSHEET_ID = '1GyEo-OVIV4J2hospqVHJDRgjBzZyf5aHFbge7Xe0xJ0';
const SHEET_NAME = 'Sheet1';
const DEEPSEEK_API_KEY = 'YOUR_DEEPSEEK_API_KEY'; // Thay thế bằng API Key của bạn

/**
 * Hàm khởi tạo Web App
 */
function doGet(e) {
  console.log("doGet called with parameters: " + JSON.stringify(e ? e.parameter : "none"));
  
  // Nếu có tham số ?api=1 thì trả về JSON (Dùng cho GitHub Pages)
  if (e && e.parameter && e.parameter.api) {
    try {
      const data = getTodayMenu();
      return ContentService.createTextOutput(JSON.stringify(data))
          .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({error: err.message}))
          .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Mặc định trả về giao diện HTML (Dùng cho Web App link)
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
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    
    if (!data || data.length < 1) {
      console.log("Sheet không có dữ liệu");
      return [];
    }

    const tz = ss.getSpreadsheetTimeZone();
    const todayStr = Utilities.formatDate(new Date(), tz, "dd/MM/yyyy");
    
    // Tìm hàng dữ liệu (bỏ qua header nếu hàng 1 không phải là ngày)
    let startRow = 0;
    if (data[0][0] && !(data[0][0] instanceof Date) && isNaN(Date.parse(data[0][0]))) {
      startRow = 1;
    }
    const rows = data.slice(startRow);
    
    // Lọc theo ngày hôm nay
    let todayRows = rows.filter(row => {
      if (!row[0]) return false;
      try {
        let d = (row[0] instanceof Date) ? row[0] : new Date(row[0]);
        return Utilities.formatDate(d, tz, "dd/MM/yyyy") === todayStr;
      } catch (e) { return false; }
    });

    // Fallback: Nếu không thấy ngày hôm nay, lấy 2 hàng cuối cùng
    let results = todayRows.length > 0 ? todayRows : rows.slice(-2);
    
    return results.map(row => ({
      type: row[1] || "Lunch",
      menu: row[2] || "Chưa có món",
      prompt: row[3] || "",
      title: row[4] || "Hôm nay ăn gì?",
      desc: row[5] || "",
      tags: row[6] || "",
      status: row[7] || "Pending",
      price: row[8] || "Đang cập nhật",
      time: row[9] || "Đang tính...",
      instructions: row[10] || "Đang cập nhật hướng dẫn..."
    }));
  } catch (error) {
    console.error("Lỗi getTodayMenu: " + error.toString());
    throw new Error("Lỗi hệ thống: " + error.message);
  }
}

/**
 * Hàm chạy tự động hàng ngày (Trigger 00:00)
 * Hoàn thiện: Tích hợp AI DeepSeek để tìm kiếm/tạo thực đơn Việt Nam phong phú
 */
function generateDailyContent() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  
  const systemPrompt = "Bạn là một chuyên gia ẩm thực Việt Nam, am hiểu sâu sắc về mâm cơm gia đình truyền thống.";
  const userPrompt = `
    Hãy thiết lập thực đơn cho ngày hôm nay bao gồm 1 bữa Trưa (Lunch) và 1 bữa Tối (Dinner).
    
    Yêu cầu đặc thù cho từng bữa:
    1. Bữa Trưa (Lunch): Tập trung vào rau xanh, các món thanh đạm, tươi mát. Mâm cơm phải mang lại cảm giác nhẹ nhàng, dễ tiêu. Hình ảnh gợi ý (prompt) phải thể hiện được sự xanh mát, ánh sáng tự nhiên.
    2. Bữa Tối (Dinner): Phải đầy đặn, ấm cúng, mâm cơm gia đình đông đủ. Gồm nhiều món hơn (ít nhất 3-4 món trở lên). Hình ảnh gợi ý (prompt) mang tông màu ấm, ánh đèn vàng, khói tỏa.

    Yêu cầu chung về nội dung TikTok:
    - Title: Tiêu đề giật gân, khơi gợi tò mò.
    - Description: Ngoài mô tả hương vị, LUÔN thêm 1 câu hỏi ngược để khán giả trả lời (ví dụ: "Nhà bạn hôm nay ăn món gì?", "Món này ăn với cà pháo hay dưa muối thì ngon hơn nhỉ?") và 1 câu hook follow kênh.
    - TikTok Ratio: LUÔN thêm '--ar 9:16' vào cuối prompt video.

    Trả về một JSON Object có key là "data", chứa mảng 2 đối tượng (Lunch và Dinner).
    Mỗi đối tượng có các key: 
    - "type": "Lunch" hoặc "Dinner"
    - "menu": "Danh sách các món ăn (Mâm cơm Việt)"
    - "prompt": "Detailed English prompt for high-end cinematic food video (TikTok ratio --ar 9:16)"
    - "title": "Tiêu đề TikTok"
    - "desc": "Mô tả + Câu hỏi tương tác + Hook follow"
    - "tags": "#comnha #menutoday #mamcomgiadinh #onhaanngon"
    - "price": "Ước tính chi phí"
    - "time": "Thời gian nấu"
    - "instructions": "Cách nấu tóm tắt"
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
          "Pending",
          item.price,
          item.time,
          item.instructions
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
  const url = "https://api.deepseek.com/v1/chat/completions";
  const maxRetries = 3;
  let attempt = 0;
  
  const payload = {
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": systemContent},
      {"role": "user", "content": userContent}
    ],
    "stream": false,
    "response_format": { "type": "json_object" }
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

  while (attempt < maxRetries) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (responseCode === 200) {
        const json = JSON.parse(responseText);
        return json.choices[0].message.content;
      } else {
        console.warn(`DeepSeek Attempt ${attempt + 1} failed: ${responseCode} - ${responseText}`);
      }
    } catch (err) {
      console.warn(`DeepSeek Attempt ${attempt + 1} Error: ${err.message}`);
    }
    
    attempt++;
    if (attempt < maxRetries) {
      console.log("Đang thử lại sau 3 giây...");
      Utilities.sleep(3000); // Đợi 3 giây trước khi thử lại
    }
  }
  
  throw new Error("Không thể kết nối tới DeepSeek API sau " + maxRetries + " lần thử. Vui lòng kiểm tra lại server DeepSeek hoặc mạng.");
}
