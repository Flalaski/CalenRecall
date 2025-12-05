#!/usr/bin/env node

/**
 * Generate PNG icon from SVG
 * 
 * This script converts assets/icon.svg to assets/icon.png
 * Requires: sharp package (npm install --save-dev sharp)
 * 
 * Usage: node scripts/generate-icon.js
 */

const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

const svgPath = path.join(__dirname, '..', 'assets', 'icon.svg');
const pngPath = path.join(__dirname, '..', 'assets', 'icon.png');

if (!fs.existsSync(svgPath)) {
  console.error(`Error: ${svgPath} not found`);
  process.exit(1);
}

async function generateIcon() {
  try {
    console.log('Generating icon.png from icon.svg...');
    
    // Generate multiple sizes for different use cases
    const sizes = [
      { size: 256, path: pngPath },
      { size: 512, path: path.join(__dirname, '..', 'assets', 'icon-512.png') },
      { size: 1024, path: path.join(__dirname, '..', 'assets', 'icon-1024.png') },
    ];
    
    for (const { size, path: outputPath } of sizes) {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${path.basename(outputPath)} (${size}x${size})`);
    }
    
    console.log('\nIcon generation complete!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('sharp')) {
      console.error('\nError: sharp package not found.');
      console.error('Please install it with: npm install --save-dev sharp');
      process.exit(1);
    } else {
      console.error('Error generating icon:', error.message);
      process.exit(1);
    }
  }
}

generateIcon();

