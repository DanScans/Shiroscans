import { useState } from "react";
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetPopularManga, useGetMangaTags } from "@workspace/api-client-react";
import MangaCard, { MangaCardSkeleton } from "@/components/MangaCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROVIDERS = [
  { value: "mangadex", label: "MangaDex" },
  { value: "asurascan", label: "AsuraScans" },
];

const TYPE_TABS = [
  { value: undefined as string | undefined, label: "All", emoji: "📚" },
  { value: "Manga", label: "Manga", emoji: "🇯🇵" },
  { value: "Manhwa", label: "Manhwa", emoji: "🇰🇷" },
  { value: "Manhua", label: "Manhua", emoji: "🇨🇳" },
  { value: "Webtoon", label: "Webtoon", emoji: "📱" },
];

const STATUSES = ["Ongoing", "Completed", "Hiatus", "Cancelled"];

export default function PopularPage() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("mangadex");
  const [type, setType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [genre, setGenre] = useState<string | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);

  const { data, isLoading } = useGetPopularManga(
    { page, provider, type, status, genre },
    { query: { queryKey: ["popular", page, provider, type, status, genre] as const } },
  );

  const { data: tags } = useGetMangaTags();

  function clearFilters() {
    setStatus(undefined);
    setGenre(undefined);
    setPage(1);
  }

  const hasFilters = status || genre;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Popular</h1>
            <p className="text-sm text-white/40 mt-0.5">Most followed series across all sources</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(1); }}>
              <SelectTrigger className="w-36 bg-[#111118] border-white/10 text-sm" data-testid="select-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#111118] border-white/10">
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="border-white/10 bg-[#111118] gap-2" data-testid="button-filter">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {hasFilters && <span className="bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">!</span>}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-[#0d0d14] border-white/10 w-80">
                <SheetHeader>
                  <SheetTitle className="text-white">Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => { setStatus(status === s ? undefined : s); setPage(1); }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${status === s ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/8"}`}
                          data-testid={`button-status-${s.toLowerCase()}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  {tags && (
                    <div>
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Genre</p>
                      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
                        {tags.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => { setGenre(genre === t.name ? undefined : t.name); setPage(1); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${genre === t.name ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/8"}`}
                            data-testid={`button-genre-${t.id}`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
                      <X className="w-4 h-4 mr-1" /> Clear Filters
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => { setType(tab.value); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                type === tab.value
                  ? "bg-primary text-white shadow-lg shadow-primary/30 scale-105"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/8"
              }`}
              data-testid={`button-type-${tab.label.toLowerCase()}`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {isLoading
          ? Array.from({ length: 24 }).map((_, i) => <MangaCardSkeleton key={i} />)
          : data?.items?.map((item) => <MangaCard key={`${item.provider}-${item.id}`} {...item} />)}
      </div>

      {!isLoading && data?.items?.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white/30 text-lg font-medium">No results found</p>
          <p className="text-white/20 text-sm mt-1">Try a different filter or source</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => setPage((p) => p - 1)}
          className="border-white/10 bg-[#111118] hover:bg-white/8"
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-white/40 px-2">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.hasMore || isLoading}
          onClick={() => setPage((p) => p + 1)}
          className="border-white/10 bg-[#111118] hover:bg-white/8"
          data-testid="button-next-page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
