const fs = require('fs');
const html = fs.readFileSync('admin/index.html', 'utf8');

const styleRegex = /<style>([\s\S]*?)<\/style>/;
const scriptRegex = /<script>([\s\S]*?)<\/script>/;

const styleMatch = html.match(styleRegex);
const scriptMatch = html.match(scriptRegex);

let newHtml = html;

if (styleMatch) {
  fs.writeFileSync('admin/styles.css', styleMatch[1].trim() + '\n');
  newHtml = newHtml.replace(styleRegex, '<link rel="stylesheet" href="styles.css">');
}

if (scriptMatch) {
  fs.writeFileSync('admin/script.js', scriptMatch[1].trim() + '\n');
  newHtml = newHtml.replace(scriptRegex, '<script src="script.js" defer></script>');
}

fs.writeFileSync('admin/index.html', newHtml);
console.log('Extracted admin assets successfully.');
