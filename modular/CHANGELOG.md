# Historial de Cambios

## v2.2.0 - Low Poly Automático para Papercraft 📦

### ✨ Nueva Función Principal

#### Low Poly Automático
- ✅ **Botón destacado**: "Low Poly Automático para Papercraft" en sección Low Poly
- ✅ **3 Presets optimizados**: Ligero (70%), Medio (50%), Agresivo (30%)
- ✅ **Proceso automático en 3 pasos**:
  1. Decimación geométrica (reduce vértices y triángulos)
  2. Unión de vértices cercanos (elimina duplicados)
  3. Fusión de caras coplanares (reduce triangulación)
- ✅ **Optimizado para Pepakura**: Reduce problemas de triangulación excesiva
- ✅ **Estadísticas en tiempo real**: Muestra % de reducción de vértices y caras

### 🎯 Casos de Uso

- **Importar FBX/OBJ de alta densidad**: Simplifica modelos complejos automáticamente
- **Preparar para Pepakura**: Reduce triángulos innecesarios que complican el papercraft
- **Optimizar mallas**: Obtén versiones low-poly listas para exportar

### 📝 Presets Disponibles

| Preset | Decimación | Ángulo Coplanar | Unión Vértices | Uso Recomendado |
|--------|-----------|----------------|----------------|-----------------|
| **Ligero** | 70% | 2° | 0.01 | Modelos simples, preservar detalle |
| **Medio** | 50% | 3° | 0.02 | Balance entre simplicidad y detalle |
| **Agresivo** | 30% | 5° | 0.05 | Máxima simplificación, papercraft básico |

### 🔧 Ubicación

- Panel lateral → **Low Poly** → Selector de preset + botón destacado
- Estilo visual similar a "Analizar y Reparar Malla"

---

## v2.1.0 - Crear Caras desde Vértices 🎨

### ✨ Nueva Función Principal

#### Crear Caras (Fill Face)
- ✅ **Atajo F**: Crea caras desde vértices seleccionados
- ✅ **Botón en interfaz**: "Crear cara" en sección Malla
- ✅ **Ordenamiento automático**: Los vértices se ordenan correctamente
- ✅ **Validación**: Detecta caras duplicadas y valida entrada
- ✅ **Algoritmo robusto**: Proyección planar + ordenamiento angular
- ✅ **Funciona con cualquier número de vértices** (mínimo 3)

#### Cambios en Atajos
- 🔄 **F**: Ahora crea caras (antes enfocaba)
- 🔄 **Shift+F**: Enfocar selección (movido desde F)

### 📝 Mejoras en UI

- Nuevo botón "Crear cara" con icono de polígono
- Hints actualizados con la nueva función
- Ayuda (F1) actualizada con documentación

### 📚 Documentación

- ✅ **CREAR-CARAS.md**: Guía completa de uso
- ✅ Tutorial paso a paso
- ✅ Ejemplos prácticos
- ✅ Casos de uso avanzados

### 🎯 Casos de Uso

**Ahora puedes:**
- Crear modelos desde cero
- Cerrar huecos en geometría
- Hacer retopología manual
- Reparar mallas manualmente
- Diseñar papercraft custom

---

## v2.0.1 - Correcciones Críticas ✅

### 🔧 Problemas Corregidos

#### Selección Múltiple
- ✅ Shift + Clic funciona correctamente
- ✅ Box select con Shift/Ctrl
- ✅ Arrastre directo no interfiere

#### Atajos de Teclado
- ✅ Todos tienen preventDefault()
- ✅ No interfieren con el navegador

#### Colores al Importar
- ✅ Sistema limpio
- ✅ Sin colores residuales

#### Arrastre Directo
- ✅ Umbral de 3 píxeles
- ✅ No se activa con Shift/Ctrl

---

## v2.0.0 - Soporte FBX 🎉

### ✨ Nuevas Características

#### Importación FBX
- ✅ **Soporte completo para archivos .FBX**
  - Carga archivos FBX binarios y ASCII
  - Procesa jerarquías de objetos complejas
  - Extrae y combina toda la geometría
  - Aplica transformaciones automáticamente
  
- ✅ **Nueva función `fromThreeObject()`**
  - Convierte cualquier objeto Three.js a formato de malla editable
  - Recorre toda la jerarquía de objetos
  - Aplica matrices de transformación mundial
  - Compatible con futuras extensiones

#### Mejoras en Importación
- 🔧 Mensajes de error más detallados
- 🔧 Indicador de carga para archivos FBX grandes
- 🔧 Mejor manejo de errores

### 📝 Cambios en la Interfaz

- Botón "Importar" actualizado: ahora indica ".OBJ, .STL o .FBX"
- Input de archivo acepta `.fbx`
- Zona de drag & drop actualizada con soporte FBX
- Mensajes toast mejorados con feedback específico

### 📚 Documentación

- ✅ Nuevo archivo `FORMATOS.md` con guía completa de formatos
- ✅ `README.md` actualizado con mención de FBX
- ✅ `CHANGELOG.md` añadido

### 🔧 Cambios Técnicos

**Archivos modificados:**
- `app.js`: 
  - Import de `FBXLoader`
  - Nueva función `fromThreeObject()`
  - Función `importFile()` actualizada
- `index.html`:
  - Input file accept actualizado
  - Títulos y textos actualizados
- `server.js`:
  - MIME type para `.fbx` añadido

### 🎯 Compatibilidad

**Programas de 3D soportados:**
- Blender → Export FBX
- Maya → Export FBX
- 3ds Max → Export FBX
- Cinema 4D → Export FBX
- Unity → Export FBX
- Unreal Engine → Export FBX

### ⚡ Rendimiento

- FBX grandes pueden tardar unos segundos en cargar
- Toast de "Cargando FBX..." aparece durante la carga
- Procesamiento optimizado con traverse único

---

## v1.0.0 - Lanzamiento Inicial

### Características Principales

- ✅ Editor low poly completo
- ✅ Importar OBJ y STL
- ✅ Exportar OBJ para Pepakura
- ✅ Herramientas de edición avanzadas
- ✅ Análisis y reparación de mallas
- ✅ Decimación con SimplifyModifier
- ✅ Colores por cara
- ✅ Imagen de fondo de referencia
- ✅ Transformaciones modales (G/R/S)
- ✅ Modo vértice/arista/cara
- ✅ Herramientas: Añadir vértice, Cuchillo, Conectar
- ✅ Atajos de teclado completos
- ✅ Interfaz intuitiva

---

**Formato de versiones:** MAJOR.MINOR.PATCH
- **MAJOR**: Cambios incompatibles o características mayores
- **MINOR**: Nuevas características compatibles hacia atrás
- **PATCH**: Correcciones de errores
