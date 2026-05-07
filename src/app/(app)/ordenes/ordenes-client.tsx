"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Download,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | "Creada"
  | "En evaluacion"
  | "Pendiente por stock"
  | "En ejecucion"
  | "En validacion"
  | "Cerrada";

type Priority = "Alta" | "Media" | "Baja";

type Order = {
  id: string;
  equipment: string;
  asset: string;
  status: Status;
  responsible: string;
  initials: string;
  priority: Priority;
  sla: string;
  slaState: "ok" | "warn" | "danger";
  updated: string;
  type: string;
  created: string;
};

const orders: Order[] = [
  {
    id: "OT-10482",
    equipment: "Camion CAT 797F",
    asset: "Flota 12 - Mina Norte",
    status: "En ejecucion",
    responsible: "M. Castillo",
    initials: "MC",
    priority: "Alta",
    sla: "04:12 h",
    slaState: "ok",
    updated: "hace 6 min",
    type: "Correctiva",
    created: "24 abr - 06:12",
  },
  {
    id: "OT-10481",
    equipment: "Pala Komatsu PC8000",
    asset: "Rajo Sur",
    status: "Pendiente por stock",
    responsible: "Bodega Central",
    initials: "BC",
    priority: "Alta",
    sla: "-01:20 h",
    slaState: "danger",
    updated: "hace 22 min",
    type: "Correctiva",
    created: "24 abr - 04:40",
  },
  {
    id: "OT-10479",
    equipment: "Cargador frontal 994K",
    asset: "Patio Taller",
    status: "En validacion",
    responsible: "F. Aravena",
    initials: "FA",
    priority: "Media",
    sla: "12:40 h",
    slaState: "ok",
    updated: "hace 1 h",
    type: "Preventiva",
    created: "23 abr - 22:00",
  },
  {
    id: "OT-10478",
    equipment: "Perforadora DM45",
    asset: "Banco 3420",
    status: "En evaluacion",
    responsible: "P. Nunez",
    initials: "PN",
    priority: "Media",
    sla: "08:05 h",
    slaState: "warn",
    updated: "hace 1 h",
    type: "Predictiva",
    created: "23 abr - 20:15",
  },
  {
    id: "OT-10475",
    equipment: "Camion CAT 793D",
    asset: "Flota 04",
    status: "Creada",
    responsible: "Sin asignar",
    initials: "-",
    priority: "Baja",
    sla: "24:00 h",
    slaState: "ok",
    updated: "hace 2 h",
    type: "Inspeccion",
    created: "23 abr - 18:50",
  },
  {
    id: "OT-10472",
    equipment: "Bulldozer D11T",
    asset: "Botadero E",
    status: "Pendiente por stock",
    responsible: "Bodega Central",
    initials: "BC",
    priority: "Alta",
    sla: "00:45 h",
    slaState: "warn",
    updated: "hace 3 h",
    type: "Correctiva",
    created: "23 abr - 14:10",
  },
  {
    id: "OT-10470",
    equipment: "Motoniveladora 24M",
    asset: "Camino A1",
    status: "Cerrada",
    responsible: "R. Soto",
    initials: "RS",
    priority: "Media",
    sla: "OK",
    slaState: "ok",
    updated: "ayer",
    type: "Preventiva",
    created: "22 abr - 09:30",
  },
  {
    id: "OT-10468",
    equipment: "Camion CAT 797F",
    asset: "Flota 09",
    status: "En ejecucion",
    responsible: "J. Vega",
    initials: "JV",
    priority: "Alta",
    sla: "02:30 h",
    slaState: "warn",
    updated: "ayer",
    type: "Correctiva",
    created: "22 abr - 07:00",
  },
  {
    id: "OT-10465",
    equipment: "Pala Komatsu PC4000",
    asset: "Rajo Norte",
    status: "En ejecucion",
    responsible: "C. Henriquez",
    initials: "CH",
    priority: "Media",
    sla: "06:15 h",
    slaState: "ok",
    updated: "ayer",
    type: "Preventiva",
    created: "21 abr - 19:42",
  },
  {
    id: "OT-10463",
    equipment: "Camion CAT 785D",
    asset: "Flota 18",
    status: "En validacion",
    responsible: "L. Morales",
    initials: "LM",
    priority: "Baja",
    sla: "18:00 h",
    slaState: "ok",
    updated: "ayer",
    type: "Inspeccion",
    created: "21 abr - 12:05",
  },
  {
    id: "OT-10460",
    equipment: "Cargador 992K",
    asset: "Patio Taller",
    status: "Cerrada",
    responsible: "F. Aravena",
    initials: "FA",
    priority: "Media",
    sla: "OK",
    slaState: "ok",
    updated: "hace 2 dias",
    type: "Correctiva",
    created: "20 abr - 08:20",
  },
  {
    id: "OT-10457",
    equipment: "Perforadora Pit Viper",
    asset: "Banco 3380",
    status: "Creada",
    responsible: "Sin asignar",
    initials: "-",
    priority: "Media",
    sla: "20:00 h",
    slaState: "ok",
    updated: "hace 2 dias",
    type: "Predictiva",
    created: "20 abr - 06:00",
  },
  {
    id: "OT-10455",
    equipment: "Bulldozer D10T",
    asset: "Botadero W",
    status: "En ejecucion",
    responsible: "M. Castillo",
    initials: "MC",
    priority: "Alta",
    sla: "-00:30 h",
    slaState: "danger",
    updated: "hace 2 dias",
    type: "Correctiva",
    created: "19 abr - 22:50",
  },
  {
    id: "OT-10451",
    equipment: "Camion CAT 797F",
    asset: "Flota 21",
    status: "Pendiente por stock",
    responsible: "Bodega Central",
    initials: "BC",
    priority: "Media",
    sla: "05:45 h",
    slaState: "warn",
    updated: "hace 3 dias",
    type: "Correctiva",
    created: "19 abr - 11:00",
  },
];

const statusStyles: Record<Status, string> = {
  Creada: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  "En evaluacion": "bg-info/10 text-info ring-1 ring-inset ring-info/30",
  "Pendiente por stock":
    "bg-warning/10 text-warning ring-1 ring-inset ring-warning/30",
  "En ejecucion":
    "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30",
  "En validacion":
    "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border",
  Cerrada: "bg-success/10 text-success ring-1 ring-inset ring-success/30",
};

const statusDot: Record<Status, string> = {
  Creada: "bg-muted-foreground",
  "En evaluacion": "bg-info",
  "Pendiente por stock": "bg-warning",
  "En ejecucion": "bg-primary",
  "En validacion": "bg-secondary-foreground",
  Cerrada: "bg-success",
};

const priorityStyles: Record<Priority, string> = {
  Alta: "bg-destructive/10 text-destructive",
  Media: "bg-warning/10 text-warning",
  Baja: "bg-muted text-muted-foreground",
};

const slaStyles = {
  danger: "text-destructive",
  ok: "text-success",
  warn: "text-warning",
} as const;

type FilterKey =
  | "todas"
  | "ejecucion"
  | "stock"
  | "validacion"
  | "atrasadas"
  | "cerradas";

const filterPredicates: Record<FilterKey, (order: Order) => boolean> = {
  atrasadas: (order) => order.slaState === "danger",
  cerradas: (order) => order.status === "Cerrada",
  ejecucion: (order) => order.status === "En ejecucion",
  stock: (order) => order.status === "Pendiente por stock",
  todas: () => true,
  validacion: (order) => order.status === "En validacion",
};

const filters: { key: FilterKey; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "ejecucion", label: "En ejecucion" },
  { key: "stock", label: "Pendiente stock" },
  { key: "validacion", label: "En validacion" },
  { key: "atrasadas", label: "Atrasadas" },
  { key: "cerradas", label: "Cerradas" },
];

export function OrdenesClient() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("todas");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (!filterPredicates[activeFilter](order)) return false;
      if (!q) return true;
      return (
        order.id.toLowerCase().includes(q) ||
        order.equipment.toLowerCase().includes(q) ||
        order.asset.toLowerCase().includes(q) ||
        order.responsible.toLowerCase().includes(q)
      );
    });
  }, [activeFilter, query]);

  const counts = useMemo(
    () =>
      filters.reduce<Record<FilterKey, number>>((acc, filter) => {
        acc[filter.key] = orders.filter(filterPredicates[filter.key]).length;
        return acc;
      }, {} as Record<FilterKey, number>),
    [],
  );

  const summary = [
    {
      bg: "bg-secondary/60",
      icon: ListChecks,
      label: "Total OT",
      ring: "ring-border",
      tone: "text-foreground",
      value: orders.length,
    },
    {
      bg: "bg-primary/10",
      icon: Clock,
      label: "En ejecucion",
      ring: "ring-primary/30",
      tone: "text-primary",
      value: counts.ejecucion,
    },
    {
      bg: "bg-destructive/10",
      icon: AlertTriangle,
      label: "Atrasadas SLA",
      ring: "ring-destructive/30",
      tone: "text-destructive",
      value: counts.atrasadas,
    },
    {
      bg: "bg-success/10",
      icon: CheckCircle2,
      label: "Cerradas",
      ring: "ring-success/30",
      tone: "text-success",
      value: counts.cerradas,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Operacion - Listado completo
          </div>
          <h1 className="font-semibold text-2xl text-foreground tracking-tight">
            Ordenes de Trabajo
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Trazabilidad de OT desde creacion hasta cierre, con estados,
            responsables y control SLA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-medium text-muted-foreground text-xs hover:bg-secondary hover:text-foreground">
            <Download className="h-3.5 w-3.5" />
            Exportar
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 font-semibold text-primary-foreground text-xs hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />
            Nueva OT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <div
              className="rounded-xl border border-border bg-card p-4 shadow-xs/5"
              key={item.label}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                    {item.label}
                  </p>
                  <p className="mt-2 font-mono font-semibold text-2xl text-foreground tabular-nums">
                    {item.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset",
                    item.bg,
                    item.ring,
                  )}
                >
                  <Icon className={cn("size-4", item.tone)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-border bg-card shadow-xs/5">
        <div className="flex flex-col gap-4 border-border border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-base text-foreground tracking-tight">
              Listado de OT
            </h2>
            <p className="text-muted-foreground text-xs">
              {filtered.length} resultado{filtered.length === 1 ? "" : "s"} -
              ordenadas por fecha de creacion
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full rounded-md border border-border bg-background/60 pr-3 pl-8 text-foreground text-xs placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-72"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar OT, equipo o responsable"
                value={query}
              />
            </div>
            <button className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 font-medium text-muted-foreground text-xs hover:bg-background hover:text-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros avanzados
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-border border-b px-5 py-3">
          {filters.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium text-xs transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
                <span
                  className={cn(
                    "rounded px-1 font-semibold text-[10px] tabular-nums",
                    active
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[filter.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-border border-b text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="px-5 py-3 text-left font-semibold">
                  <button className="inline-flex items-center gap-1 hover:text-foreground">
                    ID OT <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left font-semibold">Equipo</th>
                <th className="px-5 py-3 text-left font-semibold">Tipo</th>
                <th className="px-5 py-3 text-left font-semibold">Estado</th>
                <th className="px-5 py-3 text-left font-semibold">
                  Responsable
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  Prioridad
                </th>
                <th className="px-5 py-3 text-left font-semibold">
                  <button className="inline-flex items-center gap-1 hover:text-foreground">
                    SLA <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left font-semibold">Creada</th>
                <th className="px-5 py-3 text-left font-semibold">
                  Actualizada
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    className="px-5 py-16 text-center text-muted-foreground text-sm"
                    colSpan={10}
                  >
                    No hay ordenes que coincidan con los filtros aplicados.
                  </td>
                </tr>
              )}
              {filtered.map((order) => (
                <tr
                  className="border-border/60 border-b transition-colors last:border-0 hover:bg-secondary/30"
                  key={order.id}
                >
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <span className="font-mono font-semibold text-foreground text-xs">
                      {order.id}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col leading-tight">
                      <span className="font-medium text-foreground text-sm">
                        {order.equipment}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {order.asset}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <span className="text-muted-foreground text-xs">
                      {order.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 font-semibold text-[11px]",
                        statusStyles[order.status],
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          statusDot[order.status],
                        )}
                      />
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full font-semibold text-[10px]",
                          order.initials === "-"
                            ? "border border-border border-dashed text-muted-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {order.initials}
                      </div>
                      <span className="whitespace-nowrap text-foreground text-xs">
                        {order.responsible}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 font-semibold text-[11px]",
                        priorityStyles[order.priority],
                      )}
                    >
                      {order.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "font-mono font-semibold text-xs tabular-nums",
                        slaStyles[order.slaState],
                      )}
                    >
                      {order.sla}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                    {order.created}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground text-xs">
                    {order.updated}
                  </td>
                  <td className="px-5 py-3.5">
                    <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-border border-t px-5 py-3 text-muted-foreground text-xs sm:flex-row sm:items-center">
          <span>
            Mostrando{" "}
            <span className="font-semibold text-foreground">
              {filtered.length}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-foreground">
              {orders.length}
            </span>{" "}
            ordenes
          </span>
          <div className="flex items-center gap-1">
            <button className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary">
              Anterior
            </button>
            <button className="rounded-md border border-border bg-secondary px-2.5 py-1 text-foreground">
              1
            </button>
            <button className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary">
              2
            </button>
            <button className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary">
              3
            </button>
            <button className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary">
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
