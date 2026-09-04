/**
 * A deliberately small Markdown subset, parsed to a typed AST.
 *
 * Why not a Markdown library?
 *
 *  1. The same body text has to render as React on the website *and* as plain
 *     text inside Remotion video scenes. Parsing once to an AST gives both
 *     surfaces the same content, which is the core constraint of this project.
 *  2. STEPWIRE adds one syntax that no Markdown parser knows about: the
 *     citation marker `[^1]`, which binds a sentence in the body to an entry in
 *     the article's `sources` array. Validation depends on it.
 *  3. Article bodies are authored in-repo and reviewed in pull requests, so the
 *     input is trusted and the supported subset can stay narrow.
 *
 * Supported: paragraphs, `###`/`####` headings, `-`/`1.` lists, `>` quotes,
 * `---` rules; inline `**bold**`, `*italic*`, `` `code` ``, `[text](url)` and
 * `[^n]` citations.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'citation'; index: number };

export type Block =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'heading'; level: 3 | 4; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'blockquote'; children: InlineNode[] }
  | { type: 'rule' }
  /**
   * A picture in the flow of the prose: `![alt](images/…)` alone on a line.
   * It must name a `media` entry of the article — that is where the credit
   * lives — and `parseArticle` fills `caption` and `credit` from it. In the
   * video the picture rides with the paragraph that follows it.
   */
  | { type: 'image'; src: string; alt: string; caption?: string; credit?: string };

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[\^(\d+)\])|(\[[^\]]+\]\([^)\s]+\))/;

/** Parses a single line/run of text into inline nodes. */
export function parseInline(input: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = input;

  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match || match.index === undefined) {
      nodes.push({ type: 'text', value: rest });
      break;
    }

    if (match.index > 0) {
      nodes.push({ type: 'text', value: rest.slice(0, match.index) });
    }

    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push({ type: 'strong', children: parseInline(token.slice(2, -2)) });
    } else if (token.startsWith('`')) {
      nodes.push({ type: 'code', value: token.slice(1, -1) });
    } else if (token.startsWith('[^')) {
      nodes.push({ type: 'citation', index: Number(match[5]) });
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](');
      nodes.push({
        type: 'link',
        href: token.slice(split + 2, -1),
        children: parseInline(token.slice(1, split)),
      });
    } else {
      nodes.push({ type: 'em', children: parseInline(token.slice(1, -1)) });
    }

    rest = rest.slice(match.index + token.length);
  }

  return nodes.filter((node) => node.type !== 'text' || node.value.length > 0);
}

const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+\.\s+/;

/**
 * CJK characters: Han, Hiragana, Katakana, CJK punctuation and fullwidth forms.
 */
const CJK = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF]/;

/**
 * Rejoins the lines of a soft-wrapped paragraph.
 *
 * A line break inside a paragraph is a formatting artifact of the source file,
 * not content. In Latin text it stands for a word space, so the lines are
 * joined with one. In Japanese there is no space between clauses, and inserting
 * one puts a visible gap after every 、 that happened to fall at the end of a
 * line in the .mdx — a defect that only appears once the prose is Japanese.
 *
 * So a space is added only where both sides of the break are non-CJK.
 */
export function joinWrappedLines(lines: string[]): string {
  return lines
    .reduce((joined, line, index) => {
      if (index === 0) return line;
      const left = joined.at(-1) ?? '';
      const right = line.charAt(0);
      const separator = CJK.test(left) || CJK.test(right) ? '' : ' ';
      return `${joined}${separator}${line}`;
    }, '')
    .trim();
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let index = 0;

  const flushParagraph = (buffer: string[]) => {
    if (buffer.length === 0) return;
    blocks.push({ type: 'paragraph', children: parseInline(joinWrappedLines(buffer)) });
    buffer.length = 0;
  };

  const paragraph: string[] = [];

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushParagraph(paragraph);
      index += 1;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph(paragraph);
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (image) {
      flushParagraph(paragraph);
      blocks.push({ type: 'image', src: image[2]!, alt: image[1]!.trim() });
      index += 1;
      continue;
    }

    const heading = /^(#{3,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph(paragraph);
      blocks.push({
        type: 'heading',
        level: heading[1]!.length === 3 ? 3 : 4,
        children: parseInline(heading[2]!.trim()),
      });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph(paragraph);
      const quote: string[] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('> ')) {
        quote.push((lines[index] ?? '').trim().slice(2));
        index += 1;
      }
      blocks.push({ type: 'blockquote', children: parseInline(joinWrappedLines(quote)) });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      flushParagraph(paragraph);
      const ordered = ORDERED_ITEM.test(line);
      const items: InlineNode[][] = [];
      while (index < lines.length && LIST_ITEM.test(lines[index] ?? '')) {
        const item = LIST_ITEM.exec(lines[index] ?? '');
        items.push(parseInline((item?.[1] ?? '').trim()));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    paragraph.push(trimmed);
    index += 1;
  }

  flushParagraph(paragraph);
  return blocks;
}

function inlineChildren(node: InlineNode): InlineNode[] {
  return node.type === 'strong' || node.type === 'em' || node.type === 'link'
    ? node.children
    : [];
}

function blockInlines(block: Block): InlineNode[] {
  // A picture has no words; its caption is metadata, not prose.
  if (block.type === 'image') return [];
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'blockquote':
      return block.children;
    case 'list':
      return block.items.flat();
    case 'rule':
      return [];
  }
}

/** Every citation index referenced by the body, in document order. */
export function collectCitations(blocks: Block[]): number[] {
  const found: number[] = [];
  const walk = (nodes: InlineNode[]) => {
    for (const node of nodes) {
      if (node.type === 'citation') found.push(node.index);
      walk(inlineChildren(node));
    }
  };
  blocks.forEach((block) => walk(blockInlines(block)));
  return found;
}

function inlineToText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value;
        case 'code':
          return node.value;
        // Citation markers are a web-reading affordance; they are noise in a
        // video subtitle, so they are dropped from the plain-text projection.
        case 'citation':
          return '';
        default:
          return inlineToText(node.children);
      }
    })
    .join('');
}

/**
 * Flattens an AST to plain text. This is what the video compositions consume,
 * which is why the video never needs its own copy of the article body.
 */
export function toPlainText(blocks: Block[]): string {
  return blocks
    .map((block) => (block.type === 'rule' ? '' : inlineToText(blockInlines(block))))
    .filter((text) => text.trim().length > 0)
    .join('\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Splits plain text into sentences — used to paginate video scene text. */
export function toSentences(text: string): string[] {
  return text
    // Japanese has no space after its full stop, so a rule that requires
    // whitespace after the terminator never fires on it — which quietly made
    // every Japanese paragraph a single "sentence", and every video card an
    // unsplittable block. `。！？` therefore break on the character itself,
    // taking any closing bracket or quote with them; Latin terminators still
    // need the following space, or `BPM 300.5` and `Dr. Love` split mid-number
    // and mid-name.
    .split(/(?<=[。！？][」』）】"'])|(?<=[。！？])(?![」』）】"'])|(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
