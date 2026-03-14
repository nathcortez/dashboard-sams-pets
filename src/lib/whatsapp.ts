import { Appointment, BUSINESS_INFO } from "@/types/appointment";

export function generateWhatsAppReminder(appointment: Appointment): string {
  const petName = appointment.petName || appointment.pet_name || "";
  const ownerName = appointment.ownerName || appointment.owner_name || "";
  const whatsapp = appointment.whatsapp || "";
  const { date, time } = appointment;

  const formattedDate = new Date(date).toLocaleDateString("es-GT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const message = `*Recordatorio de Cita - Sam's Pets* 🐾

¡Hola ${ownerName}! 👋

Te recordamos tu cita para mañana:
📅 ${formattedDate}
⏰ ${time}
🐕 Mascota: ${petName}

¡Te esperamos! 🐾

📍 El Progreso, Jutiapa — Calle salida a Jalapa, edificio La Casa del Agricultor

Si necesitas cancelar o reprogramar, contáctanos con anticipación.`;

  const encodedMessage = encodeURIComponent(message);
  const phone = whatsapp.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodedMessage}`;
}
