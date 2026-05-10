import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';

@Injectable()
export class EquiposService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListEquiposQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, equipos] = await Promise.all([
      this.prisma.equipo.count({
        where: { tenantId },
      }),
      this.prisma.equipo.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          tenantId: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      data: equipos,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const equipo = await this.prisma.equipo.findFirst({
      where: {
        id,
        tenantId,
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    return equipo;
  }
}
