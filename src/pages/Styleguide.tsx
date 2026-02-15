import { useState, type CSSProperties } from 'react';
import { Header } from '@/components/Header';
import { ControlsPanel } from '@/components/ControlsPanel';
import { MobileControlsDrawer } from '@/components/MobileControlsDrawer';
import { useCssGenerator } from '@/hooks/use-css-generator';
import { Button } from '@/components/ui/button';
import { Copy, Check, Bell, Heart, Star, User, Search, Send, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/* ─────────────────── helpers ─────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground/60 mb-3">
      {children}
    </h3>
  );
}

/* ─────────────────── component ─────────────────── */

const Styleguide = () => {
  const gen = useCssGenerator();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const isNeu = gen.mode === 'neumorphism';
  const isGlow = gen.mode === 'glow';
  const neuBg = isNeu ? (gen.previewStyle as Record<string, string>).background || '#e0e5ec' : undefined;
  const textColor = isNeu ? 'text-gray-700' : 'text-white';
  const mutedTextColor = isNeu ? 'text-gray-500' : 'text-white/60';

  const style = gen.previewStyle;

  const copyAll = async () => {
    const allCSS = generateStyleguideCSS(gen.generatedCSS.css, gen.mode);
    try {
      await navigator.clipboard.writeText(allCSS);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Styleguide CSS copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Could not write to clipboard.', variant: 'destructive' });
    }
  };

  const controlsProps = {
    mode: gen.mode,
    setMode: gen.setMode,
    showAdvanced: gen.showAdvanced,
    setShowAdvanced: gen.setShowAdvanced,
    settings: gen.currentSettings,
    updateSetting: gen.updateSetting,
    reset: gen.reset,
    applyPreset: gen.applyPreset,
  };

  const bgClassName = isNeu ? '' : isGlow ? 'bg-[hsl(240,10%,8%)]' : 'bg-gradient-to-br from-purple-600/40 via-blue-500/30 to-pink-500/30';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 gap-6 p-4 md:p-6">
        {/* Controls sidebar — desktop only */}
        <aside className="hidden md:block w-80 shrink-0 rounded-xl border border-border bg-card p-5">
          <ControlsPanel {...controlsProps} />
        </aside>

        {/* Main content */}
        <section className="flex-1 rounded-xl border border-border bg-card p-4 md:p-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
              {(['preview', 'code'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setViewMode(t)}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                    viewMode === t
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={copyAll} className="h-8 border-border text-xs">
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy All CSS'}
            </Button>
          </div>

          {viewMode === 'preview' ? (
            <div
              className={`rounded-xl p-6 md:p-8 min-h-[600px] space-y-10 ${bgClassName}`}
              style={isNeu ? { background: neuBg } : undefined}
            >
              {/* ─── Buttons ─── */}
              <div className="space-y-3">
                <SectionLabel>Buttons</SectionLabel>
                <div className="flex flex-wrap gap-3">
                  {['Primary', 'Secondary', 'Outline'].map(label => (
                    <button
                      key={label}
                      className={`px-5 py-2.5 text-sm font-medium ${textColor} transition-transform hover:scale-105 active:scale-95`}
                      style={style}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    className={`p-2.5 ${textColor} transition-transform hover:scale-105`}
                    style={style}
                  >
                    <Heart className="h-4 w-4" />
                  </button>
                  <button
                    className={`p-2.5 ${textColor} transition-transform hover:scale-105`}
                    style={style}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                </div>
                {/* Button sizes */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button className={`px-3 py-1.5 text-xs font-medium ${textColor}`} style={style}>Small</button>
                  <button className={`px-5 py-2.5 text-sm font-medium ${textColor}`} style={style}>Medium</button>
                  <button className={`px-7 py-3 text-base font-medium ${textColor}`} style={style}>Large</button>
                </div>
              </div>

              {/* ─── Inputs ─── */}
              <div className="space-y-3">
                <SectionLabel>Form Inputs</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                  <div className="space-y-1.5">
                    <label className={`text-xs font-medium ${mutedTextColor}`}>Text Input</label>
                    <input
                      placeholder="Enter text..."
                      className={`w-full px-4 py-2.5 text-sm ${textColor} placeholder:${mutedTextColor} outline-none`}
                      style={style}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-xs font-medium ${mutedTextColor}`}>Search</label>
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${mutedTextColor}`} />
                      <input
                        placeholder="Search..."
                        className={`w-full pl-9 pr-4 py-2.5 text-sm ${textColor} placeholder:${mutedTextColor} outline-none`}
                        style={style}
                      />
                    </div>
                  </div>
                </div>
                <div className="max-w-xl">
                  <label className={`text-xs font-medium ${mutedTextColor}`}>Textarea</label>
                  <textarea
                    placeholder="Write something..."
                    rows={3}
                    className={`w-full mt-1.5 px-4 py-2.5 text-sm ${textColor} placeholder:${mutedTextColor} outline-none resize-none`}
                    style={style}
                  />
                </div>
              </div>

              {/* ─── Cards ─── */}
              <div className="space-y-3">
                <SectionLabel>Cards</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Simple card */}
                  <div className="p-5 space-y-2" style={style}>
                    <h4 className={`font-semibold text-sm ${textColor}`}>Feature Card</h4>
                    <p className={`text-xs leading-relaxed ${mutedTextColor}`}>
                      A compact card showcasing the current effect with clean typography.
                    </p>
                    <button className={`text-xs font-medium ${textColor} mt-2 flex items-center gap-1`}>
                      Learn more <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Profile card */}
                  <div className="p-5 flex items-center gap-3" style={style}>
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isNeu ? 'bg-gray-300' : 'bg-white/10'}`}
                    >
                      <User className={`h-5 w-5 ${textColor}`} />
                    </div>
                    <div>
                      <h4 className={`font-semibold text-sm ${textColor}`}>Jane Doe</h4>
                      <p className={`text-xs ${mutedTextColor}`}>Product Designer</p>
                    </div>
                  </div>

                  {/* Stat card */}
                  <div className="p-5 space-y-1" style={style}>
                    <p className={`text-xs ${mutedTextColor}`}>Total Views</p>
                    <p className={`text-2xl font-bold ${textColor}`}>24.5K</p>
                    <p className={`text-[10px] ${isNeu ? 'text-green-600' : 'text-green-400'}`}>↑ 12% from last week</p>
                  </div>
                </div>
              </div>

              {/* ─── Badges / Chips ─── */}
              <div className="space-y-3">
                <SectionLabel>Badges &amp; Chips</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {['Active', 'Pending', 'Closed', 'Draft', 'Featured'].map(label => (
                    <span key={label} className={`px-3 py-1 text-xs font-medium ${textColor} rounded-full`} style={style}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ─── Notification / Alert ─── */}
              <div className="space-y-3">
                <SectionLabel>Notifications</SectionLabel>
                <div className="max-w-md space-y-3">
                  <div className="p-4 flex items-start gap-3" style={style}>
                    <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${textColor}`} />
                    <div>
                      <p className={`text-sm font-medium ${textColor}`}>New update available</p>
                      <p className={`text-xs ${mutedTextColor}`}>Version 2.1 is ready to install with new features.</p>
                    </div>
                  </div>
                  <div className="p-4 flex items-center gap-3" style={style}>
                    <Send className={`h-4 w-4 shrink-0 ${textColor}`} />
                    <p className={`text-sm ${textColor}`}>Your message has been sent successfully.</p>
                  </div>
                </div>
              </div>

              {/* ─── Toggle / Pill Nav ─── */}
              <div className="space-y-3">
                <SectionLabel>Navigation Pills</SectionLabel>
                <div className="flex gap-2">
                  {['Overview', 'Analytics', 'Settings'].map((label, i) => (
                    <button
                      key={label}
                      className={`px-4 py-2 text-xs font-medium ${textColor} ${i === 0 ? 'opacity-100' : 'opacity-60'}`}
                      style={style}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ─── List / Table Row ─── */}
              <div className="space-y-3">
                <SectionLabel>List Items</SectionLabel>
                <div className="max-w-lg space-y-2">
                  {['Dashboard', 'Transactions', 'Reports'].map(label => (
                    <div
                      key={label}
                      className={`p-3 flex items-center justify-between ${textColor} cursor-pointer transition-transform hover:scale-[1.01]`}
                      style={style}
                    >
                      <span className="text-sm font-medium">{label}</span>
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ─── Code View ─── */
            <div className="rounded-xl bg-background p-6 font-mono text-sm min-h-[600px] overflow-auto">
              <pre className="text-foreground whitespace-pre-wrap">
                {generateStyleguideCSS(gen.generatedCSS.css, gen.mode)}
              </pre>
            </div>
          )}

          <p className="mt-4 text-[10px] text-muted-foreground text-center">
            Tip: Adjust the controls on the left to see the effect applied to every element in real-time.
          </p>
        </section>
      </main>

      {/* Mobile drawer */}
      <MobileControlsDrawer {...controlsProps} />
    </div>
  );
};

/* ─────────────────── CSS generation for styleguide ─────────────────── */

function generateStyleguideCSS(baseCss: string, mode: string): string {
  const className = mode === 'liquid-glass' ? 'liquid-glass' : mode === 'glassmorphism' ? 'glassmorphism' : 'neumorphism';
  // Extract only the property lines
  const propLines = baseCss
    .split('\n')
    .filter(l => l.trim().startsWith('background') || l.trim().startsWith('backdrop') || l.trim().startsWith('-webkit')
      || l.trim().startsWith('border') || l.trim().startsWith('box-shadow'));
  const props = propLines.join('\n');

  return `/* ─── Base Effect ─── */
${baseCss}

/* ─── Buttons ─── */
.${className}-btn {
${props}
  padding: 10px 20px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.${className}-btn:hover {
  transform: scale(1.05);
}
.${className}-btn:active {
  transform: scale(0.95);
}

/* ─── Icon Button ─── */
.${className}-icon-btn {
${props}
  padding: 10px;
  cursor: pointer;
}

/* ─── Input ─── */
.${className}-input {
${props}
  padding: 10px 16px;
  outline: none;
  width: 100%;
}

/* ─── Textarea ─── */
.${className}-textarea {
${props}
  padding: 10px 16px;
  outline: none;
  resize: none;
  width: 100%;
}

/* ─── Card ─── */
.${className}-card {
${props}
  padding: 20px;
}

/* ─── Badge ─── */
.${className}-badge {
${props}
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 9999px;
}

/* ─── Notification ─── */
.${className}-notification {
${props}
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* ─── Nav Pill ─── */
.${className}-pill {
${props}
  padding: 8px 16px;
  font-size: 12px;
  cursor: pointer;
}

/* ─── List Item ─── */
.${className}-list-item {
${props}
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
`;
}

export default Styleguide;
