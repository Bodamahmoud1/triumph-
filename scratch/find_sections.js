const fs = require('fs');
let content = fs.readFileSync('b:\\Downloads\\clax\\index.html', 'utf8');
const lines = content.split(/\r?\n/);
let results = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<section')) {
        results.push(`Line ${i + 1}: ${lines[i].trim()}`);
    }
}
console.log(results.join('\n'));
