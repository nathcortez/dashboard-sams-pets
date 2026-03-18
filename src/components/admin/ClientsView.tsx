'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const PET_OBSERVATION_TAGS = [
  { id: 'alergia', label: 'Alergia', emoji: '🤧' },
  { id: 'problema_piel', label: 'Problema de piel', emoji: '🔴' },
  { id: 'nudos_extremos', label: 'Nudos extremos', emoji: '🪢' },
  { id: 'bajo_peso', label: 'Bajo de peso', emoji: '⚖️' },
  { id: 'pulgas', label: 'Pulgas frecuentes', emoji: '🦟' },
  { id: 'agresivo', label: 'Agresivo', emoji: '😤' },
  { id: 'miedoso', label: 'Miedoso', emoji: '😨' },
  { id: 'oidos', label: 'Problemas de oídos', emoji: '👂' },
];

interface Pet {
  id: string;
  name: string;
  breed?: string;
  food?: string;
  observations?: string[];
  petNotes?: string;
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
  pets: Pet[];
}

interface PetProfileEditorProps {
  pet: Pet;
  onSave: (updated: Partial<Pet>) => void;
  onCancel: () => void;
}

function PetProfileEditor({ pet, onSave, onCancel }: PetProfileEditorProps) {
  const [food, setFood] = useState(pet.food || '');
  const [obs, setObs] = useState<string[]>(pet.observations || []);
  const [notes, setNotes] = useState(pet.petNotes || '');
  const [saving, setSaving] = useState(false);

  const toggleObs = (id: string) =>
    setObs((prev) => prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('pets').update({
        food: food || null,
        observations: obs.length > 0 ? obs : null,
        pet_notes: notes || null,
      }).eq('id', pet.id);
      onSave({ food, observations: obs, petNotes: notes });
    } catch (err) {
      console.error('Error guardando ficha:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: '#E8E4DC' }}>
      {/* Alimento */}
      <div>
        <label className="text-xs font-semibold block mb-1" style={{ color: '#6B6B6B' }}>🍖 Alimento que consume</label>
        <input
          type="text"
          value={food}
          onChange={(e) => setFood(e.target.value)}
          placeholder="Ej: Royal Canin, pollo y arroz..."
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none"
          style={{ borderColor: '#E5E7EB' }}
        />
      </div>

      {/* Observaciones */}
      <div>
        <label className="text-xs font-semibold block mb-2" style={{ color: '#6B6B6B' }}>⚠️ Observaciones</label>
        <div className="flex flex-wrap gap-1.5">
          {PET_OBSERVATION_TAGS.map((tag) => {
            const active = obs.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleObs(tag.id)}
                className="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
                style={{
                  borderColor: active ? '#E8943D' : '#E5E7EB',
                  backgroundColor: active ? '#FFF4EA' : '#F9FAFB',
                  color: active ? '#E8943D' : '#6B7280',
                }}
              >
                {tag.emoji} {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs font-semibold block mb-1" style={{ color: '#6B6B6B' }}>📝 Notas adicionales</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Medicamentos, comportamiento especial, preferencias del dueño..."
          rows={2}
          className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none"
          style={{ borderColor: '#E5E7EB' }}
        />
      </div>

      {/* Botones */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-xs font-medium"
          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: '#E8943D' }}
        >
          {saving ? 'Guardando...' : '💾 Guardar ficha'}
        </button>
      </div>
    </div>
  );
}

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [editingPet, setEditingPet] = useState<string | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, whatsapp')
        .order('name');

      const { data: petsData } = await supabase
        .from('pets')
        .select('id, client_id, name, breed, food, observations, pet_notes');

      const mapped: Client[] = (clientsData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        pets: (petsData || [])
          .filter((p: any) => p.client_id === c.id)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            breed: p.breed,
            food: p.food,
            observations: p.observations || [],
            petNotes: p.pet_notes,
          })),
      }));

      setClients(mapped);
    } catch (err) {
      console.error('Error cargando clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const deleteClient = async (clientId: string, name: string) => {
    if (!window.confirm(`¿Eliminar al cliente ${name} y todas sus mascotas? Esta acción no se puede deshacer.`)) return;
    await supabase.from('pets').delete().eq('client_id', clientId);
    await supabase.from('clients').delete().eq('id', clientId);
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const deletePet = async (petId: string, petName: string, clientId: string) => {
    if (!window.confirm(`¿Eliminar a ${petName}? Esta acción no se puede deshacer.`)) return;
    await supabase.from('pets').delete().eq('id', petId);
    setClients((prev) => prev.map((c) =>
      c.id === clientId ? { ...c, pets: c.pets.filter((p) => p.id !== petId) } : c
    ));
  };

  const updatePetProfile = (clientId: string, petId: string, updated: Partial<Pet>) => {
    setClients((prev) => prev.map((c) =>
      c.id !== clientId ? c : {
        ...c,
        pets: c.pets.map((p) => p.id !== petId ? p : { ...p, ...updated }),
      }
    ));
    setEditingPet(null);
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-[#E8943D] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (clients.length === 0) return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <p className="text-4xl mb-3">👥</p>
      <p style={{ color: '#6B6B6B' }}>No hay clientes registrados</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm" style={{ color: '#6B6B6B' }}>{clients.length} clientes registrados</p>
        <button onClick={fetchClients} className="text-sm" style={{ color: '#E8943D' }}>🔄 Actualizar</button>
      </div>

      {clients.map((client) => (
        <div key={client.id} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
          style={{ borderLeft: '4px solid #E8943D' }}>

          {/* Fila principal */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 cursor-pointer"
              onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FFF4EA' }}>
                <span className="text-lg">👤</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: '#1B3A5C' }}>{client.name}</p>
                <p className="text-sm" style={{ color: '#6B6B6B' }}>
                  📱 {client.whatsapp} · {client.pets.length} mascota{client.pets.length !== 1 ? 's' : ''}
                </p>
              </div>
              <span style={{ color: '#6B6B6B' }}>{expandedClient === client.id ? '▲' : '▼'}</span>
            </div>

            <button
              onClick={() => deleteClient(client.id, client.name)}
              className="w-full py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E5E7EB')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
            >
              🗑️ Eliminar registro
            </button>
          </div>

          {/* Mascotas expandibles */}
          {expandedClient === client.id && (
            <div className="border-t px-4 py-3 space-y-3" style={{ backgroundColor: '#F8F7F4', borderColor: '#E8E4DC' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6B6B6B' }}>
                Mascotas
              </p>
              {client.pets.length === 0 ? (
                <p className="text-sm italic" style={{ color: '#9CA3AF' }}>Sin mascotas registradas</p>
              ) : (
                client.pets.map((pet) => {
                  const isEditing = editingPet === pet.id;
                  const hasProfile = pet.food || (pet.observations && pet.observations.length > 0) || pet.petNotes;
                  return (
                    <div key={pet.id} className="bg-white rounded-xl border p-3" style={{ borderColor: '#E8E4DC' }}>
                      {/* Cabecera de mascota */}
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🐾</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold" style={{ color: '#1B3A5C' }}>{pet.name}</p>
                          {pet.breed && <p className="text-xs" style={{ color: '#6B6B6B' }}>{pet.breed}</p>}
                        </div>
                        <button
                          onClick={() => setEditingPet(isEditing ? null : pet.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                          style={{
                            borderColor: isEditing ? '#E8943D' : '#E5E7EB',
                            color: isEditing ? '#E8943D' : '#6B7280',
                            backgroundColor: isEditing ? '#FFF4EA' : 'transparent',
                          }}
                        >
                          {isEditing ? '✕ Cerrar' : '📋 Ficha'}
                        </button>
                      </div>

                      {/* Resumen ficha (cuando no está editando) */}
                      {!isEditing && hasProfile && (
                        <div className="mt-2 pt-2 border-t space-y-1" style={{ borderColor: '#F3F4F6' }}>
                          {pet.food && (
                            <p className="text-xs" style={{ color: '#6B6B6B' }}>
                              🍖 <span className="font-medium">Alimento:</span> {pet.food}
                            </p>
                          )}
                          {pet.observations && pet.observations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {pet.observations.map((obsId) => {
                                const tag = PET_OBSERVATION_TAGS.find((t) => t.id === obsId);
                                return tag ? (
                                  <span key={obsId} className="px-2 py-0.5 rounded-full text-xs"
                                    style={{ backgroundColor: '#FFF4EA', color: '#E8943D' }}>
                                    {tag.emoji} {tag.label}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                          {pet.petNotes && (
                            <p className="text-xs" style={{ color: '#6B6B6B' }}>
                              📝 {pet.petNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Editor de ficha */}
                      {isEditing && (
                        <PetProfileEditor
                          pet={pet}
                          onSave={(updated) => updatePetProfile(client.id, pet.id, updated)}
                          onCancel={() => setEditingPet(null)}
                        />
                      )}

                      {/* Eliminar mascota */}
                      {!isEditing && (
                        <button
                          onClick={() => deletePet(pet.id, pet.name, client.id)}
                          className="mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E5E7EB')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                        >
                          🗑️ Eliminar registro
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
