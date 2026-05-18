/**
 * E2E del flujo OT + Tickets (API-02).
 *
 * Usa el helper compartido test/helpers/in-memory-app.ts que levanta la app
 * Nest completa con un PrismaService in-memory. Esto cubre el stack HTTP
 * (controllers + pipes + guards + services) sin requerir un Postgres real.
 */

import request from 'supertest';
import { OrdenTrabajoEstado, Prioridad, TicketEstado } from '@prisma/client';
import { AuthUser } from '../src/auth/types';
import {
  ADMIN,
  ADMIN_OTRO_TENANT,
  AppHandle,
  buildApp,
  OTRO_TENANT,
  TENANT,
} from './helpers/in-memory-app';

describe('Ordenes (e2e)', () => {
  let handle: AppHandle;

  beforeEach(async () => {
    handle = await buildApp();
    // seed: dos equipos, uno por tenant
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

  describe('seguridad', () => {
    it('GET /ordenes sin auth → 401', async () => {
      handle.setCurrentUser(null);
      await request(handle.app.getHttpServer()).get('/ordenes').expect(401);
    });

    it('POST /ordenes sin auth → 401', async () => {
      handle.setCurrentUser(null);
      await request(handle.app.getHttpServer())
        .post('/ordenes')
        .send({ equipoId: 'eq-1', descripcion: 'x' })
        .expect(401);
    });

    it('aislamiento por tenant: admin del tenant-2 no ve OTs del tenant-1', async () => {
      // Crear OT con admin tenant-1
      handle.setCurrentUser(ADMIN);
      const createRes = await request(handle.app.getHttpServer())
        .post('/ordenes')
        .send({ equipoId: 'eq-1', descripcion: 'mant t1' })
        .expect(201);
      const otId = createRes.body.id;

      // Cambiar a admin de otro tenant: GET /ordenes/:id → 404
      handle.setCurrentUser(ADMIN_OTRO_TENANT as AuthUser);
      await request(handle.app.getHttpServer())
        .get(`/ordenes/${otId}`)
        .expect(404);

      // GET /ordenes no incluye la OT del tenant-1
      const listRes = await request(handle.app.getHttpServer())
        .get('/ordenes')
        .expect(200);
      expect(listRes.body.data).toEqual([]);
      expect(listRes.body.meta.total).toBe(0);
    });
  });

  describe('flujo completo OT + ticket', () => {
    it('POST /ordenes → estado PENDIENTE', async () => {
      handle.setCurrentUser(ADMIN);
      const res = await request(handle.app.getHttpServer())
        .post('/ordenes')
        .send({
          equipoId: 'eq-1',
          descripcion: 'Mantención preventiva',
          prioridad: Prioridad.ALTA,
        })
        .expect(201);

      expect(res.body.estado).toBe(OrdenTrabajoEstado.PENDIENTE);
      expect(res.body.codigo).toMatch(/^OT-\d{4}-\d{4}$/);
      expect(res.body.id).toBeDefined();
    });

    it('flujo completo: crear OT → listar → crear ticket → OT pasa a EN_PROCESO → detalle muestra ticket', async () => {
      handle.setCurrentUser(ADMIN);

      // 1) POST /ordenes
      const createRes = await request(handle.app.getHttpServer())
        .post('/ordenes')
        .send({ equipoId: 'eq-1', descripcion: 'Falla motor' })
        .expect(201);
      const otId: string = createRes.body.id;
      expect(createRes.body.estado).toBe(OrdenTrabajoEstado.PENDIENTE);

      // 2) GET /ordenes → debe listar la OT
      const listRes = await request(handle.app.getHttpServer())
        .get('/ordenes')
        .expect(200);
      expect(listRes.body.meta.total).toBe(1);
      expect(listRes.body.data[0].id).toBe(otId);
      expect(listRes.body.data[0].estado).toBe(OrdenTrabajoEstado.PENDIENTE);

      // 3) POST /ordenes/:otId/tickets
      const ticketRes = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({ titulo: 'Inspección', descripcion: 'detalle' })
        .expect(201);
      expect(ticketRes.body.estado).toBe(TicketEstado.PENDIENTE);
      expect(ticketRes.body.ordenId).toBe(otId);

      // 4) La OT debe haber pasado a EN_PROCESO después del primer ticket
      const detailRes = await request(handle.app.getHttpServer())
        .get(`/ordenes/${otId}`)
        .expect(200);
      expect(detailRes.body.estado).toBe(OrdenTrabajoEstado.EN_PROCESO);

      // 5) GET /ordenes/:id debe incluir el ticket creado
      expect(detailRes.body.tickets).toHaveLength(1);
      expect(detailRes.body.tickets[0].codigo).toMatch(/^TKT-\d{4}-\d{4}$/);
      expect(detailRes.body.tickets[0].estado).toBe(TicketEstado.PENDIENTE);
    });
  });

  describe('PATCH /ordenes/:id', () => {
    it('actualiza descripcion en PENDIENTE', async () => {
      handle.setCurrentUser(ADMIN);
      const createRes = await request(handle.app.getHttpServer())
        .post('/ordenes')
        .send({ equipoId: 'eq-1', descripcion: 'inicial' })
        .expect(201);
      const otId = createRes.body.id;

      const patchRes = await request(handle.app.getHttpServer())
        .patch(`/ordenes/${otId}`)
        .send({ descripcion: 'editada' })
        .expect(200);
      expect(patchRes.body.descripcion).toBe('editada');
    });

    it('body vacío → 400 BadRequest', async () => {
      handle.setCurrentUser(ADMIN);
      const createRes = await request(handle.app.getHttpServer())
        .post('/ordenes')
        .send({ equipoId: 'eq-1', descripcion: 'inicial' })
        .expect(201);
      const otId = createRes.body.id;

      await request(handle.app.getHttpServer())
        .patch(`/ordenes/${otId}`)
        .send({})
        .expect(400);
    });
  });

  describe('POST /ordenes/:id/cancelar', () => {
    it('cancela OT en PENDIENTE y solo cancela tickets PENDIENTE asociados', async () => {
      handle.setCurrentUser(ADMIN);

      const otRes = await request(handle.app.getHttpServer())
        .post('/ordenes')
        .send({ equipoId: 'eq-1', descripcion: 'x' })
        .expect(201);
      const otId = otRes.body.id;

      // Ticket pendiente (creado vía endpoint — pasa la OT a EN_PROCESO)
      const tk1Res = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/tickets`)
        .send({ titulo: 'T1', descripcion: 'd' })
        .expect(201);
      const tk1Id = tk1Res.body.id;

      // Ticket ya en EN_EJECUCION → no debe cancelarse en cascada.
      // Lo inyectamos directamente al estado in-memory para simular un
      // ticket que ya estaba en ejecución cuando se cancela la OT.
      handle.prisma.tickets.push({
        id: 'tk-en-ejec',
        tenantId: TENANT,
        otId,
        codigo: 'TKT-X',
        titulo: 'En ejec',
        descripcion: 'd',
        estado: TicketEstado.EN_EJECUCION,
        prioridad: Prioridad.MEDIA,
        mecanicoId: null,
        jefeId: ADMIN.id,
        fechaAsignacion: null,
        fechaInicioEjecucion: new Date(),
        fechaFinEjecucion: null,
        fechaValidacion: null,
        fechaCierre: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const cancelRes = await request(handle.app.getHttpServer())
        .post(`/ordenes/${otId}/cancelar`)
        .expect(200);
      expect(cancelRes.body.estado).toBe(OrdenTrabajoEstado.CANCELADA);
      expect(cancelRes.body.fechaCierre).toBeDefined();

      // Verificar estado de cada ticket vía el mock in-memory
      const tk1 = handle.prisma.tickets.find((t) => t.id === tk1Id);
      const tkEn = handle.prisma.tickets.find((t) => t.id === 'tk-en-ejec');
      expect(tk1?.estado).toBe(TicketEstado.CANCELADO); // estaba PENDIENTE → cancelado
      expect(tkEn?.estado).toBe(TicketEstado.EN_EJECUCION); // intacto
    });

    it('cancelar OT inexistente → 404', async () => {
      handle.setCurrentUser(ADMIN);
      await request(handle.app.getHttpServer())
        .post('/ordenes/no-existe/cancelar')
        .expect(404);
    });
  });
});
