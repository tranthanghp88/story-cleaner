const fs = require('fs');

const logPath = 'C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\84d2f494-e6eb-4bff-9f84-314e4802fe7c\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.log('Log file not found');
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);

lines.forEach((line, idx) => {
  try {
    const step = JSON.parse(line);
    if (step.tool_calls) {
      step.tool_calls.forEach((tc, tcIdx) => {
        const name = tc.name;
        let args = tc.arguments;
        if (typeof args === 'string') {
          args = JSON.parse(args);
        }
        if (args) {
          // Check in ReplacementContent or CodeContent or ReplacementChunks
          let found = false;
          let content = '';
          if (args.CodeContent && args.CodeContent.includes('fetchChapterList')) {
            found = true;
            content = args.CodeContent;
          }
          if (args.ReplacementContent && args.ReplacementContent.includes('fetchChapterList')) {
            found = true;
            content = args.ReplacementContent;
          }
          if (args.ReplacementChunks) {
            args.ReplacementChunks.forEach(chunk => {
              if (chunk.ReplacementContent && chunk.ReplacementContent.includes('fetchChapterList')) {
                found = true;
                content = chunk.ReplacementContent;
              }
            });
          }

          if (found) {
            console.log(`Step ${step.step_index}: tool ${name} contains fetchChapterList. Length: ${content.length}`);
            fs.writeFileSync(`C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\84d2f494-e6eb-4bff-9f84-314e4802fe7c\\scratch\\extracted_step_${step.step_index}_${tcIdx}.jsx`, content);
          }
        }
      });
    }
  } catch (e) {}
});
