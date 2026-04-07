# Raqamli Kalitxona (Digital Key Management)

Ushbu loyiha xona kalitlarini boshqarish va monitoring qilish uchun yaratilgan. Endi tizim Google Sheets o'rniga **Supabase** (Real-time database) bilan ishlaydi.

## Asosiy o'zgarishlar:
- **Supabase Integratsiyasi:** Ma'lumotlar bilan ishlash tezligi 10 barobar oshdi.
- **Real-time:** Biron bir xona band qilinsa, boshqa barcha kompyuterlarda avtomatik (refresh qilmasdan) yangilanadi.
- **Soddalashtirilgan Backend:** Endi Google Script kodi kerak emas.

## Sozlash (Setup):
1.  Supabase dashboard'ga kiring.
2.  **SQL Editor** bo'limiga o'ting.
3.  Loyihangizdagi `supabase_setup.sql` fayli ichidagi barcha kodni nusxalab oling va Supabase'da ishga tushiring.
4.  Bu barcha kerakli jadvallarni (`rooms`, `users`, `logs`) yaratadi.

## Ishga tushirish (Local):
```bash
npm install
npm run dev
```

## Texnologiyalar:
- Frontend: React + Vite + Ant Design
- Backend/Database: Supabase (PostgreSQL)
- QR Code: html5-qrcode
