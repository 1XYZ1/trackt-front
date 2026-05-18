/**
 * Helper compartido para tests E2E.
 *
 * Levanta toda la app Nest (controllers + services + global pipes) y la
 * golpea con supertest. PrismaService se reemplaza por un mock in-memory
 * que simula las tablas y soporta filtros por tenantId, $transaction
 * callback/array, include de relaciones y $executeRaw (advisory locks).
 *
 * Por qué no Postgres real: las queries usan funciones específicas de
 * Postgres (advisory locks, casts a user_role, $queryRaw a auth.users) y
 * requerirían un Supabase/Postgres provisionado. El mock cubre el contrato
 * funcional que la API garantiza: estados, transiciones y aislamiento por
 * tenant.
 */

import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SupabaseService } from '../../src/supabase.service';
import { ProfileService } from '../../src/auth/profile.service';
import { AuthGuard } from '../../src/auth/auth.guard';
import { AuthUser } from '../../src/auth/types';

// ---------- usuarios de prueba ----------

export const TENANT = 'tenant-1';
export const OTRO_TENANT = 'tenant-2';

export const ADMIN: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@trackt.demo',
  role: 'admin',
  tenantId: TENANT,
};

export const ADMIN_OTRO_TENANT: AuthUser = {
  id: '00000000-0000-0000-0000-000000000099',
  email: 'admin@otro.demo',
  role: 'admin',
  tenantId: OTRO_TENANT,
};

export const MECHANIC: AuthUser = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'mec@trackt.demo',
  role: 'mechanic',
  tenantId: TENANT,
};

// ---------- mock in-memory de Prisma ----------

type Row = Record<string, unknown>;

function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const k of Object.keys(where)) {
    const cond = where[k];
    const val = row[k];
    if (cond === undefined) continue;
    if (cond === null) {
      if (val !== null && val !== undefined) return false;
    } else if (
      cond &&
      typeof cond === 'object' &&
      !Array.isArray(cond) &&
      !(cond instanceof Date)
    ) {
      const c = cond as Record<string, unknown>;
      if ('in' in c) {
        if (!(c.in as unknown[]).includes(val)) return false;
      } else if ('startsWith' in c) {
        if (!String(val ?? '').startsWith(String(c.startsWith))) return false;
      } else {
        // sub-objeto no soportado; ignorar
      }
    } else {
      if (val !== cond) return false;
    }
  }
  return true;
}

function sortBy(
  rows: Row[],
  orderBy: Record<string, 'asc' | 'desc'> | undefined,
): Row[] {
  if (!orderBy) return rows;
  const entries = Object.entries(orderBy);
  return [...rows].sort((a, b) => {
    for (const [k, dir] of entries) {
      const av = a[k];
      const bv = b[k];
      if ((av as number) < (bv as number)) return dir === 'asc' ? -1 : 1;
      if ((av as number) > (bv as number)) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

function project<T extends Row>(
  row: T,
  select: Record<string, true> | undefined,
): T {
  if (!select) return row;
  const out: Row = {};
  for (const k of Object.keys(select)) {
    out[k] = row[k];
  }
  return out as T;
}

export class InMemoryPrisma {
  equipos: Row[] = [];
  ordenes: Row[] = [];
  tickets: Row[] = [];
  eventos: Row[] = [];
  evidencias: Row[] = [];

  equipo = {
    findFirst: jest.fn(
      (args: { where: Row; select?: Record<string, true> }) => {
        const found = this.equipos.find((r) => matchesWhere(r, args.where));
        return Promise.resolve(found ? project(found, args.select) : null);
      },
    ),
  };

  ordenTrabajo = {
    create: jest.fn(
      (args: { data: Row; select?: Record<string, true> }) => {
        const now = new Date();
        const row: Row = {
          id: randomUUID(),
          createdAt: now,
          updatedAt: now,
          fechaCierre: null,
          ...args.data,
        };
        this.ordenes.push(row);
        return Promise.resolve(project(row, args.select));
      },
    ),
    findFirst: jest.fn(
      (args: {
        where: Row;
        select?: Record<string, true>;
        include?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
      }) => {
        const filtered = this.ordenes.filter((r) =>
          matchesWhere(r, args.where),
        );
        const sorted = sortBy(filtered, args.orderBy);
        const found = sorted[0];
        if (!found) return Promise.resolve(null);
        return Promise.resolve(
          this.attachIncludes(found, args.include, args.select),
        );
      },
    ),
    findMany: jest.fn(
      (args: {
        where?: Row;
        select?: Record<string, true>;
        include?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
        skip?: number;
        take?: number;
      }) => {
        let rows = this.ordenes.filter((r) => matchesWhere(r, args.where));
        rows = sortBy(rows, args.orderBy);
        const skip = args.skip ?? 0;
        const take = args.take ?? rows.length;
        rows = rows.slice(skip, skip + take);
        return Promise.resolve(
          rows.map((r) => this.attachIncludes(r, args.include, args.select)),
        );
      },
    ),
    count: jest.fn((args: { where?: Row }) => {
      return Promise.resolve(
        this.ordenes.filter((r) => matchesWhere(r, args.where)).length,
      );
    }),
    update: jest.fn(
      (args: {
        where: { id: string };
        data: Row;
        select?: Record<string, true>;
      }) => {
        const idx = this.ordenes.findIndex((r) => r.id === args.where.id);
        if (idx === -1) throw new Error('ordenTrabajo.update: no encontrado');
        const updated = {
          ...this.ordenes[idx],
          ...args.data,
          updatedAt: new Date(),
        };
        this.ordenes[idx] = updated;
        return Promise.resolve(project(updated, args.select));
      },
    ),
    updateMany: jest.fn((args: { where: Row; data: Row }) => {
      let count = 0;
      this.ordenes = this.ordenes.map((r) => {
        if (matchesWhere(r, args.where)) {
          count++;
          return { ...r, ...args.data, updatedAt: new Date() };
        }
        return r;
      });
      return Promise.resolve({ count });
    }),
  };

  ticket = {
    create: jest.fn((args: { data: Row }) => {
      const now = new Date();
      const row: Row = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        mecanicoId: null,
        fechaAsignacion: null,
        fechaInicioEjecucion: null,
        fechaFinEjecucion: null,
        fechaValidacion: null,
        fechaCierre: null,
        metadata: null,
        ...args.data,
      };
      this.tickets.push(row);
      return Promise.resolve(row);
    }),
    findFirst: jest.fn(
      (args: { where: Row; include?: Record<string, unknown> }) => {
        const found = this.tickets.find((r) => matchesWhere(r, args.where));
        if (!found) return Promise.resolve(null);
        return Promise.resolve(this.attachTicketIncludes(found, args.include));
      },
    ),
    findMany: jest.fn(
      (args: {
        where?: Row;
        include?: Record<string, unknown>;
        orderBy?: Record<string, 'asc' | 'desc'>;
        skip?: number;
        take?: number;
      }) => {
        let rows = this.tickets.filter((r) => matchesWhere(r, args.where));
        rows = sortBy(rows, args.orderBy);
        const skip = args.skip ?? 0;
        const take = args.take ?? rows.length;
        rows = rows.slice(skip, skip + take);
        return Promise.resolve(
          rows.map((r) => this.attachTicketIncludes(r, args.include)),
        );
      },
    ),
    findUniqueOrThrow: jest.fn(
      (args: { where: { id: string }; include?: Record<string, unknown> }) => {
        const found = this.tickets.find((r) => r.id === args.where.id);
        if (!found) throw new Error('ticket.findUniqueOrThrow: no encontrado');
        return Promise.resolve(this.attachTicketIncludes(found, args.include));
      },
    ),
    count: jest.fn((args: { where?: Row }) =>
      Promise.resolve(
        this.tickets.filter((r) => matchesWhere(r, args.where)).length,
      ),
    ),
    update: jest.fn((args: { where: { id: string }; data: Row }) => {
      const idx = this.tickets.findIndex((r) => r.id === args.where.id);
      if (idx === -1) throw new Error('ticket.update: no encontrado');
      this.tickets[idx] = {
        ...this.tickets[idx],
        ...args.data,
        updatedAt: new Date(),
      };
      return Promise.resolve(this.tickets[idx]);
    }),
    updateMany: jest.fn((args: { where: Row; data: Row }) => {
      let count = 0;
      this.tickets = this.tickets.map((r) => {
        if (matchesWhere(r, args.where)) {
          count++;
          return { ...r, ...args.data, updatedAt: new Date() };
        }
        return r;
      });
      return Promise.resolve({ count });
    }),
  };

  eventoEstadoTicket = {
    create: jest.fn((args: { data: Row }) => {
      const row: Row = {
        id: randomUUID(),
        createdAt: new Date(),
        ...args.data,
      };
      this.eventos.push(row);
      return Promise.resolve(row);
    }),
  };

  evidencia = {
    create: jest.fn((args: { data: Row }) => {
      const row: Row = {
        id: randomUUID(),
        createdAt: new Date(),
        descripcion: null,
        ...args.data,
      };
      this.evidencias.push(row);
      return Promise.resolve(row);
    }),
    findMany: jest.fn(
      (args: {
        where?: Row;
        orderBy?: Record<string, 'asc' | 'desc'>;
      }) => {
        let rows = this.evidencias.filter((r) => matchesWhere(r, args.where));
        rows = sortBy(rows, args.orderBy);
        return Promise.resolve(rows);
      },
    ),
  };

  $executeRaw = jest.fn(() => Promise.resolve(0));
  $queryRaw = jest.fn(() => Promise.resolve([] as unknown[]));

  $transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: this) => Promise<unknown>)(this);
    }
    if (Array.isArray(arg)) return Promise.all(arg);
    throw new Error('Unexpected $transaction argument');
  });

  // ---------- include resolution ----------

  private attachIncludes(
    ot: Row,
    include?: Record<string, unknown>,
    select?: Record<string, true>,
  ): Row {
    if (select) return project(ot, select);
    if (!include) return ot;
    const out: Row = { ...ot };
    if (include.equipo) {
      const eq = this.equipos.find((e) => e.id === ot.equipoId);
      const sel = (include.equipo as { select?: Record<string, true> })?.select;
      out.equipo = eq ? project(eq, sel) : null;
    }
    if (include.tickets) {
      const opts = include.tickets as {
        select?: Record<string, true>;
        orderBy?: Record<string, 'asc' | 'desc'>;
      };
      let related = this.tickets.filter((t) => t.otId === ot.id);
      related = sortBy(related, opts.orderBy);
      out.tickets = related.map((t) => project(t, opts.select));
    }
    return out;
  }

  private attachTicketIncludes(
    ticket: Row,
    include?: Record<string, unknown>,
  ): Row {
    if (!include) return ticket;
    const out: Row = { ...ticket };
    if (include.ot) {
      const ot = this.ordenes.find((o) => o.id === ticket.otId);
      const sel = (include.ot as { select?: Record<string, unknown> })?.select;
      if (ot && sel) {
        const otOut: Row = {};
        for (const [k, v] of Object.entries(sel)) {
          if (k === 'equipo' && v && typeof v === 'object') {
            const eq = this.equipos.find((e) => e.id === ot.equipoId);
            const eqSel = (v as { select?: Record<string, true> }).select;
            otOut.equipo = eq ? project(eq, eqSel) : null;
          } else if (v === true) {
            otOut[k] = ot[k];
          }
        }
        out.ot = otOut;
      } else {
        out.ot = ot ?? null;
      }
    }
    if (include.eventos) {
      const opts = include.eventos as {
        orderBy?: Record<string, 'asc' | 'desc'>;
      };
      const related = this.eventos.filter((e) => e.ticketId === ticket.id);
      out.eventos = sortBy(related, opts.orderBy);
    }
    return out;
  }
}

// ---------- bootstrap ----------

/**
 * Mock del Storage API de Supabase. Lo exponemos en el handle para que cada
 * test de evidencias configure las respuestas (createSignedUploadUrl, list,
 * createSignedUrl) sin tener que reconstruir la app.
 */
export interface SupabaseStorageMock {
  createSignedUploadUrl: jest.Mock;
  createSignedUrl: jest.Mock;
  list: jest.Mock;
}

export interface AppHandle {
  app: INestApplication;
  prisma: InMemoryPrisma;
  storageApi: SupabaseStorageMock;
  setCurrentUser: (u: AuthUser | null) => void;
}

export async function buildApp(initialUser: AuthUser | null = ADMIN): Promise<AppHandle> {
  const prisma = new InMemoryPrisma();
  let currentUser: AuthUser | null = initialUser;

  const storageApi: SupabaseStorageMock = {
    createSignedUploadUrl: jest.fn(),
    createSignedUrl: jest.fn(),
    list: jest.fn(),
  };
  const adminClient = { storage: { from: () => storageApi } };
  const supabaseMock = {
    getClient: jest.fn(),
    getAdminClient: jest.fn().mockReturnValue(adminClient),
  };
  const profileMock = {
    getById: jest.fn(),
    invalidate: jest.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(SupabaseService)
    .useValue(supabaseMock)
    .overrideProvider(ProfileService)
    .useValue(profileMock)
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate: (ctx: {
        switchToHttp: () => { getRequest: () => { user?: AuthUser } };
      }) => {
        const req = ctx.switchToHttp().getRequest();
        if (!currentUser) {
          // Mismo contrato que el AuthGuard real: 401, no 403
          throw new UnauthorizedException('Missing token');
        }
        req.user = currentUser;
        return true;
      },
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.init();

  return {
    app,
    prisma,
    storageApi,
    setCurrentUser: (u) => {
      currentUser = u;
    },
  };
}
