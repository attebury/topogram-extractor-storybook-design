const fs = require("node:fs");
const path = require("node:path");

const manifest = require("./topogram-extractor.json");

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".svelte-kit",
  ".storybook-cache",
  ".topogram",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "storybook-static",
  "tmp"
]);

const STORY_FILE_PATTERN = /\.stories\.(js|jsx|ts|tsx)$/i;
const MDX_STORY_PATTERN = /\.stories\.mdx$/i;
const STORYBOOK_MAIN_PATTERN = /(^|\/)\.storybook\/main\.(js|cjs|mjs|ts)$/i;

function rootDir(context) {
  return context.paths.inputRoot || context.paths.workspaceRoot || process.cwd();
}

function normalizeRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/") || ".";
}

function readText(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  } catch {
    return null;
  }
}

function readJson(filePath) {
  const text = readText(filePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function idHintify(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function listFilesRecursive(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) visit(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }
  visit(root);
  return files.sort();
}

function dependencyNames(root) {
  const pkg = readJson(path.join(root, "package.json"));
  if (!pkg || typeof pkg !== "object") return [];
  const names = new Set();
  for (const bucket of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const dependencies = pkg[bucket];
    if (dependencies && typeof dependencies === "object" && !Array.isArray(dependencies)) {
      for (const dependency of Object.keys(dependencies)) names.add(dependency);
    }
  }
  return [...names].sort();
}

function hasStorybookDependency(root) {
  return dependencyNames(root).some((dependency) => dependency === "storybook" || dependency.startsWith("@storybook/"));
}

function findObjectBlockAfter(text, marker) {
  const markerIndex = text.search(marker);
  if (markerIndex === -1) return null;
  const start = text.indexOf("{", markerIndex);
  if (start === -1) return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function keyPattern(key) {
  return new RegExp(`(?:^|[,{\\s])${key}\\s*:\\s*`, "m");
}

function readStringField(block, ...keys) {
  for (const key of keys) {
    const match = new RegExp(`(?:^|[,\\s{])${key}\\s*:\\s*(["'\`])([^"'\`]+)\\1`, "m").exec(block);
    if (match) return match[2].trim();
    const bare = new RegExp(`(?:^|[,\\s{])${key}\\s*:\\s*([A-Za-z0-9_.:-]+)`, "m").exec(block);
    if (bare) return bare[1].trim();
  }
  return null;
}

function readArrayField(block, ...keys) {
  for (const key of keys) {
    const match = keyPattern(key).exec(block);
    if (!match) continue;
    const start = block.indexOf("[", match.index);
    if (start === -1) continue;
    const end = block.indexOf("]", start + 1);
    if (end === -1) continue;
    const raw = block.slice(start + 1, end);
    const quoted = [...raw.matchAll(/["'`]([^"'`]+)["'`]/g)].map((item) => item[1].trim()).filter(Boolean);
    if (quoted.length > 0) return quoted;
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function topogramMetadataForStory(text) {
  return findObjectBlockAfter(text, /\btopogram\s*:/);
}

function storyCandidateFromMetadata(root, filePath, metadataBlock) {
  const relative = normalizeRelative(root, filePath);
  const metadata = {
    widget: readStringField(metadataBlock, "widget"),
    designLanguage: readStringField(metadataBlock, "designLanguage", "design_language"),
    componentMap: readStringField(metadataBlock, "componentMap", "component_map"),
    componentRef: readStringField(metadataBlock, "componentRef", "component_ref"),
    platform: readStringField(metadataBlock, "platform"),
    viewport: readStringField(metadataBlock, "viewport"),
    pattern: readStringField(metadataBlock, "pattern"),
    status: readStringField(metadataBlock, "status"),
    density: readStringField(metadataBlock, "density"),
    stateCoverage: readArrayField(metadataBlock, "stateCoverage", "state_coverage"),
    roleContexts: readArrayField(metadataBlock, "roleContexts", "role_contexts"),
    themeContexts: readArrayField(metadataBlock, "themeContexts", "theme_contexts"),
    localeContexts: readArrayField(metadataBlock, "localeContexts", "locale_contexts"),
    behaviorsRendered: readArrayField(metadataBlock, "behaviorsRendered", "behaviors_rendered"),
    behaviorsContractOnly: readArrayField(metadataBlock, "behaviorsContractOnly", "behaviors_contract_only"),
    behaviorsImplementationOwned: readArrayField(metadataBlock, "behaviorsImplementationOwned", "behaviors_implementation_owned"),
    behaviorsUnsupported: readArrayField(metadataBlock, "behaviorsUnsupported", "behaviors_unsupported")
  };
  const required = ["widget", "designLanguage", "componentRef", "platform", "pattern", "status"];
  const missing = required.filter((key) => !metadata[key]);
  if (missing.length > 0) {
    return {
      finding: {
        kind: "storybook_topogram_metadata_incomplete",
        message: `Storybook topogram metadata in ${relative} is missing: ${missing.join(", ")}.`,
        evidence: [{ file: relative, reason: "parameters.topogram is present but incomplete" }],
        missing_decisions: missing.map((key) => `set parameters.topogram.${key}`)
      }
    };
  }
  const widgetSlug = idHintify(metadata.widget.replace(/^widget_/, ""));
  const platformSlug = idHintify(metadata.platform);
  const refSlug = idHintify(metadata.componentRef.split(".").slice(-1)[0] || metadata.componentRef);
  const componentMap = metadata.componentMap || `component_map_${widgetSlug}`;
  const evidence = [{ file: relative, reason: "Storybook CSF parameters.topogram maps widget to component ref" }];
  const widgetCandidate = {
    id_hint: metadata.widget,
    label: titleCase(metadata.widget.replace(/^widget_/, "")),
    confidence: "low",
    source_kind: "storybook_design_metadata",
    pattern: metadata.pattern,
    region: metadata.pattern === "resource_table" ? "results" : "content",
    data_prop: metadata.pattern === "resource_table" ? "rows" : "items",
    evidence,
    missing_decisions: [
      "confirm reusable widget contract before adopting",
      "confirm props, behaviors, events, and regions from product UI intent"
    ]
  };
  const candidate = {
    id_hint: `${widgetSlug}_${platformSlug}_${refSlug}`,
    component_map_id_hint: componentMap,
    design_language_id_hint: metadata.designLanguage,
    widget_id: metadata.widget,
    platform: metadata.platform,
    component_ref: metadata.componentRef,
    pattern: metadata.pattern,
    status: metadata.status,
    confidence: "high",
    evidence,
    missing_decisions: metadata.componentMap ? [] : ["confirm component map grouping"],
    source_kind: "storybook_csf_metadata"
  };
  if (metadata.viewport) candidate.viewport = metadata.viewport;
  if (metadata.density) candidate.density = metadata.density;
  if (metadata.stateCoverage.length > 0) candidate.state_coverage = metadata.stateCoverage;
  if (metadata.roleContexts.length > 0) candidate.role_contexts = metadata.roleContexts;
  if (metadata.themeContexts.length > 0) candidate.theme_contexts = metadata.themeContexts;
  if (metadata.localeContexts.length > 0) candidate.locale_contexts = metadata.localeContexts;
  if (metadata.behaviorsRendered.length > 0) candidate.behaviors_rendered = metadata.behaviorsRendered;
  if (metadata.behaviorsContractOnly.length > 0) candidate.behaviors_contract_only = metadata.behaviorsContractOnly;
  if (metadata.behaviorsImplementationOwned.length > 0) candidate.behaviors_implementation_owned = metadata.behaviorsImplementationOwned;
  if (metadata.behaviorsUnsupported.length > 0) candidate.behaviors_unsupported = metadata.behaviorsUnsupported;
  return { candidate, widgetCandidate };
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function sourceSummary(root) {
  const files = listFilesRecursive(root);
  return {
    files,
    storyFiles: files.filter((file) => STORY_FILE_PATTERN.test(file)),
    mdxStoryFiles: files.filter((file) => MDX_STORY_PATTERN.test(file)),
    mainFiles: files.filter((file) => STORYBOOK_MAIN_PATTERN.test(normalizeRelative(root, file))),
    hasGeneratedStorybookOutput: fs.existsSync(path.join(root, "storybook-static")),
    hasDependency: hasStorybookDependency(root)
  };
}

exports.manifest = manifest;
exports.extractors = [{
  id: "ui.storybook-design",
  track: "ui",
  detect(context) {
    const root = rootDir(context);
    const summary = sourceSummary(root);
    const reasons = [];
    if (summary.hasDependency) reasons.push("Storybook dependency found.");
    if (summary.mainFiles.length > 0) reasons.push("Storybook main config found.");
    if (summary.storyFiles.length > 0) reasons.push("Static CSF story files found.");
    const score = summary.hasDependency || summary.mainFiles.length > 0 ? 0.9 : summary.storyFiles.length > 0 ? 0.65 : 0;
    return { score, reasons };
  },
  extract(context) {
    const root = rootDir(context);
    const summary = sourceSummary(root);
    const findings = [];
    const diagnostics = [];
    const designRealizations = [];
    const widgets = [];

    if (summary.hasGeneratedStorybookOutput) {
      diagnostics.push({
        level: "info",
        message: "Ignored generated storybook-static output; Storybook design extraction reads source CSF files only.",
        evidence: ["storybook-static"]
      });
    }

    for (const filePath of summary.mdxStoryFiles) {
      findings.push({
        kind: "storybook_mdx_unsupported",
        message: "Storybook MDX stories are not supported by this extractor version.",
        evidence: [{ file: normalizeRelative(root, filePath), reason: "MDX support is intentionally out of scope for v1" }],
        missing_decisions: ["represent this component mapping in CSF parameters.topogram or adopt manually"]
      });
    }

    for (const filePath of summary.storyFiles) {
      const text = readText(filePath) || "";
      const metadataBlock = topogramMetadataForStory(text);
      if (!metadataBlock) {
        findings.push({
          kind: "storybook_topogram_metadata_missing",
          message: `Storybook story ${normalizeRelative(root, filePath)} has no parameters.topogram metadata.`,
          evidence: [{ file: normalizeRelative(root, filePath), reason: "CSF story has no explicit Topogram design metadata" }],
          missing_decisions: ["add explicit parameters.topogram metadata before adopting a component mapping"]
        });
        continue;
      }
      const parsed = storyCandidateFromMetadata(root, filePath, metadataBlock);
      if (parsed.candidate) designRealizations.push(parsed.candidate);
      if (parsed.widgetCandidate) widgets.push(parsed.widgetCandidate);
      if (parsed.finding) findings.push(parsed.finding);
    }

    return {
      findings,
      candidates: {
        component_mappings: designRealizations,
        widgets,
        stacks: summary.hasDependency || summary.mainFiles.length > 0 || summary.storyFiles.length > 0 ? ["storybook"] : []
      },
      diagnostics
    };
  }
}];
