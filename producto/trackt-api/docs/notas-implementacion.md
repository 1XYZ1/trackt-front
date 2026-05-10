# Notas de implementación

## Decisiones técnicas

| Decisión | Razón |
|---|---|
| `findFirst` con filtro `id + tenantId` | Garantiza aislamiento multi-tenant en una sola consulta. |
| `Promise.all([count, findMany])` | Reduce latencia al ejecutar conteo y búsqueda en paralelo. |
| `select` explícito | Evita exponer campos no deseados. |
| Controllers delgados | Extraen `tenantId` y delegan la lógica en los services. |
| `USUARIO_SELECT` centralizado | Facilita auditar qué campos se devuelven al frontend. |

## Advertencias

### 1. Verificar nombre real del modelo Usuario

Este código usa:

```ts
this.prisma.usuario.findMany(...)
```

Si tu modelo en Prisma se llama `User`, `Profile` u otro, debes cambiarlo.

### 2. Verificar el campo del tenant en el JWT

Este código asume:

```ts
req.user.tenantId
```

Si tu JWT usa snake_case:

```ts
req.user.tenant_id
```

debes ajustar los controllers y el tipo `JwtPayload`.

### 3. Verificar la ruta del AuthGuard

Este código asume:

```ts
import { AuthGuard } from '../auth/auth.guard';
```

Si tu guard está en otra ruta, cambia el import.

### 4. Swagger es opcional

Si no usas Swagger, elimina:

```ts
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
```

y todos los decoradores `@Api*`.

## Caso Supabase Auth

Si los usuarios reales viven en `auth.users` de Supabase y no existe tabla `usuarios` en Prisma, no hagas una migración a ciegas.

Primero verifica si existe una tabla tipo `profiles`.

Ejemplo:

```ts
const usuarios = await this.prisma.profile.findMany({
  where: { tenantId },
  select: {
    id: true,
    nombre: true,
    email: true,
    rol: true,
  },
});
```

Solo crea un modelo nuevo si el equipo confirma que no existe una tabla de perfiles.

Ejemplo posible:

```prisma
model Profile {
  id       String @id @default(uuid())
  userId   String @unique @map("user_id")
  nombre   String
  email    String
  rol      String
  tenantId String @map("tenant_id")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@map("profiles")
}
```
