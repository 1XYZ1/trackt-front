import { NotFoundException } from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { PrismaService } from '../prisma/prisma.service';

const TENANT = 'tenant-1';
const OTRO_TENANT = 'tenant-2';

function buildPrismaMock() {
  const mock = {
    equipo: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Soporte para $transaction([p1, p2]) → Promise.all
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    throw new Error('Unexpected $transaction argument');
  });

  return mock;
}

describe('EquiposService', () => {
  let service: EquiposService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new EquiposService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('filtra por tenantId y devuelve respuesta paginada con meta', async () => {
      const rows = [
        {
          id: 'eq-1',
          codigo: 'EQ-001',
          nombre: 'Camion 1',
          marca: 'CAT',
          modelo: '793F',
          ubicacion: 'Rajo',
        },
      ];
      prisma.equipo.findMany.mockResolvedValue(rows);
      prisma.equipo.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT, { page: 1, limit: 10 });

      expect(prisma.equipo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT },
          skip: 0,
          take: 10,
        }),
      );
      expect(prisma.equipo.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT },
      });

      expect(result).toEqual({
        data: rows,
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });

    it('aplica paginación (skip/take) basados en page/limit', async () => {
      prisma.equipo.findMany.mockResolvedValue([]);
      prisma.equipo.count.mockResolvedValue(0);

      await service.findAll(TENANT, { page: 3, limit: 5 });

      expect(prisma.equipo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('aplica search en OR sobre múltiples campos', async () => {
      prisma.equipo.findMany.mockResolvedValue([]);
      prisma.equipo.count.mockResolvedValue(0);

      await service.findAll(TENANT, { page: 1, limit: 10, search: 'cami' });

      const call = prisma.equipo.findMany.mock.calls[0][0];
      expect(call.where.tenantId).toBe(TENANT);
      expect(call.where.OR).toEqual(
        expect.arrayContaining([
          { codigo: { contains: 'cami', mode: 'insensitive' } },
          { nombre: { contains: 'cami', mode: 'insensitive' } },
        ]),
      );
    });

    it('aplica defaults page=1 limit=10 cuando no se pasan', async () => {
      prisma.equipo.findMany.mockResolvedValue([]);
      prisma.equipo.count.mockResolvedValue(0);

      const result = await service.findAll(TENANT, {});

      expect(prisma.equipo.findMany).toHaveBeenCalledWith(
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

  describe('findOne', () => {
    it('busca por id + tenantId y retorna el equipo', async () => {
      const equipo = {
        id: 'eq-1',
        codigo: 'EQ-001',
        nombre: 'Camion 1',
        marca: 'CAT',
        modelo: '793F',
        ubicacion: 'Rajo',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.equipo.findFirst.mockResolvedValue(equipo);

      const result = await service.findOne(TENANT, 'eq-1');

      expect(prisma.equipo.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1', tenantId: TENANT },
        }),
      );
      expect(result).toBe(equipo);
    });

    it('lanza NotFoundException si el equipo no existe', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT, 'no-existe')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lanza NotFoundException si el equipo pertenece a otro tenant', async () => {
      // Prisma con doble filtro id + tenantId → no match → null
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(service.findOne(OTRO_TENANT, 'eq-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.equipo.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eq-1', tenantId: OTRO_TENANT },
        }),
      );
    });
  });
});
