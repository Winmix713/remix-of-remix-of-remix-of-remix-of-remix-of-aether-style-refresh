import { Badge } from '@/components/ui/badge';
import { Droplets } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Cards', path: '/' },
  { label: 'Styleguide', path: '/styleguide', badge: 'BETA' },
  { label: 'Tables', path: '/tables', badge: 'NEW' },
  { label: 'Admin', path: '/admin', badge: '⚙️' },
];

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 md:px-6 py-3">
        <div className="flex items-center gap-2 md:gap-3">
          <Droplets className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          <span className="text-lg md:text-xl font-bold tracking-tight text-foreground">Aether CSS</span>
          <Badge variant="outline" className="border-border text-muted-foreground text-[10px] px-1.5 py-0 hidden sm:inline-flex">
            v2.0
          </Badge>
        </div>

        <nav className="flex items-center gap-0.5 md:gap-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`relative rounded-lg px-2.5 md:px-4 py-2 text-xs md:text-sm font-medium transition-colors ${
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {item.label}
                {item.badge && (
                  <span className={`ml-1 md:ml-1.5 rounded px-1 py-0.5 text-[8px] md:text-[9px] font-bold ${
                    item.badge === 'NEW' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 pb-2 md:pb-3">
        <p className="text-[10px] md:text-xs text-muted-foreground">
          Free Liquid Glass, Glassmorphism & Neumorphism CSS Generator with live preview
        </p>
      </div>
    </header>
  );
}
