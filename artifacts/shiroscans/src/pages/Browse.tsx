import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { BookOpen, Search, TrendingUp, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

function MangaCard({ item }: { item: WCSeries }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link href={`/manga/series/${item.id}`} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#13131f] shadow-lg" style={{ aspectRatio: "2/3" }}>
        {item.coverUrl && !imgError ? (
          <img
            src={proxyImg(item.coverUrl)}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0d2e22] to-[#1a1a2e] flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {item.type && item.type !== "Manga" && (
          <div className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-primary/80 text-white px-1.5 py-0.5 rounded">
            {item.type}
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className="text-xs font-bold text-white/90 group-hover:text-primary transition-colors duration-150 line-clamp-2 leading-snug">
          {item.title}
        </h3>
        {item.genres && item.genres.length > 0 && (
          <p className="text-[10px] text-white/30 truncate mt-0.5">{item.genres.slice(0, 2).join(", ")}</p>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div>
      <Skeleton className="rounded-xl bg-[#13131f] w-full" style={{ aspectRatio: "2/3" }} />
      <Skeleton className="h-3 w-3/4 mt-1.5 bg-[#13131f] rounded" />
      <Skeleton className="h-3 w-1/2 mt-1 bg-[#13131f] rounded" />
    </div>
  );
}

type Tab = "popular" | "latest" | "search";

export default function BrowsePage() {
  const [tab, setTab] = useState<Tab>("popular");
  const [popularItems, setPopularItems] = useState<WCSeries[]>([]);
  const [latestItems, setLatestItems] = useState<WCSeries[]>([]);
  const [searchItems, setSearchItems] = useState<WCSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const loadHome = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/weebcentral/home`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPopularItems(data.popular ?? data.featured ?? []);
      setLatestItems(data.latest ?? data.featured ?? []);
    } catch {
      setPopularItems([]);
      setLatestItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHome(); }, [loadHome]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSubmittedQuery(q);
    setTab("search");
    setSearchLoading(true);
    fetch(`${BASE}/api/weebcentral/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setSearchItems(d.items ?? []))
      .catch(() => setSearchItems([]))
      .finally(() => setSearchLoading(false));
  }

  const displayedItems = tab === "popular" ? popularItems : tab === "latest" ? latestItems : searchItems;
  const isLoading = tab === "search" ? searchLoading : loading;

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10">
        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search WeebCentral..."
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all duration-150"
          >
            Search
          </button>
        </form>

        <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1 mb-5">
          {([
            { id: "popular" as Tab, label: "Popular", icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { id: "latest" as Tab, label: "Latest", icon: <Clock className="w-3.5 h-3.5" /> },
            ...(submittedQuery ? [{ id: "search" as Tab, label: `"${submittedQuery.slice(0, 12)}${submittedQuery.length > 12 ? "…" : ""}"`, icon: <Search className="w-3.5 h-3.5" /> }] : []),
          ]).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-md text-xs font-bold transition-all duration-150 ${tab === id ? "bg-primary text-white shadow" : "text-white/40 hover:text-white/70"}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {tab === "search" && submittedQuery && !searchLoading && (
          <p className="text-xs text-white/40 mb-3">
            {searchItems.length} results for <span className="text-white/70">"{submittedQuery}"</span>
          </p>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
            : displayedItems.length === 0
              ? (
                <div className="col-span-3 sm:col-span-4 text-center py-16 text-white/30 text-sm">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  {tab === "search" ? `No results for "${submittedQuery}"` : "No content available"}
                </div>
              )
              : displayedItems.map((item) => <MangaCard key={item.id} item={item} />)
          }
        </div>
      </div>
    </div>
  );
}
