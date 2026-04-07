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

-- RLS (Hammasiga ruxsat berish - Test uchun)
-- Supabase dashboardda buni qo'shish shart emas agar o'chirilgan bo'lsa
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    CREATE POLICY "Public Access" ON rooms FOR ALL USING (true);
    CREATE POLICY "Public Access" ON users FOR ALL USING (true);
    CREATE POLICY "Public Access" ON logs FOR ALL USING (true);
EXCEPTION WHEN others THEN
    NULL;
END $$;
