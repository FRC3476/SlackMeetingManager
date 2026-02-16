import { htmlToMrkdwn } from './htmlToMrkdwn';

describe('htmlToMrkdwn', () => {
  it('returns empty string for empty input', () => {
    expect(htmlToMrkdwn('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(htmlToMrkdwn('Hello world')).toBe('Hello world');
  });

  // --- Inline formatting ---

  it('converts <i> tags to Slack italic', () => {
    expect(htmlToMrkdwn('<i>Weekly check-in for student leads</i>')).toBe(
      '_Weekly check-in for student leads_'
    );
  });

  it('converts <em> tags to Slack italic', () => {
    expect(htmlToMrkdwn('<em>emphasis</em>')).toBe('_emphasis_');
  });

  it('converts <b> tags to Slack bold', () => {
    expect(htmlToMrkdwn('<b>important</b>')).toBe('*important*');
  });

  it('converts <strong> tags to Slack bold', () => {
    expect(htmlToMrkdwn('<strong>very important</strong>')).toBe('*very important*');
  });

  it('converts <s> tags to Slack strikethrough', () => {
    expect(htmlToMrkdwn('<s>removed</s>')).toBe('~removed~');
  });

  it('converts <del> tags to Slack strikethrough', () => {
    expect(htmlToMrkdwn('<del>deleted</del>')).toBe('~deleted~');
  });

  // --- Line breaks and paragraphs ---

  it('converts <br> to newline', () => {
    expect(htmlToMrkdwn('line one<br>line two')).toBe('line one\nline two');
  });

  it('converts <br/> and <br /> to newline', () => {
    expect(htmlToMrkdwn('a<br/>b<br />c')).toBe('a\nb\nc');
  });

  it('converts <p> tags to newline-separated paragraphs', () => {
    expect(htmlToMrkdwn('<p>First paragraph</p><p>Second paragraph</p>')).toBe(
      'First paragraph\n\nSecond paragraph'
    );
  });

  // --- Links ---

  it('converts <a href="...">text</a> to Slack link format', () => {
    expect(htmlToMrkdwn('<a href="https://example.com">Click here</a>')).toBe(
      '<https://example.com|Click here>'
    );
  });

  it('handles links with extra attributes', () => {
    expect(
      htmlToMrkdwn('<a href="https://example.com" target="_blank">Link</a>')
    ).toBe('<https://example.com|Link>');
  });

  // --- Lists ---

  it('converts unordered list items to bullet points', () => {
    const html = '<ul><li>Item one</li><li>Item two</li></ul>';
    const result = htmlToMrkdwn(html);
    expect(result).toContain('• Item one');
    expect(result).toContain('• Item two');
  });

  it('converts ordered list items to bullet points', () => {
    const html = '<ol><li>First</li><li>Second</li></ol>';
    const result = htmlToMrkdwn(html);
    expect(result).toContain('• First');
    expect(result).toContain('• Second');
  });

  // --- HTML entities ---

  it('decodes &amp; entity', () => {
    expect(htmlToMrkdwn('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('decodes &lt; and &gt; entities', () => {
    expect(htmlToMrkdwn('1 &lt; 2 &gt; 0')).toBe('1 < 2 > 0');
  });

  it('decodes &nbsp; entity', () => {
    expect(htmlToMrkdwn('hello&nbsp;world')).toBe('hello world');
  });

  it('decodes &quot; and &#39; entities', () => {
    expect(htmlToMrkdwn('&quot;quoted&#39;s&quot;')).toBe('"quoted\'s"');
  });

  it('decodes numeric decimal entities', () => {
    expect(htmlToMrkdwn('&#65;&#66;&#67;')).toBe('ABC');
  });

  it('decodes numeric hex entities', () => {
    expect(htmlToMrkdwn('&#x41;&#x42;&#x43;')).toBe('ABC');
  });

  // --- Stripping unknown tags ---

  it('strips unrecognised HTML tags', () => {
    expect(htmlToMrkdwn('<span class="x">text</span>')).toBe('text');
  });

  it('strips <div> tags', () => {
    expect(htmlToMrkdwn('<div>content</div>')).toBe('content');
  });

  // --- Headings ---

  it('converts heading tags to bold text', () => {
    expect(htmlToMrkdwn('<h1>Title</h1>')).toBe('*Title*');
  });

  // --- Mixed / nested content ---

  it('handles mixed bold and italic', () => {
    expect(htmlToMrkdwn('<b>bold</b> and <i>italic</i>')).toBe(
      '*bold* and _italic_'
    );
  });

  it('handles a realistic Google Calendar description', () => {
    const html =
      '<i>Weekly check-in for student leads</i><br><br>Please bring your progress reports.';
    const result = htmlToMrkdwn(html);
    expect(result).toBe(
      '_Weekly check-in for student leads_\n\nPlease bring your progress reports.'
    );
  });

  it('handles complex HTML with multiple features', () => {
    const html =
      '<b>Meeting Agenda</b><br>' +
      '<ul><li>Review goals</li><li>Discuss blockers</li></ul>' +
      '<p>Contact <a href="mailto:lead@example.com">the lead</a> for details.</p>';
    const result = htmlToMrkdwn(html);
    expect(result).toContain('*Meeting Agenda*');
    expect(result).toContain('• Review goals');
    expect(result).toContain('• Discuss blockers');
    expect(result).toContain('<mailto:lead@example.com|the lead>');
  });

  // --- Whitespace cleanup ---

  it('collapses excessive newlines to at most two', () => {
    expect(htmlToMrkdwn('a<br><br><br><br>b')).toBe('a\n\nb');
  });

  it('trims leading and trailing whitespace', () => {
    expect(htmlToMrkdwn('  <p>hello</p>  ')).toBe('hello');
  });
});
