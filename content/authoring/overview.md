---
title: Overview
description: Choose the right kind of rangka for the work.
order: 1
---

# Authoring overview

This section is for anyone writing rangka by hand. Agents connected over MCP
get the same information from the server itself: they should call
`get_rangka_capabilities` and read the `serangkai://guides/*`,
`serangkai://components/selaras`, and `serangkai://templates/*` resources.

## Choose a type

| Need | Use |
| --- | --- |
| Report, documentation, explanation | [Markdown](/authoring/markdown) |
| Data summary with charts and cards | [Markdown](/authoring/markdown) with charts and components |
| Flowchart, sequence, architecture, or state diagram | [Markdown](/authoring/markdown) with Mermaid |
| Styled HTML report | [HTML](/authoring/html) with the Selaras document theme |
| Custom dashboard or prototype | [HTML](/authoring/html), self-styled |
| Existing Vue, React, or static frontend | [Bundle](/authoring/html#bundles) |

You can also upload JSON, PDF, and images. Images created from text must be SVG.

## Start with Markdown

Markdown needs no CSS or JavaScript and renders with polished Selaras styling
in light and dark mode. Reach for HTML only when the work needs custom
interaction or layout that Markdown components cannot express.

## Prompts

The MCP server also ships prompts that give an agent a starting point:
`create_report`, `create_dashboard`, `create_html_document`,
`create_custom_dashboard`, and `create_canvas_board`.
