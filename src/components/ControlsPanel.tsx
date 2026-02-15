import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw } from 'lucide-react';
import { PresetGrid } from './PresetGrid';
import type { EffectMode, LiquidGlassSettings, GlassmorphismSettings, NeumorphismSettings, GlowSettings, NeuShape } from '@/types/css-generator';

interface ControlsPanelProps {
  mode: EffectMode;
  setMode: (m: EffectMode) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  settings: LiquidGlassSettings | GlassmorphismSettings | NeumorphismSettings | GlowSettings;
  updateSetting: (key: string, value: number | string) => void;
  reset: () => void;
  applyPreset: (preset: any) => void;
}

function SliderControl({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="touch-none" />
    </div>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent" />
        <Input value={value} onChange={e => onChange(e.target.value)}
          className="h-7 w-20 font-mono text-xs bg-secondary border-border" />
      </div>
    </div>
  );
}

const modes: { id: EffectMode; label: string; badge?: string }[] = [
  { id: 'liquid-glass', label: 'Liquid Glass', badge: 'new' },
  { id: 'glassmorphism', label: 'Glassmorphism' },
  { id: 'neumorphism', label: 'Neumorphism' },
  { id: 'glow', label: 'Glow', badge: 'new' },
];

export function ControlsPanel(props: ControlsPanelProps) {
  const { mode, setMode, showAdvanced, setShowAdvanced, settings, updateSetting, reset, applyPreset } = props;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary/50 p-1 mb-3 md:mb-4">
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] md:text-xs font-medium transition-colors min-h-[44px] md:min-h-0 ${
              mode === m.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {m.label}
            {m.badge && <Badge className="ml-1 px-1 py-0 text-[8px] bg-primary/20 text-primary border-0">{m.badge}</Badge>}
          </button>
        ))}
      </div>

      {/* Advanced toggle */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <Label className="text-[11px] md:text-xs text-muted-foreground">Advanced</Label>
        <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
      </div>

      {/* Controls per mode */}
      <div className="space-y-3 md:space-y-4 flex-1">
        {mode === 'liquid-glass' && <LiquidGlassControls s={settings as LiquidGlassSettings} u={updateSetting} adv={showAdvanced} />}
        {mode === 'glassmorphism' && <GlassmorphismControls s={settings as GlassmorphismSettings} u={updateSetting} adv={showAdvanced} />}
        {mode === 'neumorphism' && <NeumorphismControls s={settings as NeumorphismSettings} u={updateSetting} adv={showAdvanced} />}
        {mode === 'glow' && <GlowControls s={settings as GlowSettings} u={updateSetting} adv={showAdvanced} />}
      </div>

      {/* Reset */}
      <Button variant="outline" size="sm" onClick={reset} className="mt-3 md:mt-4 mb-3 md:mb-4 w-full border-border text-muted-foreground min-h-[44px] md:min-h-0">
        <RotateCcw className="mr-2 h-3 w-3" /> Reset to Defaults
      </Button>

      {/* Presets */}
      <div className="border-t border-border pt-3 md:pt-4">
        <Label className="text-[11px] md:text-xs text-muted-foreground mb-2 md:mb-3 block">Presets</Label>
        <PresetGrid onSelect={applyPreset} />
      </div>
    </div>
  );
}

function LiquidGlassControls({ s, u, adv }: { s: LiquidGlassSettings; u: (k: string, v: number | string) => void; adv: boolean }) {
  return (
    <>
      <SliderControl label="Blur" value={s.blur} onChange={v => u('blur', v)} max={60} unit="px" />
      <SliderControl label="Background Alpha" value={s.bgAlpha} onChange={v => u('bgAlpha', v)} unit="%" />
      <SliderControl label="Border Radius" value={s.borderRadius} onChange={v => u('borderRadius', v)} max={50} unit="px" />
      <ColorControl label="Background Color" value={s.bgColor} onChange={v => u('bgColor', v)} />
      <ColorControl label="Border Color" value={s.borderColor} onChange={v => u('borderColor', v)} />
      <SliderControl label="Border Alpha" value={s.borderAlpha} onChange={v => u('borderAlpha', v)} unit="%" />
      {adv && (
        <>
          <SliderControl label="Border Width" value={s.borderWidth} onChange={v => u('borderWidth', v)} min={0} max={5} unit="px" />
          <SliderControl label="Refraction" value={s.refractionIntensity} onChange={v => u('refractionIntensity', v)} unit="%" />
          <SliderControl label="Shadow X" value={s.shadowX} onChange={v => u('shadowX', v)} min={-20} max={20} unit="px" />
          <SliderControl label="Shadow Y" value={s.shadowY} onChange={v => u('shadowY', v)} min={-20} max={20} unit="px" />
          <SliderControl label="Shadow Blur" value={s.shadowBlur} onChange={v => u('shadowBlur', v)} max={80} unit="px" />
          <SliderControl label="Shadow Spread" value={s.shadowSpread} onChange={v => u('shadowSpread', v)} min={-20} max={20} unit="px" />
          <SliderControl label="Shadow Alpha" value={s.shadowAlpha} onChange={v => u('shadowAlpha', v)} unit="%" />
          <SliderControl label="Saturation" value={s.saturation} onChange={v => u('saturation', v)} min={50} max={200} unit="%" />
          <SliderControl label="Brightness" value={s.brightness} onChange={v => u('brightness', v)} min={50} max={200} unit="%" />
        </>
      )}
    </>
  );
}

function GlassmorphismControls({ s, u, adv }: { s: GlassmorphismSettings; u: (k: string, v: number | string) => void; adv: boolean }) {
  return (
    <>
      <SliderControl label="Blur" value={s.blur} onChange={v => u('blur', v)} max={50} unit="px" />
      <SliderControl label="Background Alpha" value={s.bgAlpha} onChange={v => u('bgAlpha', v)} unit="%" />
      <SliderControl label="Border Radius" value={s.borderRadius} onChange={v => u('borderRadius', v)} max={50} unit="px" />
      <ColorControl label="Background Color" value={s.bgColor} onChange={v => u('bgColor', v)} />
      <ColorControl label="Border Color" value={s.borderColor} onChange={v => u('borderColor', v)} />
      <SliderControl label="Border Alpha" value={s.borderAlpha} onChange={v => u('borderAlpha', v)} unit="%" />
      {adv && (
        <>
          <SliderControl label="Border Width" value={s.borderWidth} onChange={v => u('borderWidth', v)} min={0} max={5} unit="px" />
          <SliderControl label="Shadow X" value={s.shadowX} onChange={v => u('shadowX', v)} min={-20} max={20} unit="px" />
          <SliderControl label="Shadow Y" value={s.shadowY} onChange={v => u('shadowY', v)} min={-20} max={20} unit="px" />
          <SliderControl label="Shadow Blur" value={s.shadowBlur} onChange={v => u('shadowBlur', v)} max={60} unit="px" />
          <SliderControl label="Shadow Alpha" value={s.shadowAlpha} onChange={v => u('shadowAlpha', v)} unit="%" />
          <SliderControl label="Saturation" value={s.saturation} onChange={v => u('saturation', v)} min={50} max={200} unit="%" />
        </>
      )}
    </>
  );
}

function NeumorphismControls({ s, u, adv }: { s: NeumorphismSettings; u: (k: string, v: number | string) => void; adv: boolean }) {
  const shapes: NeuShape[] = ['flat', 'concave', 'convex', 'pressed'];
  return (
    <>
      <SliderControl label="Border Radius" value={s.borderRadius} onChange={v => u('borderRadius', v)} max={50} unit="px" />
      <ColorControl label="Background" value={s.bgColor} onChange={v => u('bgColor', v)} />
      <SliderControl label="Distance" value={s.distance} onChange={v => u('distance', v)} min={1} max={20} unit="px" />
      <SliderControl label="Intensity" value={s.intensity} onChange={v => u('intensity', v)} min={1} max={50} unit="%" />
      <SliderControl label="Blur" value={s.blur} onChange={v => u('blur', v)} min={1} max={40} unit="px" />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Shape</Label>
        <div className="grid grid-cols-4 gap-1">
          {shapes.map(shape => (
            <button key={shape} onClick={() => u('shape', shape)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                s.shape === shape ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}>
              {shape}
            </button>
          ))}
        </div>
      </div>

      {adv && (
        <>
          <ColorControl label="Light Shadow" value={s.lightColor} onChange={v => u('lightColor', v)} />
          <ColorControl label="Dark Shadow" value={s.darkColor} onChange={v => u('darkColor', v)} />
        </>
      )}
    </>
  );
}

function GlowControls({ s, u, adv }: { s: GlowSettings; u: (k: string, v: number | string) => void; adv: boolean }) {
  return (
    <>
      <ColorControl label="Glow Color" value={s.glowColor} onChange={v => u('glowColor', v)} />
      <SliderControl label="Glow Intensity" value={s.glowIntensity} onChange={v => u('glowIntensity', v)} unit="%" />
      <SliderControl label="Glow Spread" value={s.glowSpread} onChange={v => u('glowSpread', v)} max={100} unit="px" />
      <SliderControl label="Glow Blur" value={s.glowBlur} onChange={v => u('glowBlur', v)} max={200} unit="px" />
      <SliderControl label="Border Radius" value={s.borderRadius} onChange={v => u('borderRadius', v)} max={100} unit="px" />
      <ColorControl label="Background" value={s.bgColor} onChange={v => u('bgColor', v)} />
      <SliderControl label="BG Alpha" value={s.bgAlpha} onChange={v => u('bgAlpha', v)} unit="%" />
      <ColorControl label="Border Color" value={s.borderColor} onChange={v => u('borderColor', v)} />
      <SliderControl label="Border Alpha" value={s.borderAlpha} onChange={v => u('borderAlpha', v)} unit="%" />
      {adv && (
        <>
          <SliderControl label="Inner Glow" value={s.innerGlow} onChange={v => u('innerGlow', v)} unit="%" />
          <SliderControl label="Border Width" value={s.borderWidth} onChange={v => u('borderWidth', v)} max={5} unit="px" />
          <SliderControl label="Backdrop Blur" value={s.blur} onChange={v => u('blur', v)} max={40} unit="px" />
          <SliderControl label="Saturation" value={s.saturation} onChange={v => u('saturation', v)} min={50} max={300} unit="%" />
          <SliderControl label="Brightness" value={s.brightness} onChange={v => u('brightness', v)} min={50} max={300} unit="%" />
        </>
      )}
    </>
  );
}
