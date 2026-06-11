import fs from 'fs';
import readline from 'readline';

const logPaths = [
  'C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\d5029301-e30f-4b28-b4e4-df28806c2e9c\\.system_generated\\logs\\transcript.jsonl',
  'C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\84d2f494-e6eb-4bff-9f84-314e4802fe7c\\.system_generated\\logs\\transcript.jsonl'
];

function cleanString(val) {
  if (typeof val !== 'string') return val;
  let s = val;
  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      s = JSON.parse(s);
    } catch (e) {
      s = s.slice(1, -1);
    }
  }
  // Unescape backslashes and quotes if they are escaped double times
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

async function collectReplacements(logPath, logLabel) {
  const replacements = [];
  if (!fs.existsSync(logPath)) return replacements;
  
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let stepIdx = 0;
  for await (const line of rl) {
    stepIdx++;
    try {
      const step = JSON.parse(line);
      if (step.tool_calls) {
        for (const tc of step.tool_calls) {
          const name = tc.name || tc.function?.name;
          const args = tc.args || tc.function?.arguments;
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
          
          if (parsedArgs) {
            const targetFile = cleanString(parsedArgs.TargetFile || parsedArgs.Target || '');
            
            if (targetFile.includes('main.jsx')) {
              if (name === 'replace_file_content') {
                replacements.push({
                  logLabel,
                  stepIdx,
                  type: 'replace',
                  description: cleanString(parsedArgs.Description),
                  target: cleanString(parsedArgs.TargetContent),
                  replacement: cleanString(parsedArgs.ReplacementContent)
                });
              } else if (name === 'multi_replace_file_content' && parsedArgs.ReplacementChunks) {
                replacements.push({
                  logLabel,
                  stepIdx,
                  type: 'multi_replace',
                  description: cleanString(parsedArgs.Description),
                  chunks: parsedArgs.ReplacementChunks.map(c => ({
                    target: cleanString(c.TargetContent),
                    replacement: cleanString(c.ReplacementContent)
                  }))
                });
              } else if (name === 'write_to_file' && parsedArgs.CodeContent) {
                replacements.push({
                  logLabel,
                  stepIdx,
                  type: 'write',
                  description: cleanString(parsedArgs.Description),
                  content: cleanString(parsedArgs.CodeContent)
                });
              }
            }
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }
  return replacements;
}

async function main() {
  const prevRepls = await collectReplacements(logPaths[0], 'previous');
  const currRepls = await collectReplacements(logPaths[1], 'current');
  const allRepls = [...prevRepls, ...currRepls];

  console.log(`Collected ${allRepls.length} modification steps total.`);

  // Load the base file (745 lines version from fresh checkout)
  let content = cleanString(fs.readFileSync('c:\\005\\src\\main.jsx', 'utf8'));
  console.log(`Base main.jsx size: ${content.length} characters.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < allRepls.length; i++) {
    const repl = allRepls[i];
    
    if (repl.type === 'write') {
      content = repl.content;
      successCount++;
      console.log(`[${i+1}/${allRepls.length}] Step ${repl.stepIdx} (${repl.logLabel}) - write: Full write applied. Size: ${content.length}`);
    } else if (repl.type === 'replace') {
      if (content.includes(repl.target)) {
        content = content.replace(repl.target, repl.replacement);
        successCount++;
        console.log(`[${i+1}/${allRepls.length}] Step ${repl.stepIdx} (${repl.logLabel}) - replace: Success`);
      } else {
        failCount++;
        console.log(`[${i+1}/${allRepls.length}] Step ${repl.stepIdx} (${repl.logLabel}) - replace: FAILED`);
        console.log(`     Target snippet (first 100 chars): ${JSON.stringify(repl.target.slice(0, 100))}`);
      }
    } else if (repl.type === 'multi_replace') {
      let allChunksMatched = true;
      let tempContent = content;
      
      for (let cIdx = 0; cIdx < repl.chunks.length; cIdx++) {
        const chunk = repl.chunks[cIdx];
        if (tempContent.includes(chunk.target)) {
          tempContent = tempContent.replace(chunk.target, chunk.replacement);
        } else {
          allChunksMatched = false;
          console.log(`  -> Chunk ${cIdx} target not found! Snippet: ${JSON.stringify(chunk.target.slice(0, 100))}`);
        }
      }
      
      if (allChunksMatched) {
        content = tempContent;
        successCount++;
        console.log(`[${i+1}/${allRepls.length}] Step ${repl.stepIdx} (${repl.logLabel}) - multi_replace: Success`);
      } else {
        failCount++;
        console.log(`[${i+1}/${allRepls.length}] Step ${repl.stepIdx} (${repl.logLabel}) - multi_replace: FAILED`);
      }
    }
  }

  console.log(`\nReplay complete. Success: ${successCount}, Failed: ${failCount}`);
  fs.writeFileSync('C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\84d2f494-e6eb-4bff-9f84-314e4802fe7c\\scratch\\restored_main_final.jsx', content);
  console.log(`Restored file written to restored_main_final.jsx. Size: ${content.length} characters.`);
}

main();
