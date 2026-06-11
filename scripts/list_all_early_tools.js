import fs from 'fs';
import readline from 'readline';

const logPath = 'C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\84d2f494-e6eb-4bff-9f84-314e4802fe7c\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let stepIdx = 0;
  for await (const line of rl) {
    stepIdx++;
    if (stepIdx > 60) break;
    try {
      const step = JSON.parse(line);
      if (step.tool_calls) {
        step.tool_calls.forEach(tc => {
          const name = tc.name || tc.function?.name;
          const args = typeof tc.args === 'string' ? JSON.parse(tc.args) : tc.args;
          const target = args?.TargetFile || args?.Target || args?.AbsolutePath || args?.DirectoryPath || '';
          console.log(`Step ${stepIdx} | Tool: ${name} | Target: ${target} | Desc: ${args?.Description || ''}`);
        });
      }
    } catch(e){}
  }
}
main();
