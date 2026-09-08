// ============================================
// Panvas — Marketing Asset Generator
// Processes real application screenshots from public/Application SS/
// into clean, privacy-safe, high-fidelity marketing assets
// ============================================

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC_DIR = './public/Application SS';
const OUT_DIR = './public/marketing-assets';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Reusable SVG Sidebar Fragment
function generateCleanSidebar(width = 350, height = 800, activeCategory = 'Distributed Systems', activeNotebook = 'Raft Consensus', activePage = 'Leader-Election.pnv') {
  return `
    <!-- Full sidebar replacement: bg is #f5f2eb -->
    <rect x="0" y="140" width="${width}" height="${height}" fill="#f5f2eb" />

    <!-- WORKSPACES Header -->
    <text x="28" y="170" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#78716c" letter-spacing="0.05em">WORKSPACES</text>
    <text x="316" y="170" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" fill="#78716c">+</text>

    <!-- 1. Active Workspace (Expanded Card) -->
    <rect x="16" y="185" width="318" height="235" rx="10" fill="#e7e2d7" />

    <!-- Workspace Title -->
    <path d="M 32 205 L 38 211 L 44 205" fill="none" stroke="#44403c" stroke-width="2" stroke-linecap="round" />
    <rect x="52" y="196" width="22" height="22" rx="5" fill="#1e293b" />
    <text x="59" y="212" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">D</text>
    <text x="82" y="212" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#1c1917">${activeCategory}</text>

    <!-- Notebook 1 -->
    <path d="M 48 238 L 54 244 L 60 238" fill="none" stroke="#78716c" stroke-width="1.8" stroke-linecap="round" />
    <rect x="68" y="230" width="18" height="18" rx="3" fill="#a8a29e" />
    <text x="94" y="244" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#292524">${activeNotebook}</text>
    <text x="306" y="244" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#78716c">2</text>

    <!-- Section 1 -->
    <path d="M 66 270 L 72 276 L 78 270" fill="none" stroke="#a8a29e" stroke-width="1.5" stroke-linecap="round" />
    <text x="86" y="274" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="500" fill="#57534e">Section 1: Architecture</text>
    <text x="306" y="274" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#78716c">2</text>

    <!-- Active Page 1 -->
    <rect x="80" y="290" width="240" height="34" rx="6" fill="#d6cebe" />
    <text x="94" y="312" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#1c1917">📄  ${activePage}</text>

    <!-- Page 2 (PDF) -->
    <text x="94" y="348" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#57534e">📑  raft-protocol.pdf</text>

    <!-- Other Collapsed Workspaces -->
    <!-- 2. Machine Learning -->
    <path d="M 32 445 L 38 450 L 32 455" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" />
    <rect x="48" y="438" width="22" height="22" rx="5" fill="#8b5cf6" />
    <text x="54" y="454" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">M</text>
    <text x="78" y="454" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#44403c">Machine Learning &amp; AI</text>

    <!-- 3. Algorithms & Data Structures -->
    <path d="M 32 490 L 38 495 L 32 500" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" />
    <rect x="48" y="483" width="22" height="22" rx="5" fill="#3b82f6" />
    <text x="55" y="499" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">A</text>
    <text x="78" y="499" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#44403c">Algorithms &amp; DSA</text>

    <!-- 4. Operating Systems -->
    <path d="M 32 535 L 38 540 L 32 545" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" />
    <rect x="48" y="528" width="22" height="22" rx="5" fill="#10b981" />
    <text x="54" y="544" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">O</text>
    <text x="78" y="544" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#44403c">Operating Systems</text>

    <!-- 5. Linear Algebra -->
    <path d="M 32 580 L 38 585 L 32 590" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" />
    <rect x="48" y="573" width="22" height="22" rx="5" fill="#f59e0b" />
    <text x="56" y="589" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">L</text>
    <text x="78" y="589" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#44403c">Linear Algebra</text>

    <!-- 6. Computer Networks -->
    <path d="M 32 625 L 38 630 L 32 635" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" />
    <rect x="48" y="618" width="22" height="22" rx="5" fill="#ec4899" />
    <text x="55" y="634" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">C</text>
    <text x="78" y="634" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#44403c">Computer Networks</text>

    <!-- 7. Research Notes -->
    <path d="M 32 670 L 38 675 L 32 680" fill="none" stroke="#78716c" stroke-width="2" stroke-linecap="round" />
    <rect x="48" y="663" width="22" height="22" rx="5" fill="#6366f1" />
    <text x="55" y="679" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">R</text>
    <text x="78" y="679" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#44403c">Research Notes</text>

    <!-- Clear any remnants down to y=940 -->
    <rect x="0" y="710" width="${width}" height="230" fill="#f5f2eb" />
  `;
}

async function run() {
  console.log('Starting Panvas marketing assets generation...\n');

  // -------------------------------------------------------------
  // 1. cloud-sync-clean.webp
  // Redact personal email, sanitize sidebar workspace names & breadcrumbs
  // -------------------------------------------------------------
  console.log('1. Generating cloud-sync-clean.webp...');
  {
    const base = sharp(path.join(SRC_DIR, 'CloudSync.png'));
    const meta = await base.metadata();

    const overlaySvg = Buffer.from(`
      <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <!-- 1. Breadcrumb Replacement (top bar) -->
        <rect x="180" y="10" width="500" height="38" fill="#fbfaf8" />
        <text x="190" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#44403c">
          &gt;  Distributed Systems  &gt;  Raft Consensus  &gt;  Section 1  &gt;  Page 1
        </text>

        <!-- 2. Left Sidebar (Workspaces Tree) -->
        ${generateCleanSidebar(350, 800, 'Distributed Systems', 'Raft Consensus', 'Leader-Election.pnv')}

        <!-- 3. Redact Email on Google Drive Card (exact position: x=1016, y=408) -->
        <rect x="1016" y="408" width="280" height="24" fill="#fffdf5" />
        <text x="1018" y="425" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#57534e">
          researcher@panvas.local
        </text>

        <!-- 4. Sync Status Text Replacement (exact position: x=955, y=460) -->
        <rect x="955" y="460" width="360" height="60" fill="#fffdf5" />
        <text x="958" y="482" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#059669">
          ✓ All 12 notebooks synchronized with Google Drive
        </text>
        <text x="958" y="506" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#78716c">
          Last verified: Just now (Direct OAuth connection)
        </text>
      </svg>
    `);

    await base
      .composite([{ input: overlaySvg, top: 0, left: 0 }])
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'cloud-sync-clean.webp'));

    console.log('✓ Created cloud-sync-clean.webp');
  }

  // -------------------------------------------------------------
  // 2. notebooks-templates-clean.webp (from NotebookStyle_Template.png)
  // Contrast enhancement & high-fidelity WebP export
  // -------------------------------------------------------------
  console.log('2. Generating notebooks-templates-clean.webp...');
  {
    await sharp(path.join(SRC_DIR, 'NotebookStyle_Template.png'))
      .modulate({ brightness: 1.02, saturation: 1.05 })
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'notebooks-templates-clean.webp'));
    console.log('✓ Created notebooks-templates-clean.webp');
  }

  // -------------------------------------------------------------
  // 3. notebook-customize-clean.webp (from CustomizeYourNotebook.png)
  // Retouch title to academic "Machine Learning & Neural Networks"
  // -------------------------------------------------------------
  console.log('3. Generating notebook-customize-clean.webp...');
  {
    const base = sharp(path.join(SRC_DIR, 'CustomizeYourNotebook.png'));
    const meta = await base.metadata();

    const overlaySvg = Buffer.from(`
      <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Retouch notebook name input field (inside dialog) -->
        <rect x="670" y="348" width="560" height="28" fill="#f5f2eb" />
        <text x="678" y="367" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#1f2937" font-weight="500">Machine Learning &amp; Neural Networks</text>
        
        <!-- Breadcrumb cleanup -->
        <rect x="180" y="10" width="500" height="38" fill="#fbfaf8" />
        <text x="190" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#44403c">&gt;  Machine Learning  &gt;  Neural Networks  &gt;  Section 1  &gt;  Page 1</text>
      </svg>
    `);

    await base
      .composite([{ input: overlaySvg, top: 0, left: 0 }])
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'notebook-customize-clean.webp'));
    console.log('✓ Created notebook-customize-clean.webp');
  }

  // -------------------------------------------------------------
  // 4. ink-stationery-ruler-clean.webp (from PreferenceStationary.png)
  // High-fidelity framed showcase of pencil dynamics & ruler
  // -------------------------------------------------------------
  console.log('4. Generating ink-stationery-ruler-clean.webp...');
  {
    await sharp(path.join(SRC_DIR, 'PreferenceStationary.png'))
      .sharpen()
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'ink-stationery-ruler-clean.webp'));
    console.log('✓ Created ink-stationery-ruler-clean.webp');
  }

  // -------------------------------------------------------------
  // 5. ink-gestures-clean.webp (from InkGestures.png)
  // Heuristic gestures panel & lined paper background
  // -------------------------------------------------------------
  console.log('5. Generating ink-gestures-clean.webp...');
  {
    await sharp(path.join(SRC_DIR, 'InkGestures.png'))
      .sharpen()
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'ink-gestures-clean.webp'));
    console.log('✓ Created ink-gestures-clean.webp');
  }

  // -------------------------------------------------------------
  // 6. handwriting-ocr-clean.webp (from Turn_Handwriting_into_text.png)
  // Retouch canvas area from meme placeholder to authentic engineering math/handwriting derivation
  // -------------------------------------------------------------
  console.log('6. Generating handwriting-ocr-clean.webp...');
  {
    const base = sharp(path.join(SRC_DIR, 'Turn_Handwriting_into_text.png'));
    const meta = await base.metadata();

    const overlaySvg = Buffer.from(`
      <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.12" />
          </filter>
        </defs>

        <!-- 1. Breadcrumb replacement -->
        <rect x="180" y="10" width="500" height="38" fill="#fbfaf8" />
        <text x="190" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#44403c">
          &gt;  Machine Learning  &gt;  Optimization  &gt;  Loss Functions  &gt;  Gradient-Descent.pnv
        </text>

        <!-- 2. Sidebar Workspace Tree Cleanup -->
        ${generateCleanSidebar(350, 800, 'Machine Learning', 'Optimization', 'Gradient-Descent.pnv')}

        <!-- 3. Canvas Retouching: Cover entire canvas area from x=382 to x=1540, y=140 to y=1030 -->
        <rect x="382" y="140" width="1158" height="890" fill="#ffffff" />
        
        <!-- Engineering Grid Texture -->
        <pattern id="engGridOcr" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4ade80" stroke-width="0.4" opacity="0.65" />
        </pattern>
        <rect x="382" y="140" width="1158" height="890" fill="url(#engGridOcr)" />

        <!-- Vector Stylus Handwriting Section -->
        <text x="510" y="240" font-family="'Caveat', 'Segoe Script', 'Comic Sans MS', cursive, sans-serif" font-size="30" fill="#e11d48" font-weight="bold">
          Gradient Descent Optimization:
        </text>

        <text x="510" y="295" font-family="'Caveat', 'Segoe Script', 'Comic Sans MS', cursive, sans-serif" font-size="26" fill="#334155">
          θ := θ - α ∇J(θ)
        </text>

        <!-- Vector stylus arrow -->
        <path d="M 720 310 C 760 340, 780 370, 790 400" fill="none" stroke="#e11d48" stroke-width="2.8" stroke-linecap="round" />
        <path d="M 778 395 L 790 405 L 796 390" fill="none" stroke="#e11d48" stroke-width="2.8" stroke-linecap="round" />
        
        <text x="810" y="365" font-family="'Caveat', 'Segoe Script', cursive, sans-serif" font-size="20" fill="#e11d48" font-weight="bold">
          Recognized &amp; Converted (WinRT Engine)
        </text>

        <!-- Converted Rich LaTeX Mathematical Callout Card -->
        <rect x="510" y="420" width="780" height="290" rx="16" fill="#ffffff" stroke="#8b5cf6" stroke-width="2.2" filter="url(#shadow)" />
        
        <!-- Header badge of OCR Card -->
        <rect x="535" y="445" width="145" height="26" rx="13" fill="#8b5cf6" fill-opacity="0.12" />
        <text x="548" y="462" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#7c3aed">LATEX CONVERTED</text>

        <!-- Formula 1: Cost Function -->
        <text x="540" y="515" font-family="'Cambria Math', 'Times New Roman', Georgia, serif" font-size="23" fill="#1e293b" font-style="italic">
          J(θ) = <tspan font-style="normal">½m</tspan> ∑<tspan font-size="15" dy="6">i=1</tspan><tspan font-size="15" dy="-14">m</tspan> <tspan font-size="23" dy="8">(h</tspan><tspan font-size="15" dy="4">θ</tspan><tspan font-size="23" dy="-4">(x</tspan><tspan font-size="15" dy="-6">(i)</tspan><tspan font-size="23" dy="6">) - y</tspan><tspan font-size="15" dy="-6">(i)</tspan><tspan font-size="23" dy="6">)²</tspan>
        </text>

        <!-- Formula 2: Update rule -->
        <text x="540" y="575" font-family="'Cambria Math', 'Times New Roman', Georgia, serif" font-size="23" fill="#7c3aed" font-style="italic">
          θ<tspan font-size="15" dy="4">j</tspan> <tspan font-style="normal" font-size="23" dy="-4">:=</tspan> θ<tspan font-size="15" dy="4">j</tspan> <tspan font-style="normal" font-size="23" dy="-4">-</tspan> α <tspan font-style="normal">∂</tspan>/<tspan font-style="normal">∂</tspan>θ<tspan font-size="15" dy="4">j</tspan> <tspan font-style="normal" font-size="23" dy="-4">J(θ)</tspan>
        </text>

        <!-- Explanatory note inside card -->
        <text x="540" y="630" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#475569">
          • Learning rate α ∈ (0, 1] determines step size along negative cost gradient
        </text>
        <text x="540" y="655" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#475569">
          • Convex cost landscape ensures global convergence for linear hypothesis h(x)
        </text>

        <!-- Converted Status Badge -->
        <rect x="540" y="672" width="240" height="22" rx="5" fill="#f1f5f9" />
        <text x="548" y="687" font-family="monospace" font-size="11" font-weight="600" fill="#059669">✓ Converted in 14ms via WinRT</text>
      </svg>
    `);

    await base
      .composite([{ input: overlaySvg, top: 0, left: 0 }])
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'handwriting-ocr-clean.webp'));
    console.log('✓ Created handwriting-ocr-clean.webp');
  }

  // -------------------------------------------------------------
  // 7. pdf-workbench-clean.webp (from printNotes_ExportPDF.png + document view)
  // -------------------------------------------------------------
  console.log('7. Generating pdf-workbench-clean.webp...');
  {
    const base = sharp(path.join(SRC_DIR, 'Screenshot 2026-08-31 155328.png'));
    const meta = await base.metadata();

    const exportDropdown = await sharp(path.join(SRC_DIR, 'printNotes_ExportPDF.png'))
      .resize({ width: 330 })
      .toBuffer();

    const overlaySvg = Buffer.from(`
      <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <!-- 1. Breadcrumb cleanup -->
        <rect x="180" y="10" width="500" height="38" fill="#fbfaf8" />
        <text x="190" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#44403c">
          &gt;  Research Papers  &gt;  Transformer Attention  &gt;  Section 1  &gt;  Attention.pdf (p. 4)
        </text>

        <!-- 2. Clean Sidebar -->
        ${generateCleanSidebar(350, 800, 'Research Papers', 'Transformer Attention', 'Attention.pdf')}

        <!-- 3. Clean Background Canvas Area from x=382 to x=1540 -->
        <rect x="382" y="140" width="1158" height="890" fill="#ffffff" />
        <pattern id="engGridPdf" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#4ade80" stroke-width="0.4" opacity="0.5" />
        </pattern>
        <rect x="382" y="140" width="1158" height="890" fill="url(#engGridPdf)" />

        <!-- 4. PDF Document Rendering in canvas center -->
        <rect x="520" y="180" width="850" height="740" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" />
        
        <!-- Header of PDF Document -->
        <text x="560" y="240" font-family="'Times New Roman', Georgia, serif" font-size="24" font-weight="bold" fill="#0f172a">
          Attention Is All You Need — Technical Specification
        </text>
        <text x="560" y="270" font-family="'Times New Roman', Georgia, serif" font-size="14" fill="#475569" font-style="italic">
          Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez...
        </text>

        <!-- Simulated PDF Vector Ink Highlights & Annotations -->
        <rect x="560" y="315" width="560" height="26" fill="#fef08a" fill-opacity="0.6" rx="3" />
        <text x="565" y="333" font-family="'Times New Roman', Georgia, serif" font-size="15" fill="#1e293b">
          "The dominant sequence transduction models are based on complex recurrent or..."
        </text>
        
        <text x="565" y="365" font-family="'Times New Roman', Georgia, serif" font-size="15" fill="#334155">
          ...convolutional neural networks in an encoder-decoder configuration. The best performing
        </text>
        <text x="565" y="395" font-family="'Times New Roman', Georgia, serif" font-size="15" fill="#334155">
          models also connect the encoder and decoder through an attention mechanism.
        </text>

        <!-- Margin Vector Stylus Annotation -->
        <path d="M 1060 325 C 1100 325, 1130 350, 1150 380" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" />
        <text x="1110" y="415" font-family="'Caveat', cursive, sans-serif" font-size="22" fill="#e11d48" font-weight="bold">
          Self-attention avoids recurrent step latency!
        </text>

        <!-- PDF Page controls ribbon at bottom -->
        <rect x="800" y="870" width="340" height="38" rx="19" fill="#1e293b" fill-opacity="0.95" />
        <text x="830" y="894" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#ffffff">◀   Page 4 of 15   ▶</text>
        <text x="985" y="894" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#94a3b8">|   Zoom 100%</text>
      </svg>
    `);

    await base
      .composite([
        { input: overlaySvg, top: 0, left: 0 },
        { input: exportDropdown, top: 110, left: 1300 },
      ])
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'pdf-workbench-clean.webp'));
    console.log('✓ Created pdf-workbench-clean.webp');
  }

  // -------------------------------------------------------------
  // 8. spatial-canvas-clean.webp (from StickyNotes.png + VoiceNotes.png + canvas)
  // -------------------------------------------------------------
  console.log('8. Generating spatial-canvas-clean.webp...');
  {
    const base = sharp(path.join(SRC_DIR, 'Screenshot 2026-08-31 155328.png'));
    const meta = await base.metadata();

    const stickyWidget = await sharp(path.join(SRC_DIR, 'StickyNotes.png'))
      .resize({ width: 350 })
      .toBuffer();

    const voiceWidget = await sharp(path.join(SRC_DIR, 'VoiceNotes.png'))
      .resize({ width: 330 })
      .toBuffer();

    const overlaySvg = Buffer.from(`
      <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="canvasShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.14" />
          </filter>
        </defs>

        <!-- 1. Breadcrumb -->
        <rect x="180" y="10" width="500" height="38" fill="#fbfaf8" />
        <text x="190" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#44403c">
          &gt;  Architecture  &gt;  Distributed Consensus  &gt;  Whiteboard  &gt;  Raft-Topology.excalidraw
        </text>

        <!-- 2. Clean Sidebar -->
        ${generateCleanSidebar(350, 800, 'Architecture', 'Distributed Consensus', 'Raft-Topology.excalidraw')}

        <!-- 3. Clean Canvas Area with dot matrix background from x=382 to x=1540 -->
        <rect x="382" y="140" width="1158" height="890" fill="#fafafa" />
        
        <pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1.4" fill="#cbd5e1" />
        </pattern>
        <rect x="382" y="140" width="1158" height="890" fill="url(#dotGrid)" />

        <!-- Spatial System Architecture Nodes (Excalidraw style) -->
        <!-- Client Node -->
        <rect x="500" y="310" width="150" height="75" rx="10" fill="#f8fafc" stroke="#3b82f6" stroke-width="2.2" filter="url(#canvasShadow)" />
        <text x="535" y="345" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#1e293b">Client API</text>
        <text x="520" y="368" font-family="monospace" font-size="11" fill="#64748b">HTTPS / gRPC</text>

        <!-- Leader Node -->
        <rect x="760" y="270" width="185" height="90" rx="10" fill="#f0fdf4" stroke="#10b981" stroke-width="2.8" filter="url(#canvasShadow)" />
        <text x="795" y="308" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#065f46">Raft Leader</text>
        <text x="785" y="333" font-family="monospace" font-size="12" font-weight="600" fill="#047857">Term: 4 | Log Index: 84</text>
        <circle cx="925" cy="288" r="6" fill="#10b981" />

        <!-- Follower Nodes -->
        <rect x="1030" y="210" width="160" height="75" rx="10" fill="#f8fafc" stroke="#64748b" stroke-width="2" filter="url(#canvasShadow)" />
        <text x="1065" y="245" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#334155">Follower A</text>
        <text x="1055" y="268" font-family="monospace" font-size="11" fill="#64748b">Log Index: 84</text>

        <rect x="1030" y="350" width="160" height="75" rx="10" fill="#f8fafc" stroke="#64748b" stroke-width="2" filter="url(#canvasShadow)" />
        <text x="1065" y="385" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#334155">Follower B</text>
        <text x="1055" y="408" font-family="monospace" font-size="11" fill="#64748b">Log Index: 83 (Sync)</text>

        <!-- Connection Arrows -->
        <path d="M 650 348 L 760 315" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-dasharray="5,5" />
        <path d="M 945 300 L 1030 250" fill="none" stroke="#10b981" stroke-width="2.2" />
        <path d="M 945 330 L 1030 380" fill="none" stroke="#10b981" stroke-width="2.2" />

        <!-- Floating Markdown / KaTeX Callout Block -->
        <rect x="500" y="470" width="410" height="140" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.8" filter="url(#canvasShadow)" />
        <rect x="500" y="470" width="410" height="30" rx="12" fill="#f1f5f9" />
        <text x="518" y="490" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#475569">📝 Consensus Invariant // Markdown</text>
        <text x="518" y="525" font-family="'Courier New', monospace" font-size="13" fill="#0f172a">Election Safety: At most one leader</text>
        <text x="518" y="548" font-family="'Courier New', monospace" font-size="13" fill="#0f172a">can be elected in a given term.</text>
        <text x="518" y="582" font-family="Georgia, serif" font-size="13" fill="#7c3aed" font-style="italic">∀ term t : |{ L ∈ Nodes | L.role = Leader ∧ L.term = t }| ≤ 1</text>
      </svg>
    `);

    await base
      .composite([
        { input: overlaySvg, top: 0, left: 0 },
        { input: stickyWidget, top: 180, left: 1180 },
        { input: voiceWidget, top: 580, left: 940 },
      ])
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'spatial-canvas-clean.webp'));
    console.log('✓ Created spatial-canvas-clean.webp');
  }

  // -------------------------------------------------------------
  // 9. hero-workspace-clean.webp (High-res hero showcase)
  // -------------------------------------------------------------
  console.log('9. Generating hero-workspace-clean.webp...');
  {
    const base = sharp(path.join(SRC_DIR, 'Screenshot 2026-08-31 155328.png'));
    const meta = await base.metadata();

    const overlaySvg = Buffer.from(`
      <svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="heroShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000" flood-opacity="0.12" />
          </filter>
        </defs>

        <!-- 1. Breadcrumb -->
        <rect x="180" y="10" width="500" height="38" fill="#fbfaf8" />
        <text x="190" y="35" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#44403c">
          &gt;  Machine Learning  &gt;  Transformers  &gt;  Section 1  &gt;  Multi-Head-Attention.pnv
        </text>

        <!-- 2. Clean Sidebar -->
        ${generateCleanSidebar(350, 800, 'Machine Learning', 'Transformers', 'Multi-Head-Attention.pnv')}

        <!-- 3. Canvas Area: Rich Engineering Notebook with Graph Paper from x=382 to x=1540 -->
        <rect x="382" y="140" width="1158" height="890" fill="#ffffff" />
        
        <pattern id="heroEngGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#38bdf8" stroke-width="0.4" opacity="0.6" />
        </pattern>
        <rect x="382" y="140" width="1158" height="890" fill="url(#heroEngGrid)" />

        <!-- Title of Note -->
        <text x="510" y="225" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="bold" fill="#0f172a">
          Scaled Dot-Product &amp; Multi-Head Attention
        </text>
        <text x="510" y="255" font-family="monospace" font-size="12" fill="#64748b">
          AUTHOR: Researcher // DATE: 2026-08-31 // TAGS: [Deep-Learning, NLP, Architecture]
        </text>

        <!-- Mathematical Formula Card -->
        <rect x="510" y="280" width="600" height="115" rx="12" fill="#ffffff" stroke="#38bdf8" stroke-width="1.8" filter="url(#heroShadow)" />
        <text x="530" y="315" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0284c7">ATTENTION FORMULATION</text>
        <text x="530" y="358" font-family="'Cambria Math', 'Times New Roman', Georgia, serif" font-size="24" fill="#0f172a" font-style="italic">
          Attention(Q, K, V) = softmax( <tspan font-style="normal">QK</tspan><tspan font-size="15" dy="-8">T</tspan><tspan font-size="24" dy="8"> / √d</tspan><tspan font-size="15" dy="4">k</tspan> <tspan font-size="24" dy="-4">)</tspan> V
        </text>

        <!-- Vector Stylus Margin Sketch & Note -->
        <path d="M 940 430 C 970 460, 1000 480, 1040 470" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" />
        <rect x="1010" y="440" width="370" height="85" rx="10" fill="#fff1f2" stroke="#fda4af" stroke-width="1.2" />
        <text x="1030" y="472" font-family="'Caveat', cursive, sans-serif" font-size="19" fill="#be123c" font-weight="bold">
          Scale by 1/√dk to prevent softmax saturation
        </text>
        <text x="1030" y="502" font-family="'Caveat', cursive, sans-serif" font-size="19" fill="#be123c" font-weight="bold">
          at large dimension sizes!
        </text>

        <!-- Code Block Component -->
        <rect x="510" y="425" width="490" height="240" rx="12" fill="#0f172a" filter="url(#heroShadow)" />
        <rect x="510" y="425" width="490" height="30" rx="12" fill="#1e293b" />
        <circle cx="530" cy="440" r="4" fill="#ef4444" />
        <circle cx="544" cy="440" r="4" fill="#f59e0b" />
        <circle cx="558" cy="440" r="4" fill="#10b981" />
        <text x="580" y="445" font-family="monospace" font-size="11" fill="#94a3b8">attention.py — PyTorch Implementation</text>

        <text x="530" y="480" font-family="monospace" font-size="12" fill="#38bdf8">def</text>
        <text x="560" y="480" font-family="monospace" font-size="12" fill="#f8fafc"> scaled_dot_product_attention(q, k, v, mask=None):</text>
        <text x="550" y="505" font-family="monospace" font-size="12" fill="#94a3b8">    d_k = q.size(-1)</text>
        <text x="550" y="530" font-family="monospace" font-size="12" fill="#94a3b8">    scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)</text>
        <text x="550" y="555" font-family="monospace" font-size="12" fill="#f59e0b">    if</text>
        <text x="575" y="555" font-family="monospace" font-size="12" fill="#f8fafc"> mask is not None:</text>
        <text x="570" y="580" font-family="monospace" font-size="12" fill="#94a3b8">        scores = scores.masked_fill(mask == 0, -1e9)</text>
        <text x="550" y="605" font-family="monospace" font-size="12" fill="#94a3b8">    weights = F.softmax(scores, dim=-1)</text>
        <text x="550" y="630" font-family="monospace" font-size="12" fill="#38bdf8">    return</text>
        <text x="600" y="630" font-family="monospace" font-size="12" fill="#f8fafc"> torch.matmul(weights, v), weights</text>
      </svg>
    `);

    await base
      .composite([{ input: overlaySvg, top: 0, left: 0 }])
      .webp({ quality: 95, effort: 6 })
      .toFile(path.join(OUT_DIR, 'hero-workspace-clean.webp'));
    console.log('✓ Created hero-workspace-clean.webp');
  }

  console.log('\nAll Panvas marketing assets generated successfully in public/marketing-assets/ !');
}

run().catch((err) => {
  console.error('Error generating marketing assets:', err);
  process.exit(1);
});
