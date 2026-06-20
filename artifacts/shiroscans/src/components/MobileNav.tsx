import { Link, useLocation } from "wouter";
import { Home, Bookmark, Search, User } from "lucide-react";

export default function MobileNav() {
  const [location] = useLocation();
  const isManhwa = location.startsWith("/manhwa");

  const navItems = [
    { href: isManhwa ? "/manhwa" : "/", icon: Home, label: "Home" },
    { href: isManhwa ? "/manhwa/browse" : "/browse", icon: Search, label: "Browse" },
    { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0F]/98 backdrop-blur-md border-t border-white/[0.08]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/" && href !== "/manhwa" && location.startsWith(href));
          return (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors"
            >
              <Icon
                className={`w-[22px] h-[22px] transition-colors ${active ? "text-primary" : "text-white/30"}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className={`text-[10px] font-semibold tracking-tight transition-colors ${active ? "text-primary" : "text-white/25"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
