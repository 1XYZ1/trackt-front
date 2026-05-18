import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase.service';
import { AuthUser } from '../auth/types';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import {
  ALLOWED_MIME,
  AllowedMime,
  MAX_BYTES,
  RequestUploadDto,
} from './dto/request-upload.dto';
import {
  EvidenciaResponseDto,
  UploadSignedUrlResponseDto,
} from './dto/evidencia-response.dto';

const BUCKET = 'evidencias';
// Nota: el SDK v2 de Supabase NO permite TTL custom en createSignedUploadUrl.
// El TTL real del token lo controla el servidor de Supabase (varía por versión,
// orden de magnitud ~10 min). UPLOAD_TTL_SECONDS es el valor que reportamos al
// frontend en `expiresIn` como contrato/UX. Si más adelante el SDK expone TTL
// configurable, este es el único lugar a tocar.
const UPLOAD_TTL_SECONDS = 60;
const DOWNLOAD_TTL_SECONDS = 5 * 60;

const MIME_TO_EXT: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Extensiones aceptadas en el storagePath (set inverso a MIME_TO_EXT).
const ALLOWED_EXTS = new Set(Object.values(MIME_TO_EXT));

@Injectable()
export class EvidenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async requestUploadUrl(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
    dto: RequestUploadDto,
  ): Promise<UploadSignedUrlResponseDto> {
    if (dto.size > MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Tamaño excede el máximo permitido (${MAX_BYTES} bytes)`,
      );
    }
    if (!ALLOWED_MIME.includes(dto.mime)) {
      throw new ForbiddenException('MIME type no permitido');
    }

    await this.ensureTicketAccess(tenantId, user, ticketId);

    const ext = MIME_TO_EXT[dto.mime];
    const storagePath = `${tenantId}/${ticketId}/${randomUUID()}.${ext}`;

    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(
        `No se pudo generar signed URL: ${error?.message ?? 'desconocido'}`,
      );
    }

    return {
      uploadUrl: data.signedUrl,
      token: data.token,
      storagePath,
      expiresIn: UPLOAD_TTL_SECONDS,
    };
  }

  async confirmUpload(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
    dto: ConfirmUploadDto,
  ): Promise<EvidenciaResponseDto> {
    await this.ensureTicketAccess(tenantId, user, ticketId);

    // Defensa contra path traversal / tenant ajeno / extensión inválida.
    // Se valida AQUÍ además de la policy RLS de storage.objects para que el
    // backend rechace antes de tocar Storage incluso si la RLS falla.
    this.assertSafeStoragePath(dto.storagePath, tenantId, ticketId);

    const filename = dto.storagePath.split('/').pop() ?? '';
    const admin = this.supabase.getAdminClient();
    const { data: head, error: headError } = await admin.storage
      .from(BUCKET)
      .list(`${tenantId}/${ticketId}`, { search: filename });
    if (headError || !head || head.length === 0) {
      throw new NotFoundException(
        'Archivo no encontrado en storage; subida no completada',
      );
    }
    // `list()` retorna múltiples si el `search` matchea como prefijo. Buscamos
    // la fila exacta por nombre para leer su metadata real.
    const fileEntry = head.find((h: { name: string }) => h.name === filename);
    if (!fileEntry) {
      throw new NotFoundException(
        'Archivo no encontrado en storage; subida no completada',
      );
    }

    // Re-validar MIME y size leyendo metadata real del objeto, no del DTO
    // (el cliente podría haber subido algo distinto a lo declarado).
    const meta = (fileEntry as { metadata?: { size?: number; mimetype?: string } })
      .metadata;
    if (meta) {
      if (typeof meta.size === 'number' && meta.size > MAX_BYTES) {
        throw new PayloadTooLargeException(
          `Archivo subido excede el máximo (${meta.size} > ${MAX_BYTES} bytes)`,
        );
      }
      if (
        typeof meta.mimetype === 'string' &&
        !ALLOWED_MIME.includes(meta.mimetype as AllowedMime)
      ) {
        throw new BadRequestException(
          `MIME real del archivo no permitido: ${meta.mimetype}`,
        );
      }
    }

    const row = await this.prisma.evidencia.create({
      data: {
        ticketId,
        storagePath: dto.storagePath,
        descripcion: dto.descripcion ?? null,
        subidoPorId: user.id,
      },
    });

    return {
      id: row.id,
      ticketId: row.ticketId,
      storagePath: row.storagePath,
      descripcion: row.descripcion,
      subidoPorId: row.subidoPorId,
      createdAt: row.createdAt.toISOString(),
      downloadUrl: await this.signDownload(row.storagePath),
    };
  }

  async listForTicket(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
  ): Promise<EvidenciaResponseDto[]> {
    await this.ensureTicketAccess(tenantId, user, ticketId);

    const rows = await this.prisma.evidencia.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        ticketId: row.ticketId,
        storagePath: row.storagePath,
        descripcion: row.descripcion,
        subidoPorId: row.subidoPorId,
        createdAt: row.createdAt.toISOString(),
        downloadUrl: await this.signDownload(row.storagePath),
      })),
    );
  }

  // ---------- Helpers ----------

  /**
   * Valida que el ticket pertenezca al tenant y que el usuario tenga acceso:
   * - admin: siempre puede sobre tickets del tenant
   * - mechanic: solo si está asignado al ticket
   */
  private async ensureTicketAccess(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
  ): Promise<void> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, mecanicoId: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket "${ticketId}" no encontrado`);
    }

    if (user.role === 'admin') return;
    if (user.role === 'mechanic' && ticket.mecanicoId === user.id) return;

    throw new ForbiddenException('Sin acceso a evidencias de este ticket');
  }

  /**
   * Valida que el storagePath:
   *   - sea exactamente `{tenant}/{ticket}/{filename}` (3 segmentos)
   *   - no contenga `..` ni `\` (path traversal)
   *   - termine en una extensión permitida (jpg/png/webp)
   * Defensa en profundidad sobre la policy RLS de storage.objects.
   */
  private assertSafeStoragePath(
    storagePath: string,
    tenantId: string,
    ticketId: string,
  ): void {
    if (storagePath.includes('..') || storagePath.includes('\\')) {
      throw new ForbiddenException('storagePath contiene segmentos inválidos');
    }
    const segments = storagePath.split('/');
    if (segments.length !== 3) {
      throw new ForbiddenException(
        'storagePath debe tener forma {tenant}/{ticket}/{filename}',
      );
    }
    const [pathTenant, pathTicket, filename] = segments;
    if (pathTenant !== tenantId || pathTicket !== ticketId) {
      throw new ForbiddenException(
        'storagePath no coincide con tenant/ticket actual',
      );
    }
    if (!filename || filename.startsWith('.')) {
      throw new ForbiddenException('filename inválido');
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTS.has(ext)) {
      throw new BadRequestException(
        `Extensión de archivo no permitida: .${ext ?? ''}`,
      );
    }
  }

  private async signDownload(storagePath: string): Promise<string | null> {
    const admin = this.supabase.getAdminClient();
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, DOWNLOAD_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl;
  }
}
