export function getFontFamily(f: string): string {
  switch (f) {
    case "garamond": return '"EB Garamond", Georgia, serif';
    case "caveat": return '"Caveat", cursive';
    case "architect": return '"Architects Daughter", cursive';
    case "cinzel": return '"Cinzel", serif';
    case "georgia": return 'Georgia, serif';
    case "sans": return 'system-ui, -apple-system, sans-serif';
    default: return 'Georgia, serif';
  }
}
