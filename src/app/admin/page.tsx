'use client';

import { useState, useEffect } from 'react';
import { Appointment, AppointmentStatus } from '@/types/appointment';
import { supabase } from '@/lib/supabase';
import StatsCard from '@/components/admin/StatsCard';
import AppointmentList from '@/components/admin/AppointmentList';
import DayView from '@/components/admin/DayView';
import NewAppointmentModal from '@/components/admin/NewAppointmentModal';
import RescheduleModal from '@/components/admin/RescheduleModal';

type ViewMode = 'list' | 'calendar';

export default function AdminPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<'all' | AppointmentStatus>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);

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

  const handleReschedule = (appointment: Appointment) => {
    setRescheduleAppointment(appointment);
  };

  const handleRescheduleSuccess = () => {
    fetchAppointments();
    setRescheduleAppointment(null);
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === 'all') return true;
    return apt.status === filter;
  });

  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => a.status === 'pendiente').length,
    confirmed: appointments.filter((a) => a.status === 'confirmada').length,
    completed: appointments.filter((a) => a.status === 'completada').length,
    cancelled: appointments.filter((a) => a.status === 'cancelada').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[--azul-principal] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[--gris]">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[--azul-principal] flex items-center justify-center">
              <span className="text-white text-lg">🐕</span>
            </div>
            <div>
              <h1 className="font-bold text-[--azul-oscuro]">Gestión de Citas</h1>
              <p className="text-xs text-[--gris]">Sam's Pets</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewAppointment(true)}
              className="px-4 py-2 bg-[--azul-principal] text-white text-sm font-medium rounded-full hover:bg-[--azul-oscuro] transition-colors"
            >
              + Nueva Cita
            </button>
            <button onClick={fetchAppointments} className="text-sm text-[--azul-principal] hover:underline">🔄</button>
            <a href="/" className="text-sm text-[--azul-principal] hover:underline">Ver tienda</a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">⚠️ {error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatsCard title="Total" value={stats.total} icon="📊" color="blue" />
          <StatsCard title="Pendientes" value={stats.pending} icon="⏳" color="yellow" />
          <StatsCard title="Confirmadas" value={stats.confirmed} icon="✓" color="blue" />
          <StatsCard title="Completadas" value={stats.completed} icon="✅" color="green" />
          <StatsCard title="Canceladas" value={stats.cancelled} icon="❌" color="red" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
          <div className="flex bg-white rounded-full p-1 shadow-sm">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-[--azul-principal] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-[--azul-principal] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              📅 Calendario
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {(['all', 'pendiente', 'confirmada', 'completada', 'cancelada'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-[--azul-principal] text-white' : 'bg-white text-[--gris] hover:bg-gray-100'}`}
              >
                {f === 'all' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'list' ? (
          <AppointmentList
            appointments={filteredAppointments}
            onStatusChange={handleStatusChange}
            onCancel={handleCancel}
            onReschedule={handleReschedule}
          />
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <DayView
              appointments={filteredAppointments}
              onCancel={handleCancel}
              onReschedule={handleReschedule}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        <div className="mt-8 p-4 bg-green-50 rounded-xl">
          <h3 className="font-medium text-[--azul-oscuro] mb-2">ℹ️ Información</h3>
          <p className="text-sm text-[--gris]">Las citas se almacenan en Supabase. Accede desde cualquier dispositivo.</p>
        </div>
      </main>

      <NewAppointmentModal
        isOpen={showNewAppointment}
        onClose={() => setShowNewAppointment(false)}
        onSuccess={fetchAppointments}
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
