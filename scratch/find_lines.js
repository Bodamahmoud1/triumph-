const fs = require('fs');

let content = fs.readFileSync('b:\\Downloads\\clax\\index.html');
let encoding = 'utf8';
if (content[0] === 0xff && content[1] === 0xfe) {
    encoding = 'utf16le';
}

content = fs.readFileSync('b:\\Downloads\\clax\\index.html', encoding);
const lines = content.split(/\r?\n/);

let results = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('section id="chemicals"')) {
        results.push(`chemicals section: ${i + 1}`);
    }
    if (lines[i].includes('section id="programs"')) {
        results.push(`programs section: ${i + 1}`);
    }
}
console.log(results.join('\n'));
