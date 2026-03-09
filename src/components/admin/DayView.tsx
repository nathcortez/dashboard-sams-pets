'use client';

import { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface DayViewProps {
  appointments: Appointment[];
  onCancel: (id: string) => void;
  onReschedule: (appointment: Appointment) => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
}

const statusColors: Record<AppointmentStatus, string> = {
  pendiente: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  confirmada: 'bg-blue-100 border-blue-300 text-blue-800',
  completada: 'bg-green-100 border-green-300 text-green-800',
  cancelada: 'bg-red-50 border-red-200 text-red-400 line-through',
};

const statusLabels: Record<AppointmentStatus, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function DayView({ appointments, onCancel, onReschedule, onStatusChange }: DayViewProps) {
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
    return format(date, "d MMMM yyyy", { locale: es });
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="bg-white rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
      {/* Cabecera del mes */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F3EE] transition-colors text-[#4A4A4A]"
        >
          ←
        </button>
        <h3 className="text-[18px] font-bold text-[#1C1C1C]">
          {format(currentDate, "MMMM yyyy", { locale: es }).charAt(0).toUpperCase() + format(currentDate, "MMMM yyyy", { locale: es }).slice(1)}
        </h3>
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F3EE] transition-colors text-[#4A4A4A]"
        >
          →
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day) => (
          <div key={day} className="text-center text-[11px] font-medium uppercase tracking-wider text-[#9E9E9E] py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasAppointments = appointmentsByDate[dateStr]?.length > 0;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayOfWeek = day.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(day)}
              className={`
                aspect-square p-1 text-sm rounded-[8px] transition-colors relative flex flex-col items-center justify-center
                ${isWeekend ? 'bg-[#FAF8F5]' : ''}
                ${isSelected ? 'bg-[#4A7C59] text-white' : 'hover:bg-[#F5F3EE]'}
                ${isToday(day) && !isSelected ? 'ring-2 ring-[#4A7C59] ring-inset' : ''}
              `}
            >
              <span className={isSelected ? 'text-white' : isToday(day) ? 'text-[#4A7C59] font-bold' : 'text-[#1C1C1C]'}>
                {format(day, 'd')}
              </span>
              {hasAppointments && (
                <span className={`absolute bottom-1 w-[6px] h-[6px] rounded-full ${isSelected ? 'bg-white' : 'bg-[#C97B5A]'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel de citas del día seleccionado */}
      <div className="mt-6 pt-5 border-t border-[#E8E4DC]">
        <h4 className="text-[16px] font-semibold text-[#1C1C1C] mb-4">
          {selectedDate ? formatDateHeader(selectedDate) : 'Selecciona un día'}
        </h4>

        {selectedDayAppointments.length === 0 ? (
          <div className="bg-[#FAF8F5] rounded-[12px] p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-2xl mb-3 mx-auto shadow-sm">
              📅
            </div>
            <p className="text-[#4A4A4A] font-medium mb-1">No hay citas programadas</p>
            <p className="text-[#9E9E9E] text-sm">Selecciona otro día o agenda una nueva</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDayAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className={`bg-white rounded-2xl p-4 shadow-md border-l-4 ${
                  appointment.status === 'cancelada'
                    ? 'border-red-300 opacity-60'
                    : appointment.status === 'completada'
                    ? 'border-green-400'
                    : appointment.status === 'confirmada'
                    ? 'border-blue-400'
                    : 'border-yellow-400'
                } ${appointment.status === 'cancelada' ? 'line-through text-gray-400' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h5 className="font-semibold text-[--azul-oscuro]">{appointment.petName}</h5>
                    <p className="text-xs text-gray-500">{appointment.petBreedAge}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[appointment.status]}`}>
                    {statusLabels[appointment.status]}
                  </span>
                </div>

                <div className="flex gap-3 text-sm text-gray-600 mb-2">
                  <span>⏰ {formatTime(appointment.time)}</span>
                </div>

                <div className="text-sm text-gray-500 mb-3">
                  <p>👤 {appointment.ownerName}</p>
                  <p>📱 {appointment.whatsapp}</p>
                  {appointment.additionalService && (
                    <p className="text-[--naranja] font-medium">⚠️ Servicio adicional</p>
                  )}
                  {appointment.comments && (
                    <p className="text-xs mt-1 italic">📝 {appointment.comments}</p>
                  )}
                  {appointment.rescheduleHistory && appointment.rescheduleHistory.length > 0 && (
                    <p className="text-xs mt-1 text-blue-600">
                      🔄 Re-agendada {appointment.rescheduleHistory.length} vez(es)
                    </p>
                  )}
                </div>

                {appointment.status !== 'cancelada' && appointment.status !== 'completada' && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => onStatusChange(appointment.id, 'confirmada')}
                      className="py-1.5 px-3 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => onStatusChange(appointment.id, 'completada')}
                      className="py-1.5 px-3 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Completar
                    </button>
                    <button
                      onClick={() => onReschedule(appointment)}
                      className="py-1.5 px-3 bg-[--naranja]/10 hover:bg-[--naranja]/20 text-[--naranja] text-xs font-medium rounded-lg transition-colors"
                    >
                      Re-agendar
                    </button>
                    <button
                      onClick={() => onCancel(appointment.id)}
                      className="py-1.5 px-3 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {appointment.status === 'cancelada' && (
                  <div className="text-xs text-red-500">
                    Esta cita fue cancelada
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
