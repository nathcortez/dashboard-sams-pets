'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment, TIME_SLOTS } from '@/types/appointment';

interface DayAppointment {
  id: string;
  time: string;
  base_time_minutes?: number;
  service_additional_time?: number;
  recovery_time?: number;
}

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onSuccess: () => void;
}

export default function RescheduleModal({ isOpen, onClose, appointment, onSuccess }: RescheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [dayAppointments, setDayAppointments] = useState<DayAppointment[]>([]);

  // Cuando cambia la fecha destino, cargar las citas de ese día
  // para poder filtrar slots ocupados con su duración real
  useEffect(() => {
    if (!isOpen) return;
    const targetDate = date || appointment?.date || '';
    if (!targetDate) return;

    const fetchDay = async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, time, base_time_minutes, service_additional_time, recovery_time')
        .eq('date', targetDate)
        .neq('status', 'cancelada');
      // Excluir la propia cita que se está re-agendando
      setDayAppointments((data || []).filter(a => a.id !== appointment?.id));
    };

    fetchDay();
  }, [date, isOpen, appointment?.id, appointment?.date]);

  // Calcular la duración total de la cita que se va a re-agendar
  const currentDuration = appointment
    ? (appointment.base_time_minutes || appointment.baseTimeMinutes || 60)
      + (appointment.service_additional_time || appointment.serviceAdditionalTime || 0)
      + (appointment.recovery_time || appointment.recoveryTime || 0)
    : 60;

  // Horarios disponibles: excluye slots que se solapen con citas existentes
  const availableTimeSlots = TIME_SLOTS.filter(slot => {
    const [slotH, slotM] = slot.split(':').map(Number);
    const slotStart = slotH * 60 + slotM;
    const slotEnd = slotStart + currentDuration;

    return !dayAppointments.some(apt => {
      const [ah, am] = apt.time.split(':').map(Number);
      const aStart = ah * 60 + am;
      const aDuration =
        (apt.base_time_minutes || 60)
        + (apt.service_additional_time || 0)
        + (apt.recovery_time || 0);
      const aEnd = aStart + aDuration;
      return slotStart < aEnd && slotEnd > aStart;
    });
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;

    setLoading(true);
    setError(null);

    try {
      const { data: currentApt } = await supabase
        .from('appointments')
        .select('reschedule_history, original_date')
        .eq('id', appointment.id)
        .single();

      const history = currentApt?.reschedule_history || [];
      const originalDate = currentApt?.original_date || appointment.date;

      const newEntry = {
        from: appointment.date,
        to: date,
        date: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          date,
          time,
          original_date: originalDate,
          reschedule_history: [...history, newEntry],
        })
        .eq('id', appointment.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Error al re-agendar la cita');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="border-b border-gray-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[--azul-oscuro]">Re-agendar Cita</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50">
          <p className="text-sm text-gray-600"><span className="font-medium">Mascota:</span> {appointment.petName}</p>
          <p className="text-sm text-gray-600"><span className="font-medium">Fecha actual:</span> {appointment.date} a las {appointment.time}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Fecha *</label>
              <input type="date" value={date || appointment.date} onChange={(e) => { setDate(e.target.value); setTime(''); }} min={today} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Hora *</label>
              {availableTimeSlots.length === 0 ? (
                <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm">
                  No hay horarios disponibles para este día
                </div>
              ) : (
                <select value={time || appointment.time} onChange={(e) => setTime(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent" required>
                  {availableTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">Se guardará un historial del cambio de fecha.</p>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 px-4 bg-[--naranja] text-white font-medium rounded-xl hover:opacity-90 transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Re-agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
