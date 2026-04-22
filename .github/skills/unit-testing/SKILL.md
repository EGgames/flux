---
name: unit-testing
description: Genera tests unitarios e integración para backend y/o frontend. Lee la spec y el código implementado. Requiere spec APPROVED e implementación completa.
argument-hint: "<nombre-feature> [backend|frontend|ambos]"
---

# Unit Testing

## Definition of Done — verificar al completar

- [ ] Cobertura ≥ 80% en lógica de negocio (quality gate bloqueante)
- [ ] Tests aislados — sin conexión a DB real ni Firebase (siempre mocks)
- [ ] Escenario feliz + errores de negocio + validaciones de entrada cubiertos
- [ ] Los cambios no rompen contratos existentes del módulo

## Prerequisito — Lee en paralelo

```
.github/specs/<feature>.spec.md        (criterios de aceptación)
código implementado en backend/ y/o frontend/
.github/instructions/backend.instructions.md   (pytest + pytest-asyncio)
.github/instructions/frontend.instructions.md  (Vitest + Testing Library)
```

## Output por scope

### Backend → `backend/tests/`

| Archivo | Cubre |
|---------|-------|
| `routes/test_<feature>_router.py` | Endpoints: 200/201, 400, 401, 404, 422 |
| `services/test_<feature>_service.py` | Lógica: happy path + errores de negocio |
| `repositories/test_<feature>_repository.py` | Queries: parámetros y retornos correctos |

### Frontend → `frontend/src/__tests__/`

| Archivo | Cubre |
|---------|-------|
| `components/<Feature>.test.jsx` | Render + interacciones (click, submit) |
| `hooks/use<Feature>.test.js` | Estado inicial + respuesta API + error handling |
| `pages/<Feature>Page.test.jsx` | Render completo con providers |

## Patrones core

```python
# Backend — AAA con AsyncMock (pytest-asyncio)
@pytest.mark.asyncio
async def test_create_success():
    repo = AsyncMock()
    repo.find_by_name.return_value = None
    repo.insert.return_value = {"uid": "abc", "name": "test"}
    result = await FeatureService(repo).create(FeatureCreate(name="test"))
    assert result["uid"] == "abc"
```

```js
// Frontend — mock service + renderHook (Vitest + Testing Library)
vi.mock('../../services/featureService');
getFeatures.mockResolvedValue([{ uid: '1' }]);
const { result } = renderHook(() => useFeature());
await waitFor(() => expect(result.current.data).toHaveLength(1));
```

## Restricciones

- Solo `tests/` o `__tests__/`. No modificar código fuente.
- Nunca conectar a DB real ni Firebase — siempre mocks.
- Cobertura mínima ≥ 80% en lógica de negocio.
