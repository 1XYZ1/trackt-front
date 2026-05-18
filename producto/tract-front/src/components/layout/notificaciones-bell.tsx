"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Loader2,
  RotateCcw,
  UserPlus,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useCountNoLeidas,
  useMarcarLeida,
  useMarcarTodasLeidas,
  useNotificaciones,
} from "@/hooks/use-notificaciones";
import { useAuth } from "@/contexts/auth-context";
import { useNotificacionesRealtime } from "@/hooks/use-notificaciones-realtime";
import type { Notificacion, NotificacionTipo } from "@/lib/api/notificaciones";

const TIPO_ICON: Record<NotificacionTipo, React.ReactNode> = {
  TICKET_ASIGNADO: <UserPlus className="size-4 text-blue-500" />,
  TICKET_INICIADO: <Wrench className="size-4 text-amber-500" />,
  TICKET_FINALIZADO: <CheckCircle2 className="size-4 text-emerald-500" />,
  TICKET_VALIDADO: <CheckCircle2 className="size-4 text-emerald-500" />,
  TICKET_RECHAZADO: <RotateCcw className="size-4 text-red-500" />,
  TICKET_CERRADO: <CheckCircle2 className="size-4 text-emerald-500" />,
  OT_CREADA: <Wrench className="size-4 text-blue-500" />,
  OT_CERRADA: <CheckCircle2 className="size-4 text-emerald-500" />,
};

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("es-CL", {
  numeric: "auto",
});

function fechaRelativa(iso: string): string {
  try {
    const diffMs = new Date(iso).getTime() - Date.now();
    const absSec = Math.abs(diffMs / 1000);
    if (absSec < 60) return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / 1000), "second");
    if (absSec < 3600) return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / 60000), "minute");
    if (absSec < 86400) return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / 3600000), "hour");
    return RELATIVE_TIME_FORMATTER.format(Math.round(diffMs / 86400000), "day");
  } catch {
    return iso;
  }
}

export function NotificacionesBell() {
  const auth = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useNotificacionesRealtime(auth.id);

  const countQuery = useCountNoLeidas();
  const listQuery = useNotificaciones(10);
  const marcarLeida = useMarcarLeida();
  const marcarTodasLeidas = useMarcarTodasLeidas();

  const count = countQuery.data ?? 0;
  const items = listQuery.data?.data ?? [];

  const handleClickItem = (notif: Notificacion) => {
    if (!notif.leida) marcarLeida.mutate(notif.id);
    const ticketId = notif.payload?.ticketId;
    if (ticketId) {
      const path =
        auth.role === "mechanic" ? `/mis-tickets/${ticketId}` : `/tickets/${ticketId}`;
      setOpen(false);
      router.push(path);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="size-4" />
            {count > 0 && (
              <Badge
                variant="destructive"
                className="-right-1 -top-1 absolute h-4 min-w-4 rounded-full px-1 text-[10px]"
              >
                {count > 9 ? "9+" : count}
              </Badge>
            )}
            <span className="hidden sm:inline">Notificaciones</span>
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[360px] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="font-semibold text-sm">Notificaciones</p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => marcarTodasLeidas.mutate()}
              disabled={marcarTodasLeidas.isPending}
            >
              <CheckCheck className="size-3.5" />
              <span className="text-xs">Marcar todas</span>
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No tienes notificaciones.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((notif) => (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => handleClickItem(notif)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-accent ${
                      notif.leida ? "" : "bg-accent/30"
                    }`}
                  >
                    <div className="mt-0.5">{TIPO_ICON[notif.tipo]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-sm">
                        {notif.payload?.mensaje ?? notif.tipo}
                      </p>
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        {fechaRelativa(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.leida && (
                      <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
