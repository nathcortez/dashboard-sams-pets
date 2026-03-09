'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Appointment, AppointmentStatus, TIME_SLOTS } from '@/types/appointment';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay, isToday, eachMonthOfInterval, startOfYear, parseISO, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { logout, getSession } from '@/lib/auth';
import { User, PERMISSIONS, Permission } from '@/types/auth';
import Sidebar from '@/components/admin/Sidebar';

type View = 'inicio' | 'agenda' | 'mascotas' | 'clientes' | 'servicios' | 'reportes' | 'configuracion';

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

  // Estado para servicios
  const [services, setServices] = useState([
    { id: '1', name: 'Baño básico', description: 'Baño con shampoo, secado y cepillado', duration: 30, price: 100, emoji: '🛁', active: true },
    { id: '2', name: 'Baño + Corte', description: 'Baño completo más corte de pelo al estilo de la raza', duration: 60, price: 150, emoji: '✂️', active: true },
    { id: '3', name: 'Paquete completo', description: 'Baño + corte + uñas + oídos', duration: 105, price: 200, emoji: '⭐', active: true },
    { id: '4', name: 'Recuperación de manto', description: 'Servicio adicional con costo extra', duration: 45, price: 80, emoji: '🧶', active: true, isAdditional: true },
  ]);
  const [serviceModal, setServiceModal] = useState<{ mode: 'add' | 'edit'; service?: typeof services[0] } | null>(null);
  const [newAppointmentModal, setNewAppointmentModal] = useState(false);
  const [editServiceModal, setEditServiceModal] = useState<{ appointment: Appointment; serviceId: string; additionalService: boolean; recoveryTime: number } | null>(null);

  // Estado para configuracion
  const [config, setConfig] = useState({
    workDays: ['1', '2', '3', '4', '5'], // Lun-Vie por defecto
    openTime: '08:00',
    closeTime: '15:00',
    lastAppointmentTime: '14:00',
    lunchStart: '13:00',
    lunchEnd: '14:00',
    lunchEnabled: true,
    holidays: [] as string[],
  });

  // Usuario y autenticación
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
    // Clear session first
    logout();
    // Clear user state
    setUser(null);
    // Use replace to avoid going back to dashboard
    window.location.href = '/login';
  };

  const userPermissions: readonly Permission[] = user ? PERMISSIONS[user.role] : [];
  const canViewClients = userPermissions.includes('clients');
  const canViewReports = userPermissions.includes('reports');

  // Estados para reportes
  const [reportDateFrom, setReportDateFrom] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportDateTo, setReportDateTo] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportServiceFilter, setReportServiceFilter] = useState<'all' | 'bano' | 'adicional'>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [dailyGoal, setDailyGoal] = useState<number>(5);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(100);

  // Redirigir a inicio si no tiene acceso a la vista actual
  useEffect(() => {
    if (!user) return;
    if (currentView === 'clientes' && !canViewClients) {
      setCurrentView('inicio');
    }
    if (currentView === 'reportes' && !canViewReports) {
      setCurrentView('inicio');
    }
  }, [user, currentView, canViewClients, canViewReports]);

  // Fetch appointments y polling cada 30 segundos
  useEffect(() => {
    fetchAppointments();

    const interval = setInterval(() => {
      fetchAppointments();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: AppointmentStatus) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      fetchAppointments();
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Agrupar citas por fecha
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    appointments.forEach(apt => {
      const dateKey = apt.date;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [appointments]);

  // Generar días del calendario
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const emptyDays = Array(startDay).fill(null);
    return [...emptyDays, ...days];
  }, [currentMonth]);

  // Citas del día seleccionado - ordenada por hora
  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return (appointmentsByDate[dateKey] || []).sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, appointmentsByDate]);

  // Agrupar citas por cliente (teléfono)
  const clients = useMemo(() => {
    const clientMap: Record<string, Client> = {};

    appointments.forEach(apt => {
      const phone = apt.whatsapp || '';
      if (!phone) return;

      if (!clientMap[phone]) {
        clientMap[phone] = {
          phone,
          name: apt.owner_name || apt.ownerName || '',
          pets: new Set(),
          appointments: [],
          totalVisits: 0,
        };
      }
      // Agregar mascota
      clientMap[phone].pets.add(`${apt.pet_name || apt.petName}|${apt.pet_breed_age || apt.petBreedAge}`);
      // Agregar cita
      clientMap[phone].appointments.push(apt);
      // Contar visitas completadas
      if (apt.status === 'completada') {
        clientMap[phone].totalVisits++;
      }
    });

    // Convertir a array y ordenar por nombre
    return Object.values(clientMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments]);

  // Filtrar clientes por búsqueda
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.includes(query)
    );
  }, [clients, searchQuery]);

  // Extraer mascotas únicas de las citas
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
      const petKey = `${apt.pet_name || apt.petName}-${apt.whatsapp}`;
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

  // Filtrar mascotas por búsqueda
  const filteredPets = useMemo(() => {
    if (!petSearchQuery.trim()) return pets;
    const query = petSearchQuery.toLowerCase();
    return pets.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.breed.toLowerCase().includes(query) ||
      p.ownerName.toLowerCase().includes(query)
    );
  }, [pets, petSearchQuery]);

  const stats = {
    total: appointments.length,
    pendiente: appointments.filter(a => a.status === 'pendiente').length,
    confirmada: appointments.filter(a => a.status === 'confirmada').length,
    completada: appointments.filter(a => a.status === 'completada').length,
  };

  // Citas de hoy
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(a => a.date === todayStr);

  const todayStats = {
    total: todayAppointments.length,
    pendiente: todayAppointments.filter(a => a.status === 'pendiente').length,
    confirmada: todayAppointments.filter(a => a.status === 'confirmada').length,
    completada: todayAppointments.filter(a => a.status === 'completada').length,
  };

  // Citas de mañana
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrowAppointments = appointments.filter(a => a.date === tomorrowStr);

  // Próxima cita
  const now = new Date();
  const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const upcomingAppointments = todayAppointments
    .filter(a => {
      const [h, m] = a.time.split(':').map(Number);
      return h * 60 + m > currentTimeMinutes && a.status !== 'cancelada';
    })
    .sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });

  const nextAppointment = upcomingAppointments[0];

  // Calcular tiempo restante para próxima cita
  const getTimeRemaining = () => {
    if (!nextAppointment) return null;
    const [h, m] = nextAppointment.time.split(':').map(Number);
    const appointmentMinutes = h * 60 + m;
    const remaining = appointmentMinutes - currentTimeMinutes;
    if (remaining <= 0) return 'Ahora';
    if (remaining < 60) return `${remaining} min`;
    const hours = Math.floor(remaining / 60);
    const mins = remaining % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // Clientes únicos de la semana
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const thisWeekAppointments = appointments.filter(a => a.date >= weekAgo);
  const uniqueClientsThisWeek = new Set(thisWeekAppointments.map(a => a.whatsapp)).size;

  const getStatusColor = (status: AppointmentStatus) => {
    switch (status) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmada': return 'bg-[#E8F5E9] text-blue-800 border-blue-200';
      case 'completada': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelada': return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'confirmada': return 'Confirmada';
      case 'completada': return 'Completada';
      case 'cancelada': return 'Cancelada';
    }
  };

  // Función para enviar recordatorio por WhatsApp
  const sendReminder = (apt: Appointment) => {
    const phone = (apt.whatsapp || '').replace(/\D/g, '');
    if (!phone) return;
    const service = apt.additional_service ? 'servicio adicional' : 'baño y corte';
    const dateFormatted = format(new Date(apt.date), 'dd MMMM yyyy', { locale: es });
    const message = `Hola ${apt.owner_name || apt.ownerName}, te recordamos que tienes cita el ${dateFormatted} a las ${apt.time} para ${service} de ${apt.pet_name || apt.petName}. ¡Te esperamos!`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  // Función para enviar mensaje personalizado
  const sendCustomMessage = () => {
    if (!customMessage.trim() || !customMessageModal) return;
    const phone = customMessageModal.phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(customMessage);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    setCustomMessage('');
    setCustomMessageModal(null);
  };

  // Función para exportar a Excel
  const exportToExcel = (data: any[], filename: string, headers: string[]) => {
    // Crear CSV (compatible con Excel)
    const csvContent = [
      headers.join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

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

  // Render vista de agenda - 2 columnas
  const renderCalendarView = () => (
    <div className="flex gap-6 h-[calc(100vh-140px)]">
      {/* Columna izquierda (40%) - Calendario mensual compacto */}
      <div className="w-2/5 bg-white rounded-xl shadow-sm border p-4 flex flex-col">
        {/* Navegación del mes */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F0EDE8] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: es }).charAt(0).toUpperCase() + format(currentMonth, 'MMMM yyyy', { locale: es }).slice(1)}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F0EDE8] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Fila de resumen de la semana actual */}
        <div className="bg-white rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 mb-3 max-h-[70px]">
          <div className="grid grid-cols-7 gap-1">
            {[
              { day: 1, label: 'Lun' },
              { day: 2, label: 'Mar' },
              { day: 3, label: 'Mié' },
              { day: 4, label: 'Jue' },
              { day: 5, label: 'Vie' },
              { day: 6, label: 'Sáb' },
              { day: 0, label: 'Dom' },
            ].map(({ day, label }) => {
              const today = new Date();
              const currentDayOfWeek = today.getDay();
              const adjustedDay = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
              const isToday = adjustedDay === day;
              const weekStart = subDays(today, adjustedDay);
              const weekDay = addDays(weekStart, day);
              const dateKey = format(weekDay, 'yyyy-MM-dd');
              const count = (appointmentsByDate[dateKey] || []).length;

              return (
                <button
                  key={day}
                  onClick={() => { setSelectedDate(weekDay); setCurrentMonth(weekDay); setExpandedAppointment(null); }}
                  className={`
                    flex flex-col items-center justify-center py-1 rounded-lg transition-colors
                    ${isToday ? 'bg-[#EEF4F0]' : 'hover:bg-[#F5F3EE]'}
                  `}
                >
                  <span className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-[#4A7C59]' : 'text-[#9E9E9E]'}`}>
                    {label}
                  </span>
                  <span className={`text-sm font-medium ${isToday ? 'text-[#4A7C59]' : 'text-[#1C1C1C]'}`}>
                    {format(weekDay, 'd')}
                  </span>
                  <span className={`
                    text-[10px] font-medium px-1.5 py-0.5 rounded-full
                    ${count === 0 ? 'text-[#9E9E9E]' : isToday ? 'bg-[#4A7C59] text-white' : 'bg-[#F5F3EE] text-[#4A4A4A]'}
                  `}>
                    {count === 0 ? '—' : count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(day => (
            <div key={day} className="text-center text-[11px] font-medium uppercase tracking-wider text-[#9E9E9E] py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Días del calendario */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="h-[44px]" />;
            }

            const dateKey = format(day, 'yyyy-MM-dd');
            const dayAppointments = appointmentsByDate[dateKey] || [];
            const count = dayAppointments.length;
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            const dayOfWeek = getDay(day);
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <button
                key={dateKey}
                onClick={() => { setSelectedDate(day); setExpandedAppointment(null); }}
                disabled={isWeekend}
                className={`
                  max-h-[44px] aspect-square rounded-[8px] border transition-all flex flex-col items-center justify-center relative
                  ${isWeekend ? 'bg-[#FAF7F3] cursor-not-allowed' : ''}
                  ${!isWeekend && isSelected ? 'bg-[#4A7C59] border-[#4A7C59]' : ''}
                  ${!isWeekend && !isSelected ? 'border-transparent hover:bg-[#F5F3EE]' : ''}
                  ${today && !isWeekend && !isSelected ? 'bg-[#4A7C59] text-white' : ''}
                `}
              >
                <span className={`
                  text-sm font-medium
                  ${today ? 'text-white' : isWeekend ? 'text-[#D4D0C8]' : isSelected ? 'text-white' : 'text-[#1C1C1C]'}
                `}>
                  {format(day, 'd')}
                </span>
                {count > 0 && !isWeekend && (
                  <span className={`
                    absolute bottom-0.5 h-[3px] rounded-[2px]
                    ${isSelected ? 'bg-white w-5' : count <= 2 ? 'bg-[#A8D5B5] w-3' : count <= 4 ? 'bg-[#F5C842] w-4' : 'bg-[#C97B5A] w-5'}
                  `} />
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

      {/* Columna derecha (60%) - Detalle del día */}
      <div className="w-3/5 bg-white rounded-xl shadow-sm border p-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8E4DC]">
          <h3 className="text-[16px] font-semibold text-[#1C1C1C]">
            {selectedDate ? `${format(selectedDate, 'EEEE d', { locale: es }).charAt(0).toUpperCase() + format(selectedDate, 'EEEE d', { locale: es }).slice(1)} de ${format(selectedDate, 'MMMM', { locale: es }).charAt(0).toUpperCase() + format(selectedDate, 'MMMM', { locale: es }).slice(1)}` : ''}
          </h3>
          {selectedDate && selectedDateAppointments.length > 0 && (
            <button
              onClick={() => setNewAppointmentModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#4A7C59] hover:bg-[#EEF4F0] rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva cita
            </button>
          )}
        </div>

        {/* Lista de citas - scroll interno */}
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
            <div className="w-16 h-16 rounded-full bg-[#F5F3EE] flex items-center justify-center text-3xl mb-4">
              🐾
            </div>
            <p className="text-[#4A4A4A] font-medium mb-4">Sin citas para este día</p>
            <button
              onClick={() => setNewAppointmentModal(true)}
              className="px-5 py-2.5 bg-[#4A7C59] hover:bg-[#3D6A4B] text-white text-sm font-medium rounded-[8px] transition-colors"
            >
              + Agendar cita
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {selectedDateAppointments.map((apt) => {
              const isExpanded = expandedAppointment === apt.id;
              const statusColor = apt.status === 'pendiente' ? '#F59E0B' : apt.status === 'confirmada' ? '#4A7C59' : apt.status === 'completada' ? '#9CA3AF' : '#EF4444';

              return (
                <div
                  key={apt.id}
                  className={`
                    rounded-lg border transition-all cursor-pointer relative overflow-hidden
                    ${isExpanded ? 'border-[#4A7C59] bg-[#EEF4F0]/30' : 'border-[#E8E4DC] hover:border-[#4A7C59]'}
                  `}
                  onClick={() => setExpandedAppointment(isExpanded ? null : apt.id)}
                >
                  {/* Franja de color según estado */}
                  <div className={`absolute left-0 top-0 bottom-0 w-[4px]`} style={{ backgroundColor: statusColor }} />

                  {/* Vista compactada - siempre visible */}
                  <div className="flex items-center gap-3 p-3 pl-4">
                    <div className="w-14 flex-shrink-0">
                      <span className="text-base font-bold text-[#1C1C1C]">{apt.time}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1C1C1C] truncate">
                        🐕 {apt.pet_name || apt.petName || 'Sin nombre'}
                      </p>
                      <p className="text-sm text-[#6B6B6B] truncate">
                        👤 {apt.owner_name || apt.ownerName || 'Sin cliente'} • ✂️ {apt.service_name || (apt.additional_service ? 'Servicio adicional' : 'Baño y corte')}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      apt.status === 'pendiente' ? 'bg-[#FEF3C7] text-[#B45309]' :
                      apt.status === 'confirmada' ? 'bg-[#EEF4F0] text-[#4A7C59]' :
                      apt.status === 'completada' ? 'bg-[#F3F4F6] text-[#6B7280]' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {getStatusLabel(apt.status)}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Vista expandida */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {/* Teléfono */}
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Teléfono</p>
                          <p className="font-medium text-gray-900">{apt.whatsapp || '-'}</p>
                        </div>
                        {/* Raza */}
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Raza</p>
                          <p className="font-medium text-gray-900">
                            {apt.pet_breed_emoji || ''} {apt.pet_breed || apt.petBreedAge || '-'}
                          </p>
                        </div>
                        {/* Servicio */}
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Servicio</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="font-medium text-gray-900">
                              {apt.service_name || (apt.additional_service ? 'Recuperación de manto' : 'Baño y corte')}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditServiceModal({
                                  appointment: apt,
                                  serviceId: apt.serviceId || apt.service_id || '',
                                  additionalService: apt.additional_service || apt.additionalService || false,
                                  recoveryTime: apt.recovery_time || apt.recoveryTime || 0,
                                });
                              }}
                              className="p-1 text-[#4A7C59] hover:bg-blue-50 rounded"
                              title="Editar servicio"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </div>
                          {(apt.additional_service || apt.additionalService) && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-[#FCE4D6] text-purple-700 text-xs rounded-full">
                              Recuperación de manto
                            </span>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Duración: {apt.base_time_minutes || apt.base_time_minutes || 45}{(apt.recovery_time || apt.recoveryTime) ? ` + ${apt.recovery_time || apt.recoveryTime}` : ''} min = {(apt.base_time_minutes || apt.base_time_minutes || 45) + (apt.recovery_time || apt.recoveryTime || 0)} min
                          </p>
                        </div>
                        {/* Estado actual */}
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Cambiar estado</p>
                          <select
                            value={apt.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateStatus(apt.id, e.target.value as AppointmentStatus);
                            }}
                            disabled={updatingId === apt.id}
                            onClick={(e) => e.stopPropagation()}
                            className={`
                              w-full px-2 py-1 rounded text-sm font-medium border cursor-pointer mt-1
                              ${getStatusColor(apt.status)}
                              disabled:opacity-50
                            `}
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="confirmada">Confirmada</option>
                            <option value="completada">Completada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                        </div>
                      </div>

                      {/* Comentarios */}
                      {apt.comments && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
                          <p className="text-xs text-yellow-700 uppercase">Notas</p>
                          <p className="text-sm text-gray-700">{apt.comments}</p>
                        </div>
                      )}

                      {/* Botones de acción */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); sendReminder(apt); }}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp
                        </button>
                        {apt.status !== 'cancelada' && apt.status !== 'completada' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'confirmada'); }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-[#4A7C59] hover:bg-[#3D6A4B] text-white text-sm rounded-lg transition-colors"
                            >
                              ✓ Confirmar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'cancelada'); }}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                            >
                              ✕ Cancelar
                            </button>
                          </>
                        )}
                        {apt.status === 'cancelada' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'pendiente'); }}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded-lg transition-colors"
                          >
                            ↺ Reactivar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Render vista de reportes - compacta
  const renderReportsView = () => {
    // Citas filtradas por fecha, servicio y estado
    const filteredAppointments = appointments.filter(apt => {
      if (apt.date < reportDateFrom || apt.date > reportDateTo) return false;
      if (reportServiceFilter === 'bano' && apt.additional_service) return false;
      if (reportServiceFilter === 'adicional' && !apt.additional_service) return false;
      if (reportStatusFilter !== 'all' && apt.status !== reportStatusFilter) return false;
      return true;
    });

    // Mes actual y mes anterior para comparativa
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

    // Clientes unicos del mes
    const prevMonthClients = new Set(prevMonthAppointments.map(a => a.whatsapp));
    const newClientsThisMonth = thisMonthAppointments.filter(a => !prevMonthClients.has(a.whatsapp)).length;
    const recurringClientsThisMonth = thisMonthAppointments.filter(a => prevMonthClients.has(a.whatsapp)).length;

    // Servicio mas solicitado
    const serviceCounts = { bano: 0, adicional: 0 };
    thisMonthAppointments.forEach(a => {
      if (a.additional_service) serviceCounts.adicional++;
      else serviceCounts.bano++;
    });
    const topService = serviceCounts.bano >= serviceCounts.adicional ? 'Bano y corte' : 'Servicio adicional';

    // Dia con mas citas
    const dayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    thisMonthAppointments.forEach(a => {
      const day = new Date(a.date).getDay();
      dayCounts[day]++;
    });
    const maxDay = Object.entries(dayCounts).reduce((a, b) => a[1] > b[1] ? a : b);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

    // Tasa de cancelacion
    const cancelRate = thisMonthTotal > 0 ? Math.round((thisMonthAppointments.filter(a => a.status === 'cancelada').length / thisMonthTotal) * 100) : 0;

    // Ingreso estimado
    const PRICE_BANO = 100;
    const PRICE_ADICIONAL = 150;
    const estimatedIncome = thisMonthAppointments
      .filter(a => a.status === 'completada')
      .reduce((sum, a) => sum + (a.additional_service ? PRICE_ADICIONAL : PRICE_BANO), 0);

    // Datos para grafica por dia
    const start = parseISO(reportDateFrom);
    const end = parseISO(reportDateTo);
    const daysInterval = eachDayOfInterval({ start, end });
    const dailyData = daysInterval.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayApts = filteredAppointments.filter(a => a.date === dateKey && a.status === 'completada');
      return {
        date: format(day, 'dd'),
        fullDate: dateKey,
        count: dayApts.length,
        isGood: dayApts.length >= dailyGoal,
      };
    });

    // Promedios
    const avgPerDayNum = dailyData.length > 0 ? dailyData.reduce((s, d) => s + d.count, 0) / dailyData.length : 0;
    const avgPerDay = avgPerDayNum.toFixed(1);

    // Datos por mes del año 2026
    const yearStart = startOfYear(now);
    const monthsInterval = eachMonthOfInterval({ start: yearStart, end: now });
    const monthlyData2026 = monthsInterval.map(month => {
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
      const count = appointments.filter(a => a.date >= monthStart && a.date <= monthEnd && a.status === 'completada').length;
      return {
        month: format(month, 'MMM', { locale: es }),
        count,
      };
    });

    // Top 10 clientes
    const clientVisits: Record<string, { name: string; phone: string; visits: number }> = {};
    appointments.forEach(apt => {
      const phone = apt.whatsapp;
      if (!phone) return;
      if (!clientVisits[phone]) {
        clientVisits[phone] = { name: apt.owner_name || apt.ownerName || '', phone, visits: 0 };
      }
      if (apt.status === 'completada') {
        clientVisits[phone].visits++;
      }
    });
    const topClients = Object.values(clientVisits).sort((a, b) => b.visits - a.visits).slice(0, 10);

    // Clientes inactivos
    const thirtyDaysAgo = format(addMonths(now, -1), 'yyyy-MM-dd');
    const activePhones = new Set(
      appointments.filter(a => a.date > thirtyDaysAgo && a.status === 'completada').map(a => a.whatsapp || '')
    );
    const allClientPhones = new Set(appointments.map(a => a.whatsapp || ''));
    const inactiveClients = Array.from(allClientPhones).filter(phone => !activePhones.has(phone)).map(phone => {
      const lastApt = appointments.filter(a => a.whatsapp === phone && a.status === 'completada').sort((a, b) => b.date.localeCompare(a.date))[0];
      return {
        phone,
        name: lastApt?.owner_name || lastApt?.ownerName || 'Unknown',
        lastVisit: lastApt ? format(new Date(lastApt.date), 'dd MMM yyyy', { locale: es }) : 'N/A',
      };
    });

    // Archivo Excel
    const handleExportExcel = () => {
      const filename = `reporte-citas-${format(parseISO(reportDateFrom), 'MMM').toLowerCase()}${format(parseISO(reportDateFrom), 'yyyy')}.csv`;
      const data = filteredAppointments.map(a => ({
        Fecha: a.date,
        Hora: a.time,
        Cliente: a.owner_name || a.ownerName,
        Telefono: a.whatsapp,
        Mascota: a.pet_name,
        Raza: a.pet_breed_age,
        Servicio: a.additional_service ? 'Servicio adicional' : 'Bano y corte',
        Estado: a.status,
      }));
      exportToExcel(data, filename, ['Fecha', 'Hora', 'Cliente', 'Telefono', 'Mascota', 'Raza', 'Servicio', 'Estado']);
    };

    return (
      <div className="space-y-4">
        {/* Filtros - fila unica compacta */}
        <div className="bg-white rounded-xl shadow-sm border p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Desde:</label>
              <input
                type="date"
                value={reportDateFrom}
                onChange={(e) => setReportDateFrom(e.target.value)}
                className="p-1.5 border rounded text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Hasta:</label>
              <input
                type="date"
                value={reportDateTo}
                onChange={(e) => setReportDateTo(e.target.value)}
                className="p-1.5 border rounded text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Servicio:</label>
              <select
                value={reportServiceFilter}
                onChange={(e) => setReportServiceFilter(e.target.value as any)}
                className="p-1.5 border rounded text-sm"
              >
                <option value="all">Todos</option>
                <option value="bano">Bano y corte</option>
                <option value="adicional">Servicio adicional</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Estado:</label>
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value as any)}
                className="p-1.5 border rounded text-sm"
              >
                <option value="all">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500">Meta:</label>
              <input
                type="number"
                value={dailyGoal}
                onChange={(e) => setDailyGoal(Number(e.target.value))}
                className="w-12 p-1 border rounded text-sm text-center"
                min="1"
              />
              <span className="text-xs text-gray-400">/dia</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(Number(e.target.value))}
                className="w-14 p-1 border rounded text-sm text-center"
                min="1"
              />
              <span className="text-xs text-gray-400">/mes</span>
            </div>
            <button
              onClick={handleExportExcel}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Excel
            </button>
          </div>
        </div>

        {/* Resumen General - 2 filas de cards compactas */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          {/* Fila 1 */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="p-3 bg-[#FAFAF8] rounded-lg">
              <p className="text-xs text-gray-500">Citas este mes</p>
              <p className="text-xl font-bold text-gray-900">{thisMonthTotal}</p>
              <p className={`text-xs ${growthPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {growthPercent >= 0 ? '↑' : '↓'} {Math.abs(growthPercent)}%
              </p>
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
          {/* Fila 2 */}
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

        {/* 2 columnas: Productividad + Clientes */}
        <div className="grid grid-cols-2 gap-4">
          {/* Columna Izquierda - Productividad */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Productividad</h3>
            {/* Grafica por dia */}
            <div className="flex items-end gap-px h-24 mb-2">
              {dailyData.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t ${
                      day.isGood ? 'bg-green-500' : day.count > 0 ? 'bg-yellow-500' : 'bg-gray-200'
                    }`}
                    style={{ height: `${Math.min((day.count / Math.max(dailyGoal, 1)) * 100, 100)}%` }}
                  />
                  <span className="text-[8px] text-gray-400 mt-0.5">{day.date}</span>
                </div>
              ))}
            </div>
            {/* Una sola fila: promedio, meta, progreso */}
            <div className="flex justify-between text-xs bg-[#FAFAF8] rounded-lg p-2">
              <div className="text-center">
                <p className="text-gray-400">Promedio</p>
                <p className="font-bold">{avgPerDay}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Meta dia</p>
                <p className="font-bold">{dailyGoal}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Progreso mes</p>
                <p className="font-bold">{filteredAppointments.filter(a => a.status === 'completada').length}/{monthlyGoal}</p>
              </div>
            </div>
          </div>

          {/* Columna Derecha - Clientes */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Clientes</h3>
            <table className="w-full text-xs mb-3">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 text-gray-500">#</th>
                  <th className="text-left py-1 text-gray-500">Cliente</th>
                  <th className="text-right py-1 text-gray-500">Visitas</th>
                </tr>
              </thead>
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
            {/* Clientes por reactivar */}
            {inactiveClients.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-500 mb-1">Por reactivar ({inactiveClients.length})</p>
                <div className="flex flex-wrap gap-1">
                  {inactiveClients.slice(0, 5).map(c => (
                    <span key={c.phone} className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                      {c.name.split(' ')[0]}
                    </span>
                  ))}
                  {inactiveClients.length > 5 && (
                    <span className="text-xs text-gray-400">+{inactiveClients.length - 5}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grafica mensual al final - mas compacta */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Citas por mes (2026)</h3>
          <div className="flex items-end gap-1 h-20">
            {monthlyData2026.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-[#4A7C59] rounded-t"
                  style={{ height: `${Math.min((m.count / 50) * 100, 100)}%` }}
                />
                <span className="text-[8px] text-gray-400 mt-0.5">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  // Render vista de clientes - 2 columnas
  const renderClientsView = () => {
    const selectedClientData = selectedClient ? clients.find(c => c.phone === selectedClient) : null;

    return (
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Columna izquierda (35%) - Lista de clientes */}
        <div className="w-[35%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          {/* Buscador */}
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Lista de clientes */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredClients.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No hay clientes registrados
              </div>
            ) : (
              filteredClients.map((client) => (
                <button
                  key={client.phone}
                  onClick={() => setSelectedClient(client.phone)}
                  className={`
                    w-full p-3 rounded-lg text-left transition-all flex items-center gap-3
                    ${selectedClient === client.phone
                      ? 'bg-[#E8943D]/10 border border-[#E8943D]'
                      : 'border border-transparent hover:bg-[#FAFAF8]'}
                  `}
                >
                  <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[#4A7C59] font-bold">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
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
              ))
            )}
          </div>
        </div>

        {/* Columna derecha (65%) - Ficha del cliente */}
        <div className="w-[65%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          {!selectedClientData ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p>Selecciona un cliente para ver su ficha</p>
            </div>
          ) : (
            <>
              {/* Header del cliente */}
              <div className="pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedClientData.name}</h3>
                    <p className="text-gray-500">{selectedClientData.phone}</p>
                  </div>
                  <button
                    onClick={() => {
                      const message = encodeURIComponent(`Hola ${selectedClientData.name}, como estas?`);
                      window.open(`https://wa.me/${selectedClientData.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                </div>
              </div>

              {/* Mascotas */}
              <div className="py-4 border-b">
                <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Mascotas ({selectedClientData.pets.size})</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedClientData.pets).map((pet, idx) => {
                    const [name, breed] = pet.split('|');
                    return (
                      <span key={idx} className="px-3 py-1.5 bg-gray-100 border rounded-lg text-sm">
                        {name} - {breed}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Historial de citas */}
              <div className="flex-1 overflow-hidden flex flex-col pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Historial de citas</h4>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-500">Total: <strong>{selectedClientData.totalVisits}</strong> visitas</span>
                  </div>
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
                      {[...selectedClientData.appointments]
                        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(b.time))
                        .slice(0, 20)
                        .map((apt) => (
                          <tr key={apt.id} className="hover:bg-[#FAFAF8]">
                            <td className="py-2 px-3">{format(new Date(apt.date), 'dd MMM yyyy')}</td>
                            <td className="py-2 px-3">{apt.time}</td>
                            <td className="py-2 px-3">{apt.pet_name || apt.petName || '-'}</td>
                            <td className="py-2 px-3">
                              {apt.additional_service ? 'Recuperacion' : 'Bano y corte'}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                                {getStatusLabel(apt.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Boton mensaje personalizado */}
              <div className="pt-4 border-t mt-4">
                <button
                  onClick={() => setCustomMessageModal({ phone: selectedClientData.phone, name: selectedClientData.name })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Enviar mensaje personalizado
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render vista de mascotas
  const renderPetsView = () => {
    const selectedPetData = selectedPet ? pets.find(p => p.id === selectedPet) : null;

    return (
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Columna izquierda (35%) - Lista de mascotas */}
        <div className="w-[35%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          {/* Buscador */}
          <div className="mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar mascota..."
                value={petSearchQuery}
                onChange={(e) => setPetSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Lista de mascotas */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredPets.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No hay mascotas registradas
              </div>
            ) : (
              filteredPets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPet(pet.id)}
                  className={`
                    w-full p-3 rounded-lg text-left transition-all flex items-center gap-3
                    ${selectedPet === pet.id
                      ? 'bg-[#E8943D]/10 border border-[#E8943D]'
                      : 'border border-transparent hover:bg-[#FAFAF8]'}
                  `}
                >
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 text-xl">
                    {pet.breedEmoji || '🐕'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{pet.name}</p>
                    <p className="text-sm text-gray-500 truncate">{pet.breed || 'Sin raza'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{pet.ownerName.split(' ')[0]}</p>
                    <p className="text-xs text-gray-500">dueno</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Columna derecha (65%) - Ficha de la mascota */}
        <div className="w-[65%] bg-white rounded-xl shadow-sm border p-4 flex flex-col">
          {!selectedPetData ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p>Selecciona una mascota para ver su ficha</p>
            </div>
          ) : (
            <>
              {/* Header de la mascota */}
              <div className="pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-3xl">
                      {selectedPetData.breedEmoji || '🐕'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedPetData.name}</h3>
                      <p className="text-gray-500">{selectedPetData.breed || 'Sin raza'}</p>
                      {selectedPetData.size && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {selectedPetData.size === 'pequeno' ? 'Pequeno' :
                           selectedPetData.size === 'mediano' ? 'Mediano' :
                           selectedPetData.size === 'grande' ? 'Grande' : selectedPetData.size}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informacion del dueno */}
              <div className="py-4 border-b">
                <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Dueno</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{selectedPetData.ownerName}</p>
                    <p className="text-gray-500">{selectedPetData.ownerPhone}</p>
                  </div>
                  <button
                    onClick={() => {
                      const message = encodeURIComponent(`Hola ${selectedPetData.ownerName}, como estas?`);
                      window.open(`https://wa.me/${selectedPetData.ownerPhone.replace(/\D/g, '')}?text=${message}`, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                </div>
              </div>

              {/* Notas */}
              {selectedPetData.comments && (
                <div className="py-4 border-b">
                  <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Notas</h4>
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
                    {selectedPetData.comments}
                  </div>
                </div>
              )}

              {/* Historial de servicios */}
              <div className="flex-1 overflow-hidden flex flex-col pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-500 uppercase">Historial de servicios</h4>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-500">Total: <strong>{selectedPetData.appointments.filter(a => a.status === 'completada').length}</strong> visitas</span>
                  </div>
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
                      {[...selectedPetData.appointments]
                        .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(b.time))
                        .slice(0, 15)
                        .map((apt) => (
                          <tr key={apt.id} className="hover:bg-[#FAFAF8]">
                            <td className="py-2 px-3">{format(new Date(apt.date), 'dd MMM yyyy')}</td>
                            <td className="py-2 px-3">{apt.time}</td>
                            <td className="py-2 px-3">
                              {apt.additional_service ? 'Recuperacion de manto' : 'Bano y corte'}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                                {getStatusLabel(apt.status)}
                              </span>
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

  // Render vista de servicios
  const renderServicesView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Gestion de Servicios</h2>
        <button
          onClick={() => setServiceModal({ mode: 'add' })}
          className="px-4 py-2 bg-[#E8943D] hover:bg-[#E8943D]/90 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo servicio
        </button>
      </div>

      {/* Lista de servicios */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#FAFAF8]">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Icono</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Servicio</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Descripcion</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Duracion</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Precio</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Estado</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {services.map((service) => (
              <tr key={service.id} className={`hover:bg-[#FAFAF8] ${!service.active ? 'bg-[#FAFAF8]' : ''}`}>
                <td className="py-3 px-4 text-2xl">{service.emoji}</td>
                <td className="py-3 px-4 font-medium text-gray-900">{service.name}</td>
                <td className="py-3 px-4 text-gray-500 text-sm">{service.description}</td>
                <td className="py-3 px-4 text-gray-600">{service.duration} min</td>
                <td className="py-3 px-4 font-medium text-gray-900">Q{service.price}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${service.active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {service.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setServiceModal({ mode: 'edit', service })}
                      className="p-2 text-[#4A7C59] hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setServices(services.map(s =>
                          s.id === service.id ? { ...s, active: !s.active } : s
                        ));
                      }}
                      className={`p-2 rounded-lg transition-colors ${service.active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                      title={service.active ? 'Desactivar' : 'Activar'}
                    >
                      {service.active ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );

  // Render vista de configuracion
  const renderConfigView = () => (
    <div className="space-y-6 max-w-4xl">
      {/* Horario de atencion */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Horario de Atencion</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dias de atencion</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: '1', label: 'Lun' },
                { id: '2', label: 'Mar' },
                { id: '3', label: 'Mie' },
                { id: '4', label: 'Jue' },
                { id: '5', label: 'Vie' },
                { id: '6', label: 'Sab' },
                { id: '0', label: 'Dom' },
              ].map((day) => (
                <label key={day.id} className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-[#FAFAF8]">
                  <input
                    type="checkbox"
                    checked={config.workDays.includes(day.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig({ ...config, workDays: [...config.workDays, day.id] });
                      } else {
                        setConfig({ ...config, workDays: config.workDays.filter(d => d !== day.id) });
                      }
                    }}
                    className="rounded text-[#E8943D]"
                  />
                  <span className="text-sm">{day.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apertura</label>
              <select
                value={config.openTime}
                onChange={(e) => setConfig({ ...config, openTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
              >
                {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                  <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cierre</label>
              <select
                value={config.closeTime}
                onChange={(e) => setConfig({ ...config, closeTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
              >
                {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                  <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ultima hora</label>
              <select
                value={config.lastAppointmentTime}
                onChange={(e) => setConfig({ ...config, lastAppointmentTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
              >
                {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                  <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Horario de almuerzo */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Horario de Almuerzo</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.lunchEnabled}
              onChange={(e) => setConfig({ ...config, lunchEnabled: e.target.checked })}
              className="rounded text-[#E8943D]"
            />
            <span className="text-sm text-gray-600">Activar bloqueo</span>
          </label>
        </div>
        {config.lunchEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
              <select
                value={config.lunchStart}
                onChange={(e) => setConfig({ ...config, lunchStart: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
              >
                {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                  <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <select
                value={config.lunchEnd}
                onChange={(e) => setConfig({ ...config, lunchEnd: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
              >
                {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                  <option key={hour} value={`${hour.toString().padStart(2, '0')}:00`}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Dias feriados */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Dias Feriados / No Laborales</h3>
        <div className="flex gap-4">
          <input
            type="date"
            id="holiday-input"
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
          />
          <button
            onClick={() => {
              const input = document.getElementById('holiday-input') as HTMLInputElement;
              if (input.value && !config.holidays.includes(input.value)) {
                setConfig({ ...config, holidays: [...config.holidays, input.value].sort() });
                input.value = '';
              }
            }}
            className="px-4 py-2 bg-[#E8943D] hover:bg-[#E8943D]/90 text-white rounded-lg transition-colors"
          >
            Agregar
          </button>
        </div>
        {config.holidays.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {config.holidays.map((date) => (
              <span
                key={date}
                className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
              >
                {format(new Date(date), 'dd MMM yyyy')}
                <button
                  onClick={() => setConfig({ ...config, holidays: config.holidays.filter(h => h !== date) })}
                  className="ml-1 hover:text-red-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Info del negocio */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacion del Negocio</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              defaultValue="Sam's Pets"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
            <input
              type="text"
              defaultValue="+502 4903-7428"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
            <input
              type="text"
              defaultValue="El Progreso Jutiapa"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
            <input
              type="text"
              defaultValue="@samspets_shop"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D]"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Sidebar */}
      <Sidebar
        currentSection={currentView}
        onSectionChange={(section) => setCurrentView(section as View)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <div className="ml-60">
        {/* Header simplificado */}
        <header className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">
              {currentView === 'inicio' && 'Inicio'}
              {currentView === 'agenda' && 'Agenda'}
              {currentView === 'mascotas' && 'Mascotas'}
              {currentView === 'clientes' && 'Clientes'}
              {currentView === 'servicios' && 'Servicios'}
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

        {/* Contenido principal */}
        <main className="p-6">
          {/* Vista según sección seleccionada */}
          {currentView === 'inicio' && (
            <div className="space-y-6">
              {/* Fila superior: 4 cards de estado del día */}
              <div className="flex gap-4">
                {/* Total hoy */}
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
                {/* Pendientes */}
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
                {/* Confirmadas */}
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
                {/* Completadas */}
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

              {/* Fila del medio: 2 columnas */}
              <div className="grid grid-cols-5 gap-6">
                {/* Columna izquierda: Agenda de hoy (60%) */}
                <div className="col-span-3 bg-white rounded-xl shadow-sm border p-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Agenda de hoy</h3>
                  {todayAppointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <div className="w-20 h-20 rounded-full bg-[#F5F3EE] flex items-center justify-center text-4xl mb-4">
                        🐾
                      </div>
                      <p className="text-lg font-medium text-[#4A4A4A] mb-1">Sin citas para hoy</p>
                      <p className="text-sm text-[#6B6B6B] mb-4">¡El día está libre!</p>
                      <button
                        onClick={() => setCurrentView('agenda')}
                        className="px-4 py-2 text-sm border border-[#4A7C59] text-[#4A7C59] rounded-lg hover:bg-[#4A7C59] hover:text-white transition-colors"
                      >
                        + Agendar cita
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {todayAppointments
                        .sort((a, b) => {
                          const [ah, am] = a.time.split(':').map(Number);
                          const [bh, bm] = b.time.split(':').map(Number);
                          return (ah * 60 + am) - (bh * 60 + bm);
                        })
                        .slice(0, 6)
                        .map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-center gap-3 p-3 bg-white rounded-lg border border-[#E8E4DC] hover:shadow-md transition-shadow relative overflow-hidden"
                          >
                            {/* Franja de color según estado */}
                            <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${
                              apt.status === 'pendiente' ? 'bg-[#F59E0B]' :
                              apt.status === 'confirmada' ? 'bg-[#4A7C59]' :
                              apt.status === 'completada' ? 'bg-[#9CA3AF]' :
                              'bg-[#EF4444]'
                            }`} />
                            <div className="w-14 pl-3">
                              <p className="text-base font-bold text-[#1C1C1C]">{apt.time}</p>
                            </div>
                            <div className="flex-1 min-w-0 pl-2">
                              <p className="font-semibold text-[#1C1C1C] truncate">
                                🐕 {apt.petName} {apt.petBreed ? `(${apt.petBreed})` : ''}
                              </p>
                              <p className="text-sm text-[#6B6B6B] truncate">👤 {apt.ownerName}</p>
                            </div>
                            <div className="text-sm text-[#4A4A4A] whitespace-nowrap flex items-center gap-1">
                              <span>✂️</span>
                              {apt.serviceName || 'Servicio'}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                              apt.status === 'pendiente' ? 'bg-[#FEF3C7] text-[#B45309]' :
                              apt.status === 'confirmada' ? 'bg-[#EEF4F0] text-[#4A7C59]' :
                              apt.status === 'completada' ? 'bg-[#F3F4F6] text-[#6B7280]' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {apt.status === 'pendiente' ? '⏳ Pendiente' :
                               apt.status === 'confirmada' ? '✓ Confirmada' :
                               apt.status === 'completada' ? '✓ Completada' : '✕ Cancelada'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Columna derecha: Resumen rápido (40%) */}
                <div className="col-span-2 space-y-4">
                  {/* Próxima cita */}
                  <div className="bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#6B6B6B] mb-2">Próxima cita</p>
                    {nextAppointment ? (
                      <p className="text-[28px] font-bold text-[#E8943D]">{getTimeRemaining()}</p>
                    ) : (
                      <p className="text-[28px] font-bold text-[#1C1C1C]">—</p>
                    )}
                  </div>

                  {/* Citas de mañana */}
                  <div className="bg-white rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-5">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[#6B6B6B] mb-2">Citas de mañana</p>
                    <p className="text-[28px] font-bold text-[#1C1C1C]">{tomorrowAppointments.length}</p>
                  </div>

                  {/* Clientes nuevos esta semana */}
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
          {currentView === 'servicios' && canViewReports && renderServicesView()}
          {currentView === 'configuracion' && canViewReports && renderConfigView()}
        </main>

        {/* Modal para nueva cita */}
        {newAppointmentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900">Nueva Cita</h3>
                <p className="text-sm text-gray-500">{selectedDate ? format(selectedDate as Date, 'EEEE d MMMM', { locale: es }) : 'Sin fecha seleccionada'}</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);

                  const selectedServiceId = formData.get('serviceId') as string;
                  const selectedService = services.find(s => s.id === selectedServiceId);
                  const additionalSvc = services.find(s => s.isAdditional);
                  const isAdditional = formData.get('additionalService') === 'true';

                  const newAppointment: Appointment = {
                    id: Date.now().toString(),
                    createdAt: new Date().toISOString(),
                    petName: formData.get('petName') as string,
                    petSize: formData.get('petSize') as string,
                    petBreed: formData.get('petBreed') as string,
                    petBreedEmoji: formData.get('petBreedEmoji') as string || '🐕',
                    serviceId: selectedServiceId,
                    serviceName: selectedService?.name || 'Baño y corte',
                    baseTimeMinutes: selectedService?.duration || 45,
                    ownerName: formData.get('ownerName') as string,
                    whatsapp: formData.get('whatsapp') as string,
                    comments: formData.get('comments') as string,
                    additionalService: isAdditional,
                    recoveryTime: isAdditional ? (additionalSvc?.duration || 45) : 0,
                    date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : todayStr,
                    time: formData.get('time') as string,
                    status: 'pendiente',
                  };

                  setAppointments([...appointments, newAppointment]);
                  setNewAppointmentModal(false);
                }}
                className="p-6 space-y-4"
              >
                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Datos de la Mascota</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de la mascota</label>
                      <input name="petName" required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm" placeholder="Nombre" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tamaño</label>
                      <select name="petSize" required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm">
                        <option value="">Seleccionar</option>
                        <option value="pequeño">Pequeño</option>
                        <option value="mediano">Mediano</option>
                        <option value="grande">Grande</option>
                        <option value="gigante">Gigante</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Raza/Emoji</label>
                      <select name="petBreedEmoji" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm">
                        <option value="🐕">🐕 Perro</option>
                        <option value="🐩">🐩 Poodle</option>
                        <option value="🐶">🐶 Cachorro</option>
                        <option value="🐕‍🦺">🐕‍🦺 Alaska</option>
                        <option value="🐾">🐾 Gato</option>
                        <option value="🐈">🐈 Gato</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Raza/Edad (opcional)</label>
                      <input name="petBreed" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm" placeholder="Ej: Golden Retriever, 3 años" />
                    </div>
                  </div>
                </div>

                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Servicio principal</h4>
                  <div className="space-y-2">
                    {services.filter(s => s.active && !s.isAdditional).map(service => (
                      <label key={service.id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-[#FAFAF8]">
                        <div className="flex items-center gap-3">
                          <input type="radio" name="serviceId" value={service.id} defaultChecked={services.filter(s => s.active && !s.isAdditional)[0]?.id === service.id} required className="text-[#E8943D]" />
                          <div>
                            <p className="font-medium text-sm">{service.emoji} {service.name}</p>
                            <p className="text-xs text-gray-500">{service.duration} min • Q{service.price}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Recuperación de manto como checkbox separado */}
                  {services.find(s => s.isAdditional && s.active) && (
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="additionalService" value="true" className="rounded text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">{services.find(s => s.isAdditional)?.emoji} {services.find(s => s.isAdditional)?.name}</span>
                        <span className="text-xs text-purple-600">+{services.find(s => s.isAdditional)?.duration} min</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="border-b pb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Fecha y Hora</h4>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hora disponible</label>
                    <select name="time" required className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm">
                      <option value="">Seleccionar hora</option>
                      {TIME_SLOTS.filter(time => {
                        const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : todayStr;
                        return !appointments.some(a => a.date === dateKey && a.time === time && a.status !== 'cancelada');
                      }).map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
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
                  <button type="button" onClick={() => setNewAppointmentModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-[#FAFAF8] transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-[#E8943D] hover:bg-[#E8943D]/90 text-white rounded-lg transition-colors">Crear Cita</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal para editar servicio */}
      {editServiceModal && (() => {
        const selectedService = services.find(s => s.id === editServiceModal.serviceId);
        const totalDuration = (selectedService?.duration || 45) + editServiceModal.recoveryTime;

        // Verificar cruces con otras citas
        const aptDate = editServiceModal.appointment.date;
        const aptTime = editServiceModal.appointment.time;
        const [hours, minutes] = aptTime.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + totalDuration;

        const hasConflict = appointments.some(a =>
          a.id !== editServiceModal.appointment.id &&
          a.date === aptDate &&
          a.status !== 'cancelada' &&
          (() => {
            const [ah, am] = a.time.split(':').map(Number);
            const aEnd = ah * 60 + am + (a.base_time_minutes || a.base_time_minutes || 45) + (a.recovery_time || a.recoveryTime || 0);
            return (hours * 60 + minutes < aEnd && endMinutes > ah * 60 + am);
          })()
        );

        // Verificar cruce con horario de almuerzo
        const [lunchStartH, lunchStartM] = (config.lunchStart || '12:00').split(':').map(Number);
        const [lunchEndH, lunchEndM] = (config.lunchEnd || '13:00').split(':').map(Number);
        const lunchStart = lunchStartH * 60 + lunchStartM;
        const lunchEnd = lunchEndH * 60 + lunchEndM;
        const hasLunchConflict = config.lunchEnabled && (hours * 60 + minutes < lunchEnd && endMinutes > lunchStart);

        const showWarning = hasConflict || hasLunchConflict;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md">
              <div className="border-b px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Editar Servicio</h3>
                <p className="text-sm text-gray-500">{editServiceModal.appointment.petName || editServiceModal.appointment.pet_name}</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const newServiceId = formData.get('serviceId') as string;
                  const newService = services.find(s => s.id === newServiceId);
                  const isAdditional = formData.get('additionalService') === 'true';
                  const recoveryTime = formData.get('recoveryTime') ? parseInt(formData.get('recoveryTime') as string) : 0;

                  const updatedAppointment = {
                    ...editServiceModal.appointment,
                    serviceId: newServiceId,
                    serviceName: newService?.name || 'Baño y corte',
                    baseTimeMinutes: newService?.duration || 45,
                    additionalService: isAdditional,
                    recoveryTime: recoveryTime,
                  };

                  setAppointments(appointments.map(a => a.id === updatedAppointment.id ? updatedAppointment : a));
                  setEditServiceModal(null);
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Servicio</label>
                  <div className="space-y-2">
                    {services.filter(s => s.active).map(service => (
                      <label key={service.id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-[#FAFAF8]">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="serviceId"
                            value={service.id}
                            defaultChecked={editServiceModal.serviceId === service.id}
                            className="text-[#E8943D]"
                          />
                          <div>
                            <p className="font-medium text-sm">{service.emoji} {service.name}</p>
                            <p className="text-xs text-gray-500">{service.duration} min • Q{service.price}</p>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="additionalService"
                      defaultChecked={editServiceModal.additionalService}
                      onChange={(e) => {
                        const recoveryInput = document.getElementById('recoveryTimeInput') as HTMLInputElement;
                        if (recoveryInput) {
                          recoveryInput.disabled = !e.target.checked;
                          if (!e.target.checked) recoveryInput.value = '';
                        }
                      }}
                      className="rounded text-[#E8943D]"
                    />
                    <span>Recuperación de manto (servicio adicional)</span>
                  </label>
                  <input
                    id="recoveryTimeInput"
                    name="recoveryTime"
                    type="number"
                    defaultValue={editServiceModal.recoveryTime || ''}
                    disabled={!editServiceModal.additionalService}
                    className="mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8943D] text-sm disabled:opacity-50"
                    placeholder="Minutos adicionales"
                    min="15"
                    step="15"
                  />
                </div>

                <div className="p-3 bg-[#FAFAF8] rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Duración estimada total:</span> {totalDuration} minutos
                  </p>
                </div>

                {showWarning && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      ⚠️ El nuevo servicio dura {totalDuration} min y se cruza{hasConflict ? ' con otra cita' : ''}{hasConflict && hasLunchConflict ? ' y' : ''}{hasLunchConflict ? ' con el horario de almuerzo' : ''}. ¿Deseas continuar?
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditServiceModal(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-[#FAFAF8] transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-[#E8943D] hover:bg-[#E8943D]/90 text-white rounded-lg transition-colors">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal para mensaje personalizado */}
      {customMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Enviar mensaje a {customMessageModal.name}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Teléfono: {customMessageModal.phone}
            </p>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setCustomMessageModal(null);
                  setCustomMessage('');
                }}
                className="flex-1 px-4 py-2 border text-gray-700 rounded-lg hover:bg-[#FAFAF8] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={sendCustomMessage}
                disabled={!customMessage.trim()}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
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
