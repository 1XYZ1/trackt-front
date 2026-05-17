import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrdenTrabajoEstado,
  Prioridad,
  Prisma,
  TicketEstado,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';

const OT_SUMMARY_SELECT = {
  id: true,
  codigo: true,
  estado: true,
  equipoId: true,
} satisfies Prisma.OrdenTrabajoSelect;

const LIST_INCLUDE = {
  ot: { select: OT_SUMMARY_SELECT },
} satisfies Prisma.TicketInclude;

const DETAIL_INCLUDE = {
  ot: { select: OT_SUMMARY_SELECT },
  eventos: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear ticket asociado a una OT.
   * - Ticket nace en estado PENDIENTE.
   * - Código único TKT-YYYY-NNNN calculado bajo advisory lock por tenant/año.
   * - Si la OT padre está en PENDIENTE, transiciona a EN_PROCESO en la misma
   *   transacción (atomicidad: o se crea todo, o nada).
   * - Crea el evento inicial del ticket (estadoAnterior=null → PENDIENTE).
   */
  async createFromOrden(
    tenantId: string,
    userId: string,
    otId: string,
    dto: CreateTicketDto,
  ) {
    const ot = await this.prisma.ordenTrabajo.findFirst({
      where: { id: otId, tenantId },
      select: { id: true, estado: true },
    });
    if (!ot) {
      throw new NotFoundException(`Orden con id "${otId}" no encontrada`);
    }
    if (
      ot.estado === OrdenTrabajoEstado.CERRADA ||
      ot.estado === OrdenTrabajoEstado.CANCELADA
    ) {
      throw new ConflictException(
        `No se puede crear ticket sobre una OT en estado ${ot.estado}`,
      );
    }

    const year = new Date().getUTCFullYear();
    const lockKey = `ticket:${tenantId}:${year}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<unknown>`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      // Re-leer la OT dentro de la TX para cerrar la ventana de carrera
      // entre la validación inicial y la creación del ticket. Si entre medio
      // la OT fue cancelada/cerrada, abortamos antes de crear nada.
      const otFresh = await tx.ordenTrabajo.findFirst({
        where: { id: otId, tenantId },
        select: { id: true, estado: true },
      });
      if (!otFresh) {
        throw new NotFoundException(`Orden con id "${otId}" no encontrada`);
      }
      if (
        otFresh.estado === OrdenTrabajoEstado.CERRADA ||
        otFresh.estado === OrdenTrabajoEstado.CANCELADA
      ) {
        throw new ConflictException(
          `No se puede crear ticket sobre una OT en estado ${otFresh.estado}`,
        );
      }

      const codigo = await this.nextCodigo(tx, tenantId, year);

      const ticket = await tx.ticket.create({
        data: {
          tenantId,
          otId,
          codigo,
          titulo: dto.titulo,
          descripcion: dto.descripcion,
          prioridad: dto.prioridad ?? Prioridad.MEDIA,
          estado: TicketEstado.PENDIENTE,
          jefeId: userId,
        },
      });

      await tx.eventoEstadoTicket.create({
        data: {
          ticketId: ticket.id,
          estadoAnterior: null,
          estadoNuevo: TicketEstado.PENDIENTE,
          usuarioId: userId,
          observacion: 'Ticket creado',
        },
      });

      if (otFresh.estado === OrdenTrabajoEstado.PENDIENTE) {
        await tx.ordenTrabajo.updateMany({
          where: {
            id: otId,
            tenantId,
            estado: OrdenTrabajoEstado.PENDIENTE,
          },
          data: { estado: OrdenTrabajoEstado.EN_PROCESO },
        });
      }

      return tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        include: DETAIL_INCLUDE,
      });
    });
  }

  async findAll(
    tenantId: string,
    query: ListTicketsQueryDto,
  ): Promise<
    PaginatedResult<Prisma.TicketGetPayload<{ include: typeof LIST_INCLUDE }>>
  > {
    const { page = 1, limit = 10, estado, mecanicoId, otId } = query;

    const where: Prisma.TicketWhereInput = {
      tenantId,
      ...(estado && { estado }),
      ...(mecanicoId && { mecanicoId }),
      ...(otId && { otId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: DETAIL_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id "${id}" no encontrado`);
    }
    return ticket;
  }

  /**
   * Calcula el siguiente código TKT-YYYY-NNNN para un tenant/año.
   * Asume estar dentro de la transacción con el advisory lock ya tomado.
   * Solo considera códigos que matcheen el formato TKT-YYYY-...
   */
  private async nextCodigo(
    tx: Prisma.TransactionClient,
    tenantId: string,
    year: number,
  ): Promise<string> {
    const prefix = `TKT-${year}-`;
    const last = await tx.ticket.findFirst({
      where: { tenantId, codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });

    let nextSeq = 1;
    if (last) {
      const suffix = last.codigo.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!Number.isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }
}
