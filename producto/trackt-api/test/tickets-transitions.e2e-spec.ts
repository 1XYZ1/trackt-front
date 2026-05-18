/**
 * E2E de las transiciones de estado del ticket (API-04).
 *
 * Cubre el contrato HTTP de cada endpoint de transición:
 *   - POST /tickets/:id/asignar      (admin)
 *   - POST /tickets/:id/iniciar      (mechanic asignado)
 *   - POST /tickets/:id/finalizar    (mechanic asignado)
 *   - POST /tickets/:id/validar      (admin, aprobado true/false)
 *
 * Validaciones:
 *   - Transición válida → 200 con nuevo estado.
 *   - Rol incorrecto → 403 (RolesGuard).
 *   - Mecánico no asignado → 403 (assertAssignedMechanic en service).
 *   - Estado inválido → 409.
 *   - Sin auth → 401.
 */

import request from 'supertest';
import { TicketEstado } from '@prisma/client';
import {
  ADMIN,
  AppHandle,
  buildApp,
  MECHANIC,
  TENANT,
} from './helpers/in-memory-app';
import { AuthUser } from '../src/auth/types';

const OTRO_MECHANIC: AuthUser = {
  id: '00000000-0000-0000-0000-0000000000aa',
  email: 'otro-mec@trackt.demo',
  role: 'mechanic',
  tenantId: TENANT,
};

async function crearTicketPendiente(handle: AppHandle): Promise<{
  otId: string;
  ticketId: string;
}> {
  handle.setCurrentUser(ADMIN);
  const ot = await request(handle.app.getHttpServer())
    .post('/ordenes')
    .send({ equipoId: 'eq-1', descripcion: 'mant' })
    .expect(201);
  const ticket = await request(handle.app.getHttpServer())
    .post(`/ordenes/${ot.body.id}/tickets`)
    .send({ titulo: 't', descripcion: 'd' })
    .expect(201);
  return { otId: ot.body.id, ticketId: ticket.body.id };
}

/**
 * Hace que $queryRaw devuelva al MECHANIC seed cuando el service busca
 * profiles (asignar mecánico + fetchUserSummaries). Resto de llamadas → [].
 */
function mockProfileLookups(handle: AppHandle): void {
  handle.prisma.$queryRaw = jest.fn(() =>
    Promise.resolve([{ id: MECHANIC.id, full_name: 'Mecánico Demo' }]),
  );
}

describe('Tickets transitions (e2e)', () => {
  let handle: AppHandle;

  beforeEach(async () => {
    handle = await buildApp();
    handle.prisma.equipos.push({
      id: 'eq-1',
      tenantId: TENANT,
      codigo: 'EQ-001',
      nombre: 'Camion Minero',
      marca: 'CAT',
      modelo: '793F',
      ubicacion: 'Rajo',
    });
    mockProfileLookups(handle);
  });

  afterEach(async () => {
    await handle.app.close();
  });

  // ---------- seguridad ----------

  describe('seguridad', () => {
    it('POST /tickets/:id/asignar sin auth → 401', async () => {
      handle.setCurrentUser(null);
      await request(handle.app.getHttpServer())
        .post('/tickets/cualquier/asignar')
        .send({ mecanicoId: MECHANIC.id })
        .expect(401);
    });

    it('mechanic intentando asignar → 403 (RolesGuard)', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(MECHANIC);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(403);
    });

    it('mechanic intentando validar → 403 (RolesGuard)', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(MECHANIC);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/validar`)
        .send({ aprobado: true })
        .expect(403);
    });

    it('admin intentando iniciar → 403 (RolesGuard)', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/iniciar`)
        .expect(403);
    });

    it('admin intentando finalizar → 403 (RolesGuard)', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/finalizar`)
        .send({})
        .expect(403);
    });
  });

  // ---------- POST /tickets/:id/asignar ----------

  describe('POST /tickets/:id/asignar', () => {
    it('admin asigna mecánico válido → ASIGNADO + fechaAsignacion seteada', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);

      const res = await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(200);

      expect(res.body.estado).toBe(TicketEstado.ASIGNADO);
      expect(res.body.mecanico).toMatchObject({ id: MECHANIC.id });

      const row = handle.prisma.tickets.find((t) => t.id === ticketId);
      expect(row?.fechaAsignacion).toBeInstanceOf(Date);
    });

    it('estado inválido (ya ASIGNADO) → 409', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(200);

      // Segunda asignación sobre el mismo ticket: ya no está PENDIENTE
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(409);
    });
  });

  // ---------- POST /tickets/:id/iniciar ----------

  describe('POST /tickets/:id/iniciar', () => {
    async function asignarA(handle: AppHandle, mechanicId: string) {
      const seeded = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);
      // Reasignamos $queryRaw para devolver el mechanicId solicitado
      handle.prisma.$queryRaw = jest.fn(() =>
        Promise.resolve([{ id: mechanicId, full_name: 'Mec' }]),
      );
      await request(handle.app.getHttpServer())
        .post(`/tickets/${seeded.ticketId}/asignar`)
        .send({ mecanicoId: mechanicId })
        .expect(200);
      return seeded;
    }

    it('mecánico asignado inicia → EN_EJECUCION + fechaInicioEjecucion', async () => {
      const { ticketId } = await asignarA(handle, MECHANIC.id);
      handle.setCurrentUser(MECHANIC);

      const res = await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/iniciar`)
        .expect(200);

      expect(res.body.estado).toBe(TicketEstado.EN_EJECUCION);
      const row = handle.prisma.tickets.find((t) => t.id === ticketId);
      expect(row?.fechaInicioEjecucion).toBeInstanceOf(Date);
    });

    it('mecánico NO asignado intenta iniciar → 403', async () => {
      const { ticketId } = await asignarA(handle, MECHANIC.id);
      handle.setCurrentUser(OTRO_MECHANIC);

      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/iniciar`)
        .expect(403);
    });

    it('estado inválido (PENDIENTE, sin asignar) → 409', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(MECHANIC);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/iniciar`)
        .expect(409);
    });
  });

  // ---------- POST /tickets/:id/finalizar ----------

  describe('POST /tickets/:id/finalizar', () => {
    async function llevarAEnEjecucion(handle: AppHandle): Promise<string> {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(200);
      handle.setCurrentUser(MECHANIC);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/iniciar`)
        .expect(200);
      return ticketId;
    }

    it('mecánico asignado finaliza → EJECUTADO + fechaFinEjecucion', async () => {
      const ticketId = await llevarAEnEjecucion(handle);
      const res = await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/finalizar`)
        .send({ observacion: 'listo' })
        .expect(200);

      expect(res.body.estado).toBe(TicketEstado.EJECUTADO);
      const row = handle.prisma.tickets.find((t) => t.id === ticketId);
      expect(row?.fechaFinEjecucion).toBeInstanceOf(Date);
    });

    it('estado inválido (ASIGNADO, no iniciado) → 409', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(200);

      handle.setCurrentUser(MECHANIC);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/finalizar`)
        .send({})
        .expect(409);
    });
  });

  // ---------- POST /tickets/:id/validar ----------

  describe('POST /tickets/:id/validar', () => {
    async function llevarAEjecutado(handle: AppHandle): Promise<string> {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(200);
      handle.setCurrentUser(MECHANIC);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/iniciar`)
        .expect(200);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/finalizar`)
        .send({})
        .expect(200);
      return ticketId;
    }

    it('aprobado=true → CERRADO + fechaCierre + fechaValidacion', async () => {
      const ticketId = await llevarAEjecutado(handle);
      handle.setCurrentUser(ADMIN);

      const res = await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/validar`)
        .send({ aprobado: true })
        .expect(200);

      expect(res.body.estado).toBe(TicketEstado.CERRADO);
      const row = handle.prisma.tickets.find((t) => t.id === ticketId);
      expect(row?.fechaValidacion).toBeInstanceOf(Date);
      expect(row?.fechaCierre).toBeInstanceOf(Date);
    });

    it('aprobado=false → vuelve a EN_EJECUCION (re-trabajo) y limpia fechaFinEjecucion', async () => {
      const ticketId = await llevarAEjecutado(handle);
      handle.setCurrentUser(ADMIN);

      const res = await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/validar`)
        .send({ aprobado: false, observacion: 'falta soldadura' })
        .expect(200);

      expect(res.body.estado).toBe(TicketEstado.EN_EJECUCION);
      const row = handle.prisma.tickets.find((t) => t.id === ticketId);
      expect(row?.fechaFinEjecucion).toBeNull();
      expect(row?.fechaValidacion).toBeInstanceOf(Date);
    });

    it('estado inválido (PENDIENTE) → 409', async () => {
      const { ticketId } = await crearTicketPendiente(handle);
      handle.setCurrentUser(ADMIN);

      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/validar`)
        .send({ aprobado: true })
        .expect(409);
    });
  });

  // ---------- flujo completo ----------

  describe('flujo completo PENDIENTE → ASIGNADO → EN_EJECUCION → EJECUTADO → CERRADO', () => {
    it('happy path + timeline acumula los 5 estados (creación + 4 transiciones)', async () => {
      const { ticketId } = await crearTicketPendiente(handle);

      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/asignar`)
        .send({ mecanicoId: MECHANIC.id })
        .expect(200);

      handle.setCurrentUser(MECHANIC);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/iniciar`)
        .expect(200);
      await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/finalizar`)
        .send({ observacion: 'listo' })
        .expect(200);

      handle.setCurrentUser(ADMIN);
      const final = await request(handle.app.getHttpServer())
        .post(`/tickets/${ticketId}/validar`)
        .send({ aprobado: true })
        .expect(200);

      expect(final.body.estado).toBe(TicketEstado.CERRADO);

      // Timeline: creación + 4 transiciones = 5 eventos
      const detail = await request(handle.app.getHttpServer())
        .get(`/tickets/${ticketId}`)
        .expect(200);
      expect(detail.body.timeline).toHaveLength(5);
      const estados = detail.body.timeline.map(
        (e: { estadoNuevo: string }) => e.estadoNuevo,
      );
      expect(estados).toEqual([
        TicketEstado.PENDIENTE,
        TicketEstado.ASIGNADO,
        TicketEstado.EN_EJECUCION,
        TicketEstado.EJECUTADO,
        TicketEstado.CERRADO,
      ]);
    });
  });
});
