# Extractor Pack Agent Guide

> Agent operating rules for maintaining the @topogram/extractor-storybook-design extractor pack safely.

Status: current
Audience: coding agents and humans maintaining this extractor package
Use when: you are editing extractor detection, extraction, fixtures, package metadata, or verification in this repo.

This repository is a Topogram extractor pack for static Storybook CSF component mapping evidence on the `ui` track.

## Rules

- Extractors are read-only. Do not mutate source app files.
- Do not write canonical `topo/**`, `topogram.project.json`, patches, adoption plans, or generated app output.
- Do not install packages or perform network access during detection or extraction.
- Return review-only `findings`, `candidates`, and `diagnostics`; Topogram core owns persistence, reconcile, adoption, and canonical writes.
- Keep candidate evidence project-relative and portable.
- Use scalar `stacks: ["framework"]` and `frameworks: ["tool"]` metadata buckets.
- Emit `component_mappings` only from explicit `parameters.topogram` story metadata.
- Use only canonical Topogram widget or embedded patterns in component mapping candidates. Unknown patterns and layout/shell patterns such as `app_header`, `primary_navigation`, and `footer_bar` should become findings with missing-decision guidance.
- Treat MDX, generated `storybook-static`, screenshots, and runtime Storybook execution as out of scope for v1.
- Never use source import paths as canonical `component_ref` values.
- Keep `llms.txt` and `llms-full.txt` current when README or agent guidance changes.
- Run `npm run check` before committing. It must prove extractor check, real fixture extraction, extract plan, query extract-plan, adopt list, docs RAG check, and unchanged fixture source.
- Run `npm run release:preflight` before publishing or sharing. It adds package dry-run and secret scanning to `npm run check`.

## Local Engine Testing

```bash
TOPOGRAM_CLI=/absolute/path/to/topogram/engine/src/cli.js npm run check
```

SDLC is recommended for shared or published extractor packs. If adopted, keep extractor rules and tasks in the package repo's `topo/` workspace so agents can query them.
