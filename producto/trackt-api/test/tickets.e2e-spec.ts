/**
 * E2E del módulo tickets (API-03).
 *
 * Cubre el contrato HTTP completo:
 *  - POST /ordenes/:otId/tickets  (creación desde OT padre)
 *  - GET  /tickets                 (listar + filtros estado/mecanico_id/ot_id)
 *  - GET  /tickets/:id             (detalle con OT padre + timeline)
 *
 * Usa el helper compartido (in-memory Prisma) — el rationale está en
 * test/helpers/in-memory-app.ts.
 */

import request from 'supertest';
import {
  OrdenTrabajoEstado,
  Prioridad,
  TicketEstado,
} from '@prisma/client';
import { AuthUser } from '../src/auth/types';
import {
  ADMIN,
  ADMIN_OTRO_TENANT,
  AppHandle,
  buildApp,
  OTRO_TENANT,
  TENANT,
} from './helpers/in-memory-app';

async function crearOt(handle: AppHandle, user: AuthUser): Promise<string> {
  handle.setCurrentUser(user);
  const res = await request(handle.app.getHttpServer())
    .post('/ordenes')
    .send({ equipoId: 'eq-1', descripcion: 'OT seed' })
    .expect(201);
  return res.body.id;
}

describe('Tickets (e2e)', () => {
  let handle: AppHandle;

  beforeEach(async () => {
    handle = await buildApp();
    handle.prisma.equipos.push(
      {
        id: 'eq-1',
        tenantId: TENANT,
        codigo: 'EQ-001',
        nombre: 'Camion Minero',
        marca: 'CAT',
        modelo: '793F',
        ubicacion: 'Rajo',
      },
      {
        id: 'eq-other',
        tenantId: OTRO_TENANT,
        codigo: 'EQ-X',
        nombre: 'Otro',
        marca: 'Otra',
        modelo: 'M',
        ubicacion: 'X',
      },
    );
  });

  afterEach(async () => {
    await handle.app.close();
  });

  // ---------- seguridad ----------

  describe('seguridad', () => {
    it('POST /ordenes/:otId/tickets sin auth → 401', async () => {
      handle.setCurrentUser(null);
      await request(handle.app.getHttpServer())
        .post('/ordenes/cualquier-ot/tickets')
        .send({ titulo: 'x', descripcion: 'd' })
        .expect(401);
    });

    it('GET /tickets sin auth → 401', async () => {
      handle.setCurrentUser(null);
      await request(handle.app.getHttpServer()).get('/tickets').expect(401);
    });

    it('GET /tickets/:id sin auth → 401', async () => {
      handle.setCurrentUser(null);
      await request(handle.app.getHttpServer())
        .get('/tickets/cualquier-id')
        .expect(401);
    });

    it('aislamiento por tenant: tenant-2 no ve tickets del tenant-1', async () => {
      // Crear OT + ticket en tenant-1
      const otId = await crearOt(handle, ADMIN);
      const tkRes = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({ titulo: 'T del tenant 1', descripcion: 'd' })
        .expect(201);
      const ticketId = tkRes.body.id;

      // Cambiar a admin del tenant-2
      handle.setCurrentUser(ADMIN_OTRO_TENANT);

      // GET /tickets → lista vacía
      const listRes = await request(handle.app.getHttpServer())
        .get('/tickets')
        .expect(200);
      expect(listRes.body.data).toEqual([]);
      expect(listRes.body.meta.total).toBe(0);

      // GET /tickets/:id del otro tenant → 404
      await request(handle.app.getHttpServer())
        .get(`/tickets/${ticketId}`)
        .expect(404);
    });
  });

  // ---------- POST /ordenes/:otId/tickets ----------

  describe('POST /ordenes/:otId/tickets', () => {
    it('crea ticket PENDIENTE con código TKT-{YYYY}-{seq} y mueve la OT padre a EN_PROCESO', async () => {
      const otId = await crearOt(handle, ADMIN);

      const res = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({
          titulo: 'Inspección',
          descripcion: 'detalle',
          prioridad: Prioridad.ALTA,
        })
        .expect(201);

      // Ticket nace en PENDIENTE
      expect(res.body.estado).toBe(TicketEstado.PENDIENTE);
      // Código TKT-YYYY-NNNN
      const year = new Date().getUTCFullYear();
      expect(res.body.codigo).toMatch(
        new RegExp(`^TKT-${year}-\\d{4}$`),
      );
      expect(res.body.ordenId).toBe(otId);

      // La OT pasó a EN_PROCESO
      const detail = await request(handle.app.getHttpServer())
        .get(`/ordenes/${otId}`)
        .expect(200);
      expect(detail.body.estado).toBe(OrdenTrabajoEstado.EN_PROCESO);
    });

    it('crea evento inicial estadoAnterior=null → PENDIENTE en el timeline', async () => {
      const otId = await crearOt(handle, ADMIN);
      const res = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({ titulo: 't', descripcion: 'd' })
        .expect(201);

      const detail = await request(handle.app.getHttpServer())
        .get(`/tickets/${res.body.id}`)
        .expect(200);

      expect(detail.body.timeline).toHaveLength(1);
      expect(detail.body.timeline[0].estadoAnterior).toBeNull();
      expect(detail.body.timeline[0].estadoNuevo).toBe(TicketEstado.PENDIENTE);
    });

    it('OT inexistente → 404', async () => {
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post('/ordenes/no-existe/tickets')
        .send({ titulo: 't', descripcion: 'd' })
        .expect(404);
    });
  });

  // ---------- GET /tickets ----------

  describe('GET /tickets', () => {
    async function seedDos(): Promise<{ otId: string; tkPendId: string; tkAsignId: string }> {
      const otId = await crearOt(handle, ADMIN);

      const tk1 = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({ titulo: 'pendiente', descripcion: 'd' })
        .expect(201);

      const tk2 = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({ titulo: 'asignado', descripcion: 'd' })
        .expect(201);

      // Forzamos el segundo a ASIGNADO en el estado in-memory para tener
      // dos estados distintos y poder testear el filtro.
      const tk2Row = handle.prisma.tickets.find((t) => t.id === tk2.body.id);
      if (tk2Row) {
        tk2Row.estado = TicketEstado.ASIGNADO;
        tk2Row.mecanicoId = '00000000-0000-0000-0000-000000000099';
      }
      return { otId, tkPendId: tk1.body.id, tkAsignId: tk2.body.id };
    }

    it('lista tickets del tenant con estructura { data, meta }', async () => {
      await seedDos();

      const res = await request(handle.app.getHttpServer())
        .get('/tickets')
        .expect(200);

      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: 2,
      });
      expect(res.body.data).toHaveLength(2);
    });

    it('filtra por estado', async () => {
      const { tkPendId } = await seedDos();

      const res = await request(handle.app.getHttpServer())
        .get('/tickets')
        .query({ estado: TicketEstado.PENDIENTE })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(tkPendId);
    });

    it('filtra por mecanico_id (alias snake_case del DTO)', async () => {
      const { tkAsignId } = await seedDos();

      const res = await request(handle.app.getHttpServer())
        .get('/tickets')
        .query({ mecanico_id: '00000000-0000-0000-0000-000000000099' })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(tkAsignId);
    });

    it('filtra por ot_id (alias snake_case del DTO)', async () => {
      const { otId, tkPendId, tkAsignId } = await seedDos();

      const res = await request(handle.app.getHttpServer())
        .get('/tickets')
        .query({ ot_id: otId })
        .expect(200);

      const ids = res.body.data.map((t: { id: string }) => t.id);
      expect(ids).toEqual(expect.arrayContaining([tkPendId, tkAsignId]));

      // Y con ot_id inexistente devuelve vacío
      const empty = await request(handle.app.getHttpServer())
        .get('/tickets')
        .query({ ot_id: 'no-existe' })
        .expect(200);
      expect(empty.body.data).toEqual([]);
    });
  });

  // ---------- GET /tickets/:id ----------

  describe('GET /tickets/:id', () => {
    it('detalle incluye OT padre + equipo y timeline ordenado cronológicamente asc', async () => {
      const otId = await crearOt(handle, ADMIN);
      const tk = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({ titulo: 't', descripcion: 'd' })
        .expect(201);
      const ticketId: string = tk.body.id;

      // Insertamos eventos manualmente en orden NO cronológico, ambos
      // *posteriores* al evento auto-creado (que usa new Date() = "ahora").
      // Verifica que el endpoint los devuelve ordenados asc por createdAt.
      handle.prisma.eventos.push(
        {
          id: 'evt-later',
          ticketId,
          estadoAnterior: TicketEstado.ASIGNADO,
          estadoNuevo: TicketEstado.EN_EJECUCION,
          usuarioId: ADMIN.id,
          observacion: 'inicio',
          createdAt: new Date('2099-06-01T10:00:00Z'),
        },
        {
          id: 'evt-earlier',
          ticketId,
          estadoAnterior: TicketEstado.PENDIENTE,
          estadoNuevo: TicketEstado.ASIGNADO,
          usuarioId: ADMIN.id,
          observacion: 'asignación',
          createdAt: new Date('2099-05-15T10:00:00Z'),
        },
      );

      const res = await request(handle.app.getHttpServer())
        .get(`/tickets/${ticketId}`)
        .expect(200);

      // OT padre
      expect(res.body.ordenId).toBe(otId);
      expect(res.body.ordenCodigo).toMatch(/^OT-\d{4}-\d{4}$/);
      expect(res.body.equipo).toMatchObject({
        id: 'eq-1',
        codigo: 'EQ-001',
      });

      // Timeline: 3 eventos, ordenados asc por createdAt
      // (creación automática + dos manuales)
      expect(res.body.timeline).toHaveLength(3);
      const timestamps: string[] = res.body.timeline.map(
        (e: { timestamp: string }) => e.timestamp,
      );
      const sortedAsc = [...timestamps].sort();
      expect(timestamps).toEqual(sortedAsc);

      // Primer evento del timeline es la creación (estadoAnterior=null)
      expect(res.body.timeline[0].estadoAnterior).toBeNull();
      expect(res.body.timeline[0].estadoNuevo).toBe(TicketEstado.PENDIENTE);
    });

    it('ticket inexistente → 404', async () => {
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .get('/tickets/no-existe')
        .expect(404);
    });
  });
});
