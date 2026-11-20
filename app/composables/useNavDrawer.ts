/**
 * Open state of the mobile navigation drawer (below 1024px). Shared so the
 * top bar menu button and the workspace's "Browse folders" button open the
 * same drawer; the layout closes it after every navigation.
 */
export const useNavDrawer = () => useState('serangkai-nav-drawer', () => false)
