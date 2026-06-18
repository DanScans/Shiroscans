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

interface MFItem {
  id: string;
  slug: string;
  title: string;
  coverUrl: string;
  type: string;
  status: string | null;
  rating: number | null;
  latestChapter: string | null;
  genres: string[];
}

const SORT_OPTIONS = [
  { value: "recently_updated", label: "Latest Update" },
  { value: "popular", label: "Popular" },
  { value: "rating", label: "Rating" },
  { value: "a-z", label: "A-Z" },
  { value: "newest", label: "Newest" },
];

const STATUS_OPTIONS = ["All", "Ongoing", "Completed", "Hiatus", "Dropped", "Axed"];

const TYPE_OPTIONS = ["All", "Manhwa", "Manhua", "Manga"];

const ALL_GENRES = [
  "Action", "Adventure", "Comedy", "Crazy MC", "Demon", "Drama", "Dungeons",
  "Fantasy", "Game", "Genius MC", "Isekai", "Kuchikuchi", "Magic", "Martial Arts",
  "Murim", "Mystery", "Necromancer", "Overpowered", "Regression", "Reincarnation",
  "Revenge", "Romance", "School Life", "Sci-fi", "Shoujo", "Shounen", "System",
  "Tower", "Tragedy", "Villain", "Violence",
];

const STATUS_COLOR: Record<string, string> = {
  Ongoing: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Completed: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Hiatus: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Dropped: "text-red-400 bg-red-500/10 border-red-500/20",
  Axed: "text-red-400 bg-red-500/10 border-red-500/20",
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

function BrowseCard({ item }: { item: MFItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: bookmarks } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });
  const isBookmarked = bookmarks?.some((b) => b.provider === "mangafire" && b.seriesId === item.slug);
  const addBookmark = useAddBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });
  const removeBookmark = useRemoveBookmark({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }) } });

  function toggleBookmark(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast({ description: "Login to bookmark", variant: "destructive" }); return; }
    if (isBookmarked) removeBookmark.mutate({ provider: "mangafire", seriesId: item.slug });
    else addBookmark.mutate({ data: { provider: "mangafire", seriesId: item.slug, title: item.title, coverImage: item.coverUrl, type: item.type, status: item.status ?? "Ongoing" } });
  }

  const statusCls = STATUS_COLOR[item.status ?? ""] ?? "text-white/40 bg-white/[0.05] border-white/[0.08]";

  return (
    <Link href={`/series/${encodeURIComponent(item.slug)}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#13131f]" style={{ aspectRatio: "2/3" }}>
        {item.coverUrl ? (
          <img src={proxyImg(item.coverUrl)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#13131f]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {item.rating !== null && (
          <div className="absolute top-1.5 right-1.5 bg-black/75 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            ⭐ {item.rating.toFixed(1)}
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {item.latestChapter && (
            <span className="text-[9px] bg-white/[0.06] text-white/45 px-1.5 py-0.5 rounded font-medium">{item.latestChapter}</span>
          )}
          {item.status && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${statusCls}`}>{item.status}</span>
          )}
        </div>
        <button
          onClick={toggleBookmark}
          className={`mt-1.5 w-full py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
            isBookmarked
              ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
              : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:bg-white/[0.08]"
          }`}
        >
          <Bookmark className="w-2.5 h-2.5 inline mr-1" />
          {isBookmarked ? "Saved" : "Save"}
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

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let p = start; p <= end; p++) pages.push(p);
  return (
    <div className="flex items-center justify-center gap-1 pt-5 pb-2">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">‹</button>
      {pages.map((p) => (
        <button key={p} onClick={() => onPage(p)} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${p === page ? "bg-primary text-white" : "text-white/40 hover:text-white hover:bg-white/[0.06]"}`}>{p}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">›</button>
    </div>
  );
}

export default function BrowsePage() {
  const [showFilters, setShowFilters] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  const [sort, setSort] = useState("recently_updated");
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [genreSearch, setGenreSearch] = useState("");
  const [minChapters, setMinChapters] = useState("");

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MFItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(searchQ), 300);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    params.set("sort", sort);
    if (status !== "All") params.set("status", status.toLowerCase());
    if (type !== "All") params.set("type", type.toLowerCase());
    if (selectedGenres.size > 0) params.set("genres", Array.from(selectedGenres).join(","));
    if (minChapters) params.set("minChapters", minChapters);
    params.set("page", String(page));

    fetch(`${BASE}/api/mangafire/search?${params.toString()}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => { setItems(d.items ?? []); setTotalPages(d.totalPages ?? 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQ, sort, status, type, selectedGenres, minChapters, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  function toggleGenre(g: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
    setPage(1);
  }

  function applyFilters() {
    setPage(1);
    setShowFilters(false);
    fetchItems();
  }

  function toggleSection(key: string) {
    setOpenSection((prev) => prev === key ? null : key);
  }

  const filteredGenres = genreSearch
    ? ALL_GENRES.filter((g) => g.toLowerCase().includes(genreSearch.toLowerCase()))
    : ALL_GENRES;

  return (
    <div className="bg-[#07070d] min-h-screen max-w-2xl mx-auto px-4 pt-4 pb-20">
      <h1 className="text-lg font-black text-white mb-4">Browse Series</h1>

      {/* Search Bar */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={searchQ}
          onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
          placeholder="Search series..."
          className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40"
        />
      </div>

      {/* Filter Button */}
      <button
        onClick={() => setShowFilters(true)}
        className="flex items-center gap-2 w-full py-2.5 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/60 hover:text-white hover:border-white/20 transition-all mb-5"
      >
        <Filter className="w-4 h-4" />
        Filters
        {(status !== "All" || type !== "All" || selectedGenres.size > 0 || minChapters) && (
          <span className="ml-auto bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {[status !== "All" ? 1 : 0, type !== "All" ? 1 : 0, selectedGenres.size, minChapters ? 1 : 0].reduce((a, b) => a + b, 0)}
          </span>
        )}
      </button>

      {/* Results Grid */}
      <div className="grid grid-cols-2 gap-3">
        {loading
          ? Array.from({ length: 20 }).map((_, i) => <SkeletonBrowseCard key={i} />)
          : items.length === 0
            ? <div className="col-span-2 text-center py-16 text-white/30 text-sm">No results found</div>
            : items.map((item, i) => <BrowseCard key={item.slug || i} item={item} />)
        }
      </div>

      {!loading && items.length > 0 && (
        <Pagination page={page} totalPages={Math.max(totalPages, 1)} onPage={(p) => { setPage(p); window.scrollTo({ top: 0 }); }} />
      )}

      {/* Filter Drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="relative ml-auto w-full max-w-sm bg-[#0d0d18] h-full overflow-y-auto flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06] sticky top-0 bg-[#0d0d18] z-10">
              <h2 className="text-base font-black text-white">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="p-1.5 rounded-md text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 px-4 py-2">
              {/* Sort */}
              <FilterSection title="Latest Update" open={openSection === "sort"} onToggle={() => toggleSection("sort")}>
                <div className="space-y-1 mt-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSort(opt.value); setPage(1); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${sort === opt.value ? "bg-primary/20 text-primary font-semibold" : "text-white/60 hover:bg-white/[0.04] hover:text-white"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              {/* Status */}
              <FilterSection title="Status" open={openSection === "status"} onToggle={() => toggleSection("status")}>
                <div className="space-y-1.5 mt-1">
                  {STATUS_OPTIONS.map((s) => (
                    <label key={s} className="flex items-center gap-3 px-1 py-1 cursor-pointer group">
                      <div
                        onClick={() => { setStatus(s); setPage(1); }}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${status === s ? "bg-primary border-primary" : "border-white/25 group-hover:border-white/50"}`}
                      >
                        {status === s && <div className="w-2 h-2 rounded-sm bg-white" />}
                      </div>
                      <span className="text-sm text-white/70 group-hover:text-white transition-colors">{s}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>

              {/* Type */}
              <FilterSection title="Type" open={openSection === "type"} onToggle={() => toggleSection("type")}>
                <div className="space-y-1.5 mt-1">
                  {TYPE_OPTIONS.map((t) => (
                    <label key={t} className="flex items-center gap-3 px-1 py-1 cursor-pointer group">
                      <div
                        onClick={() => { setType(t); setPage(1); }}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${type === t ? "bg-primary border-primary" : "border-white/25 group-hover:border-white/50"}`}
                      >
                        {type === t && <div className="w-2 h-2 rounded-sm bg-white" />}
                      </div>
                      <span className="text-sm text-white/70 group-hover:text-white transition-colors">{t}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>

              {/* Genres */}
              <FilterSection title="Genres" open={openSection === "genres"} onToggle={() => toggleSection("genres")}>
                <div className="mt-2">
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                    <input
                      type="text"
                      value={genreSearch}
                      onChange={(e) => setGenreSearch(e.target.value)}
                      placeholder="Search genres..."
                      className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40"
                    />
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredGenres.map((g) => (
                      <label key={g} className="flex items-center gap-3 px-1 py-1 cursor-pointer group">
                        <div
                          onClick={() => toggleGenre(g)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${selectedGenres.has(g) ? "bg-primary border-primary" : "border-white/25 group-hover:border-white/50"}`}
                        >
                          {selectedGenres.has(g) && <div className="w-2 h-2 rounded-sm bg-white" />}
                        </div>
                        <span className="text-sm text-white/70 group-hover:text-white transition-colors">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </FilterSection>

              {/* Minimum Chapters */}
              <FilterSection title="Minimum Chapters" open={openSection === "minch"} onToggle={() => toggleSection("minch")}>
                <div className="mt-2">
                  <input
                    type="number"
                    value={minChapters}
                    onChange={(e) => { setMinChapters(e.target.value); setPage(1); }}
                    placeholder="e.g., 10"
                    min="0"
                    className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40"
                  />
                </div>
              </FilterSection>
            </div>

            <div className="px-4 py-4 border-t border-white/[0.06] sticky bottom-0 bg-[#0d0d18]">
              <button
                onClick={applyFilters}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-white text-sm font-black rounded-xl transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
