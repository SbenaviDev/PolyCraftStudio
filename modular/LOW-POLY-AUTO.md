# Low Poly Automático para Papercraft 📦

## 🎯 ¿Para qué sirve?

La función **Low Poly Automático** está diseñada específicamente para preparar modelos 3D para **papercraft con Pepakura Designer**, resolviendo el problema común de **triangulación excesiva** que dificulta el trabajo con plantillas de papel.

### Problema que resuelve

Cuando importas archivos `.fbx`, `.obj` u otros formatos 3D en Polycraft Studio (o directamente en Pepakura), es común encontrar:

- ❌ Miles de triángulos pequeños innecesarios
- ❌ Caras divididas en múltiples triángulos
- ❌ Vértices duplicados o muy cercanos
- ❌ Geometría excesivamente compleja para un modelo de papel

**Resultado**: En Pepakura, estas triangulaciones se convierten en decenas de piezas pequeñas difíciles de cortar, doblar y pegar.

### Solución

Este botón aplica **3 técnicas de simplificación** en secuencia para obtener una malla limpia, simple y lista para papercraft:

1. **Decimación geométrica** → Reduce vértices y triángulos
2. **Unión de vértices** → Elimina duplicados
3. **Fusión coplanar** → Convierte triángulos en polígonos simples

---

## 🚀 Cómo usar

### Paso 1: Importar tu modelo

1. Importa tu archivo `.fbx`, `.obj`, `.stl`, etc.
2. Observa si el modelo tiene demasiados triángulos (puedes verlo en las estadísticas)

### Paso 2: Seleccionar preset

En el panel **Low Poly**, elige un preset según tu necesidad:

| Preset | Cuándo usarlo |
|--------|---------------|
| **Ligero (70%)** | Modelos ya optimizados, solo necesitas limpieza ligera |
| **Medio (50%)** | Caso general, buen balance entre detalle y simplicidad |
| **Agresivo (30%)** | Modelos muy complejos que necesitas simplificar al máximo |

### Paso 3: Aplicar

1. Haz clic en el botón grande: **"Low Poly Automático para Papercraft"**
2. Espera unos segundos (dependiendo del tamaño del modelo)
3. ✅ Recibirás un mensaje con las estadísticas de reducción

**Ejemplo de resultado:**
```
✓ Low Poly aplicado (medio): 65% menos vértices, 58% menos caras
```

---

## 📊 Presets Detallados

### 🟢 Ligero (70%)

**Configuración interna:**
- Decimación: 70% de geometría preservada
- Ángulo coplanar: 2°
- Distancia de unión: 0.01

**Cuándo usar:**
- Tu modelo ya es relativamente simple
- Quieres preservar la mayor cantidad de detalles
- Solo necesitas limpiar vértices duplicados y unir caras obvias

**Reducción típica:** 20-35%

---

### 🟡 Medio (50%) [Recomendado]

**Configuración interna:**
- Decimación: 50% de geometría preservada
- Ángulo coplanar: 3°
- Distancia de unión: 0.02

**Cuándo usar:**
- Caso general para la mayoría de modelos
- Balance entre simplicidad y conservación de forma
- Modelos importados de software 3D estándar

**Reducción típica:** 40-60%

---

### 🔴 Agresivo (30%)

**Configuración interna:**
- Decimación: 30% de geometría preservada
- Ángulo coplanar: 5°
- Distancia de unión: 0.05

**Cuándo usar:**
- Modelos extremadamente complejos (escaneos 3D, modelos de videojuegos)
- Papercraft simple sin detalles finos
- Necesitas la máxima reducción posible

**Reducción típica:** 60-80%

---

## 🔧 Qué hace internamente

### Paso 1: Decimación (SimplifyModifier)

Utiliza el algoritmo de Three.js para **reducir la densidad de la malla**:
- Elimina vértices redundantes
- Colapsa aristas que no afectan la forma general
- Preserva bordes y características importantes

### Paso 2: Unión de Vértices

**Weld vertices** detecta vértices muy cercanos y los une:
- Elimina duplicados generados en la importación
- Reduce complejidad innecesaria
- Distancia configurable por preset

### Paso 3: Fusión Coplanar

**Coplanar merge** convierte grupos de triángulos en polígonos:
- Detecta caras contiguas con la misma orientación
- Las fusiona en un solo polígono simple
- **Esto es clave para reducir piezas en Pepakura**

**Ejemplo visual:**
```
Antes:                   Después:
  /\  /\                  _______
 /__\/__\    →          |       |
 \  /\  /                |_______|
  \/  \/                 
(6 triángulos)           (1 cuadrado)
```

---

## 💡 Consejos y Buenas Prácticas

### ✅ Recomendaciones

1. **Empieza con "Medio"**: Es el preset más equilibrado
2. **Prueba antes de exportar**: Revisa el resultado antes de ir a Pepakura
3. **Combina con otras herramientas**: Puedes usar "Analizar y Reparar" después si es necesario
4. **Guarda el original**: Deshacer (Ctrl+Z) está disponible, pero guarda una copia del archivo original

### ⚠️ Consideraciones

- **No es reversible al 100%**: Una vez aplicado y guardado, los detalles perdidos no se recuperan
- **Modelos muy pequeños**: La simplificación puede distorsionar modelos con muy pocos vértices (< 100)
- **Detalles finos**: Preset agresivo puede eliminar características pequeñas

### 🎯 Flujo de Trabajo Óptimo

```
1. Importar modelo (.fbx, .obj, etc.)
2. "Low Poly Automático" (preset medio o agresivo)
3. "Analizar y Reparar Malla" (si hay problemas)
4. Triangular todo (si es necesario para Pepakura)
5. Exportar a .obj
6. Abrir en Pepakura Designer
```

---

## 🆚 Comparación con Herramientas Manuales

| Función | Manual | Low Poly Auto |
|---------|--------|---------------|
| **Decimación** | Slider manual | ✅ Automático con preset |
| **Coplanar Merge** | Ajustar ángulo manualmente | ✅ Preset optimizado |
| **Weld Vertices** | Ingresar distancia | ✅ Valor preconfigurado |
| **Tiempo** | 3-5 minutos ajustando | ⚡ ~10 segundos |
| **Experiencia requerida** | Media-alta | ⭐ Principiante |

**Ventaja clave:** El botón automático aplica las 3 técnicas en la secuencia óptima con valores probados para papercraft.

---

## 🎓 Casos de Uso Reales

### Caso 1: Personaje de videojuego

**Problema:**
- Modelo de Blender con 45,000 triángulos
- En Pepakura: 800+ piezas imposibles de trabajar

**Solución:**
1. Importar `.fbx` en Polycraft Studio
2. Low Poly Automático → **Agresivo**
3. Resultado: 12,000 triángulos (~73% reducción)
4. En Pepakura: ~150 piezas manejables

---

### Caso 2: Escaneo 3D

**Problema:**
- Escaneo 3D de objeto real (fotogrametría)
- 120,000 triángulos, superficies sobre-divididas

**Solución:**
1. Low Poly Automático → **Agresivo** (primera pasada)
2. Si aún es complejo: aplicar **Medio** nuevamente
3. Resultado final: ~8,000 triángulos

---

### Caso 3: Modelo arquitectónico

**Problema:**
- Edificio simple pero con muchos triángulos en superficies planas
- Paredes divididas en cientos de triángulos

**Solución:**
1. Low Poly Automático → **Medio**
2. Las paredes se convierten en polígonos simples
3. Perfecto para papercraft de arquitectura

---

## ❓ Preguntas Frecuentes

### ¿Puedo deshacer la operación?

Sí, usa **Ctrl+Z** inmediatamente después. El sistema de Undo está habilitado.

### ¿Pierdo calidad visual?

Depende del preset. "Ligero" y "Medio" preservan la forma general muy bien. "Agresivo" puede simplificar detalles pequeños.

### ¿Funciona con modelos ya triangulados?

Sí, de hecho es ideal para eso. La fusión coplanar convertirá triángulos en polígonos cuando sea posible.

### ¿Debo triangular después de Low Poly Auto?

**No es necesario** para la edición en Polycraft Studio. Solo triangula si Pepakura lo requiere o prefieres ver todo en triángulos.

### ¿Puedo aplicarlo varias veces?

Sí, pero cada aplicación reduce más la geometría. Úsalo con precaución en pasadas múltiples.

---

## 🔗 Ver también

- **CREAR-CARAS.md** - Cómo crear caras manualmente desde vértices
- **INICIO-RAPIDO.md** - Guía básica de Polycraft Studio
- **CHANGELOG.md** - Historial completo de versiones

---

## 📝 Notas Técnicas

**Versión introducida:** v2.2.0

**Tecnología:**
- Three.js SimplifyModifier para decimación
- Algoritmo de detección de coplanaridad por producto punto de normales
- Spatial hashing para unión de vértices cercanos

**Rendimiento:**
- Modelos pequeños (< 5,000 vértices): < 1 segundo
- Modelos medianos (5,000-20,000): 1-5 segundos
- Modelos grandes (20,000+): 5-15 segundos

---

**¡Ahora puedes importar cualquier modelo complejo y prepararlo para papercraft en segundos! 🎉**
