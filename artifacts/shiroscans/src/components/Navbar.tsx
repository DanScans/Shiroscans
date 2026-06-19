import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Search, BookmarkCheck, Clock, Heart, User, Settings, LogOut, ChevronDown, Menu, X, Compass, Loader2 } from "lucide-react";
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
  return `${BASE}/api/weebcentral/proxy-image?url=${encodeURIComponent(url)}`;
}

interface SuggestionItem {
  id: string;
  title: string;
  coverUrl: string;
  slug: string;
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

  const isManhwa = location.startsWith("/manhwa");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      if (isManhwa) {
        setLocation(`/manhwa/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      } else {
        setLocation(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setSearchQuery("");
      setMobileOpen(false);
    }
  }

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    clearTimeout(suggestDebounce.current);
    if (!val.trim()) { setSuggestions([]); setShowSuggestions(false); setSuggestLoading(false); return; }
    setShowSuggestions(true);
    setSuggestLoading(true);
    suggestDebounce.current = setTimeout(() => {
      const searchUrl = isManhwa
        ? `${BASE}/api/asurascans/search?q=${encodeURIComponent(val.trim())}`
        : `${BASE}/api/weebcentral/search?q=${encodeURIComponent(val.trim())}`;
      fetch(searchUrl)
        .then((r) => r.ok ? r.json() : { items: [] })
        .catch(() => ({ items: [] }))
        .then((data: { items?: Array<{ id: string; title: string; coverUrl: string; type?: string }>; results?: Array<{ id: string; title: string; coverUrl: string; type?: string }> }) => {
          const raw = data.items ?? data.results ?? [];
          setSuggestions(raw.slice(0, 7).map((item) => ({
            id: item.id,
            slug: item.id,
            title: item.title,
            coverUrl: item.coverUrl,
            type: item.type,
          })));
        })
        .finally(() => setSuggestLoading(false));
    }, 220);
  }

  function goToSuggestion(item: SuggestionItem) {
    setShowSuggestions(false);
    setSearchQuery("");
    if (isManhwa) {
      setLocation(`/manhwa/series/${encodeURIComponent(item.slug)}`);
    } else {
      setLocation(`/manga/series/${item.id}`);
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-md border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href={isManhwa ? "/manhwa" : "/"} className="flex items-center gap-2 group shrink-0">
            <img src={logoPath} alt="ShiroScans" className="w-7 h-7 rounded-full" />
            <span className="text-base font-extrabold text-white tracking-tight group-hover:text-primary transition-colors">
              ShiroScans
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input
                  type="text" value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => searchQuery && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder={isManhwa ? "Search manhwa..." : "Search manga..."}
                  autoComplete="off"
                  className="bg-white/5 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:border-primary/40 focus:bg-white/8 w-40 transition-all focus:w-64"
                />
              </div>

              {showSuggestions && searchQuery.trim() && (
                <div className="absolute top-full right-0 mt-1.5 w-72 bg-[#13131f] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
                  {suggestLoading && suggestions.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-3 text-white/40 text-xs">
                      <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                    </div>
                  ) : suggestions.length > 0 ? (
                    <>
                      {suggestions.map((item) => (
                        <button key={item.id} type="button"
                          onMouseDown={(e) => { e.preventDefault(); goToSuggestion(item); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0 text-left">
                          <div className="w-7 h-9 rounded overflow-hidden shrink-0 bg-[#1a1a2e]">
                            {item.coverUrl && <img src={proxyImage(item.coverUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/90 font-semibold line-clamp-1">{item.title}</p>
                            <p className="text-[10px] text-white/30 mt-0.5">{item.type ?? "—"}</p>
                          </div>
                        </button>
                      ))}
                      <button type="submit" onMouseDown={(e) => e.preventDefault()} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-primary/80 hover:bg-white/[0.04] font-semibold">
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
                  <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={user.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                        {user.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm text-white/90">{user.username}</span>
                    <ChevronDown className="w-3 h-3 text-[#9CA3AF]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-card border-white/10">
                  <DropdownMenuItem asChild><Link href="/profile" className="flex items-center gap-2 cursor-pointer"><User className="w-3.5 h-3.5" /> Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/bookmarks" className="flex items-center gap-2 cursor-pointer"><BookmarkCheck className="w-3.5 h-3.5" /> Bookmarks</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/history" className="flex items-center gap-2 cursor-pointer"><Clock className="w-3.5 h-3.5" /> History</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/favourites" className="flex items-center gap-2 cursor-pointer"><Heart className="w-3.5 h-3.5" /> Favourites</Link></DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild><Link href="/settings" className="flex items-center gap-2 cursor-pointer"><Settings className="w-3.5 h-3.5" /> Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem className="flex items-center gap-2 text-destructive cursor-pointer" onClick={() => logoutMutation.mutate(undefined)}>
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-1.5">
                <Button variant="ghost" size="sm" asChild className="text-[#9CA3AF] hover:text-white h-8 px-3 text-xs"><Link href="/login">Login</Link></Button>
                <Button size="sm" asChild className="bg-primary hover:bg-primary/90 h-8 px-3 text-xs font-semibold"><Link href="/register">Register</Link></Button>
              </div>
            )}

            <button className="p-1.5 rounded-md text-[#9CA3AF] hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-[#0A0A0F]/98 backdrop-blur-md">
          <div className="px-4 py-4 space-y-1 max-w-7xl mx-auto">
            <form onSubmit={handleSearch} className="flex mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input type="text" value={searchQuery} onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder={isManhwa ? "Search manhwa..." : "Search manga..."} autoComplete="off"
                  className="w-full bg-white/5 border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:border-primary/40" />
              </div>
            </form>

            {/* Section switcher */}
            <div className="flex gap-1 mb-3 p-1 bg-white/[0.04] rounded-xl">
              <Link href="/" onClick={() => setMobileOpen(false)}
                className={`flex-1 text-center py-2 rounded-lg text-sm font-bold transition-all ${!isManhwa ? "bg-primary text-white shadow-md" : "text-white/40 hover:text-white"}`}>
                📖 Manga
              </Link>
              <Link href="/manhwa" onClick={() => setMobileOpen(false)}
                className={`flex-1 text-center py-2 rounded-lg text-sm font-bold transition-all ${isManhwa ? "bg-primary text-white shadow-md" : "text-white/40 hover:text-white"}`}>
                🌸 Manhwa
              </Link>
            </div>

            {!isManhwa ? (
              <Link href="/browse" className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${location === "/browse" ? "text-primary bg-primary/10" : "text-white/70 hover:text-white hover:bg-white/5"}`} onClick={() => setMobileOpen(false)}>
                <Compass className="w-4 h-4" /> Browse Manga
              </Link>
            ) : (
              <Link href="/manhwa/browse" className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${location === "/manhwa/browse" ? "text-primary bg-primary/10" : "text-white/70 hover:text-white hover:bg-white/5"}`} onClick={() => setMobileOpen(false)}>
                <Compass className="w-4 h-4" /> Browse Manhwa
              </Link>
            )}

            <div className="h-px bg-white/[0.06] my-2" />

            {user ? (
              <>
                <Link href="/profile" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><User className="w-4 h-4" />Profile</Link>
                <Link href="/bookmarks" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><BookmarkCheck className="w-4 h-4" />Bookmarks</Link>
                <Link href="/history" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><Clock className="w-4 h-4" />History</Link>
                <Link href="/favourites" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><Heart className="w-4 h-4" />Favourites</Link>
                <Link href="/settings" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5" onClick={() => setMobileOpen(false)}><Settings className="w-4 h-4" />Settings</Link>
                <button className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-sm text-destructive hover:bg-white/5"
                  onClick={() => { logoutMutation.mutate(undefined); setMobileOpen(false); }}>
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" asChild className="flex-1 text-sm"><Link href="/login" onClick={() => setMobileOpen(false)}>Login</Link></Button>
                <Button size="sm" asChild className="flex-1 bg-primary hover:bg-primary/90 text-sm"><Link href="/register" onClick={() => setMobileOpen(false)}>Register</Link></Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
