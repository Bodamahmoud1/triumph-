const fs = require('fs');

let html = fs.readFileSync('b:\\Downloads\\clax\\index.html', 'utf8');

// Replace everything between <div class="products-grid"> and </div><!-- /products-grid -->
const productsRegex = /<div class="products-grid">([\s\S]*?)<\/div><!-- \/products-grid -->/;
html = html.replace(productsRegex, '<div class="products-grid" id="chemicals-grid">\n        <!-- Chemical cards loaded via JS -->\n      </div><!-- /products-grid -->');

// Replace everything between <div class="programs-grid"> and </div><!-- /programs-grid -->
const programsRegex = /<div class="programs-grid">([\s\S]*?)<\/div><!-- \/programs-grid -->/;
html = html.replace(programsRegex, '<div class="programs-grid" id="programs-grid">\n          <!-- Program cards loaded via JS -->\n        </div><!-- /programs-grid -->');

fs.writeFileSync('b:\\Downloads\\clax\\index.html', html, 'utf8');

console.log('Cleaned up index.html!');
