import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareVersions, parseVersion } from '../scripts/check-release-version.mjs'

const v = version => parseVersion(version)

test('release versions must be valid semver', () => {
  assert.ok(v('1.2.3'))
  assert.ok(v('0.1.0'))
  assert.ok(v('1.0.0-rc.1'))
  for (const bad of ['', 'v1.2.3', '1.2', '1.2.3.4', 'latest', '1.2.x', null, undefined]) {
    assert.equal(parseVersion(bad), null, `${bad} must be rejected`)
  }
})

test('a release version must advance, never step backwards', () => {
  // changelogen -r accepts a downgrade and tags it, which would publish an
  // image sorting before its predecessor. The guard has to catch that.
  assert.ok(compareVersions(v('0.1.0'), v('0.0.9')) > 0)
  assert.ok(compareVersions(v('0.0.9'), v('0.1.0')) < 0)
  assert.ok(compareVersions(v('0.1.0'), v('0.1.0')) === 0)
  assert.ok(compareVersions(v('1.0.0'), v('0.9.9')) > 0)
  assert.ok(compareVersions(v('0.2.0'), v('0.10.0')) < 0)
})

test('prereleases sort before their release and after the previous one', () => {
  assert.ok(compareVersions(v('1.0.0-rc.1'), v('1.0.0')) < 0)
  assert.ok(compareVersions(v('1.0.0'), v('1.0.0-rc.1')) > 0)
  assert.ok(compareVersions(v('1.0.0-rc.2'), v('1.0.0-rc.1')) > 0)
  assert.ok(compareVersions(v('1.0.0-beta'), v('1.0.0-rc')) < 0)
  // Numeric identifiers are compared as numbers, not strings.
  assert.ok(compareVersions(v('1.0.0-rc.10'), v('1.0.0-rc.9')) > 0)
  assert.ok(compareVersions(v('0.2.0-rc.1'), v('0.1.0')) > 0)
})
