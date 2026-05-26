const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "u",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code"
]);

const VOID_TAGS = new Set(["br"]);
const TAG_REGEX = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function sanitizeReviewHtml(input: string): string {
  if (!input) return "";

  let output = "";
  let cursor = 0;
  const openStack: string[] = [];

  TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_REGEX.exec(input)) !== null) {
    const [raw, name] = match;
    const start = match.index;
    if (start > cursor) output += escapeHtml(input.slice(cursor, start));
    cursor = start + raw.length;

    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;

    const isClosing = raw.startsWith("</");
    if (VOID_TAGS.has(tag)) {
      if (!isClosing) output += `<${tag}>`;
      continue;
    }

    if (isClosing) {
      const indexInStack = openStack.lastIndexOf(tag);
      if (indexInStack === -1) continue;
      while (openStack.length - 1 > indexInStack) {
        const dangling = openStack.pop();
        if (dangling) output += `</${dangling}>`;
      }
      openStack.pop();
      output += `</${tag}>`;
    } else {
      openStack.push(tag);
      output += `<${tag}>`;
    }
  }

  if (cursor < input.length) output += escapeHtml(input.slice(cursor));
  while (openStack.length) {
    const dangling = openStack.pop();
    if (dangling) output += `</${dangling}>`;
  }
  return output;
}

export function reviewHtmlToPlainText(input: string): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(TAG_REGEX, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function plainTextToReviewHtml(input: string): string {
  if (!input) return "";
  const escaped = escapeHtml(input);
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, "<br>"))
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
  return paragraphs;
}
