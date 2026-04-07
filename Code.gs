/**
 * Raqamli Kalitxona - Google Apps Script Backend (API REST)
 */

// Agar script jadvallar fayliga bog'langan (bound) bo'lsa, getActiveSpreadsheet() ishlatiladi.
// Aks holda SHEET_ID ni quyidagiga kiritishingiz kerak.
const SHEET_ID = 'BU_YERGA_GOOGLE_SHEET_ID_KIRITILADI';

/**
 * PERFORMANCE OPTIMIZATION:
 * Spreadsheet ob'yektini keshlaymiz
 */
let cachedSS = null;
function getSS() {
  if (cachedSS) return cachedSS;
  try {
    cachedSS = SpreadsheetApp.getActiveSpreadsheet();
    if (cachedSS) return cachedSS;
  } catch (e) {}
  
  if (SHEET_ID && SHEET_ID !== 'BU_YERGA_GOOGLE_SHEET_ID_KIRITILADI') {
    cachedSS = SpreadsheetApp.openById(SHEET_ID);
    return cachedSS;
  }
  throw new Error("Spreadsheet topilmadi!");
}

// JSON javob berish uchun yordamchi funksiya
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle GET requests (Ma'lumotlarni o'qish)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getRooms') {
      return jsonResponse({ success: true, data: getRoomsData() });
    } else if (action === 'getUsers') {
      return jsonResponse({ success: true, data: getUsersList() });
    } else {
      // Barcha ma'lumotlarni beradi
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
 */
function doPost(e) {
  try {
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
  const ss = getSS();
  const sheet = ss.getSheetByName('Xonalar');
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
  
  return data.map(row => ({
    id: row[0],
    status: row[1],
    occupant: row[2] || null,
    time: row[3] || null,
    duration: row[4] || null
  }));
}

function checkOutKey(roomId, occupantName, role = 'teacher', duration = null) {
  const ss = getSS();
  const roomsSheet = ss.getSheetByName('Xonalar');
  const logsSheet = ss.getSheetByName('Loglar');
  
  if (!roomsSheet || !logsSheet) return { success: false, message: "Jadvallar topilmadi!" };
  
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
      if (duration) {
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
      duration ? (duration + ' soat') : '-'
    ]);
    return { success: true, message: "Kalit muvaffaqiyatli berildi!" };
  } else {
    return { success: false, message: "Xona topilmadi!" };
  }
}

function checkInKey(roomId) {
  const ss = getSS();
  const roomsSheet = ss.getSheetByName('Xonalar');
  const logsSheet = ss.getSheetByName('Loglar');
  
  if (!roomsSheet || !logsSheet) return { success: false, message: "Jadvallar topilmadi!" };
  
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
  const ss = getSS();
  const categories = [
    { name: "O'qituvchilar", label: "O'qituvchi" },
    { name: "Talabalar", label: "Talaba" },
    { name: "Hodimlar", label: "Hodim" }
  ];
  let users = [];
  
  categories.forEach(cat => {
    try {
      const sheet = ss.getSheetByName(cat.name);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
          data.forEach(row => {
            if (row[0]) {
              users.push({ 
                name: row[0].toString().trim() + ` (${cat.label})`, 
                id: row[2] ? row[2].toString().trim() : "" 
              });
            }
          });
        }
      }
    } catch(e) {}
  });
  return users;
}

function getAnalytics() {
  const ss = getSS();
  const logsSheet = ss.getSheetByName('Loglar');
  if (!logsSheet) return { roomUsage: [], dailyUsage: [], userUsage: [], categoryUsage: [] };
  
  const lastRow = logsSheet.getLastRow();
  if (lastRow <= 1) return { roomUsage: [], dailyUsage: [], userUsage: [], categoryUsage: [] };

  const startRow = Math.max(2, lastRow - 500);
  const data = logsSheet.getRange(startRow, 1, (lastRow - startRow) + 1, 4).getValues();
  
  let roomUsage = {};
  let dailyUsage = {};
  let userUsage = {};
  let categoryUsage = { "O'qituvchi": 0, "Talaba": 0, "Hodim": 0 };
  
  data.forEach(row => {
    const roomId = row[0].toString();
    const occupant = row[1].toString();
    const action = row[2]; 
    const dateStr = row[3].toString();
    
    if (action && action.toString().includes('Olingan')) {
      roomUsage[roomId] = (roomUsage[roomId] || 0) + 1;
      userUsage[occupant] = (userUsage[occupant] || 0) + 1;
      
      if (occupant.includes('(O\'qituvchi)')) categoryUsage["O'qituvchi"]++;
      else if (occupant.includes('(Talaba)')) categoryUsage["Talaba"]++;
      else if (occupant.includes('(Hodim)')) categoryUsage["Hodim"]++;
      
      if (dateStr) {
        const day = dateStr.split(' ')[0];
        dailyUsage[day] = (dailyUsage[day] || 0) + 1;
      }
    }
  });
  
  return {
    roomUsage: Object.keys(roomUsage).map(id => ({ id: id, count: roomUsage[id] })),
    dailyUsage: Object.keys(dailyUsage).map(day => ({ date: day, count: dailyUsage[day] })),
    userUsage: Object.keys(userUsage).map(name => ({ name: name, count: userUsage[name] })),
    categoryUsage: Object.keys(categoryUsage).map(cat => ({ name: cat, count: categoryUsage[cat] }))
  };
}

/**
 * AVTOMATIK ID YARATISH (Optimallashtirilgan):
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  const range = e.range;
  const col = range.getColumn();
  const row = range.getRow();
  
  const sourceSheets = ["O'qituvchilar", "Talabalar", "Hodimlar"];
  if (sourceSheets.includes(sheetName) && col === 1 && row > 1) {
    const name = range.getValue();
    const idCell = sheet.getRange(row, 3);
    
    if (name && !idCell.getValue()) {
      const nextId = getFastNextUID();
      idCell.setValue(nextId);
    }
  }
}

function getFastNextUID() {
  const props = PropertiesService.getScriptProperties();
  let lastIdNum = parseInt(props.getProperty('LAST_ID_NUM'), 10);
  
  if (isNaN(lastIdNum)) {
    lastIdNum = 1000;
    const ss = getSS();
    const sheets = ["O'qituvchilar", "Talabalar", "Hodimlar"];
    sheets.forEach(name => {
      const s = ss.getSheetByName(name);
      if (s) {
        const data = s.getRange("C:C").getValues();
        for (let i = 1; i < data.length; i++) {
          const val = data[i][0];
          if (val && typeof val === 'string' && val.startsWith("RK-")) {
            const num = parseInt(val.split("-")[1], 10);
            if (!isNaN(num) && num > lastIdNum) lastIdNum = num;
          }
        }
      }
    });
  }
  
  const nextNum = lastIdNum + 1;
  props.setProperty('LAST_ID_NUM', nextNum.toString());
  return "RK-" + nextNum;
}

/**
 * SOZLASH FUNKSIYASI:
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  let rSheet = ss.getSheetByName("Xonalar");
  if (!rSheet) rSheet = ss.insertSheet("Xonalar");
  rSheet.clear();
  rSheet.appendRow(["Xona ID", "Holati", "Mas'ul", "Vaqt", "Muddat"]);
  rSheet.appendRow(["101", "free", "", "", ""]);
  rSheet.appendRow(["102", "free", "", "", ""]);
  rSheet.appendRow(["201", "free", "", "", ""]);
  rSheet.appendRow(["202", "free", "", "", ""]);
  rSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#f0f0f0");
  rSheet.autoResizeColumns(1, 5);
  
  let lSheet = ss.getSheetByName("Loglar");
  if (!lSheet) lSheet = ss.insertSheet("Loglar");
  lSheet.clear();
  lSheet.appendRow(["Xona ID", "Shaxs", "Harakat", "Sana/Vaqt", "Izoh"]);
  lSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#f0f0f0");
  lSheet.autoResizeColumns(1, 5);

  let tSheet = ss.getSheetByName("O'qituvchilar");
  if (!tSheet) tSheet = ss.insertSheet("O'qituvchilar");
  tSheet.clear();
  tSheet.appendRow(["FISH", "Lavozimi", "ID"]);
  tSheet.appendRow(["Alisher Navoiy", "Professor", "RK-1001"]);
  tSheet.getRange("A1:C1").setFontWeight("bold");
  
  let sSheet = ss.getSheetByName("Talabalar");
  if (!sSheet) sSheet = ss.insertSheet("Talabalar");
  sSheet.clear();
  sSheet.appendRow(["FISH", "Yo'nalish", "ID"]);
  sSheet.appendRow(["Mirzo Ulugbek", "Astronomiya", "RK-1002"]);
  sSheet.getRange("A1:C1").setFontWeight("bold");

  let hSheet = ss.getSheetByName("Hodimlar");
  if (!hSheet) hSheet = ss.insertSheet("Hodimlar");
  hSheet.clear();
  hSheet.appendRow(["FISH", "Lavozimi", "ID"]);
  hSheet.appendRow(["Abdulla Qodiriy", "Kutubxonachi", "RK-1003"]);
  hSheet.getRange("A1:C1").setFontWeight("bold");

  Browser.msgBox("Tizim tayyor va optimallashdi!");
}
