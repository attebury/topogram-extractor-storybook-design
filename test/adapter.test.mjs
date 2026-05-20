import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const adapter = require("../index.cjs");

function writeFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "topogram-storybook-extractor-test."));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, contents, "utf8");
  }
  return root;
}

function context(root) {
  return {
    paths: {
      inputRoot: root,
      workspaceRoot: root
    },
    helpers: {
      readTextIfExists(filePath) {
        try {
          return fs.readFileSync(filePath, "utf8");
        } catch {
          return null;
        }
      }
    }
  };
}

test("exports a valid extractor adapter boundary", () => {
  assert.equal(adapter.manifest.id, "@topogram/extractor-storybook-design");
  assert.equal(adapter.manifest.source, "package");
  assert.deepEqual(adapter.manifest.tracks, ["ui"]);
  assert.deepEqual(adapter.manifest.candidateKinds, ["design_realization", "widget", "stack"]);
  assert.equal(Array.isArray(adapter.extractors), true);
  assert.equal(adapter.extractors.length, 1);
  assert.equal(adapter.extractors[0].track, "ui");
  assert.equal(typeof adapter.extractors[0].detect, "function");
  assert.equal(typeof adapter.extractors[0].extract, "function");
});

test("CSF parameters.topogram emits one review-only design realization candidate", () => {
  const root = writeFixture({
    "package.json": JSON.stringify({ devDependencies: { "@storybook/react": "^8.0.0" } }, null, 2),
    ".storybook/main.ts": "export default { stories: ['../src/**/*.stories.tsx'] };\n",
    "src/ReviewQueue.stories.tsx": `export default {
      title: "ReviewQueue",
      parameters: {
        topogram: {
          widget: "widget_review_queue",
          designContract: "design_acme_product_ui",
          realizationSet: "realization_set_review_queue",
          componentRef: "acme.reviewQueue.grid",
          platform: "web",
          viewport: "wide",
          pattern: "resource_table",
          status: "rendered",
          density: "comfortable",
          stateCoverage: ["empty", "loading", "populated"],
          roleContexts: ["reviewer"],
          themeContexts: ["light", "dark"],
          localeContexts: ["en"],
          behaviorsRendered: ["selection", "sorting"],
          behaviorsContractOnly: ["bulk_action"]
        }
      }
    };
`
  });
  const detection = adapter.extractors[0].detect(context(root));
  assert.equal(detection.score, 0.9);
  const output = adapter.extractors[0].extract(context(root));
  assert.deepEqual(output.candidates.stacks, ["storybook"]);
  assert.equal(output.candidates.widgets.length, 1);
  assert.equal(output.candidates.widgets[0].id_hint, "widget_review_queue");
  assert.equal(output.candidates.widgets[0].confidence, "low");
  assert.equal(output.candidates.design_realizations.length, 1);
  const candidate = output.candidates.design_realizations[0];
  assert.equal(candidate.widget_id, "widget_review_queue");
  assert.equal(candidate.design_contract_id_hint, "design_acme_product_ui");
  assert.equal(candidate.realization_set_id_hint, "realization_set_review_queue");
  assert.equal(candidate.component_ref, "acme.reviewQueue.grid");
  assert.equal(candidate.platform, "web");
  assert.deepEqual(candidate.state_coverage, ["empty", "loading", "populated"]);
  assert.deepEqual(candidate.behaviors_rendered, ["selection", "sorting"]);
  assert.deepEqual(candidate.behaviors_contract_only, ["bulk_action"]);
  assert.equal(candidate.evidence[0].file, "src/ReviewQueue.stories.tsx");
  assert.equal("import_path" in candidate, false);
});

test("incomplete Storybook metadata emits findings instead of adoptable candidates", () => {
  const root = writeFixture({
    "src/Incomplete.stories.tsx": `export default {
      parameters: {
        topogram: {
          componentRef: "acme.incomplete.card",
          platform: "web",
          pattern: "summary_card",
          status: "contract_only"
        }
      }
    };
`
  });
  const output = adapter.extractors[0].extract(context(root));
  assert.deepEqual(output.candidates.design_realizations, []);
  assert.equal(output.findings.some((finding) => finding.kind === "storybook_topogram_metadata_incomplete"), true);
  assert.match(output.findings[0].message, /missing: widget, designContract/);
});

test("missing metadata and MDX stories are findings, not candidates", () => {
  const root = writeFixture({
    "src/Plain.stories.tsx": "export default { title: 'Plain' };\n",
    "src/Unsupported.stories.mdx": "import { Meta } from '@storybook/blocks';\n<Meta title=\"Unsupported\" />\n",
    "storybook-static/index.html": "<html></html>\n"
  });
  const output = adapter.extractors[0].extract(context(root));
  assert.deepEqual(output.candidates.design_realizations, []);
  assert.equal(output.findings.some((finding) => finding.kind === "storybook_topogram_metadata_missing"), true);
  assert.equal(output.findings.some((finding) => finding.kind === "storybook_mdx_unsupported"), true);
  assert.equal(output.diagnostics.some((diagnostic) => /storybook-static/.test(diagnostic.message)), true);
});
