const fs = require('fs');

const css = fs.readFileSync('styles.css', 'utf8');

// Find the major breakpoints
// We will just do a simple split. We'll search for key section headers.
// Since the file is 3500+ lines, let's find the indices of key sections.

const idxReset = css.indexOf('/* ═══════════════════════════════════════\r\n   RESET');
const idxLayout = css.indexOf('/* ═══════════════════════════════════════\r\n   PAGE WRAPPER');
const idxComponents = css.indexOf('/* ═══════════════════════════════════════\r\n   CARDS');
const idxSections = css.indexOf('/* ═══════════════════════════════════════\r\n   LANDING HERO');

const getSafeIdx = (searchStr) => {
    let i = css.indexOf(searchStr);
    if (i === -1) i = css.indexOf(searchStr.replace(/\r\n/g, '\n'));
    if (i === -1) i = css.indexOf(searchStr.replace(/\r\n/g, '\n').replace(/═/g, ''));
    return i;
};

const i1 = getSafeIdx('   RESET');
const i2 = getSafeIdx('   PAGE WRAPPER');
const i3 = getSafeIdx('   CARDS');
const i4 = getSafeIdx('   LANDING HERO');

console.log('Indices:', i1, i2, i3, i4);

// If any index is missing, we'll abort to avoid breaking things.
if (i1 === -1 || i2 === -1 || i3 === -1 || i4 === -1) {
    console.log('Failed to find split points');
    process.exit(1);
}

// Find the start of the comment block for each
const findCommentStart = (idx) => {
    return css.lastIndexOf('/*', idx);
};

const s1 = findCommentStart(i1);
const s2 = findCommentStart(i2);
const s3 = findCommentStart(i3);
const s4 = findCommentStart(i4);

const tokens = css.substring(0, s1);
const base = css.substring(s1, s2);
const layout = css.substring(s2, s3);
const components = css.substring(s3, s4);
const sections = css.substring(s4);

if (!fs.existsSync('css')) fs.mkdirSync('css');

fs.writeFileSync('css/tokens.css', tokens);
fs.writeFileSync('css/base.css', base);
fs.writeFileSync('css/layout.css', layout);
fs.writeFileSync('css/components.css', components);
fs.writeFileSync('css/sections.css', sections);

console.log('Successfully split styles.css into css/ directory!');
