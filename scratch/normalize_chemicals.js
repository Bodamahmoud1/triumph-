const fs = require('fs');

const file = 'data/chemicals.json';
const products = JSON.parse(fs.readFileSync(file, 'utf8'));

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripTags(value) {
  return decodeEntities(String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function matchOne(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeEntities(match[1]) : '';
}

function matchAll(html, pattern) {
  return Array.from(html.matchAll(pattern), (match) => decodeEntities(match[1]));
}

function segmentBetween(html, start, end) {
  const startIndex = html.indexOf(start);
  if (startIndex === -1) return '';
  const contentStart = startIndex + start.length;
  const endIndex = end ? html.indexOf(end, contentStart) : -1;
  return html.slice(contentStart, endIndex === -1 ? html.length : endIndex);
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/\s([a-zA-Z:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeEntities(match[2]);
  }
  return attrs;
}

function parseList(block) {
  return matchAll(block, /<li[^>]*>([\s\S]*?)<\/li>/g).map(stripTags);
}

function parseDoseTable(block) {
  const table = block.match(/<table[^>]*class="([^"]*dose-table[^"]*)"[^>]*>([\s\S]*?)<\/table>/);
  if (!table) return null;
  const headers = matchAll(table[2], /<th[^>]*>([\s\S]*?)<\/th>/g).map(stripTags);
  const rows = Array.from(table[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g))
    .map((rowMatch) => matchAll(rowMatch[1], /<td[^>]*>([\s\S]*?)<\/td>/g).map(stripTags))
    .filter((cells) => cells.length);
  return { headers, rows };
}

function parseTechnical(block) {
  const rows = [];
  for (const rowMatch of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = matchAll(rowMatch[1], /<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells.length) {
      const rawCells = matchAll(rowMatch[1], /<td[^>]*>([\s\S]*?)<\/td>/g).map(stripTags);
      if (rawCells.length) rows.push(rawCells);
      continue;
    }
  }

  const pairedRows = Array.from(block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g))
    .map((rowMatch) => matchAll(rowMatch[1], /<td[^>]*>([\s\S]*?)<\/td>/g).map(stripTags))
    .filter((cells) => cells.length);

  const result = {
    appearance: '',
    ph: '',
    density: '',
    other: {},
    rows: [],
    note: matchOne(block, /<p[^>]*class="[^"]*tech-note[^"]*"[^>]*>([\s\S]*?)<\/p>/)
  };

  for (const cells of pairedRows) {
    const row = [];
    for (let i = 0; i < cells.length; i += 2) {
      const label = cells[i] || '';
      const value = cells[i + 1] || '';
      if (!label && !value) continue;
      row.push({ label, value });
      if (/الشكل/.test(label)) result.appearance = value;
      else if (/pH|الـ pH/.test(label)) result.ph = value;
      else if (/الكثافة/.test(label)) result.density = value;
      else if (label) result.other[label] = value;
    }
    if (row.length) result.rows.push(row);
  }

  return result;
}

function parseContentSections(cardContent) {
  const sections = [];
  const regex = /<div class="sec-head head-theme">([\s\S]*?)<\/div>([\s\S]*?)(?=<div class="sec-head head-theme">|$)/g;
  for (const match of cardContent.matchAll(regex)) {
    const title = stripTags(match[1]);
    const body = match[2];
    const paragraphs = matchAll(body, /<p[^>]*>([\s\S]*?)<\/p>/g).map(stripTags);
    const listItems = parseList(body);
    sections.push({
      title,
      paragraphs,
      items: listItems
    });
  }
  return sections;
}

function parseUsage(usageBlock) {
  const title = stripTags(matchOne(usageBlock, /<div[^>]*class="[^"]*sec-head head-theme[^"]*"[^>]*>([\s\S]*?)<\/div>/));
  const afterTitle = usageBlock.replace(/^<div[^>]*class="[^"]*sec-head head-theme[^"]*"[^>]*>[\s\S]*?<\/div>/, '');
  const blocks = [];
  let dosage = '';

  const tokenRegex = /<(p|ul|table)\b[^>]*>[\s\S]*?<\/\1>/g;
  for (const match of afterTitle.matchAll(tokenRegex)) {
    const raw = match[0];
    const tag = match[1];
    if (tag === 'p') {
      const openTag = raw.match(/^<p\b[^>]*>/)?.[0] || '<p>';
      const attrs = parseAttributes(openTag);
      const text = stripTags(raw);
      const block = {
        kind: attrs.class && attrs.class.includes('note-head') ? 'note' : 'paragraph',
        className: attrs.class || '',
        style: attrs.style || '',
        text
      };
      blocks.push(block);
      if (/جرعة|Dose|dose|مل\s*\/\s*كجم|مل\/كجم/.test(text) || (attrs.class || '').includes('dosage-line')) {
        dosage = dosage ? `${dosage} ${text}` : text;
      }
    } else if (tag === 'ul') {
      const openTag = raw.match(/^<ul\b[^>]*>/)?.[0] || '<ul>';
      const attrs = parseAttributes(openTag);
      blocks.push({
        kind: 'list',
        className: attrs.class || '',
        style: attrs.style || '',
        items: parseList(raw)
      });
    } else if (tag === 'table') {
      const table = parseDoseTable(raw);
      if (table) {
        blocks.push({ kind: 'doseTable', ...table });
        const rowText = table.rows.map((row) => row.join(': ')).join(' | ');
        dosage = dosage ? `${dosage} ${rowText}` : rowText;
      }
    }
  }

  return {
    title,
    description: blocks.filter((block) => block.kind === 'paragraph').map((block) => block.text).join(' '),
    dosage,
    blocks
  };
}

function normalizeProduct(product) {
  const html = product.raw_content || '';
  const type = matchOne(html, /<span class="prod-type-tag tag-theme">([\s\S]*?)<\/span>/);
  const cardContent = segmentBetween(html, '<div class="card-content">', '</div><div class="card-icon-box"></div>');
  const contentSections = parseContentSections(cardContent);
  const usageBlock = segmentBetween(html, '</div><div class="card-icon-box"></div></div>', '</div><div class="tech-section">');
  const techBlock = segmentBetween(html, '<div class="tech-section">', '</div><div class="card-safe safe-body-theme">');
  const safety = matchOne(html, /<p class="card-safe-text">([\s\S]*?)<\/p><\/div>$/);

  const byTitle = (pattern) => contentSections.find((section) => pattern.test(section.title));
  const descriptionSection = byTitle(/إيه هي المادة/);
  const howSection = byTitle(/إزاي/);
  const featuresSection = byTitle(/المميزات/);
  const applicationSection = contentSections.find((section) => /بيصلح|استخدام|استخدامات|أفضل/.test(section.title));

  const normalized = {
    id: product.id || '',
    theme: product.theme || '',
    name: product.name || matchOne(html, /<span class="card-prod-name">([\s\S]*?)<\/span>/),
    code: product.code || matchOne(html, /<span class="card-prod-code">([\s\S]*?)<\/span>/),
    type,
    description: descriptionSection ? descriptionSection.paragraphs.join(' ') : '',
    howItWorks: howSection ? howSection.paragraphs.join(' ') : '',
    features: featuresSection ? featuresSection.items.slice() : [],
    applications: applicationSection ? applicationSection.items.slice() : [],
    contentSections,
    usage: parseUsage(usageBlock),
    technical: parseTechnical(techBlock),
    safety,
    missingFields: []
  };

  for (const [key, value] of [
    ['type', normalized.type],
    ['description', normalized.description],
    ['howItWorks', normalized.howItWorks],
    ['features', normalized.features],
    ['applications', normalized.applications],
    ['usage.description', normalized.usage.description],
    ['usage.dosage', normalized.usage.dosage],
    ['technical.appearance', normalized.technical.appearance],
    ['technical.ph', normalized.technical.ph],
    ['technical.density', normalized.technical.density],
    ['safety', normalized.safety]
  ]) {
    if (Array.isArray(value) ? value.length === 0 : !value) normalized.missingFields.push(key);
  }

  return normalized;
}

const normalized = products.map(normalizeProduct);
fs.writeFileSync(file, JSON.stringify(normalized, null, 2) + '\n', 'utf8');

const report = normalized.map((product) => ({
  id: product.id,
  missingFields: product.missingFields
}));
fs.writeFileSync('scratch/chemical-normalization-report.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
