import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Search, Zap, TrendingUp, Clock, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface AsuraSeriesPreview {
  id: string;
  sourceId: string;
  title: string;
  coverUrl: string;
  status: string;
  latestChapter?: number;
  genres: string[];
}

interface HomeData {
  featured: AsuraSeriesPreview[];
  popular: AsuraSeriesPreview[];
  latest: AsuraSeriesPreview[];
}

interface BrowseData {
  results: AsuraSeriesPreview[];
  total: number;
  page: number;
  hasMore: boolean;
}

function SeriesCard({ item }: { item: AsuraSeriesPreview }) {
  const statusColor =
    item.status === "Ongoing" ? "text-violet-400 bg-violet-500/10" :
    item.status === "Completed" ? "text-blue-400 bg-blue-500/10" :
    item.status === "Hiatus" ? "text-orange-400 bg-orange-500/10" :
    "text-gray-400 bg-gray-500/10";

  return (
    <Link href={`/asura/series/${encodeURIComponent(item.id)}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#1a1a2e] shadow-lg group-hover:shadow-primary/20 transition-all duration-300 group-hover:scale-[1.02]" style={{ aspectRatio: "2/3" }}>
        {item.coverUrl ? (
          <img
            src={proxyImage(item.coverUrl)}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0"; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2a2a3e] to-[#1a1a2e] flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          {item.genres.slice(0, 2).map((g) => (
            <span key={g} className="inline-block text-[9px] bg-primary/80 text-white px-1.5 py-0.5 rounded mr-1 mb-1">{g}</span>
          ))}
        </div>
        {item.latestChapter && (
          <div className="absolute top-2 right-2 text-[9px] font-bold bg-black/70 text-white/80 px-1.5 py-0.5 rounded">
            Ch.{item.latestChapter}
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug">{item.title}</h3>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 inline-block ${statusColor}`}>{item.status}</span>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div>
      <Skeleton className="rounded-xl bg-[#1a1a2e] w-full" style={{ aspectRatio: "2/3" }} />
      <Skeleton className="h-3.5 w-3/4 mt-2 bg-[#1a1a2e] rounded" />
      <Skeleton className="h-3 w-1/2 mt-1 bg-[#1a1a2e] rounded" />
    </div>
  );
}

type TabType = "home" | "browse" | "search";

export default function ManhwaPage() {
  const [tab, setTab] = useState<TabType>("home");
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [browseData, setBrowseData] = useState<BrowseData | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseGenre, setBrowseGenre] = useState("");
  const [browseStatus, setBrowseStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AsuraSeriesPreview[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setHomeLoading(true);
    fetch(`${BASE}/api/asurascans/home`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: HomeData) => setHomeData(d))
      .catch(() => toast({ description: "Failed to load content", variant: "destructive" }))
      .finally(() => setHomeLoading(false));
  }, []);

  const fetchBrowse = useCallback((page: number, genre: string, status: string) => {
    setBrowseLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (genre) params.set("genre", genre);
    if (status) params.set("status", status);
    fetch(`${BASE}/api/asurascans/browse?${params}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: BrowseData) => setBrowseData(d))
      .catch(() => toast({ description: "Browse failed", variant: "destructive" }))
      .finally(() => setBrowseLoading(false));
  }, []);

  useEffect(() => {
    fetchBrowse(1, "", "");
  }, [fetchBrowse]);

  useEffect(() => {
    if (tab === "browse") fetchBrowse(browsePage, browseGenre, browseStatus);
  }, [tab, browsePage, browseGenre, browseStatus, fetchBrowse]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    fetch(`${BASE}/api/asurascans/search?q=${encodeURIComponent(searchQuery.trim())}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { results: AsuraSeriesPreview[] }) => setSearchResults(d.results))
      .catch(() => toast({ description: "Search failed", variant: "destructive" }))
      .finally(() => setSearchLoading(false));
  }

  const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-fi", "Slice of Life", "Supernatural", "Thriller", "Martial Arts", "School Life", "Historical", "Psychological"];
  const STATUSES = ["Ongoing", "Completed", "Hiatus", "Dropped"];

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="bg-gradient-to-b from-primary/10 to-transparent px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Manhwa</h1>
            <p className="text-xs text-white/40">Explore manhwa series</p>
          </div>
        </div>

        <div className="flex gap-1 mt-4 bg-white/[0.05] rounded-lg p-1">
          {([
            { id: "home", label: "Featured", icon: <Zap className="w-3.5 h-3.5" /> },
            { id: "browse", label: "Browse", icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { id: "search", label: "Search", icon: <Search className="w-3.5 h-3.5" /> },
          ] as { id: TabType; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-md text-xs font-bold transition-all ${tab === id ? "bg-primary text-white shadow" : "text-white/40 hover:text-white/70"}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {tab === "home" && (
          <div className="space-y-8 pb-8">
            <section>
              <h2 className="text-base font-extrabold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />Featured
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {homeLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                  : (homeData?.featured ?? []).map((item) => <SeriesCard key={item.id} item={item} />)
                }
              </div>
            </section>

            <section>
              <h2 className="text-base font-extrabold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />Popular
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {homeLoading
                  ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                  : (homeData?.popular ?? []).map((item) => <SeriesCard key={item.id} item={item} />)
                }
              </div>
            </section>

            <section>
              <h2 className="text-base font-extrabold text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />Latest Updates
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {homeLoading
                  ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                  : (homeData?.latest ?? []).map((item) => <SeriesCard key={item.id} item={item} />)
                }
              </div>
            </section>
          </div>
        )}

        {tab === "browse" && (
          <div className="pb-8">
            <div className="flex items-center gap-2 py-3 mb-2">
              <Button
                size="sm"
                variant={showFilters ? "default" : "outline"}
                className={`h-8 px-3 text-xs font-bold gap-1.5 ${showFilters ? "bg-primary border-primary hover:bg-primary/90" : "border-white/10 text-white/60 hover:text-white bg-transparent"}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-3 h-3" /> Filters
              </Button>
              {browseGenre && (
                <span className="flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                  {browseGenre}
                  <button onClick={() => { setBrowseGenre(""); setBrowsePage(1); }}><X className="w-3 h-3" /></button>
                </span>
              )}
              {browseStatus && (
                <span className="flex items-center gap-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                  {browseStatus}
                  <button onClick={() => { setBrowseStatus(""); setBrowsePage(1); }}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>

            {showFilters && (
              <div className="bg-[#1a1a2e] rounded-xl p-4 mb-4 space-y-4">
                <div>
                  <p className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Genre</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRES.map((g) => (
                      <button
                        key={g}
                        onClick={() => { setBrowseGenre(browseGenre === g.toLowerCase() ? "" : g.toLowerCase()); setBrowsePage(1); }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${browseGenre === g.toLowerCase() ? "bg-primary border-primary text-white" : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setBrowseStatus(browseStatus === s.toLowerCase() ? "" : s.toLowerCase()); setBrowsePage(1); }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${browseStatus === s.toLowerCase() ? "bg-primary border-primary text-white" : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {browseLoading
                ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                : (browseData?.results ?? []).map((item) => <SeriesCard key={item.id} item={item} />)
              }
            </div>

            {browseData && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  disabled={browsePage === 1}
                  onClick={() => { setBrowsePage((p) => p - 1); window.scrollTo(0, 0); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border transition-all ${browsePage === 1 ? "border-white/5 text-white/20 cursor-not-allowed" : "border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/[0.04]"}`}
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="flex items-center px-3 text-sm text-white/40 font-medium">
                  Page {browsePage}
                </span>
                <button
                  disabled={!browseData.hasMore}
                  onClick={() => { setBrowsePage((p) => p + 1); window.scrollTo(0, 0); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border transition-all ${!browseData.hasMore ? "border-white/5 text-white/20 cursor-not-allowed" : "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60"}`}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "search" && (
          <div className="pb-8">
            <form onSubmit={handleSearch} className="flex gap-2 py-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search manhwa..."
                  className="pl-9 bg-[#1a1a2e] border-white/10 text-white placeholder:text-white/30 focus:border-primary/50"
                />
              </div>
              <Button type="submit" disabled={searchLoading} className="bg-primary hover:bg-primary/90 text-white px-4">
                {searchLoading ? "..." : "Search"}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <>
                <p className="text-xs text-white/40 mb-3">{searchResults.length} results for "{searchQuery}"</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {searchResults.map((item) => <SeriesCard key={item.id} item={item} />)}
                </div>
              </>
            )}

            {!searchLoading && searchResults.length === 0 && searchQuery && (
              <div className="text-center py-12 text-white/30">
                <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No results found for "{searchQuery}"</p>
              </div>
            )}

            {!searchQuery && (
              <div className="text-center py-12 text-white/30">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Search manhwa series</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
