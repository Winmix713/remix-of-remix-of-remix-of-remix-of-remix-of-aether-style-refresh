/**
 * CSSCodeEditor.tsx — Enhanced CSS Editor Component
 *
 * Features:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  LineEditor       Line-numbered textarea with scroll-synced    │
 * │                   error/warning gutter (dot indicators)        │
 * │  DiagnosticsPanel Categorised error/warning/info messages      │
 * │  GhostPanel       Properties that the current mode ignores     │
 * │  AccessibilityCard WCAG contrast ratio + recommended text color│
 * │  CSSCodeEditor    Main orchestrator; wired to parseAndValidate  │
 * └─────────────────────────────────────────────────────────────────┘
 */

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RotateCcw, Copy, Code, AlertTriangle, Info, CheckCircle2,
  Eye, EyeOff, ChevronDown, ChevronUp, ShieldCheck, ShieldX,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  parseAndValidateCSS,
  PROPERTIES_BY_MODE,
  type Diagnostic,
  type GhostProperty,
  type AccessibilityInfo,
} from './css-utils';
import { normalizeStyleProperties } from '@/hooks/use-css-normalization';
import {
  generateLiquidGlassCSS,
  generateGlassmorphismCSS,
  generateNeumorphismCSS,
  generateGlowCSS,
} from '@/hooks/use-css-generator';
import type {
  Preset,
  EffectMode,
  LiquidGlassSettings,
  GlassmorphismSettings,
  NeumorphismSettings,
  GlowSettings,
} from '@/types/css-generator';

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

function generateCSSForPreset(mode: EffectMode, settings: Preset['settings']): string {
  if (mode === 'liquid-glass')
    return generateLiquidGlassCSS(settings as LiquidGlassSettings).css;
  if (mode === 'glassmorphism')
    return generateGlassmorphismCSS(settings as GlassmorphismSettings).css;
  if (mode === 'glow')
    return generateGlowCSS(settings as GlowSettings).css;
  return generateNeumorphismCSS(settings as NeumorphismSettings).css;
}

function settingsToPreviewStyle(
  mode: EffectMode,
  settings: Preset['settings'],
): CSSProperties {
  try {
    let gen: { properties: Record<string, string | undefined>; css: string };
    if (mode === 'liquid-glass')       gen = generateLiquidGlassCSS(settings as LiquidGlassSettings);
    else if (mode === 'glassmorphism') gen = generateGlassmorphismCSS(settings as GlassmorphismSettings);
    else if (mode === 'glow')          gen = generateGlowCSS(settings as GlowSettings);
    else                               gen = generateNeumorphismCSS(settings as NeumorphismSettings);

    const allProps: Record<string, string> = {};

    for (const [key, val] of Object.entries(gen.properties)) {
      if (!val) continue;
      const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      allProps[camel] = val;
    }

    if (mode === 'neumorphism') {
      const bgM = gen.css.match(/background:\s*(linear-gradient[^;]+);/);
      if (bgM) {
        allProps.background = bgM[1];
      }
    }

    // Normalize to avoid shorthand/non-shorthand conflicts
    return normalizeStyleProperties(allProps);
  } catch {
    return {};
  }
}

// ══════════════════════════════════════════════════════════════════
// Sub-component: Severity icon
// ══════════════════════════════════════════════════════════════════

function SeverityIcon({ severity }: { severity: 'error' | 'warning' | 'info' }) {
  if (severity === 'error')
    return <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />;
  if (severity === 'warning')
    return <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />;
  return <Info className="h-3 w-3 text-blue-400 shrink-0" />;
}

const SEVERITY_DOT_COLOR: Record<string, string> = {
  error:   'bg-destructive',
  warning: 'bg-amber-500',
  info:    'bg-blue-400',
};

// ══════════════════════════════════════════════════════════════════
// Sub-component: LineEditor
// ══════════════════════════════════════════════════════════════════

interface LineEditorProps {
  value: string;
  onChange: (v: string) => void;
  diagnosticsByLine: Map<number, Diagnostic[]>;
  className?: string;
}

function LineEditor({ value, onChange, diagnosticsByLine, className = '' }: LineEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef   = useRef<HTMLDivElement>(null);
  const lines       = value.split('\n');

  const syncScroll = useCallback(() => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  function lineIndicatorClass(lineNum: number): string | null {
    const diags = diagnosticsByLine.get(lineNum);
    if (!diags?.length) return null;
    if (diags.some((d) => d.severity === 'error'))   return SEVERITY_DOT_COLOR.error;
    if (diags.some((d) => d.severity === 'warning'))  return SEVERITY_DOT_COLOR.warning;
    return SEVERITY_DOT_COLOR.info;
  }

  return (
    <div className={`flex rounded-md border border-border overflow-hidden ${className}`}>
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="
          select-none overflow-hidden
          bg-secondary/40 border-r border-border
          font-mono text-[10px] leading-[1.6] text-muted-foreground/50
          px-1.5 pt-[9px] pb-2 min-w-[38px]
        "
        style={{ overflowY: 'hidden' }}
      >
        {lines.map((_, i) => {
          const num        = i + 1;
          const dotClass   = lineIndicatorClass(num);
          const diags      = diagnosticsByLine.get(num);
          const tooltipMsg = diags?.map((d) => d.message).join('\n');

          return (
            <div key={i} className="flex items-center gap-1 h-[1.6em]">
              {dotClass ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 cursor-help ${dotClass}`} />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-[10px] whitespace-pre-wrap">
                      {tooltipMsg}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="w-1.5 shrink-0" />
              )}
              <span className="tabular-nums">{num}</span>
            </div>
          );
        })}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        aria-label="CSS kód szerkesztő"
        className="
          flex-1 resize-none outline-none
          bg-secondary/80 font-mono text-[11px]
          leading-[1.6] text-foreground
          px-3 pt-[9px] pb-2
          min-h-[220px]
          whitespace-pre overflow-auto
        "
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Sub-component: DiagnosticsPanel
// ══════════════════════════════════════════════════════════════════

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
}

function DiagnosticsPanel({ diagnostics }: DiagnosticsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  if (!diagnostics.length) return null;

  const errors   = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const infos    = diagnostics.filter((d) => d.severity === 'info');

  return (
    <div className="rounded-md border border-border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="
          w-full flex items-center justify-between
          px-2.5 py-1.5 text-left
          hover:bg-secondary/40 transition-colors
        "
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-foreground">Diagnosztika</span>
          {errors.length   > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
              {errors.length} hiba
            </Badge>
          )}
          {warnings.length > 0 && (
            <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-500/20 text-amber-500 border-amber-500/30">
              {warnings.length} figyelmeztetés
            </Badge>
          )}
          {infos.length    > 0 && (
            <Badge className="text-[9px] px-1 py-0 h-4 bg-blue-400/20 text-blue-400 border-blue-400/30">
              {infos.length} infó
            </Badge>
          )}
        </div>
        {collapsed
          ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
          : <ChevronUp   className="h-3 w-3 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <ul className="divide-y divide-border/50">
          {diagnostics.map((d, i) => (
            <li key={i} className="flex items-start gap-2 px-2.5 py-1.5">
              <SeverityIcon severity={d.severity} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] leading-relaxed text-foreground">{d.message}</p>
                {(d.line || d.property) && (
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono">
                    {d.line ? `Sor ${d.line}` : ''}{d.line && d.property ? ' · ' : ''}{d.property ?? ''}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Sub-component: GhostPanel
// ══════════════════════════════════════════════════════════════════

interface GhostPanelProps {
  ghostProperties: GhostProperty[];
  mode: EffectMode;
}

function GhostPanel({ ghostProperties, mode }: GhostPanelProps) {
  const [showKnown, setShowKnown] = useState(false);
  const knownProps = Object.keys(PROPERTIES_BY_MODE[mode]);

  if (!ghostProperties.length && !showKnown) {
    return (
      <button
        type="button"
        onClick={() => setShowKnown(true)}
        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        Ismert property-k megtekintése a {mode} módhoz →
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-foreground">
            Figyelmen kívül hagyott property-k
          </span>
          {ghostProperties.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">
              {ghostProperties.length}
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowKnown((v) => !v)}
          className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showKnown ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showKnown ? 'Elrejtés' : 'Ismert property-k'}
        </button>
      </div>

      {ghostProperties.length > 0 ? (
        <ul className="divide-y divide-border/50">
          {ghostProperties.map((gp, i) => (
            <li key={i} className="flex items-start gap-2 px-2.5 py-1.5">
              <span className="w-1.5 h-1.5 mt-1 rounded-full bg-muted-foreground/40 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <code className="text-[10px] font-mono text-amber-400">{gp.property}</code>
                  <span className="text-[9px] text-muted-foreground/60 truncate">{gp.value}</span>
                  {gp.line && (
                    <span className="text-[9px] text-muted-foreground/40 ml-auto shrink-0">sor {gp.line}</span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground/50 mt-0.5">{gp.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2.5 py-2 text-[10px] text-muted-foreground/50">
          Minden property felismert ebben a módban.
        </p>
      )}

      {showKnown && (
        <div className="border-t border-border/50 px-2.5 py-2 bg-secondary/20">
          <p className="text-[9px] text-muted-foreground mb-1.5">
            Ismert property-k <span className="font-medium">{mode}</span> módhoz:
          </p>
          <div className="flex flex-wrap gap-1">
            {knownProps.map((prop) => (
              <code key={prop} className="text-[9px] bg-secondary px-1 py-0.5 rounded text-muted-foreground font-mono">
                {prop}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Sub-component: AccessibilityCard
// ══════════════════════════════════════════════════════════════════

function AccessibilityCard({ info }: { info: AccessibilityInfo }) {
  const barWidth = Math.min(100, ((info.contrastRatio - 1) / 20) * 100);
  const aaThresholdPct  = ((4.5 - 1) / 20) * 100;
  const aaaThresholdPct = ((7.0 - 1) / 20) * 100;

  return (
    <div className="rounded-md border border-border bg-card/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">Kontraszt arány</span>
        <div className="flex items-center gap-1.5">
          {info.passesAAA ? (
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" /> AAA
            </Badge>
          ) : info.passesAA ? (
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-blue-400/20 text-blue-400 border-blue-400/30 flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" /> AA
            </Badge>
          ) : (
            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-destructive/20 text-destructive border-destructive/30 flex items-center gap-1">
              <ShieldX className="h-2.5 w-2.5" /> Sikertelen
            </Badge>
          )}
          <span className="text-[11px] font-mono font-bold text-foreground">
            {info.contrastRatio.toFixed(1)}:1
          </span>
        </div>
      </div>

      <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${barWidth}%`,
            background: info.passesAAA
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : info.passesAA
              ? 'linear-gradient(90deg, #60a5fa, #3b82f6)'
              : 'linear-gradient(90deg, #f87171, #ef4444)',
          }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-white/30"
          style={{ left: `${aaThresholdPct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20"
          style={{ left: `${aaaThresholdPct}%` }}
        />
      </div>

      <div className="relative text-[8px] text-muted-foreground/50 select-none">
        <span className="absolute" style={{ left: `${aaThresholdPct}%` }}>AA 4.5</span>
        <span className="absolute" style={{ left: `${aaaThresholdPct}%` }}>AAA 7.0</span>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-[9px] text-muted-foreground">Ajánlott szövegszín:</span>
        <div className="flex items-center gap-1">
          <div
            className="h-3.5 w-3.5 rounded border border-border"
            style={{ backgroundColor: info.recommendedTextColor }}
          />
          <code className="text-[9px] font-mono text-muted-foreground">
            {info.recommendedTextColor}
          </code>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground leading-relaxed">
        {info.recommendation}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Main: CSSCodeEditor
// ══════════════════════════════════════════════════════════════════

export interface CSSCodeEditorProps {
  mode: EffectMode;
  settings: Preset['settings'];
  onSettingsChange: (s: Preset['settings']) => void;
}

type EditorStatus = 'idle' | 'modified' | 'applied' | 'error';

export function CSSCodeEditor({ mode, settings, onSettingsChange }: CSSCodeEditorProps) {
  const generatedCSS = useMemo(
    () => generateCSSForPreset(mode, settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode],
  );

  const [cssText,        setCssText]        = useState(generatedCSS);
  const [lastAppliedCSS, setLastAppliedCSS] = useState(generatedCSS);
  const [status,         setStatus]         = useState<EditorStatus>('idle');
  const [showA11y,       setShowA11y]       = useState(false);

  const prevModeRef = useRef(mode);

  useEffect(() => {
    if (mode !== prevModeRef.current) {
      const fresh = generateCSSForPreset(mode, settings);
      setCssText(fresh);
      setLastAppliedCSS(fresh);
      setStatus('idle');
      prevModeRef.current = mode;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isModified = cssText !== lastAppliedCSS;

  const parseResult = useMemo(
    () => parseAndValidateCSS(mode, cssText, settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cssText, mode],
  );

  const livePreviewStyle = useMemo<CSSProperties>(() => {
    if (!parseResult.settings) return {};
    return settingsToPreviewStyle(mode, parseResult.settings);
  }, [mode, parseResult.settings]);

  const diagnosticsByLine = useMemo(() => {
    const map = new Map<number, Diagnostic[]>();
    for (const d of parseResult.diagnostics) {
      if (!d.line) continue;
      const arr = map.get(d.line) ?? [];
      arr.push(d);
      map.set(d.line, arr);
    }
    return map;
  }, [parseResult.diagnostics]);

  const handleCSSChange = (val: string) => {
    setCssText(val);
    setStatus(val === lastAppliedCSS ? 'idle' : 'modified');
  };

  const handleApply = () => {
    if (!parseResult.settings) {
      setStatus('error');
      toast.error('A CSS nem értelmezhető — ellenőrizd a hibákat');
      return;
    }
    onSettingsChange(parseResult.settings);
    setLastAppliedCSS(cssText);
    setStatus('applied');
    const clamped = parseResult.clampedFields;
    if (clamped.length) {
      toast.success(`CSS alkalmazva (${clamped.length} érték korrigálva: ${clamped.join(', ')})`);
    } else {
      toast.success('CSS sikeresen alkalmazva');
    }
  };

  const handleRegenerate = () => {
    const fresh = generateCSSForPreset(mode, settings);
    setCssText(fresh);
    setLastAppliedCSS(fresh);
    setStatus('idle');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cssText);
      toast.success('CSS másolva');
    } catch {
      toast.error('Másolás sikertelen — ellenőrizd a böngésző engedélyeket');
    }
  };

  const errorCount   = parseResult.diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = parseResult.diagnostics.filter((d) => d.severity === 'warning').length;
  const hasIssues    = errorCount + warningCount > 0;

  const statusConfig = {
    idle:     { text: '',                                                color: '' },
    modified: { text: 'Módosítva — kattints az „Alkalmaz" gombra',       color: 'text-muted-foreground' },
    applied:  { text: '✓ Beállítások frissítve',                         color: 'text-green-500' },
    error:    { text: '✗ Nem sikerült értelmezni — javítsd a hibákat',   color: 'text-destructive' },
  } as const;

  return (
    <div className="space-y-3">
      {/* Live mini preview */}
      <div className="relative rounded-lg border border-border bg-gradient-to-br from-muted/50 to-muted p-4 flex items-center justify-center min-h-[80px]">
        <div
          className="w-24 h-16 flex items-center justify-center text-[10px] text-muted-foreground font-medium transition-all duration-300"
          style={livePreviewStyle}
        >
          Előnézet
        </div>
        {parseResult.accessibility && (
          <button
            type="button"
            onClick={() => setShowA11y((v) => !v)}
            className="
              absolute top-1.5 right-2 flex items-center gap-1
              text-[9px] text-muted-foreground/60
              hover:text-muted-foreground transition-colors
            "
          >
            {parseResult.accessibility.passesAA
              ? <CheckCircle2 className="h-3 w-3 text-green-500" />
              : <AlertTriangle className="h-3 w-3 text-amber-500" />}
            {parseResult.accessibility.contrastRatio.toFixed(1)}:1
            {showA11y ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
        )}
        <span className="absolute bottom-1.5 right-2 text-[9px] text-muted-foreground/40 pointer-events-none">
          Élő előnézet
        </span>
      </div>

      {showA11y && parseResult.accessibility && (
        <AccessibilityCard info={parseResult.accessibility} />
      )}

      {/* Editor header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground font-medium">CSS kód</Label>
          {isModified && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 bg-accent/50 text-accent-foreground border-accent"
            >
              módosított
            </Badge>
          )}
          {hasIssues && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 text-amber-500 border-amber-500/40 bg-amber-500/10"
            >
              {errorCount + warningCount} figyelmeztetés
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleRegenerate}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
          >
            <RotateCcw className="h-3 w-3" /> Újragenerálás
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
          >
            <Copy className="h-3 w-3" /> Másolás
          </button>
        </div>
      </div>

      {/* Line-numbered editor */}
      <LineEditor
        value={cssText}
        onChange={handleCSSChange}
        diagnosticsByLine={diagnosticsByLine}
      />

      {/* Status message */}
      {statusConfig[status].text && (
        <p
          className={`text-[11px] font-medium ${statusConfig[status].color}`}
          role={status === 'error' ? 'alert' : undefined}
        >
          {statusConfig[status].text}
        </p>
      )}

      {/* Apply button */}
      <Button
        size="sm"
        onClick={handleApply}
        disabled={!isModified || !parseResult.settings}
        className="w-full bg-primary text-primary-foreground text-xs"
      >
        <Code className="mr-1.5 h-3.5 w-3.5" />
        {parseResult.clampedFields.length > 0
          ? `Alkalmaz (${parseResult.clampedFields.length} érték korrigálva)`
          : 'Alkalmaz'}
      </Button>

      {/* Diagnostics panel */}
      {parseResult.diagnostics.length > 0 && (
        <DiagnosticsPanel diagnostics={parseResult.diagnostics} />
      )}

      {/* Ghost properties panel */}
      <GhostPanel ghostProperties={parseResult.ghostProperties} mode={mode} />

      {/* Help text */}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Szerkeszd a CSS property-ket, majd kattints az „Alkalmaz" gombra. A motor
        automatikusan visszafejti a slider értékeket és jelzi az ismeretlen property-ket.
        Támogatott formátumok: <code className="font-mono">hex</code>,{' '}
        <code className="font-mono">rgb()</code>, <code className="font-mono">hsl()</code>,{' '}
        <code className="font-mono">oklch()</code>.
        Egységek: <code className="font-mono">px</code>, <code className="font-mono">rem</code>,{' '}
        <code className="font-mono">em</code>, <code className="font-mono">pt</code>.
      </p>
    </div>
  );
}
