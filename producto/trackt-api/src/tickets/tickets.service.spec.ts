import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  OrdenTrabajoEstado,
  Prioridad,
  TicketEstado,
} from '@prisma/client';
import { TicketsService } from './tickets.service';
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
    ordenTrabajo: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
    },
    eventoEstadoTicket: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{}]),
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
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
const OT_ID = 'ot-1';
const TICKET_ID = 'tk-1';

describe('TicketsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: TicketsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new TicketsService(prisma as unknown as PrismaService);
  });

  // ---------- createFromOrden ----------

  describe('createFromOrden', () => {
    function mockCreateChain({
      otEstado = OrdenTrabajoEstado.PENDIENTE,
      lastCodigo = null as string | null,
    } = {}) {
      // findFirst se llama dos veces: una para validación previa y otra
      // dentro de la TX para cerrar la ventana de carrera.
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: otEstado,
      });
      prisma.ticket.findFirst.mockResolvedValueOnce(
        lastCodigo ? { codigo: lastCodigo } : null,
      );
      prisma.ticket.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: TICKET_ID, ...data }),
      );
      prisma.eventoEstadoTicket.create.mockResolvedValue({ id: 'evt-1' });
      prisma.ordenTrabajo.updateMany.mockResolvedValue({ count: 1 });
      prisma.ticket.findUniqueOrThrow.mockImplementation(({ where }) =>
        Promise.resolve({
          id: where.id,
          codigo: 'TKT-X',
          ot: { id: OT_ID, codigo: 'OT-1', estado: 'EN_PROCESO', equipoId: 'eq-1' },
          eventos: [],
        }),
      );
    }

    it('crea ticket en estado PENDIENTE con tenantId, otId y jefeId', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 'Falla motor',
        descripcion: 'Detalle',
        prioridad: Prioridad.ALTA,
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT);
      expect(createArgs.data.otId).toBe(OT_ID);
      expect(createArgs.data.jefeId).toBe(USER);
      expect(createArgs.data.estado).toBe(TicketEstado.PENDIENTE);
      expect(createArgs.data.prioridad).toBe(Prioridad.ALTA);
      expect(createArgs.data.titulo).toBe('Falla motor');
    });

    it('aplica prioridad MEDIA por defecto cuando no viene en el DTO', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.prioridad).toBe(Prioridad.MEDIA);
    });

    it('genera código TKT-YYYY-0001 cuando no hay tickets previos del año', async () => {
      mockCreateChain({ lastCodigo: null });

      const year = new Date().getUTCFullYear();
      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`TKT-${year}-0001`);
    });

    it('incrementa la secuencia desde el último código del año', async () => {
      const year = new Date().getUTCFullYear();
      mockCreateChain({ lastCodigo: `TKT-${year}-0041` });

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`TKT-${year}-0042`);
    });

    it('crea evento inicial con estadoAnterior=null y estadoNuevo=PENDIENTE', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const evtArgs = prisma.eventoEstadoTicket.create.mock.calls[0][0];
      expect(evtArgs.data.estadoAnterior).toBeNull();
      expect(evtArgs.data.estadoNuevo).toBe(TicketEstado.PENDIENTE);
      expect(evtArgs.data.usuarioId).toBe(USER);
      expect(evtArgs.data.ticketId).toBe(TICKET_ID);
      expect(evtArgs.data.observacion).toBe('Ticket creado');
    });

    it('si la OT está PENDIENTE, la transiciona a EN_PROCESO con updateMany filtrando por id/tenant/estado', async () => {
      mockCreateChain({ otEstado: OrdenTrabajoEstado.PENDIENTE });

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      expect(prisma.ordenTrabajo.updateMany).toHaveBeenCalledTimes(1);
      const args = prisma.ordenTrabajo.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({
        id: OT_ID,
        tenantId: TENANT,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      expect(args.data).toEqual({ estado: OrdenTrabajoEstado.EN_PROCESO });
    });

    it('no actualiza la OT si ya está EN_PROCESO', async () => {
      mockCreateChain({ otEstado: OrdenTrabajoEstado.EN_PROCESO });

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
    });

    it('toma advisory lock por tenant/año dentro de la transacción', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      // primera llamada al transaction es callback
      const arg = prisma.$transaction.mock.calls[0][0];
      expect(typeof arg).toBe('function');
    });

    it('atomicidad: si falla updateMany de la OT, no se retorna ticket (rollback) y la creación ocurre dentro del callback transaccional', async () => {
      // Ambas lecturas de OT (la inicial fuera y la re-validación dentro de TX)
      // devuelven el mismo estado PENDIENTE.
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ticket.findFirst.mockResolvedValueOnce(null);
      prisma.ticket.create.mockResolvedValue({ id: TICKET_ID });
      prisma.eventoEstadoTicket.create.mockResolvedValue({ id: 'evt-1' });
      const dbErr = new Error('DB write conflict');
      prisma.ordenTrabajo.updateMany.mockRejectedValueOnce(dbErr);

      // $transaction callback debe propagar el error → rollback
      prisma.$transaction.mockImplementationOnce(async (cb: unknown) => {
        if (typeof cb === 'function') {
          // ejecutamos el callback; si falla, propagamos
          return (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
        }
        return undefined;
      });

      await expect(
        service.createFromOrden(TENANT, USER, OT_ID, {
          titulo: 't',
          descripcion: 'd',
        }),
      ).rejects.toBe(dbErr);

      // ticket.create y eventoEstadoTicket.create ocurrieron dentro del callback
      expect(prisma.ticket.create).toHaveBeenCalled();
      expect(prisma.eventoEstadoTicket.create).toHaveBeenCalled();
      // pero el findUniqueOrThrow final no se ejecutó (rollback simulado)
      expect(prisma.ticket.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('falla con NotFoundException si la OT no existe en el tenant', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createFromOrden(TENANT, USER, 'no-existe', {
          titulo: 't',
          descripcion: 'd',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });

    it.each([OrdenTrabajoEstado.CERRADA, OrdenTrabajoEstado.CANCELADA])(
      'falla con ConflictException si la OT está %s',
      async (estado) => {
        prisma.ordenTrabajo.findFirst.mockResolvedValueOnce({
          id: OT_ID,
          estado,
        });

        await expect(
          service.createFromOrden(TENANT, USER, OT_ID, {
            titulo: 't',
            descripcion: 'd',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.ticket.create).not.toHaveBeenCalled();
      },
    );

    it('cierra ventana de carrera: si la OT pasa a CANCELADA entre las dos lecturas, lanza ConflictException dentro de la TX y no crea ticket', async () => {
      // 1ª lectura (fuera de TX): la OT está PENDIENTE → pasa validación
      // 2ª lectura (dentro de TX): la OT ya fue cancelada por otro proceso
      prisma.ordenTrabajo.findFirst
        .mockResolvedValueOnce({
          id: OT_ID,
          estado: OrdenTrabajoEstado.PENDIENTE,
        })
        .mockResolvedValueOnce({
          id: OT_ID,
          estado: OrdenTrabajoEstado.CANCELADA,
        });

      await expect(
        service.createFromOrden(TENANT, USER, OT_ID, {
          titulo: 't',
          descripcion: 'd',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(prisma.eventoEstadoTicket.create).not.toHaveBeenCalled();
      expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('aplica filtros estado, mecanicoId y otId, y siempre filtra por tenant', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, {
        estado: TicketEstado.PENDIENTE,
        mecanicoId: 'mec-1',
        otId: OT_ID,
        page: 1,
        limit: 10,
      });

      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({
        tenantId: TENANT,
        estado: TicketEstado.PENDIENTE,
        mecanicoId: 'mec-1',
        otId: OT_ID,
      });
      expect(findArgs.orderBy).toEqual({ createdAt: 'desc' });
      expect(findArgs.include).toMatchObject({ ot: expect.any(Object) });
    });

    it('omite filtros vacíos pero conserva el tenant', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, { page: 1, limit: 5 });

      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({ tenantId: TENANT });
      expect(findArgs.take).toBe(5);
      expect(findArgs.skip).toBe(0);
    });

    it('retorna estructura paginada con meta calculado', async () => {
      const rows = [
        { id: 't1', codigo: 'TKT-1', ot: { id: OT_ID } },
        { id: 't2', codigo: 'TKT-2', ot: { id: OT_ID } },
      ];
      prisma.ticket.findMany.mockResolvedValue(rows);
      prisma.ticket.count.mockResolvedValue(12);

      const result = await service.findAll(TENANT, { page: 2, limit: 5 });

      expect(result.data).toEqual(rows);
      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      });
      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.skip).toBe(5);
      expect(findArgs.take).toBe(5);
    });
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('busca por id + tenant e incluye OT padre y eventos ordenados asc', async () => {
      const detalle = {
        id: TICKET_ID,
        codigo: 'TKT-2026-0001',
        ot: {
          id: OT_ID,
          codigo: 'OT-2026-0001',
          estado: OrdenTrabajoEstado.EN_PROCESO,
          equipoId: 'eq-1',
        },
        eventos: [
          {
            id: 'evt-1',
            estadoAnterior: null,
            estadoNuevo: TicketEstado.PENDIENTE,
          },
        ],
      };
      prisma.ticket.findFirst.mockResolvedValue(detalle);

      const result = await service.findOne(TENANT, TICKET_ID);

      const findArgs = prisma.ticket.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({ id: TICKET_ID, tenantId: TENANT });
      expect(findArgs.include).toMatchObject({
        ot: expect.any(Object),
        eventos: { orderBy: { createdAt: 'asc' } },
      });
      expect(result).toBe(detalle);
    });

    it('falla con NotFoundException si no existe', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT, TICKET_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
