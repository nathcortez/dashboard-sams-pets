'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { TIME_SLOTS } from '@/types/appointment';

interface ExistingAppointment {
  id: string;
  date: string;
  time: string;
  base_time_minutes?: number;
  service_additional_time?: number;
  recovery_time?: number;
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
}

interface Pet {
  id: string;
  clientId: string;
  name: string;
  breed: string;
}

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedDate?: Date | null;
}

export default function NewAppointmentModal({ isOpen, onClose, onSuccess, selectedDate }: NewAppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ownerName, setOwnerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [existingClient, setExistingClient] = useState<Client | null>(null);
  const [clientPets, setClientPets] = useState<Pet[]>([]);

  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [selectedPetId, setSelectedPetId] = useState<string>('');

  const [time, setTime] = useState('08:00');
  const [comments, setComments] = useState('');
  const [additionalService, setAdditionalService] = useState(false);
  const [dayAppointments, setDayAppointments] = useState<ExistingAppointment[]>([]);

  // Cargar citas del día cuando cambia selectedDate
  useEffect(() => {
    const fetchDayAppointments = async () => {
      if (!selectedDate) {
        setDayAppointments([]);
        return;
      }

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('appointments')
        .select('id, date, time, base_time_minutes, service_additional_time, recovery_time')
        .eq('date', dateStr)
        .neq('status', 'cancelada');

      setDayAppointments(data || []);
    };

    fetchDayAppointments();
  }, [selectedDate]);

  // Resetear hora cuando cambia additionalService (afecta duración)
  useEffect(() => {
    setTime('08:00');
  }, [additionalService]);

  // Calcular duración total de una cita existente
  const getAppointmentDuration = (apt: ExistingAppointment): number => {
    const base = apt.base_time_minutes || 45;
    const service = apt.service_additional_time || 0;
    const recovery = apt.recovery_time || 0;
    return base + service + recovery;
  };

  // Obtener las horas disponibles
  const availableTimeSlots = TIME_SLOTS.filter(slot => {
    const [slotHour, slotMinute] = slot.split(':').map(Number);
    const slotStart = slotHour * 60 + slotMinute;

    // Duración por defecto de una nueva cita (45 min base + 30 min servicio = 75 min)
    const newAppointmentDuration = additionalService ? 120 : 75;
    const slotEnd = slotStart + newAppointmentDuration;

    // Verificar si este slot se overlapa con alguna cita existente
    const isOccupied = dayAppointments.some(apt => {
      const [aptHour, aptMinute] = apt.time.split(':').map(Number);
      const aptStart = aptHour * 60 + aptMinute;
      const aptDuration = getAppointmentDuration(apt);
      const aptEnd = aptStart + aptDuration;

      // Verificar superposición
      return (slotStart < aptEnd && slotEnd > aptStart);
    });

    return !isOccupied;
  });

  useEffect(() => {
    const searchClient = async () => {
      if (whatsapp.length >= 4) {
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('whatsapp', whatsapp)
          .maybeSingle();

        if (data) {
          setExistingClient(data);
          setOwnerName(data.name);
          const { data: pets } = await supabase
            .from('pets')
            .select('*')
            .eq('client_id', data.id);
          setClientPets(pets || []);
        } else {
          setExistingClient(null);
          setClientPets([]);
          setOwnerName('');
        }
      }
    };

    const timeoutId = setTimeout(searchClient, 500);
    return () => clearTimeout(timeoutId);
  }, [whatsapp]);

  useEffect(() => {
    if (selectedPetId && clientPets.length > 0) {
      const pet = clientPets.find(p => p.id === selectedPetId);
      if (pet) {
        setPetName(pet.name);
        setPetBreed(pet.breed || '');
      }
    }
  }, [selectedPetId, clientPets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let clientId = existingClient?.id;

      if (!clientId) {
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({ name: ownerName, whatsapp })
          .select()
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      let petId;

      const { data: existingPet } = await supabase
        .from('pets')
        .select('id')
        .eq('client_id', clientId)
        .eq('name', petName)
        .maybeSingle();

      if (existingPet) {
        petId = existingPet.id;
      } else {
        const { data: newPet, error: petError } = await supabase
          .from('pets')
          .insert({ client_id: clientId, name: petName, breed: petBreed })
          .select()
          .single();

        if (petError) throw petError;
        petId = newPet.id;
      }

      const { error: aptError } = await supabase
        .from('appointments')
        .insert({
          pet_name: petName,
          pet_breed_age: petBreed,
          owner_name: ownerName,
          whatsapp,
          comments,
          additional_service: additionalService,
          date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
          time,
          status: 'pendiente',
        });

      if (aptError) throw aptError;

      onSuccess();
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Error al guardar la cita');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setOwnerName('');
    setWhatsapp('');
    setExistingClient(null);
    setClientPets([]);
    setPetName('');
    setPetBreed('');
    setSelectedPetId('');
    setTime('08:00');
    setComments('');
    setAdditionalService(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[--azul-oscuro]">Nueva Cita</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
          )}

          {existingClient && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
              Cliente existente encontrado. Sus mascotas han sido cargadas.
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-medium text-[--azul-oscuro] text-sm uppercase tracking-wide">Datos del Cliente</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
              <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="502 1234 5678" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente *</label>
              <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre completo" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent" required />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-[--azul-oscuro] text-sm uppercase tracking-wide">Datos de la Mascota</h3>
            {clientPets.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar mascota existente</label>
                <select value={selectedPetId} onChange={(e) => setSelectedPetId(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent">
                  <option value="">-- Nueva mascota --</option>
                  {clientPets.map((pet) => (
                    <option key={pet.id} value={pet.id}>{pet.name} {pet.breed ? `(${pet.breed})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Mascota *</label>
              <input type="text" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Nombre del perro" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raza *</label>
              <input type="text" value={petBreed} onChange={(e) => setPetBreed(e.target.value)} placeholder="Raza del perro" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent" required />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-[--azul-oscuro] text-sm uppercase tracking-wide">Datos de la Cita</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700">
                  {selectedDate
                    ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }).charAt(0).toUpperCase() + format(selectedDate, "EEEE d 'de' MMMM", { locale: es }).slice(1)
                    : 'Sin fecha'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora *</label>
                {availableTimeSlots.length === 0 ? (
                  <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm">
                    No hay horarios disponibles para este día
                  </div>
                ) : (
                  <select value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent" required>
                    <option value="">Seleccionar hora</option>
                    {availableTimeSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={additionalService} onChange={(e) => setAdditionalService(e.target.checked)} className="w-4 h-4 text-[--azul-principal] rounded focus:ring-[--azul-principal]" />
                <span className="text-sm text-gray-700">Servicio adicional</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Observaciones adicionales..." rows={2} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[--azul-principal] focus:border-transparent resize-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 px-4 bg-[--azul-principal] text-white font-medium rounded-xl hover:bg-[--azul-oscuro] transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
