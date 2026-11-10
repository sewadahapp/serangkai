// Shape of the sealed browser session managed by Nuxt Auth Utils.
declare module '#auth-utils' {
  interface User {
    id: string
    username: string
  }

  interface UserSession {
    loggedInAt?: Date | string
    /**
     * Pending OAuth consent requests rendered by GET, keyed by a hash of the
     * full authorization request. The POST consumes one exactly once.
     */
    oauthConsent?: Array<{
      hash: string
      nonce: string
      userId: string
      expiresAt: number
    }>
  }
}

export {}
