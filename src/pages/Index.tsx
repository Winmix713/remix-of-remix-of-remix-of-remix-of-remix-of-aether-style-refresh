import { Header } from '@/components/Header';
import { ControlsPanel } from '@/components/ControlsPanel';
import { PreviewPanel } from '@/components/PreviewPanel';
import { MobileControlsDrawer } from '@/components/MobileControlsDrawer';
import { useCssGenerator } from '@/hooks/use-css-generator';

const Index = () => {
  const gen = useCssGenerator();

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 gap-6 p-4 md:p-6">
        {/* Controls - hidden on mobile, shown via drawer */}
        <aside className="hidden md:block w-80 shrink-0 rounded-xl border border-border bg-card p-5">
          <ControlsPanel {...controlsProps} />
        </aside>

        {/* Preview - full width on mobile */}
        <section className="flex-1 rounded-xl border border-border bg-card p-4 md:p-5">
          <PreviewPanel
            mode={gen.mode}
            previewStyle={gen.previewStyle}
            generatedCSS={gen.generatedCSS}
            darkText={gen.darkText}
            setDarkText={gen.setDarkText}
            randomize={gen.randomize}
            previewTab={gen.previewTab}
            setPreviewTab={gen.setPreviewTab}
            currentSettings={gen.currentSettings}
            onSettingsChange={gen.applySettings}
          />
        </section>
      </main>

      {/* Mobile floating drawer */}
      <MobileControlsDrawer {...controlsProps} />
    </div>
  );
};

export default Index;
