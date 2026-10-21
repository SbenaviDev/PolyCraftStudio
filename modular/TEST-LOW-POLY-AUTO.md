# Test Plan: Low Poly Automático v2.2.0 ✅

## 🧪 Plan de Pruebas

### Pre-requisitos
- ✅ Servidor corriendo en http://localhost:3000
- ✅ Navegador moderno (Chrome, Firefox, Edge)
- ✅ Archivo de prueba .fbx, .obj o .stl con triangulación alta (opcional)

---

## Test 1: Verificar UI 👁️

### Pasos:
1. Abre http://localhost:3000 en tu navegador
2. Ve al panel lateral derecho
3. Busca la sección **"Low Poly"**

### ✅ Verificaciones:

- [ ] Hay un selector desplegable con 3 opciones:
  - Ligero (70%)
  - Medio (50%)
  - Agresivo (30%)

- [ ] Hay un botón grande con icono de capas que dice:
  - "Low Poly Automático para Papercraft"

- [ ] El botón tiene estilo similar a "Analizar y Reparar"

- [ ] Hay una línea horizontal separando este botón de las herramientas manuales

**Estado: PASS / FAIL**

---

## Test 2: Funcionalidad Básica ⚙️

### Pasos:
1. Si no hay modelo, carga una primitiva:
   - Panel superior → **"Primitivas"** → Clic en "Cubo" o "Esfera"

2. Observa las estadísticas actuales:
   - Mira la parte inferior derecha
   - Anota número de vértices y caras

3. Selecciona preset **"Medio"**

4. Haz clic en **"Low Poly Automático para Papercraft"**

### ✅ Verificaciones:

- [ ] Aparece un mensaje toast (notificación) en la parte superior

- [ ] El mensaje dice algo como:
  - "✓ Low Poly aplicado (medio): X% menos vértices, Y% menos caras"

- [ ] Las estadísticas en la esquina inferior han cambiado

- [ ] El modelo se ve diferente (menos detallado si era complejo)

- [ ] **Ctrl+Z** deshace la operación y vuelve al estado anterior

**Estado: PASS / FAIL**

---

## Test 3: Presets Diferentes 🎚️

### Pasos:
1. Carga una primitiva "Esfera" (tiene más geometría)

2. **Prueba 1: Ligero**
   - Selecciona "Ligero (70%)"
   - Clic en el botón
   - Anota la reducción porcentual
   - Ctrl+Z para deshacer

3. **Prueba 2: Medio**
   - Selecciona "Medio (50%)"
   - Clic en el botón
   - Anota la reducción porcentual
   - Ctrl+Z para deshacer

4. **Prueba 3: Agresivo**
   - Selecciona "Agresivo (30%)"
   - Clic en el botón
   - Anota la reducción porcentual

### ✅ Verificaciones:

- [ ] **Ligero** reduce menos (20-35% aprox.)

- [ ] **Medio** reduce moderadamente (40-60% aprox.)

- [ ] **Agresivo** reduce más (60-80% aprox.)

- [ ] Cada preset produce resultados diferentes

- [ ] El modelo mantiene su forma general reconocible

**Estado: PASS / FAIL**

---

## Test 4: Importación FBX/OBJ 📦

### Pasos:
1. Importa un archivo .fbx o .obj complejo
   - Panel superior → **"Importar"**
   - Selecciona tu archivo

2. Espera a que cargue

3. Observa las estadísticas (ej: 20,000 triángulos)

4. Aplica **"Agresivo"** (porque es un modelo complejo)

5. Observa la reducción

### ✅ Verificaciones:

- [ ] El modelo importado carga correctamente

- [ ] El botón funciona con modelos importados

- [ ] La reducción es significativa (50-80%)

- [ ] El modelo sigue siendo reconocible

- [ ] No hay errores en la consola (F12)

**Estado: PASS / FAIL**

---

## Test 5: Exportar a Pepakura 📤

### Pasos:
1. Simplifica un modelo con "Low Poly Automático"

2. Exporta el resultado:
   - Panel superior → **"Exportar"**
   - Guarda como `.obj`

3. Abre el archivo en Pepakura Designer

4. Observa el número de piezas generadas

### ✅ Verificaciones:

- [ ] El archivo .obj exporta sin errores

- [ ] Pepakura abre el archivo correctamente

- [ ] El número de piezas es manejable

- [ ] Compara con el original (sin simplificar):
  - Modelo original: X piezas
  - Modelo simplificado: Y piezas (Y < X)

**Estado: PASS / FAIL**

---

## Test 6: Manejo de Errores 🚨

### Pasos:
1. **Sin modelo:**
   - Sin cargar nada, haz clic en "Low Poly Automático"
   - **Esperado:** Mensaje de error o advertencia

2. **Modelo muy simple:**
   - Carga "Cubo"
   - Aplica "Agresivo" varias veces seguidas
   - **Esperado:** Funciona sin crashear

### ✅ Verificaciones:

- [ ] Sin modelo: Muestra mensaje apropiado

- [ ] Aplicaciones múltiples: No causa errores

- [ ] La consola (F12) no muestra errores JavaScript

**Estado: PASS / FAIL**

---

## Test 7: Deshacer/Rehacer ↩️

### Pasos:
1. Carga una esfera

2. Aplica "Medio"

3. Presiona **Ctrl+Z** (deshacer)

4. Presiona **Ctrl+Shift+Z** (rehacer)

### ✅ Verificaciones:

- [ ] Ctrl+Z deshace la simplificación

- [ ] El modelo vuelve a su estado anterior

- [ ] Ctrl+Shift+Z rehace la operación

- [ ] El historial de Undo funciona correctamente

**Estado: PASS / FAIL**

---

## Test 8: Rendimiento ⚡

### Medir tiempo de ejecución:

| Tamaño Modelo | Preset | Tiempo Esperado |
|---------------|--------|-----------------|
| < 5,000 vértices | Cualquiera | < 1 segundo |
| 5,000-20,000 vértices | Medio | 1-5 segundos |
| > 20,000 vértices | Agresivo | 5-15 segundos |

### ✅ Verificaciones:

- [ ] Modelos pequeños: Casi instantáneo

- [ ] Modelos medianos: Tiempo razonable

- [ ] Modelos grandes: Completa sin timeout

- [ ] Durante la operación, no se congela el navegador

**Estado: PASS / FAIL**

---

## 📋 Resumen de Resultados

| Test | Descripción | Estado |
|------|-------------|--------|
| 1 | Verificar UI | ⬜ |
| 2 | Funcionalidad Básica | ⬜ |
| 3 | Presets Diferentes | ⬜ |
| 4 | Importación FBX/OBJ | ⬜ |
| 5 | Exportar a Pepakura | ⬜ |
| 6 | Manejo de Errores | ⬜ |
| 7 | Deshacer/Rehacer | ⬜ |
| 8 | Rendimiento | ⬜ |

**Total: __ / 8 tests pasados**

---

## 🐛 Reporte de Bugs (si los hay)

### Bug #1
**Descripción:**
**Pasos para reproducir:**
**Resultado esperado:**
**Resultado actual:**
**Severidad:** Alta / Media / Baja

### Bug #2
(Añade más si es necesario)

---

## ✅ Checklist Final

Antes de considerar la función completa y lista para producción:

- [ ] Todos los tests pasan
- [ ] No hay errores en consola
- [ ] Documentación revisada y correcta
- [ ] Funciona en diferentes navegadores
- [ ] Rendimiento aceptable
- [ ] UX es intuitiva
- [ ] Mensajes de error son claros

---

## 📝 Notas Adicionales

(Espacio para observaciones, sugerencias de mejora, etc.)

---

**Fecha de prueba:** _____________

**Probado por:** _____________

**Versión:** v2.2.0

**Build:** Latest (20 Oct 2026)
