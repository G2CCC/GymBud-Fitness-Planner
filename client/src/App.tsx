import { NavLink, Outlet } from "react-router-dom";
import { productName } from "@fitness/shared/brand";

export function App() {
  const navigation = [
    { label: "Today", to: "/onboarding" },
    { label: "Calendar", to: "/calendar" },
    { label: "Progress", to: "/progress" },
    { label: "Profile", to: "/profile" },
  ];

  return (
    <div className="min-h-screen bg-gymbud-background text-gymbud-ink">
      <aside className="glass-surface fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-gymbud-border px-5 py-6 lg:block">
        <div className="flex h-full flex-col">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gymbud-muted">
              Fitness planner
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {productName}
            </p>
          </div>
          <nav className="mt-12 grid gap-2" aria-label="Primary navigation">
            {navigation.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <p className="mt-auto text-xs leading-5 text-gymbud-muted">
            Plan deliberately. Train consistently. Review honestly.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-gymbud-border bg-gymbud-background/90 px-4 py-4 backdrop-blur sm:px-8 lg:hidden">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{productName}</p>
            <span className="text-xs text-gymbud-muted">Athletic Calm</span>
          </div>
        </header>
        <Outlet />
      </div>

      <nav
        className="glass-surface fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-gymbud-border px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Mobile navigation"
      >
        {navigation.map((item) => (
          <NavItem key={item.to} {...item} mobile />
        ))}
      </nav>
    </div>
  );
}

function NavItem({
  label,
  to,
  mobile = false,
}: {
  label: string;
  to: string;
  mobile?: boolean;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        "focus-ring rounded-[var(--radius-control)] px-3 py-3 text-sm font-semibold " +
        (mobile ? "text-center " : "") +
        (isActive
          ? "bg-gymbud-accent-soft text-gymbud-ink"
          : "text-gymbud-muted hover:bg-gymbud-surface-muted")
      }
      to={to}
    >
      {label}
    </NavLink>
  );
}
