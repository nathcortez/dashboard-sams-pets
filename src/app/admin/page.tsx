'use client';

import { useState, useEffect, useMemo } from 'react';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { supabase } from '@/lib/supabase';
import AppointmentList from '@/components/admin/AppointmentList';
import DayView from '@/components/admin/DayView';
import TodayView from '@/components/admin/TodayView';
import NewAppointmentModal from '@/components/admin/NewAppointmentModal';
import RescheduleModal from '@/components/admin/RescheduleModal';
import RemindersView from '@/components/admin/RemindersView';
import ClientsView from '@/components/admin/ClientsView';
import { format, isToday, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

type ViewMode = 'today' | 'upcoming' | 'calendar' | 'all' | 'reminders' | 'clientes';

export default function AdminPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | AppointmentStatus>('all');

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const { data, error: supabaseError } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (supabaseError) throw supabaseError;

      const mappedAppointments: Appointment[] = (data || []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        petName: row.pet_name,
        petBreedAge: row.pet_breed_age,
        petBreed: row.pet_breed,
        petBreedEmoji: row.pet_breed_emoji,
        petSize: row.pet_size,
        baseTimeMinutes: row.base_time_minutes,
        serviceId: row.service_id,
        serviceName: row.service_name,
        serviceAdditionalTime: row.service_additional_time,
        recoveryTime: row.recovery_time,
        petPhoto: row.pet_photo_url,
        ownerName: row.owner_name,
        whatsapp: row.whatsapp,
        comments: row.comments,
        additionalService: row.additional_service,
        date: row.date,
        time: row.time,
        status: row.status as AppointmentStatus,
        originalDate: row.original_date,
        rescheduleHistory: row.reschedule_history || [],
      }));

      setAppointments(mappedAppointments);
      setError(null);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Error al cargar las citas');
      const stored = localStorage.getItem('sams-pets-appointments');
      if (stored) {
        setAppointments(JSON.parse(stored));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // Pedir permiso de notificaciones al cargar
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Realtime: actualizar lista y notificar cuando llega cita nueva
  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          fetchAppointments();

          // Notificación solo en INSERT (cita nueva)
          if (payload.eventType === 'INSERT' && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const apt = payload.new as any;
            const petName = apt.pet_name || 'Mascota';
            const ownerName = apt.owner_name || '';
            const date = apt.date || '';
            const time = apt.time || '';

            new Notification('🐾 Nueva cita — Sam\'s Pets', {
              body: `${petName} (${ownerName})\n📅 ${date} · ⏰ ${time}`,
              icon: '/logo-samspets.png',
              badge: '/logo-samspets.png',
              tag: apt.id,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    try {
      const { error: supabaseError } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (supabaseError) throw supabaseError;

      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
      );
    } catch (err) {
      console.error('Error updating status:', err);
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
      );
    }
  };

  const handleCancel = async (id: string) => {
    const confirmed = window.confirm('¿Estás seguro de que quieres cancelar esta cita?');
    if (confirmed) {
      await handleStatusChange(id, 'cancelada');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Error eliminando cita:', err);
    }
  };

  const handleReschedule = (appointment: Appointment) => {
    setRescheduleAppointment(appointment);
  };

  const handleRescheduleSuccess = () => {
    fetchAppointments();
    setRescheduleAppointment(null);
  };

  // Today's stats
  const todayStats = useMemo(() => {
    const todayApts = appointments.filter((apt) => {
      try { return isToday(parseISO(apt.date)); } catch { return false; }
    });
    return {
      total: todayApts.length,
      pending: todayApts.filter((a) => a.status === 'pendiente').length,
      confirmed: todayApts.filter((a) => a.status === 'confirmada').length,
      completed: todayApts.filter((a) => a.status === 'completada').length,
    };
  }, [appointments]);

  // Upcoming appointments (next 7 days, excluding today)
  const upcomingAppointments = useMemo(() => {
    const tomorrow = startOfDay(addDays(new Date(), 1));
    const nextWeek = startOfDay(addDays(new Date(), 8));
    return appointments.filter((apt) => {
      try {
        const d = parseISO(apt.date);
        return (isAfter(d, tomorrow) || format(d, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) && isBefore(d, nextWeek);
      } catch { return false; }
    }).filter((apt) => apt.status !== 'completada' && apt.status !== 'cancelada');
  }, [appointments]);

  // Group upcoming by date
  const upcomingGrouped = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};
    upcomingAppointments.forEach((apt) => {
      if (!groups[apt.date]) groups[apt.date] = [];
      groups[apt.date].push(apt);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingAppointments]);

  // History (all) with filter
  const historyAppointments = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
    if (historyFilter === 'all') return sorted;
    return sorted.filter((apt) => apt.status === historyFilter);
  }, [appointments, historyFilter]);

  // Group history by date
  const historyGrouped = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};
    historyAppointments.forEach((apt) => {
      if (!groups[apt.date]) groups[apt.date] = [];
      groups[apt.date].push(apt);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [historyAppointments]);

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      const tomorrow = addDays(new Date(), 1);
      if (format(d, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd')) {
        return `Mañana — ${format(d, "EEEE d 'de' MMMM", { locale: es })}`;
      }
      return format(d, "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const tabs: { key: ViewMode; label: string; emoji: string }[] = [
    { key: 'today',     label: 'Hoy',            emoji: '🐕' },
    { key: 'upcoming',  label: 'Próximas',        emoji: '📅' },
    { key: 'calendar',  label: 'Calendario',      emoji: '🗓️' },
    { key: 'all',       label: 'Historial',       emoji: '📋' },
    { key: 'reminders', label: 'Recordatorios',   emoji: '🔔' },
    { key: 'clientes',  label: 'Clientes',        emoji: '👥' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8F7F4' }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E8943D] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6B6B6B]">Cargando citas...</p>
        </div>
      </div>
    );
  }

  const todayFormatted = format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es });

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8F7F4' }}>
      {/* Header */}
      <header className="bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold" style={{ color: '#1B3A5C' }}>
              Sam&apos;s Pets 🐾
            </h1>
            <p className="text-sm" style={{ color: '#6B6B6B' }}>Panel de Gestión</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAppointments}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F8F7F4] transition-colors text-lg"
              title="Refrescar"
            >
              🔄
            </button>
            <button
              onClick={() => setShowNewAppointment(true)}
              className="px-5 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors"
              style={{ backgroundColor: '#E8943D' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D4832F')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8943D')}
            >
              + Nueva Cita
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
            ⚠️ {error}
          </div>
        )}

        {/* Stats del día - Banner horizontal */}
        <div
          className="rounded-2xl p-4 mb-6 border"
          style={{ backgroundColor: '#FFF4EA', borderColor: '#E8943D' }}
        >
          {todayStats.total === 0 ? (
            <p className="text-center font-medium" style={{ color: '#1B3A5C' }}>
              Sin citas para hoy 🌟
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium" style={{ color: '#1B3A5C' }}>
              <span className="capitalize">{todayFormatted}</span>
              <span className="hidden sm:inline" style={{ color: '#E5E3DE' }}>|</span>
              <span>{todayStats.total} citas programadas</span>
              <span className="hidden sm:inline" style={{ color: '#E5E3DE' }}>|</span>
              <span>{todayStats.pending} por confirmar</span>
              <span className="hidden sm:inline" style={{ color: '#E5E3DE' }}>|</span>
              <span>{todayStats.completed} completadas</span>
            </div>
          )}
        </div>

        {/* Tabs de navegación */}
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: '#E5E3DE' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className="px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors whitespace-nowrap"
              style={{
                backgroundColor: viewMode === tab.key ? '#E8943D' : 'transparent',
                color: viewMode === tab.key ? '#FFFFFF' : '#6B6B6B',
              }}
              onMouseEnter={(e) => {
                if (viewMode !== tab.key) e.currentTarget.style.backgroundColor = '#F8F7F4';
              }}
              onMouseLeave={(e) => {
                if (viewMode !== tab.key) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {viewMode === 'today' && (
          <TodayView
            appointments={appointments}
            onStatusChange={handleStatusChange}
            onCancel={handleCancel}
            onReschedule={handleReschedule}
            onDelete={handleDelete}
            onNewAppointment={() => setShowNewAppointment(true)}
          />
        )}

        {viewMode === 'upcoming' && (
          <div>
            {upcomingGrouped.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-lg font-medium" style={{ color: '#1B3A5C' }}>No hay citas próximas</p>
                <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>Los próximos 7 días están libres</p>
              </div>
            ) : (
              <div className="space-y-6">
                {upcomingGrouped.map(([dateStr, apts]) => (
                  <div key={dateStr}>
                    <h3 className="text-base font-semibold mb-3 capitalize" style={{ color: '#1B3A5C' }}>
                      {formatDateLabel(dateStr)}
                    </h3>
                    <AppointmentList
                      appointments={apts}
                      onStatusChange={handleStatusChange}
                      onCancel={handleCancel}
                      onReschedule={handleReschedule}
                      onDelete={handleDelete}
                      compact
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <DayView
              appointments={appointments}
              onCancel={handleCancel}
              onReschedule={handleReschedule}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        {viewMode === 'reminders' && (
          <RemindersView />
        )}

        {viewMode === 'clientes' && (
          <ClientsView />
        )}

        {viewMode === 'all' && (
          <div>
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
              {(['all', 'pendiente', 'confirmada', 'completada', 'cancelada'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: historyFilter === f ? '#E8943D' : '#FFFFFF',
                    color: historyFilter === f ? '#FFFFFF' : '#6B6B6B',
                    border: historyFilter === f ? 'none' : '1px solid #E5E3DE',
                  }}
                >
                  {f === 'all' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
                </button>
              ))}
            </div>

            {historyGrouped.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-lg font-medium" style={{ color: '#1B3A5C' }}>No hay citas registradas</p>
              </div>
            ) : (
              <div className="space-y-6">
                {historyGrouped.map(([dateStr, apts]) => (
                  <div key={dateStr}>
                    <h3 className="text-sm font-semibold mb-3 capitalize" style={{ color: '#6B6B6B' }}>
                      {formatDateLabel(dateStr)}
                    </h3>
                    <AppointmentList
                      appointments={apts}
                      onStatusChange={handleStatusChange}
                      onCancel={handleCancel}
                      onReschedule={handleReschedule}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <NewAppointmentModal
        isOpen={showNewAppointment}
        onClose={() => setShowNewAppointment(false)}
        onSuccess={fetchAppointments}
        selectedDate={selectedDate}
      />

      <RescheduleModal
        isOpen={rescheduleAppointment !== null}
        onClose={() => setRescheduleAppointment(null)}
        appointment={rescheduleAppointment}
        onSuccess={handleRescheduleSuccess}
      />
    </div>
  );
}
