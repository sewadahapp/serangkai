export interface User {
  id: string
  email: string
  username: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ApiToken {
  id: string
  name: string
  scopes: string[]
  lastUsedAt: Date | null
  expiresAt: Date | null
  createdAt: Date
}

export interface Folder {
  id: string
  userId: string
  parentId: string | null
  name: string
  path: string
  createdAt: Date
  updatedAt: Date
}

export interface Rangka {
  id: string
  userId: string
  folderId: string | null
  slug: string
  title: string
  type: 'markdown' | 'html' | 'javascript' | 'pdf' | 'image' | 'json' | 'bundle'
  visibility: 'private' | 'public' | 'unlisted'
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AuthSession {
  user: User
}
