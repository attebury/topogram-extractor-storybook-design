# @topogram/extractor-storybook-design

> Package-backed Topogram extractor for static Storybook CSF component mapping evidence.

Status: current
Audience: extractor authors, front-end leads, designers, and agents
Use when: you want Storybook stories to propose review-only widget-to-component mappings for Topogram adoption.

This extractor reads source `*.stories.js`, `*.stories.jsx`, `*.stories.ts`,
and `*.stories.tsx` files. It does not run Storybook, execute components,
inspect screenshots, read `storybook-static`, or parse MDX in v1.

## Metadata Contract

Add explicit metadata to the default CSF story meta:

```ts
export default {
  title: "Components/ReviewQueueGrid",
  component: ReviewQueueGrid,
  parameters: {
    topogram: {
      widget: "widget_review_queue",
      designLanguage: "design_acme_product_ui",
      componentMap: "component_map_review_queue",
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
```

The extractor emits `component_mappings` only when `widget`,
`designLanguage`, `componentRef`, `platform`, `pattern`, and `status` are
explicit. Incomplete stories become findings with missing-decision guidance.
`componentRef` is a stable design-system identity, not a source import path.
When the story names a widget, the extractor also emits a low-confidence widget
review candidate so adoption can either link to an existing widget or make the
missing semantic-widget decision visible.

## Consumer Loop

```bash
npm install -D @topogram/extractor-storybook-design
topogram extractor policy pin @topogram/extractor-storybook-design@1
topogram extractor check @topogram/extractor-storybook-design
topogram extract ./component-library --out ./extracted-topogram --from ui --extractor @topogram/extractor-storybook-design
topogram extract plan ./extracted-topogram --json
topogram adopt --list ./extracted-topogram --json
topogram adopt component-mappings ./extracted-topogram --dry-run --json
topogram adopt component-mappings ./extracted-topogram --write --json
```

Extraction writes review candidates and provenance only. Canonical
`design_component_map` records are written only through explicit Topogram
adoption.

## Author Loop

```bash
npm install
npm test
npm run docs:rag:check
TOPOGRAM_CLI=/path/to/topogram/engine/src/cli.js npm run check
npm run release:preflight
```

`npm run check` uses `TOPOGRAM_CLI`, then `TOPOGRAM_BIN`, then the locally
installed `@topogram/cli`. It runs extractor check, package-backed extraction,
extract plan, query extract-plan, adopt list, docs checks, and a fixture
mutation guard.

Keep `llms.txt` curated and regenerate `llms-full.txt` after README or agent
guidance changes:

```bash
npm run docs:rag:build
npm run docs:rag:check
```

## Safety Boundary

- Extractors are read-only.
- Do not mutate source app files.
- Do not write canonical `topo/**`, patches, adoption plans, or app output.
- Do not install packages or perform network access during detection or extraction.
- Return only review-only `findings`, `candidates`, and `diagnostics`.
- Keep evidence project-relative and portable.
