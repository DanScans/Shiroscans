import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  viewAllHref?: string;
  accent?: boolean;
}

export default function SectionHeader({ title, viewAllHref, accent }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        {accent && <div className="w-1 h-6 bg-primary rounded-full" />}
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}
