const fs = require('fs');

let content = fs.readFileSync('b:\\Downloads\\clax\\index.html', 'utf8');

// The chemicals start after <div class="products-grid"> and end before </div><!-- /products-grid -->
// The programs start after <div class="programs-grid"> and end before </div><!-- /programs-grid -->

// We will replace the inner HTML of these two grids with empty space.
const chemRegex = /(<div class="products-grid"(?:[^>]*)>)([\s\S]*?)(<\/div><!-- \/products-grid -->)/i;
const progRegex = /(<div class="programs-grid"(?:[^>]*)>)([\s\S]*?)(<\/div><!-- \/programs-grid -->)/i;

content = content.replace(chemRegex, '$1\n        <!-- Chemicals are now dynamically injected by js/renderer.js -->\n      $3');
content = content.replace(progRegex, '$1\n          <!-- Programs are now dynamically injected by js/renderer.js -->\n        $3');

fs.writeFileSync('b:\\Downloads\\clax\\index.html', content, 'utf8');
console.log("HTML cleanup complete. Reduced file size.");
