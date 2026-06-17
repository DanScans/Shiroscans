import { FrontpageInfo } from "@/types";
import { BaseFrontpage } from "./base";
import { ComixFrontpage } from "./comix";

const frontpages: BaseFrontpage[] = [
  new ComixFrontpage(),
];

export function getFrontpage(sourceId: string): BaseFrontpage | null {
  return (
    frontpages.find(
      (fp) => fp.getSourceId().toLowerCase() === sourceId.toLowerCase()
    ) || null
  );
}

export function getAllFrontpages(): BaseFrontpage[] {
  return frontpages;
}

export function getAllFrontpageInfo(): FrontpageInfo[] {
  return frontpages.map((fp) => fp.getInfo());
}

export function getFrontpageSourceIds(): string[] {
  return frontpages.map((fp) => fp.getSourceId());
}

export { BaseFrontpage } from "./base";
export { ComixFrontpage } from "./comix";
