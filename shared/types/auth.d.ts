// Shape of the sealed browser session managed by Nuxt Auth Utils.
declare module '#auth-utils' {
  interface User {
    id: string
    username: string
  }

  interface UserSession {
    loggedInAt?: Date | string
  }
}

export {}
