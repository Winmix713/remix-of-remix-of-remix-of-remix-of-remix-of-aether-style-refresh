import { Header } from '@/components/Header';
import { ControlsPanel } from '@/components/ControlsPanel';
import { useCssGenerator } from '@/hooks/use-css-generator';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

const sampleData = [
  { name: 'Alice Johnson', role: 'Designer', status: 'Active', revenue: '$12,400' },
  { name: 'Bob Smith', role: 'Developer', status: 'Active', revenue: '$18,200' },
  { name: 'Carol White', role: 'Manager', status: 'On Leave', revenue: '$15,800' },
  { name: 'David Brown', role: 'Analyst', status: 'Active', revenue: '$11,600' },
  { name: 'Eva Martinez', role: 'Developer', status: 'Inactive', revenue: '$9,300' },
];

const Tables = () => {
  const gen = useCssGenerator();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  const copyAll = () => {
    navigator.clipboard.writeText(gen.generatedCSS.css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNeu = gen.mode === 'neumorphism';
  const neuBg = isNeu ? (gen.previewStyle as any).background || '#e0e5ec' : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 gap-6 p-6">
        <aside className="w-80 shrink-0 rounded-xl border border-border bg-card p-5">
          <ControlsPanel mode={gen.mode} setMode={gen.setMode} showAdvanced={gen.showAdvanced}
            setShowAdvanced={gen.setShowAdvanced} settings={gen.currentSettings}
            updateSetting={gen.updateSetting} reset={gen.reset} applyPreset={gen.applyPreset} />
        </aside>

        <section className="flex-1 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
              {(['preview', 'code'] as const).map(t => (
                <button key={t} onClick={() => setViewMode(t)}
                  className={`rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                    viewMode === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>{t}</button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={copyAll} className="h-8 border-border text-xs">
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy CSS'}
            </Button>
          </div>

          {viewMode === 'preview' ? (
            <div className={`rounded-xl p-8 min-h-[500px] ${isNeu ? '' : 'bg-gradient-to-br from-purple-600/40 via-blue-500/30 to-pink-500/30'}`}
              style={isNeu ? { background: neuBg } : undefined}>
              <div className="overflow-hidden" style={gen.previewStyle}>
                <table className="w-full text-sm text-white">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['Name', 'Role', 'Status', 'Revenue'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleData.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-white/70">{row.role}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            row.status === 'Active' ? 'bg-green-500/20 text-green-300' :
                            row.status === 'On Leave' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-red-500/20 text-red-300'
                          }`}>{row.status}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-white/80">{row.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[hsl(260,20%,8%)] p-6 font-mono text-sm min-h-[500px]">
              <pre className="text-foreground whitespace-pre-wrap">{gen.generatedCSS.css}</pre>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Tables;
