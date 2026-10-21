# Formatos de Archivo Soportados

## 📥 Importación

PolyCraft Studio Web ahora soporta **3 formatos de archivo** para importar modelos 3D:

### 1. **OBJ** (Wavefront Object)
- ✅ **Formato recomendado** para importar/exportar
- ✅ Formato de texto, fácil de editar
- ✅ Ampliamente soportado
- ✅ Conserva la escala original
- 📝 Extensión: `.obj`
- 🎯 Ideal para: modelos simples, intercambio entre programas

**Ejemplo de contenido:**
```obj
# Vertices
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0

# Faces (indices empiezan en 1)
f 1 2 3
```

### 2. **STL** (Stereolithography)
- ✅ Formato binario compacto
- ✅ Comúnmente usado en impresión 3D
- ✅ Solo geometría (sin colores ni texturas)
- 📝 Extensión: `.stl`
- 🎯 Ideal para: impresión 3D, CAD

**Características:**
- Siempre triangulado
- Formato binario o ASCII
- Muy eficiente para mallas complejas

### 3. **FBX** (Filmbox) ✨ **NUEVO**
- ✅ Formato de Autodesk
- ✅ Soporta jerarquías complejas
- ✅ Extrae toda la geometría del archivo
- ✅ Convierte automáticamente múltiples objetos
- 📝 Extensión: `.fbx`
- 🎯 Ideal para: exportaciones de Blender, Maya, 3ds Max

**Características especiales:**
- Procesa toda la jerarquía de objetos
- Convierte automáticamente transformaciones
- Combina múltiples meshes en una sola geometría
- Soporta FBX binario y ASCII

**Programas compatibles:**
- 🎨 Blender (File → Export → FBX)
- 🎨 Maya (File → Export All → FBX)
- 🎨 3ds Max (Export → Autodesk FBX)
- 🎨 Cinema 4D
- 🎨 Unity (puede exportar assets)
- 🎨 Unreal Engine

## 📤 Exportación

Actualmente solo se exporta a:

### **OBJ** (Wavefront Object)
- ✅ Optimizado para Pepakura
- ✅ Opción de triangulación automática
- ✅ Conserva escala y unidades
- ✅ Incluye metadatos del modelo

**Configuraciones de exportación:**
- **Unidad**: mm, cm, m, pulgadas
- **Escala**: multiplicador personalizado
- **Triangulación**: activar/desactivar
- **Nombre**: configurable

## 🔄 Flujo de Trabajo Recomendado

### Desde Blender
1. Crea tu modelo en Blender
2. Exporta como **FBX** o **OBJ**
   - FBX: más robusto para escenas complejas
   - OBJ: más simple y directo
3. Importa en PolyCraft Studio Web
4. Edita y simplifica según necesites
5. Exporta como OBJ para Pepakura Designer

### Desde programas CAD
1. Exporta tu diseño como **STL**
2. Importa en PolyCraft Studio Web
3. Usa "Analizar y Reparar" si es necesario
4. Simplifica con la herramienta de decimación
5. Exporta como OBJ

## 🛠️ Conversión entre Formatos

Si tienes un formato y necesitas otro:

**FBX → OBJ/STL:**
1. Importa el FBX en PolyCraft
2. Exporta como OBJ

**STL → OBJ:**
1. Importa el STL en PolyCraft
2. Exporta como OBJ

**Cualquier formato → Pepakura:**
1. Importa en PolyCraft
2. Simplifica si es necesario
3. Analiza y repara la malla
4. Exporta como OBJ
5. Abre el OBJ en Pepakura Designer

## ⚠️ Notas Importantes

### Para FBX:
- El loader puede tardar más con archivos grandes
- Se ignoran materiales, texturas y animaciones
- Solo se extrae la geometría
- Las transformaciones se aplican automáticamente
- Múltiples objetos se combinan en uno solo

### Para STL:
- Siempre viene triangulado
- No hay información de color
- Ideal si ya tienes un modelo para impresión 3D

### Para OBJ:
- Puede incluir polígonos (no solo triángulos)
- Soporta grupos y materiales (se ignoran)
- Es el formato más estable para import/export

## 🎯 Consejos

1. **Para modelos complejos de Blender**: usa FBX
2. **Para máxima compatibilidad**: usa OBJ
3. **Para archivos de impresión 3D**: usa STL
4. **Siempre revisa la escala** después de importar
5. **Usa "Analizar y Reparar"** antes de exportar a Pepakura

## 📊 Comparación Rápida

| Formato | Import | Export | Tamaño | Complejidad | Recomendado |
|---------|--------|--------|--------|-------------|-------------|
| OBJ     | ✅     | ✅     | Medio  | Baja        | ⭐⭐⭐⭐⭐ |
| STL     | ✅     | ❌     | Pequeño| Baja        | ⭐⭐⭐⭐   |
| FBX     | ✅     | ❌     | Grande | Alta        | ⭐⭐⭐⭐   |

---

**Actualizado:** Soporte FBX añadido
**Versión:** PolyCraft Studio Web v2.0
