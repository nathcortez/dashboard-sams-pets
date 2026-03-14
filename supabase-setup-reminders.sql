-- Registro de recordatorios enviados (para el checklist)
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_whatsapp TEXT NOT NULL,
  pet_name TEXT NOT NULL,
  owner_name TEXT,
  reminder_type TEXT NOT NULL, -- "grooming" | "vaccine" | "deworming"
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reminder_logs" ON reminder_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reminder_logs" ON reminder_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reminder_logs" ON reminder_logs FOR UPDATE USING (true);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_whatsapp ON reminder_logs(client_whatsapp);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_type ON reminder_logs(reminder_type);

-- Control de salud de mascotas (vacunas y desparasitación)
CREATE TABLE IF NOT EXISTS pet_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_whatsapp TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  pet_name TEXT NOT NULL,
  type TEXT NOT NULL, -- "vaccine" | "deworming"
  last_date DATE NOT NULL,
  next_date DATE NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 365,
  notes TEXT
);
ALTER TABLE pet_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pet_health" ON pet_health FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pet_health" ON pet_health FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pet_health" ON pet_health FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pet_health" ON pet_health FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_pet_health_whatsapp ON pet_health(client_whatsapp);
CREATE INDEX IF NOT EXISTS idx_pet_health_type ON pet_health(type);
CREATE INDEX IF NOT EXISTS idx_pet_health_next_date ON pet_health(next_date);
