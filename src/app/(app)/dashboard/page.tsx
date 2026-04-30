import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Wrench, CheckCircle2, AlertTriangle } from 'lucide-react';

const stats = [
  { label: 'Equipos registrados', value: 12, icon: Truck },
  { label: 'Mantenciones pendientes', value: 4, icon: Wrench },
  { label: 'Mantenciones completadas', value: 8, icon: CheckCircle2 },
  { label: 'Alertas activas', value: 2, icon: AlertTriangle },
];

const recentActivity = [
  { title: 'Equipo agregado', desc: 'Se registró una nueva excavadora.' },
  { title: 'Mantención actualizada', desc: 'Se cambió el estado a pendiente.' },
  { title: 'Alerta generada', desc: 'Equipo requiere revisión preventiva.' },
];

const upcomingMaintenance = [
  { equipo: 'Camión tolva', tipo: 'Cambio de aceite', estado: 'Pendiente' },
  { equipo: 'Excavadora', tipo: 'Revisión hidráulica', estado: 'Pendiente' },
  { equipo: 'Grúa horquilla', tipo: 'Inspección general', estado: 'Programada' },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bienvenida a Trackt</h1>
        <p className="text-muted-foreground">
          Resumen general del estado de equipos, mantenciones y alertas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{s.label}</CardDescription>
              <s.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {recentActivity.map((a, i) => (
              <div key={i} className="border-b last:border-0 pb-3 last:pb-0">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mantenciones próximas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {upcomingMaintenance.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0"
              >
                <div>
                  <p className="font-medium">{m.equipo}</p>
                  <p className="text-sm text-muted-foreground">{m.tipo}</p>
                </div>
                <Badge variant={m.estado === 'Programada' ? 'default' : 'secondary'}>
                  {m.estado}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
