import { cleanInlineMarkdown } from "./cleaner";

export function convertMarkdownToHtml(md: string): string {
  const blocks = md.replace(/\n\s*---\s*\n/g, "\n---\n").split("\n\n");
  let html = "";
  blocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed) return;
    if (trimmed === "---") { html += "<hr/>"; return; }
    if (trimmed.startsWith("|")) {
      const rows = trimmed.split("\n").map(r => r.trim()).filter(r => r.startsWith("|"));
      if (rows.length >= 2) {
        const parsedRows = rows.map(r => r.split("|").slice(1, -1).map(c => c.trim()));
        const headers = parsedRows[0];
        const hasSeparator = rows[1].includes("-");
        const bodyRows = hasSeparator ? parsedRows.slice(2) : parsedRows.slice(1);
        html += "<table><thead><tr>";
        headers.forEach(h => html += `<th>${cleanInlineMarkdown(h)}</th>`);
        html += "</tr></thead><tbody>";
        bodyRows.forEach(row => { html += "<tr>"; row.forEach(cell => html += `<td>${cleanInlineMarkdown(cell)}</td>`); html += "</tr>"; });
        html += "</tbody></table>";
        return;
      }
    }
    const lines = trimmed.split("\n");
    const isList = lines.every(l => /^[-*•]\s/.test(l.trim()));
    if (isList) {
      html += "<ul>";
      lines.forEach(l => html += `<li>${cleanInlineMarkdown(l.replace(/^[-*•]\s+/, "").trim())}</li>`);
      html += "</ul>"; return;
    }
    const firstLine = lines[0].trim();
    if (firstLine.startsWith("# Subject:")) { html += `<h1>Subject: ${cleanInlineMarkdown(firstLine.replace("# Subject:", "").trim())}</h1>`; return; }
    if (firstLine.startsWith("# ")) { html += `<h1>${cleanInlineMarkdown(firstLine.replace("# ", "").trim())}</h1>`; return; }
    if (firstLine.startsWith("## Topic:")) { html += `<h2>${cleanInlineMarkdown(firstLine.replace("## Topic:", "").trim())}</h2>`; return; }
    if (firstLine.startsWith("## ")) { html += `<h2>${cleanInlineMarkdown(firstLine.replace("## ", "").trim())}</h2>`; return; }
    if (firstLine.startsWith("### ")) { html += `<h3>${cleanInlineMarkdown(firstLine.replace("### ", "").trim())}</h3>`; return; }
    if (firstLine.startsWith("* **Sources**:")) { const match = firstLine.match(/\* \*\*Sources\*\*:\s*(.*)/); html += `<div class="sources">Source Material: ${cleanInlineMarkdown(match ? match[1].trim() : "Manual Entry")}</div>`; return; }
    if (firstLine.startsWith("> ")) {
      const content = lines.map(l => l.replace(/^>\s?/, "").trim()).join("\n");
      html += `<blockquote>${cleanInlineMarkdown(content)}</blockquote>`; return;
    }
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/);
    if (imgMatch) { html += `<div style="text-align:center;margin:1.5rem 0;"><img src="${imgMatch[2]}" alt="${imgMatch[1]}" style="max-width:100%;height:auto;border-radius:0.75rem;box-shadow:0 4px 12px rgba(0,0,0,0.15);" loading="lazy" /></div>`; return; }
    const ytMatch = trimmed.match(/^@\[youtube\]\((.+?)\)$/) || trimmed.match(/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) { html += `<div style="text-align:center;margin:1.5rem 0;"><div style="position:relative;max-width:42rem;aspect-ratio:16/9;margin:0 auto;border-radius:0.75rem;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);"><iframe src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen title="YouTube embed"></iframe></div></div>`; return; }
    html += `<p>${cleanInlineMarkdown(trimmed)}</p>`;
  });
  return html;
}

export function downloadDocx(subject: string, markdown: string): void {
  const cssStyles = `
    body { font-family: 'Georgia', serif; line-height: 1.6; color: #333333; margin: 40px; }
    h1 { font-size: 28px; color: #111111; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { font-size: 20px; color: #4f46e5; border-left: 4px solid #4f46e5; padding-left: 10px; margin-top: 30px; margin-bottom: 15px; }
    h3 { font-size: 16px; color: #1a1a1a; margin-top: 20px; margin-bottom: 10px; }
    p { font-size: 12px; text-align: justify; margin-bottom: 15px; }
    ul, ol { margin-bottom: 15px; padding-left: 20px; }
    li { font-size: 12px; margin-bottom: 5px; }
    blockquote { font-style: italic; background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 15px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #cccccc; padding: 8px 10px; font-size: 11px; }
    th { background-color: #f3f4f6; font-weight: bold; }
    .sources { font-size: 10px; color: #666666; font-style: italic; margin-bottom: 20px; }
  `;
  const htmlBody = convertMarkdownToHtml(markdown);
  const docxContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><title>${subject}</title>
    <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
    <style>${cssStyles}</style></head>
    <body><h1>${subject} Notes</h1>${htmlBody}</body></html>`;
  const blob = new Blob([docxContent], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Subject_${subject.replace(/\s+/g, "_")}_Notes.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(subject: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Subject_${subject.replace(/\s+/g, "_")}_Notes.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printPdf(subject: string, markdown: string, activeFont: string, activeFontFamily: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;
  const htmlBody = convertMarkdownToHtml(markdown);
  doc.open();
  doc.write(`
    <html><head><title>${subject}</title>
    <style>
      @page { size: letter; margin: 1in; }
      body { background: white !important; color: #111111 !important; padding: 0 !important; margin: 0 !important; font-family: ${activeFontFamily} !important; line-height: 1.6 !important; font-size: 11pt !important; }
      h1 { font-size: 24pt !important; color: #000000 !important; margin-top: 0 !important; margin-bottom: 12pt !important; border-bottom: 2px solid #e2e8f0 !important; padding-bottom: 8pt !important; page-break-after: avoid; font-family: system-ui, -apple-system, sans-serif !important; font-weight: bold !important; }
      h2 { font-size: 16pt !important; color: #4f46e5 !important; border-left: 4px solid #4f46e5 !important; padding-left: 8pt !important; margin-top: 24pt !important; margin-bottom: 8pt !important; page-break-after: avoid; font-family: system-ui, -apple-system, sans-serif !important; font-weight: bold !important; }
      h3 { font-size: 13pt !important; color: #1a1a1a !important; margin-top: 18pt !important; margin-bottom: 6pt !important; page-break-after: avoid; font-family: system-ui, -apple-system, sans-serif !important; font-weight: bold !important; }
      p { margin-top: 0 !important; margin-bottom: 10pt !important; text-align: justify !important; }
      ul, ol { margin-top: 0 !important; margin-bottom: 12pt !important; padding-left: 20pt !important; }
      li { margin-bottom: 4pt !important; text-align: justify !important; }
      blockquote { font-style: italic !important; background-color: #fffbeb !important; border-left: 4px solid #f59e0b !important; padding: 10pt 14pt !important; margin: 14pt 0 !important; border-radius: 4px !important; color: #451a03 !important; }
      table { width: 100% !important; border-collapse: collapse !important; margin: 16pt 0 !important; page-break-inside: avoid !important; }
      th, td { border: 0.5pt solid #cccccc !important; padding: 6pt 8pt !important; font-size: 10pt !important; }
      th { background-color: #f3f4f6 !important; font-weight: bold !important; color: #000000 !important; }
      .sources { font-size: 9pt !important; color: #666666 !important; font-style: italic !important; margin-bottom: 16pt !important; font-family: system-ui, -apple-system, sans-serif !important; }
      tr, img, li { page-break-inside: avoid !important; }
    </style></head>
    <body><h1>${subject} Notes</h1>${htmlBody}</body></html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 200);
}
