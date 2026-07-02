const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');

const DELETE_FILES = [
  'assets/images/team-up-friends.png',
  'assets/images/team-up-online.png',
  'assets/images/private_table_lobby_card_1781003231457.png',
  'assets/images/team_up_friends_lobby_card_1781003267800.png',
  'assets/images/team_up_online_lobby_card_1781003249632.png',
  'assets/images/two_player_lobby_card_1781003195014.png',
  'assets/images/four_player_lobby_card_1781003212625.png',
  'assets/images/partial-react-logo.png',
  'assets/images/react-logo.png',
  'assets/images/react-logo@2x.png',
  'assets/images/react-logo@3x.png',
  'assets/images/bg-homepage-2.png',
];

const OPTIMIZE_TARGETS = [
  { dir: 'assets/crowns', maxWidth: 512, palette: true },
  { file: 'assets/images/bg-homepage.png', maxWidth: 960, palette: true },
  { file: 'assets/images/icon.png', maxWidth: 768, palette: true },
  { file: 'assets/images/android-icon-foreground.png', maxWidth: 432, palette: true },
  { file: 'assets/images/avatar-frame.png', maxWidth: 512, palette: true },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function bytes(file) {
  return fs.statSync(file).size;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

async function optimizePng(file, options) {
  const before = bytes(file);
  const metadata = await sharp(file).metadata();
  const maxWidth = options.maxWidth ?? metadata.width;
  const resize =
    metadata.width && maxWidth && metadata.width > maxWidth
      ? { width: maxWidth, withoutEnlargement: true }
      : null;
  const tempFile = `${file}.tmp`;

  let pipeline = sharp(file);
  if (resize) pipeline = pipeline.resize(resize);
  pipeline = pipeline.png({
    compressionLevel: 9,
    adaptiveFiltering: true,
    palette: options.palette,
    quality: options.palette ? 88 : 100,
    effort: 10,
  });

  await pipeline.toFile(tempFile);
  const after = bytes(tempFile);
  if (after < before) {
    fs.renameSync(tempFile, file);
    return { file: rel(file), before, after };
  }
  fs.rmSync(tempFile);
  return { file: rel(file), before, after: before };
}

async function main() {
  for (const relativePath of DELETE_FILES) {
    const file = path.join(ROOT, relativePath);
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      console.log(`removed ${relativePath}`);
    }
  }

  const files = new Map();
  for (const target of OPTIMIZE_TARGETS) {
    if (target.dir) {
      for (const file of walk(path.join(ROOT, target.dir))) {
        if (path.extname(file).toLowerCase() === '.png') files.set(file, target);
      }
    } else if (target.file) {
      const file = path.join(ROOT, target.file);
      if (fs.existsSync(file)) files.set(file, target);
    }
  }

  let saved = 0;
  for (const [file, options] of files) {
    const result = await optimizePng(file, options);
    saved += result.before - result.after;
    console.log(
      `${result.file}: ${(result.before / 1024).toFixed(1)}KB -> ${(result.after / 1024).toFixed(1)}KB`,
    );
  }

  console.log(`saved ${(saved / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
