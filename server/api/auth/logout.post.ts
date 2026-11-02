import { deleteCookie } from 'h3'

export default defineEventHandler(async (event) => {
  deleteCookie(event, 'session', { path: '/' })
  return { message: 'Logged out successfully' }
})
