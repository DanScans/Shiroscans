import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, BookmarkCheck, Clock, Heart, User, Settings, LogOut, ChevronDown, Menu, X, Compass, Flame, BarChart2, Loader2, BookOpen } from "lucide-react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import logoPath from "@assets/file_0000000028ec71f5bea7a576cf17a0af_1781485787252.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  if (url.includes("uploads.mangadex.org")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface SuggestionItem {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
}

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, throwOnError: false } });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/");
      },
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setMobileOpen(false);
    }
  }

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    clearTimeout(suggestDebounce.current);

    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestLoading(false);
      return;
    }

    setShowSuggestions(true);
    setSuggestLoading(true);

    suggestDebounce.current = setTimeout(() => {
      Promise.all([
        fetch(`${BASE}/api/manga/suggestions?q=${encodeURIComponent(val.trim())}`).then((r) => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
        fetch(`${BASE}/api/flamecomics/search?q=${encodeURIComponent(val.trim())}`).then((r) => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
      ]).then(([mdxData, flameData]) => {
        const mdx = (mdxData.items ?? []).slice(0, 4) as SuggestionItem[];
        const flame = ((flameData.results ?? []) as Array<{ id: string; title: string; coverUrl: string; genres: string[] }>)
          .slice(0, 4)
          .map((item) => ({ id: item.id, title: item.title, coverImage: item.coverUrl, provider: "flamecomics", type: "Manhwa" }));
        const seen = new Set<string>();
        const merged: SuggestionItem[] = [];
        for (const item of [...flame, ...mdx]) {
          const key = item.title.toLowerCase().replace(/\s+/g, "");
          if (!seen.has(key)) { seen.add(key); merged.push(item); }
        }
        setSuggestions(merged.slice(0, 7));
      }).finally(() => setSuggestLoading(false));
    }, 220);
  }

  function goToSuggestion(item: SuggestionItem) {
    setShowSuggestions(false);
    setSearchQuery("");
    const href = item.provider === "flamecomics"
      ? `/flame/series/${encodeURIComponent(item.id)}`
      : `/series/${item.provider}/${encodeURIComponent(item.id)}`;
    setLocation(href);
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/latest", label: "Latest" },
    { href: "/popular", label: "Popular" },
    { href: "/manhwa", label: "Manhwa", icon: <Flame className="w-3.5 h-3.5 text-orange-400" /> },
    { href: "/rankings", label: "Rankings", icon: <BarChart2 className="w-3.5 h-3.5 text-amber-400" /> },
    { href: "/search", label: "Browse", icon: <Compass className="w-3.5 h-3.5" /> },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-md border-b border-white/[0.06]" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group shrink-0" data-testid="link-logo">
              <img src={logoPath} alt="ShiroScans" className="w-7 h-7 rounded-full" />
              <span className="text-base font-extrabold text-white tracking-tight group-hover:text-primary transition-colors">
                ShiroScans
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location === link.href
                      ? "text-primary bg-primary/10"
                      : "text-[#9CA3AF] hover:text-white hover:bg-white/5"
                  }`}
                  data-testid={`link-nav-${link.label.toLowerCase()}`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop search with suggestions */}
            <form onSubmit={handleSearch} className="hidden md:flex items-center relative" data-testid="form-search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => searchQuery && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Search..."
                  autoComplete="off"
                  className="bg-white/5 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:border-primary/40 focus:bg-white/8 w-40 transition-all focus:w-64"
                  data-testid="input-search"
                />
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && (searchQuery.trim()) && (
                <div className="absolute top-full right-0 mt-1.5 w-72 bg-[#13131f] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
                  {suggestLoading && suggestions.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-white/40 text-xs">
                      <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                    </div>
                  ) : suggestions.length > 0 ? (
                    <>
                      {suggestions.map((item) => (
                        <button
                          key={`${item.provider}-${item.id}`}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); goToSuggestion(item); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0 text-left"
                        >
                          <div className="w-7 h-9 rounded overflow-hidden shrink-0 bg-[#1a1a2e]">
                            {item.coverImage ? (
                              <img src={proxyImage(item.coverImage)} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/90 font-semibold line-clamp-1">{item.title}</p>
                            <p className="text-[10px] text-white/30 mt-0.5">{item.type ?? "—"}</p>
                          </div>
                          {item.provider === "flamecomics" ? (
                            <Flame className="w-3 h-3 text-orange-400/60 shrink-0" />
                          ) : (
                            <BookOpen className="w-3 h-3 text-primary/40 shrink-0" />
                          )}
                        </button>
                      ))}
                      <button
                        type="submit"
                        onMouseDown={(e) => e.preventDefault()}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary/80 hover:bg-white/[0.04] font-semibold"
                      >
                        <Search className="w-3 h-3" /> All results for "{searchQuery}"
                      </button>
                    </>
                  ) : (
                    <div className="px-3 py-3 text-xs text-white/30">No results</div>
                  )}
                </div>
              )}
            </form>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors" data-testid="button-user-menu">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                        {user.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm text-white/90">{user.username}</span>
                    <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-card border-white/10">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer" data-testid="link-profile">
                      <User className="w-3.5 h-3.5" /> Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/bookmarks" className="flex items-center gap-2 cursor-pointer" data-testid="link-bookmarks">
                      <BookmarkCheck className="w-3.5 h-3.5" /> Bookmarks
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/history" className="flex items-center gap-2 cursor-pointer" data-testid="link-history">
                      <Clock className="w-3.5 h-3.5" /> History
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/favourites" className="flex items-center gap-2 cursor-pointer" data-testid="link-favourites">
                      <Heart className="w-3.5 h-3.5" /> Favourites
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2 cursor-pointer" data-testid="link-settings">
                      <Settings className="w-3.5 h-3.5" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    className="flex items-center gap-2 text-destructive cursor-pointer"
                    onClick={() => logoutMutation.mutate(undefined)}
                    data-testid="button-logout"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-1.5">
                <Button variant="ghost" size="sm" asChild className="text-[#9CA3AF] hover:text-white h-8 px-3 text-xs">
                  <Link href="/login" data-testid="link-login">Login</Link>
                </Button>
                <Button size="sm" asChild className="bg-primary hover:bg-primary/90 h-8 px-3 text-xs font-semibold">
                  <Link href="/register" data-testid="link-register">Register</Link>
                </Button>
              </div>
            )}

            <button
              className="md:hidden p-1.5 rounded-md text-[#9CA3AF] hover:text-white hover:bg-white/5"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0A0A0F]/98 backdrop-blur-md">
          <div className="px-4 py-4 space-y-1">
            <form onSubmit={handleSearch} className="flex mb-3" data-testid="form-search-mobile">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Search manga & manhwa..."
                  autoComplete="off"
                  className="w-full bg-white/5 border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:border-primary/40"
                  data-testid="input-search-mobile"
                />
              </div>
            </form>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location === link.href ? "text-primary bg-primary/10" : "text-[#9CA3AF] hover:text-white hover:bg-white/5"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <div className="h-px bg-white/[0.06] my-2" />
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><User className="w-3.5 h-3.5" />Profile</Link>
                <Link href="/bookmarks" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><BookmarkCheck className="w-3.5 h-3.5" />Bookmarks</Link>
                <Link href="/history" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><Clock className="w-3.5 h-3.5" />History</Link>
                <Link href="/favourites" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><Heart className="w-3.5 h-3.5" />Favourites</Link>
                <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#9CA3AF] hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><Settings className="w-3.5 h-3.5" />Settings</Link>
                <button
                  className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm text-destructive hover:bg-white/5"
                  onClick={() => { logoutMutation.mutate(undefined); setMobileOpen(false); }}
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" size="sm" asChild className="flex-1 text-sm">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>Login</Link>
                </Button>
                <Button size="sm" asChild className="flex-1 bg-primary hover:bg-primary/90 text-sm">
                  <Link href="/register" onClick={() => setMobileOpen(false)}>Register</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
