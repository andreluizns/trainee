// Processa os 7 datasets e grava os JSONs em output/.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

fs.mkdirSync('output', { recursive: true });

for (let n = 1; n <= 7; n++) {
  process.stderr.write(`dataset${n}: `);
  const { status } = spawnSync(
    process.execPath,
    ['src/cli.js', `datasets/dataset${n}.txt`, '-o', `output/respostas${n}.json`, ...process.argv.slice(2)],
    { stdio: 'inherit' },
  );
  if (status !== 0) process.exit(status ?? 1);
}
