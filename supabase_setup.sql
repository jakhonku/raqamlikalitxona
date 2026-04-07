-- 1. Xonalar jadvali (Rooms)
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'free',
  occupant TEXT,
  time TEXT,
  duration TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Foydalanuvchilar jadvali (Users)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'teacher' -- 'teacher', 'student', 'staff'
);

-- 3. Loglar (Action Logs)
CREATE TABLE logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT,
  occupant TEXT,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);

-- Dastlabki xonalarni qo'shish (Initial rooms)
INSERT INTO rooms (id) VALUES ('101'), ('102'), ('101'), ('102'), ('201'), ('202'), ('301');

-- Namuna foydalanuvchilar (Sample users)
-- Buni o'zingiz ham kiritishingiz mumkin
INSERT INTO users (id, name, role) VALUES 
('RK-1001', 'Alisher Navoiy', 'teacher'),
('RK-1002', 'Mirzo Ulugbek', 'student'),
('RK-1003', 'Abdulla Qodiriy', 'staff');

-- 4. Adminlar jadvali (Admin Config)
CREATE TABLE admin_config (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Dastlabki admin
INSERT INTO admin_config (username, password) VALUES ('admin', 'PAROLNI_OZINGIZ_QOYING');

-- RLS (Hammasiga ruxsat berish - Test uchun)
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Access" ON admins FOR ALL USING (true);
