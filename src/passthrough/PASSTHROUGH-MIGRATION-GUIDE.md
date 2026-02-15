# 🚀 PASSTHROUGH CSS - MIGRATION GUIDE

## ⚡ Quick Start (3 Steps, 15 Minutes)

### STEP 1: Copy Files (2 min)
```bash
# Copy these 3 files to your project:
1. use-passthrough-css-manager.tsx      → src/hooks/
2. passthrough-css-components.tsx       → src/components/
3. admin-passthrough-integration.tsx    → src/pages/ (as reference)
```

### STEP 2: Update Admin.tsx (10 min)

#### A) Replace Hook Import
```typescript
// BEFORE:
import { useEnhancedPresetManager } from '@/hooks/use-enhanced-preset-manager';

// AFTER:
import { usePresetManagerWithPassthrough } from '@/hooks/use-passthrough-css-manager';
```

#### B) Create CSS Generator Function
```typescript
const generateCSS = useCallback((settings: PresetSettings, mode: EffectMode) => {
  switch (mode) {
    case 'liquid-glass': return generateLiquidGlassCSS(settings as any);
    case 'glassmorphism': return generateGlassmorphismCSS(settings as any);
    case 'neumorphism': return generateNeumorphismCSS(settings as any);
    case 'glow': return generateGlowCSS(settings as any);
  }
}, []);
```

#### C) Replace Hook Usage
```typescript
// BEFORE:
const { presets, applyCustomCSS, ... } = useEnhancedPresetManager();

// AFTER:
const {
  presets,
  applyCustomCSSWithPassthrough,  // ← New method
  removePassthroughProperty,       // ← New method
  clearAllPassthrough,             // ← New method
  getFinalStyle,                   // ← Modified (includes passthrough)
  getPassthroughCount              // ← New method
} = usePresetManagerWithPassthrough(generateCSS);
```

#### D) Update Preview Style
```typescript
// BEFORE:
const previewStyle = useMemo(() => {
  const generated = generateCSS(effectiveSettings, mode);
  return cssPropertiesToReactStyle(generated.properties);
}, [effectiveSettings, mode]);

// AFTER:
const finalStyle = useMemo(() => {
  if (!editingPresetId) return {};
  return getFinalStyle(editingPresetId);  // ← Includes passthrough!
}, [editingPresetId, getFinalStyle, presets]);

// Apply to preview:
<div style={finalStyle}>Preview</div>
```

#### E) Add Passthrough Components
```tsx
// Import components
import {
  EnhancedCSSEditor,
  PassthroughPropertiesPanel
} from '@/components/passthrough-css-components';

// Add to your UI (after CSS editor):
{editingPreset?.passthroughCSS && Object.keys(editingPreset.passthroughCSS).length > 0 && (
  <PassthroughPropertiesPanel
    passthroughCSS={editingPreset.passthroughCSS}
    onRemove={(key) => removePassthroughProperty(editingPresetId, key)}
    onClearAll={() => clearAllPassthrough(editingPresetId)}
  />
)}
```

### STEP 3: Test (3 min)

```typescript
// Test Cases:
// 1. Add effect CSS (should update sliders)
backdrop-filter: blur(30px);
border-radius: 40px;

// 2. Add custom CSS (should appear in passthrough panel)
position: relative;
transform: scale(0.9);
color: #fff;
font-size: 2rem;

// 3. Check preview (both should be visible)
// 4. Remove passthrough property (X button)
// 5. Reload page (passthrough should persist)
```

---

## 📊 WHAT CHANGES

### Data Structure
```typescript
// OLD:
interface EnhancedPreset {
  baseSettings: Settings;
  userOverrides?: Partial<Settings>;
  customCSS?: string;
}

// NEW:
interface PresetWithPassthrough {
  baseSettings: Settings;
  userOverrides?: Partial<Settings>;
  passthroughCSS?: Record<string, string>;  // ← NEW!
  customCSS?: string;
}
```

### CSS Parsing
```typescript
// OLD: All CSS → try extract to settings → fail = lost
parseCSS(css) → settings

// NEW: Separate effect vs passthrough
parseCustomCSSWithPassthrough(css) → {
  effectOverrides,      // → Update sliders
  passthroughProperties, // → Apply directly
  diagnostics           // → Show to user
}
```

### Preview Style
```typescript
// OLD: Only effect properties
previewStyle = generateCSS(effectSettings)

// NEW: Effect + passthrough merged
finalStyle = {
  ...effectCSS,
  ...passthroughCSS  // Custom properties override
}
```

---

## 🎯 KEY FEATURES

### ✅ What You Get

1. **Effect Properties**
   - Extract to sliders (like before)
   - Example: `blur`, `border-radius`, `background`

2. **Passthrough Properties**
   - Apply directly to preview
   - Not controlled by sliders
   - Example: `position`, `transform`, `color`, `font-size`

3. **Diagnostics**
   - Shows which properties go where
   - Errors, warnings, info messages
   - User-friendly feedback

4. **Management UI**
   - List all passthrough properties
   - Remove individually
   - Clear all button

5. **Preview**
   - Both layers visible
   - True WYSIWYG

---

## 🔧 COMMON SCENARIOS

### Scenario 1: User Adds Layout CSS
```css
/* User types: */
position: relative;
width: 300px;
height: 200px;
display: flex;
align-items: center;
justify-content: center;
```

**Result:**
- All 6 properties → passthrough panel
- Preview updated immediately
- Sliders unchanged
- Diagnostic: "Applied as custom CSS (not controlled by sliders)"

### Scenario 2: User Mixes Effect + Custom
```css
/* User types: */
backdrop-filter: blur(25px);
border-radius: 50px;
transform: scale(0.95);
color: #ffffff;
```

**Result:**
- `backdrop-filter` → `blur` slider updated to 25
- `border-radius` → slider updated to 50
- `transform`, `color` → passthrough panel
- Preview shows all 4 properties

### Scenario 3: User Removes Passthrough
```
User clicks X on "transform: scale(0.95)"
```

**Result:**
- Property removed from passthrough panel
- Preview updated (transform no longer applied)
- Effect properties unchanged
- Can re-add by typing CSS again

---

## 🎨 UI/UX FLOW

```
┌─────────────────────────────────────────┐
│ CSS Editor                              │
├─────────────────────────────────────────┤
│                                         │
│ backdrop-filter: blur(30px);            │
│ transform: scale(0.9);                  │
│ color: #fff;                            │
│                                         │
│         [Apply CSS]                     │
└─────────────────────────────────────────┘
             │
             ↓ Apply
             │
    ┌────────┴────────┐
    │                 │
Effect Props    Passthrough
    │                 │
    ↓                 ↓
┌─────────┐    ┌──────────────────┐
│ Sliders │    │ Custom CSS       │
│ Updated │    │ Properties Panel │
└─────────┘    │                  │
               │ • transform      │
               │ • color          │
               │                  │
               │ [Clear All]      │
               └──────────────────┘
                    │
                    ↓
              ┌──────────┐
              │ Preview  │
              │ (merged) │
              └──────────┘
```

---

## 📋 TESTING CHECKLIST

- [ ] Effect CSS updates sliders
- [ ] Custom CSS goes to passthrough panel
- [ ] Preview shows both layers
- [ ] Remove passthrough property works
- [ ] Clear all passthrough works
- [ ] Diagnostics display correctly
- [ ] LocalStorage persists passthrough
- [ ] Reload page preserves state
- [ ] Multiple presets isolated
- [ ] Conflicts (passthrough overrides effect) work correctly

---

## 🐛 TROUBLESHOOTING

### Problem: Passthrough properties not showing in preview
**Solution:** Make sure you're using `getFinalStyle()` not the old preview style

### Problem: Sliders not updating from CSS
**Solution:** Check `EFFECT_CSS_PROPERTIES` set includes your property

### Problem: TypeScript errors on passthrough types
**Solution:** Update your preset interface to include `passthroughCSS?: Record<string, string>`

### Problem: LocalStorage quota exceeded
**Solution:** Passthrough adds data - may need to limit preset count or compress

### Problem: CSS parsing fails
**Solution:** Check `parseAllCSSDeclarations()` - may need to handle your CSS format

---

## 🎓 BEST PRACTICES

### DO:
- ✅ Use passthrough for layout/typography/animations
- ✅ Keep effect properties in sliders
- ✅ Show diagnostics to users
- ✅ Allow removing individual passthrough properties
- ✅ Persist passthrough in localStorage

### DON'T:
- ❌ Don't try to extract all CSS to sliders
- ❌ Don't hide passthrough panel (user needs visibility)
- ❌ Don't merge passthrough before effect (wrong priority)
- ❌ Don't forget to update preview when passthrough changes

---

## 📦 MINIMAL INTEGRATION

If you want the simplest possible integration:

```tsx
// 1. Import
import { usePresetManagerWithPassthrough } from './use-passthrough-css-manager';

// 2. Use
const { getFinalStyle } = usePresetManagerWithPassthrough(generateCSS);

// 3. Apply
<div style={getFinalStyle(presetId)}>Preview</div>

// Done! Passthrough will work even without UI components
```

---

## 🎉 SUCCESS CRITERIA

You know it's working when:
- ✅ User can type ANY CSS
- ✅ Effect properties update sliders
- ✅ Other properties appear in passthrough panel
- ✅ Preview shows everything
- ✅ User can remove passthrough properties
- ✅ Everything persists on reload

---

**Total Migration Time:** ~15 minutes  
**Breaking Changes:** None (backward compatible)  
**New Dependencies:** None  
**Storage Key:** `enhanced-presets-passthrough-v1` (new key)

🚀 Ready to implement!
