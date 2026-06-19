import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Filter, X, ChevronDown, ChevronUp, Search, Bookmark } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetMe, getGetMeQueryKey,
  useGetBookmarks, getGetBookmarksQueryKey,
  useAddBookmark, useRemoveBookmark,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImg(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface ManhwaItem {
  id: string;
  title: string;
  coverUrl: string;
  status?: string | null;
  genres?: string[];
}

const SORT_OPTIONS = [
  { value: "recently_updated", label: "Latest Update" },
  { value: "popular", label: "Popular" },
  { value: "a-z", label: "A-Z" },
  { value: "newest", label: "Newest" },
];
const STATUS_OPTIONS = ["All", "Ongoing", "Completed", "Hiatus", "Dropped"];
const ALL_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance",
  "Harem", "Martial Arts", "Isekai", "Regression", "Reincarnation",
  "Revenge", "Overpowered", "System", "School Life", "Supernatural",
  "Horror", "Mystery", "Thriller", "Sci-fi", "Shounen", "Shoujo",
];
const STATUS_COLOR: Record<string, string> = {
  Ongoing: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Completed: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Hiatus: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Dropped: "text-red-400 bg-red-500/10 border-red-500/20",
};

function FilterSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/[0.06]">
      <button onClick={onToggle} className="flex items-center justify-between w-full py-3 text-sm font-semibold text-white/80 hover:text-white transition-colors">
        {title}{open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function ManhwaCard({ item }: { item: ManhwaItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: bookmarks } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });
  const isBookmarked = bookmarks?.some((b: { provider: string; seriesId: string }) => b.provider === "asurascans" && b.seriesId === item.id);
  const addBookmark = useAddBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });
  const removeBookmark = useRemoveBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });

  function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast({ description: "Login to bookmark", variant: "destructive" }); return; }
    if (isBookmarked) removeBookmark.mutate({ provider: "asurascans", seriesId: item.id });
    else addBookmark.mutate({ data: { provider: "asurascans", seriesId: item.id, title: item.title, coverImage: item.coverUrl, type: "Manhwa", status: item.status ?? "Ongoing" } });
  }

  const statusCls = STATUS_COLOR[item.status ?? ""] ?? "text-white/40 bg-white/[0.05] border-white/[0.08]";

  return (
    <Link href={`/manhwa/series/${encodeURIComponent(item.id)}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#13131f]" style={{ aspectRatio: "2/3" }}>
        {item.coverUrl ? (
          <img src={proxyImg(item.coverUrl)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#13131f]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {item.status && <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${statusCls}`}>{item.status}</span>}
        </div>
        <button onClick={toggleBookmark}
          className={`mt-1.5 w-full py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isBookmarked ? "bg-violet-500/20 border-violet-500/30 text-violet-300" : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08]"}`}>
          <Bookmark className="w-2.5 h-2.5 inline mr-1" />{isBookmarked ? "Saved" : "Save"}
        </button>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div>
      <Skeleton className="rounded-xl bg-[#13131f] w-full" style={{ aspectRatio: "2/3" }} />
      <Skeleton className="h-3 w-3/4 mt-2 bg-[#13131f] rounded" />
      <Skeleton className="h-5 w-full mt-1.5 bg-[#13131f] rounded" />
      <Skeleton className="h-6 w-full mt-1.5 bg-[#13131f] rounded-lg" />
    </div>
  );
}

function Pagination({ page, hasMore, onPage }: { page: number; hasMore: boolean; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 pt-4 pb-2">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">‹ Prev</button>
      <span className="text-xs text-white/40 font-semibold">Page {page}</span>
      <button onClick={() => onPage(page + 1)} disabled={!hasMore}
        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">Next ›</button>
    </div>
  );
}

export default function ManhwaBrowsePage() {
  const [items, setItems] = useState<ManhwaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recently_updated");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ sort: true, status: false, genre: false });

  function toggleSection(s: keyof typeof openSections) { setOpenSections((prev) => ({ ...prev, [s]: !prev[s] })); }
  function toggleGenre(g: string) { setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]); }

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      if (query) {
        const params = new URLSearchParams({ q: query });
        const r = await fetch(`${BASE}/api/asurascans/search?${params}`);
        if (!r.ok) throw new Error("Failed");
        const d = await r.json();
        const results: ManhwaItem[] = d.results ?? [];
        setItems(results);
        setHasMore(false);
      } else {
        const params = new URLSearchParams({
          page: String(p),
          ...(selectedStatus !== "All" && { status: selectedStatus }),
          ...(selectedGenres.length > 0 && { genre: selectedGenres[0]! }),
          ...(sort !== "recently_updated" && { order: sort }),
        });
        const r = await fetch(`${BASE}/api/asurascans/browse?${params}`);
        if (!r.ok) throw new Error("Failed");
        const d = await r.json();
        setItems(d.results ?? []);
        setHasMore(d.hasMore ?? false);
      }
    } catch { setItems([]); setHasMore(false); }
    finally { setLoading(false); }
  }, [query, selectedStatus, selectedGenres]);

  useEffect(() => { setPage(1); fetchData(1); }, [query, sort, selectedStatus, selectedGenres]);
  useEffect(() => { fetchData(page); }, [page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(searchInput.trim());
    setPage(1);
  }

  const activeFilterCount = [selectedStatus !== "All" ? 1 : 0, selectedGenres.length > 0 ? 1 : 0].reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10">
        <div className="flex items-center gap-2 mb-5">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search manhwa..."
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40" />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); setQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
            )}
          </form>
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className={`relative p-2.5 rounded-xl border transition-all ${filtersOpen ? "bg-primary/20 border-primary/40 text-primary" : "bg-[#13131f] border-white/[0.08] text-white/50 hover:text-white"}`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>

        {filtersOpen && (
          <div className="bg-[#10101a] rounded-2xl border border-white/[0.06] p-4 mb-5">
            <FilterSection title="Sort By" open={openSections.sort} onToggle={() => toggleSection("sort")}>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => setSort(opt.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${sort === opt.value ? "bg-primary text-white" : "bg-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.08]"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </FilterSection>
            <FilterSection title="Status" open={openSections.status} onToggle={() => toggleSection("status")}>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <button key={s} onClick={() => setSelectedStatus(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedStatus === s ? "bg-primary text-white" : "bg-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.08]"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </FilterSection>
            <FilterSection title="Genre" open={openSections.genre} onToggle={() => toggleSection("genre")}>
              <div className="flex flex-wrap gap-1.5">
                {ALL_GENRES.map((g) => (
                  <button key={g} onClick={() => toggleGenre(g)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedGenres.includes(g) ? "bg-primary text-white" : "bg-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.08]"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </FilterSection>
            <button onClick={() => { setPage(1); fetchData(1); setFiltersOpen(false); }}
              className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all">
              Apply Filters
            </button>
          </div>
        )}

        {query && (
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm text-white/40">Results for <span className="text-white font-semibold">"{query}"</span></p>
            <button onClick={() => { setSearchInput(""); setQuery(""); }} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
            : items.length === 0
              ? <div className="col-span-3 sm:col-span-4 text-center py-16 text-white/30 text-sm">No results found</div>
              : items.map((item) => <ManhwaCard key={item.id} item={item} />)
          }
        </div>

        {!loading && !query && (
          <Pagination page={page} hasMore={hasMore} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        )}
      </div>
    </div>
  );
}
