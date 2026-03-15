'use client';

import { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface DayViewProps {
  appointments: Appointment[];
  onCancel: (id: string) => void;
  onReschedule: (appointment: Appointment) => void;
  onDelete?: (id: string) => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
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

export default function DayView({ appointments, onCancel, onReschedule, onDelete, onStatusChange }: DayViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((apt) => {
      if (!map[apt.date]) {
        map[apt.date] = [];
      }
      map[apt.date].push(apt);
    });
    Object.keys(map).forEach((date) => {
      map[date].sort((a, b) => a.time.localeCompare(b.time));
    });
    return map;
  }, [appointments]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return appointmentsByDate[dateStr] || [];
  }, [selectedDate, appointmentsByDate]);

  const formatDateHeader = (date: Date) => {
    return format(date, "d 'de' MMMM yyyy", { locale: es });
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="rounded-2xl p-5">
      {/* Month header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: '#1B3A5C' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8F7F4')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          ←
        </button>
        <h3 className="text-lg font-bold capitalize" style={{ color: '#1B3A5C' }}>
          {format(currentDate, 'MMMM yyyy', { locale: es })}
        </h3>
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: '#1B3A5C' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8F7F4')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          →
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day) => (
          <div key={day} className="text-center text-xs font-medium uppercase tracking-wider py-2" style={{ color: '#6B6B6B' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasAppointments = appointmentsByDate[dateStr]?.length > 0;
          const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isTodayDate = isToday(day);

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(day)}
              className="aspect-square p-1 text-sm rounded-xl border transition-colors relative flex flex-col items-center justify-center"
              style={{
                backgroundColor: isSelected ? '#E8943D' : isWeekend ? '#FAF8F5' : 'transparent',
                color: isSelected ? '#FFFFFF' : '#1B3A5C',
                borderWidth: isTodayDate && !isSelected ? '2px' : '1px',
                borderColor: isTodayDate && !isSelected ? '#E8943D' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = '#F8F7F4';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = isWeekend ? '#FAF8F5' : 'transparent';
              }}
            >
              <span className="font-medium">{format(day, 'd')}</span>
              {hasAppointments && (
                <span
                  className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isSelected ? '#FFFFFF' : '#E8943D' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      <div className="mt-6 pt-5" style={{ borderTop: '1px solid #E5E3DE' }}>
        <h4 className="text-base font-semibold mb-4" style={{ color: '#1B3A5C' }}>
          {selectedDate ? formatDateHeader(selectedDate) : 'Selecciona un día'}
        </h4>

        {selectedDayAppointments.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#F8F7F4' }}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-3 mx-auto bg-white"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            >
              📅
            </div>
            <p className="font-medium mb-1" style={{ color: '#1B3A5C' }}>No hay citas programadas</p>
            <p className="text-sm" style={{ color: '#6B6B6B' }}>Selecciona otro día o agenda una nueva</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDayAppointments.map((appointment) => {
              const petName = appointment.petName || appointment.pet_name || 'Sin nombre';
              const ownerName = appointment.ownerName || appointment.owner_name || '';
              const breed = appointment.petBreed || appointment.pet_breed || '';
              const breedEmoji = appointment.petBreedEmoji || appointment.pet_breed_emoji || '';
              const serviceName = appointment.serviceName || appointment.service_name || '';
              const photo = appointment.petPhoto || appointment.pet_photo_url || '';
              const comments = appointment.comments || '';
              const additionalService = appointment.additionalService || appointment.additional_service || false;
              const rescheduleHistory = appointment.rescheduleHistory || appointment.reschedule_history || [];

              return (
                <div
                  key={appointment.id}
                  className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                  style={{
                    borderLeft: `4px solid ${borderColors[appointment.status]}`,
                    opacity: appointment.status === 'cancelada' ? 0.6 : 1,
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      {photo ? (
                        <img src={photo} alt={petName} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                          style={{ backgroundColor: '#FFF4EA' }}
                        >
                          {breedEmoji || '🐕'}
                        </div>
                      )}
                      <div>
                        <h5 className="font-bold text-sm" style={{ color: '#1B3A5C' }}>{petName} {breedEmoji}</h5>
                        {breed && <p className="text-xs" style={{ color: '#6B6B6B' }}>{breed}</p>}
                        {serviceName && <p className="text-xs" style={{ color: '#6B6B6B' }}>✂️ {serviceName}</p>}
                      </div>
                    </div>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: statusBadgeStyles[appointment.status].bg,
                        color: statusBadgeStyles[appointment.status].text,
                      }}
                    >
                      {statusLabels[appointment.status]}
                    </span>
                  </div>

                  <div className="flex gap-3 text-sm mb-2" style={{ color: '#1B3A5C' }}>
                    <span className="whitespace-nowrap">⏰ {formatTime(appointment.time)}</span>
                  </div>

                  <div className="text-xs mb-3" style={{ color: '#6B6B6B' }}>
                    <p>👤 {ownerName}</p>
                    <p>📱 {appointment.whatsapp}</p>
                    {additionalService && (
                      <p className="font-medium" style={{ color: '#E8943D' }}>⚠️ Servicio adicional</p>
                    )}
                    {comments && <p className="mt-1 italic">📝 {comments}</p>}
                    {rescheduleHistory.length > 0 && (
                      <p className="mt-1" style={{ color: '#2563EB' }}>
                        🔄 Re-agendada {rescheduleHistory.length} vez(es)
                      </p>
                    )}
                  </div>

                  {appointment.status !== 'cancelada' && appointment.status !== 'completada' && (
                    <div className="flex gap-2 flex-wrap">
                      {appointment.status === 'pendiente' && (
                        <button
                          onClick={() => onStatusChange(appointment.id, 'confirmada')}
                          className="py-1.5 px-3 text-white text-xs font-semibold rounded-xl transition-colors"
                          style={{ backgroundColor: '#E8943D' }}
                        >
                          ✓ Confirmar
                        </button>
                      )}
                      {appointment.status === 'confirmada' && (
                        <button
                          onClick={() => onStatusChange(appointment.id, 'completada')}
                          className="py-1.5 px-3 text-white text-xs font-semibold rounded-xl transition-colors"
                          style={{ backgroundColor: '#4A7C59' }}
                        >
                          ✅ Completar
                        </button>
                      )}
                      <button
                        onClick={() => onReschedule(appointment)}
                        className="py-1.5 px-3 text-xs font-medium rounded-xl transition-colors"
                        style={{ backgroundColor: '#FFF4EA', color: '#E8943D' }}
                      >
                        📅 Re-agendar
                      </button>
                      <button
                        onClick={() => onCancel(appointment.id)}
                        className="py-1.5 px-3 text-xs font-medium rounded-xl transition-colors"
                        style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}
                      >
                        ❌ Cancelar
                      </button>
                      {onDelete && (
                        <button
                          onClick={() => {
                            const name = appointment.petName || appointment.pet_name || 'esta mascota';
                            if (window.confirm(`¿Eliminar la cita de ${name}? Esta acción no se puede deshacer.`)) {
                              onDelete(appointment.id);
                            }
                          }}
                          className="py-1.5 px-3 text-xs font-medium rounded-xl transition-colors"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                        >
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                  )}

                  {appointment.status === 'cancelada' && (
                    <p className="text-xs" style={{ color: '#EF4444' }}>Esta cita fue cancelada</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
