import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ListUsuariosQueryDto } from './dto/list-usuarios-query.dto';

const USUARIO_SELECT = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  tenantId: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: ListUsuariosQueryDto) {
    const where: Record<string, unknown> = { tenantId };

    if (query.rol) {
      where.rol = query.rol;
    }

    const usuarios = await this.prisma.usuario.findMany({
      where,
      select: USUARIO_SELECT,
      orderBy: { nombre: 'asc' },
    });

    return { data: usuarios };
  }
}
