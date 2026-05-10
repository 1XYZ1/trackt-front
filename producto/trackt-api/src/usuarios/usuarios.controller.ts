import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListUsuariosQueryDto } from './dto/list-usuarios-query.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar usuarios del tenant',
    description:
      'Retorna usuarios del tenant autenticado. Permite filtrar por rol.',
  })
  @ApiQuery({
    name: 'rol',
    required: false,
    description: 'Filtrar por rol. Ejemplo: mecanico.',
    example: 'mecanico',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @Req() req: { user: JwtPayload },
    @Query() query: ListUsuariosQueryDto,
  ) {
    return this.usuariosService.findAll(req.user.tenantId, query);
  }
}
