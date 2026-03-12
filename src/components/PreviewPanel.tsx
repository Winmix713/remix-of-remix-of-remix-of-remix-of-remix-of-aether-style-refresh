import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Shuffle, Sun, Moon, Check, ShieldCheck, ShieldX } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { EffectMode, GeneratedCSS, Preset, PreviewTab } from '@/types/css-generator';
import { CSSCodeEditor } from './CSSCodeEditor';
import { parseAndValidateCSS, type AccessibilityInfo } from './css-utils';

interface PreviewPanelProps {
  mode: EffectMode;
  previewStyle: React.CSSProperties;
  generatedCSS: GeneratedCSS;
  darkText: boolean;
  setDarkText: (v: boolean) => void;
  randomize: () => void;
  previewTab: PreviewTab;
  setPreviewTab: (t: PreviewTab) => void;
  currentSettings: Preset['settings'];
  onSettingsChange: (s: Preset['settings']) => void;
}

export function PreviewPanel({
  mode, previewStyle, generatedCSS, darkText, setDarkText, randomize, previewTab, setPreviewTab,
  currentSettings, onSettingsChange,
}: PreviewPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyCSS = () => {
    navigator.clipboard.writeText(generatedCSS.css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // WCAG accessibility analysis for the preview
  const accessibility = useMemo<AccessibilityInfo | undefined>(() => {
    const result = parseAndValidateCSS(mode, generatedCSS.css, currentSettings);
    return result.accessibility;
  }, [mode, generatedCSS.css, currentSettings]);

  const isNeu = mode === 'neumorphism';
  const isGlow = mode === 'glow';

  const bgClass = isNeu ? '' : isGlow
    ? 'bg-[hsl(240,10%,8%)]'
    : 'bg-gradient-to-br from-purple-600/40 via-blue-500/30 to-pink-500/30';

  const bgStyle = isNeu ? { background: (previewStyle as Record<string, string>).background || '#e0e5ec' } : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Tabs + Toolbar */}
      <div className="flex items-center justify-between mb-3 md:mb-4 gap-2">
        <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
          {(['preview', 'code', 'editor'] as const).map(tab => (
            <button key={tab} onClick={() => setPreviewTab(tab)}
              className={`rounded-md px-3 md:px-4 py-1.5 text-xs font-medium capitalize transition-colors min-h-[44px] md:min-h-0 ${
                previewTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* WCAG badge in toolbar */}
          {accessibility && previewTab === 'preview' && (
            <div className="flex items-center gap-1">
              {accessibility.passesAA ? (
                <Badge className="text-[9px] px-1.5 py-0 h-5 bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {accessibility.passesAAA ? 'AAA' : 'AA'}
                </Badge>
              ) : (
                <Badge className="text-[9px] px-1.5 py-0 h-5 bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1">
                  <ShieldX className="h-2.5 w-2.5" />
                  {accessibility.contrastRatio.toFixed(1)}:1
                </Badge>
              )}
            </div>
          )}
          <Button variant="outline" size="icon" onClick={randomize} className="h-9 w-9 md:h-8 md:w-8 border-border">
            <Shuffle className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setDarkText(!darkText)} className="h-9 w-9 md:h-8 md:w-8 border-border">
            {darkText ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={copyCSS} className="h-9 md:h-8 border-border text-xs">
            {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy CSS'}</span>
            <span className="sm:hidden">{copied ? '✓' : ''}</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 rounded-xl border border-border overflow-hidden">
        {previewTab === 'preview' ? (
          <div className={`relative h-full min-h-[400px] flex items-center justify-center p-8 ${bgClass}`}
            style={bgStyle}
          >
            {/* Decorative bg blobs */}
            {!isNeu && !isGlow && (
              <>
                <div className="absolute top-10 left-10 h-32 w-32 rounded-full bg-purple-500/40 blur-3xl" />
                <div className="absolute bottom-10 right-10 h-40 w-40 rounded-full bg-blue-500/30 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-400/30 blur-2xl" />
              </>
            )}

            {/* WCAG overlay badge on preview card */}
            {accessibility && !accessibility.passesAA && (
              <div className="absolute top-3 right-3 z-20">
                <Badge className="text-[9px] px-1.5 py-0.5 bg-destructive/90 text-destructive-foreground border-destructive/50 flex items-center gap-1 shadow-lg">
                  <ShieldX className="h-3 w-3" />
                  Gyenge kontraszt ({accessibility.contrastRatio.toFixed(1)}:1)
                </Badge>
              </div>
            )}

            {/* Preview Card */}
            <div
              className="relative z-10 w-full max-w-xs p-6"
              style={previewStyle}
            >
              <div className={`space-y-4 ${darkText ? 'text-gray-900' : 'text-white'}`}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={`text-sm font-bold ${darkText ? 'bg-gray-200 text-gray-700' : 'bg-white/20 text-white'}`}>
                      AC
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-sm">Aether Component</div>
                    <div className={`text-xs ${darkText ? 'text-gray-600' : 'text-white/70'}`}>Styled with CSS Generator</div>
                  </div>
                </div>
                <p className={`text-xs leading-relaxed ${darkText ? 'text-gray-700' : 'text-white/80'}`}>
                  This card demonstrates the {mode.replace('-', ' ')} effect with your current settings. Adjust the controls to customize.
                </p>
                <button className={`w-full rounded-lg py-2 text-xs font-medium transition-colors ${
                  darkText
                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                }`}>
                  Get Started
                </button>
              </div>
            </div>

            {/* Recommended text color overlay */}
            {accessibility && (
              <div className="absolute bottom-3 left-3 z-20">
                <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border border-border">
                  <span className="text-[9px] text-muted-foreground">Ajánlott szín:</span>
                  <div
                    className="h-3 w-3 rounded-sm border border-border"
                    style={{ backgroundColor: accessibility.recommendedTextColor }}
                  />
                  <code className="text-[9px] font-mono text-muted-foreground">
                    {accessibility.recommendedTextColor}
                  </code>
                </div>
              </div>
            )}
          </div>
        ) : previewTab === 'code' ? (
          <div className="relative h-full min-h-[400px] bg-[hsl(260,20%,8%)] p-6 font-mono text-sm">
            <pre className="overflow-auto whitespace-pre-wrap text-foreground">
              <code>{highlightCSS(generatedCSS.css)}</code>
            </pre>
            <p className="mt-6 text-xs text-muted-foreground">
              💡 Tip: Copy this CSS and paste it into your project's stylesheet.
            </p>
          </div>
        ) : (
          <div className="h-full min-h-[400px] overflow-auto p-4">
            <CSSCodeEditor
              mode={mode}
              settings={currentSettings}
              onSettingsChange={onSettingsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function highlightCSS(css: string): React.ReactNode {
  const lines = css.split('\n');
  return lines.map((line, i) => {
    if (line.includes('{') || line.includes('}')) {
      return <div key={i} className="text-purple-400">{line}</div>;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const prop = line.slice(0, colonIdx);
      const val = line.slice(colonIdx);
      return (
        <div key={i}>
          <span className="text-sky-400">{prop}</span>
          <span className="text-foreground">{val}</span>
        </div>
      );
    }
    return <div key={i}>{line}</div>;
  });
}
