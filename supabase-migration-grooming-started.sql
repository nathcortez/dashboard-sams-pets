-- Migración: agregar campo grooming_started_at a la tabla appointments
-- Ejecutar en Supabase SQL Editor

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS grooming_started_at TIMESTAMP WITH TIME ZONE;

-- Índice para consultas de reportes por rango de fecha
CREATE INDEX IF NOT EXISTS idx_appointments_grooming_started
  ON appointments(grooming_started_at)
  WHERE grooming_started_at IS NOT NULL;
