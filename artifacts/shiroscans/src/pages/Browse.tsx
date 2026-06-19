import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Filter, X, ChevronDown, ChevronUp, Search, BookOpen, Bookmark } from "lucide-react";
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
  return `${BASE}/api/weebcentral/proxy-image?url=${encodeURIComponent(url)}`;
}

interface WCSeries {
  id: string;
  title: string;
  coverUrl: string;
  type: string;
  status: string;
  genres: string[];
  latestChapter: string | null;
}

const SORT_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "latest", label: "Latest Update" },
];

const STATUS_OPTIONS = ["All", "Ongoing", "Completed", "Hiatus", "Dropped"];

const ALL_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance",
  "Harem", "Martial Arts", "Isekai", "Reincarnation", "Revenge",
  "School Life", "Supernatural", "Horror", "Mystery", "Thriller",
  "Sci-fi", "Shounen", "Shoujo", "Slice of Life", "Sports",
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

function MangaCard({ item }: { item: WCSeries }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: bookmarks } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });
  const isBookmarked = bookmarks?.some((b: { provider: string; seriesId: string }) => b.provider === "weebcentral" && b.seriesId === item.id);
  const addBookmark = useAddBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });
  const removeBookmark = useRemoveBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });

  function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast({ description: "Login to bookmark", variant: "destructive" }); return; }
    if (isBookmarked) removeBookmark.mutate({ provider: "weebcentral", seriesId: item.id });
    else addBookmark.mutate({ data: { provider: "weebcentral", seriesId: item.id, title: item.title, coverImage: item.coverUrl, type: item.type || "Manga", status: item.status ?? "Ongoing" } });
  }

  const statusCls = STATUS_COLOR[item.status ?? ""] ?? "text-white/40 bg-white/[0.05] border-white/[0.08]";

  return (
    <Link href={`/manga/series/${item.id}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#13131f]" style={{ aspectRatio: "2/3" }}>
        {item.coverUrl ? (
          <img src={proxyImg(item.coverUrl)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0d2e22] to-[#13131f] flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary/20" />
          </div>
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

export default function BrowsePage() {
  const [allItems, setAllItems] = useState<{ popular: WCSeries[]; latest: WCSeries[] }>({ popular: [], latest: [] });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WCSeries[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sort, setSort] = useState("popular");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ sort: true, status: false, genre: false });

  function toggleSection(s: keyof typeof openSections) { setOpenSections((prev) => ({ ...prev, [s]: !prev[s] })); }
  function toggleGenre(g: string) { setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]); }

  const loadHome = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/weebcentral/home`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setAllItems({ popular: data.popular ?? data.featured ?? [], latest: data.latest ?? [] });
    } catch {
      setAllItems({ popular: [], latest: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHome(); }, [loadHome]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) { setQuery(""); return; }
    setQuery(q);
    setSearchLoading(true);
    fetch(`${BASE}/api/weebcentral/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setSearchResults(d.items ?? []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }

  function clearSearch() { setSearchInput(""); setQuery(""); setSearchResults([]); }

  const baseItems = sort === "popular" ? allItems.popular : allItems.latest;

  let displayedItems = query ? searchResults : baseItems;

  if (!query && selectedStatus !== "All") {
    displayedItems = displayedItems.filter((item) =>
      item.status?.toLowerCase() === selectedStatus.toLowerCase()
    );
  }
  if (!query && selectedGenres.length > 0) {
    displayedItems = displayedItems.filter((item) =>
      selectedGenres.some((g) => item.genres?.some((ig) => ig.toLowerCase() === g.toLowerCase()))
    );
  }

  const isLoading = query ? searchLoading : loading;
  const activeFilterCount = [selectedStatus !== "All" ? 1 : 0, selectedGenres.length > 0 ? 1 : 0].reduce((a, b) => a + b, 0);

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10">
        <div className="flex items-center gap-2 mb-5">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search WeebCentral..."
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40" />
            {searchInput && (
              <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
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
            <button onClick={() => setFiltersOpen(false)}
              className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all">
              Apply Filters
            </button>
          </div>
        )}

        {query && (
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm text-white/40">Results for <span className="text-white font-semibold">"{query}"</span></p>
            <button onClick={clearSearch} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
            : displayedItems.length === 0
              ? (
                <div className="col-span-3 sm:col-span-4 text-center py-16 text-white/30 text-sm">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  {query ? `No results for "${query}"` : "No content available"}
                </div>
              )
              : displayedItems.map((item) => <MangaCard key={item.id} item={item} />)
          }
        </div>
      </div>
    </div>
  );
}
