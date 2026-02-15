import { usePresetManager } from '@/hooks/use-preset-manager';
import type { Preset } from '@/types/css-generator';

interface PresetGridProps {
  onSelect: (preset: Preset) => void;
}

export function PresetGrid({ onSelect }: PresetGridProps) {
  const { presets } = usePresetManager();

  return (
    <div className="grid grid-cols-4 md:grid-cols-3 gap-1.5 md:gap-2">
      {presets.map(preset => (
        <button
          key={preset.id}
          onClick={() => onSelect(preset)}
          className="group flex flex-col items-center gap-1 md:gap-1.5 rounded-lg bg-secondary/50 p-2 md:p-2.5 transition-all hover:bg-secondary hover:scale-105 min-h-[44px]"
        >
          <div
            className="h-6 w-6 md:h-8 md:w-8 rounded-lg shadow-md transition-transform group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${preset.color}40, ${preset.color}80)`,
              border: `1px solid ${preset.color}50`,
              backdropFilter: 'blur(4px)',
            }}
          />
          <span className="text-[9px] md:text-[10px] text-muted-foreground leading-tight text-center">
            {preset.name}
          </span>
        </button>
      ))}
    </div>
  );
}
