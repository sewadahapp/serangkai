import type { Component } from 'vue'

/**
 * Lets the workspace page put its folder tree into the layout's sidebar.
 *
 * The sidebar renders inline on desktop and inside a drawer on mobile, where
 * the drawer content only exists while it is open, so a Teleport target is
 * not reliable. The page registers a component instead and the layout renders
 * it wherever the sidebar body currently lives.
 *
 * Module-level on purpose: it is only ever written on the client (in
 * onMounted), so it never carries state between server requests.
 */
const folderPanel = shallowRef<Component | null>(null)

export const useWorkspaceSidebar = () => folderPanel
