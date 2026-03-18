export type AppointmentStatus = 'pendiente' | 'confirmada' | 'completada' | 'cancelada';

export interface RescheduleEntry {
  from: string;
  to: string;
  date: string;
}

export interface Appointment {
  // Propiedades principales
  id: string;
  createdAt?: string;
  created_at?: string;
  petName?: string;
  pet_name?: string;
  petBreedAge?: string;
  pet_breed_age?: string;
  petBreed?: string;
  pet_breed?: string;
  petBreedEmoji?: string;
  pet_breed_emoji?: string;
  petSize?: string;
  pet_size?: string;
  baseTimeMinutes?: number;
  base_time_minutes?: number;
  serviceId?: string;
  service_id?: string;
  serviceName?: string;
  service_name?: string;
  serviceAdditionalTime?: number;
  service_additional_time?: number;
  recoveryTime?: number;
  recovery_time?: number;
  petPhoto?: string;
  pet_photo_url?: string;
  ownerName?: string;
  owner_name?: string;
  whatsapp?: string;
  comments?: string;
  additionalService?: boolean;
  additional_service?: boolean;
  date: string;
  time: string;
  status: AppointmentStatus;
  originalDate?: string;
  original_date?: string;
  rescheduleHistory?: RescheduleEntry[];
  reschedule_history?: RescheduleEntry[];
  // Reporte post-grooming
  groomingStatus?: 'excelente' | 'bueno' | 'regular' | 'con_incidencias';
  groomingTags?: string[];
  groomingNotes?: string;
  groomingCompletedAt?: string;
}

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  instagram: string;
  location: string;
  whatsappNumber: string;
}

export const BUSINESS_INFO: BusinessInfo = {
  name: "Sam's Pets",
  address: 'El Progreso Jutiapa',
  phone: '+502 4903-7428',
  instagram: '@samspets_shop',
  location: 'El Progreso, Jutiapa',
  whatsappNumber: '50249037428',
};

export const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00'
];
