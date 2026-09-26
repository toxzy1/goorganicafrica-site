#!/usr/bin/env node
/**
 * GoOrganicAfrica multilingual content draft generator.
 *
 * Creates reviewable PRs rather than silently publishing machine-generated
 * long-form translations. English remains the source of truth.
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
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((p) => /^src\/(blog\/posts|ebooks)\/.*\.md$/.test(p));
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
  const match = front.match(new RegExp("^" + key + ":\\s*(.*)$", "m"));
  return match
    ? match[1].trim().replace(/^["']|["']$/g, "")
    : "";
}

function setYaml(front, key, value) {
  const line = key + ": " + value;
  const re = new RegExp("^" + key + ":.*$", "m");
  return re.test(front) ? front.replace(re, line) : front + "\n" + line;
}

function quoteYaml(value) {
  return JSON.stringify(String(value ?? ""));
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function translate(content, language) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5.6-terra",
      input: [
        {
          role: "system",
          content:
            "You are a professional agricultural translator. Translate the supplied Markdown content into the requested language. Preserve Markdown headings, lists, links, image URLs, HTML tags, numbers, units, product names, and technical meaning. Do not summarize, omit, invent, or alter URLs. Return ONLY a JSON object with exactly these keys: title, description, meta_title, meta_description, category, keywords, body."
        },
        {
          role: "user",
          content:
            "Translate this complete content into " +
            language.name +
            ". Preserve the full body without shortening it:\n\n" +
            content
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      "OpenAI translation request failed: " + response.status + " " + detail
    );
  }

  const data = await response.json();
  const raw = String(data.output_text || "").trim();

  if (!raw) {
    throw new Error("OpenAI returned no translation text.");
  }

  const cleaned = raw
    .replace(/^\s*```json\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let result;
  try {
    result = JSON.parse(cleaned);
  } catch (error) {
    throw new Error("OpenAI returned invalid JSON: " + error.message);
  }

  for (const key of [
    "title",
    "description",
    "meta_title",
    "meta_description",
    "category",
    "keywords",
    "body"
  ]) {
    if (typeof result[key] !== "string") {
      result[key] = "";
    }
  }

  if (!result.body.trim()) {
    throw new Error("OpenAI returned an empty translated body.");
  }

  return result;
}

async function main() {
  const files = changedFiles();

  if (!files.length) {
    console.log("No changed English Blog/eBook Markdown files found.");
    return;
  }

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const { front, body } = parseFrontMatter(source);
    const language = yamlValue(front, "language") || "en";

    if (language !== "en") continue;

    const group = yamlValue(front, "translation_group");
    if (!group) continue;

    const sourceData = {
      title: yamlValue(front, "title"),
      description: yamlValue(front, "description"),
      meta_title: yamlValue(front, "meta_title"),
      meta_description: yamlValue(front, "meta_description"),
      category: yamlValue(front, "category"),
      keywords: yamlValue(front, "keywords"),
      body
    };

    const dir = path.dirname(file);

    for (const target of languages) {
      const targetSlug = slugify(sourceData.title + "-" + target.code);
      const outPath = path.join(dir, targetSlug + ".md");

      if (fs.existsSync(outPath)) {
        console.log("Already exists, skipping:", outPath);
        continue;
      }

      console.log("Translating", file, "to", target.name);
      const translated = await translate(JSON.stringify(sourceData), target);

      let translatedFront = front;
      translatedFront = setYaml(
        translatedFront,
        "title",
        quoteYaml(translated.title || sourceData.title)
      );
      translatedFront = setYaml(
        translatedFront,
        "description",
        quoteYaml(translated.description || sourceData.description)
      );
      translatedFront = setYaml(
        translatedFront,
        "meta_title",
        quoteYaml(translated.meta_title || sourceData.meta_title)
      );
      translatedFront = setYaml(
        translatedFront,
        "meta_description",
        quoteYaml(
          translated.meta_description || sourceData.meta_description
        )
      );
      translatedFront = setYaml(
        translatedFront,
        "category",
        quoteYaml(translated.category || sourceData.category)
      );
      translatedFront = setYaml(
        translatedFront,
        "keywords",
        quoteYaml(translated.keywords || sourceData.keywords)
      );
      translatedFront = setYaml(translatedFront, "language", target.code);
      translatedFront = setYaml(translatedFront, "source_language", "en");
      translatedFront = setYaml(
        translatedFront,
        "translation_group",
        group
      );
      translatedFront = setYaml(
        translatedFront,
        "translation_status",
        "in_review"
      );
      translatedFront = setYaml(translatedFront, "slug", targetSlug);

      fs.writeFileSync(
        outPath,
        "---\n" +
          translatedFront +
          "\n---\n" +
          translated.body.trim() +
          "\n"
      );

      console.log("Created", outPath);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
