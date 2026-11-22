---
title: Homepage hero patterns
description: Choose and customize a split or centered landing-page hero.
---

# Homepage hero patterns

The starter includes two landing-page hero components. Use `DocsHomeHero` for a split layout with intro copy and a compact preview panel. Use `DocsHomeHeroAlt` for a centered headline and a larger visual preview, such as a product screenshot. Set `heroVariant` to `split` or `centered` in `app/pages/index.vue` to choose the homepage variant.

Both components render their calls to action with Selaras `SButton` and Nuxt links. Set the labels and routes with props, then replace the preview through its named slot when you have a product-specific visual.

## Split hero

Use `DocsHomeHero` when you want the introduction and the preview side by side on wide screens:

```vue
<DocsHomeHero
  eyebrow="DEVELOPER DOCUMENTATION"
  title="Build something useful."
  description="Guides and references to help your team get started."
  primary-label="Get started"
  primary-to="/guide/getting-started"
  secondary-label="Explore the API"
  secondary-to="/reference/api"
/>
```

The default preview shows a short reading path and the docs folder structure. Replace it with your own content through the `preview` slot:

```vue
<DocsHomeHero title="A clear start for every project.">
  <template #preview>
    <img
      src="/images/product-preview.png"
      alt="Screenshot of the product's getting started guide"
      class="w-full rounded-xl"
    >
  </template>
</DocsHomeHero>
```

## Centered hero with a visual

Use `DocsHomeHeroAlt` for a centered message followed by a larger preview. It includes a docs-page mockup by default, which you can replace with an image, video, or Vue component in the `visual` slot:

```vue
<DocsHomeHeroAlt
  eyebrow="PRODUCT DOCUMENTATION"
  announcement="Version 2 is available"
  title="Everything you need to move forward."
  description="Learn the basics, explore the guides, and find answers in the reference."
  primary-label="Read the guide"
  primary-to="/guide/getting-started"
  secondary-label="View the API"
  secondary-to="/reference/api"
  visual-position="bottom"
>
  <template #visual>
    <img
      src="/images/docs-preview.png"
      alt="Preview of the documentation site"
      class="w-full"
    >
  </template>
</DocsHomeHeroAlt>
```

Set `visual-position="top"` to place the visual before the text. Keep meaningful alternative text on images, and remove the announcement prop when there is no current release or update to highlight.

## Choose a variant

| Component | Layout | Preview slot |
| --- | --- | --- |
| `DocsHomeHero` | Intro and compact preview side by side | `#preview` |
| `DocsHomeHeroAlt` | Centered intro with a wide visual | `#visual` |

Both components accept `eyebrow`, `title`, `description`, `primaryLabel`, `primaryTo`, `secondaryLabel`, and `secondaryTo`. The alternate hero also accepts `announcement` and `visualPosition`.
