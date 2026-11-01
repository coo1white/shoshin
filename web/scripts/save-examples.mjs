import fs from "node:fs";
import path from "node:path";

const API = "https://yokoten-doctor--yokoten-doctor-fastapi-app.us-east.modal.run/api/check";
const samplePath = path.resolve("web/src/data/sample-result.json");
const outDir = path.resolve("web/src/data/examples");

async function main() {
  const raw = fs.readFileSync(samplePath, "utf8");
  const sample = JSON.parse(raw);
  const examples = sample.examples ?? [];
  let failed = false;
  fs.mkdirSync(outDir, { recursive: true });
  for (const ex of examples) {
    const repo = ex.repo;
    try {
      const resp = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://github.com/" + repo }),
      });
      if (!resp.ok || !resp.body) throw new Error("bad response");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = null;
      let fixes = null;
      let record = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawBlock = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!rawBlock.trim()) continue;
          let eventName = "";
          let dataStr = "";
          const lines = rawBlock.split("\n");
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
          }
          if (!eventName) continue;
          let data = null;
          try { data = JSON.parse(dataStr); } catch { data = null; }
          if (eventName === "result") result = data;
          else if (eventName === "fixes") fixes = data;
          else if (eventName === "record") record = data;
        }
      }
      if (!result || !fixes || !record || (fixes.muse !== "ok" && fixes.muse !== "not needed")) {
        console.error(repo);
        failed = true;
        continue;
      }
      const slug = repo.replace(/\//g, "-");
      const outPath = path.join(outDir, slug + ".json");
      const out = { result, fixes, record };
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
    } catch {
      console.error(repo);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}

await main();
