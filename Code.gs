/**
 * Raqamli Kalitxona - Google Apps Script Backend (API REST)
 */

// Agar script jadvallar fayliga bog'langan (bound) bo'lsa, getActiveSpreadsheet() ishlatiladi.
// Aks holda SHEET_ID ni quyidagiga kiritishingiz kerak.
const SHEET_ID = 'BU_YERGA_GOOGLE_SHEET_ID_KIRITILADI';

function getSS() {
  try {
    // Avval bog'langan jadvalni tekshiramiz
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  
  // Agar bog'lanmagan bo'lsa, ID orqali ochamiz
  if (SHEET_ID && SHEET_ID !== 'BU_YERGA_GOOGLE_SHEET_ID_KIRITILADI') {
    return SpreadsheetApp.openById(SHEET_ID);
  }
  throw new Error("Spreadsheet topilmadi! Iltimos SHEET_ID ni Code.gs fayliga kiriting.");
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
      // Barcha ma'lumotlarni beradi (action=getAll yoki boshqa)
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
  const ss = getSS();
  const logsSheet = ss.getSheetByName('Loglar');
  if (!logsSheet) return { roomUsage: [], dailyUsage: [], userUsage: [], categoryUsage: [] };
  
  const data = logsSheet.getDataRange().getValues();
  let roomUsage = {};
  let dailyUsage = {};
  let userUsage = {};
  let categoryUsage = { "O'qituvchi": 0, "Talaba": 0, "Hodim": 0 };
  
  for (let i = 1; i < data.length; i++) {
    const roomId = data[i][0].toString();
    const occupant = data[i][1].toString();
    const action = data[i][2]; 
    const dateStr = data[i][3].toString();
    
    if (action && action.toString().includes('Olingan')) {
      roomUsage[roomId] = (roomUsage[roomId] || 0) + 1;
      userUsage[occupant] = (userUsage[occupant] || 0) + 1;
      
      // Category detection
      if (occupant.includes('(O\'qituvchi)')) categoryUsage["O'qituvchi"]++;
      else if (occupant.includes('(Talaba)')) categoryUsage["Talaba"]++;
      else if (occupant.includes('(Hodim)')) categoryUsage["Hodim"]++;

      if (dateStr) {
        const day = dateStr.split(' ')[0];
        dailyUsage[day] = (dailyUsage[day] || 0) + 1;
      }
    }
  }
  
  return {
    roomUsage: Object.keys(roomUsage).map(id => ({ id: id, count: roomUsage[id] })),
    dailyUsage: Object.keys(dailyUsage).map(day => ({ date: day, count: dailyUsage[day] })),
    userUsage: Object.keys(userUsage).map(name => ({ name: name, count: userUsage[name] })),
    categoryUsage: Object.keys(categoryUsage).map(cat => ({ name: cat, count: categoryUsage[cat] }))
  };
}

/**
 * AVTOMATIK ID YARATISH:
 * Jadvalda ism yozilganda unga avtomatik ravishda noyob (unique) ID generatsiya qiladi.
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  const range = e.range;
  const col = range.getColumn();
  const row = range.getRow();
  
  // Faqat kerakli sahifalarda va 1-ustunda (FISH) ism yozilsa ishlaydi
  const sourceSheets = ["O'qituvchilar", "Talabalar", "Hodimlar"];
  
  if (sourceSheets.includes(sheetName) && col === 1 && row > 1) {
    const name = range.getValue();
    const idCell = sheet.getRange(row, 3); // 3-ustun (ID)
    
    // Agar ism yozilgan bo'lsa va ID hali yo'q bo'lsa
    if (name && !idCell.getValue()) {
      const nextId = generateNextUID(e.source);
      idCell.setValue(nextId);
    }
  }
}

/**
 * Barcha jadvallardan o'tib, eng oxirgi (eng katta) ID ni topadi 
 * va keyingisini qaytaradi (Format: RK-1001).
 */
function generateNextUID(ss) {
  const sheets = ["O'qituvchilar", "Talabalar", "Hodimlar"];
  let maxId = 1000; // 1001 dan boshlanadi
  
  sheets.forEach(name => {
    try {
      const s = ss.getSheetByName(name);
      if (s) {
        const data = s.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          const idValue = data[i][2]; // C ustun (ID)
          if (idValue && typeof idValue === 'string' && idValue.startsWith("RK-")) {
            const num = parseInt(idValue.split("-")[1], 10);
            if (!isNaN(num) && num > maxId) {
              maxId = num;
            }
          }
        }
      }
    } catch(e) {}
  });
  
  const nextNum = maxId + 1;
  return "RK-" + nextNum;
}

/**
 * SOZLASH FUNKSIYASI:
 * Google Sheet'da barcha kerakli sahifalarni yaratadi.
 * Code.gs'da ushbu funksiyani bir marta ishga tushiring.
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Xonalar sahifasi
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
  
  // 2. Loglar sahifasi
  let lSheet = ss.getSheetByName("Loglar");
  if (!lSheet) lSheet = ss.insertSheet("Loglar");
  lSheet.clear();
  lSheet.appendRow(["Xona ID", "Shaxs", "Harakat", "Sana/Vaqt", "Izoh"]);
  lSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#f0f0f0");
  lSheet.autoResizeColumns(1, 5);

  // 3. O'qituvchilar
  let tSheet = ss.getSheetByName("O'qituvchilar");
  if (!tSheet) tSheet = ss.insertSheet("O'qituvchilar");
  tSheet.clear();
  tSheet.appendRow(["FISH", "Lavozimi", "ID"]);
  tSheet.appendRow(["Alisher Navoiy", "Professor", "RK-1001"]);
  tSheet.getRange("A1:C1").setFontWeight("bold");
  tSheet.autoResizeColumns(1, 3);
  
  // 4. Talabalar
  let sSheet = ss.getSheetByName("Talabalar");
  if (!sSheet) sSheet = ss.insertSheet("Talabalar");
  sSheet.clear();
  sSheet.appendRow(["FISH", "Yo'nalish", "ID"]);
  sSheet.appendRow(["Mirzo Ulugbek", "Astronomiya", "RK-1002"]);
  sSheet.getRange("A1:C1").setFontWeight("bold");
  sSheet.autoResizeColumns(1, 3);

  // 5. Hodimlar
  let hSheet = ss.getSheetByName("Hodimlar");
  if (!hSheet) hSheet = ss.insertSheet("Hodimlar");
  hSheet.clear();
  hSheet.appendRow(["FISH", "Lavozimi", "ID"]);
  hSheet.appendRow(["Abdulla Qodiriy", "Kutubxonachi", "RK-1003"]);
  hSheet.getRange("A1:C1").setFontWeight("bold");
  hSheet.autoResizeColumns(1, 3);

  Browser.msgBox("Tizim tayyor! ID generatsiya qilish uchun ism yozing (Format: RK-XXXX)");
}

