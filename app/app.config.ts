export default defineAppConfig({
  selarasDocs: {
    site: {
      name: 'Serangkai',
      description: 'A self-hosted workspace where you and your AI agents publish interactive work.',
      titleTemplate: '%s · Serangkai',
      url: 'https://sewadahapp.github.io/serangkai',
      favicon: '/favicon.svg',
      logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: '' },
    },
    repository: {
      url: 'https://github.com/sewadahapp/serangkai',
      branch: 'site',
      contentDirectory: 'content',
      editLinks: true,
      issueLinks: true,
    },
    header: {
      search: true,
      colorMode: true,
      links: [
        { label: 'Docs', to: '/guide/getting-started' },
        { label: 'Demo', to: 'https://serangkai.onrender.com', target: '_blank', rel: 'noopener' },
      ],
    },
    sidebar: {
      enabled: true,
      collapsed: false,
    },
    toc: {
      enabled: true,
      title: 'On this page',
    },
    footer: {
      text: 'Serangkai is MIT licensed and built with Selaras.',
      links: [
        { label: 'GitHub', to: 'https://github.com/sewadahapp/serangkai' },
      ],
    },
  },
})
