import {
  FrontpageManga,
  FrontpageSection,
  FrontpageSectionType,
  FrontpageInfo,
} from "@/types";

export interface FrontpageSectionConfig {
  id: string;
  title: string;
  type: FrontpageSectionType;
  supportsPagination: boolean;
  supportsTimeFilter: boolean;
  availableTimeFilters?: number[];
}

export interface FrontpageFetchOptions {
  page?: number;
  limit?: number;
  days?: number; // For time-filtered sections like trending
}

export abstract class BaseFrontpage {
  abstract getSourceId(): string;
  abstract getSourceName(): string;
  abstract getAvailableSections(): FrontpageSectionConfig[];

  abstract fetchSection(
    sectionId: string,
    options?: FrontpageFetchOptions
  ): Promise<FrontpageSection>;

  getInfo(): FrontpageInfo {
    return {
      sourceId: this.getSourceId(),
      sourceName: this.getSourceName(),
      availableSections: this.getAvailableSections().map((section) => ({
        id: section.id,
        title: section.title,
        type: section.type,
        supportsTimeFilter: section.supportsTimeFilter,
        availableTimeFilters: section.availableTimeFilters,
      })),
    };
  }

  protected mapToFrontpageManga(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any,
    baseUrl: string
  ): FrontpageManga {
    // Default implementation - can be overridden
    return {
      id: item.id || item.hash_id,
      title: item.title,
      url: `${baseUrl}/${item.slug || item.id}`,
      coverImage: item.coverImage || item.poster?.large || item.poster?.medium,
      latestChapter: item.latestChapter || item.latest_chapter,
      lastUpdated: item.lastUpdated,
      lastUpdatedTimestamp: item.lastUpdatedTimestamp,
      rating: item.rating || item.rated_avg,
      followers: item.followers?.toString() || item.follows_total?.toString(),
      type: item.type,
      status: item.status,
      synopsis: item.synopsis,
    };
  }
}
