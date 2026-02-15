/**
 * COMPLETE ADMIN.TSX INTEGRATION WITH PASSTHROUGH CSS
 * 
 * This shows how to integrate the passthrough CSS system
 * into your existing Admin.tsx page.
 */

import { useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  generateLiquidGlassCSS,
  generateGlassmorphismCSS,
  generateNeumorphismCSS,
  generateGlowCSS
} from '@/hooks/use-css-generator';
import type { EffectMode, PresetSettings } from '@/types/css-generator';

// Import passthrough system
import { usePresetManagerWithPassthrough } from './use-passthrough-css-manager';
import {
  EnhancedCSSEditor,
  PassthroughPropertiesPanel,
  CSSDiagnosticsPanel,
  AdminCSSEditorSection
} from './passthrough-css-components';
import type { CSSParsingDiagnostic } from './use-passthrough-css-manager';

// ═══════════════════════════════════════════════════════════════════
// MAIN ADMIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function AdminPageWithPassthrough() {
  // CSS generator function (your existing logic)
  const generateCSS = useCallback((settings: PresetSettings, mode: EffectMode) => {
    switch (mode) {
      case 'liquid-glass':
        return generateLiquidGlassCSS(settings as any);
      case 'glassmorphism':
        return generateGlassmorphismCSS(settings as any);
      case 'neumorphism':
        return generateNeumorphismCSS(settings as any);
      case 'glow':
        return generateGlowCSS(settings as any);
      default:
        return { properties: {} };
    }
  }, []);
  
  // Enhanced preset manager with passthrough support
  const {
    presets,
    applyCustomCSSWithPassthrough,
    removePassthroughProperty,
    clearAllPassthrough,
    getFinalStyle,
    getPassthroughCount
  } = usePresetManagerWithPassthrough(generateCSS);
  
  // UI state
  const [editingPresetId, setEditingPresetId] = useState<string | null>(
    presets[0]?.id || null
  );
  const [cssText, setCssText] = useState('');
  const [diagnostics, setDiagnostics] = useState<CSSParsingDiagnostic[]>([]);
  const [activeTab, setActiveTab] = useState<'sliders' | 'css'>('sliders');
  
  // Get current preset
  const editingPreset = useMemo(() => 
    presets.find(p => p.id === editingPresetId),
    [presets, editingPresetId]
  );
  
  // Get final style with all layers merged
  const finalStyle = useMemo(() => {
    if (!editingPresetId) return {};
    return getFinalStyle(editingPresetId);
  }, [editingPresetId, getFinalStyle, presets]); // Re-compute when presets change
  
  // Get passthrough count
  const passthroughCount = useMemo(() => 
    getPassthroughCount(editingPresetId || ''),
    [editingPresetId, getPassthroughCount, presets]
  );
  
  // Handle CSS apply
  const handleApplyCSS = useCallback(() => {
    if (!editingPresetId) return;
    
    const diag = applyCustomCSSWithPassthrough(editingPresetId, cssText);
    setDiagnostics(diag);
    
    // Show toast notification
    const errorCount = diag.filter(d => d.type === 'error').length;
    const passthroughCount = diag.filter(d => 
      d.type === 'info' && d.message.includes('custom CSS')
    ).length;
    
    if (errorCount > 0) {
      console.warn(`Applied with ${errorCount} errors`);
    } else {
      console.log(`✅ Applied: ${passthroughCount} custom properties`);
    }
  }, [editingPresetId, cssText, applyCustomCSSWithPassthrough]);
  
  if (!editingPreset) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No presets available</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Settings & CSS Editor */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Edit Preset</h1>
              <select
                value={editingPresetId || ''}
                onChange={(e) => setEditingPresetId(e.target.value)}
                className="px-3 py-2 border rounded"
              >
                {presets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Tabs: Sliders vs CSS */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sliders">
                  Sliders
                </TabsTrigger>
                <TabsTrigger value="css">
                  Custom CSS
                  {passthroughCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-primary/20 rounded">
                      {passthroughCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              
              {/* Sliders Tab */}
              <TabsContent value="sliders" className="space-y-4">
                <PresetSettingsEditor
                  mode={editingPreset.mode}
                  settings={editingPreset.baseSettings}
                  updateSetting={(key, value) => {
                    // Your existing slider update logic
                    console.log('Update setting:', key, value);
                  }}
                />
              </TabsContent>
              
              {/* CSS Tab */}
              <TabsContent value="css" className="space-y-4">
                <EnhancedCSSEditor
                  cssText={cssText}
                  onCssChange={setCssText}
                  onApply={handleApplyCSS}
                  diagnostics={diagnostics}
                />
                
                {/* Passthrough Properties Panel */}
                {passthroughCount > 0 && (
                  <PassthroughPropertiesPanel
                    passthroughCSS={editingPreset.passthroughCSS || {}}
                    onRemove={(key) => removePassthroughProperty(editingPresetId, key)}
                    onClearAll={() => clearAllPassthrough(editingPresetId)}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
          
          {/* RIGHT COLUMN: Preview */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
              
              {/* Preview Box */}
              <div
                style={finalStyle}
                className="min-h-[400px] rounded-lg p-8 flex items-center justify-center"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-bold">
                    {editingPreset.name}
                  </h3>
                  <p className="text-sm opacity-75">
                    Effect + Custom CSS Applied
                  </p>
                  {passthroughCount > 0 && (
                    <p className="text-xs opacity-60">
                      {passthroughCount} custom properties active
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Generated CSS Display */}
            <details className="group">
              <summary className="text-sm font-medium cursor-pointer hover:text-primary select-none">
                View Final CSS
              </summary>
              <pre className="mt-2 text-xs bg-secondary/50 p-3 rounded overflow-auto max-h-[400px]">
                {JSON.stringify(finalStyle, null, 2)}
              </pre>
            </details>
            
            {/* Property Breakdown */}
            {passthroughCount > 0 && (
              <div className="space-y-2 p-4 border rounded-lg bg-secondary/20">
                <h3 className="text-sm font-semibold">Property Breakdown</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 bg-background rounded">
                    <span className="text-muted-foreground">Effect Properties:</span>
                    <span className="font-medium">
                      {Object.keys(finalStyle).length - passthroughCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-background rounded">
                    <span className="text-muted-foreground">Custom Properties:</span>
                    <span className="font-medium text-primary">
                      {passthroughCount}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PRESET SETTINGS EDITOR (Your existing component)
// ═══════════════════════════════════════════════════════════════════

interface PresetSettingsEditorProps {
  mode: EffectMode;
  settings: PresetSettings;
  updateSetting: (key: string, value: number | string) => void;
}

function PresetSettingsEditor({ mode, settings, updateSetting }: PresetSettingsEditorProps) {
  // Your existing slider UI
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Use sliders to adjust effect properties...
      </p>
      {/* Your slider components here */}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ALTERNATIVE: SIMPLER INTEGRATION WITHOUT TABS
// ═══════════════════════════════════════════════════════════════════

export function SimpleAdminIntegration() {
  const generateCSS = useCallback((settings: PresetSettings, mode: EffectMode) => {
    // Your CSS generator
    return { properties: {} };
  }, []);
  
  const {
    presets,
    applyCustomCSSWithPassthrough,
    removePassthroughProperty,
    getFinalStyle
  } = usePresetManagerWithPassthrough(generateCSS);
  
  const currentPreset = presets[0];
  const finalStyle = getFinalStyle(currentPreset?.id);
  
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* Your existing sliders */}
        
        {/* Add CSS Editor at bottom */}
        <AdminCSSEditorSection
          presetId={currentPreset.id}
          passthroughCSS={currentPreset.passthroughCSS || {}}
          onApplyCSS={(css) => applyCustomCSSWithPassthrough(currentPreset.id, css)}
          onRemovePassthrough={(key) => removePassthroughProperty(currentPreset.id, key)}
          onClearAllPassthrough={() => {
            // Clear all passthrough
          }}
        />
      </div>
      
      <div style={finalStyle} className="preview-box">
        Preview
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════

export { AdminPageWithPassthrough as default };
