/**
 * Run with Node.js to generate PNG icons from SVG.
 * Requires: npm install sharp
 * Usage: node generate_icons.js
 */
const fs   = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    // Fallback: copy SVG as placeholder (Chrome accepts SVG for dev testing)
    console.log('sharp not found — copying SVG as placeholder icons.');
    const svg = fs.readFileSync(path.join(__dirname, 'icons', 'icon.svg'));
    for (const size of [16, 48, 128]) {
      fs.writeFileSync(path.join(__dirname, 'icons', `icon${size}.png`), svg);
    }
    return;
  }

  const svgBuffer = fs.readFileSync(path.join(__dirname, 'icons', 'icon.svg'));
  for (const size of [16, 48, 128]) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, 'icons', `icon${size}.png`));
    console.log(`Generated icon${size}.png`);
  }
}

main().catch(console.error);
