import { Link } from "wouter";
import { MessageSquare } from "lucide-react";
import logoPath from "@assets/file_0000000028ec71f5bea7a576cf17a0af_1781485787252.png";

const FOOTER_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
  { label: "DMCA", href: "#" },
  { label: "Status", href: "#" },
  { label: "Report Issue", href: "#" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-[#07070d] mt-6 mb-14 md:mb-0">
      <div className="max-w-2xl mx-auto px-5 py-10 text-center">
        <Link href="/" className="inline-flex items-center gap-3 mb-5 group">
          <img src={logoPath} alt="ShiroScans" className="w-10 h-10 rounded-full" />
          <span className="text-xl font-extrabold text-primary tracking-tight group-hover:text-primary/80 transition-colors">
            ShiroScans
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 mb-6">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-white/35 hover:text-white/65 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <a
          href="https://discord.gg"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-bold px-6 py-2.5 rounded-full transition-colors mb-8 shadow-lg shadow-[#5865F2]/20"
        >
          <MessageSquare className="w-4 h-4" />
          Join Discord
        </a>

        <div className="border-t border-white/[0.06] pt-5 space-y-1">
          <p className="text-xs text-white/20">© {year} ShiroScans. All rights reserved.</p>
          <p className="text-xs text-white/15">Powered by ShiroScans</p>
        </div>
      </div>
    </footer>
  );
}
