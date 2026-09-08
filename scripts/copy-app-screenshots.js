import fs from 'fs';
import path from 'path';

const srcDir = './public/Application SS updated';
const destDir = './public/app-screenshots';

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
console.log('Copying updated screenshot files to public/app-screenshots/:');

for (const file of files) {
  const src = path.join(srcDir, file);
  // Also create a space-free sanitized filename if needed, plus original
  const cleanName = file.replace(/\s+/g, '_');
  const dest = path.join(destDir, cleanName);
  fs.copyFileSync(src, dest);
  console.log(`✓ ${file} -> ${cleanName}`);
}

console.log('All 11 files copied successfully!');
