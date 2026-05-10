# Pruebas con cURL

Configura estas variables antes de probar:

```bash
export TOKEN="JWT_DEL_USUARIO"
export BASE_URL="http://localhost:3000"
export EQUIPO_ID="UUID_DEL_EQUIPO"
```

## Equipos

### Listar equipos

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/equipos" | jq .
```

### Listar equipos con paginación

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/equipos?page=1&limit=5" | jq .
```

### Obtener equipo por ID

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/equipos/$EQUIPO_ID" | jq .
```

### Equipo inexistente

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/equipos/00000000-0000-0000-0000-000000000000" | jq .
```

### Sin token

```bash
curl -s "$BASE_URL/equipos" | jq .
```

## Usuarios

### Listar usuarios del tenant

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/usuarios" | jq .
```

### Filtrar por rol

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/usuarios?rol=mecanico" | jq .
```

### Sin token

```bash
curl -s "$BASE_URL/usuarios?rol=mecanico" | jq .
```
