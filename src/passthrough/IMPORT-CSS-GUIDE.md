# CSS Import - Figyelmen kívül hagyott Property-k Megoldása

## Probléma

Előzőleg, amikor CSS kódot bemásoltak egy presetből, az alábbi property-k **figyelmen kívül kerültek**:

```css
/* Effect properties - ✅ Működt */
backdrop-filter: blur(25px);
border-radius: 30px);

/* Ignored properties - ❌ ELVESZETT */
position: relative;
transform: scale(0.95);
color: #fff;
font-size: 1.5rem;
```

## Megoldás: CSS Import Modal

Most **ImportCSSModal** komponens lehetővé teszi ezeknek a "ignored property-knek" az automatikus implementálását.

### Hogyan működik?

1. **Nyisd meg a preset szerkesztést**
   - Admin oldal → Kattints az "Szerkesztés" gombra

2. **Menj a CSS Kód tabra**
   - Válaszd ki a "CSS Kód" tab-ot

3. **Kattints az "CSS importálása" gombra**
   - Megnyílik az ImportCSSModal

4. **Beillesztd a CSS kódot**
   - Kattints az "Vágólapból beillesztés" gombra VAGY
   - Manuálisan másold be az CSS-t a textarea-ba

5. **Megtekintsd az előnézetet**
   - A "Előnézet" tabra kattintva látod:
     - Hány effect property kerül slider módosításra
     - Hány passthrough property kerül direkten alkalmazásra
     - Hibákat és figyelmeztetéseket

6. **Importáld az összes property-t**
   - Kattints az "Importálás" gombra
   - Az effect properties → slider értékek
   - A passthrough properties → "Custom CSS Properties" panel

## Eljárás Részletesen

### Bemásolt CSS

```css
/* Teljes effect CSS */
.element {
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  background: rgba(255, 255, 255, 0.1);
  border-radius: 40px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.25);
  
  /* Ignored properties */
  position: fixed;
  top: 50px;
  left: 20px;
  width: 300px;
  height: 200px;
  transform: scale(0.95) translateY(10px);
  color: #ffffff;
  font-size: 1.2rem;
  font-weight: 600;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}
```

### Importálás után

**Effect Properties** (slider módosítás):
```
✓ blur: 30px
✓ background: rgba(255, 255, 255, 0.1)
✓ borderRadius: 40px
✓ border: 1px solid rgba(255, 255, 255, 0.2)
✓ boxShadow: 0 8px 32px...
```

**Passthrough Properties** (Direct CSS):
```
✓ position: fixed
✓ top: 50px
✓ left: 20px
✓ width: 300px
✓ height: 200px
✓ transform: scale(0.95) translateY(10px)
✓ color: #ffffff
✓ fontSize: 1.2rem
✓ fontWeight: 600
✓ textAlign: center
✓ display: flex
✓ alignItems: center
✓ justifyContent: center
✓ transition: all 0.3s ease
```

## ImportCSSModal UI

### Paste Tab
```
┌─────────────────────────────────────┐
│ CSS importálása                     │
├─────────────────────────────────────┤
│                                     │
│ CSS kód                             │
│ [textarea - bemásolt CSS]           │
│                                     │
│ [Vágólapból beillesztés] [Törlés]   │
└─────────────────────────────────────┘
```

### Preview Tab
```
┌─────────────────────────────────────┐
│ Előnézet                            │
├─────────────────────────────────────┤
│                                     │
│ Effect Properties    Passthrough    Hibák
│      7                   13          0
│                                     │
│ [Lista az effect properties-ből]    │
│ [Lista a passthrough properties]    │
│ [Diagnostics ha van]                │
│                                     │
│ [Importálás (20)]                   │
└─────────────────────────────────────┘
```

## Automatikus Kategorizáció

Az `parseCustomCSSWithPassthrough()` automatikusan eldönti, hogy melyik property:

### Effect Properties (Ismert):
- `backdrop-filter`, `background`, `background-color`
- `border`, `border-width`, `border-color`, `border-radius`
- `box-shadow`, `opacity`, `filter`

### Passthrough Properties (Egyéb):
- Minden más CSS property
- Layout: `position`, `top`, `left`, `width`, `height`, `display`
- Typography: `color`, `font-size`, `font-weight`, `text-align`
- Transforms: `transform`, `transition`, `animation`
- stb.

## Diagnostika

### Hibák (🔴 Error)
- Érvénytelen CSS szintaxis
- Nem értelmezhető érték
- Szintaktikai problémák

### Figyelmeztetések (🟡 Warning)
- Effect property de nem sikerült értelmezni
- Fallback: passthrough-ként kerül alkalmazásra

### Info (🔵 Info)
- Property sikeresen feldolgozva
- Melyik kategóriában van

## Workflow

```
1. Preset megnyitása
   ↓
2. CSS Kód tab
   ↓
3. Import CSS gomb
   ↓
4. CSS beillesztése (vágólapból vagy manuálisan)
   ↓
5. Előnézet megtekintése
   ├─ Effect properties: slider módosítás
   └─ Passthrough properties: direct CSS
   ↓
6. Importálás
   ↓
7. Eredmény:
   ├─ Sliders frissülnek
   ├─ Custom CSS Properties panel megjelenik
   └─ Preview: mindkettő látható
```

## Tárolt Adatok

Az importált properties az alábbiak szerint kerülnek tárolásra:

```typescript
// Effect overrides (sliders)
preset.userOverrides = {
  blur: 30,
  background: "rgba(255, 255, 255, 0.1)",
  borderRadius: 40,
  // ... stb
}

// Passthrough CSS
preset.passthroughCSS = {
  "position": "fixed",
  "top": "50px",
  "left": "20px",
  "width": "300px",
  "height": "200px",
  "transform": "scale(0.95) translateY(10px)",
  "color": "#ffffff",
  "font-size": "1.2rem",
  // ... stb
}
```

Mindkettő **LocalStorage**-ben tárolódik, így a teljes beállítás megmarad a lapfrissítés után.

## Előnyök

✅ **Nincs elveszett property**
- Az összes CSS property implementálódik valamilyen formában

✅ **Automatikus kategorizáció**
- Effect ↔ Passthrough szeparáció automatikusan történik

✅ **Live preview**
- Azonnal látod, hogyan néz ki az importált CSS

✅ **Kontrolled alkalmazás**
- Importálás előtt megtekintheted az előnézetet

✅ **Management**
- Egyedileg eltávolíthatod a passthrough property-ket

## Tippek

1. **Copy-paste teljes CSS blokk**
   - Másolj ki egy teljes `.class { ... }` blokkot
   - A modal automatikusan feldolgozza

2. **Mix effect + custom CSS**
   - Az import intelligensen szeparálja őket
   - Nem kell manuálisan választanod

3. **Previewing előtt importálásod**
   - Az "Előnézet" tab mutatja az eredményt
   - Hibákat és figyelmeztetéseket azonnal látod

4. **Passthrough removal után**
   - A Custom CSS Properties panelben eltávolítható az X gombbal
   - Vagy "Clear All" az összes passthrough property-hez

---

## Technikai Részletek

### parseCustomCSSWithPassthrough()

```typescript
const result = parseCustomCSSWithPassthrough(css, mode);

// result.effectOverrides: Record<string, number | string>
// result.passthroughProperties: Record<string, string>
// result.diagnostics: CSSParsingDiagnostic[]
```

### ImportCSSModal Props

```typescript
interface ImportCSSModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: EffectMode;
  onImport: (
    effectOverrides: Record<string, number | string>,
    passthroughCSS: Record<string, string>
  ) => void;
}
```

---

**Összefoglalva**: Az ImportCSSModal biztosítja, hogy **nincs elveszett CSS property** — az effect properties slider-eket módosítanak, a passthrough properties pedig direkten kerülnek alkalmazásra a preview-ban!
