import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('deployment files require stable secrets and persistent storage at /data', async () => {
  const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8')
  const entrypoint = await readFile(new URL('../docker-entrypoint.sh', import.meta.url), 'utf8')

  assert.match(compose, /ADMIN_USERNAME:\s*\$\{ADMIN_USERNAME:\?/)
  assert.match(compose, /ADMIN_PASSWORD:\s*\$\{ADMIN_PASSWORD:\?/)
  assert.match(compose, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/)
  assert.match(compose, /SHARE_SECRET:\s*\$\{SHARE_SECRET:\?/)
  assert.match(compose, /serangkai-data:\/data/)
  assert.doesNotMatch(compose, /\/app\/data/)
  assert.match(compose, /"bun", "-e"/)

  assert.match(dockerfile, /oven\/bun:1\.4\.0/)
  assert.match(dockerfile, /bun install --frozen-lockfile --ignore-scripts/)
  assert.match(dockerfile, /ENV DATABASE_PATH=\/data\/serangkai\.db/)
  assert.match(dockerfile, /ENV STORAGE_PATH=\/data\/files/)
  assert.match(dockerfile, /COPY --from=build \/docker-app\//)
  const prepare = await readFile(new URL('../scripts/prepare-docker-output.mjs', import.meta.url), 'utf8')
  assert.match(prepare, /start\.mjs/)
  assert.match(dockerfile, /HEALTHCHECK/)
  assert.match(dockerfile, /docker-entrypoint\.sh/)

  assert.match(entrypoint, /DATABASE_PATH/)
  assert.match(entrypoint, /STORAGE_PATH/)
  assert.match(entrypoint, /not writable/)
  assert.match(entrypoint, /scripts\/start\.mjs/)
})

test('published-image compose file keeps secrets, volume, and health checks', async () => {
  const compose = await readFile(new URL('../docker-compose.image.yml', import.meta.url), 'utf8')
  assert.match(compose, /image:\s*\$\{SERANGKAI_IMAGE:\?/)
  assert.match(compose, /ADMIN_USERNAME:\s*\$\{ADMIN_USERNAME:\?/)
  assert.match(compose, /ADMIN_PASSWORD:\s*\$\{ADMIN_PASSWORD:\?/)
  assert.match(compose, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/)
  assert.match(compose, /SHARE_SECRET:\s*\$\{SHARE_SECRET:\?/)
  assert.match(compose, /serangkai-data:\/data/)
  assert.match(compose, /\/api\/health/)
  assert.match(compose, /"bun", "-e"/)
  assert.doesNotMatch(compose, /build:/)
})

test('Docker image workflow publishes multi-arch images without deploying', async () => {
  const workflow = await readFile(new URL('../.github/workflows/docker.yml', import.meta.url), 'utf8')
  assert.match(workflow, /docker\/build-push-action@v6/)
  assert.match(workflow, /ghcr\.io\/\$\{\{ github\.repository \}\}/)
  assert.match(workflow, /linux\/amd64,linux\/arm64/)
  assert.match(workflow, /pull_request/)
  assert.match(workflow, /push:\s*\$\{\{ github\.event_name != 'pull_request' \}\}/)
  assert.doesNotMatch(workflow, /wrangler deploy|vercel deploy/)
})

test('the release workflow publishes the image in the same run as the tag', async () => {
  const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')

  // Manual trigger only, from the default branch.
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /github\.event\.repository\.default_branch/)

  // A tag pushed with GITHUB_TOKEN cannot trigger `on: push: tags`, so building
  // the image in a separate workflow would silently produce no image.
  assert.match(workflow, /docker\/build-push-action@v6/)
  assert.match(workflow, /push: true/)
  assert.match(workflow, /linux\/amd64,linux\/arm64/)
  assert.match(workflow, /changelogen/)

  // The release must not deploy anywhere.
  assert.doesNotMatch(workflow, /wrangler deploy|vercel deploy/)
})

test('the release publishes nothing irreversible until the image is verified', async () => {
  const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
  const at = label => {
    const index = workflow.indexOf(label)
    assert.ok(index >= 0, `release.yml must contain "${label}"`)
    return index
  }

  // Tests gate the build; the build is only ever staged under a commit tag.
  const test = at('bun run test:ci')
  const build = at('Build and stage the image')
  const smoke = at('Smoke test the staged image')
  const promote = at('Promote to the version tag and latest')
  const push = at('Push the release commit and tag')
  const release = at('gh release create')

  assert.ok(test < build, 'tests must run before the image is built')
  assert.ok(build < smoke, 'the image must be built before it is smoke tested')
  assert.ok(smoke < promote, 'the image must pass its smoke test before promotion')
  assert.ok(promote < push, 'the version tag must exist before the git tag is pushed')
  assert.ok(push < release, 'the git tag must be pushed before the GitHub release')

  // Staging must not use the version tag directly, or a failed smoke test
  // would leave a published version behind.
  assert.match(workflow, /tags: \$\{\{ env\.IMAGE \}\}:\$\{\{ steps\.release\.outputs\.stage \}\}/)
  assert.match(workflow, /docker buildx imagetools create/)

  // GHCR login has to precede anything that pushes.
  assert.ok(at('Log in to GHCR') < build, 'must authenticate to GHCR before pushing')
})

test('an interrupted release resumes instead of rebuilding or overwriting', async () => {
  const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')

  // A rerun must detect prior progress and either resume or refuse.
  assert.match(workflow, /Check for an interrupted release/)
  assert.match(workflow, /scripts\/release-image-state\.mjs/)
  assert.match(workflow, /scripts\/release-candidate\.mjs/)
  assert.match(workflow, /name: release-candidate/)
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/)
  assert.match(workflow, /git push --atomic/)
  assert.match(workflow, /gh release view/)
  // A recovered staging tag may be left by a FAILED smoke test. Test it again.
  const smoke = workflow.slice(workflow.indexOf('- name: Smoke test the staged image'), workflow.indexOf('- name: Promote to the version tag and latest'))
  assert.doesNotMatch(smoke, /if:/)
  assert.match(smoke, /steps\.image\.outputs\.reference/)
  assert.match(workflow, /all\(\.metadata\.container\.tags\[\]; startswith\("sha-"\)\)/)
})

test('the rehearsal builds and smoke tests without publishing', async () => {
  const workflow = await readFile(new URL('../.github/workflows/release-rehearsal.yml', import.meta.url), 'utf8')

  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /permissions:\s*\n\s*contents: read/)
  assert.match(workflow, /push: false/)
  assert.match(workflow, /load: true/)

  // A rehearsal must not publish anything at all.
  assert.doesNotMatch(workflow, /packages: write/)
  assert.doesNotMatch(workflow, /git push/)
  assert.doesNotMatch(workflow, /gh release create/)
  assert.doesNotMatch(workflow, /docker\/login-action/)
})

test('the Deploy to Cloudflare button has a build path, secrets, and auto-provisioned bindings', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
  const devVars = await readFile(new URL('../.dev.vars.example', import.meta.url), 'utf8')
  const config = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8')

  // The button must point at this repository and be visible in the README.
  assert.match(readme, /deploy\.workers\.cloudflare\.com\/button/)
  assert.match(readme, /deploy\.workers\.cloudflare\.com\/\?url=https:\/\/github\.com\/sewadahapp\/serangkai/)

  // The deploy script must build the Cloudflare preset before Wrangler runs;
  // a node-server build would pull in better-sqlite3 and fail on Workers.
  assert.match(pkg.scripts.deploy, /build:cloudflare/)
  assert.match(pkg.scripts.deploy, /wrangler deploy/)

  // Every runtime secret is prompted from the example file and described in
  // the deploy setup page.
  for (const key of ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET', 'SHARE_SECRET', 'NUXT_APP_SECRET']) {
    assert.match(devVars, new RegExp(`^${key}=`, 'm'), `${key} must be in .dev.vars.example`)
    assert.ok(pkg.cloudflare?.bindings?.[key], `${key} must have a Cloudflare binding description`)
  }
  assert.match(gitignore, /!\.dev\.vars\.example/)

  // Account-specific ids and bucket names are omitted so the button and
  // Wrangler can provision them for the deploying account.
  assert.doesNotMatch(config, /"database_id"/)
  assert.doesNotMatch(config, /"bucket_name"/)
})

test('the checked-in Wrangler config serves static assets', async () => {
  // Nitro's Cloudflare preset would generate an `assets` binding, but a
  // checked-in wrangler config takes precedence. Without this block
  // `wrangler deploy` uploads the Worker alone and every /_nuxt request 404s,
  // which the dry run cannot catch (it reports the bundle, not the assets).
  const config = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  assert.match(config, /"assets"\s*:\s*\{/)
  assert.match(config, /"binding"\s*:\s*"ASSETS"/)
  assert.match(config, /"directory"\s*:\s*"\.\/\.output\/public"/)

  // The bindings the runtime requires.
  assert.match(config, /"binding"\s*:\s*"DB"/)
  assert.match(config, /"binding"\s*:\s*"RANGKA"/)
  assert.match(config, /nodejs_compat/)
})
