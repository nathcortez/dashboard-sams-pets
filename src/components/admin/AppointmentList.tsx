'use client';

import { Appointment, AppointmentStatus } from '@/types/appointment';
import { generateWhatsAppReminder } from '@/lib/whatsapp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AppointmentListProps {
  appointments: Appointment[];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onCancel?: (id: string) => void;
  onReschedule?: (appointment: Appointment) => void;
  compact?: boolean;
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

export default function AppointmentList({ appointments, onStatusChange, onCancel, onReschedule, compact }: AppointmentListProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T12:00:00'), "EEEE d MMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const handleCancel = (id: string) => {
    if (onCancel) {
      onCancel(id);
    } else {
      const confirmed = window.confirm('¿Estás seguro de que quieres cancelar esta cita?');
      if (confirmed) {
        onStatusChange(id, 'cancelada');
      }
    }
  };

  if (appointments.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="text-4xl mb-3">📅</div>
        <p style={{ color: '#6B6B6B' }}>No hay citas programadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {appointments.map((appointment) => {
        const petName = appointment.petName || appointment.pet_name || 'Sin nombre';
        const ownerName = appointment.ownerName || appointment.owner_name || '';
        const breed = appointment.petBreed || appointment.pet_breed || '';
        const breedEmoji = appointment.petBreedEmoji || appointment.pet_breed_emoji || '';
        const serviceName = appointment.serviceName || appointment.service_name || '';
        const photo = appointment.petPhoto || appointment.pet_photo_url || '';
        const comments = appointment.comments || '';
        const whatsapp = appointment.whatsapp || '';
        const rescheduleHistory = appointment.rescheduleHistory || appointment.reschedule_history || [];
        const additionalService = appointment.additionalService || appointment.additional_service || false;

        return (
          <div
            key={appointment.id}
            className={`bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${compact ? 'p-3' : 'p-4'}`}
            style={{
              borderLeft: `4px solid ${borderColors[appointment.status]}`,
              opacity: appointment.status === 'cancelada' ? 0.6 : 1,
            }}
          >
            <div className="flex items-start gap-3">
              {/* Pet photo / fallback */}
              {photo ? (
                <img src={photo} alt={petName} className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                  style={{ backgroundColor: '#FFF4EA' }}
                >
                  {breedEmoji || '🐕'}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4
                      className={`font-bold text-sm ${appointment.status === 'cancelada' ? 'line-through' : ''}`}
                      style={{ color: appointment.status === 'cancelada' ? '#9CA3AF' : '#1B3A5C' }}
                    >
                      {petName} {breedEmoji}
                    </h4>
                    <p className="text-xs capitalize whitespace-nowrap" style={{ color: '#6B6B6B' }}>
                      {formatDate(appointment.date)} · {formatTime(appointment.time)}
                    </p>
                  </div>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: statusBadgeStyles[appointment.status].bg,
                      color: statusBadgeStyles[appointment.status].text,
                    }}
                  >
                    {statusLabels[appointment.status]}
                  </span>
                </div>

                <div className="mt-1.5 text-xs space-y-0.5" style={{ color: '#6B6B6B' }}>
                  <p>👤 {ownerName} {whatsapp && `· 📱 ${whatsapp}`}</p>
                  {serviceName && <p>✂️ {serviceName}</p>}
                  {additionalService && (
                    <p style={{ color: '#E8943D' }} className="font-medium">⚠️ Servicio adicional</p>
                  )}
                  {comments && <p className="italic">📝 {comments}</p>}
                  {rescheduleHistory.length > 0 && (
                    <p style={{ color: '#2563EB' }}>
                      🔄 Re-agendada {rescheduleHistory.length} vez(es)
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                {appointment.status !== 'cancelada' && appointment.status !== 'completada' && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {appointment.status === 'pendiente' && (
                      <button
                        onClick={() => onStatusChange(appointment.id, 'confirmada')}
                        className="py-1.5 px-3 text-white text-xs font-semibold rounded-xl transition-colors"
                        style={{ backgroundColor: '#E8943D' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D4832F')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8943D')}
                      >
                        ✓ Confirmar
                      </button>
                    )}
                    {appointment.status === 'confirmada' && (
                      <button
                        onClick={() => onStatusChange(appointment.id, 'completada')}
                        className="py-1.5 px-3 text-white text-xs font-semibold rounded-xl transition-colors"
                        style={{ backgroundColor: '#4A7C59' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3D6A4B')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4A7C59')}
                      >
                        ✅ Completar
                      </button>
                    )}
                    {onReschedule && (
                      <button
                        onClick={() => onReschedule(appointment)}
                        className="py-1.5 px-3 text-xs font-medium rounded-xl transition-colors"
                        style={{ backgroundColor: '#FFF4EA', color: '#E8943D' }}
                      >
                        📅 Re-agendar
                      </button>
                    )}
                    <button
                      onClick={() => handleCancel(appointment.id)}
                      className="py-1.5 px-3 text-xs font-medium rounded-xl transition-colors"
                      style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}
                    >
                      ❌ Cancelar
                    </button>
                    <button
                      onClick={() => window.open(generateWhatsAppReminder(appointment), '_blank')}
                      className="py-1.5 px-3 text-xs font-medium rounded-xl transition-colors"
                      style={{ backgroundColor: '#E8F5E9', color: '#4A7C59' }}
                    >
                      📱 Recordatorio
                    </button>
                  </div>
                )}

                {appointment.status === 'cancelada' && (
                  <p className="text-xs mt-2" style={{ color: '#EF4444' }}>Esta cita fue cancelada</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
