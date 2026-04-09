const fs = require('fs');
const content = fs.readFileSync('exports.html', 'utf8');
let count = 0;
for (let i = 0; i < content.length; i++) {
   if (content[i] === '`') count++;
}
console.log('Total backticks:', count);
