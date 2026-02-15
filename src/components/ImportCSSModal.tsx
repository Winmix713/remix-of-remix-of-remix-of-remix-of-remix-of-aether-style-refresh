/**
 * ImportCSSModal.tsx
 * 
 * Modal for importing CSS codes with automatic passthrough property detection.
 * Converts "ignored properties" to passthrough CSS that gets applied to preview.
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle2, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  parseCustomCSSWithPassthrough,
  type CSSParsingDiagnostic,
} from '@/hooks/use-passthrough-css-manager';
import type { EffectMode } from '@/types/css-generator';

interface ImportCSSModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: EffectMode;
  onImport: (
    effectOverrides: Record<string, number | string>,
    passthroughCSS: Record<string, string>
  ) => void;
}

export function ImportCSSModal({
  isOpen,
  onClose,
  mode,
  onImport,
}: ImportCSSModalProps) {
  const [importedCSS, setImportedCSS] = useState('');
  const [activeTab, setActiveTab] = useState<'paste' | 'preview'>('paste');

  const parseResult = useMemo(() => {
    if (!importedCSS.trim()) {
      return {
        effectOverrides: {},
        passthroughProperties: {},
        diagnostics: [] as CSSParsingDiagnostic[],
        totalProperties: 0,
      };
    }

    const result = parseCustomCSSWithPassthrough(importedCSS, mode);
    return {
      ...result,
      totalProperties:
        Object.keys(result.effectOverrides).length +
        Object.keys(result.passthroughProperties).length,
    };
  }, [importedCSS, mode]);

  const effectCount = Object.keys(parseResult.effectOverrides).length;
  const passthroughCount = Object.keys(parseResult.passthroughProperties).length;
  const errorCount = parseResult.diagnostics.filter(
    (d) => d.type === 'error'
  ).length;

  const handleImport = () => {
    if (!parseResult.totalProperties) {
      toast.error('Nincs CSS property az importáláshoz');
      return;
    }

    onImport(parseResult.effectOverrides, parseResult.passthroughProperties);

    // Show summary
    const messages: string[] = [];
    if (effectCount > 0) {
      messages.push(
        `${effectCount} effect property (slider módosítás)`
      );
    }
    if (passthroughCount > 0) {
      messages.push(
        `${passthroughCount} passthrough property (direct alkalmazás)`
      );
    }

    toast.success(
      `CSS importálva: ${messages.join(', ')}`
    );

    setImportedCSS('');
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setImportedCSS(text);
      setActiveTab('preview');
      toast.success('CSS beillesztve');
    } catch {
      toast.error('Nem sikerült a vágólapból beilleszteni');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">CSS importálása</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Másold be a CSS kódot, és az "ignored properties" automatikusan passthrough-ként kerülnek alkalmazásra.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste">
              CSS beillesztése
            </TabsTrigger>
            <TabsTrigger value="preview">
              Előnézet
              {parseResult.totalProperties > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-primary/20 rounded">
                  {parseResult.totalProperties}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Paste Tab */}
          <TabsContent value="paste" className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                CSS kód
              </label>
              <Textarea
                value={importedCSS}
                onChange={(e) => setImportedCSS(e.target.value)}
                placeholder={`/* Bemásolt CSS például: */
backdrop-filter: blur(30px);
border-radius: 40px);
position: relative;
transform: scale(0.95);
color: #ffffff;`}
                className="font-mono text-xs h-[300px] resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handlePaste}
                variant="outline"
                className="border-border text-muted-foreground flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Vágólapból beillesztés
              </Button>
              <Button
                onClick={() => setImportedCSS('')}
                variant="ghost"
                className="text-muted-foreground flex-1"
              >
                Törlés
              </Button>
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            {parseResult.totalProperties === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">Nincs elemzendő CSS — másold be a kódot az első lapon</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      Effect Properties
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {effectCount}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-1">
                      Slider módosítás
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      Passthrough Properties
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {passthroughCount}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-1">
                      Direct alkalmazás
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="text-[10px] text-muted-foreground mb-1">
                      Hibák
                    </div>
                    <div className={`text-2xl font-bold ${errorCount > 0 ? 'text-destructive' : 'text-green-500'}`}>
                      {errorCount}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-1">
                      {errorCount > 0 ? 'Javításra vár' : 'OK'}
                    </div>
                  </div>
                </div>

                {/* Effect Properties List */}
                {effectCount > 0 && (
                  <div className="space-y-2 p-3 border border-border rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <h4 className="text-sm font-medium text-foreground">
                        Effect Properties
                      </h4>
                      <Badge variant="secondary" className="text-[9px]">
                        {effectCount}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(parseResult.effectOverrides).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between p-2 bg-background/50 rounded text-sm"
                          >
                            <code className="font-mono text-xs text-primary">
                              {key}
                            </code>
                            <code className="font-mono text-xs text-muted-foreground">
                              {String(value)}
                            </code>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Passthrough Properties List */}
                {passthroughCount > 0 && (
                  <div className="space-y-2 p-3 border border-border rounded-lg bg-amber-500/5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <h4 className="text-sm font-medium text-foreground">
                        Passthrough Properties
                      </h4>
                      <Badge
                        variant="secondary"
                        className="text-[9px] bg-amber-500/20 text-amber-600 border-amber-500/30"
                      >
                        {passthroughCount}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Ezek a property-k közvetlenül kerülnek alkalmazásra, slider módosítás nélkül.
                    </p>
                    <div className="space-y-1">
                      {Object.entries(parseResult.passthroughProperties).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex items-start gap-2 p-2 bg-background/50 rounded"
                          >
                            <code className="font-mono text-xs text-primary flex-shrink-0">
                              {key}
                            </code>
                            <span className="text-[10px] text-muted-foreground break-all">
                              {value}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Diagnostics */}
                {parseResult.diagnostics.length > 0 && (
                  <div className="space-y-2 p-3 border border-border rounded-lg bg-destructive/5">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <h4 className="text-sm font-medium text-foreground">
                        Diagnosztika
                      </h4>
                      <Badge variant="destructive" className="text-[9px]">
                        {parseResult.diagnostics.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {parseResult.diagnostics.map((diag, i) => (
                        <div key={i} className="text-[10px] text-muted-foreground pl-6">
                          <span className="text-destructive font-medium">
                            {diag.type === 'error' ? '✗' : '⚠'}
                          </span>{' '}
                          <code className="text-primary">{diag.property}</code>
                          {': '}
                          {diag.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-muted-foreground"
          >
            Mégse
          </Button>
          <Button
            onClick={handleImport}
            disabled={parseResult.totalProperties === 0}
            className="bg-primary text-primary-foreground"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importálás ({parseResult.totalProperties})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
