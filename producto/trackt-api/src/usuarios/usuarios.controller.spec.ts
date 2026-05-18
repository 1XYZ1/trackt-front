import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { TenantService } from '../common/tenant/tenant.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseService } from '../supabase.service';
import { ProfileService } from '../auth/profile.service';
import { AuthUser } from '../auth/types';

const TENANT = 'tenant-1';

const ADMIN: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@trackt.demo',
  role: 'admin',
  tenantId: TENANT,
};

function buildModule(opts?: {
  authGuardOverride?: { canActivate: jest.Mock | (() => boolean) };
}) {
  const usuariosService = {
    findAll: jest.fn(),
  };
  const tenantService = {
    resolveTenantId: jest.fn().mockReturnValue(TENANT),
  };
  const supabase = {
    getClient: jest.fn(),
  };
  const profiles = {
    getById: jest.fn(),
  };

  const builder = Test.createTestingModule({
    controllers: [UsuariosController],
    providers: [
      { provide: UsuariosService, useValue: usuariosService },
      { provide: TenantService, useValue: tenantService },
      { provide: SupabaseService, useValue: supabase },
      { provide: ProfileService, useValue: profiles },
      AuthGuard,
      RolesGuard,
      Reflector,
    ],
  });

  if (opts?.authGuardOverride) {
    builder.overrideGuard(AuthGuard).useValue(opts.authGuardOverride);
  }

  return { builder, usuariosService, tenantService, supabase, profiles };
}

describe('UsuariosController', () => {
  describe('autenticación', () => {
    it('AuthGuard sin Authorization header → UnauthorizedException (401)', async () => {
      const { builder } = buildModule();
      const moduleRef = await builder.compile();
      const guard = moduleRef.get(AuthGuard);

      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('GET /usuarios (findAll)', () => {
    it('usa el tenant_id del usuario autenticado y delega en el service', async () => {
      const { builder, usuariosService, tenantService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(UsuariosController);

      const paginated = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      usuariosService.findAll.mockResolvedValue(paginated);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findAll
      >[0];
      const query = { page: 1, limit: 10, rol: 'mecanico' };

      const result = await controller.findAll(req, query);

      expect(tenantService.resolveTenantId).toHaveBeenCalledWith(ADMIN);
      // El controller pasa el query tal cual al service; la normalización
      // mecanico→mechanic ocurre dentro de UsuariosService.
      expect(usuariosService.findAll).toHaveBeenCalledWith(TENANT, query);
      expect(result).toBe(paginated);
    });

    it('soporta rol=mechanic directamente (sin normalización en controller)', async () => {
      const { builder, usuariosService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(UsuariosController);

      usuariosService.findAll.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findAll
      >[0];
      await controller.findAll(req, { page: 1, limit: 10, rol: 'mechanic' });

      expect(usuariosService.findAll).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ rol: 'mechanic' }),
      );
    });
  });
});
