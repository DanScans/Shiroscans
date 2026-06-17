import { Link } from "wouter";
import { BookmarkCheck, Heart, BookOpen, Calendar, User as UserIcon } from "lucide-react";
import { useGetProfile, getGetProfileQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SectionHeader from "@/components/SectionHeader";
import logoPath from "@assets/file_0000000028ec71f5bea7a576cf17a0af_1781485787252.png";

export default function ProfilePage() {
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: profile, isLoading } = useGetProfile({ query: { enabled: !!user, queryKey: getGetProfileQueryKey() } });

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <UserIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Sign in to view your profile</h2>
        <Button asChild className="bg-primary hover:bg-primary/90 mt-4"><Link href="/login">Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <SectionHeader title="Profile" accent />

      {isLoading ? (
        <div className="bg-card rounded-2xl border border-white/[0.08] p-8">
          <div className="flex items-center gap-6 mb-8">
            <Skeleton className="w-24 h-24 rounded-full bg-secondary" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-48 bg-secondary" />
              <Skeleton className="h-4 w-32 bg-secondary" />
            </div>
          </div>
        </div>
      ) : profile ? (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-white/[0.08] p-6 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
              <Avatar className="w-20 h-20 shrink-0">
                <AvatarImage src={profile.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                  {profile.username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-white" data-testid="text-profile-username">{profile.username}</h2>
                <p className="text-sm text-[#9CA3AF] mt-0.5">{profile.email}</p>
                {profile.bio && <p className="text-sm text-[#9CA3AF] mt-2">{profile.bio}</p>}
                <div className="flex items-center gap-2 mt-2 text-xs text-[#9CA3AF]">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="border-white/10 shrink-0">
                <Link href="/settings">Edit Profile</Link>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/[0.08]">
              <Link href="/bookmarks" className="text-center p-4 rounded-xl bg-secondary hover:bg-white/10 transition-colors group">
                <BookmarkCheck className="w-6 h-6 text-primary mx-auto mb-1.5" />
                <div className="text-2xl font-bold text-white" data-testid="text-stat-bookmarks">{profile.stats.bookmarksCount}</div>
                <div className="text-xs text-[#9CA3AF] group-hover:text-white transition-colors">Bookmarks</div>
              </Link>
              <Link href="/favourites" className="text-center p-4 rounded-xl bg-secondary hover:bg-white/10 transition-colors group">
                <Heart className="w-6 h-6 text-red-400 mx-auto mb-1.5" />
                <div className="text-2xl font-bold text-white" data-testid="text-stat-favourites">{profile.stats.favouritesCount}</div>
                <div className="text-xs text-[#9CA3AF] group-hover:text-white transition-colors">Favourites</div>
              </Link>
              <Link href="/history" className="text-center p-4 rounded-xl bg-secondary hover:bg-white/10 transition-colors group">
                <BookOpen className="w-6 h-6 text-blue-400 mx-auto mb-1.5" />
                <div className="text-2xl font-bold text-white" data-testid="text-stat-chapters">{profile.stats.chaptersRead}</div>
                <div className="text-xs text-[#9CA3AF] group-hover:text-white transition-colors">Chapters Read</div>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
