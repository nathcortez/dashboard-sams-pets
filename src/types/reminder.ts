export type ReminderType = "grooming" | "vaccine" | "deworming" | "flea" | "upcoming";

export interface GroomingReminder {
  clientWhatsapp: string;
  ownerName: string;
  petName: string;
  petBreed?: string;
  lastAppointmentDate: string; // yyyy-MM-dd
  daysSinceLastVisit: number;
  reminderSent: boolean;
  reminderSentAt?: string;
  reminderLogId?: string;
}

export interface HealthReminder {
  id: string;
  clientWhatsapp: string;
  ownerName: string;
  petName: string;
  type: "vaccine" | "deworming" | "flea";
  lastDate: string;
  nextDate: string;
  intervalDays: number;
  notes?: string;
  daysUntilDue: number; // negativo = ya venció
  reminderSent: boolean;
  reminderSentAt?: string;
}

export interface UpcomingAppointmentReminder {
  id: string;
  clientWhatsapp: string;
  ownerName: string;
  petName: string;
  petBreed?: string;
  date: string;
  time: string;
  daysUntil: number; // 0=hoy, 1=mañana, 2=pasado...
  reminderSent: boolean;
  reminderSentAt?: string;
}

export interface ReminderLog {
  id: string;
  clientWhatsapp: string;
  petName: string;
  ownerName?: string;
  reminderType: ReminderType;
  sentAt: string;
}
