"use client";

interface ParsedTOCItem {
  name: string;
  fullName: string;
  sources: string[];
  subsections: { name: string; fullName: string }[];
}

interface CalligraphyHeroBannerProps {
  subject: string;
  activeChapterFilter: string;
  parsedTOC: ParsedTOCItem[];
  isDark: boolean;
  formatDisplayName: (name: string) => string;
}

export default function CalligraphyHeroBanner({
  subject,
  activeChapterFilter,
  parsedTOC,
  isDark,
  formatDisplayName,
}: CalligraphyHeroBannerProps) {
  const subjectDisplayName = formatDisplayName(subject);
  const activeChapterName = activeChapterFilter === "All"
    ? "All Restructured Notes"
    : activeChapterFilter;

  let activeSources: string[] = [];
  if (activeChapterFilter !== "All") {
    const matched = parsedTOC.find(t => t.name === activeChapterFilter);
    if (matched && matched.sources) {
      activeSources = matched.sources;
    }
  } else {
    activeSources = Array.from(new Set(parsedTOC.flatMap(t => t.sources || [])));
  }

  return (
    <div
      className="w-full relative overflow-hidden shrink-0 border-b border-[#c5a880]/30 select-none animate-fade-in"
      style={{
        background: isDark
          ? "linear-gradient(135deg, #0d0c0e 0%, #151316 40%, #1d1b22 100%)"
          : "linear-gradient(135deg, #f7f5f0 0%, #f0ede4 45%, #e6e0d2 100%)",
      }}
    >
      <div
        className="absolute inset-0 bg-black/[0.04] dark:bg-black/[0.42] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 10% 20%, rgba(0,0,0,0.02) 0%, transparent 80%)",
        }}
      />
      <div className="absolute top-[-50px] right-[-30px] w-[180px] h-[180px] rounded-full blur-[60px] opacity-15 dark:opacity-20 pointer-events-none bg-[#c5a880]" />
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.15\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#c5a880]/60 dark:bg-[#c5a880]/40" />
      <div className="pl-12 pr-16 py-9 flex flex-col justify-center min-h-[145px] relative z-10 animate-fade-in">
        <div className="flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-widest text-[#c5a880] dark:text-[#c5a880]/80 font-mono mb-2">
          <span>Library</span>
          <span className="opacity-50 font-serif">/</span>
          <span>{subjectDisplayName}</span>
          {activeChapterFilter !== "All" && (
            <>
              <span className="opacity-50 font-serif">/</span>
              <span className="text-[#a8906c] dark:text-[#c5a880]/90 font-sans tracking-wide">Chaptered notes</span>
            </>
          )}
        </div>
        <h2
          className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-800 dark:text-stone-100 flex items-baseline gap-2 mb-2"
          style={{
            fontFamily: '"EB Garamond", Georgia, serif',
            letterSpacing: '-0.01em',
            textShadow: isDark ? '0 2px 10px rgba(0,0,0,0.5)' : 'none'
          }}
        >
          {activeChapterName}
        </h2>
        {activeSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 font-sans tracking-wide">
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#c5a880]/60 animate-pulse" />
              Sources: {activeSources.join(", ")}
            </span>
          </div>
        )}
      </div>
      <div
        className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-12 rounded-full border-2 border-dashed border-red-500/70 dark:border-red-500/50 bg-red-500/[0.04] text-red-500 text-base font-serif font-extrabold select-none rotate-12 scale-95 shadow-inner z-10"
        style={{
          fontFamily: 'Georgia, serif',
          textShadow: '0 0 2px rgba(239, 68, 68, 0.1)',
          boxShadow: 'inset 0 0 4px rgba(239, 68, 68, 0.1)'
        }}
        title="Calligraphy Seal of Study"
      >
        書
      </div>
    </div>
  );
}
