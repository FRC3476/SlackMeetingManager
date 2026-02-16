/**
 * Converts HTML content (as returned by the Google Calendar API) into
 * Slack-compatible mrkdwn format.
 *
 * Handles common tags: <b>, <strong>, <i>, <em>, <br>, <a>, <p>, <ul>, <ol>, <li>
 * Strips all remaining unrecognised HTML tags.
 * Decodes common HTML entities.
 */

/**
 * Convert an HTML string to Slack mrkdwn.
 * Returns the original string unchanged if it contains no HTML.
 */
export function htmlToMrkdwn(html: string): string {
  if (!html) return html;

  let text = html;

  // Convert <br> / <br/> / <br /> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Convert <p>...</p> to double-newline-separated paragraphs
  text = text.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<\/p>/gi, '\n\n');

  // Convert links: <a href="url">text</a> -> placeholder to protect from tag stripping
  // We use \x00LINK_START and \x00LINK_END as temporary markers.
  text = text.replace(
    /<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    '\x00LINK_START$1|$2\x00LINK_END'
  );

  // Bold: <b>text</b> and <strong>text</strong> -> *text*
  text = text.replace(/<\/?(?:b|strong)(?:\s[^>]*)?>/gi, '*');

  // Italic: <i>text</i> and <em>text</em> -> _text_
  text = text.replace(/<\/?(?:i|em)(?:\s[^>]*)?>/gi, '_');

  // Strikethrough: <s>text</s>, <strike>text</strike>, <del>text</del> -> ~text~
  text = text.replace(/<\/?(?:s|strike|del)(?:\s[^>]*)?>/gi, '~');

  // Lists: convert <li> items to bullet points
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_match, content: string) => {
    return `\n• ${content.trim()}`;
  });
  text = text.replace(/<\/?(?:ul|ol)(?:\s[^>]*)?>/gi, '\n');

  // Headings: treat as bold text on its own line
  text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_match, content: string) => {
    return `\n*${content.trim()}*\n`;
  });

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Restore Slack link placeholders to actual angle-bracket syntax
  text = text.replace(/\x00LINK_START/g, '<');
  text = text.replace(/\x00LINK_END/g, '>');

  // Decode common HTML entities
  text = decodeHtmlEntities(text);

  // Clean up excessive whitespace: collapse 3+ newlines to 2, trim leading/trailing
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Decode common HTML entities to their plain-text equivalents.
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&laquo;': '«',
    '&raquo;': '»',
    '&bull;': '•',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  let result = text;
  for (const [entity, replacement] of Object.entries(entities)) {
    result = result.split(entity).join(replacement);
  }

  // Decode numeric entities (decimal &#123; and hex &#x1A;)
  result = result.replace(/&#(\d+);/g, (_match, dec: string) =>
    String.fromCharCode(parseInt(dec, 10))
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  return result;
}
