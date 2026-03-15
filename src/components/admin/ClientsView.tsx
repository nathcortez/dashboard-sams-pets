'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Pet {
  id: string;
  name: string;
  breed?: string;
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
  pets: Pet[];
}

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, whatsapp')
        .order('name');

      const { data: petsData } = await supabase
        .from('pets')
        .select('id, client_id, name, breed');

      const mapped: Client[] = (clientsData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        pets: (petsData || [])
          .filter((p: any) => p.client_id === c.id)
          .map((p: any) => ({ id: p.id, name: p.name, breed: p.breed })),
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
              onClick={() => setExpanded(expanded === client.id ? null : client.id)}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#FFF4EA' }}>
                <span className="text-lg">👤</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: '#1B3A5C' }}>{client.name}</p>
                <p className="text-sm" style={{ color: '#6B6B6B' }}>
                  {client.pets.length} mascota{client.pets.length !== 1 ? 's' : ''}
                </p>
              </div>
              <span style={{ color: '#6B6B6B' }}>{expanded === client.id ? '▲' : '▼'}</span>
            </div>

            {/* Botón eliminar cliente */}
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
          {expanded === client.id && (
            <div className="border-t px-4 py-3 space-y-2" style={{ backgroundColor: '#F8F7F4', borderColor: '#E8E4DC' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6B6B6B' }}>
                Mascotas
              </p>
              {client.pets.length === 0 ? (
                <p className="text-sm italic" style={{ color: '#9CA3AF' }}>Sin mascotas registradas</p>
              ) : (
                client.pets.map((pet) => (
                  <div key={pet.id} className="bg-white rounded-xl border p-3 space-y-2" style={{ borderColor: '#E8E4DC' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🐾</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#1B3A5C' }}>{pet.name}</p>
                        {pet.breed && <p className="text-xs" style={{ color: '#6B6B6B' }}>{pet.breed}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePet(pet.id, pet.name, client.id)}
                      className="w-full py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E5E7EB')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                    >
                      🗑️ Eliminar registro
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
