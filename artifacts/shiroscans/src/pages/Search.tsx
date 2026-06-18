import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, X, Loader2, Flame, BookOpen } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  if (url.includes("uploads.mangadex.org")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface SearchItem {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
  status?: string | null;
  genres?: string[];
}

interface SuggestionItem {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
}

function ResultCard({ item }: { item: SearchItem }) {
  const [imgError, setImgError] = useState(false);
  const isFlame = item.provider === "flamecomics";
  const href = isFlame
    ? `/flame/series/${encodeURIComponent(item.id)}`
    : `/series/${item.provider}/${encodeURIComponent(item.id)}`;

  const typeColor =
    item.type === "Manhwa" ? "text-orange-400 bg-orange-500/10 border-orange-500/20" :
    item.type === "Manhua" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
    "text-primary/80 bg-primary/10 border-primary/20";

  return (
    <Link href={href} className="group flex gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.06]">
      <div className="w-16 h-22 rounded-lg overflow-hidden shrink-0 bg-[#13131f]" style={{ height: "88px" }}>
        {item.coverImage && !imgError ? (
          <img
            src={proxyImage(item.coverImage)}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isFlame ? <Flame className="w-5 h-5 text-orange-400/30" /> : <BookOpen className="w-5 h-5 text-primary/20" />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug mb-1.5">
          {item.title}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.type && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${typeColor}`}>{item.type}</span>
          )}
          {item.status && (
            <span className="text-[10px] text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.06]">{item.status}</span>
          )}
        </div>
        {item.genres && item.genres.length > 0 && (
          <p className="text-[11px] text-white/25 mt-1 line-clamp-1">{item.genres.slice(0, 3).join(" · ")}</p>
        )}
      </div>
    </Link>
  );
}

export default function SearchPage() {
  const params = new URLSearchParams(window.location.search);
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suggestDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    Promise.all([
      fetch(`${BASE}/api/manga/search?q=${encodeURIComponent(q)}&provider=mangadex`).then((r) => r.ok ? r.json() : { items: [] }),
      fetch(`${BASE}/api/flamecomics/search?q=${encodeURIComponent(q)}`).then((r) => r.ok ? r.json() : { results: [] }),
    ]).then(([mangaData, flameData]) => {
      const manga = (mangaData.items ?? []) as SearchItem[];
      const flame = (flameData.results ?? []).map((item: any) => ({
        id: item.id,
        title: item.title,
        coverImage: item.coverUrl,
        provider: "flamecomics",
        type: "Manhwa",
        status: item.status,
        genres: item.genres ?? [],
      })) as SearchItem[];
      const seen = new Set<string>();
      const merged: SearchItem[] = [];
      for (const item of [...flame, ...manga]) {
        const key = item.title.toLowerCase().replace(/\s+/g, "");
        if (!seen.has(key)) { seen.add(key); merged.push(item); }
      }
      setResults(merged);
    }).catch(() => setResults([])).finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    if (initialQ) { runSearch(initialQ); }
    inputRef.current?.focus();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setShowSuggestions(true);

    clearTimeout(debounceRef.current);
    clearTimeout(suggestDebounce.current);

    if (!val.trim()) {
      setSuggestions([]);
      setResults([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);
    suggestDebounce.current = setTimeout(() => {
      Promise.all([
        fetch(`${BASE}/api/manga/suggestions?q=${encodeURIComponent(val.trim())}`).then((r) => r.ok ? r.json() : { items: [] }).catch(() => ({ items: [] })),
        fetch(`${BASE}/api/flamecomics/search?q=${encodeURIComponent(val.trim())}`).then((r) => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
      ]).then(([mdxSuggest, flameSuggest]) => {
        const mdx = (mdxSuggest.items ?? []).slice(0, 4) as SuggestionItem[];
        const flame = (flameSuggest.results ?? []).slice(0, 4).map((item: any) => ({
          id: item.id,
          title: item.title,
          coverImage: item.coverUrl,
          provider: "flamecomics",
          type: "Manhwa",
        })) as SuggestionItem[];
        const seen = new Set<string>();
        const merged: SuggestionItem[] = [];
        for (const item of [...flame, ...mdx]) {
          const key = item.title.toLowerCase().replace(/\s+/g, "");
          if (!seen.has(key)) { seen.add(key); merged.push(item); }
        }
        setSuggestions(merged.slice(0, 7));
      }).finally(() => setSuggestLoading(false));
    }, 250);

    debounceRef.current = setTimeout(() => {
      runSearch(val.trim());
      setShowSuggestions(false);
    }, 700);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    clearTimeout(suggestDebounce.current);
    setShowSuggestions(false);
    runSearch(query.trim());
    if (query.trim()) setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Search bar */}
        <form onSubmit={handleSubmit} className="relative mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onFocus={() => query && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Search manga, manhwa, series..."
              autoComplete="off"
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-2xl pl-11 pr-11 py-3.5 text-white placeholder-white/25 focus:outline-none focus:border-primary/40 focus:bg-[#1a1a2e]/60 text-sm transition-all"
              data-testid="input-search"
            />
            {query && (
              <button type="button" onClick={clearSearch} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && query.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#13131f] border border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden">
              {suggestLoading && suggestions.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-white/40 text-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching...
                </div>
              ) : suggestions.length > 0 ? (
                <div>
                  {suggestions.map((item) => {
                    const isFlame = item.provider === "flamecomics";
                    const href = isFlame
                      ? `/flame/series/${encodeURIComponent(item.id)}`
                      : `/series/${item.provider}/${encodeURIComponent(item.id)}`;
                    return (
                      <Link
                        key={`${item.provider}-${item.id}`}
                        href={href}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <div className="w-8 h-10 rounded-md overflow-hidden shrink-0 bg-[#1a1a2e]">
                          {item.coverImage ? (
                            <img src={proxyImage(item.coverImage)} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 font-semibold line-clamp-1">{item.title}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">{item.type ?? "—"}</p>
                        </div>
                        {isFlame && <Flame className="w-3 h-3 text-orange-400/60 shrink-0" />}
                      </Link>
                    );
                  })}
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-primary/80 hover:text-primary hover:bg-white/[0.04] transition-colors font-semibold"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <SearchIcon className="w-3.5 h-3.5" /> See all results for "{query}"
                  </button>
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-white/30">No suggestions found</div>
              )}
            </div>
          )}
        </form>

        {/* Results */}
        {searching ? (
          <div className="flex items-center justify-center gap-2 py-16 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Searching...</span>
          </div>
        ) : results.length > 0 ? (
          <>
            <p className="text-xs text-white/35 mb-3 px-1">{results.length} results for <span className="text-white/60">"{query}"</span></p>
            <div className="space-y-1">
              {results.map((item) => <ResultCard key={`${item.provider}-${item.id}`} item={item} />)}
            </div>
          </>
        ) : query && !searching ? (
          <div className="text-center py-16">
            <SearchIcon className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No results for "{query}"</p>
            <p className="text-white/20 text-xs mt-1">Try different keywords</p>
          </div>
        ) : (
          <div className="text-center py-16">
            <SearchIcon className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/35 text-sm">Search across manga & manhwa</p>
          </div>
        )}
      </div>
    </div>
  );
}
