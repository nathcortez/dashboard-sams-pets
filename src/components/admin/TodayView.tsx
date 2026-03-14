'use client';

import { useMemo } from 'react';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { generateWhatsAppReminder } from '@/lib/whatsapp';
import { format, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface TodayViewProps {
  appointments: Appointment[];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onCancel: (id: string) => void;
  onReschedule: (appointment: Appointment) => void;
  onNewAppointment: () => void;
}

const borderColors: Record<AppointmentStatus, string> = {
  pendiente: '#E8943D',
  confirmada: '#2563EB',
  completada: '#4A7C59',
  cancelada: '#EF4444',
};

const statusBadgeStyles: Record<AppointmentStatus, { bg: string; text: string }> = {
  pendiente: { bg: '#FFF4EA', text: '#E8943D' },
  confirmada: { bg: '#EFF6FF', text: '#2563EB' },
  completada: { bg: '#E8F5E9', text: '#4A7C59' },
  cancelada: { bg: '#FEF2F2', text: '#EF4444' },
};

const statusLabels: Record<AppointmentStatus, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const getDuration = (apt: Appointment) => {
  const base = apt.baseTimeMinutes || apt.base_time_minutes || 60;
  const service = apt.serviceAdditionalTime || apt.service_additional_time || 0;
  const recovery = apt.recoveryTime || apt.recovery_time || 0;
  return base + service + recovery;
};

const formatDuration = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}h ${min % 60 > 0 ? min % 60 + 'min' : ''}`.trim() : `${min}min`;

export default function TodayView({ appointments, onStatusChange, onCancel, onReschedule, onNewAppointment }: TodayViewProps) {
  const todayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => {
        try { return isToday(parseISO(apt.date)); } catch { return false; }
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments]);

  const stats = useMemo(() => ({
    total: todayAppointments.length,
    completed: todayAppointments.filter((a) => a.status === 'completada').length,
    pending: todayAppointments.filter((a) => a.status === 'pendiente' || a.status === 'confirmada').length,
  }), [todayAppointments]);

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const todayFormatted = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es });
  const progressPct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  return (
    <div>
      {/* Header de fecha */}
      <h2 className="text-xl font-bold mb-1 capitalize" style={{ color: '#1B3A5C' }}>
        📅 {todayFormatted}
      </h2>
      <p className="text-sm mb-6" style={{ color: '#6B6B6B' }}>
        {stats.total} citas · {stats.pending} activas · {stats.completed} completadas
      </p>

      {todayAppointments.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="text-6xl mb-4">🐕✨</div>
          <p className="text-xl font-semibold mb-2" style={{ color: '#1B3A5C' }}>
            ¡Día libre!
          </p>
          <p className="mb-6" style={{ color: '#6B6B6B' }}>
            No hay citas programadas para hoy
          </p>
          <button
            onClick={onNewAppointment}
            className="px-6 py-3 text-white font-semibold rounded-xl transition-colors"
            style={{ backgroundColor: '#E8943D' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D4832F')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8943D')}
          >
            + Agendar primera cita del día
          </button>
        </div>
      ) : (
        <>
          {/* Timeline de citas */}
          <div className="relative">
            {todayAppointments.map((appointment, index) => {
              const isLast = index === todayAppointments.length - 1;
              const duration = getDuration(appointment);
              const petName = appointment.petName || appointment.pet_name || 'Sin nombre';
              const ownerName = appointment.ownerName || appointment.owner_name || '';
              const breed = appointment.petBreed || appointment.pet_breed || '';
              const breedEmoji = appointment.petBreedEmoji || appointment.pet_breed_emoji || '';
              const serviceName = appointment.serviceName || appointment.service_name || '';
              const photo = appointment.petPhoto || appointment.pet_photo_url || '';
              const comments = appointment.comments || '';

              return (
                <div key={appointment.id} className="flex gap-4 mb-1">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center pt-1" style={{ minWidth: '70px' }}>
                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: '#1B3A5C' }}>
                      {formatTime(appointment.time)}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full mt-2 shrink-0"
                      style={{ backgroundColor: borderColors[appointment.status] }}
                    />
                    {!isLast && (
                      <div className="w-0.5 flex-1 mt-1" style={{ backgroundColor: '#E5E3DE', minHeight: '40px' }} />
                    )}
                  </div>

                  {/* Appointment card */}
                  <div
                    className="flex-1 bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                    style={{
                      borderLeft: `4px solid ${borderColors[appointment.status]}`,
                      opacity: appointment.status === 'cancelada' ? 0.6 : 1,
                    }}
                  >
                    {/* Top row: info + badge + photo */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-bold text-base" style={{ color: '#1B3A5C' }}>
                            {petName}
                          </h4>
                          {breedEmoji && <span>{breedEmoji}</span>}
                          {/* Status badge */}
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: statusBadgeStyles[appointment.status].bg,
                              color: statusBadgeStyles[appointment.status].text,
                            }}
                          >
                            {statusLabels[appointment.status]}
                          </span>
                        </div>
                        {breed && (
                          <p className="text-sm" style={{ color: '#6B6B6B' }}>{breed}</p>
                        )}
                        <p className="text-sm" style={{ color: '#6B6B6B' }}>👤 {ownerName}</p>
                        {serviceName && (
                          <p className="text-sm" style={{ color: '#6B6B6B' }}>✂️ {serviceName}</p>
                        )}
                        <p className="text-sm" style={{ color: '#6B6B6B' }}>🕐 {formatDuration(duration)}</p>
                      </div>
                      {photo && (
                        <img
                          src={photo}
                          alt={petName}
                          className="w-12 h-12 rounded-full object-cover shrink-0 ml-3"
                        />
                      )}
                      {!photo && (
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 ml-3 text-xl"
                          style={{ backgroundColor: '#FFF4EA' }}
                        >
                          {breedEmoji || '🐕'}
                        </div>
                      )}
                    </div>

                    {/* Comments */}
                    {comments && (
                      <p className="text-sm italic mb-3" style={{ color: '#6B6B6B' }}>
                        📝 {comments}
                      </p>
                    )}

                    {/* Action buttons */}
                    {appointment.status !== 'cancelada' && appointment.status !== 'completada' && (
                      <div className="flex flex-wrap gap-2">
                        {/* Primary action */}
                        {appointment.status === 'pendiente' && (
                          <button
                            onClick={() => onStatusChange(appointment.id, 'confirmada')}
                            className="flex-1 py-2.5 px-4 text-white text-sm font-semibold rounded-xl transition-colors"
                            style={{ backgroundColor: '#2563EB' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1D4ED8')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563EB')}
                          >
                            ✓ Confirmar
                          </button>
                        )}
                        {appointment.status === 'confirmada' && (
                          <button
                            onClick={() => onStatusChange(appointment.id, 'completada')}
                            className="flex-1 py-2.5 px-4 text-white text-sm font-semibold rounded-xl transition-colors"
                            style={{ backgroundColor: '#4A7C59' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3D6A4B')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4A7C59')}
                          >
                            ✅ Completar
                          </button>
                        )}

                        {/* Secondary actions */}
                        <button
                          onClick={() => onReschedule(appointment)}
                          className="py-2 px-3 text-xs font-medium rounded-xl transition-colors"
                          style={{ backgroundColor: '#FFF4EA', color: '#E8943D' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FFECD4')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFF4EA')}
                        >
                          📅 Re-agendar
                        </button>
                        <button
                          onClick={() => onCancel(appointment.id)}
                          className="py-2 px-3 text-xs font-medium rounded-xl transition-colors"
                          style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEE2E2')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                        >
                          ❌ Cancelar
                        </button>
                        <button
                          onClick={() => window.open(generateWhatsAppReminder(appointment), '_blank')}
                          className="py-2 px-3 text-xs font-medium rounded-xl transition-colors"
                          style={{ backgroundColor: '#E8F5E9', color: '#4A7C59' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#C8E6C9')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8F5E9')}
                        >
                          📱 Recordatorio
                        </button>
                      </div>
                    )}

                    {appointment.status === 'cancelada' && (
                      <p className="text-xs" style={{ color: '#EF4444' }}>Esta cita fue cancelada</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-6 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: '#1B3A5C' }}>
                Progreso del día
              </span>
              <span className="text-sm font-bold" style={{ color: '#E8943D' }}>
                {stats.completed}/{stats.total} citas completadas
              </span>
            </div>
            <div className="w-full h-3 rounded-full" style={{ backgroundColor: '#E5E3DE' }}>
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: '#E8943D' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
