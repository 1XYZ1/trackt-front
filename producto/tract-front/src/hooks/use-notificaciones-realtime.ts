"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { NotificacionPayload } from "@/lib/api/notificaciones";

/**
 * Suscribe al canal Realtime filtrado por usuario_id. Al recibir INSERT
 * dispara toast con el mensaje del payload e invalida queries del bell.
 *
 * Cleanup: removeChannel al desmontar para evitar memory leak.
 */
export function useNotificacionesRealtime(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificaciones",
          filter: `usuario_id=eq.${userId}`,
        },
        (payload: { new: { payload?: NotificacionPayload } }) => {
          const mensaje = payload.new?.payload?.mensaje ?? "Nueva notificacion";
          toast.info(mensaje);
          queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
