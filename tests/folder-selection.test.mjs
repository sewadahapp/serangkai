import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NO_FOLDER, folderSelection, folderIdFromSelection } from '../app/utils/folders.ts'

test('folder selections use a non-empty sentinel that maps back to null', () => {
  assert.equal(NO_FOLDER.length > 0, true)
  assert.notEqual(NO_FOLDER, '')
  assert.equal(folderSelection(null), NO_FOLDER)
  assert.equal(folderSelection(undefined), NO_FOLDER)
  assert.equal(folderSelection('folder-1'), 'folder-1')
  assert.equal(folderIdFromSelection(NO_FOLDER), null)
  assert.equal(folderIdFromSelection(undefined), null)
  assert.equal(folderIdFromSelection('folder-1'), 'folder-1')
})
