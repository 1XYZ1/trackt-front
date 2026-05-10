import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListUsuariosQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por rol. Ejemplo: mecanico, admin, supervisor.',
    example: 'mecanico',
  })
  @IsOptional()
  @IsString({ message: 'rol debe ser una cadena de texto' })
  rol?: string;
}
