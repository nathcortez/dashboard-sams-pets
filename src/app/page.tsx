'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Appointment, AppointmentStatus, TIME_SLOTS } from '@/types/appointment';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isToday, eachMonthOfInterval, startOfYear, parseISO, addDays, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { logout, getSession } from '@/lib/auth';
import { User, PERMISSIONS, Permission } from '@/types/auth';
import Sidebar from '@/components/admin/Sidebar';
import RemindersView from '@/components/admin/RemindersView';

type View = 'inicio' | 'agenda' | 'mascotas' | 'clientes' | 'fichas' | 'recordatorios' | 'reportes' | 'configuracion';

interface GroomingReport {
  id?: string;
  created_at?: string;
  appointment_id: string;
  date: string;
  pet_name: string;
  pet_breed: string;
  pet_age: string;
  pet_sex: string;
  pet_weight: string;
  pet_color: string;
  pet_vaccines: boolean;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  service_grooming_detallado: boolean;
  service_grooming_bano: boolean;
  service_recuperacion_manto: boolean;
  service_deslanado_extra: boolean;
  prob_nudos: boolean;
  prob_pulgas: boolean;
  prob_irritacion: boolean;
  prob_heridas: boolean;
  prob_mal_olor: boolean;
  prob_nervioso: boolean;
  prob_exceso_muda: boolean;
  prob_comportamiento: boolean;
  prob_oidos: boolean;
  prob_unas: boolean;
  prob_obesidad: boolean;
  prob_desnutricion: boolean;
  observations: string;
}

const SIZE_DURATION: Record<string, number> = {
  pequeno: 30,
  mediano: 60,
  intermedio: 90,
  grande: 120,
};

const SIZE_LABELS: Record<string, string> = {
  pequeno: 'Pequeño (30 min)',
  mediano: 'Mediano (60 min)',
  intermedio: 'Intermedio (90 min)',
  grande: 'Grande (120 min)',
};

const SIZE_BREEDS: Record<string, { name: string; emoji: string }[]> = {
  pequeno: [
    { name: 'Chihuahua', emoji: '🐕' },
    { name: 'Cachorro', emoji: '🐶' },
    { name: 'Mestizo', emoji: '🐕' },
  ],
  mediano: [
    { name: 'French Poodle', emoji: '🐩' },
    { name: 'Schnauzer', emoji: '🐕' },
    { name: 'Yorkie', emoji: '🐶' },
    { name: 'Pomerania', emoji: '🐕' },
    { name: 'Mestizo', emoji: '🐕' },
    { name: 'Maltés', emoji: '🐕' },
    { name: 'Bulldog Francés', emoji: '🐶' },
    { name: 'Pug', emoji: '🐕' },
    { name: 'Shih Tzu', emoji: '🐕' },
    { name: 'Bichón Frisé', emoji: '🐩' },
    { name: 'Dachshund (Salchicha)', emoji: '🌭' },
  ],
  intermedio: [
    { name: 'Cocker Spaniel', emoji: '🐕' },
    { name: 'Beagle', emoji: '🐕' },
    { name: 'Pitbull', emoji: '🐕' },
    { name: 'Boston Terrier', emoji: '🐶' },
    { name: 'Bulldog Inglés', emoji: '🐶' },
    { name: 'Pastor Australiano', emoji: '🐕' },
    { name: 'Jack Russell Terrier', emoji: '🐕' },
  ],
  grande: [
    { name: 'Shar Pei', emoji: '🐕' },
    { name: 'Pastor Alemán', emoji: '🐕' },
    { name: 'Labrador', emoji: '🐕' },
    { name: 'Golden Retriever', emoji: '🐕' },
    { name: 'Husky', emoji: '🐕' },
    { name: 'Dóberman', emoji: '🐕' },
    { name: 'Boxer', emoji: '🐕' },
    { name: 'San Bernardo', emoji: '🐕' },
    { name: 'Rottweiler', emoji: '🐕' },
    { name: 'Viejo Pastor Inglés', emoji: '🐕' },
  ],
};

interface Client {
  phone: string;
  name: string;
  pets: Set<string>;
  appointments: Appointment[];
  totalVisits: number;
}

export default function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('inicio');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [customMessageModal, setCustomMessageModal] = useState<{ phone: string; name: string } | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [petSearchQuery, setPetSearchQuery] = useState('');

  // Fichas de grooming
  const [groomingReports, setGroomingReports] = useState<GroomingReport[]>([]);
  const [selectedReportApt, setSelectedReportApt] = useState<Appointment | null>(null);
  const [reportForm, setReportForm] = useState<GroomingReport | null>(null);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const [reportHistory, setReportHistory] = useState<GroomingReport[]>([]);
  const [fichasTab, setFichasTab] = useState<'nueva' | 'historial'>('nueva');

  const [services, setServices] = useState([
    { id: 'grooming', name: 'Grooming Completo', description: 'Baño, corte de pelo, uñas y oídos', duration: 60, price: 150, emoji: '✂️', active: true },
    { id: 'recovery', name: 'Recuperación de manto', description: 'Servicio adicional para pelaje enredado o muy crecido', duration: 45, price: 80, emoji: '🧶', active: true, isAdditional: true },
  ]);
  const [serviceModal, setServiceModal] = useState<{ mode: 'add' | 'edit'; service?: typeof services[0] } | null>(null);
  const [newAppointmentModal, setNewAppointmentModal] = useState(false);
  const [newAptSaving, setNewAptSaving] = useState(false);
  const [editServiceModal, setEditServiceModal] = useState<{ appointment: Appointment; serviceId: string; additionalService: boolean; recoveryTime: number } | null>(null);

  const [newAptSize, setNewAptSize] = useState<string>('');
  const [newAptBreed, setNewAptBreed] = useState<{ name: string; emoji: string } | null>(null);

  const [config, setConfig] = useState({
    workDays: ['1', '2', '3', '4', '5'],
    openTime: '08:00',
    closeTime: '18:00',
    lastAppointmentTime: '16:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    lunchEnabled: true,
    holidays: [] as string[],
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push('/login');
    } else {
      setUser(session);
    }
    setCheckingAuth(false);
  }, [router]);

  const handleLogout = () => {
    logout();
    setUser(null);
    window.location.href = '/login';
  };

  const userPermissions: readonly Permission[] = user ? PERMISSIONS[user.role] : [];

  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase
        .from('business_config')
        .select('*')
        .eq('id', 'main')
        .single();

      if (data) {
        setConfig({
          workDays: data.work_days || ['1','2','3','4','5'],
          openTime: data.open_time || '08:00',
          closeTime: data.close_time || '18:00',
          lastAppointmentTime: data.last_appointment_time || '16:00',
          lunchStart: data.lunch_start || '12:00',
          lunchEnd: data.lunch_end || '13:00',
          lunchEnabled: data.lunch_enabled ?? true,
          holidays: data.holidays || [],
        });
      }
    };
    loadConfig();
  }, []);

  const saveConfig = async () => {
    setConfigLoading(true);
    setConfigSaved(false);
    try {
      await supabase
        .from('business_config')
        .update({
          work_days: config.workDays,
          open_time: config.openTime,
          close_time: config.closeTime,
          last_appointment_time: config.lastAppointmentTime,
          lunch_start: config.lunchStart,
          lunch_end: config.lunchEnd,
          lunch_enabled: config.lunchEnabled,
          holidays: config.holidays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'main');
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err) {
      console.error('Error guardando configuración:', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const canViewClients = userPermissions.includes('clients');
  const canViewReports = userPermissions.includes('reports');

  const [reportDateFrom, setReportDateFrom] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportDateTo, setReportDateTo] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportServiceFilter, setReportServiceFilter] = useState<'all' | 'bano' | 'adicional'>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [dailyGoal, setDailyGoal] = useState<number>(5);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(100);

  useEffect(() => {
    if (!user) return;
    if (currentView === 'clientes' && !canViewClients) setCurrentView('inicio');
    if (currentView === 'reportes' && !canViewReports) setCurrentView('inicio');
  }, [user, currentView, canViewClients, canViewReports]);

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(() => { fetchAppointments(); }, 60000);
    const channel = supabase
      .channel('page-appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => { fetchAppointments(); })
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const deleteClientAppointments = async (phone: string, name: string) => {
    if (!window.confirm(`¿Eliminar a ${name} y todas sus citas? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('appointments').delete().eq('whatsapp', phone);
    if (!error) {
      setAppointments(prev => prev.filter(a => a.whatsapp !== phone));
      setSelectedClient(null);
    }
  };

  const deletePetAppointments = async (petKey: string, petName: string, ownerPhone: string) => {
    if (!window.confirm(`¿Eliminar a ${petName} y todas sus citas? Esta acción no se puede deshacer.`)) return;
    const petsToDelete = appointments.filter(a => `${a.pet_name || a.petName}-${a.whatsapp}` === petKey);
    for (const apt of petsToDelete) {
      await supabase.from('appointments').delete().eq('id', apt.id);
    }
    setAppointments(prev => prev.filter(a => `${a.pet_name || a.petName}-${a.whatsapp}` !== petKey));
    setSelectedPet(null);
  };

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Error fetching appointments:', JSON.stringify(err), err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: AppointmentStatus) => {
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isValidUUID) {
      await fetchAppointments();
      return;
    }
    setUpdatingId(id);
    setAppointments(prev => prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt));
    try {
      const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      await fetchAppointments();
    } catch (err) {
      console.error('Error updating status:', err);
      await fetchAppointments();
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStartGrooming = async (id: string) => {
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isValidUUID) { await fetchAppointments(); return; }
    const startedAt = new Date().toISOString();
    setAppointments(prev => prev.map(apt => apt.id === id ? { ...apt, status: 'en_proceso' as AppointmentStatus, grooming_started_at: startedAt } : apt));
    try {
      const { error } = await supabase.from('appointments').update({ status: 'en_proceso', grooming_started_at: startedAt }).eq('id', id);
      if (error) {
        const { error: error2 } = await supabase.from('appointments').update({ status: 'en_proceso' }).eq('id', id);
        if (error2) throw error2;
      }
      fetchAppointments();
    } catch (err) {
      console.error('Error iniciando grooming:', err);
      fetchAppointments();
    }
  };

  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    appointments.forEach(apt => {
      const dateKey = apt.date;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [appointments]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const emptyDays = Array(startDay).fill(null);
    return [...emptyDays, ...days];
  }, [currentMonth]);

  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return (appointmentsByDate[dateKey] || []).sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, appointmentsByDate]);

  const clients = useMemo(() => {
    const clientMap: Record<string, Client> = {};
    appointments.forEach(apt => {
      const phone = apt.whatsapp || '';
      if (!phone) return;
      if (!clientMap[phone]) {
        clientMap[phone] = { phone, name: apt.owner_name || apt.ownerName || '', pets: new Set(), appointments: [], totalVisits: 0 };
      }
      clientMap[phone].pets.add(`${apt.pet_name || apt.petName}|${apt.pet_breed_age || apt.petBreedAge}`);
      clientMap[phone].appointments.push(apt);
      if (apt.status === 'completada') clientMap[phone].totalVisits++;
    });
    return Object.values(clientMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(query) || c.phone.includes(query));
  }, [clients, searchQuery]);

  interface Pet {
    id: string;
    name: string;
    breed: string;
    breedEmoji: string;
    ownerName: string;
    ownerPhone: string;
    size: string;
    comments: string;
    appointments: Appointment[];
  }

  const pets = useMemo(() => {
    const petMap: Record<string, Pet> = {};
    appointments.forEach(apt => {
      const normalizedPhone = (apt.whatsapp || '').replace(/\D/g, '').trim();
      const normalizedName = (apt.pet_name || apt.petName || '').toLowerCase().trim();
      const petKey = `${normalizedName}-${normalizedPhone}`;
      if (!petKey || !(apt.pet_name || apt.petName)) return;
      if (!petMap[petKey]) {
        petMap[petKey] = {
          id: petKey,
          name: apt.pet_name || apt.petName || '',
          breed: apt.pet_breed_age || apt.petBreedAge || apt.pet_breed || '',
          breedEmoji: apt.pet_breed_emoji || '',
          ownerName: apt.owner_name || apt.ownerName || '',
          ownerPhone: apt.whatsapp || '',
          size: apt.pet_size || '',
          comments: apt.comments || '',
          appointments: [],
        };
      }
      petMap[petKey].appointments.push(apt);
    });
    return Object.values(petMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  const filteredPets = useMemo(() => {
    if (!petSearchQuery.trim()) return pets;
    const query = petSearchQuery.toLowerCase();
    return pets.filter(p => p.name.toLowerCase().includes(query) || p.breed.toLowerCase().includes(query) || p.ownerName.toLowerCase().includes(query));
  }, [pets, petSearchQuery]);

  const stats = {
    total: appointments.length,
    pendiente: appointments.filter(a => a.status === 'pendiente').length,
    confirmada: appointments.filter(a => a.status === 'confirmada').length,
    completada: appointments.filter(a => a.status === 'completada').length,
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(a => a.date === todayStr);

  const todayStats = {
    total: todayAppointments.length,
    pendiente: todayAppointments.filter(a => a.status === 'pendiente').length,
    confirmada: todayAppointments.filter(a => a.status === 'confirmada').length,
    completada: todayAppointments.filter(a => a.status === 'completada').length,
  };

  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrowAppointments = appointments.filter(a => a.date === tomorrowStr);

  const now = new Date();
  const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const upcomingAppointments = todayAppointments
    .filter(a => { const [h, m] = a.time.split(':').map(Number); return h * 60 + m > currentTimeMinutes && a.status !== 'cancelada'; })
    .sort((a, b) => { const [ah, am] = a.time.split(':').map(Number); const [bh, bm] = b.time.split(':').map(Number); return (ah * 60 + am) - (bh * 60 + bm); });

  const nextAppointment = upcomingAppointments[0];

  const getTimeRemaining = () => {
    if (!nextAppointment) return null;
    const [h, m] = nextAppointment.time.split(':').map(Number);
    const remaining = h * 60 + m - currentTimeMinutes;
    if (remaining <= 0) return 'Ahora';
    if (remaining < 60) return `${remaining} min`;
    const hours = Math.floor(remaining / 60);
    const mins = remaining % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const thisWeekAppointments = appointments.filter(a => a.date >= weekAgo);
  const uniqueClientsThisWeek = new Set(thisWeekAppointments.map(a => a.whatsapp)).size;

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'pendiente':  return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmada': return 'bg-[#E8F5E9] text-blue-800 border-blue-200';
      case 'en_proceso': return 'bg-[#F5F3FF] text-purple-700 border-purple-200';
      case 'completada': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelada':  return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    switch (status) {
      case 'pendiente':  return 'Pendiente';
      case 'confirmada': return 'Confirmada';
      case 'en_proceso': return '✂️ En Proceso';
      case 'completada': return 'Completada';
      case 'cancelada':  return 'Cancelada';
    }
  };

  const sendReminder = (apt: Appointment) => {
    const phone = (apt.whatsapp || '').replace(/\D/g, '');
    if (!phone) return;
    const service = apt.additional_service ? 'servicio adicional' : 'baño y corte';
    const dateFormatted = format(new Date(apt.date), 'dd MMMM yyyy', { locale: es });
    const message = `Hola ${apt.owner_name || apt.ownerName}, te recordamos que tienes cita el ${dateFormatted} a las ${apt.time} para ${service} de ${apt.pet_name || apt.petName}. ¡Te esperamos!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sendCustomMessage = () => {
    if (!customMessage.trim() || !customMessageModal) return;
    const phone = customMessageModal.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(customMessage)}`, '_blank');
    setCustomMessage('');
    setCustomMessageModal(null);
  };

  const exportToExcel = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [headers.join(','), ...data.map(row => Object.values(row).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Render vista de agenda ──────────────────────────────────────────────
  const renderCalendarView = () => (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Columna izquierda (40%) */}
      <div className="w-2/5 bg-white rounded-xl shadow-sm border p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F0EDE8] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(currentMonth, 'MMMM yyyy', { locale: es }).slice(1)}
          </h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F0EDE8] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Resumen semana actual */}
        <div className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 mb-3 max-h-[70px]">
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const today = new Date();
              const currentDayOfWeek = today.getDay();
              const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
              const monday = addDays(today, mondayOffset);
              const weekDays = [
                { offset: 0, label: 'Lun' }, { offset: 1, label: 'Mar' }, { offset: 2, label: 'Mié' },
                { offset: 3, label: 'Jue' }, { offset: 4, label: 'Vie' }, { offset: 5, label: 'Sáb' }, { offset: 6, label: 'Dom' },
              ];
              return weekDays.map(({ offset, label }) => {
                const weekDay = addDays(monday, offset);
                const isTodayDay = isSameDay(weekDay, today);
                const dateKey = format(weekDay, 'yyyy-MM-dd');
                const count = (appointmentsByDate[dateKey] || []).length;
                return (
                  <button key={offset} onClick={() => { setSelectedDate(weekDay); setCurrentMonth(weekDay); setExpandedAppointment(null); }}
                    className={`flex flex-col items-center justify-center py-1 rounded-lg transition-colors ${isTodayDay ? 'bg-[#4A7C59]' : 'hover:bg-[#F5F3EE]'}`}>
                    <span className={`text-[10px] uppercase tracking-wider ${isTodayDay ? 'text-white' : 'text-[#9E9E9E]'}`}>{label}</span>
                    <span className={`text-sm font-medium ${isTodayDay ? 'text-white' : 'text-[#1C1C1C]'}`}>{format(weekDay, 'd')}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${count === 0 ? (isTodayDay ? 'text-white/70' : 'text-[#9E9E9E]') : isTodayDay ? 'bg-white text-[#4A7C59]' : 'bg-[#F5F3EE] text-[#4A4A4A]'}`}>
                      {count === 0 ? '—' : count}
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(day => (
            <div key={day} className="text-center text-[11px] font-medium uppercase tracking-wider text-[#9E9E9E] py-1">{day}</div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {calendarDays.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="h-[44px]" />;
            const dateKey = format(day, 'yyyy-MM-dd');
            const count = (appointmentsByDate[dateKey] || []).length;
            const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const dayOfWeek = getDay(day);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const today = startOfDay(new Date());
            const isPast = day < today;
            return (
              <button key={dateKey} onClick={() => { if (!isWeekend) { setSelectedDate(day); setExpandedAppointment(null); } }} disabled={isWeekend}
                className={`max-h-[44px] aspect-square rounded-[8px] border transition-all flex flex-col items-center justify-center relative
                  ${isWeekend ? 'bg-[#FAF7F3] cursor-not-allowed' : ''}
                  ${isPast && !isWeekend ? 'opacity-50 hover:opacity-80' : ''}
                  ${isSelected && isTodayDate && !isWeekend ? 'bg-[#4A7C59] border-2 border-gray-800' : ''}
                  ${isSelected && !isTodayDate && !isWeekend ? 'bg-[#4A7C59]' : ''}
                  ${isTodayDate && !isSelected && !isWeekend ? 'bg-white border-2 border-[#4A7C59]' : ''}
                  ${!isSelected && !isTodayDate && !isWeekend ? 'border-transparent hover:bg-[#F5F3EE]' : ''}`}>
                <span className={`text-sm font-medium ${isWeekend ? 'text-[#C5C5C5]' : isSelected ? 'text-white' : isTodayDate ? 'text-[#4A7C59]' : 'text-[#1C1C1C]'}`}>
                  {format(day, 'd')}
                </span>
                {count > 0 && !isWeekend && (
                  <span className={`absolute bottom-0.5 h-[3px] rounded-[2px] ${isSelected ? 'bg-white w-5' : isTodayDate ? 'bg-[#4A7C59] w-5' : isPast ? 'bg-[#9E9E9E] w-3' : count <= 2 ? 'bg-[#A8D5B5] w-3' : count <= 4 ? 'bg-[#F5C842] w-4' : 'bg-[#C97B5A] w-5'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-3 pt-3 border-t flex justify-center gap-6 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-[3px] rounded-[2px] bg-[#A8D5B5]"></span> 1-2</span>
          <span className="flex items-center gap-1"><span className="w-3 h-[3px] rounded-[2px] bg-[#F5C842]"></span> 3-4</span>
          <span className="flex items-center gap-1"><span className="w-3 h-[3px] rounded-[2px] bg-[#C97B5A]"></span> 5+</span>
        </div>
      </div>

      {/* Columna derecha (60%) */}
      <div className="w-3/5 bg-white rounded-xl shadow-sm border p-5 flex flex-col">
        {(() => {
          const isSelectedPast = selectedDate ? startOfDay(selectedDate) < startOfDay(new Date()) : false;
          return (
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E4DC]">
              <div>
                <h3 className="text-[16px] font-semibold text-[#1C1C1C]">
                  {selectedDate ? `${format(selectedDate, 'EEEE d', { locale: es }).charAt(0).toUpperCase() + format(selectedDate, 'EEEE d', { locale: es }).slice(1)} de ${format(selectedDate, 'MMMM', { locale: es }).charAt(0).toUpperCase() + format(selectedDate, 'MMMM', { locale: es }).slice(1)}` : ''}
                </h3>
                {isSelectedPast && selectedDate && <span className="text-xs text-[#9E9E9E]">📋 Solo lectura — día pasado</span>}
              </div>
              {selectedDate && selectedDateAppointments.length > 0 && !isSelectedPast && (
                <button onClick={() => setNewAppointmentModal(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#4A7C59] hover:bg-[#EEF4F0] rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Nueva cita
                </button>
              )}
            </div>
          );
        })()}

        {!selectedDate ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-[#C5BFB5] text-5xl mb-4">📅</div>
            <p className="text-[#9E9E9E]">Selecciona un día para ver las citas</p>
          </div>
        ) : selectedDateAppointments.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-[16px] font-semibold text-[#1C1C1C] mb-4">
              {`${format(selectedDate, 'EEEE d', { locale: es }).charAt(0).toUpperCase() + format(selectedDate, 'EEEE d', { locale: es }).slice(1)} de ${format(selectedDate, 'MMMM', { locale: es }).charAt(0).toUpperCase() + format(selectedDate, 'MMMM', { locale: es }).slice(1)}`}
            </p>
            <div className="w-16 h-16 rounded-full bg-[#F5F3EE] flex items-center justify-center text-3xl mb-4">🐾</div>
            <p className="text-[#4A4A4A] font-medium mb-4">Sin citas para este día</p>
            {startOfDay(selectedDate) >= startOfDay(new Date()) && (
              <button onClick={() => setNewAppointmentModal(true)} className="px-5 py-2.5 bg-[#4A7C59] hover:bg-[#3D6A4B] text-white text-sm font-medium rounded-[8px] transition-colors">
                + Agendar cita
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1">
            {(() => {
              const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
              const isSelectedPast = selectedDate ? startOfDay(selectedDate) < startOfDay(new Date()) : false;
              const dayAppointments = (appointmentsByDate[dateKey] || []).sort((a, b) => a.time.localeCompare(b.time));

              // Calcular slots bloqueados y disponibles
              const availableSlots = TIME_SLOTS.filter(slot => {
                const [slotH, slotM] = slot.split(':').map(Number);
                const slotStart = slotH * 60 + slotM;
                const hasApt = dayAppointments.some(a => a.time === slot);
                if (hasApt) return false;
                const isBlocked = dayAppointments.some(a => {
                  if (a.status === 'cancelada') return false;
                  const [aH, aM] = a.time.split(':').map(Number);
                  const aStart = aH * 60 + aM;
                  const aDuration = (a.base_time_minutes || 60) + (a.recovery_time || 0);
                  return slotStart > aStart && slotStart < aStart + aDuration;
                });
                return !isBlocked;
              });

              return (
                <>
                  {/* SECCIÓN 1: Todas las citas del día */}
                  <div className="space-y-2 mb-4">
                    {dayAppointments.map((apt) => {
                      const isExpanded = expandedAppointment === apt.id;
                      const statusColor = apt.status === 'pendiente' ? '#F59E0B' : apt.status === 'confirmada' ? '#4A7C59' : apt.status === 'en_proceso' ? '#7C3AED' : apt.status === 'completada' ? '#9CA3AF' : '#EF4444';
                      return (
                        <div key={apt.id} className="flex gap-2 items-start">
                          <span className="text-sm font-bold text-[#1C1C1C] w-14 pt-3 shrink-0">{apt.time}</span>
                          <div
                            className={`flex-1 rounded-lg border transition-all cursor-pointer relative overflow-hidden ${isExpanded ? 'border-[#4A7C59] bg-[#EEF4F0]/30' : 'border-[#E8E4DC] hover:border-[#4A7C59]'}`}
                            onClick={() => setExpandedAppointment(isExpanded ? null : apt.id)}
                          >
                            <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ backgroundColor: statusColor }} />
                            <div className="flex items-center gap-3 p-3 pl-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[#1C1C1C] truncate">🐕 {apt.pet_name || apt.petName || 'Sin nombre'}</p>
                                <p className="text-sm text-[#6B6B6B] truncate">👤 {apt.owner_name || apt.ownerName || 'Sin cliente'} · ✂️ {apt.service_name || 'Grooming'} · {(apt.base_time_minutes || 60) + (apt.recovery_time || 0)} min</p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${apt.status === 'pendiente' ? 'bg-[#FEF3C7] text-[#B45309]' : apt.status === 'confirmada' ? 'bg-[#EEF4F0] text-[#4A7C59]' : apt.status === 'en_proceso' ? 'bg-[#F5F3FF] text-[#7C3AED]' : apt.status === 'completada' ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-red-100 text-red-700'}`}>
                                {getStatusLabel(apt.status)}
                              </span>
                              <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            {isExpanded && (
                              <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Teléfono</p>
                                    <p className="font-medium text-gray-900">{apt.whatsapp || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Raza</p>
                                    <p className="font-medium text-gray-900">{apt.pet_breed_emoji || ''} {apt.pet_breed || apt.petBreedAge || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 uppercase">Cambiar estado</p>
                                    <select
                                      value={apt.status}
                                      onChange={(e) => { e.stopPropagation(); updateStatus(apt.id, e.target.value as AppointmentStatus); }}
                                      onClick={(e) => e.stopPropagation()}
                                      className={`w-full px-2 py-1 rounded text-sm font-medium border cursor-pointer mt-1 ${getStatusColor(apt.status)}`}
                                    >
                                      <option value="pendiente">Pendiente</option>
                                      <option value="confirmada">Confirmada</option>
                                      <option value="en_proceso">✂️ En Proceso</option>
                                      <option value="completada">Completada</option>
                                      <option value="cancelada">Cancelada</option>
                                    </select>
                                  </div>
                                </div>
                                {apt.comments && (
                                  <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
                                    <p className="text-xs text-yellow-700 uppercase">Notas</p>
                                    <p className="text-sm text-gray-700">{apt.comments}</p>
                                  </div>
                                )}
                                <div className="flex gap-2 mt-3">
                                  <button onClick={(e) => { e.stopPropagation(); sendReminder(apt); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors">
                                    📱 WhatsApp
                                  </button>
                                  {apt.status === 'pendiente' && (
                                    <button onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'confirmada'); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-[#4A7C59] hover:bg-[#3D6A4B] text-white text-sm rounded-lg transition-colors">
                                      ✓ Confirmar
                                    </button>
                                  )}
                                  {apt.status === 'confirmada' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleStartGrooming(apt.id); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm rounded-lg transition-colors">
                                      ✂️ Iniciar Grooming
                                    </button>
                                  )}
                                  {apt.status === 'en_proceso' && (
                                    <button onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'completada'); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-[#4A7C59] hover:bg-[#3D6A4B] text-white text-sm rounded-lg transition-colors">
                                      ✅ Completar
                                    </button>
                                  )}
                                  {(apt.status === 'pendiente' || apt.status === 'confirmada' || apt.status === 'en_proceso') && (
                                    <button onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'cancelada'); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors">
                                      ✕ Cancelar
                                    </button>
                                  )}
                                  {apt.status === 'cancelada' && (
                                    <button onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'pendiente'); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-lg transition-colors">
                                      ↺ Reactivar
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* SECCIÓN 2: Horarios disponibles */}
                  {availableSlots.length > 0 && !isSelectedPast && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-px bg-[#E8E4DC]"></div>
                        <span className="text-xs text-[#9E9E9E] font-medium px-2">Horarios disponibles ({availableSlots.length})</span>
                        <div className="flex-1 h-px bg-[#E8E4DC]"></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map(slot => (
                          <div
                            key={slot}
                            className="rounded-lg border border-dashed border-[#A8D5B5] bg-[#F0FAF4] px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#E1F5E8] transition-colors"
                            onClick={() => setNewAppointmentModal(true)}
                          >
                            <span className="text-sm font-bold text-[#4A7C59]">{slot}</span>
                            <span className="text-xs text-[#4A7C59]">+ Agendar</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );

  // ── Render vista de reportes ────────────────────────────────────────────
  const renderReportsView = () => {
    const filteredAppointments = appointments.filter(apt => {
      if (apt.date < reportDateFrom || apt.date > reportDateTo) return false;
      if (reportServiceFilter === 'bano' && apt.additional_service) return false;
      if (reportServiceFilter === 'adicional' && !apt.additional_service) return false;
      if (reportStatusFilter !== 'all' && apt.status !== reportStatusFilter) return false;
      return true;
    });

    const now = new Date();
    const currentMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const currentMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const prevMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

    const thisMonthAppointments = appointments.filter(a => a.date >= currentMonthStart && a.date <= currentMonthEnd);
    const prevMonthAppointments = appointments.filter(a => a.date >= prevMonthStart && a.date <= prevMonthEnd);

    const thisMonthTotal = thisMonthAppointments.length;
    const prevMonthTotal = prevMonthAppointments.length;
    const growthPercent = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : 0;

    const prevMonthClients = new Set(prevMonthAppointments.map(a => a.whatsapp));
    const newClientsThisMonth = thisMonthAppointments.filter(a => !prevMonthClients.has(a.whatsapp)).length;
    const recurringClientsThisMonth = thisMonthAppointments.filter(a => prevMonthClients.has(a.whatsapp)).length;

    const serviceCounts = { bano: 0, adicional: 0 };
    thisMonthAppointments.forEach(a => { if (a.additional_service) serviceCounts.adicional++; else serviceCounts.bano++; });
    const topService = serviceCounts.bano >= serviceCounts.adicional ? 'Bano y corte' : 'Servicio adicional';

    const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    thisMonthAppointments.forEach(a => { const day = new Date(a.date).getDay(); dayCounts[day]++; });
    const maxDay = Object.entries(dayCounts).reduce((a, b) => a[1] > b[1] ? a : b);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

    const cancelRate = thisMonthTotal > 0 ? Math.round((thisMonthAppointments.filter(a => a.status === 'cancelada').length / thisMonthTotal) * 100) : 0;
    const estimatedIncome = thisMonthAppointments.filter(a => a.status === 'completada').reduce((sum, a) => sum + (a.additional_service ? 150 : 100), 0);

    const start = parseISO(reportDateFrom);
    const end = parseISO(reportDateTo);
    const daysInterval = eachDayOfInterval({ start, end });
    const dailyData = daysInterval.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayApts = filteredAppointments.filter(a => a.date === dateKey && a.status === 'completada');
      return { date: format(day, 'dd'), fullDate: dateKey, count: dayApts.length, isGood: dayApts.length >= dailyGoal };
    });

    const avgPerDay = (dailyData.length > 0 ? dailyData.reduce((s, d) => s + d.count, 0) / dailyData.length : 0).toFixed(1);

    const yearStart = startOfYear(now);
    const monthsInterval = eachMonthOfInterval({ start: yearStart, end: now });
    const monthlyData2026 = monthsInterval.map(month => {
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
      const count = appointments.filter(a => a.date >= monthStart && a.date <= monthEnd && a.status === 'completada').length;
      return { month: format(month, 'MMM', { locale: es }), count };
    });

    const clientVisits: Record<string, { name: string; phone: string; visits: number }> = {};
    appointments.forEach(apt => {
      const phone = apt.whatsapp;
      if (!phone) return;
      if (!clientVisits[phone]) clientVisits[phone] = { name: apt.owner_name || apt.ownerName || '', phone, visits: 0 };
      if (apt.status === 'completada') clientVisits[phone].visits++;
    });
    const topClients = Object.values(clientVisits).sort((a, b) => b.visits - a.visits).slice(0, 10);

    const thirtyDaysAgo = format(addMonths(now, -1), 'yyyy-MM-dd');
    const activePhones = new Set(appointments.filter(a => a.date > thirtyDaysAgo && a.status === 'completada').map(a => a.whatsapp || ''));
    const allClientPhones = new Set(appointments.map(a => a.whatsapp || ''));
    const inactiveClients = Array.from(allClientPhones).filter(phone => !activePhones.has(phone)).map(phone => {
      const lastApt = appointments.filter(a => a.whatsapp === phone && a.status === 'completada').sort((a, b) => b.date.localeCompare(a.date))[0];
      return { phone, name: lastApt?.owner_name || lastApt?.ownerName || 'Unknown', lastVisit: lastApt ? format(new Date(lastApt.date), 'dd MMM yyyy', { locale: es }) : 'N/A' };
    });

    const handleExportExcel = () => {
      const filename = `reporte-citas-${format(parseISO(reportDateFrom), 'MMM').toLowerCase()}${format(parseISO(reportDateFrom), 'yyyy')}.csv`;
      const data = filteredAppointments.map(a => ({ Fecha: a.date, Hora: a.time, Cliente: a.owner_name || a.ownerName, Telefono: a.whatsapp, Mascota: a.pet_name, Raza: a.pet_breed_age, Servicio: a.additional_service ? 'Servicio adicional' : 'Bano y corte', Estado: a.status }));
      exportToExcel(data, filename, ['Fecha', 'Hora', 'Cliente', 'Telefono', 'Mascota', 'Raza', 'Servicio', 'Estado']);
    };

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Desde:</label>
              <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="p-1.5 border rounded text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Hasta:</label>
              <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="p-1.5 border rounded text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Servicio:</label>
              <select value={reportServiceFilter} onChange={(e) => setReportServiceFilter(e.target.value as any)} className="p-1.5 border rounded text-sm">
                <option value="all">Todos</option>
                <option value="bano">Bano y corte</option>
                <option value="adicional">Servicio adicional</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Estado:</label>
              <select value={reportStatusFilter} onChange={(e) => setReportStatusFilter(e.target.value as any)} className="p-1.5 border rounded text-sm">
                <option value="all">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="en_proceso">✂️ En Proceso</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Meta:</label>
              <input type="number" value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} className="w-12 p-1 border rounded text-sm text-center" min="1" />
              <span className="text-xs text-gray-400">/dia</span>
            </div>
            <div className="flex items-center gap-1">
              <input type="number" value={monthlyGoal} onChange={(e) => setMonthlyGoal(Number(e.target.value))} className="w-14 p-1 border rounded text-sm text-center" min="1" />
              <span className="text-xs text-gray-400">/mes</span>
            </div>
            <button onClick={handleExportExcel} className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">Excel</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Citas este mes</p>
              <p className="text-xl font-bold text-gray-900">{thisMonthTotal}</p>
              <p className={`text-xs ${growthPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{growthPercent >= 0 ? '↑' : '↓'} {Math.abs(growthPercent)}%</p>
            </div>
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Clientes nuevos</p>
              <p className="text-xl font-bold text-[#4A7C59]">{newClientsThisMonth}</p>
            </div>
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Recurrentes</p>
              <p className="text-xl font-bold text-green-600">{recurringClientsThisMonth}</p>
            </div>
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Top servicio</p>
              <p className="text-sm font-bold text-purple-600">{topService}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Dia mas citas</p>
              <p className="text-lg font-bold text-orange-600">{days[Number(maxDay[0])]}</p>
            </div>
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Cancelacion</p>
              <p className="text-xl font-bold text-red-600">{cancelRate}%</p>
            </div>
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Ingreso estimado</p>
              <p className="text-lg font-bold text-green-600">Q{estimatedIncome.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Productividad</h3>
            <div className="flex items-end gap-px h-24 mb-2">
              {dailyData.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className={`w-full rounded-t ${day.isGood ? 'bg-green-500' : day.count > 0 ? 'bg-yellow-500' : 'bg-gray-200'}`} style={{ height: `${Math.min((day.count / Math.max(dailyGoal, 1)) * 100, 100)}%` }} />
                  <span className="text-[8px] text-gray-400 mt-0.5">{day.date}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs bg-[#FAFAF8] rounded-lg p-2">
              <div className="text-center"><p className="text-gray-400">Promedio</p><p className="font-bold">{avgPerDay}</p></div>
              <div className="text-center"><p className="text-gray-400">Meta dia</p><p className="font-bold">{dailyGoal}</p></div>
              <div className="text-center"><p className="text-gray-400">Progreso mes</p><p className="font-bold">{filteredAppointments.filter(a => a.status === 'completada').length}/{monthlyGoal}</p></div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Clientes</h3>
            <table className="w-full text-xs mb-3">
              <thead><tr className="border-b"><th className="text-left py-1 text-gray-500">#</th><th className="text-left py-1 text-gray-500">Cliente</th><th className="text-right py-1 text-gray-500">Visitas</th></tr></thead>
              <tbody>
                {topClients.slice(0, 6).map((c, i) => (
                  <tr key={c.phone} className="border-b">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1 font-medium truncate max-w-[120px]">{c.name}</td>
                    <td className="py-1 text-right font-bold">{c.visits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inactiveClients.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 mb-1">Por reactivar ({inactiveClients.length})</p>
                <div className="flex flex-wrap gap-1">
                  {inactiveClients.slice(0, 5).map(c => (<span key={c.phone} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">{c.name.split(' ')[0]}</span>))}
                  {inactiveClients.length > 5 && <span className="text-xs text-gray-400">+{inactiveClients.length - 5}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Citas por mes (2026)</h3>
          <div className="flex items-end gap-1 h-20">
            {monthlyData2026.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-[#4A7C59] rounded-t" style={{ height: `${Math.min((m.count / 50) * 100, 100)}%` }} />
                <span className="text-[8px] text-gray-400 mt-0.5">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {(() => {
          const groomingLogs = appointments.filter(a => a.grooming_started_at && a.date >= reportDateFrom && a.date <= reportDateTo).sort((a, b) => (b.grooming_started_at || '').localeCompare(a.grooming_started_at || ''));
          if (groomingLogs.length === 0) return null;
          return (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">✂️ Registro de Inicio de Grooming</h3>
                <span className="text-xs text-gray-400">{groomingLogs.length} registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-[#FAFAF8]">
                      <th className="text-left py-2 px-3 text-gray-500">Fecha</th>
                      <th className="text-left py-2 px-3 text-gray-500">Cita</th>
                      <th className="text-left py-2 px-3 text-gray-500">Mascota</th>
                      <th className="text-left py-2 px-3 text-gray-500">Cliente</th>
                      <th className="text-left py-2 px-3 text-gray-500">Inicio grooming</th>
                      <th className="text-left py-2 px-3 text-gray-500">Espera</th>
                      <th className="text-left py-2 px-3 text-gray-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groomingLogs.map(a => {
                      const startedAt = new Date(a.grooming_started_at!);
                      const [aptH, aptM] = a.time.split(':').map(Number);
                      const waitMins = startedAt.getHours() * 60 + startedAt.getMinutes() - (aptH * 60 + aptM);
                      return (
                        <tr key={a.id} className="hover:bg-[#FAFAF8]">
                          <td className="py-2 px-3 text-gray-600">{format(new Date(a.date), 'dd MMM', { locale: es })}</td>
                          <td className="py-2 px-3 font-medium text-gray-800">{a.time}</td>
                          <td className="py-2 px-3">{a.pet_name || a.petName || '—'}</td>
                          <td className="py-2 px-3 text-gray-600">{a.owner_name || a.ownerName || '—'}</td>
                          <td className="py-2 px-3 font-semibold" style={{ color: '#7C3AED' }}>{startedAt.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${waitMins <= 5 ? 'bg-green-100 text-green-700' : waitMins <= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {waitMins <= 0 ? 'A tiempo' : `+${waitMins} min`}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${a.status === 'completada' ? 'bg-green-100 text-green-700' : 'bg-[#F5F3FF] text-[#7C3AED]'}`}>
                              {a.status === 'completada' ? '✓ Completada' : '✂️ En Proceso'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── Render vista de clientes ────────────────────────────────────────────
  const renderClientsView = () => {
    const selectedClientData = selectedClient ? clients.find(c => c.phone === selectedClient) : null;
    return (
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        <div className="w-[35%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Buscar cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredClients.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No hay clientes registrados</div>
            ) : filteredClients.map((client) => (
              <button key={client.phone} onClick={() => setSelectedClient(client.phone)}
                className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${selectedClient === client.phone ? 'bg-[#E8943D]/10 border border-[#E8943D]' : 'border border-transparent hover:bg-[#FAFAF8]'}`}>
                <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#4A7C59] font-bold">{client.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{client.name}</p>
                  <p className="text-sm text-gray-500 truncate">{client.phone}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{client.pets.size}</p>
                  <p className="text-xs text-gray-500">masc.</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-[65%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          {!selectedClientData ? (
            <div className="flex-1 flex items-center justify-center text-gray-500"><p>Selecciona un cliente para ver su ficha</p></div>
          ) : (
            <>
              <div className="pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedClientData.name}</h3>
                    <p className="text-gray-500">{selectedClientData.phone}</p>
                  </div>
                  <button onClick={() => deleteClientAppointments(selectedClientData.phone, selectedClientData.name)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                    🗑️ Eliminar registro
                  </button>
                </div>
              </div>
              <div className="py-4 border-b">
                <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Mascotas ({selectedClientData.pets.size})</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedClientData.pets).map((pet, idx) => {
                    const [name, breed] = pet.split('|');
                    return <span key={idx} className="px-3 py-1.5 bg-gray-100 border rounded-lg text-sm">{name} - {breed}</span>;
                  })}
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Historial de citas</h4>
                  <span className="text-sm text-gray-500">Total: <strong>{selectedClientData.totalVisits}</strong> visitas</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#FAFAF8] sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Hora</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Mascota</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Servicio</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...selectedClientData.appointments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((apt) => (
                        <tr key={apt.id} className="hover:bg-[#FAFAF8]">
                          <td className="py-2 px-3">{format(new Date(apt.date), 'dd MMM yyyy')}</td>
                          <td className="py-2 px-3">{apt.time}</td>
                          <td className="py-2 px-3">{apt.pet_name || apt.petName || '-'}</td>
                          <td className="py-2 px-3">{apt.additional_service ? 'Recuperacion' : 'Bano y corte'}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>{getStatusLabel(apt.status)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="pt-4 border-t mt-4">
                <button onClick={() => setCustomMessageModal({ phone: selectedClientData.phone, name: selectedClientData.name })} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  Enviar mensaje personalizado
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Render vista de mascotas ────────────────────────────────────────────
  const renderPetsView = () => {
    const selectedPetData = selectedPet ? pets.find(p => p.id === selectedPet) : null;
    return (
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        <div className="w-[35%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Buscar mascota..." value={petSearchQuery} onChange={(e) => setPetSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredPets.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No hay mascotas registradas</div>
            ) : filteredPets.map((pet) => (
              <button key={pet.id} onClick={() => setSelectedPet(pet.id)}
                className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${selectedPet === pet.id ? 'bg-[#E8943D]/10 border border-[#E8943D]' : 'border border-transparent hover:bg-[#FAFAF8]'}`}>
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-xl">{pet.breedEmoji || '🐕'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{pet.name}</p>
                  <p className="text-sm text-gray-500 truncate">{pet.breed || 'Sin raza'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">{pet.ownerName.split(' ')[0]}</p>
                  <p className="text-xs text-gray-500">dueno</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-[65%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          {!selectedPetData ? (
            <div className="flex-1 flex items-center justify-center text-gray-500"><p>Selecciona una mascota para ver su ficha</p></div>
          ) : (
            <>
              <div className="pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-3xl">{selectedPetData.breedEmoji || '🐕'}</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedPetData.name}</h3>
                      <p className="text-gray-500">{selectedPetData.breed || 'Sin raza'}</p>
                      {selectedPetData.size && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {selectedPetData.size === 'pequeno' ? 'Pequeno' : selectedPetData.size === 'mediano' ? 'Mediano' : selectedPetData.size === 'grande' ? 'Grande' : selectedPetData.size}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="py-4 border-b">
                <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Dueno</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{selectedPetData.ownerName}</p>
                    <p className="text-gray-500">{selectedPetData.ownerPhone}</p>
                  </div>
                  <button onClick={() => deletePetAppointments(selectedPetData.id, selectedPetData.name, selectedPetData.ownerPhone)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
                    🗑️ Eliminar registro
                  </button>
                </div>
              </div>
              {selectedPetData.comments && (
                <div className="py-4 border-b">
                  <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Notas</h4>
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">{selectedPetData.comments}</div>
                </div>
              )}
              <div className="flex-1 overflow-hidden flex flex-col pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Historial de servicios</h4>
                  <span className="text-sm text-gray-500">Total: <strong>{selectedPetData.appointments.filter(a => a.status === 'completada').length}</strong> visitas</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#FAFAF8] sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Fecha</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Hora</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Servicio</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...selectedPetData.appointments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((apt) => (
                        <tr key={apt.id} className="hover:bg-[#FAFAF8]">
                          <td className="py-2 px-3">{format(new Date(apt.date), 'dd MMM yyyy')}</td>
                          <td className="py-2 px-3">{apt.time}</td>
                          <td className="py-2 px-3">{apt.additional_service ? 'Recuperacion de manto' : 'Bano y corte'}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>{getStatusLabel(apt.status)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Render vista de fichas de grooming ─────────────────────────────────
  const renderFichasView = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayCompleted = appointments.filter(a => a.date === todayStr && (a.status === 'completada' || a.status === 'en_proceso'));

    const emptyForm = (apt: Appointment): GroomingReport => ({
      appointment_id: apt.id,
      date: todayStr,
      pet_name: apt.pet_name || apt.petName || '',
      pet_breed: apt.pet_breed || apt.petBreedAge || '',
      pet_age: '',
      pet_sex: '',
      pet_weight: '',
      pet_color: '',
      pet_vaccines: false,
      owner_name: apt.owner_name || apt.ownerName || '',
      owner_phone: apt.whatsapp || '',
      owner_email: '',
      service_grooming_detallado: false,
      service_grooming_bano: false,
      service_recuperacion_manto: apt.additional_service || false,
      service_deslanado_extra: false,
      prob_nudos: false,
      prob_pulgas: false,
      prob_irritacion: false,
      prob_heridas: false,
      prob_mal_olor: false,
      prob_nervioso: false,
      prob_exceso_muda: false,
      prob_comportamiento: false,
      prob_oidos: false,
      prob_unas: false,
      prob_obesidad: false,
      prob_desnutricion: false,
      observations: '',
    });

    const handleSelectApt = async (apt: Appointment) => {
      setSelectedReportApt(apt);
      setReportSaved(false);
      // Check if report already exists for this appointment
      const { data } = await supabase.from('grooming_reports').select('*').eq('appointment_id', apt.id).single();
      if (data) {
        setReportForm(data as GroomingReport);
      } else {
        setReportForm(emptyForm(apt));
      }
    };

    const handleSaveReport = async () => {
      if (!reportForm) return;
      setReportSaving(true);
      try {
        const { data: existing } = await supabase.from('grooming_reports').select('id').eq('appointment_id', reportForm.appointment_id).single();
        if (existing) {
          await supabase.from('grooming_reports').update(reportForm).eq('appointment_id', reportForm.appointment_id);
        } else {
          await supabase.from('grooming_reports').insert(reportForm);
        }
        setReportSaved(true);
        setTimeout(() => setReportSaved(false), 3000);
      } catch (err) {
        console.error('Error guardando ficha:', err);
      } finally {
        setReportSaving(false);
      }
    };

    const loadHistory = async () => {
      const { data } = await supabase.from('grooming_reports').select('*').order('created_at', { ascending: false }).limit(50);
      setReportHistory(data || []);
      setFichasTab('historial');
    };

    const Checkbox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) => (
      <label className="flex items-center gap-2 cursor-pointer hover:bg-[#F5F3EE] px-2 py-1.5 rounded-lg transition-colors">
        <div onClick={onChange} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-[#4A7C59] border-[#4A7C59]' : 'border-gray-300 bg-white'}`}>
          {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
        <span className="text-sm text-gray-700">{label}</span>
      </label>
    );

    return (
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Columna izquierda — citas del día */}
        <div className="w-[30%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Citas de hoy</h3>
              <p className="text-xs text-gray-500">{format(new Date(), 'EEEE d MMMM', { locale: es }).charAt(0).toUpperCase() + format(new Date(), 'EEEE d MMMM', { locale: es }).slice(1)}</p>
            </div>
            <button onClick={loadHistory} className="text-xs text-[#4A7C59] hover:underline">Ver historial</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setFichasTab('nueva')} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${fichasTab === 'nueva' ? 'bg-[#4A7C59] text-white' : 'bg-[#F5F3EE] text-gray-600'}`}>
              Nueva ficha
            </button>
            <button onClick={loadHistory} className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${fichasTab === 'historial' ? 'bg-[#4A7C59] text-white' : 'bg-[#F5F3EE] text-gray-600'}`}>
              Historial
            </button>
          </div>

          {fichasTab === 'nueva' ? (
            <div className="flex-1 overflow-y-auto space-y-2">
              {todayCompleted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-4xl mb-3">🐾</div>
                  <p className="text-sm text-gray-500">No hay citas completadas hoy aún</p>
                  <p className="text-xs text-gray-400 mt-1">Las citas en proceso o completadas aparecerán aquí</p>
                </div>
              ) : todayCompleted.map(apt => (
                <button key={apt.id} onClick={() => handleSelectApt(apt)}
                  className={`w-full p-3 rounded-lg text-left transition-all border ${selectedReportApt?.id === apt.id ? 'bg-[#EEF4F0] border-[#4A7C59]' : 'border-transparent hover:bg-[#FAFAF8]'}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm shrink-0">🐕</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{apt.pet_name || apt.petName}</p>
                      <p className="text-xs text-gray-500 truncate">{apt.owner_name || apt.ownerName} · {apt.time}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${apt.status === 'completada' ? 'bg-green-100 text-green-700' : 'bg-[#F5F3FF] text-[#7C3AED]'}`}>
                      {apt.status === 'completada' ? '✓' : '✂️'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {reportHistory.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">No hay fichas guardadas</div>
              ) : reportHistory.map(r => (
                <button key={r.id} onClick={() => { setReportForm(r); setSelectedReportApt(null); setFichasTab('nueva'); }}
                  className="w-full p-3 rounded-lg text-left border border-transparent hover:bg-[#FAFAF8] transition-all">
                  <p className="font-medium text-sm text-gray-900">{r.pet_name}</p>
                  <p className="text-xs text-gray-500">{r.owner_name} · {r.date ? format(new Date(r.date), 'dd MMM yyyy') : ''}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha — formulario de ficha */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border p-5 flex flex-col overflow-hidden">
          {!reportForm ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-gray-500 font-medium">Selecciona una cita para llenar su ficha</p>
              <p className="text-sm text-gray-400 mt-1">Las citas en proceso o completadas aparecen en el panel izquierdo</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Ficha de Grooming</h2>
                  <p className="text-sm text-gray-500">{reportForm.pet_name} · {reportForm.owner_name}</p>
                </div>
                <button onClick={handleSaveReport} disabled={reportSaving}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${reportSaved ? 'bg-green-500 text-white' : 'bg-[#4A7C59] hover:bg-[#3D6A4B] text-white'} disabled:opacity-50`}>
                  {reportSaving ? 'Guardando...' : reportSaved ? '✓ Guardado' : 'Guardar ficha'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {/* Sección: Datos del perro */}
                <div>
                  <h3 className="text-sm font-semibold text-[#4A7C59] mb-3 flex items-center gap-2">🐶 Datos del perro</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                      <input value={reportForm.pet_name} onChange={e => setReportForm({...reportForm, pet_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Raza</label>
                      <input value={reportForm.pet_breed} onChange={e => setReportForm({...reportForm, pet_breed: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Edad</label>
                      <input value={reportForm.pet_age} onChange={e => setReportForm({...reportForm, pet_age: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" placeholder="ej. 2 años" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Sexo</label>
                      <select value={reportForm.pet_sex} onChange={e => setReportForm({...reportForm, pet_sex: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]">
                        <option value="">Seleccionar</option>
                        <option value="Macho">Macho</option>
                        <option value="Hembra">Hembra</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Peso</label>
                      <input value={reportForm.pet_weight} onChange={e => setReportForm({...reportForm, pet_weight: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" placeholder="ej. 5 kg" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Color</label>
                      <input value={reportForm.pet_color} onChange={e => setReportForm({...reportForm, pet_color: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" placeholder="ej. Blanco" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Checkbox label="Vacunas al día" checked={reportForm.pet_vaccines} onChange={() => setReportForm({...reportForm, pet_vaccines: !reportForm.pet_vaccines})} />
                  </div>
                </div>

                {/* Sección: Datos del dueño */}
                <div>
                  <h3 className="text-sm font-semibold text-[#4A7C59] mb-3 flex items-center gap-2">👤 Datos del dueño</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                      <input value={reportForm.owner_name} onChange={e => setReportForm({...reportForm, owner_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                      <input value={reportForm.owner_phone} onChange={e => setReportForm({...reportForm, owner_phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Correo (opcional)</label>
                      <input value={reportForm.owner_email} onChange={e => setReportForm({...reportForm, owner_email: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59]" placeholder="opcional" />
                    </div>
                  </div>
                </div>

                {/* Sección: Servicio realizado */}
                <div>
                  <h3 className="text-sm font-semibold text-[#4A7C59] mb-3 flex items-center gap-2">✂️ Servicio realizado</h3>
                  <div className="grid grid-cols-2 gap-1">
                    <Checkbox label="Grooming detallado" checked={reportForm.service_grooming_detallado} onChange={() => setReportForm({...reportForm, service_grooming_detallado: !reportForm.service_grooming_detallado})} />
                    <Checkbox label="Grooming baño" checked={reportForm.service_grooming_bano} onChange={() => setReportForm({...reportForm, service_grooming_bano: !reportForm.service_grooming_bano})} />
                    <Checkbox label="Recuperación de manto" checked={reportForm.service_recuperacion_manto} onChange={() => setReportForm({...reportForm, service_recuperacion_manto: !reportForm.service_recuperacion_manto})} />
                    <Checkbox label="Deslanado extra" checked={reportForm.service_deslanado_extra} onChange={() => setReportForm({...reportForm, service_deslanado_extra: !reportForm.service_deslanado_extra})} />
                  </div>
                </div>

                {/* Sección: Problemas encontrados */}
                <div>
                  <h3 className="text-sm font-semibold text-[#4A7C59] mb-3 flex items-center gap-2">🚿 Problemas encontrados</h3>
                  <div className="grid grid-cols-3 gap-1">
                    <Checkbox label="Nudos/enredos" checked={reportForm.prob_nudos} onChange={() => setReportForm({...reportForm, prob_nudos: !reportForm.prob_nudos})} />
                    <Checkbox label="Pulgas/garrapatas" checked={reportForm.prob_pulgas} onChange={() => setReportForm({...reportForm, prob_pulgas: !reportForm.prob_pulgas})} />
                    <Checkbox label="Irritación/alergias" checked={reportForm.prob_irritacion} onChange={() => setReportForm({...reportForm, prob_irritacion: !reportForm.prob_irritacion})} />
                    <Checkbox label="Heridas/cortes" checked={reportForm.prob_heridas} onChange={() => setReportForm({...reportForm, prob_heridas: !reportForm.prob_heridas})} />
                    <Checkbox label="Mal olor" checked={reportForm.prob_mal_olor} onChange={() => setReportForm({...reportForm, prob_mal_olor: !reportForm.prob_mal_olor})} />
                    <Checkbox label="Nervioso" checked={reportForm.prob_nervioso} onChange={() => setReportForm({...reportForm, prob_nervioso: !reportForm.prob_nervioso})} />
                    <Checkbox label="Exceso de muda" checked={reportForm.prob_exceso_muda} onChange={() => setReportForm({...reportForm, prob_exceso_muda: !reportForm.prob_exceso_muda})} />
                    <Checkbox label="Comportamiento difícil" checked={reportForm.prob_comportamiento} onChange={() => setReportForm({...reportForm, prob_comportamiento: !reportForm.prob_comportamiento})} />
                    <Checkbox label="Problemas en oídos" checked={reportForm.prob_oidos} onChange={() => setReportForm({...reportForm, prob_oidos: !reportForm.prob_oidos})} />
                    <Checkbox label="Problemas en uñas" checked={reportForm.prob_unas} onChange={() => setReportForm({...reportForm, prob_unas: !reportForm.prob_unas})} />
                    <Checkbox label="Obesidad" checked={reportForm.prob_obesidad} onChange={() => setReportForm({...reportForm, prob_obesidad: !reportForm.prob_obesidad})} />
                    <Checkbox label="Desnutrición" checked={reportForm.prob_desnutricion} onChange={() => setReportForm({...reportForm, prob_desnutricion: !reportForm.prob_desnutricion})} />
                  </div>
                </div>

                {/* Sección: Observaciones */}
                <div>
                  <h3 className="text-sm font-semibold text-[#4A7C59] mb-3 flex items-center gap-2">📝 Observaciones</h3>
                  <textarea
                    value={reportForm.observations}
                    onChange={e => setReportForm({...reportForm, observations: e.target.value})}
                    rows={3}
                    placeholder="Notas adicionales sobre el grooming, comportamiento del perro, recomendaciones al dueño..."
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A7C59] resize-none"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Render vista de configuracion ───────────────────────────────────────
  const renderConfigView = () => (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Horario de Atencion</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dias de atencion</label>
            <div className="flex flex-wrap gap-2">
              {[{ id: '1', label: 'Lun' }, { id: '2', label: 'Mar' }, { id: '3', label: 'Mie' }, { id: '4', label: 'Jue' }, { id: '5', label: 'Vie' }, { id: '6', label: 'Sab' }, { id: '0', label: 'Dom' }].map((day) => (
                <label key={day.id} className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-[#FAFAF8]">
                  <input type="checkbox" checked={config.workDays.includes(day.id)} onChange={(e) => { if (e.target.checked) { setConfig({ ...config, workDays: [...config.workDays, day.id] }); } else { setConfig({ ...config, workDays: config.workDays.filter(d => d !== day.id) }); } }} className="rounded text-[#E8943D]" />
                  <span className="text-sm">{day.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[{ label: 'Apertura', key: 'openTime' }, { label: 'Cierre', key: 'closeTime' }, { label: 'Ultima hora', key: 'lastAppointmentTime' }].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <select value={(config as any)[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]">
                  {Array.from({ length: 24 }, (_, i) => i).map(hour => (<option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>{hour.toString().padStart(2, '0')}:00</option>))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Horario de Almuerzo</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={config.lunchEnabled} onChange={(e) => setConfig({ ...config, lunchEnabled: e.target.checked })} className="rounded text-[#E8943D]" />
            <span className="text-sm text-gray-600">Activar bloqueo</span>
          </label>
        </div>
        {config.lunchEnabled && (
          <div className="grid grid-cols-2 gap-4">
            {[{ label: 'Inicio', key: 'lunchStart' }, { label: 'Fin', key: 'lunchEnd' }].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <select value={(config as any)[key]} onChange={(e) => setConfig({ ...config, [key]: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]">
                  {Array.from({ length: 24 }, (_, i) => i).map(hour => (<option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>{hour.toString().padStart(2, '0')}:00</option>))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Dias Feriados / No Laborales</h3>
        <div className="flex gap-4">
          <input type="date" id="holiday-input" className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]" />
          <button onClick={() => { const input = document.getElementById('holiday-input') as HTMLInputElement; if (input.value && !config.holidays.includes(input.value)) { setConfig({ ...config, holidays: [...config.holidays, input.value].sort() }); input.value = ''; } }} className="px-4 py-2 bg-[#E8943D] hover:bg-[#E8943D]/90 text-white rounded-lg transition-colors">Agregar</button>
        </div>
        {config.holidays.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {config.holidays.map((date) => (
              <span key={date} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                {format(new Date(date), 'dd MMM yyyy')}
                <button onClick={() => setConfig({ ...config, holidays: config.holidays.filter(h => h !== date) })} className="ml-1 hover:text-red-900">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacion del Negocio</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input type="text" defaultValue="Sam's Pets" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label><input type="text" defaultValue="+502 4903-7428" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label><input type="text" defaultValue="El Progreso Jutiapa" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label><input type="text" defaultValue="@samspets_shop" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]" /></div>
        </div>
      </div>

      <button onClick={saveConfig} disabled={configLoading} className="px-6 py-2 bg-[#4A7C59] hover:bg-[#3D6A4B] text-white rounded-lg transition-colors disabled:opacity-50">
        {configLoading ? 'Guardando...' : configSaved ? '✓ Guardado' : 'Guardar configuración'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Sidebar currentSection={currentView} onSectionChange={(section) => setCurrentView(section as View)} user={user} onLogout={handleLogout} />
      <div className="ml-60">
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">
              {currentView === 'inicio' && 'Inicio'}
              {currentView === 'agenda' && 'Agenda'}
              {currentView === 'mascotas' && 'Mascotas'}
              {currentView === 'clientes' && 'Clientes'}
              {currentView === 'fichas' && 'Fichas de Grooming'}
              {currentView === 'recordatorios' && 'Recordatorios'}
              {currentView === 'reportes' && 'Reportes'}
              {currentView === 'configuracion' && 'Configuración'}
            </h1>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">{user?.displayName}</p>
                <p className="text-xs text-gray-500">{user?.role === 'ADMINISTRADOR_GENERAL' ? 'Administrador' : 'Personal'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {currentView === 'inicio' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 bg-white rounded-[12px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#94A3B8]/20 flex items-center justify-center text-lg">📊</div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#64748B]">Total</p>
                      <p className="text-[32px] font-bold text-[#475569]">{todayStats.total}</p>
                      <p className="text-xs text-[#94A3B8]">citas programadas hoy</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-[12px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center text-lg">⏳</div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#D97706]">Pendientes</p>
                      <p className="text-[32px] font-bold text-[#B45309]">{todayStats.pendiente}</p>
                      <p className="text-xs text-[#D97706]/70">esperando confirmación</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-[12px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#4A7C59]/15 flex items-center justify-center text-lg">✓</div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#4A7C59]">Confirmadas</p>
                      <p className="text-[32px] font-bold text-[#4A7C59]">{todayStats.confirmada}</p>
                      <p className="text-xs text-[#4A7C59]/70">citas confirmadas</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-[12px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#C97B5A]/15 flex items-center justify-center text-lg">✅</div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#C97B5A]">Completadas</p>
                      <p className="text-[32px] font-bold text-[#C97B5A]">{todayStats.completada}</p>
                      <p className="text-xs text-[#C97B5A]/70">servicios realizados</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-6">
                <div className="col-span-3 bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Agenda de hoy</h3>
                  {todayAppointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <div className="w-20 h-20 rounded-full bg-[#F5F3EE] flex items-center justify-center text-4xl mb-4">🐾</div>
                      <p className="text-lg font-medium text-[#4A4A4A] mb-1">Sin citas para hoy</p>
                      <p className="text-sm text-[#6B6B6B] mb-4">¡El día está libre!</p>
                      <button onClick={() => setCurrentView('agenda')} className="px-4 py-2 text-sm border border-[#4A7C59] text-[#4A7C59] rounded-lg hover:bg-[#4A7C59] hover:text-white transition-colors">+ Agendar cita</button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {todayAppointments.sort((a, b) => { const [ah, am] = a.time.split(':').map(Number); const [bh, bm] = b.time.split(':').map(Number); return (ah * 60 + am) - (bh * 60 + bm); }).slice(0, 6).map((apt) => (
                        <div key={apt.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E8E4DC] hover:shadow-md transition-shadow relative overflow-hidden">
                          <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${apt.status === 'pendiente' ? 'bg-[#F59E0B]' : apt.status === 'confirmada' ? 'bg-[#4A7C59]' : apt.status === 'en_proceso' ? 'bg-[#7C3AED]' : apt.status === 'completada' ? 'bg-[#9CA3AF]' : 'bg-[#EF4444]'}`} />
                          <div className="w-14 pl-3"><p className="text-base font-bold text-[#1C1C1C]">{apt.time}</p></div>
                          <div className="flex-1 min-w-0 pl-2">
                            <p className="font-semibold text-[#1C1C1C] truncate">🐕 {apt.pet_name || apt.petName || 'Sin nombre'}</p>
                            <p className="text-sm text-[#6B6B6B] truncate">👤 {apt.owner_name || apt.ownerName || 'Sin cliente'}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${apt.status === 'pendiente' ? 'bg-[#FEF3C7] text-[#B45309]' : apt.status === 'confirmada' ? 'bg-[#EEF4F0] text-[#4A7C59]' : apt.status === 'en_proceso' ? 'bg-[#F5F3FF] text-[#7C3AED]' : apt.status === 'completada' ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-red-100 text-red-700'}`}>
                            {apt.status === 'pendiente' ? '⏳ Pendiente' : apt.status === 'confirmada' ? '✓ Confirmada' : apt.status === 'en_proceso' ? '✂️ En Proceso' : apt.status === 'completada' ? '✓ Completada' : '✕ Cancelada'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-span-2 space-y-4">
                  <div className="bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#6B6B6B] mb-2">Próxima cita</p>
                    {nextAppointment ? <p className="text-[28px] font-bold text-[#E8943D]">{getTimeRemaining()}</p> : <p className="text-[28px] font-bold text-[#1C1C1C]">—</p>}
                  </div>
                  <div className="bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#6B6B6B] mb-2">Citas de mañana</p>
                    <p className="text-[28px] font-bold text-[#1C1C1C]">{tomorrowAppointments.length}</p>
                  </div>
                  <div className="bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#6B6B6B] mb-2">Clientes nuevos · Esta semana</p>
                    <p className="text-[28px] font-bold text-[#1C1C1C]">{uniqueClientsThisWeek}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {currentView === 'agenda' && renderCalendarView()}
          {currentView === 'clientes' && canViewClients && renderClientsView()}
          {currentView === 'mascotas' && renderPetsView()}
          {currentView === 'reportes' && canViewReports && renderReportsView()}
          {currentView === 'fichas' && renderFichasView()}
          {currentView === 'recordatorios' && <RemindersView />}
          {currentView === 'configuracion' && canViewReports && renderConfigView()}
        </main>

        {/* Modal nueva cita */}
        {newAppointmentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900">Nueva Cita</h3>
                <p className="text-sm text-gray-500">{selectedDate ? format(selectedDate as Date, 'EEEE d MMMM', { locale: es }) : 'Sin fecha seleccionada'}</p>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (newAptSaving) return;
                setNewAptSaving(true);
                try {
                  const formData = new FormData(e.currentTarget);
                  const isAdditional = (formData.get('additionalService') as string) === 'on';
                  const recoveryDuration = services.find(s => s.isAdditional)?.duration || 45;
                  const baseTime = SIZE_DURATION[newAptSize] || 60;
                  const aptDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : todayStr;

                  let insertError: any = null;
                  const { error: err1 } = await supabase.from('appointments').insert({
                    pet_name: formData.get('petName') as string,
                    pet_breed: newAptBreed?.name || (formData.get('customBreed') as string) || '',
                    pet_breed_age: newAptBreed?.name || (formData.get('customBreed') as string) || '',
                    owner_name: formData.get('ownerName') as string,
                    whatsapp: formData.get('whatsapp') as string,
                    comments: formData.get('comments') as string,
                    additional_service: isAdditional,
                    base_time_minutes: baseTime,
                    recovery_time: isAdditional ? recoveryDuration : 0,
                    date: aptDate,
                    time: formData.get('time') as string,
                    status: 'pendiente',
                  });

                  if (err1) {
                    const { error: err2 } = await supabase.from('appointments').insert({
                      pet_name: formData.get('petName') as string,
                      pet_breed: newAptBreed?.name || (formData.get('customBreed') as string) || '',
                      pet_breed_age: newAptBreed?.name || (formData.get('customBreed') as string) || '',
                      owner_name: formData.get('ownerName') as string,
                      whatsapp: formData.get('whatsapp') as string,
                      comments: formData.get('comments') as string,
                      additional_service: isAdditional,
                      date: aptDate,
                      time: formData.get('time') as string,
                      status: 'pendiente',
                    });
                    insertError = err2;
                  }

                  if (insertError) throw new Error(`Error Supabase: ${insertError.message}`);
                  await fetchAppointments();
                  setNewAppointmentModal(false);
                  setNewAptSize('');
                  setNewAptBreed(null);
                } catch (err) {
                  console.error('Error guardando cita:', err);
                  alert('Error al guardar la cita. Intenta de nuevo.');
                } finally {
                  setNewAptSaving(false);
                }
              }} className="p-6 space-y-4">
                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Datos de la Mascota</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de la mascota</label>
                      <input name="petName" required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm" placeholder="Nombre" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Tamaño</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['pequeno', 'mediano', 'intermedio', 'grande'] as const).map((size) => (
                          <button key={size} type="button" onClick={() => { setNewAptSize(size); setNewAptBreed(null); }}
                            className={`py-2 px-1 rounded-lg border text-xs font-medium transition-all text-center ${newAptSize === size ? 'bg-[#E8943D] text-white border-[#E8943D]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#E8943D]'}`}>
                            {size === 'pequeno' ? 'Pequeño' : size === 'mediano' ? 'Mediano' : size === 'intermedio' ? 'Intermedio' : 'Grande'}
                            <span className="block text-[10px] opacity-70">{SIZE_DURATION[size]} min</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {newAptSize && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Raza {newAptBreed && <span className="text-[#E8943D]">· {newAptBreed.emoji} {newAptBreed.name}</span>}
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                          {SIZE_BREEDS[newAptSize].map((breed) => (
                            <button key={breed.name} type="button" onClick={() => setNewAptBreed(breed)}
                              className={`px-2.5 py-1 rounded-full text-xs border transition-all ${newAptBreed?.name === breed.name ? 'bg-[#E8943D] text-white border-[#E8943D]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#E8943D]'}`}>
                              {breed.emoji} {breed.name}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2">
                          <input name="customBreed" className="w-full px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-xs text-gray-500" placeholder="O escribe la raza manualmente..." onChange={(e) => { if (e.target.value) setNewAptBreed(null); }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Servicio</h4>
                  <div className="p-3 bg-[#FFF8F2] border border-[#E8943D]/40 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">✂️ Grooming Completo</p>
                      <p className="text-xs text-gray-500">Baño, corte, uñas y oídos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#E8943D]">{newAptSize ? `${SIZE_DURATION[newAptSize]} min` : '— min'}</p>
                      {!newAptSize && <p className="text-xs text-gray-400">Selecciona tamaño</p>}
                    </div>
                  </div>
                  {services.find(s => s.isAdditional && s.active) && (
                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" name="additionalService" className="rounded text-purple-600" />
                          <div>
                            <span className="text-sm font-medium text-purple-700">🧶 Recuperación de manto</span>
                            <p className="text-xs text-purple-500">Para pelaje muy enredado o crecido</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-purple-600">+45 min</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Hora</h4>
                  <select name="time" required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm">
                    <option value="">Seleccionar hora disponible</option>
                    {TIME_SLOTS.filter(slotTime => {
                      const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : todayStr;
                      return !appointments.some(a => a.date === dateKey && a.status !== 'cancelada' && a.time === slotTime);
                    }).map(slotTime => (<option key={slotTime} value={slotTime}>{slotTime}</option>))}
                  </select>
                </div>

                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Datos del Cliente</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del dueño</label>
                      <input name="ownerName" required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm" placeholder="Nombre completo" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 py-2 border border-r-0 rounded-l-lg bg-[#FAFAF8] text-sm text-gray-500">+502</span>
                        <input name="whatsapp" required type="tel" pattern="[0-9]{8}" maxLength={8} className="flex-1 px-3 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm" placeholder="12345678" />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
                  <textarea name="comments" rows={2} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm" placeholder="Notas especiales..." />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setNewAppointmentModal(false); setNewAptSize(''); setNewAptBreed(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-[#FAFAF8] transition-colors">Cancelar</button>
                  <button type="submit" disabled={!newAptSize || newAptSaving} className="flex-1 px-4 py-2 bg-[#E8943D] hover:bg-[#E8943D]/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {newAptSaving ? 'Guardando...' : 'Crear Cita'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal editar servicio */}
        {editServiceModal && (() => {
          const selectedService = services.find(s => s.id === editServiceModal.serviceId);
          const totalDuration = (selectedService?.duration || 45) + editServiceModal.recoveryTime;
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl w-full max-w-md">
                <div className="border-b px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">Editar Servicio</h3>
                  <p className="text-sm text-gray-500">{editServiceModal.appointment.petName || editServiceModal.appointment.pet_name}</p>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const newServiceId = formData.get('serviceId') as string;
                  const newService = services.find(s => s.id === newServiceId);
                  const isAdditional = formData.get('additionalService') === 'true';
                  const recoveryTime = formData.get('recoveryTime') ? parseInt(formData.get('recoveryTime') as string) : 0;
                  const updatedAppointment = { ...editServiceModal.appointment, serviceId: newServiceId, serviceName: newService?.name || 'Baño y corte', baseTimeMinutes: newService?.duration || 45, additionalService: isAdditional, recoveryTime };
                  setAppointments(appointments.map(a => a.id === updatedAppointment.id ? updatedAppointment : a));
                  setEditServiceModal(null);
                }} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Servicio</label>
                    <div className="space-y-2">
                      {services.filter(s => s.active).map(service => (
                        <label key={service.id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-[#FAFAF8]">
                          <div className="flex items-center gap-3">
                            <input type="radio" name="serviceId" value={service.id} defaultChecked={editServiceModal.serviceId === service.id} className="text-[#E8943D]" />
                            <div>
                              <p className="font-medium text-sm">{service.emoji} {service.name}</p>
                              <p className="text-xs text-gray-500">{service.duration} min • Q{service.price}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-[#FAFAF8] rounded-lg">
                    <p className="text-sm text-gray-600"><span className="font-medium">Duración estimada total:</span> {totalDuration} minutos</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setEditServiceModal(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-[#FAFAF8] transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 px-4 py-2 bg-[#E8943D] hover:bg-[#E8943D]/90 text-white rounded-lg transition-colors">Guardar</button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Modal mensaje personalizado */}
        {customMessageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Enviar mensaje a {customMessageModal.name}</h3>
              <p className="text-sm text-gray-500 mb-4">Teléfono: {customMessageModal.phone}</p>
              <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Escribe tu mensaje..." className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none" rows={4} autoFocus />
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setCustomMessageModal(null); setCustomMessage(''); }} className="flex-1 px-4 py-2 border text-gray-700 rounded-lg hover:bg-[#FAFAF8] transition-colors">Cancelar</button>
                <button onClick={sendCustomMessage} disabled={!customMessage.trim()} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    blue: 'bg-[#E8F5E9] text-blue-800',
    green: 'bg-green-100 text-green-800',
  };
  return (
    <div className={`rounded-lg p-4 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
