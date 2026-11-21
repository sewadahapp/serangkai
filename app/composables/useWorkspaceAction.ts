/**
 * A workspace dialog requested from elsewhere (the command palette). The
 * workspace page owns the Upload and New folder dialogs, so other places set
 * this and navigate to the workspace, which opens the dialog and clears it.
 */
export type WorkspaceAction = 'upload' | 'new-folder'

export const useWorkspaceAction = () => useState<WorkspaceAction | null>('serangkai-workspace-action', () => null)
