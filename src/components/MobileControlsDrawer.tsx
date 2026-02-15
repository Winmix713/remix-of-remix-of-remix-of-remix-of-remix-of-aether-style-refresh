import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ControlsPanel } from './ControlsPanel';
import type { EffectMode, LiquidGlassSettings, GlassmorphismSettings, NeumorphismSettings, GlowSettings } from '@/types/css-generator';

interface MobileControlsDrawerProps {
  mode: EffectMode;
  setMode: (m: EffectMode) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  settings: LiquidGlassSettings | GlassmorphismSettings | NeumorphismSettings | GlowSettings;
  updateSetting: (key: string, value: number | string) => void;
  reset: () => void;
  applyPreset: (preset: any) => void;
}

export function MobileControlsDrawer(props: MobileControlsDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/30 md:hidden"
        size="icon"
      >
        <Settings className="h-6 w-6" />
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out md:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70vh' }}
      >
        <div className="rounded-t-2xl border-t border-border bg-card shadow-2xl h-full flex flex-col">
          {/* Handle + header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-1 w-8 rounded-full bg-muted-foreground/30 absolute left-1/2 -translate-x-1/2 top-2" />
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Controls</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-4">
            <ControlsPanel {...props} />
          </div>
        </div>
      </div>
    </>
  );
}
