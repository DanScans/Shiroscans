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
  if (url.includes("uploads.mangadex.org")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface MangaItem {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
  status?: string | null;
  rating?: number | null;
  latestChapter?: string | null;
  genres?: string[];
}

function seriesHref(item: MangaItem): string {
  return `/series/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.id)}`;
}

const SORT_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "newest", label: "Newest" },
  { value: "a-z", label: "A-Z" },
];

const STATUS_OPTIONS = ["All", "Ongoing", "Completed", "Hiatus"];
const TYPE_OPTIONS = ["All", "Manga", "Manhwa", "Manhua"];

const STATUS_COLOR: Record<string, string> = {
  Ongoing: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Completed: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Hiatus: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

function FilterSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.06]">
      <button onClick={onToggle} className="flex items-center justify-between w-full py-3 text-sm font-semibold text-white/80 hover:text-white transition-colors">
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function BrowseCard({ item }: { item: MangaItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: bookmarks } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });
  const isBookmarked = bookmarks?.some((b) => b.provider === item.provider && b.seriesId === item.id);
  const addBookmark = useAddBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });
  const removeBookmark = useRemoveBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });

  function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast({ description: "Login to bookmark", variant: "destructive" }); return; }
    if (isBookmarked) removeBookmark.mutate({ provider: item.provider, seriesId: item.id });
    else addBookmark.mutate({ data: { provider: item.provider, seriesId: item.id, title: item.title, coverImage: item.coverImage, type: item.type ?? "Manga", status: item.status ?? "Ongoing" } });
  }

  const statusCls = STATUS_COLOR[item.status ?? ""] ?? "text-white/40 bg-white/[0.05] border-white/[0.08]";

  return (
    <Link href={seriesHref(item)} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#13131f]" style={{ aspectRatio: "2/3" }}>
        {item.coverImage ? (
          <img src={proxyImg(item.coverImage)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#13131f]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {item.rating != null && (
          <div className="absolute top-1.5 right-1.5 bg-black/75 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            ⭐ {item.rating.toFixed(1)}
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {item.status && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${statusCls}`}>{item.status}</span>
          )}
        </div>
        <button onClick={toggleBookmark}
          className={`mt-1.5 w-full py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isBookmarked ? "bg-violet-500/20 border-violet-500/30 text-violet-300" : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08]"}`}>
          <Bookmark className="w-2.5 h-2.5 inline mr-1" />{isBookmarked ? "Saved" : "Save"}
        </button>
      </div>
    </Link>
  );
}

function SkeletonBrowseCard() {
  return (
    <div>
      <Skeleton className="rounded-xl bg-[#13131f] w-full" style={{ aspectRatio: "2/3" }} />
      <Skeleton className="h-3 w-3/4 mt-2 bg-[#13131f] rounded" />
      <Skeleton className="h-5 w-full mt-1.5 bg-[#13131f] rounded" />
      <Skeleton className="h-6 w-full mt-1.5 bg-[#13131f] rounded-lg" />
    </div>
  );
}

export default function BrowsePage() {
  const [items, setItems] = useState<MangaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("popular");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ sort: true, type: true, status: false });

  function toggleSection(s: keyof typeof openSections) { setOpenSections((prev) => ({ ...prev, [s]: !prev[s] })); }

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      if (query) {
        const params = new URLSearchParams({ q: query, page: String(p) });
        if (selectedType !== "All") params.set("type", selectedType);
        if (selectedStatus !== "All") params.set("status", selectedStatus);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const r = await fetch(`${BASE}/api/manga/search?${params}`, { signal: ctrl.signal });
          clearTimeout(timer);
          if (!r.ok) throw new Error("Failed");
          const d = await r.json();
          setItems(d.items ?? []);
          setHasMore(d.hasMore ?? false);
        } catch {
          clearTimeout(timer);
          setItems([]);
          setHasMore(false);
        }
        return;
      } else {
        const params = new URLSearchParams({ page: String(p) });
        if (selectedType !== "All") params.set("type", selectedType);
        if (selectedStatus !== "All") params.set("status", selectedStatus);
        const endpoint = sort === "popular" ? "popular" : "latest";
        const r = await fetch(`${BASE}/api/manga/${endpoint}?${params}`);
        if (!r.ok) throw new Error("Failed");
        const d = await r.json();
        setItems(d.items ?? []);
        setHasMore(d.hasMore ?? false);
      }
    } catch { setItems([]); setHasMore(false); } finally { setLoading(false); }
  }, [query, sort, selectedType, selectedStatus]);

  useEffect(() => { setPage(1); fetchData(1); }, [query, sort, selectedType, selectedStatus]);
  useEffect(() => { fetchData(page); }, [page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(searchInput.trim());
    setPage(1);
  }

  const activeFilterCount = [selectedType !== "All" ? 1 : 0, selectedStatus !== "All" ? 1 : 0].reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10">
        <div className="flex items-center gap-2 mb-5">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search manga..."
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40" />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(""); setQuery(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            className={`relative p-2.5 rounded-xl border transition-all ${filtersOpen ? "bg-primary/20 border-primary/40 text-primary" : "bg-[#13131f] border-white/[0.08] text-white/50 hover:text-white"}`}>
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-white flex items-center justify-center">{activeFilterCount}</span>
            )}
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
            <FilterSection title="Type" open={openSections.type} onToggle={() => toggleSection("type")}>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_OPTIONS.map((t) => (
                  <button key={t} onClick={() => setSelectedType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${selectedType === t ? "bg-primary text-white" : "bg-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.08]"}`}>
                    {t}
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
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonBrowseCard key={i} />)
            : items.length === 0
              ? <div className="col-span-3 sm:col-span-4 text-center py-16 text-white/30 text-sm">No results found</div>
              : items.map((item) => <BrowseCard key={item.id} item={item} />)
          }
        </div>

        {!loading && (
          <div className="flex items-center justify-center gap-3 pt-4 pb-2">
            <button onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">‹ Prev</button>
            <span className="text-xs text-white/40 font-semibold">Page {page}</span>
            <button onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={!hasMore}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">Next ›</button>
          </div>
        )}
      </div>
    </div>
  );
}
