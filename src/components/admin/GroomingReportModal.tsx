'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types/appointment';

interface GroomingReportModalProps {
  appointment: Appointment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GROOMING_TAGS = [
  { id: 'nudos', label: 'Nudos encontrados', emoji: '🪢' },
  { id: 'pulgas', label: 'Pulgas detectadas', emoji: '🦟' },
  { id: 'piel_irritada', label: 'Piel irritada', emoji: '🔴' },
  { id: 'bajo_peso', label: 'Bajo de peso', emoji: '⚖️' },
  { id: 'alergia', label: 'Signos de alergia', emoji: '🤧' },
  { id: 'comportamiento', label: 'Comportamiento difícil', emoji: '😤' },
  { id: 'oidos', label: 'Oídos sucios', emoji: '👂' },
  { id: 'unas_largas', label: 'Uñas muy largas', emoji: '🦴' },
];

const STATUS_OPTIONS = [
  { value: 'excelente', label: 'Excelente', emoji: '⭐', color: '#15803D', bg: '#F0FDF4' },
  { value: 'bueno', label: 'Bueno', emoji: '✅', color: '#1D4ED8', bg: '#EFF6FF' },
  { value: 'regular', label: 'Regular', emoji: '⚠️', color: '#D97706', bg: '#FFFBEB' },
  { value: 'con_incidencias', label: 'Con incidencias', emoji: '🔴', color: '#DC2626', bg: '#FEF2F2' },
];

export default function GroomingReportModal({ appointment, isOpen, onClose, onSuccess }: GroomingReportModalProps) {
  const [status, setStatus] = useState<string>(appointment.groomingStatus || '');
  const [tags, setTags] = useState<string[]>(appointment.groomingTags || []);
  const [notes, setNotes] = useState(appointment.groomingNotes || '');
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (!status) return;
    setSaving(true);
    try {
      await supabase
        .from('appointments')
        .update({
          grooming_status: status,
          grooming_tags: tags,
          grooming_notes: notes || null,
          grooming_completed_at: new Date().toISOString(),
          status: 'completada',
        })
        .eq('id', appointment.id);

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error guardando reporte:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const petName = appointment.petName || appointment.pet_name || 'Mascota';
  const ownerName = appointment.ownerName || appointment.owner_name || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1B3A5C' }}>✂️ Reporte de Grooming</h2>
            <p className="text-sm" style={{ color: '#6B6B6B' }}>{petName} · {ownerName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-5">

          {/* Estado general */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#1B3A5C' }}>Estado general del servicio *</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className="py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all text-left"
                  style={{
                    borderColor: status === opt.value ? opt.color : '#E5E7EB',
                    backgroundColor: status === opt.value ? opt.bg : '#FFFFFF',
                    color: status === opt.value ? opt.color : '#6B7280',
                  }}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#1B3A5C' }}>Observaciones encontradas</p>
            <div className="flex flex-wrap gap-2">
              {GROOMING_TAGS.map((tag) => {
                const active = tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                    style={{
                      borderColor: active ? '#E8943D' : '#E5E7EB',
                      backgroundColor: active ? '#FFF4EA' : '#F9FAFB',
                      color: active ? '#E8943D' : '#6B7280',
                    }}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#1B3A5C' }}>Notas adicionales</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Se recomienda revisión veterinaria, el pelaje estaba muy enredado..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2"
              style={{ focusRingColor: '#E8943D' } as any}
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border text-sm font-medium"
              style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!status || saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: '#E8943D' }}
            >
              {saving ? 'Guardando...' : '✅ Guardar reporte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
