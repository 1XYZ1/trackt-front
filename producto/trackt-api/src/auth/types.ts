/**
 * Roles internos del sistema. Los nombres en inglés son los valores del enum
 * `user_role` en Postgres/Supabase y se usan en RLS y en `public.profiles`.
 *
 * Mapeo con la terminología de negocio (TRA / tarea API-04):
 *   - admin     → jefe de taller / administrador del tenant
 *   - mechanic  → mecánico
 *
 * Otros roles del dominio (bodega, jefe_taller explícito, etc.) no están
 * modelados todavía: requieren migración del enum + RLS + seed + frontend.
 * Para evitar ese cambio cross-cutting, API-04 se cumple usando admin como
 * "jefe de taller" (asigna y valida) y mechanic como "mecánico ejecutor".
 */
export type UserRole = 'admin' | 'mechanic';

export interface AuthUser {
  id: string;
  email?: string;
  role: UserRole;
  tenantId: string;
  fullName?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}
