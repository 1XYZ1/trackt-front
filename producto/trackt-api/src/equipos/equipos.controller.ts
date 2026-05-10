import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
import { EquiposService } from './equipos.service';

@ApiTags('Equipos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('equipos')
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar equipos del tenant',
    description:
      'Retorna una lista paginada de equipos pertenecientes al tenant autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Lista de equipos con paginación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @Req() req: { user: JwtPayload },
    @Query() query: ListEquiposQueryDto,
  ) {
    return this.equiposService.findAll(req.user.tenantId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener equipo por ID',
    description:
      'Retorna el detalle de un equipo solo si pertenece al tenant autenticado.',
  })
  @ApiParam({ name: 'id', description: 'UUID del equipo' })
  @ApiResponse({ status: 200, description: 'Detalle del equipo' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  findOne(
    @Req() req: { user: JwtPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.equiposService.findOne(id, req.user.tenantId);
  }
}
