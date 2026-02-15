/**
 * PASSTHROUGH CSS UI COMPONENTS
 * 
 * React components for managing custom CSS properties
 * that are not controlled by effect sliders.
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import type { CSSParsingDiagnostic } from './use-passthrough-css-manager';

// ═══════════════════════════════════════════════════════════════════
// PASSTHROUGH PROPERTIES PANEL
// ═══════════════════════════════════════════════════════════════════

interface PassthroughPropertiesPanelProps {
  passthroughCSS: Record<string, string>;
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function PassthroughPropertiesPanel({
  passthroughCSS,
  onRemove,
  onClearAll,
  className = ''
}: PassthroughPropertiesPanelProps) {
  const entries = Object.entries(passthroughCSS);
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (entries.length === 0) {
    return null;
  }
  
  return (
    <div className={`space-y-2 p-3 border rounded-lg bg-secondary/20 ${className}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-semibold hover:text-primary transition-colors"
        >
          <ChevronDown 
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
          />
          Custom CSS Properties
        </button>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {entries.length} applied
          </Badge>
          {onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={onClearAll}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {entries.map(([key, value]) => (
              <PassthroughPropertyItem
                key={key}
                propertyKey={key}
                value={value}
                onRemove={() => onRemove(key)}
              />
            ))}
          </div>
          
          <p className="text-[9px] text-muted-foreground leading-relaxed pt-2 border-t">
            💡 These properties are applied directly to the preview without affecting 
            effect sliders. They override effect settings if there's a conflict.
          </p>
        </>
      )}
    </div>
  );
}

interface PassthroughPropertyItemProps {
  propertyKey: string;
  value: string;
  onRemove: () => void;
}

function PassthroughPropertyItem({
  propertyKey,
  value,
  onRemove
}: PassthroughPropertyItemProps) {
  const [showFull, setShowFull] = useState(false);
  const isTruncated = value.length > 50;
  const displayValue = showFull || !isTruncated ? value : value.slice(0, 50) + '...';
  
  return (
    <div className="flex items-start gap-2 p-2 rounded bg-background/50 hover:bg-background transition-colors group">
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <code className="text-[11px] font-mono text-primary font-medium">
            {propertyKey}
          </code>
          <span className="text-[11px] text-muted-foreground">:</span>
        </div>
        <div className="flex items-start gap-1">
          <code className="text-[10px] font-mono text-muted-foreground break-all">
            {displayValue}
          </code>
          {isTruncated && (
            <button
              onClick={() => setShowFull(!showFull)}
              className="text-[9px] text-primary hover:underline flex-shrink-0"
            >
              {showFull ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
        title={`Remove ${propertyKey}`}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CSS DIAGNOSTICS PANEL
// ═══════════════════════════════════════════════════════════════════

interface CSSDiagnosticsPanelProps {
  diagnostics: CSSParsingDiagnostic[];
  className?: string;
}

export function CSSDiagnosticsPanel({
  diagnostics,
  className = ''
}: CSSDiagnosticsPanelProps) {
  const grouped = useMemo(() => {
    const errors = diagnostics.filter(d => d.type === 'error');
    const warnings = diagnostics.filter(d => d.type === 'warning');
    const infos = diagnostics.filter(d => d.type === 'info');
    return { errors, warnings, infos };
  }, [diagnostics]);
  
  if (diagnostics.length === 0) {
    return null;
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-xs font-medium">
        <span>Diagnostics</span>
        <Badge variant="secondary" className="text-[9px]">
          {diagnostics.length} items
        </Badge>
      </div>
      
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
          <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
            <Info className="w-3.5 h-3.5" />
            <span>{grouped.infos.length} properties processed</span>
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-2 space-y-1 pl-5">
            {grouped.infos.map((diag, i) => (
              <div key={i} className="text-[10px] text-muted-foreground">
                <code className="text-primary font-medium">{diag.property}</code>
                {': '}
                {diag.message}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

interface DiagnosticSectionProps {
  type: 'error' | 'warning';
  title: string;
  items: CSSParsingDiagnostic[];
}

function DiagnosticSection({ type, title, items }: DiagnosticSectionProps) {
  const Icon = type === 'error' ? AlertCircle : AlertTriangle;
  const bgClass = type === 'error' ? 'bg-destructive/5' : 'bg-yellow-500/5';
  const textClass = type === 'error' ? 'text-destructive' : 'text-yellow-600';
  const borderClass = type === 'error' ? 'border-destructive/20' : 'border-yellow-500/20';
  
  return (
    <div className={`space-y-1.5 p-2.5 border rounded ${bgClass} ${borderClass}`}>
      <div className={`flex items-center gap-2 text-xs font-medium ${textClass}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{title}</span>
        <Badge variant="secondary" className="text-[9px]">
          {items.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {items.map((diag, i) => (
          <div key={i} className="text-[10px] pl-5">
            <code className="text-primary font-medium">{diag.property}</code>
            {diag.value && (
              <span className="text-muted-foreground">
                {': '}
                <code>{diag.value}</code>
              </span>
            )}
            <div className="text-muted-foreground mt-0.5">
              → {diag.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ENHANCED CSS EDITOR
// ═══════════════════════════════════════════════════════════════════

interface EnhancedCSSEditorProps {
  cssText: string;
  onCssChange: (css: string) => void;
  onApply: () => void;
  diagnostics?: CSSParsingDiagnostic[];
  isApplying?: boolean;
  className?: string;
}

export function EnhancedCSSEditor({
  cssText,
  onCssChange,
  onApply,
  diagnostics = [],
  isApplying = false,
  className = ''
}: EnhancedCSSEditorProps) {
  const [localCss, setLocalCss] = useState(cssText);
  const hasChanges = localCss !== cssText;
  
  const handleApply = () => {
    onCssChange(localCss);
    onApply();
  };
  
  const errorCount = diagnostics.filter(d => d.type === 'error').length;
  const warningCount = diagnostics.filter(d => d.type === 'warning').length;
  
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Custom CSS</Label>
          {hasChanges && (
            <Badge variant="secondary" className="text-[9px]">
              Unsaved changes
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <Badge variant="destructive" className="text-[9px]">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="text-[9px] bg-yellow-500/10 text-yellow-600">
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!hasChanges || isApplying}
          >
            {isApplying ? 'Applying...' : 'Apply CSS'}
          </Button>
        </div>
      </div>
      
      <Textarea
        value={localCss}
        onChange={(e) => setLocalCss(e.target.value)}
        className="font-mono text-xs h-[250px] resize-none"
        placeholder={`/* Effect properties (controlled by sliders) */
backdrop-filter: blur(25px);
border-radius: 30px;
background: rgba(255, 255, 255, 0.1);

/* Custom properties (passthrough - not controlled) */
position: relative;
transform: scale(0.9);
color: #fff;
font-size: 2rem;
width: 100%;
display: flex;
align-items: center;
justify-content: center;`}
      />
      
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p>
            <strong className="text-foreground">Effect properties</strong> will update sliders.
          </p>
          <p>
            <strong className="text-foreground">Custom properties</strong> will be applied 
            directly to preview without affecting sliders.
          </p>
        </div>
      </div>
      
      {/* Diagnostics */}
      {diagnostics.length > 0 && (
        <CSSDiagnosticsPanel diagnostics={diagnostics} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPLETE ADMIN INTEGRATION EXAMPLE
// ═══════════════════════════════════════════════════════════════════

interface AdminCSSEditorSectionProps {
  presetId: string;
  passthroughCSS: Record<string, string>;
  onApplyCSS: (css: string) => CSSParsingDiagnostic[];
  onRemovePassthrough: (key: string) => void;
  onClearAllPassthrough: () => void;
}

export function AdminCSSEditorSection({
  presetId,
  passthroughCSS,
  onApplyCSS,
  onRemovePassthrough,
  onClearAllPassthrough
}: AdminCSSEditorSectionProps) {
  const [cssText, setCssText] = useState('');
  const [diagnostics, setDiagnostics] = useState<CSSParsingDiagnostic[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  
  const handleApply = async () => {
    setIsApplying(true);
    const diag = onApplyCSS(cssText);
    setDiagnostics(diag);
    
    // Simulate async if needed
    await new Promise(resolve => setTimeout(resolve, 100));
    setIsApplying(false);
  };
  
  return (
    <div className="space-y-4">
      {/* CSS Editor */}
      <EnhancedCSSEditor
        cssText={cssText}
        onCssChange={setCssText}
        onApply={handleApply}
        diagnostics={diagnostics}
        isApplying={isApplying}
      />
      
      {/* Passthrough Properties Panel */}
      <PassthroughPropertiesPanel
        passthroughCSS={passthroughCSS}
        onRemove={onRemovePassthrough}
        onClearAll={onClearAllPassthrough}
      />
    </div>
  );
}
