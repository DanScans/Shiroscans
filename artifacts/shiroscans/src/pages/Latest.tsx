import { useState } from "react";
import { SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetLatestManga, useGetMangaTags } from "@workspace/api-client-react";
import MangaCard, { MangaCardSkeleton } from "@/components/MangaCard";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROVIDERS = [
  { value: "mangadex", label: "MangaDex" },
  { value: "comix", label: "Comick" },
  { value: "asurascan", label: "AsuraScans" },
  { value: "weebcentral", label: "WeebCentral" },
  { value: "mangago", label: "Mangago" },
  { value: "mangakatana", label: "MangaKatana" },
  { value: "flamecomics", label: "FlameComics" },
  { value: "thunderscans", label: "Thunderscans" },
  { value: "reaperscans", label: "Reaper Scans" },
  { value: "vortex-scans", label: "Vortex Scans" },
  { value: "raven-scans", label: "Raven Scans" },
];

const TYPES = ["Manga", "Manhwa", "Manhua", "Novel"];
const STATUSES = ["Ongoing", "Completed", "Hiatus", "Cancelled"];

export default function LatestPage() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("mangadex");
  const [type, setType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [genre, setGenre] = useState<string | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);

  const { data, isLoading } = useGetLatestManga(
    { page, provider, type, status, genre },
    { query: { queryKey: ["latest", page, provider, type, status, genre] as const } },
  );

  const { data: tags } = useGetMangaTags();

  function clearFilters() {
    setType(undefined);
    setStatus(undefined);
    setGenre(undefined);
    setPage(1);
  }

  const hasFilters = type || status || genre;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="Latest Updates" accent />
        <div className="flex items-center gap-2 -mt-5">
          <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(1); }}>
            <SelectTrigger className="w-36 bg-card border-white/10 text-sm" data-testid="select-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="border-white/10 bg-card gap-2" data-testid="button-filter">
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {hasFilters && <span className="bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">!</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-card border-white/10 w-80">
              <SheetHeader>
                <SheetTitle>Filter Manga</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                <div>
                  <p className="text-sm font-medium text-[#9CA3AF] mb-2">Type</p>
                  <div className="flex flex-wrap gap-2">
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => { setType(type === t ? undefined : t); setPage(1); }}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${type === t ? "bg-primary text-white" : "bg-white/5 text-[#9CA3AF] hover:bg-white/10"}`}
                        data-testid={`button-type-${t.toLowerCase()}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#9CA3AF] mb-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => { setStatus(status === s ? undefined : s); setPage(1); }}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${status === s ? "bg-primary text-white" : "bg-white/5 text-[#9CA3AF] hover:bg-white/10"}`}
                        data-testid={`button-status-${s.toLowerCase()}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {tags && (
                  <div>
                    <p className="text-sm font-medium text-[#9CA3AF] mb-2">Genre</p>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                      {tags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setGenre(genre === t.name ? undefined : t.name); setPage(1); }}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${genre === t.name ? "bg-primary text-white" : "bg-white/5 text-[#9CA3AF] hover:bg-white/10"}`}
                          data-testid={`button-genre-${t.id}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-destructive">
                    <X className="w-4 h-4 mr-1" /> Clear Filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {isLoading
          ? Array.from({ length: 24 }).map((_, i) => <MangaCardSkeleton key={i} />)
          : data?.items?.map((item) => <MangaCard key={`${item.provider}-${item.id}`} {...item} />)}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => setPage((p) => p - 1)}
          className="border-white/10 bg-card"
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-[#9CA3AF]">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.hasMore || isLoading}
          onClick={() => setPage((p) => p + 1)}
          className="border-white/10 bg-card"
          data-testid="button-next-page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
