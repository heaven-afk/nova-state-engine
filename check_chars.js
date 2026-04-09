const fs = require('fs');
const lines = fs.readFileSync('exports.html', 'utf8').split('\n');
const line = lines[398]; // 0-indexed
console.log("Line 399: ", line);
for (let i = 70; i < 85; i++) {
    console.log(`char[${i}]: '${line[i]}' (code: ${line.charCodeAt(i)})`);
}
