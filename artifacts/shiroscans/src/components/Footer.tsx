import { Link } from "wouter";
import { BookOpen, MessageSquare } from "lucide-react";
import logoPath from "@assets/file_0000000028ec71f5bea7a576cf17a0af_1781485787252.png";

const footerLinks = {
  Browse: [
    { label: "Latest Updates", href: "/latest" },
    { label: "Popular", href: "/popular" },
    { label: "Browse All", href: "/search" },
  ],
  Account: [
    { label: "Login", href: "/login" },
    { label: "Register", href: "/register" },
    { label: "Bookmarks", href: "/bookmarks" },
    { label: "History", href: "/history" },
  ],
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-[#080810] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-3 group w-fit">
              <img src={logoPath} alt="ShiroScans" className="w-8 h-8 rounded-full" />
              <span className="text-base font-extrabold text-white group-hover:text-primary transition-colors tracking-tight">
                ShiroScans
              </span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed max-w-xs mb-4">
              Your premier destination for manga, manhwa, and manhua. Discover and read the latest chapters from thousands of series.
            </p>
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Join our Discord
            </a>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/50 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">© {year} ShiroScans. All rights reserved.</p>
          <div className="flex items-center gap-1.5 text-xs text-white/25">
            <BookOpen className="w-3.5 h-3.5" />
            Read manga online
          </div>
        </div>
      </div>
    </footer>
  );
}
