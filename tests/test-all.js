const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'test-faq.js',
  'test-reservation.js',
];

let totalOk = 0, totalFail = 0;

for (const fichier of tests) {
  try {
    const output = execSync(`node ${path.join(__dirname, fichier)}`, { encoding: 'utf8' });
    process.stdout.write(output);
    totalOk += (output.match(/✅/g) || []).length;
    totalFail += (output.match(/❌/g) || []).length;
  } catch (e) {
    process.stdout.write(e.stdout || '');
    totalFail++;
  }
}

console.log('═'.repeat(40));
console.log(`  TOTAL : ${totalOk} ✅  ${totalFail} ❌`);
console.log('═'.repeat(40) + '\n');
process.exit(totalFail > 0 ? 1 : 0);
