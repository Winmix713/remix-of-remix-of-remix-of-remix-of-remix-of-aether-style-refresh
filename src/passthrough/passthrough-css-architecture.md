# 🎨 PASSTHROUGH CSS PROPERTIES - ARCHITECTURE EXTENSION

## 🎯 A PROBLÉMA

Jelenleg a rendszer **ignorálja** az effect-specifikus property-ken kívüli CSS-t:

```css
/* Effect properties - HASZNÁLVA ✅ */
backdrop-filter: blur(20px);
border-radius: 24px;
background: rgba(255,255,255,0.1);

/* Layout/Typography - IGNORÁLVA ❌ */
position: relative;
transform: scale(0.9);
color: #fff;
font-size: 2rem;
width: 100%;
```

## ✅ MEGOLDÁS: HYBRID SETTINGS MODEL

### CONCEPT: Két külön property layer
```typescript
interface EnhancedPresetWithPassthrough {
  // Layer 1: Effect settings (slider-controlled)
  baseSettings: EffectSettings;
  userOverrides: Partial<EffectSettings>;
  
  // Layer 2: Passthrough CSS (nem slider-controlled)
  passthroughCSS: Record<string, string>;  // ← ÚJ!
  
  // Metadata
  isCustomized: boolean;
}
```

---

## 🏗️ IMPLEMENTATION

### 1️⃣ Enhanced Data Structure

```typescript
/**
 * Extended preset with passthrough properties
 */
export interface PresetWithPassthrough extends EnhancedPreset {
  // Original effect settings (controlled by sliders)
  baseSettings: PresetSettings;
  userOverrides?: Partial<PresetSettings>;
  
  // NEW: Custom CSS properties (not controlled by sliders)
  passthroughCSS?: Record<string, string>;
  
  // Metadata
  customCSS?: string;
  isCustomized: boolean;
}

/**
 * Kategorize CSS properties
 */
export const EFFECT_PROPERTY_KEYS = new Set([
  'blur',
  'borderRadius',
  'background',
  'backgroundColor',
  'backdropFilter',
  'border',
  'borderWidth',
  'borderColor',
  'boxShadow',
  'opacity',
  // ... all effect-related properties
]);

/**
 * Check if property is effect-controlled
 */
export function isEffectProperty(cssKey: string): boolean {
  // Convert CSS key to camelCase for comparison
  const camelKey = cssKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  return EFFECT_PROPERTY_KEYS.has(camelKey);
}
```

### 2️⃣ Enhanced CSS Parser

```typescript
/**
 * Parse CSS and separate into effect properties and passthrough
 */
export function parseCustomCSSWithPassthrough(
  css: string,
  mode: EffectMode
): {
  effectOverrides: Partial<PresetSettings>;
  passthroughProperties: Record<string, string>;
  diagnostics: CSSParsingDiagnostic[];
} {
  const effectOverrides: Partial<any> = {};
  const passthroughProperties: Record<string, string> = {};
  const diagnostics: CSSParsingDiagnostic[] = [];
  
  try {
    // Parse all CSS declarations
    const declarations = parseAllCSSDeclarations(css);
    
    for (const [property, value] of Object.entries(declarations)) {
      if (isEffectProperty(property)) {
        // Effect property → try to extract to settings
        const extracted = extractEffectValue(property, value, mode);
        if (extracted) {
          effectOverrides[extracted.key] = extracted.value;
          diagnostics.push({
            type: 'info',
            property,
            message: `Mapped to effect setting: ${extracted.key}`
          });
        } else {
          // Failed to extract → fallback to passthrough
          passthroughProperties[property] = value;
          diagnostics.push({
            type: 'warning',
            property,
            message: 'Effect property but could not parse — using as-is'
          });
        }
      } else {
        // Non-effect property → passthrough
        passthroughProperties[property] = value;
        diagnostics.push({
          type: 'info',
          property,
          message: `Not an effect property — will be applied as custom CSS`
        });
      }
    }
    
    // Clamp effect overrides
    const clamped = clampSettings(mode, effectOverrides);
    
    return {
      effectOverrides: clamped,
      passthroughProperties,
      diagnostics
    };
    
  } catch (error) {
    diagnostics.push({
      type: 'error',
      property: 'parser',
      message: `CSS parsing failed: ${error.message}`
    });
    return { effectOverrides: {}, passthroughProperties: {}, diagnostics };
  }
}

/**
 * Parse all CSS declarations from string
 */
function parseAllCSSDeclarations(css: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  
  // Remove comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Extract declarations (property: value;)
  const declarationRegex = /([\w-]+)\s*:\s*([^;]+);?/g;
  let match;
  
  while ((match = declarationRegex.exec(css)) !== null) {
    const [, property, value] = match;
    declarations[property.trim()] = value.trim();
  }
  
  return declarations;
}

/**
 * Diagnostic message for parsing
 */
interface CSSParsingDiagnostic {
  type: 'info' | 'warning' | 'error';
  property: string;
  message: string;
  line?: number;
}
```

### 3️⃣ Enhanced Merge Strategy

```typescript
/**
 * Merge all layers: base + overrides + passthrough
 */
export function mergeAllLayers(
  preset: PresetWithPassthrough
): {
  effectSettings: PresetSettings;
  finalStyle: CSSProperties;
} {
  // Step 1: Merge effect settings
  const effectSettings = mergePresetSettings(
    preset.baseSettings,
    preset.userOverrides,
    undefined, // Don't parse customCSS here
    preset.mode
  );
  
  // Step 2: Generate effect CSS
  const generated = generateCSSForMode(effectSettings, preset.mode);
  
  // Step 3: Convert to React style object
  const effectStyle = cssPropertiesToReactStyle(generated.properties);
  
  // Step 4: Add passthrough properties
  const passthroughStyle = passthroughToReactStyle(
    preset.passthroughCSS || {}
  );
  
  // Step 5: Merge (passthrough AFTER effect to allow overrides)
  const finalStyle: CSSProperties = {
    ...effectStyle,
    ...passthroughStyle
  };
  
  return { effectSettings, finalStyle };
}

/**
 * Convert passthrough CSS to React style object
 */
function passthroughToReactStyle(
  passthrough: Record<string, string>
): CSSProperties {
  const style: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(passthrough)) {
    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    style[camelKey] = value;
  }
  
  return style as CSSProperties;
}
```

### 4️⃣ Enhanced Preset Manager Hook

```typescript
export function useEnhancedPresetManagerWithPassthrough() {
  const [presets, setPresets] = useState<PresetWithPassthrough[]>([]);
  
  /**
   * Apply custom CSS with passthrough support
   */
  const applyCustomCSSWithPassthrough = useCallback((
    presetId: string,
    css: string
  ) => {
    setPresets(prev => {
      const updated = prev.map(preset => {
        if (preset.id !== presetId) return preset;
        
        // Parse with passthrough separation
        const { effectOverrides, passthroughProperties, diagnostics } = 
          parseCustomCSSWithPassthrough(css, preset.mode);
        
        // Log diagnostics
        console.log('CSS Parsing Diagnostics:', diagnostics);
        
        return {
          ...preset,
          customCSS: css,
          userOverrides: {
            ...preset.userOverrides,
            ...effectOverrides  // Merge effect overrides
          },
          passthroughCSS: {
            ...preset.passthroughCSS,
            ...passthroughProperties  // Merge passthrough
          },
          isCustomized: true,
          lastModified: Date.now()
        };
      });
      
      saveToStorage(updated);
      return updated;
    });
  }, []);
  
  /**
   * Remove specific passthrough property
   */
  const removePassthroughProperty = useCallback((
    presetId: string,
    propertyKey: string
  ) => {
    setPresets(prev => {
      const updated = prev.map(preset => {
        if (preset.id !== presetId) return preset;
        
        const newPassthrough = { ...preset.passthroughCSS };
        delete newPassthrough[propertyKey];
        
        return {
          ...preset,
          passthroughCSS: newPassthrough,
          lastModified: Date.now()
        };
      });
      
      saveToStorage(updated);
      return updated;
    });
  }, []);
  
  /**
   * Get final merged style for preview
   */
  const getFinalStyle = useCallback((
    presetId: string
  ): CSSProperties => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return {};
    
    const { finalStyle } = mergeAllLayers(preset);
    return finalStyle;
  }, [presets]);
  
  return {
    presets,
    applyCustomCSSWithPassthrough,
    removePassthroughProperty,
    getFinalStyle,
    // ... other methods
  };
}
```

---

## 🎨 UI COMPONENTS

### 5️⃣ Passthrough Properties Panel

```tsx
interface PassthroughPropertiesPanelProps {
  passthroughCSS: Record<string, string>;
  onRemove: (key: string) => void;
}

function PassthroughPropertiesPanel({
  passthroughCSS,
  onRemove
}: PassthroughPropertiesPanelProps) {
  const entries = Object.entries(passthroughCSS);
  
  if (entries.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-2 p-3 border rounded-lg bg-secondary/30">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">
          Custom CSS Properties
        </Label>
        <Badge variant="secondary" className="text-[10px]">
          {entries.length} applied
        </Badge>
      </div>
      
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {entries.map(([key, value]) => (
          <div 
            key={key}
            className="flex items-center justify-between gap-2 p-2 rounded bg-background/50 hover:bg-background"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-[11px] font-mono text-primary">
                  {key}
                </code>
                <span className="text-[11px] text-muted-foreground">:</span>
              </div>
              <code className="text-[10px] font-mono text-muted-foreground truncate block">
                {value}
              </code>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => onRemove(key)}
              title="Remove this property"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
      
      <p className="text-[9px] text-muted-foreground leading-relaxed">
        These properties are applied directly to the preview without affecting 
        effect sliders. They override effect settings if there's a conflict.
      </p>
    </div>
  );
}
```

### 6️⃣ Enhanced CSS Editor with Diagnostics

```tsx
interface EnhancedCSSEditorProps {
  cssText: string;
  onCssChange: (css: string) => void;
  onApply: () => void;
  diagnostics?: CSSParsingDiagnostic[];
}

function EnhancedCSSEditor({
  cssText,
  onCssChange,
  onApply,
  diagnostics = []
}: EnhancedCSSEditorProps) {
  const [localCss, setLocalCss] = useState(cssText);
  const hasChanges = localCss !== cssText;
  
  // Group diagnostics by type
  const grouped = useMemo(() => {
    const errors = diagnostics.filter(d => d.type === 'error');
    const warnings = diagnostics.filter(d => d.type === 'warning');
    const infos = diagnostics.filter(d => d.type === 'info');
    return { errors, warnings, infos };
  }, [diagnostics]);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Custom CSS</Label>
        <Button
          size="sm"
          onClick={() => {
            onCssChange(localCss);
            onApply();
          }}
          disabled={!hasChanges}
        >
          {hasChanges ? 'Apply CSS' : 'No Changes'}
        </Button>
      </div>
      
      <Textarea
        value={localCss}
        onChange={(e) => setLocalCss(e.target.value)}
        className="font-mono text-xs h-[200px]"
        placeholder={`/* Effect properties (controlled by sliders) */
backdrop-filter: blur(25px);
border-radius: 30px;

/* Custom properties (passthrough) */
position: relative;
transform: scale(0.9);
color: #fff;
font-size: 2rem;
width: 100%;`}
      />
      
      {/* Diagnostics Panel */}
      {diagnostics.length > 0 && (
        <div className="space-y-2">
          {/* Errors */}
          {grouped.errors.length > 0 && (
            <DiagnosticSection
              type="error"
              title="Errors"
              items={grouped.errors}
            />
          )}
          
          {/* Warnings */}
          {grouped.warnings.length > 0 && (
            <DiagnosticSection
              type="warning"
              title="Warnings"
              items={grouped.warnings}
            />
          )}
          
          {/* Info - Collapsible */}
          {grouped.infos.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                <Info className="w-3.5 h-3.5" />
                <span>{grouped.infos.length} properties processed</span>
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-2 space-y-1">
                {grouped.infos.map((diag, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground pl-5">
                    <code className="text-primary">{diag.property}</code>: {diag.message}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function DiagnosticSection({
  type,
  title,
  items
}: {
  type: 'error' | 'warning';
  title: string;
  items: CSSParsingDiagnostic[];
}) {
  const Icon = type === 'error' ? AlertCircle : AlertTriangle;
  const colorClass = type === 'error' ? 'text-destructive' : 'text-yellow-600';
  
  return (
    <div className={`space-y-1 p-2 border rounded ${colorClass} bg-opacity-5`}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <Icon className="w-3.5 h-3.5" />
        <span>{title}</span>
        <Badge variant="secondary" className="text-[9px]">
          {items.length}
        </Badge>
      </div>
      {items.map((diag, i) => (
        <div key={i} className="text-[10px] pl-5">
          <code className="text-primary">{diag.property}</code>: {diag.message}
        </div>
      ))}
    </div>
  );
}
```

---

## 📋 COMPLETE INTEGRATION EXAMPLE

```tsx
export function AdminPageWithPassthrough() {
  const {
    presets,
    applyCustomCSSWithPassthrough,
    removePassthroughProperty,
    getFinalStyle
  } = useEnhancedPresetManagerWithPassthrough();
  
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [cssText, setCssText] = useState('');
  const [diagnostics, setDiagnostics] = useState<CSSParsingDiagnostic[]>([]);
  
  const editingPreset = presets.find(p => p.id === editingPresetId);
  
  // Get final style with passthrough applied
  const finalStyle = useMemo(() => {
    if (!editingPresetId) return {};
    return getFinalStyle(editingPresetId);
  }, [editingPresetId, getFinalStyle]);
  
  const handleApplyCSS = useCallback(() => {
    if (!editingPresetId) return;
    
    // This will parse and separate effect vs passthrough
    const result = parseCustomCSSWithPassthrough(cssText, editingPreset.mode);
    setDiagnostics(result.diagnostics);
    
    applyCustomCSSWithPassthrough(editingPresetId, cssText);
  }, [editingPresetId, cssText, editingPreset, applyCustomCSSWithPassthrough]);
  
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Settings & CSS Editor */}
      <div className="space-y-4">
        {/* Sliders for effect settings */}
        <PresetSettingsEditor
          mode={editingPreset.mode}
          settings={editingPreset.baseSettings}
          updateSetting={(key, value) => {
            applyUserOverride(editingPresetId, key, value);
          }}
        />
        
        {/* CSS Editor */}
        <EnhancedCSSEditor
          cssText={cssText}
          onCssChange={setCssText}
          onApply={handleApplyCSS}
          diagnostics={diagnostics}
        />
        
        {/* Passthrough Properties Panel */}
        {editingPreset?.passthroughCSS && (
          <PassthroughPropertiesPanel
            passthroughCSS={editingPreset.passthroughCSS}
            onRemove={(key) => removePassthroughProperty(editingPresetId, key)}
          />
        )}
      </div>
      
      {/* Right: Live Preview */}
      <div className="space-y-4">
        <div
          style={finalStyle}  // ← All layers merged!
          className="preview-box"
        >
          <h1>Preview</h1>
          <p>Effect + Custom CSS applied</p>
        </div>
        
        {/* Generated CSS Display */}
        <pre className="text-xs bg-secondary p-3 rounded overflow-auto max-h-[300px]">
          {JSON.stringify(finalStyle, null, 2)}
        </pre>
      </div>
    </div>
  );
}
```

---

## 🎯 KEY FEATURES

### ✅ What This Gives You:

1. **Effect Properties** → Extracted to sliders (như hiện tại)
2. **Custom Properties** → Applied as passthrough CSS
3. **Full Preview** → Both layers merged in live preview
4. **Diagnostics** → Show which properties go where
5. **Remove Control** → User can remove individual passthrough properties
6. **Conflict Resolution** → Passthrough overrides effect settings

### 🔄 Data Flow:

```
User CSS Input
      ↓
Parse & Categorize
      ↓
   ┌──┴──┐
   │     │
Effect  Passthrough
Props   Props
   │     │
   ↓     ↓
Sliders  Direct
Update   Apply
   │     │
   └──┬──┘
      ↓
  Final Style
      ↓
   Preview
```

---

## 📦 IMPLEMENTATION CHECKLIST

- [ ] Add `passthroughCSS` field to preset interface
- [ ] Implement `parseCustomCSSWithPassthrough()`
- [ ] Update merge function to include passthrough layer
- [ ] Add `PassthroughPropertiesPanel` component
- [ ] Add diagnostic display to CSS editor
- [ ] Update preview to use `finalStyle`
- [ ] Add remove passthrough property function
- [ ] Test with complex CSS (transforms, animations, etc.)
- [ ] Update localStorage schema (migration)
- [ ] Add documentation for users

---

**Ez a megoldás lehetővé teszi, hogy:**
- ✅ Effect property-k → sliders
- ✅ Custom property-k → passthrough
- ✅ Mindkettő látható a preview-ban
- ✅ User eltávolíthat egyenként passthrough property-ket
- ✅ Clear diagnostics
