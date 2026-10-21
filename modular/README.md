# PolyCraft Studio Web

Editor Low Poly para papercraft (Pepakura) · Three.js · 100% en navegador

## 🚀 Cómo ejecutar

### Opción 1: Servidor Node.js (Recomendado)

1. Asegúrate de tener Node.js instalado
2. Abre una terminal en esta carpeta
3. Ejecuta:
   ```bash
   node server.js
   ```
4. Abre tu navegador en: **http://localhost:3000**

### Opción 2: Extensión Live Server de VS Code

1. Instala la extensión "Live Server" en VS Code
2. Haz clic derecho en `index.html`
3. Selecciona "Open with Live Server"

### Opción 3: Python (si no tienes Node.js)

```bash
# Python 3
python -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

Luego abre: **http://localhost:3000**

## ⚠️ Importante

**No puedes abrir `index.html` directamente** haciendo doble clic porque los navegadores bloquean la carga de módulos ES6 por razones de seguridad (CORS). Debes usar un servidor HTTP local.

## ✨ Características

### 🆕 v2.2.0 - Low Poly Automático
- **Low Poly Automático para Papercraft**: Botón con 3 presets (Ligero/Medio/Agresivo)
- **Simplificación en 3 pasos**: Decimación + unión de vértices + fusión coplanar
- **Optimizado para Pepakura**: Reduce triangulación excesiva en modelos importados
- **Estadísticas en tiempo real**: Muestra % de reducción de geometría

### ✨ v2.1.0 - Crear Caras
- **Crear caras desde vértices (F)**: Selecciona vértices y crea caras automáticamente
- **Ordenamiento inteligente**: Algoritmo de proyección planar + orden angular

### 🎨 Edición
- **Añadir vértices**: doble clic en aristas/caras, herramienta V
- **Cuchillo (K)**: cortar caras con líneas
- **Conectar (J)**: unir vértices seleccionados con arista
- **Arrastre directo**: mover vértices/aristas/caras sin pulsar G
- **Fusión automática**: soltar vértice sobre otro los une
- **Hover**: resaltar elemento bajo el cursor
- **Disolver mejorado**: Ctrl+X sin dejar huecos

### 🔧 Herramientas Low Poly
- **Low Poly Automático**: Simplificación con un clic (3 presets)
- **Unir caras coplanares**: Convierte triángulos en polígonos
- **Unir vértices por distancia**: Limpia geometría duplicada
- **Triangular**: Todo/No planas/Selección

### 🎨 Personalización
- **Imagen de fondo**: como referencia
- **Colores por cara**: para pintar el modelo

### 📦 Importar/Exportar
- **Importar**: OBJ, STL y **FBX**
- **Exportar**: OBJ para Pepakura

## 🎮 Atajos principales

- **Tab**: Alternar Objeto/Edición
- **1/2/3**: Vértices/Aristas/Caras
- **G/R/S**: Mover/Rotar/Escalar
- **F**: Crear cara desde vértices
- **V**: Añadir vértice
- **K**: Cuchillo
- **J**: Conectar vértices
- **M**: Unir vértices
- **X**: Eliminar
- **Ctrl+X**: Disolver
- **A**: Seleccionar todo
- **Ctrl+Z**: Deshacer
- **Shift+F**: Enfocar selección

## 📦 Estructura

```
modular/
├── index.html      # Interfaz HTML
├── styles.css      # Estilos
├── app.js          # Lógica principal (Three.js)
├── server.js       # Servidor HTTP local
└── README.md       # Este archivo
```

## 🛠️ Tecnologías

- **Three.js** v0.185.1 (vía CDN)
- HTML5 Canvas
- Vanilla JavaScript (ES6 modules)
- CSS3

## 📝 Notas

- Los archivos se importan/exportan conservando la escala
- Las unidades se configuran en el panel (mm/cm/m/pulgadas)
- La validación de malla detecta problemas comunes
- Función "Analizar y Reparar" para corregir geometría

---

**PolyCraft Studio Web** · Editor low poly en navegador
