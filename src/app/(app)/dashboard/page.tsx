import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Truck,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  ShieldCheck,
} from 'lucide-react';
import { OverviewChart } from './overview-chart';
import { apiGet, type ApiHealth, type ApiMe, type DbMessage } from '@/lib/api';

const stats = [
  {
    label: 'Equipos registrados',
    value: '12',
    delta: '+2 desde el mes pasado',
    icon: Truck,
  },
  {
    label: 'Mantenciones pendientes',
    value: '4',
    delta: '+1 esta semana',
    icon: Wrench,
  },
  {
    label: 'Mantenciones completadas',
    value: '8',
    delta: '+3 desde el mes pasado',
    icon: CheckCircle2,
  },
  {
    label: 'Alertas activas',
    value: '2',
    delta: '-1 desde ayer',
    icon: AlertTriangle,
  },
];

const recentSales = [
  { name: 'Camión tolva CAT 770G', email: 'Cambio de aceite', amount: 'Pendiente' },
  { name: 'Excavadora CAT 320', email: 'Revisión hidráulica', amount: 'Pendiente' },
  { name: 'Grúa horquilla Hyster', email: 'Inspección general', amount: 'Programada' },
  { name: 'Cargador frontal 950M', email: 'Cambio de filtros', amount: 'Programada' },
  { name: 'Retroexcavadora 420F', email: 'Engrase general', amount: 'Pendiente' },
];

export default async function DashboardPage() {
  const [health, me, messages] = await Promise.all([
    apiGet<ApiHealth>('/'),
    apiGet<ApiMe>('/me', true),
    apiGet<DbMessage[]>('/messages'),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen general del estado de equipos, mantenciones y alertas.
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vista general</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones</TabsTrigger>
          <TabsTrigger value="analytics" disabled>
            Analítica
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {s.label}
                  </CardTitle>
                  <s.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <p className="text-xs text-muted-foreground">{s.delta}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Vista general</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <Suspense>
                  <OverviewChart />
                </Suspense>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Mantenciones próximas</CardTitle>
                <CardDescription>
                  Hay 5 mantenciones programadas o pendientes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {recentSales.map((s) => (
                    <div key={s.name} className="flex items-center gap-4">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {s.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">
                          {s.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.email}
                        </p>
                      </div>
                      <div className="text-sm font-medium">{s.amount}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Server className="size-4" />
                  API (Railway)
                </CardTitle>
                <Badge variant={health ? 'default' : 'destructive'}>
                  {health ? 'Online' : 'Offline'}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Respuesta de <code>GET /</code>:
                </p>
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                  {health ? JSON.stringify(health, null, 2) : 'Sin respuesta'}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  JWT Auth (/me)
                </CardTitle>
                <Badge variant={me ? 'default' : 'destructive'}>
                  {me ? 'Autenticado' : 'Sin token'}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Endpoint protegido por <code>AuthGuard</code>:
                </p>
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
                  {me ? JSON.stringify(me, null, 2) : 'Sin respuesta'}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="size-4" />
                  Supabase DB
                </CardTitle>
                <Badge variant={messages ? 'default' : 'destructive'}>
                  {messages ? `${messages.length} filas` : 'Sin datos'}
                </Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Tabla <code>messages</code> vía API:
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {messages && messages.length > 0 ? (
                    messages.map((m) => (
                      <div key={m.id} className="text-xs border rounded p-2">
                        <p className="font-medium">{m.text}</p>
                        <p className="text-muted-foreground">
                          {new Date(m.created_at).toLocaleString('es-CL')}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin filas</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
