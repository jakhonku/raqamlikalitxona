/**
 * Raqamli Kalitxona - Google Apps Script Backend (API REST)
 */

const SHEET_ID = 'BU_YERGA_GOOGLE_SHEET_ID_KIRITILADI';

// JSON javob berish uchun yordamchi funksiya
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle GET requests (Ma'lumotlarni o'qish)
 * Masalan: WebApp_URL?action=getRooms
 */
function doGet(e) {
  // CORS issues for simple GET: JSONP or directly returns JSON
  // In pure fetch mode without API Gateway, standard GET from browser could block CORS
  // So returning raw JSON is best with fetch(..., {mode: 'cors'}) in frontend client if configured correctly.
  
  // NOTE: Due to Vercel/Frontend needing CORS on normal fetch, 
  // Google automatically handles standard GET requests if you navigate to it or use 'no-cors' mode (but can't read 'no-cors')
  // For proper fetching, standard jsonResponse is needed. 
  
  try {
    const action = e.parameter.action;
    
    if (action === 'getRooms') {
      return jsonResponse({ success: true, data: getRoomsData() });
    } else if (action === 'getUsers') {
      return jsonResponse({ success: true, data: getUsersList() });
    } else {
      // Ikkalasini ham beradi
      return jsonResponse({ 
        success: true, 
        data: {
          rooms: getRoomsData(),
          users: getUsersList(),
          analytics: getAnalytics()
        }
      });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

/**
 * Handle POST requests (Ma'lumotlarni yozish)
 * Frontend'dan fetch('/', { method: 'POST', body: JSON.stringify({...}) }) orqali keladi
 */
function doPost(e) {
  try {
    // Agar JSON kelsa
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === 'checkOut') {
      const result = checkOutKey(payload.roomId, payload.occupantName, payload.role, payload.duration);
      return jsonResponse(result);
    } else if (action === 'checkIn') {
      const result = checkInKey(payload.roomId);
      return jsonResponse(result);
    } else {
      return jsonResponse({ success: false, message: 'Noma\'lum amal!' });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.toString() });
  }
}

function getRoomsData() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Xonalar');
  const data = sheet.getDataRange().getDisplayValues();
  
  let rooms = [];
  for (let i = 1; i < data.length; i++) {
    rooms.push({
      id: data[i][0].toString(),
      status: data[i][1].toString(),
      occupant: data[i][2] || null,
      time: data[i][3] || null,
      duration: data[i][4] || null
    });
  }
  return rooms;
}

function checkOutKey(roomId, occupantName, role = 'teacher', duration = null) {
  const SS = SpreadsheetApp.openById(SHEET_ID);
  const roomsSheet = SS.getSheetByName('Xonalar');
  const logsSheet = SS.getSheetByName('Loglar');
  
  const data = roomsSheet.getDataRange().getDisplayValues();
  const now = new Date();
  const timeStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "HH:mm");
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  let isFound = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === roomId.toString()) {
      roomsSheet.getRange(i + 1, 2).setValue('occupied');
      roomsSheet.getRange(i + 1, 3).setValue(occupantName);
      roomsSheet.getRange(i + 1, 4).setValue(timeStr);
      if (role === 'student' && duration) {
        roomsSheet.getRange(i + 1, 5).setValue(duration + ' soat');
      } else {
        roomsSheet.getRange(i + 1, 5).clearContent();
      }
      isFound = true;
      break;
    }
  }

  if (isFound) {
    logsSheet.appendRow([
      roomId,
      occupantName,
      'Olingan (Check-out)',
      dateStr,
      (role === 'student' && duration) ? (duration + ' soat') : '-'
    ]);
    return { success: true, message: "Kalit muvaffaqiyatli berildi!" };
  } else {
    return { success: false, message: "Xona topilmadi!" };
  }
}

function checkInKey(roomId) {
  const SS = SpreadsheetApp.openById(SHEET_ID);
  const roomsSheet = SS.getSheetByName('Xonalar');
  const logsSheet = SS.getSheetByName('Loglar');
  
  const data = roomsSheet.getDataRange().getDisplayValues();
  const now = new Date();
  const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  let occupantName = '';
  let isFound = false;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === roomId.toString()) {
      occupantName = data[i][2]; 
      roomsSheet.getRange(i + 1, 2).setValue('free');
      roomsSheet.getRange(i + 1, 3).clearContent();
      roomsSheet.getRange(i + 1, 4).clearContent();
      roomsSheet.getRange(i + 1, 5).clearContent();
      isFound = true;
      break;
    }
  }

  if (isFound) {
    logsSheet.appendRow([
      roomId,
      occupantName,
      'Qaytarildi (Check-in)',
      dateStr
    ]);
    return { success: true, message: "Kalit muvaffaqiyatli qaytarildi!" };
  } else {
    return { success: false, message: "Xona topilmadi!" };
  }
}

function getUsersList() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const categories = [
    { name: "O'qituvchilar", label: "O'qituvchi", idCol: 2 },
    { name: "Talabalar", label: "Talaba", idCol: 2 },
    { name: "Hodimlar", label: "Hodim", idCol: 2 }
  ];
  let users = [];
  
  categories.forEach(cat => {
    try {
      const sheet = ss.getSheetByName(cat.name);
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (data[i][0]) {
            let name = data[i][0].toString().trim();
            let id = data[i][cat.idCol] ? data[i][cat.idCol].toString().trim() : "";
            users.push({ name: name + ` (${cat.label})`, id: id });
          }
        }
      }
    } catch(e) {}
  });
  return users;
}

function getAnalytics() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const logsSheet = ss.getSheetByName('Loglar');
  if (!logsSheet) return { roomUsage: [], dailyUsage: [], userUsage: [] };
  
  const data = logsSheet.getDataRange().getValues();
  let roomUsage = {};
  let dailyUsage = {};
  let userUsage = {};
  
  for (let i = 1; i < data.length; i++) {
    const roomId = data[i][0].toString();
    const occupant = data[i][1].toString();
    const action = data[i][2]; // 'Olingan (Check-out)'
    const dateStr = data[i][3].toString(); // yyyy-MM-dd ...
    
    if (action && action.toString().includes('Olingan')) {
      // Room count
      roomUsage[roomId] = (roomUsage[roomId] || 0) + 1;
      
      // User count
      userUsage[occupant] = (userUsage[occupant] || 0) + 1;
      
      // Daily count
      if (dateStr) {
        const day = dateStr.split(' ')[0]; // Take only yyyy-MM-dd
        dailyUsage[day] = (dailyUsage[day] || 0) + 1;
      }
    }
  }
  
  return {
    roomUsage: Object.keys(roomUsage).map(id => ({ id: id, count: roomUsage[id] })),
    dailyUsage: Object.keys(dailyUsage).map(day => ({ date: day, count: dailyUsage[day] })),
    userUsage: Object.keys(userUsage).map(name => ({ name: name, count: userUsage[name] }))
  };
}

/**
 * BIR MARTALIK ISHGA TUSHIRILADIGAN FUNKSIYA:
 * Ushbu funksiyani Code.gs da ishlatish orqali jadvallarni avtomatik tuzib olishingiz mumkin.
 */
function yangiJadvallarniQurish() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. O'qituvchilar jadvali
  let tSheet = ss.getSheetByName("O'qituvchilar");
  if (!tSheet) tSheet = ss.insertSheet("O'qituvchilar");
  tSheet.clear();
  tSheet.appendRow(["FISH", "Lavozimi", "ID"]);
  tSheet.appendRow(["Alisher Navoiy", "Kafedra mudiri", "ID-001"]);
  tSheet.appendRow(["Zahiriddin Muhammad Bobur", "Fizika o'qituvchisi", "ID-002"]);
  tSheet.getRange("A1:C1").setFontWeight("bold");
  tSheet.autoResizeColumns(1, 3);
  
  // 2. Talabalar jadvali
  let sSheet = ss.getSheetByName("Talabalar");
  if (!sSheet) sSheet = ss.insertSheet("Talabalar");
  sSheet.clear();
  sSheet.appendRow(["FISH", "Yo'nalishi / Bosqich", "ID"]);
  sSheet.appendRow(["Mirzo Ulug'bek", "Fizika - 2-bosqich", "ID-003"]);
  sSheet.appendRow(["Abdulla Qodiriy", "Adabiyot - 1-bosqich", "ID-004"]);
  sSheet.getRange("A1:C1").setFontWeight("bold");
  sSheet.autoResizeColumns(1, 3);
  
  // Eski Foydalanuvchilar o'chiriladi
  const oldSheet = ss.getSheetByName("Foydalanuvchilar");
  if (oldSheet) ss.deleteSheet(oldSheet);
  
  // 3. Hodimlar jadvali
  let hSheet = ss.getSheetByName("Hodimlar");
  if (!hSheet) hSheet = ss.insertSheet("Hodimlar");
  hSheet.clear();
  hSheet.appendRow(["FISH", "Lavozimi", "ID"]);

  Browser.msgBox("O'qituvchilar, Talabalar va Hodimlar jadvallari yaratildi!");
}
