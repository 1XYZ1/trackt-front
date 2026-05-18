import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeRol } from './dto/list-usuarios-query.dto';

const TENANT = 'tenant-1';

function buildPrismaMock() {
  return {
    $queryRaw: jest.fn(),
  };
}

/**
 * El service compone la query con Prisma.sql / Prisma.join. Cuando jest
 * intercepta $queryRaw, los argumentos son:
 *   args[0] = TemplateStringsArray (chunks de SQL)
 *   args[1..] = valores interpolados (incluye Prisma.Sql con .values internas)
 *
 * Recolectamos todos los valores escalares aplanados para poder asertar que
 * tenantId / 'mechanic' / search llegan correctamente parametrizados.
 */
function flattenValues(args: unknown[]): unknown[] {
  const flat: unknown[] = [];
  for (let i = 1; i < args.length; i++) {
    const v = args[i];
    if (
      v &&
      typeof v === 'object' &&
      Array.isArray((v as { values?: unknown[] }).values)
    ) {
      flat.push(...(v as { values: unknown[] }).values);
    } else {
      flat.push(v);
    }
  }
  return flat;
}

describe('UsuariosService', () => {
  let service: UsuariosService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new UsuariosService(prisma as unknown as PrismaService);
  });

  describe('normalizeRol (DTO helper)', () => {
    it('mapea "mecanico" → "mechanic"', () => {
      expect(normalizeRol('mecanico')).toBe('mechanic');
    });

    it('mapea "MECANICO" (case-insensitive) → "mechanic"', () => {
      expect(normalizeRol('MECANICO')).toBe('mechanic');
    });

    it('acepta "mechanic" directamente', () => {
      expect(normalizeRol('mechanic')).toBe('mechanic');
    });

    it('acepta "admin"', () => {
      expect(normalizeRol('admin')).toBe('admin');
    });

    it('undefined → undefined', () => {
      expect(normalizeRol(undefined)).toBeUndefined();
    });
  });

  describe('findAll', () => {
    const rows = [
      {
        id: '00000000-0000-0000-0000-000000000010',
        email: 'mec1@trackt.demo',
        full_name: 'Mecanico Uno',
        role: 'mechanic',
      },
    ];

    beforeEach(() => {
      // Por orden de llamada: primero data, luego count
      prisma.$queryRaw
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce([{ count: BigInt(1) }]);
    });

    it('filtra por p.tenant_id usando el tenant del usuario', async () => {
      await service.findAll(TENANT, { page: 1, limit: 10 });

      const dataCallArgs = prisma.$queryRaw.mock.calls[0] as unknown[];
      const values = flattenValues(dataCallArgs);
      expect(values).toContain(TENANT);
    });

    it('normaliza rol=mecanico a "mechanic" y lo pasa como parámetro', async () => {
      await service.findAll(TENANT, { page: 1, limit: 10, rol: 'mecanico' });

      const dataCallArgs = prisma.$queryRaw.mock.calls[0] as unknown[];
      const values = flattenValues(dataCallArgs);
      expect(values).toContain('mechanic');
      // y NO debe pasar el alias en español al SQL
      expect(values).not.toContain('mecanico');
    });

    it('cuando no se pasa rol, no se añade el parámetro de role', async () => {
      await service.findAll(TENANT, { page: 1, limit: 10 });

      const dataCallArgs = prisma.$queryRaw.mock.calls[0] as unknown[];
      const values = flattenValues(dataCallArgs);
      expect(values).not.toContain('mechanic');
      expect(values).not.toContain('admin');
    });

    it('search se incluye con wildcards %...%', async () => {
      await service.findAll(TENANT, {
        page: 1,
        limit: 10,
        search: 'juan',
      });

      const dataCallArgs = prisma.$queryRaw.mock.calls[0] as unknown[];
      const values = flattenValues(dataCallArgs);
      expect(values).toContain('%juan%');
    });

    it('respuesta tiene forma { data, meta } con totalPages calculado', async () => {
      const result = await service.findAll(TENANT, { page: 1, limit: 10 });

      expect(result).toEqual({
        data: [
          {
            id: rows[0].id,
            email: rows[0].email,
            fullName: rows[0].full_name,
            role: rows[0].role,
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });

    it('aplica limit/offset (page=3, limit=5 → offset 10)', async () => {
      await service.findAll(TENANT, { page: 3, limit: 5 });

      const dataCallArgs = prisma.$queryRaw.mock.calls[0] as unknown[];
      const values = flattenValues(dataCallArgs);
      expect(values).toContain(5); // limit
      expect(values).toContain(10); // offset = (3-1)*5
    });
  });
});
