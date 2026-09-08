// ============================================
// Panvas — Production Marketing Asset Pipeline
// Converts updated application screenshots from 'public/Application SS updated/'
// into optimized, ultra high-fidelity WebP assets in 'public/marketing-assets/'
// ============================================

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC_DIR = './public/Application SS updated';
const OUT_DIR = './public/marketing-assets';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function convertAsset(srcFilename, outFilename, options = {}) {
  const srcPath = path.join(SRC_DIR, srcFilename);
  const outPath = path.join(OUT_DIR, outFilename);

  if (!fs.existsSync(srcPath)) {
    console.error(`Source file not found: ${srcPath}`);
    return;
  }

  let pipeline = sharp(srcPath);

  if (options.modulate) {
    pipeline = pipeline.modulate(options.modulate);
  }
  if (options.sharpen) {
    pipeline = pipeline.sharpen();
  }

  await pipeline
    .webp({ quality: 96, effort: 6, lossless: false })
    .toFile(outPath);

  const stats = fs.statSync(outPath);
  console.log(`✓ Converted ${srcFilename} -> ${outFilename} (${Math.round(stats.size / 1024)} KB)`);
}

async function run() {
  console.log('Processing real updated application screenshots from "public/Application SS updated/"...\n');

  // 1. Hero Research Workspace
  await convertAsset('HeroResearchWorkSpace.png', 'hero-workspace-clean.webp');

  // 2. Cloud Sync & Settings (with redacted email and clean sidebar)
  await convertAsset('CloudSync.png', 'cloud-sync-clean.webp');

  // 3. Handwriting into Text (with authentic handwriting + clean sidebar)
  await convertAsset('Turn_Handwriting_into_text.png', 'handwriting-ocr-clean.webp');

  // 4. Customize Notebook Modal
  await convertAsset('CustomizeYourNotebook.png', 'notebook-customize-clean.webp');

  // 5. Notebook Style & Templates
  await convertAsset('NotebookStyle_Template.png', 'notebooks-templates-clean.webp');

  // 6. Preference Stationery & Ruler
  await convertAsset('PreferenceStationary.png', 'ink-stationery-ruler-clean.webp', { sharpen: true });

  // 7. Ink Gestures Panel
  await convertAsset('InkGestures.png', 'ink-gestures-clean.webp', { sharpen: true });

  // 8. PDF Export & Workbench Menu
  await convertAsset('printNotes_ExportPDF.png', 'pdf-workbench-clean.webp', { sharpen: true });

  // 9. Spatial Canvas Widgets (Sticky Notes & Voice Notes)
  // Let's create a combined spatial canvas asset or use StickyNotes directly
  await convertAsset('StickyNotes.png', 'spatial-canvas-clean.webp', { sharpen: true });

  // Also save Voice Notes asset
  await convertAsset('Voice Notes.png', 'voice-notes-clean.webp', { sharpen: true });

  console.log('\nAll updated marketing assets successfully deployed to public/marketing-assets/ !');
}

run().catch((err) => {
  console.error('Error during asset processing:', err);
  process.exit(1);
});
