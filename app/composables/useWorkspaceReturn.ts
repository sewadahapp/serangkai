/**
 * The workspace URL (folder, search, page) the user last looked at, so the
 * rangka page and the editor can send them back to the same view instead of
 * the workspace root. The layout records it on every workspace navigation.
 */
export const useWorkspaceReturn = () => useState<string | null>('serangkai-workspace-return', () => null)

const isWorkspacePath = (path: string) => path === '/' || path === '/workspace'

/** Records the current route when it is the workspace. Called by the layout. */
export const trackWorkspaceReturn = () => {
  const route = useRoute()
  const last = useWorkspaceReturn()
  watch(() => route.fullPath, () => { if (isWorkspacePath(route.path)) last.value = route.fullPath }, { immediate: true })
}

/**
 * Where "back" leads from a rangka: the last workspace view, or, on a direct
 * visit, the rangka's own folder.
 */
export const workspaceReturnUrl = (last: string | null, folderId?: string | null) =>
  last ?? (folderId ? `/?folder=${encodeURIComponent(folderId)}` : '/')
