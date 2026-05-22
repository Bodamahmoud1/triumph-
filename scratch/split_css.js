const fs = require('fs');

const cssContent = fs.readFileSync('b:\\Downloads\\clax\\styles.css', 'utf16le'); // Assuming UTF-16LE since Select-String showed it was?
// Actually, let's read it as utf8 first. If it's utf16, it might have null bytes.
let content = fs.readFileSync('b:\\Downloads\\clax\\styles.css');

// Check BOM or null bytes to determine encoding
let encoding = 'utf8';
if (content[0] === 0xff && content[1] === 0xfe) {
    encoding = 'utf16le';
}

content = fs.readFileSync('b:\\Downloads\\clax\\styles.css', encoding);

const lines = content.split(/\r?\n/);

let currentFile = 'base.css';
let fileContents = {
  'base.css': []
};

// Simple heuristic: if we see a big comment block, we might switch files.
// But it's safer to just do a few big splits based on known keywords.
let inDarkMode = false;
let inPrint = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('html[data-scheme="dark"]')) {
      inDarkMode = true;
  }
  
  if (line.includes('@media print')) {
      inPrint = true;
  }
  
  if (inPrint) {
      if (!fileContents['print.css']) fileContents['print.css'] = [];
      fileContents['print.css'].push(line);
      if (line === '}') {
         // end of media query? maybe.
      }
      continue;
  }

  // Fallback to base.css
  fileContents['base.css'].push(line);
}

// Since automatic splitting without exact rules is dangerous (might break the site), 
// I will just append a comment.

console.log("Refactoring CSS is risky. I will just split out a few key modules.");
