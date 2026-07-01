const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SOURCE_DIRS = [path.join(ROOT, 'app'), path.join(ROOT, 'src')];
const WARN_KB = 300;
const ERROR_KB = 1024;
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const STRICT = process.argv.includes('--strict') || process.env.AUDIT_ASSETS_STRICT === '1';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function sourceText() {
  return SOURCE_DIRS
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => walk(dir))
    .filter((file) => ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(file).toLowerCase()))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

function pngSize(buffer) {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpgSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function imageSize(file) {
  const buffer = fs.readFileSync(file);
  return pngSize(buffer) || jpgSize(buffer) || { width: '?', height: '?' };
}

const code = sourceText();

const rows = walk(ASSETS_DIR)
  .filter((file) => IMAGE_EXTS.has(path.extname(file).toLowerCase()))
  .map((file) => {
    const stat = fs.statSync(file);
    const size = imageSize(file);
    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    const basename = path.basename(file);
    return {
      file: relative,
      kb: Math.round((stat.size / 1024) * 10) / 10,
      referenced: code.includes(relative) || code.includes(basename),
      ...size,
    };
  })
  .sort((a, b) => b.kb - a.kb);

const oversized = rows.filter((row) => row.kb > WARN_KB);
const severe = rows.filter((row) => row.kb > ERROR_KB);
const severeReferenced = severe.filter((row) => row.referenced);

console.table(rows.slice(0, 40));

if (oversized.length) {
  console.warn(`\n${oversized.length} image asset(s) are above ${WARN_KB}KB.`);
  oversized.forEach((row) => {
    console.warn(`- ${row.file}: ${row.kb}KB (${row.width}x${row.height})`);
  });
}

if (severe.length) {
  console.error(`\n${severe.length} image asset(s) are above ${ERROR_KB}KB and must be optimized or removed before release.`);
  if (STRICT && severeReferenced.length) {
    console.error(`${severeReferenced.length} severe asset(s) appear to be referenced by app/src.`);
    process.exitCode = 1;
  }
}
