import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
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
  const equiposService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
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
    controllers: [EquiposController],
    providers: [
      { provide: EquiposService, useValue: equiposService },
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

  return {
    builder,
    equiposService,
    tenantService,
    supabase,
    profiles,
  };
}

describe('EquiposController', () => {
  describe('autenticación', () => {
    it('AuthGuard sin Authorization header → UnauthorizedException', async () => {
      const { builder } = buildModule();
      const moduleRef: TestingModule = await builder.compile();
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

  describe('GET /equipos (findAll)', () => {
    it('usa el tenant_id del usuario autenticado y delega en el service', async () => {
      const { builder, equiposService, tenantService } = buildModule({
        authGuardOverride: {
          canActivate: jest.fn(() => true),
        },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(EquiposController);
      const expectedResult = {
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      };
      equiposService.findAll.mockResolvedValue(expectedResult);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findAll
      >[0];
      const query = { page: 2, limit: 5, search: 'cam' };

      const result = await controller.findAll(req, query);

      expect(tenantService.resolveTenantId).toHaveBeenCalledWith(ADMIN);
      expect(equiposService.findAll).toHaveBeenCalledWith(TENANT, query);
      expect(result).toBe(expectedResult);
    });
  });

  describe('GET /equipos/:id (findOne)', () => {
    it('busca por id + tenantId resuelto del usuario', async () => {
      const { builder, equiposService, tenantService } = buildModule({
        authGuardOverride: { canActivate: jest.fn(() => true) },
      });
      const moduleRef = await builder.compile();
      const controller = moduleRef.get(EquiposController);
      const equipo = { id: 'eq-1', codigo: 'EQ-001' };
      equiposService.findOne.mockResolvedValue(equipo);

      const req = { user: ADMIN } as unknown as Parameters<
        typeof controller.findOne
      >[0];
      const result = await controller.findOne(req, 'eq-1');

      expect(tenantService.resolveTenantId).toHaveBeenCalledWith(ADMIN);
      expect(equiposService.findOne).toHaveBeenCalledWith(TENANT, 'eq-1');
      expect(result).toBe(equipo);
    });
  });
});
