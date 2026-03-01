'use client';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

export default function StatsCard({ title, value, icon, color }: StatsCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-[--azul-principal]/10 text-[--azul-principal]',
    green: 'bg-[--verde-limon]/20 text-[--verde-limon]',
    orange: 'bg-[--naranja]/10 text-[--naranja]',
    yellow: 'bg-[--amarillo]/20 text-[--amarillo]',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[--gris]">{title}</p>
          <p className="text-3xl font-bold text-[--azul-oscuro] mt-1">{value}</p>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
