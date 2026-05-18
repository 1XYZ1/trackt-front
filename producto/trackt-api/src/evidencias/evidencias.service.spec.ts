import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { EvidenciasService } from './evidencias.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase.service';
import { AuthUser } from '../auth/types';
import { MAX_BYTES } from './dto/request-upload.dto';

const TENANT = 'demo';
const TICKET_ID = 'tk-1';
const ADMIN: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  role: 'admin',
  tenantId: TENANT,
  email: 'admin@trackt.demo',
};
const MEC: AuthUser = {
  id: '00000000-0000-0000-0000-000000000002',
  role: 'mechanic',
  tenantId: TENANT,
  email: 'mec@trackt.demo',
};

function buildMocks() {
  const prisma = {
    ticket: { findFirst: jest.fn() },
    evidencia: { create: jest.fn(), findMany: jest.fn() },
  };

  const storageApi = {
    createSignedUploadUrl: jest.fn(),
    createSignedUrl: jest.fn(),
    list: jest.fn(),
  };

  const supabase = {
    getAdminClient: jest.fn().mockReturnValue({
      storage: { from: () => storageApi },
    }),
  };

  return { prisma, supabase, storageApi };
}

describe('EvidenciasService', () => {
  let service: EvidenciasService;
  let prisma: ReturnType<typeof buildMocks>['prisma'];
  let supabase: ReturnType<typeof buildMocks>['supabase'];
  let storageApi: ReturnType<typeof buildMocks>['storageApi'];

  beforeEach(() => {
    const mocks = buildMocks();
    prisma = mocks.prisma;
    supabase = mocks.supabase;
    storageApi = mocks.storageApi;
    service = new EvidenciasService(
      prisma as unknown as PrismaService,
      supabase as unknown as SupabaseService,
    );
  });

  describe('requestUploadUrl', () => {
    const dto = { mime: 'image/jpeg' as const, size: 1000 };

    it('admin: genera signed URL con path bien formado', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: null,
      });
      storageApi.createSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'https://x/up', token: 'tok' },
        error: null,
      });

      const result = await service.requestUploadUrl(
        TENANT,
        ADMIN,
        TICKET_ID,
        dto,
      );

      expect(result.uploadUrl).toBe('https://x/up');
      expect(result.token).toBe('tok');
      expect(result.storagePath).toMatch(
        new RegExp(`^${TENANT}/${TICKET_ID}/[0-9a-f-]+\\.jpg$`),
      );
    });

    it('usa el bucket "evidencias" al pedir el signed upload URL', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: null,
      });
      storageApi.createSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'u', token: 't' },
        error: null,
      });
      const bucketSpy = jest.fn().mockReturnValue(storageApi);
      supabase.getAdminClient.mockReturnValue({ storage: { from: bucketSpy } });

      await service.requestUploadUrl(TENANT, ADMIN, TICKET_ID, dto);
      expect(bucketSpy).toHaveBeenCalledWith('evidencias');
    });

    it('expiresIn refleja el TTL declarado (60s) que el contrato expone al frontend', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: null,
      });
      storageApi.createSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'u', token: 't' },
        error: null,
      });
      const result = await service.requestUploadUrl(
        TENANT,
        ADMIN,
        TICKET_ID,
        dto,
      );
      expect(result.expiresIn).toBe(60);
    });

    it('mechanic asignado: ok', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: MEC.id,
      });
      storageApi.createSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'u', token: 't' },
        error: null,
      });

      await expect(
        service.requestUploadUrl(TENANT, MEC, TICKET_ID, dto),
      ).resolves.toBeDefined();
    });

    it('mechanic NO asignado: Forbidden', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: 'otro-mec',
      });

      await expect(
        service.requestUploadUrl(TENANT, MEC, TICKET_ID, dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('size > 5MB: PayloadTooLarge', async () => {
      await expect(
        service.requestUploadUrl(TENANT, ADMIN, TICKET_ID, {
          mime: 'image/jpeg',
          size: MAX_BYTES + 1,
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('ticket no existe: NotFound', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.requestUploadUrl(TENANT, ADMIN, TICKET_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmUpload', () => {
    it('happy path: crea fila en evidencia con downloadUrl firmada', async () => {
      const storagePath = `${TENANT}/${TICKET_ID}/abc.jpg`;
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      storageApi.list.mockResolvedValue({
        data: [
          {
            name: 'abc.jpg',
            metadata: { size: 1234, mimetype: 'image/jpeg' },
          },
        ],
        error: null,
      });
      prisma.evidencia.create.mockResolvedValue({
        id: 'ev-1',
        ticketId: TICKET_ID,
        storagePath,
        descripcion: 'foto pre',
        subidoPorId: ADMIN.id,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      storageApi.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://x/down' },
        error: null,
      });

      const result = await service.confirmUpload(TENANT, ADMIN, TICKET_ID, {
        storagePath,
        descripcion: 'foto pre',
      });

      expect(result.id).toBe('ev-1');
      expect(result.downloadUrl).toBe('https://x/down');
      expect(prisma.evidencia.create).toHaveBeenCalledWith({
        data: {
          ticketId: TICKET_ID,
          storagePath,
          descripcion: 'foto pre',
          subidoPorId: ADMIN.id,
        },
      });
    });

    it('storagePath de otro tenant: Forbidden', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: null,
      });

      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, {
          storagePath: `otro-tenant/${TICKET_ID}/abc.jpg`,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('archivo no existe en storage: NotFound', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      storageApi.list.mockResolvedValue({ data: [], error: null });

      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, {
          storagePath: `${TENANT}/${TICKET_ID}/abc.jpg`,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('path traversal con ".." → Forbidden', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, {
          storagePath: `${TENANT}/${TICKET_ID}/../../etc/passwd.jpg`,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storageApi.list).not.toHaveBeenCalled();
    });

    it('storagePath con backslash → Forbidden', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, {
          storagePath: `${TENANT}\\${TICKET_ID}\\abc.jpg`,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('storagePath con subdirs extra (más de 3 segmentos) → Forbidden', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, {
          storagePath: `${TENANT}/${TICKET_ID}/sub/abc.jpg`,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('extensión no permitida (.exe) → BadRequest', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, {
          storagePath: `${TENANT}/${TICKET_ID}/malware.exe`,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('Storage reporta MIME real distinto al permitido → BadRequest', async () => {
      const storagePath = `${TENANT}/${TICKET_ID}/abc.jpg`;
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      storageApi.list.mockResolvedValue({
        data: [
          {
            name: 'abc.jpg',
            metadata: { size: 1000, mimetype: 'application/octet-stream' },
          },
        ],
        error: null,
      });

      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, { storagePath }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.evidencia.create).not.toHaveBeenCalled();
    });

    it('Storage reporta size real > 5MB → PayloadTooLarge', async () => {
      const storagePath = `${TENANT}/${TICKET_ID}/abc.jpg`;
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      storageApi.list.mockResolvedValue({
        data: [
          {
            name: 'abc.jpg',
            metadata: {
              size: MAX_BYTES + 100,
              mimetype: 'image/jpeg',
            },
          },
        ],
        error: null,
      });

      await expect(
        service.confirmUpload(TENANT, ADMIN, TICKET_ID, { storagePath }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
      expect(prisma.evidencia.create).not.toHaveBeenCalled();
    });

    it('mechanic no asignado intenta confirmar: Forbidden (sin pegarle a Storage)', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: 'otro-mec',
      });

      await expect(
        service.confirmUpload(TENANT, MEC, TICKET_ID, {
          storagePath: `${TENANT}/${TICKET_ID}/abc.jpg`,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storageApi.list).not.toHaveBeenCalled();
    });
  });

  describe('listForTicket', () => {
    it('retorna evidencias con downloadUrl firmada', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      prisma.evidencia.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          ticketId: TICKET_ID,
          storagePath: `${TENANT}/${TICKET_ID}/a.jpg`,
          descripcion: null,
          subidoPorId: ADMIN.id,
          createdAt: new Date(),
        },
        {
          id: 'ev-2',
          ticketId: TICKET_ID,
          storagePath: `${TENANT}/${TICKET_ID}/b.jpg`,
          descripcion: 'final',
          subidoPorId: ADMIN.id,
          createdAt: new Date(),
        },
      ]);
      storageApi.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://x/d' },
        error: null,
      });

      const result = await service.listForTicket(TENANT, ADMIN, TICKET_ID);

      expect(result).toHaveLength(2);
      expect(result[0].downloadUrl).toBe('https://x/d');
    });

    it('createSignedUrl se llama con TTL 300s (5min) — contrato de download', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: ADMIN.id,
      });
      prisma.evidencia.findMany.mockResolvedValue([
        {
          id: 'ev-1',
          ticketId: TICKET_ID,
          storagePath: `${TENANT}/${TICKET_ID}/a.jpg`,
          descripcion: null,
          subidoPorId: ADMIN.id,
          createdAt: new Date(),
        },
      ]);
      storageApi.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'u' },
        error: null,
      });

      await service.listForTicket(TENANT, ADMIN, TICKET_ID);

      // signature: createSignedUrl(path, expiresInSeconds)
      const args = storageApi.createSignedUrl.mock.calls[0];
      expect(args[1]).toBe(300);
    });

    it('mechanic no asignado al listar → Forbidden (no consulta evidencias)', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: 'otro-mec',
      });

      await expect(
        service.listForTicket(TENANT, MEC, TICKET_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.evidencia.findMany).not.toHaveBeenCalled();
    });

    it('mechanic no asignado: Forbidden', async () => {
      prisma.ticket.findFirst.mockResolvedValue({
        id: TICKET_ID,
        mecanicoId: 'otro',
      });

      await expect(
        service.listForTicket(TENANT, MEC, TICKET_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
