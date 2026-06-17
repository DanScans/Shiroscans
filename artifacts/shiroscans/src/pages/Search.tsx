import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon } from "lucide-react";
import { useSearchManga } from "@workspace/api-client-react";
import MangaCard, { MangaCardSkeleton } from "@/components/MangaCard";
import SectionHeader from "@/components/SectionHeader";

export default function SearchPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [submitted, setSubmitted] = useState(initialQ);

  const { data, isLoading } = useSearchManga(
    { q: submitted },
    { query: { enabled: !!submitted, queryKey: ["search", submitted] as const } },
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <SectionHeader title="Search" accent />

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for manga, manhwa, manhua..."
            className="w-full bg-card border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-[#9CA3AF] focus:outline-none focus:border-primary/50 text-base transition-colors"
            data-testid="input-search"
            autoFocus
          />
        </div>
      </form>

      {submitted && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => <MangaCardSkeleton key={i} />)}
            </div>
          ) : !data?.items?.length ? (
            <div className="text-center py-20">
              <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-[#9CA3AF] text-lg">No results for "{submitted}"</p>
              <p className="text-[#9CA3AF]/60 text-sm mt-1">Try different keywords or check your spelling</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#9CA3AF] mb-4">{data.items.length} results for "{submitted}"</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {data.items.map((item) => (
                  <MangaCard key={`${item.provider}-${item.id}`} {...item} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!submitted && (
        <div className="text-center py-20">
          <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-[#9CA3AF]">Type something to search</p>
        </div>
      )}
    </div>
  );
}
