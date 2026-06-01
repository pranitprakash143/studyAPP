export function cleanAiMarkdownArtifacts(md: string): string {
  let result = md;
  const lines = result.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^#{1,4}\s/.test(trimmed)) continue;
    if (/^#\s+Subject:/i.test(trimmed)) continue;
    lines[i] = lines[i]
      .replace(/(?<!\w)#(?![\w#])/g, "")
      .replace(/(?<!\w)#{2,}(?!\w)/g, "");
  }
  result = lines.join("\n");
  const boldOpen = result.match(/\*\*/g);
  if (boldOpen && boldOpen.length % 2 !== 0) {
    const lastIdx = result.lastIndexOf("**");
    result = result.slice(0, lastIdx) + result.slice(lastIdx + 2);
  }
  result = result.replace(/ \* (?=[a-zA-Z])/g, " ");
  result = result.replace(/ \*$/gm, "");
  result = result.replace(/`/g, "");
  result = result.replace(/~~/g, "");
  result = result.replace(/<\/?br\s*\/?>/gi, "");
  return result;
}

export function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}
