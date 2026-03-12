/**
 * PreviewStatusBanner.tsx — Shows CSS validity status in the preview area
 */

import { AlertTriangle, CheckCircle2, XCircle, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CSSValidityStatus } from '@/types/css-diagnostics';
import type { AccessibilityInfo } from '@/components/css-utils';

interface PreviewStatusBannerProps {
  validity: CSSValidityStatus;
  message: string;
  accessibility?: AccessibilityInfo;
  showLastStable: boolean;
}

const STATUS_CONFIG: Record<CSSValidityStatus, {
  icon: typeof CheckCircle2;
  label: string;
  badgeClass: string;
  bannerClass: string;
}> = {
  valid: {
    icon: CheckCircle2,
    label: 'Érvényes',
    badgeClass: 'bg-green-500/20 text-green-400 border-green-500/30',
    bannerClass: 'border-green-500/20 bg-green-500/5',
  },
  partial: {
    icon: AlertTriangle,
    label: 'Részlegesen érvényes',
    badgeClass: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
    bannerClass: 'border-amber-500/20 bg-amber-500/5',
  },
  invalid: {
    icon: XCircle,
    label: 'Érvénytelen',
    badgeClass: 'bg-destructive/20 text-destructive border-destructive/30',
    bannerClass: 'border-destructive/20 bg-destructive/5',
  },
};

export function PreviewStatusBanner({
  validity,
  message,
  accessibility,
  showLastStable,
}: PreviewStatusBannerProps) {
  const config = STATUS_CONFIG[validity];
  const Icon = config.icon;

  return (
    <div className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${config.bannerClass}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${config.badgeClass}`}>
          {config.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground truncate">{message}</span>
        {showLastStable && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-secondary/50 text-muted-foreground border-border shrink-0">
            Utolsó stabil előnézet
          </Badge>
        )}
      </div>

      {accessibility && (
        <div className="flex items-center gap-1.5 shrink-0">
          {accessibility.passesAA ? (
            <ShieldCheck className="h-3 w-3 text-green-500" />
          ) : (
            <ShieldX className="h-3 w-3 text-destructive" />
          )}
          <span className="text-[9px] font-mono text-muted-foreground">
            {accessibility.contrastRatio.toFixed(1)}:1
          </span>
        </div>
      )}
    </div>
  );
}
