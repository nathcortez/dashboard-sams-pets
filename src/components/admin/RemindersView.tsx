'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GroomingReminder, HealthReminder, UpcomingAppointmentReminder, ReminderType } from '@/types/reminder';
import { differenceInDays, parseISO, format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

type ReminderTab = 'grooming' | 'vaccine' | 'deworming' | 'flea' | 'upcoming';

const generateReminderMessage = (type: ReminderType, ownerName: string, petName: string, daysOrDate: number | string) => {
  if (type === 'grooming') {
    return `¡Hola ${ownerName}! 🐾

Notamos que *${petName}* ya tiene *${daysOrDate} días* desde su último baño o corte en Sam's Pets.

¡Es hora de que ${petName} luzca increíble de nuevo! ✂️🛁

¿Te gustaría agendar una nueva cita?

📅 Agenda aquí: https://sams-pets-citas.vercel.app

_Sam's Pets — El Progreso, Jutiapa_
📞 +502 4903-7428`;
  }
  if (type === 'vaccine') {
    return `¡Hola ${ownerName}! 💉

Te recordamos que *${petName}* tiene su próxima *vacuna* programada para el *${daysOrDate}*.

¡Mantener al día las vacunas de tu mascota es muy importante para su salud! 🐕

Si necesitas más información, estamos aquí para ayudarte.

_Sam's Pets — El Progreso, Jutiapa_
📞 +502 4903-7428`;
  }
  if (type === 'flea') {
    return `¡Hola ${ownerName}! 🦟

Te recordamos que *${petName}* tiene su próxima aplicación de *antipulgas* para el *${daysOrDate}*.

Mantener a tu mascota libre de pulgas es clave para su bienestar. 🐕✨

_Sam's Pets — El Progreso, Jutiapa_
📞 +502 4903-7428`;
  }
  if (type === 'upcoming') {
    return `¡Hola ${ownerName}! 📅

Te recordamos que *${petName}* tiene una cita de grooming en Sam's Pets el *${daysOrDate}*.

¡Te esperamos! ✂️🐾

Si necesitas cambiar la cita, contáctanos:
📞 +502 4903-7428

_Sam's Pets — El Progreso, Jutiapa_`;
  }
  return `¡Hola ${ownerName}! 💊

Te recordamos que *${petName}* necesita su próxima *desparasitación* para el *${daysOrDate}*.

La desparasitación regular protege a tu mascota y a toda tu familia. 🐕❤️

_Sam's Pets — El Progreso, Jutiapa_
📞 +502 4903-7428`;
};

const formatPhone = (phone: string) => phone.replace(/[^0-9]/g, '');

export default function RemindersView() {
  const [activeTab, setActiveTab] = useState<ReminderTab>('grooming');
  const [loading, setLoading] = useState(true);
  const [intervalDays, setIntervalDays] = useState(30);

  // Grooming state
  const [groomingReminders, setGroomingReminders] = useState<GroomingReminder[]>([]);

  // Health state
  const [healthReminders, setHealthReminders] = useState<HealthReminder[]>([]);

  // Upcoming appointments state
  const [upcomingReminders, setUpcomingReminders] = useState<UpcomingAppointmentReminder[]>([]);
  const [upcomingDays, setUpcomingDays] = useState(3);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: '',
    clientWhatsapp: '',
    petName: '',
    lastDate: '',
    intervalDays: activeTab === 'vaccine' ? 365 : 90,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchGroomingReminders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('appointments')
        .select('pet_name, pet_breed, owner_name, whatsapp, date, status')
        .neq('status', 'cancelada')
        .order('date', { ascending: false });

      const latestByPet = new Map<string, any>();
      (data || []).forEach((apt) => {
        const key = `${apt.whatsapp}_${apt.pet_name}`;
        if (!latestByPet.has(key)) latestByPet.set(key, apt);
      });

      // Check reminder logs
      const { data: logs } = await supabase
        .from('reminder_logs')
        .select('id, client_whatsapp, pet_name, sent_at')
        .eq('reminder_type', 'grooming')
        .order('sent_at', { ascending: false });

      const logMap = new Map<string, { id: string; sentAt: string }>();
      (logs || []).forEach((log) => {
        const key = `${log.client_whatsapp}_${log.pet_name}`;
        if (!logMap.has(key)) logMap.set(key, { id: log.id, sentAt: log.sent_at });
      });

      const reminders: GroomingReminder[] = [];
      latestByPet.forEach((apt) => {
        const daysSince = differenceInDays(new Date(), parseISO(apt.date));
        if (daysSince >= intervalDays) {
          const logKey = `${apt.whatsapp}_${apt.pet_name}`;
          const lastLog = logMap.get(logKey);
          const sentRecently = lastLog && differenceInDays(new Date(), parseISO(lastLog.sentAt)) < intervalDays;

          reminders.push({
            clientWhatsapp: apt.whatsapp,
            ownerName: apt.owner_name || '',
            petName: apt.pet_name || '',
            petBreed: apt.pet_breed || '',
            lastAppointmentDate: apt.date,
            daysSinceLastVisit: daysSince,
            reminderSent: !!sentRecently,
            reminderSentAt: sentRecently ? lastLog?.sentAt : undefined,
            reminderLogId: sentRecently ? lastLog?.id : undefined,
          });
        }
      });

      reminders.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
      setGroomingReminders(reminders);
    } catch (err) {
      console.error('Error fetching grooming reminders:', err);
    } finally {
      setLoading(false);
    }
  }, [intervalDays]);

  const fetchUpcomingReminders = useCallback(async () => {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const future = format(addDays(new Date(), upcomingDays), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('appointments')
        .select('id, pet_name, pet_breed, owner_name, whatsapp, date, time, status')
        .gte('date', today)
        .lte('date', future)
        .neq('status', 'cancelada')
        .neq('status', 'completada')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      const { data: logs } = await supabase
        .from('reminder_logs')
        .select('id, client_whatsapp, pet_name, sent_at')
        .eq('reminder_type', 'upcoming')
        .order('sent_at', { ascending: false });

      const logMap = new Map<string, { id: string; sentAt: string }>();
      (logs || []).forEach((log) => {
        const key = `${log.client_whatsapp}_${log.pet_name}`;
        if (!logMap.has(key)) logMap.set(key, { id: log.id, sentAt: log.sent_at });
      });

      const reminders: UpcomingAppointmentReminder[] = (data || []).map((row: any) => {
        const daysUntil = differenceInDays(parseISO(row.date), new Date());
        const logKey = `${row.whatsapp}_${row.pet_name}`;
        const lastLog = logMap.get(logKey);
        const sentRecently = lastLog && differenceInDays(new Date(), parseISO(lastLog.sentAt)) < 1;
        return {
          id: row.id,
          clientWhatsapp: row.whatsapp,
          ownerName: row.owner_name || '',
          petName: row.pet_name || '',
          petBreed: row.pet_breed,
          date: row.date,
          time: row.time,
          daysUntil,
          reminderSent: !!sentRecently,
          reminderSentAt: sentRecently ? lastLog?.sentAt : undefined,
        };
      });

      setUpcomingReminders(reminders);
    } catch (err) {
      console.error('Error fetching upcoming reminders:', err);
    } finally {
      setLoading(false);
    }
  }, [upcomingDays]);

  const fetchHealthReminders = useCallback(async (type: 'vaccine' | 'deworming' | 'flea') => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('pet_health')
        .select('*')
        .eq('type', type)
        .order('next_date', { ascending: true });

      const { data: logs } = await supabase
        .from('reminder_logs')
        .select('id, client_whatsapp, pet_name, sent_at')
        .eq('reminder_type', type)
        .order('sent_at', { ascending: false });

      const logMap = new Map<string, { id: string; sentAt: string }>();
      (logs || []).forEach((log) => {
        const key = `${log.client_whatsapp}_${log.pet_name}`;
        if (!logMap.has(key)) logMap.set(key, { id: log.id, sentAt: log.sent_at });
      });

      const reminders: HealthReminder[] = (data || []).map((row) => {
        const daysUntilDue = differenceInDays(parseISO(row.next_date), new Date());
        const logKey = `${row.client_whatsapp}_${row.pet_name}`;
        const lastLog = logMap.get(logKey);
        const sentRecently = lastLog && differenceInDays(new Date(), parseISO(lastLog.sentAt)) < 30;

        return {
          id: row.id,
          clientWhatsapp: row.client_whatsapp,
          ownerName: row.owner_name,
          petName: row.pet_name,
          type: row.type,
          lastDate: row.last_date,
          nextDate: row.next_date,
          intervalDays: row.interval_days,
          notes: row.notes,
          daysUntilDue,
          reminderSent: !!sentRecently,
          reminderSentAt: sentRecently ? lastLog?.sentAt : undefined,
        };
      });

      setHealthReminders(reminders);
    } catch (err) {
      console.error('Error fetching health reminders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'grooming') {
      fetchGroomingReminders();
    } else if (activeTab === 'upcoming') {
      fetchUpcomingReminders();
    } else {
      fetchHealthReminders(activeTab as 'vaccine' | 'deworming' | 'flea');
    }
  }, [activeTab, fetchGroomingReminders, fetchHealthReminders, fetchUpcomingReminders]);

  const sendReminder = async (
    type: ReminderType,
    phone: string,
    ownerName: string,
    petName: string,
    daysOrDate: number | string
  ) => {
    const message = generateReminderMessage(type, ownerName, petName, daysOrDate);
    const cleanPhone = formatPhone(phone);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');

    await supabase.from('reminder_logs').insert({
      client_whatsapp: phone,
      pet_name: petName,
      owner_name: ownerName,
      reminder_type: type,
    });

    // Update local state
    if (type === 'grooming') {
      setGroomingReminders((prev) =>
        prev.map((r) =>
          r.clientWhatsapp === phone && r.petName === petName
            ? { ...r, reminderSent: true, reminderSentAt: new Date().toISOString() }
            : r
        )
      );
    } else {
      setHealthReminders((prev) =>
        prev.map((r) =>
          r.clientWhatsapp === phone && r.petName === petName
            ? { ...r, reminderSent: true, reminderSentAt: new Date().toISOString() }
            : r
        )
      );
    }
  };

  const handleAddHealth = async () => {
    if (!formData.ownerName || !formData.clientWhatsapp || !formData.petName || !formData.lastDate) return;
    setSaving(true);
    setSaveError(null);
    try {
      const nextDate = format(addDays(parseISO(formData.lastDate), formData.intervalDays), 'yyyy-MM-dd');
      const { error } = await supabase.from('pet_health').insert({
        client_whatsapp: formData.clientWhatsapp,
        owner_name: formData.ownerName,
        pet_name: formData.petName,
        type: activeTab,
        last_date: formData.lastDate,
        next_date: nextDate,
        interval_days: formData.intervalDays,
        notes: formData.notes || null,
      });
      if (error) throw error;
      setShowAddForm(false);
      setFormData({ ownerName: '', clientWhatsapp: '', petName: '', lastDate: '', intervalDays: activeTab === 'vaccine' ? 365 : activeTab === 'deworming' ? 90 : 30, notes: '' });
      fetchHealthReminders(activeTab as 'vaccine' | 'deworming' | 'flea');
    } catch (err: any) {
      console.error('Error adding health record:', err);
      const msg = err?.message || err?.details || '';
      if (msg.includes('does not exist') || msg.includes('relation')) {
        setSaveError('La tabla aún no existe en Supabase. Corre el SQL que te compartió Joaqui para crearla.');
      } else {
        setSaveError(msg || 'Error al guardar. Intenta de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteHealth = async (id: string) => {
    const confirmed = window.confirm('¿Eliminar este registro?');
    if (!confirmed) return;
    await supabase.from('pet_health').delete().eq('id', id);
    setHealthReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const getUrgencyStyle = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return { bg: '#FEF2F2', text: '#DC2626', label: `Vencida hace ${Math.abs(daysUntilDue)} días` };
    if (daysUntilDue < 7) return { bg: '#FEF2F2', text: '#DC2626', label: `En ${daysUntilDue} días` };
    if (daysUntilDue < 30) return { bg: '#FFFBEB', text: '#D97706', label: `En ${daysUntilDue} días` };
    return { bg: '#F0FDF4', text: '#15803D', label: `En ${daysUntilDue} días` };
  };

  const sendUpcomingReminder = async (r: UpcomingAppointmentReminder) => {
    const [year, month, day] = r.date.split('-').map(Number);
    const dateLabel = format(new Date(year, month - 1, day), "EEEE d 'de' MMMM", { locale: es });
    const timeLabel = r.time;
    const dateTimeLabel = `${dateLabel} a las ${timeLabel}`;
    const message = generateReminderMessage('upcoming', r.ownerName, r.petName, dateTimeLabel);
    const cleanPhone = formatPhone(r.clientWhatsapp);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');

    await supabase.from('reminder_logs').insert({
      client_whatsapp: r.clientWhatsapp,
      pet_name: r.petName,
      owner_name: r.ownerName,
      reminder_type: 'upcoming',
    });

    setUpcomingReminders((prev) =>
      prev.map((u) => u.id === r.id ? { ...u, reminderSent: true, reminderSentAt: new Date().toISOString() } : u)
    );
  };

  const tabs: { key: ReminderTab; label: string; emoji: string }[] = [
    { key: 'grooming', label: 'Grooming', emoji: '🐾' },
    { key: 'vaccine', label: 'Vacunas', emoji: '💉' },
    { key: 'deworming', label: 'Desparasitación', emoji: '💊' },
    { key: 'flea', label: 'Antipulgas', emoji: '🦟' },
  ];

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setShowAddForm(false);
            }}
            className="px-4 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap"
            style={{
              backgroundColor: activeTab === tab.key ? '#E8943D' : '#FFFFFF',
              color: activeTab === tab.key ? '#FFFFFF' : '#6B6B6B',
              border: activeTab === tab.key ? 'none' : '1px solid #E5E3DE',
            }}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-[#E8943D] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm" style={{ color: '#6B6B6B' }}>Cargando recordatorios...</p>
          </div>
        </div>
      ) : (
        <>
          {/* ===== GROOMING TAB ===== */}
          {activeTab === 'grooming' && (
            <div>
              {/* Interval config */}
              <div className="flex items-center gap-3 mb-4 bg-white rounded-xl p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <span className="text-sm font-medium" style={{ color: '#1B3A5C' }}>Recordar cada</span>
                <input
                  type="number"
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1 text-sm text-center rounded-lg border"
                  style={{ borderColor: '#E5E3DE', color: '#1B3A5C' }}
                  min={1}
                />
                <span className="text-sm" style={{ color: '#6B6B6B' }}>días</span>
                <button
                  onClick={fetchGroomingReminders}
                  className="ml-auto px-3 py-1 text-xs font-medium rounded-lg transition-colors"
                  style={{ backgroundColor: '#F3F4F6', color: '#6B6B6B' }}
                >
                  🔄 Actualizar
                </button>
              </div>

              {groomingReminders.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                  <div className="text-5xl mb-4">✨</div>
                  <p className="text-lg font-medium" style={{ color: '#1B3A5C' }}>¡Todas las mascotas están al día!</p>
                  <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>No hay mascotas con más de {intervalDays} días sin visita</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
                    {groomingReminders.length} mascota{groomingReminders.length !== 1 ? 's' : ''} necesita{groomingReminders.length !== 1 ? 'n' : ''} recordatorio
                  </p>
                  {groomingReminders.map((r) => (
                    <div
                      key={`${r.clientWhatsapp}_${r.petName}`}
                      className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                      style={{ borderLeft: '4px solid #E8943D' }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                          style={{ backgroundColor: '#FFF4EA' }}
                        >
                          🐕
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm" style={{ color: '#1B3A5C' }}>{r.petName}</h4>
                          {r.petBreed && <p className="text-xs" style={{ color: '#6B6B6B' }}>{r.petBreed}</p>}
                          <p className="text-xs" style={{ color: '#6B6B6B' }}>👤 {r.ownerName}</p>
                          <p className="text-xs mt-1 font-medium" style={{ color: r.daysSinceLastVisit > 30 ? '#DC2626' : '#D97706' }}>
                            Última visita: hace {r.daysSinceLastVisit} días
                          </p>
                          <p className="text-xs" style={{ color: '#6B6B6B' }}>
                            📅 {format(parseISO(r.lastAppointmentDate), "d 'de' MMMM, yyyy", { locale: es })}
                          </p>

                          <div className="mt-3">
                            {r.reminderSent ? (
                              <span
                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium"
                                style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}
                              >
                                ✓ Enviado el {r.reminderSentAt ? format(parseISO(r.reminderSentAt), "d MMM", { locale: es }) : ''}
                              </span>
                            ) : (
                              <button
                                onClick={() => sendReminder('grooming', r.clientWhatsapp, r.ownerName, r.petName, r.daysSinceLastVisit)}
                                className="px-4 py-2 text-xs font-semibold rounded-xl text-white transition-colors"
                                style={{ backgroundColor: '#E8943D' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D4832F')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8943D')}
                              >
                                📱 Enviar recordatorio
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== UPCOMING APPOINTMENTS TAB ===== */}
          {activeTab === 'upcoming' && (
            <div>
              <div className="flex items-center gap-3 mb-4 bg-white rounded-xl p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <span className="text-sm font-medium" style={{ color: '#1B3A5C' }}>Próximos</span>
                <input
                  type="number"
                  value={upcomingDays}
                  onChange={(e) => setUpcomingDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1 text-sm text-center rounded-lg border"
                  style={{ borderColor: '#E5E3DE' }}
                  min={1}
                  max={14}
                />
                <span className="text-sm" style={{ color: '#6B6B6B' }}>días</span>
                <button
                  onClick={fetchUpcomingReminders}
                  className="ml-auto px-3 py-1 text-xs font-medium rounded-lg"
                  style={{ backgroundColor: '#F3F4F6', color: '#6B6B6B' }}
                >
                  🔄 Actualizar
                </button>
              </div>

              {upcomingReminders.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                  <div className="text-5xl mb-4">📅</div>
                  <p className="text-lg font-medium" style={{ color: '#1B3A5C' }}>No hay citas próximas</p>
                  <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>No hay citas en los próximos {upcomingDays} días</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
                    {upcomingReminders.length} cita{upcomingReminders.length !== 1 ? 's' : ''} próxima{upcomingReminders.length !== 1 ? 's' : ''}
                  </p>
                  {upcomingReminders.map((r) => {
                    const daysLabel = r.daysUntil === 0 ? '¡Hoy!' : r.daysUntil === 1 ? 'Mañana' : `En ${r.daysUntil} días`;
                    const urgencyColor = r.daysUntil === 0 ? '#DC2626' : r.daysUntil === 1 ? '#D97706' : '#1D4ED8';
                    const urgencyBg = r.daysUntil === 0 ? '#FEF2F2' : r.daysUntil === 1 ? '#FFFBEB' : '#EFF6FF';
                    const [year, month, day] = r.date.split('-').map(Number);
                    const dateFormatted = format(new Date(year, month - 1, day), "EEEE d 'de' MMMM", { locale: es });
                    return (
                      <div key={r.id} className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                        style={{ borderLeft: `4px solid ${urgencyColor}` }}>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                            style={{ backgroundColor: urgencyBg }}>
                            🐕
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-sm" style={{ color: '#1B3A5C' }}>{r.petName}</h4>
                                {r.petBreed && <p className="text-xs" style={{ color: '#6B6B6B' }}>{r.petBreed}</p>}
                                <p className="text-xs" style={{ color: '#6B6B6B' }}>👤 {r.ownerName}</p>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0"
                                style={{ backgroundColor: urgencyBg, color: urgencyColor }}>
                                {daysLabel}
                              </span>
                            </div>
                            <p className="text-xs mt-1 capitalize" style={{ color: '#6B6B6B' }}>
                              📅 {dateFormatted} · ⏰ {r.time}
                            </p>
                            <div className="mt-3">
                              {r.reminderSent ? (
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium"
                                  style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>
                                  ✓ Recordatorio enviado hoy
                                </span>
                              ) : (
                                <button
                                  onClick={() => sendUpcomingReminder(r)}
                                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white"
                                  style={{ backgroundColor: '#E8943D' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D4832F')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8943D')}
                                >
                                  📱 Enviar recordatorio
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== VACCINE / DEWORMING / FLEA TAB ===== */}
          {(activeTab === 'vaccine' || activeTab === 'deworming' || activeTab === 'flea') && (
            <div>
              {/* Add button */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium" style={{ color: '#6B6B6B' }}>
                  {healthReminders.length} registro{healthReminders.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    setFormData({
                      ownerName: '',
                      clientWhatsapp: '',
                      petName: '',
                      lastDate: '',
                      intervalDays: activeTab === 'vaccine' ? 365 : activeTab === 'deworming' ? 90 : 30,
                      notes: '',
                    });
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white transition-colors"
                  style={{ backgroundColor: '#E8943D' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D4832F')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8943D')}
                >
                  + Agregar {activeTab === 'vaccine' ? 'vacuna' : activeTab === 'deworming' ? 'desparasitación' : 'antipulgas'}
                </button>
              </div>

              {/* Inline add form */}
              {showAddForm && (
                <div className="bg-white rounded-2xl p-4 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border" style={{ borderColor: '#E8943D' }}>
                  <h4 className="font-bold text-sm mb-3" style={{ color: '#1B3A5C' }}>
                    Nueva {activeTab === 'vaccine' ? 'vacuna' : activeTab === 'deworming' ? 'desparasitación' : 'antipulgas'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#6B6B6B' }}>
                        Nombre del dueño <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ownerName}
                        onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ borderColor: formData.ownerName ? '#4A7C59' : '#E5E3DE' }}
                        placeholder="Ej: María López"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#6B6B6B' }}>
                        WhatsApp <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.clientWhatsapp}
                        onChange={(e) => setFormData({ ...formData, clientWhatsapp: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ borderColor: formData.clientWhatsapp ? '#4A7C59' : '#E5E3DE' }}
                        placeholder="Ej: +502 1234-5678"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#6B6B6B' }}>
                        Nombre de la mascota <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.petName}
                        onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ borderColor: formData.petName ? '#4A7C59' : '#E5E3DE' }}
                        placeholder="Ej: Max"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#6B6B6B' }}>
                        Fecha de última aplicación <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.lastDate}
                        onChange={(e) => setFormData({ ...formData, lastDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ borderColor: formData.lastDate ? '#4A7C59' : '#E5E3DE' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#6B6B6B' }}>Próxima en (días)</label>
                      <input
                        type="number"
                        value={formData.intervalDays}
                        onChange={(e) => setFormData({ ...formData, intervalDays: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ borderColor: '#E5E3DE' }}
                        min={1}
                      />
                      {formData.lastDate && formData.intervalDays > 0 && (
                        <p className="text-xs mt-1" style={{ color: '#6B6B6B' }}>
                          → {format(addDays(parseISO(formData.lastDate), formData.intervalDays), "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: '#6B6B6B' }}>Notas (opcional)</label>
                      <input
                        type="text"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ borderColor: '#E5E3DE' }}
                        placeholder="Ej: Vacuna triple"
                      />
                    </div>
                  </div>

                  {/* Mensaje de campos faltantes */}
                  {(!formData.ownerName || !formData.clientWhatsapp || !formData.petName || !formData.lastDate) && (
                    <p className="text-xs mt-3 px-1" style={{ color: '#DC2626' }}>
                      ⚠️ Completa los campos marcados con <strong>*</strong> para guardar:
                      {!formData.ownerName && ' Nombre del dueño,'}
                      {!formData.clientWhatsapp && ' WhatsApp,'}
                      {!formData.petName && ' Nombre de la mascota,'}
                      {!formData.lastDate && ' Fecha de última aplicación'}
                    </p>
                  )}

                  {saveError && (
                    <div className="mt-3 p-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                      ⚠️ {saveError}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAddHealth}
                      disabled={saving || !formData.ownerName || !formData.clientWhatsapp || !formData.petName || !formData.lastDate}
                      className="px-5 py-2 text-sm font-semibold rounded-xl text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#4A7C59' }}
                      onMouseEnter={(e) => { if (!saving) e.currentTarget.style.backgroundColor = '#3D6A4B'; }}
                      onMouseLeave={(e) => { if (!saving) e.currentTarget.style.backgroundColor = '#4A7C59'; }}
                    >
                      {saving ? 'Guardando...' : '💾 Guardar'}
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-5 py-2 text-sm font-medium rounded-xl transition-colors"
                      style={{ backgroundColor: '#F3F4F6', color: '#6B6B6B' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Health list */}
              {healthReminders.length === 0 && !showAddForm ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                  <div className="text-5xl mb-4">{activeTab === 'vaccine' ? '💉' : activeTab === 'deworming' ? '💊' : '🦟'}</div>
                  <p className="text-lg font-medium" style={{ color: '#1B3A5C' }}>
                    No hay registros de {activeTab === 'vaccine' ? 'vacunas' : activeTab === 'deworming' ? 'desparasitación' : 'antipulgas'}
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>
                    Agrega el primer registro con el botón de arriba
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {healthReminders.map((r) => {
                    const urgency = getUrgencyStyle(r.daysUntilDue);
                    return (
                      <div
                        key={r.id}
                        className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                        style={{ borderLeft: `4px solid ${urgency.text}` }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                            style={{ backgroundColor: urgency.bg }}
                          >
                            {activeTab === 'vaccine' ? '💉' : activeTab === 'deworming' ? '💊' : '🦟'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-sm" style={{ color: '#1B3A5C' }}>{r.petName}</h4>
                                <p className="text-xs" style={{ color: '#6B6B6B' }}>👤 {r.ownerName}</p>
                              </div>
                              <span
                                className="px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                                style={{ backgroundColor: urgency.bg, color: urgency.text }}
                              >
                                {urgency.label}
                              </span>
                            </div>

                            <div className="mt-1.5 text-xs space-y-0.5" style={{ color: '#6B6B6B' }}>
                              <p>📅 Última: {format(parseISO(r.lastDate), "d MMM yyyy", { locale: es })}</p>
                              <p>📅 Próxima: {format(parseISO(r.nextDate), "d MMM yyyy", { locale: es })}</p>
                              {r.notes && <p>📝 {r.notes}</p>}
                            </div>

                            <div className="flex items-center gap-2 mt-3">
                              {r.reminderSent ? (
                                <span
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium"
                                  style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}
                                >
                                  ✓ Enviado {r.reminderSentAt ? format(parseISO(r.reminderSentAt), "d MMM", { locale: es }) : ''}
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    const nextFormatted = format(parseISO(r.nextDate), "d 'de' MMMM, yyyy", { locale: es });
                                    sendReminder(activeTab as ReminderType, r.clientWhatsapp, r.ownerName, r.petName, nextFormatted);
                                  }}
                                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white transition-colors"
                                  style={{ backgroundColor: '#E8943D' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D4832F')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#E8943D')}
                                >
                                  📱 Enviar recordatorio
                                </button>
                              )}
                              <button
                                onClick={() => deleteHealth(r.id)}
                                className="px-3 py-2 text-xs font-medium rounded-xl transition-colors"
                                style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEE2E2')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
