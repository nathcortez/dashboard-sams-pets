'use client';

import { useMemo } from 'react';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { generateWhatsAppReminder } from '@/lib/whatsapp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TodayViewProps {
  appointments: Appointment[];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onCancel: (id: string) => void;
  onReschedule: (appointment: Appointment) => void;
}

const statusColors: Record<AppointmentStatus, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmada: 'bg-blue-100 text-blue-800',
  completada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-50 text-red-400',
};

const statusLabels: Record<AppointmentStatus, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function TodayView({ appointments, onStatusChange, onCancel, onReschedule }: TodayViewProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const todayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => apt.date === todayStr)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, todayStr]);

  const stats = useMemo(() => ({
    total: todayAppointments.length,
    completed: todayAppointments.filter((a) => a.status === 'completada').length,
    pending: todayAppointments.filter((a) => a.status === 'pendiente' || a.status === 'confirmada').length,
  }), [todayAppointments]);

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const todayFormatted = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es });

  return (
    <div>
      <div className="bg-[#2563eb] text-white rounded-2xl p-5 mb-6">
        <h2 className="text-lg font-bold mb-1">📅 Agenda de hoy — {todayFormatted}</h2>
        <div className="flex gap-4 text-sm mt-3">
          <span className="bg-white/20 px-3 py-1 rounded-full">Total: {stats.total}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full">Pendientes: {stats.pending}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full">Completadas: {stats.completed}</span>
        </div>
      </div>

      {todayAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-md">
          <div className="text-5xl mb-4">🐕</div>
          <p className="text-[--gris] text-lg">No hay citas programadas para hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todayAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className={`bg-white rounded-2xl p-4 shadow-md border-l-4 ${
                appointment.status === 'cancelada'
                  ? 'border-red-300 opacity-60'
                  : appointment.status === 'completada'
                  ? 'border-green-400'
                  : appointment.status === 'confirmada'
                  ? 'border-blue-400'
                  : 'border-[#E8943D]'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  {appointment.petPhoto && (
                    <img src={appointment.petPhoto} alt={appointment.petName || ''} className="w-10 h-10 rounded-full object-cover" />
                  )}
                  <div>
                    <h4 className="font-semibold text-[--azul-oscuro]">{appointment.petName}</h4>
                    {appointment.petBreedEmoji && appointment.petBreed && (
                      <p className="text-sm text-[--gris]">{appointment.petBreedEmoji} {appointment.petBreed}</p>
                    )}
                    {appointment.serviceName && (
                      <p className="text-sm text-[--gris]">✂️ {appointment.serviceName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#2563eb]">⏰ {formatTime(appointment.time)}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[appointment.status]}`}>
                    {statusLabels[appointment.status]}
                  </span>
                </div>
              </div>

              <div className="text-sm text-[--gris] mb-3">
                <p>👤 {appointment.ownerName}</p>
                <p>📱 {appointment.whatsapp}</p>
                {appointment.comments && (
                  <p className="text-sm mt-1 italic">📝 {appointment.comments}</p>
                )}
              </div>

              {appointment.status !== 'cancelada' && appointment.status !== 'completada' && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => onStatusChange(appointment.id, 'confirmada')}
                    className="flex-1 py-2 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => onStatusChange(appointment.id, 'completada')}
                    className="flex-1 py-2 px-3 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    Completar
                  </button>
                  <button
                    onClick={() => onReschedule(appointment)}
                    className="flex-1 py-2 px-3 bg-[--naranja]/10 hover:bg-[--naranja]/20 text-[--naranja] text-sm font-medium rounded-lg transition-colors"
                  >
                    Re-agendar
                  </button>
                  <button
                    onClick={() => onCancel(appointment.id)}
                    className="flex-1 py-2 px-3 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => window.open(generateWhatsAppReminder(appointment), '_blank')}
                    className="flex-1 py-2 px-3 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    📱 Recordatorio
                  </button>
                </div>
              )}

              {appointment.status === 'cancelada' && (
                <div className="text-xs text-red-500">Esta cita fue cancelada</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
