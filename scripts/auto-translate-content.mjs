#!/usr/bin/env node
/**
 * GoOrganicAfrica multilingual content draft generator.
 *
 * It intentionally creates reviewable PRs rather than silently publishing
 * machine-generated long-form translations. The CMS remains the source of
 * truth; editors can approve/revise the generated language variants.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.log("OPENAI_API_KEY is not configured; translation generation is skipped.");
  process.exit(0);
}

const languages = [
  { code: "fr", name: "French" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "sw", name: "Swahili" }
];

function changedFiles() {
  try {
    return execSync("git diff --name-only HEAD^ HEAD", { encoding: "utf8" })
      .split(/\r?\n/).filter(Boolean)
      .filter(p => /^src\/(blog\/posts|ebooks)\/.*\.md$/.test(p));
  } catch {
    return [];
  }
}

function parseFrontMatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Invalid Markdown front matter");
  return { front: match[1], body: match[2] };
}

function yamlValue(front, key) {
  const m = front.match(new RegExp("^" + key + ":\\s*(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

function setYaml(front, key, value) {
  const line = key + ": " + value;
  const re = new RegExp("^" + key + ":.*$", "m");
  return re.test(front) ? front.replace(re, line) : front + "\n" + line;
}

function slugify(text) {
  return text.toLowerCase()
    .normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function translate(text, language) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      input: [
        {
          role: "system",
          content: "You are a professional agricultural translator. Translate the supplied Markdown content into the requested language. Preserve Markdown headings, lists, links, image URLs, HTML tags, numbers, units, product names, slugs, and technical meaning. Do not summarize, omit, invent, or alter URLs. Return only the translated Markdown body."
        },
        {
          role: "user",
          content: "Translate this content into " + language.name + ":\n\n" + text
        }
      ]
    })
  });
  if (!response.ok) throw new Error("OpenAI translation request failed: " + response.status);
  const data = await response.json();
  const raw = data.output_text || "";\n  const cleaned = raw.replace(/^```json\\s*/i, "").replace(/\\s*```$/i, "").trim();\n  return JSON.parse(cleaned);
}

async function main() {
  const files = changedFiles();
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const { front, body } = parseFrontMatter(source);
    const language = yamlValue(front, "language") || "en";
    if (language !== "en") continue;

    const group = yamlValue(front, "translation_group");
    if (!group) continue;

    const dir = path.dirname(file);
    const base = path.basename(file, ".md");
    for (const target of languages) {
      const outDir = dir;
      const title = yamlValue(front, "title");
      const targetSlug = slugify(title + "-" + target.code);
      const outName = targetSlug + ".md";
      const outPath = path.join(outDir, outName);
      if (fs.existsSync(outPath)) continue;

      const translated = await translate(JSON.stringify({\n        title: yamlValue(front, "title"),\n        description: yamlValue(front, "description"),\n        meta_title: yamlValue(front, "meta_title"),\n        meta_description: yamlValue(front, "meta_description"),\n        category: yamlValue(front, "category"),\n        keywords: yamlValue(front, "keywords"),\n        body\n      }), target);
      let translatedFront = front;
      translatedFront = setYaml(translatedFront, "title", JSON.stringify(translated.title || title));\n      translatedFront = setYaml(translatedFront, "description", JSON.stringify(translated.description || yamlValue(front, "description")));\n      translatedFront = setYaml(translatedFront, "meta_title", JSON.stringify(translated.meta_title || yamlValue(front, "meta_title")));\n      translatedFront = setYaml(translatedFront, "meta_description", JSON.stringify(translated.meta_description || yamlValue(front, "meta_description")));\n      translatedFront = setYaml(translatedFront, "category", JSON.stringify(translated.category || yamlValue(front, "category")));\n      translatedFront = setYaml(translatedFront, "language", target.code);
      translatedFront = setYaml(translatedFront, "source_language", "en");
      translatedFront = setYaml(translatedFront, "translation_group", group);
      translatedFront = setYaml(translatedFront, "translation_status", "in_review");
      translatedFront = setYaml(translatedFront, "slug", targetSlug);
      fs.writeFileSync(outPath, "---\n" + translatedFront + "\n---\n" + translatedBody.trim() + "\n");
      console.log("Created", outPath);
    }
  }
}
main().catch(err => { console.error(err); process.exit(1); });
