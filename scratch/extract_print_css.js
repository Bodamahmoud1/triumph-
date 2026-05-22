const fs = require('fs');
const path = require('path');

const cssPath = 'b:\\Downloads\\clax\\styles.css';
let content = fs.readFileSync(cssPath, 'utf8');
const lines = content.split(/\r?\n/);

let printCss = [];
let darkCss = [];
let mainCss = [];

let inPrintMedia = false;
let openBraces = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle Print Media
    if (line.includes('@media print')) {
        inPrintMedia = true;
        printCss.push(line);
        openBraces += (line.match(/{/g) || []).length;
        openBraces -= (line.match(/}/g) || []).length;
        continue;
    }

    if (inPrintMedia) {
        printCss.push(line);
        openBraces += (line.match(/{/g) || []).length;
        openBraces -= (line.match(/}/g) || []).length;
        
        if (openBraces === 0) {
            inPrintMedia = false;
        }
        continue;
    }

    // Handle Dark Theme
    // We look for lines containing html[data-scheme="dark"] or [data-scheme="dark"]
    if (line.includes('[data-scheme="dark"]')) {
        // Since dark theme rules are mostly single-line or small blocks, let's just grab the whole block if it's on one line
        // or track braces if multi-line.
        if (line.includes('{') && line.includes('}')) {
            darkCss.push(line);
            continue;
        }
        // Simplified extraction: just leave it in main if complex to avoid breaking cascade
    }

    mainCss.push(line);
}

const cssDir = 'b:\\Downloads\\clax\\css';
if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir);
}

if (printCss.length > 0) {
    fs.writeFileSync(path.join(cssDir, 'print.css'), printCss.join('\n'), 'utf8');
}

fs.writeFileSync(cssPath, mainCss.join('\n'), 'utf8');

console.log(`Extracted ${printCss.length} lines to print.css`);
