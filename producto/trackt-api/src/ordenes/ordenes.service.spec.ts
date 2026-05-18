import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrdenTrabajoEstado, Prioridad, TicketEstado } from '@prisma/client';
import { OrdenesService } from './ordenes.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mock del PrismaService.
 * `$transaction` soporta los dos contratos que usa el service:
 *  - array: `prisma.$transaction([p1, p2])` → ejecuta y devuelve resultados en orden
 *  - callback: `prisma.$transaction(async (tx) => ...)` → invoca con un "tx" mock
 *    que delega en los mismos métodos de prisma.
 */
function buildPrismaMock() {
  const mock = {
    equipo: {
      findFirst: jest.fn(),
    },
    ordenTrabajo: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{}]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      // callback signature → pasamos el mismo mock como "tx"
      return (arg as (tx: typeof mock) => Promise<unknown>)(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    throw new Error('Unexpected $transaction argument');
  });

  return mock;
}

const TENANT = 'tenant-1';
const USER = 'user-admin';
const EQUIPO_ID = 'eq-1';
const OT_ID = 'ot-1';

describe('OrdenesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: OrdenesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new OrdenesService(prisma as unknown as PrismaService);
  });

  // ---------- create ----------

  describe('create', () => {
    beforeEach(() => {
      prisma.equipo.findFirst.mockResolvedValue({ id: EQUIPO_ID });
    });

    it('crea OT en estado PENDIENTE', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null); // no hay códigos previos
      prisma.ordenTrabajo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: OT_ID, ...data }),
      );

      const result = await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'Mantención preventiva',
        prioridad: Prioridad.ALTA,
      });

      const createArgs = prisma.ordenTrabajo.create.mock.calls[0][0];
      expect(createArgs.data.estado).toBe(OrdenTrabajoEstado.PENDIENTE);
      expect(createArgs.data.creadoPorId).toBe(USER);
      expect(createArgs.data.tenantId).toBe(TENANT);
      expect(result.estado).toBe(OrdenTrabajoEstado.PENDIENTE);
    });

    it('genera código con formato OT-YYYY-0001 cuando es el primero del año', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
      prisma.ordenTrabajo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: OT_ID, ...data }),
      );

      const year = new Date().getUTCFullYear();
      await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'x',
      });

      const createArgs = prisma.ordenTrabajo.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`OT-${year}-0001`);
    });

    it('incrementa la secuencia desde el último código del año', async () => {
      const year = new Date().getUTCFullYear();
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        codigo: `OT-${year}-0041`,
      });
      prisma.ordenTrabajo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: OT_ID, ...data }),
      );

      await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'x',
      });

      const createArgs = prisma.ordenTrabajo.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`OT-${year}-0042`);
    });

    it('toma advisory lock por tenant/año dentro de la transacción', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
      prisma.ordenTrabajo.create.mockResolvedValue({ id: OT_ID });

      await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'x',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('falla si el equipo no existe en el tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT, USER, {
          equipoId: 'no-existe',
          descripcion: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ordenTrabajo.create).not.toHaveBeenCalled();
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('permite actualizar si la OT está PENDIENTE', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ordenTrabajo.update.mockResolvedValue({
        id: OT_ID,
        descripcion: 'nueva',
      });

      const result = await service.update(TENANT, OT_ID, {
        descripcion: 'nueva',
      });

      expect(prisma.ordenTrabajo.update).toHaveBeenCalled();
      expect(result.descripcion).toBe('nueva');
    });

    it.each([
      OrdenTrabajoEstado.EN_PROCESO,
      OrdenTrabajoEstado.CERRADA,
      OrdenTrabajoEstado.CANCELADA,
    ])('falla con ConflictException si la OT está %s', async (estado) => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({ id: OT_ID, estado });

      await expect(
        service.update(TENANT, OT_ID, { descripcion: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
    });

    it('falla con NotFoundException si la OT no existe en el tenant', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT, OT_ID, { descripcion: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lanza BadRequestException si el body viene vacío (sin descripcion ni prioridad)', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });

      await expect(service.update(TENANT, OT_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
    });
  });

  // ---------- cancelar ----------

  describe('cancelar', () => {
    it('cambia estado a CANCELADA cuando viene de PENDIENTE', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ordenTrabajo.update.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.CANCELADA,
      });
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.cancelar(TENANT, OT_ID);

      const updateArgs = prisma.ordenTrabajo.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(OrdenTrabajoEstado.CANCELADA);
      expect(updateArgs.data.fechaCierre).toBeInstanceOf(Date);
      expect(result.estado).toBe(OrdenTrabajoEstado.CANCELADA);
    });

    it('permite cancelar desde EN_PROCESO', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ordenTrabajo.update.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.CANCELADA,
      });
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancelar(TENANT, OT_ID)).resolves.toBeDefined();
    });

    it('cancela solo tickets en estado PENDIENTE', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ordenTrabajo.update.mockResolvedValue({ id: OT_ID });
      prisma.ticket.updateMany.mockResolvedValue({ count: 2 });

      await service.cancelar(TENANT, OT_ID);

      const ticketArgs = prisma.ticket.updateMany.mock.calls[0][0];
      expect(ticketArgs.where.otId).toBe(OT_ID);
      expect(ticketArgs.where.tenantId).toBe(TENANT);
      expect(ticketArgs.where.estado).toEqual({
        in: [TicketEstado.PENDIENTE],
      });
      expect(ticketArgs.data.estado).toBe(TicketEstado.CANCELADO);
    });

    it.each([OrdenTrabajoEstado.CERRADA, OrdenTrabajoEstado.CANCELADA])(
      'falla con ConflictException si la OT ya está %s',
      async (estado) => {
        prisma.ordenTrabajo.findFirst.mockResolvedValue({ id: OT_ID, estado });

        await expect(service.cancelar(TENANT, OT_ID)).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
      },
    );

    it('lanza NotFoundException si la OT pertenece a otro tenant', async () => {
      // doble filtro id+tenantId en findFirst → no match → null
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);

      await expect(service.cancelar('otro-tenant', OT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      const findArgs = prisma.ordenTrabajo.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({ id: OT_ID, tenantId: 'otro-tenant' });
      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
      expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    });

    it('NO cancela tickets en estado ASIGNADO/EN_EJECUCION/EJECUTADO/CERRADO', async () => {
      // El filtro `estado: { in: [PENDIENTE] }` se valida en otro test.
      // Aquí confirmamos que ninguno de los demás estados aparece en el `in`.
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ordenTrabajo.update.mockResolvedValue({ id: OT_ID });
      prisma.ticket.updateMany.mockResolvedValue({ count: 0 });

      await service.cancelar(TENANT, OT_ID);

      const ticketArgs = prisma.ticket.updateMany.mock.calls[0][0];
      const cancelables = ticketArgs.where.estado.in as TicketEstado[];
      expect(cancelables).not.toContain(TicketEstado.ASIGNADO);
      expect(cancelables).not.toContain(TicketEstado.EN_EJECUCION);
      expect(cancelables).not.toContain(TicketEstado.EJECUTADO);
      expect(cancelables).not.toContain(TicketEstado.CERRADO);
    });
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('incluye tickets relacionados y equipo', async () => {
      const detalle = {
        id: OT_ID,
        codigo: 'OT-2026-0001',
        equipo: { id: EQUIPO_ID, codigo: 'EQ-001', nombre: 'X' },
        tickets: [
          { id: 't1', codigo: 'TK-1', estado: TicketEstado.PENDIENTE },
        ],
      };
      prisma.ordenTrabajo.findFirst.mockResolvedValue(detalle);

      const result = await service.findOne(TENANT, OT_ID);

      const findArgs = prisma.ordenTrabajo.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({ id: OT_ID, tenantId: TENANT });
      expect(findArgs.include).toMatchObject({
        equipo: expect.any(Object),
        tickets: expect.any(Object),
      });
      expect(result.tickets).toHaveLength(1);
    });

    it('falla con NotFoundException si no existe', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT, OT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lanza NotFoundException si la OT pertenece a otro tenant', async () => {
      // doble filtro id+tenantId garantiza aislamiento entre tenants
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);

      await expect(service.findOne('otro-tenant', OT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const findArgs = prisma.ordenTrabajo.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({ id: OT_ID, tenantId: 'otro-tenant' });
    });
  });

  // ---------- hooks integración tickets ----------

  describe('onTicketCreated', () => {
    it('mueve OT PENDIENTE → EN_PROCESO via updateMany filtrando estado', async () => {
      prisma.ordenTrabajo.updateMany.mockResolvedValue({ count: 1 });

      await service.onTicketCreated(TENANT, OT_ID);

      const args = prisma.ordenTrabajo.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({
        id: OT_ID,
        tenantId: TENANT,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      expect(args.data).toEqual({ estado: OrdenTrabajoEstado.EN_PROCESO });
    });

    it('es idempotente: si la OT ya está EN_PROCESO, no cambia nada (updateMany match 0)', async () => {
      prisma.ordenTrabajo.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.onTicketCreated(TENANT, OT_ID),
      ).resolves.toBeUndefined();
    });
  });

  describe('onTicketEstadoCambiado', () => {
    it('cierra la OT cuando todos los tickets están CERRADOS', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(3); // cerrados
      prisma.ordenTrabajo.update.mockResolvedValue({ id: OT_ID });

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      const args = prisma.ordenTrabajo.update.mock.calls[0][0];
      expect(args.data.estado).toBe(OrdenTrabajoEstado.CERRADA);
      expect(args.data.fechaCierre).toBeInstanceOf(Date);
    });

    it('no cierra la OT si aún hay tickets no cerrados', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2); // cerrados

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
    });

    it('no toca OTs que no estén EN_PROCESO (transición inválida bloqueada)', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.CERRADA,
      });

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      expect(prisma.ticket.count).not.toHaveBeenCalled();
      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
    });

    it('no cierra si la OT no tiene tickets (count total = 0)', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count.mockResolvedValueOnce(0);

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('aplica filtros estado y equipoId y siempre filtra por tenant', async () => {
      prisma.ordenTrabajo.findMany.mockResolvedValue([]);
      prisma.ordenTrabajo.count.mockResolvedValue(0);

      await service.findAll(TENANT, {
        estado: OrdenTrabajoEstado.PENDIENTE,
        equipoId: EQUIPO_ID,
        page: 1,
        limit: 10,
      });

      const findArgs = prisma.ordenTrabajo.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({
        tenantId: TENANT,
        estado: OrdenTrabajoEstado.PENDIENTE,
        equipoId: EQUIPO_ID,
      });
    });

    it('retorna estructura paginada { data, meta } con totalPages calculado', async () => {
      const rows = [
        {
          id: OT_ID,
          codigo: 'OT-2026-0001',
          equipoId: EQUIPO_ID,
          descripcion: 'd',
          prioridad: Prioridad.MEDIA,
          estado: OrdenTrabajoEstado.PENDIENTE,
          fechaCierre: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.ordenTrabajo.findMany.mockResolvedValue(rows);
      prisma.ordenTrabajo.count.mockResolvedValue(23);

      const result = await service.findAll(TENANT, { page: 2, limit: 10 });

      expect(prisma.ordenTrabajo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result).toEqual({
        data: rows,
        meta: { page: 2, limit: 10, total: 23, totalPages: 3 },
      });
    });

    it('aplica defaults page=1 limit=10 cuando el query viene vacío', async () => {
      prisma.ordenTrabajo.findMany.mockResolvedValue([]);
      prisma.ordenTrabajo.count.mockResolvedValue(0);

      const result = await service.findAll(TENANT, {});

      expect(prisma.ordenTrabajo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });
  });
});
