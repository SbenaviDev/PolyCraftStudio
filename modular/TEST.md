# Lista de Pruebas - PolyCraft Studio Web

## ✅ Pruebas de Selección

### Selección Simple
- [ ] **Clic en vértice**: Selecciona un vértice
- [ ] **Clic en arista**: Selecciona una arista
- [ ] **Clic en cara**: Selecciona una cara

### Selección Múltiple con Shift
- [ ] **Shift + Clic**: Añade/quita vértices de la selección
- [ ] **Shift + Clic**: Añade/quita aristas de la selección
- [ ] **Shift + Clic**: Añade/quita caras de la selección

### Selección por Caja (Box Select)
- [ ] **Arrastrar sin Shift**: Selecciona múltiples elementos (reemplaza selección)
- [ ] **Arrastrar con Shift**: Añade elementos a la selección
- [ ] **Arrastrar con Ctrl**: Quita elementos de la selección

### Cambio de Modo de Selección
- [ ] **Tecla 1**: Cambia a modo vértice
- [ ] **Tecla 2**: Cambia a modo arista
- [ ] **Tecla 3**: Cambia a modo cara
- [ ] La selección se convierte correctamente entre modos

---

## ✅ Pruebas de Atajos de Teclado

### Navegación y Vista
- [ ] **Tab**: Alterna entre modo Objeto y Edición
- [ ] **F**: Enfoca la selección
- [ ] **1, 3, 7**: Cambia a vistas frontal, lateral, superior (en modo Objeto)
- [ ] **Numpad 1, 3, 7**: Vistas del teclado numérico

### Transformaciones
- [ ] **G**: Modo mover (con clic izq. confirma, Esc cancela)
- [ ] **R**: Modo rotar
- [ ] **S**: Modo escalar
- [ ] **X, Y, Z** (durante transformación): Restringe al eje

### Edición
- [ ] **X o Delete**: Elimina selección
- [ ] **Ctrl+X**: Disolver (sin dejar huecos)
- [ ] **M**: Une vértices seleccionados
- [ ] **V**: Herramienta añadir vértice
- [ ] **K**: Herramienta cuchillo
- [ ] **J**: Conecta dos vértices seleccionados

### Selección
- [ ] **A**: Selecciona todo (alterna todo/nada)
- [ ] **Alt+A**: Deselecciona todo
- [ ] **Ctrl+I**: Invierte selección

### Deshacer/Rehacer
- [ ] **Ctrl+Z**: Deshacer
- [ ] **Ctrl+Shift+Z o Ctrl+Y**: Rehacer

### Ayuda
- [ ] **F1 o ?**: Abre/cierra ayuda

---

## ✅ Pruebas de Importación

### Importar OBJ
- [ ] Importa correctamente
- [ ] **Sin colores de caras** al importar
- [ ] Conserva la escala
- [ ] Detecta problemas de geometría

### Importar STL
- [ ] Importa correctamente
- [ ] **Sin colores de caras** al importar
- [ ] Convierte triángulos correctamente

### Importar FBX
- [ ] Importa correctamente
- [ ] **Sin colores de caras** al importar
- [ ] Procesa jerarquías de objetos
- [ ] Aplica transformaciones

---

## ✅ Pruebas de Arrastre Directo

### Arrastre de Vértices
- [ ] Arrastra vértice seleccionado sin presionar G
- [ ] No arrastra si presionas Shift (permite selección múltiple)
- [ ] No arrastra si presionas Ctrl (permite quitar de selección)

### Arrastre de Aristas
- [ ] Arrastra arista seleccionada
- [ ] Arrastra ambos vértices de la arista

### Arrastre de Caras
- [ ] Arrastra cara seleccionada
- [ ] Arrastra todos los vértices de la cara

### Fusión Automática
- [ ] Soltar un vértice sobre otro los fusiona
- [ ] Muestra mensaje "Vértices unidos automáticamente"

---

## ✅ Pruebas de Colores

### Pintar Caras
- [ ] Selecciona caras en modo 3
- [ ] Elige color con el selector
- [ ] Clic en "Pintar caras seleccionadas"
- [ ] Las caras se pintan del color elegido

### Limpiar Colores
- [ ] "Borrar todos los colores" elimina todos los colores
- [ ] Después de importar no hay colores residuales

### Persistencia
- [ ] Los colores se mantienen después de transformaciones
- [ ] Los colores se deshacen con Ctrl+Z
- [ ] **Al importar un modelo nuevo, NO tiene colores**

---

## ✅ Pruebas de Herramientas Avanzadas

### Añadir Vértice (V)
- [ ] Doble clic en arista añade vértice en el punto medio
- [ ] Doble clic en cara añade vértice en la superficie
- [ ] Tecla V activa modo herramienta
- [ ] Ctrl durante herramienta: imán a centro/punto medio
- [ ] Esc sale de la herramienta

### Cuchillo (K)
- [ ] Activa con tecla K
- [ ] Clic añade puntos de corte
- [ ] Enter aplica el corte
- [ ] Esc cancela

### Conectar (J)
- [ ] Selecciona 2 vértices en la misma cara
- [ ] Tecla J los conecta con una arista
- [ ] La cara se divide en dos

---

## ✅ Pruebas de Validación

### Analizar y Reparar
- [ ] Detecta vértices duplicados
- [ ] Detecta bordes abiertos
- [ ] Detecta aristas no-manifold
- [ ] Detecta caras no planas
- [ ] Repara automáticamente los problemas

### Decimación
- [ ] El deslizador reduce polígonos en tiempo real
- [ ] Ctrl+Z recupera el modelo original
- [ ] El valor de triángulos objetivo funciona

---

## ✅ Pruebas de Exportación

### Exportar OBJ
- [ ] Exporta correctamente
- [ ] Incluye colores si los hay
- [ ] Respeta la escala configurada
- [ ] Respeta la unidad configurada (mm/cm/m)
- [ ] Opción de triangular funciona

---

## 🐛 Problemas Conocidos Corregidos

- ✅ **Arrastre directo no interfiere con selección múltiple** (Shift/Ctrl)
- ✅ **Box select funciona con Shift y Ctrl**
- ✅ **Todos los atajos tienen preventDefault**
- ✅ **Colores se limpian al importar**
- ✅ **Solo arrastra si te mueves más de 3 píxeles**
- ✅ **Arrastre directo detecta si realmente se movió**

---

## 📝 Notas de Testing

1. **Carga un modelo** (cubo primitivo o importa uno)
2. **Cambia a modo Edición** con Tab
3. **Prueba cada función** de la lista
4. **Marca** las que funcionen correctamente
5. **Reporta** cualquier problema nuevo

---

**Última actualización:** Correcciones aplicadas
**Estado:** Listo para testing completo
