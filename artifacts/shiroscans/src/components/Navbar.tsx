import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, BookmarkCheck, Clock, Heart, User, Settings, LogOut, ChevronDown, Menu, X, Compass, Flame, BarChart2 } from "lucide-react";
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

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setMobileOpen(false);
    }
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
            <form onSubmit={handleSearch} className="hidden md:flex items-center" data-testid="form-search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="bg-white/5 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-[#9CA3AF] focus:outline-none focus:border-primary/40 focus:bg-white/8 w-40 transition-all focus:w-56"
                  data-testid="input-search"
                />
              </div>
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
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search manga..."
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
