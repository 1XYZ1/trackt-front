import { TicketEstado } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * API-03 expone los filtros en snake_case: `mecanico_id`, `ot_id`.
 * Internamente el service trabaja con camelCase. Declaramos ambas formas en
 * el DTO (para que `whitelist: true` no las descarte) y el controller
 * normaliza vía `resolveTicketsFilters()` antes de pasarlas al service.
 */
export class ListTicketsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TicketEstado)
  estado?: TicketEstado;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mecanicoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mecanico_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  otId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ot_id?: string;
}

/**
 * Versión normalizada que se le pasa al service (sin los alias snake_case).
 */
export interface ResolvedTicketsFilters {
  page?: number;
  limit?: number;
  estado?: TicketEstado;
  mecanicoId?: string;
  otId?: string;
}

export function resolveTicketsFilters(
  q: ListTicketsQueryDto,
): ResolvedTicketsFilters {
  return {
    page: q.page,
    limit: q.limit,
    estado: q.estado,
    mecanicoId: q.mecanicoId ?? q.mecanico_id,
    otId: q.otId ?? q.ot_id,
  };
}
