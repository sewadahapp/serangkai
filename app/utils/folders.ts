/**
 * Folder pickers use Selaras SSelect, which is built on Reka UI. Reka forbids
 * an option value of `''` (it reserves the empty string for "clear"), so a
 * non-empty sentinel represents "no folder / top level" in the UI and is
 * converted back to `null` at the API boundary.
 */
export const NO_FOLDER = '__serangkai_no_folder__'

export function folderSelection(folderId: string | null | undefined): string {
  return folderId || NO_FOLDER
}

export function folderIdFromSelection(value: string | null | undefined): string | null {
  return value && value !== NO_FOLDER ? value : null
}
