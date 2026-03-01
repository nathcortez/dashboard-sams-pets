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
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ←
        </button>
        <h3 className="font-semibold text-[--azul-oscuro]">
          {format(currentDate, "MMMM yyyy", { locale: es })}
        </h3>
        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasAppointments = appointmentsByDate[dateStr]?.length > 0;
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(day)}
              className={`
                aspect-square p-1 text-sm rounded-lg transition-colors relative
                ${isSelected ? 'bg-[--azul-principal] text-white' : 'hover:bg-gray-100'}
                ${isToday(day) && !isSelected ? 'ring-2 ring-[--naranja] ring-inset' : ''}
              `}
            >
              {format(day, 'd')}
              {hasAppointments && (
                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[--naranja]'}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <h4 className="font-semibold text-[--azul-oscuro] mb-3">
          {selectedDate ? formatDateHeader(selectedDate) : 'Selecciona un día'}
        </h4>

        {selectedDayAppointments.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">📅</div>
            <p className="text-gray-500 text-sm">No hay citas programadas</p>
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
