const fs = require('fs');

const html = fs.readFileSync('b:\\Downloads\\clax\\index.html', 'utf8');

// I'll just copy the important HTML blocks directly into JSON if needed, or better yet, keep the HTML for now, and implement template rendering later. 
// Wait, the plan says to "Extract data into JSON" and "Template rendering".
// It's much easier to extract it via script.

// Let's use a regex to find all <article class="product-card" id="...">...</article>
const articleRegex = /<article class="product-card" id="([^"]+)" data-theme="([^"]+)">([\s\S]*?)<\/article>/g;

const chemicals = [];
let match;
while ((match = articleRegex.exec(html)) !== null) {
  const id = match[1];
  const theme = match[2];
  const content = match[3];

  // Extract name and code
  const nameMatch = content.match(/<span class="card-prod-name">([^<]+)<\/span>/);
  const codeMatch = content.match(/<span class="card-prod-code">([^<]+)<\/span>/);
  const tagMatch = content.match(/<span class="prod-type-tag tag-theme">([^<]+)<\/span>/);

  // For the rest of the body, we can keep the inner HTML of card-body, tech-section, and card-safe, or extract granularly.
  // The plan says: "Structured data for all 8 chemicals with fields: id, name, code, theme, type_ar, description, how_it_works, features[], dosage, usage_notes[], tech_data{}, safety_notes"
  
  chemicals.push({
    id,
    theme,
    name: nameMatch ? nameMatch[1] : '',
    code: codeMatch ? codeMatch[1] : '',
    type_ar: tagMatch ? tagMatch[1] : '',
    // full html for now to make it easy
    raw_content: content
  });
}

if (!fs.existsSync('b:\\Downloads\\clax\\data')) {
  fs.mkdirSync('b:\\Downloads\\clax\\data');
}

fs.writeFileSync('b:\\Downloads\\clax\\data\\chemicals.json', JSON.stringify(chemicals, null, 2));

// Extract programs
const progRegex = /<article class="prog-card[^"]*" id="([^"]+)" data-program-type="([^"]+)">([\s\S]*?)<\/article>/g;
const programs = [];
while ((match = progRegex.exec(html)) !== null) {
  const id = match[1];
  const type = match[2];
  const content = match[3];

  const numMatch = content.match(/<span class="prog-num">([^<]+)<\/span>/);
  const enMatch = content.match(/<div class="prog-en">([^<]+)<\/div>/);
  const arMatch = content.match(/<div class="prog-ar">([^<]+)<\/div>/);
  const tempMatch = content.match(/<span class="prog-temp">([^<]+)<\/span>/);
  const timeMatch = content.match(/<span class="prog-time">([^<]+)<\/span>/);
  const noteMatch = content.match(/<div class="prog-note">([^<]+)<\/div>/);

  programs.push({
    id,
    type,
    number: numMatch ? numMatch[1] : '',
    name_en: enMatch ? enMatch[1] : '',
    name_ar: arMatch ? arMatch[1] : '',
    temp: tempMatch ? tempMatch[1] : '',
    time: timeMatch ? timeMatch[1] : '',
    note: noteMatch ? noteMatch[1] : '',
    raw_content: content
  });
}

fs.writeFileSync('b:\\Downloads\\clax\\data\\programs.json', JSON.stringify(programs, null, 2));

console.log(`Extracted ${chemicals.length} chemicals and ${programs.length} programs.`);
