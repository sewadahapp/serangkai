// Older saved HTML may link this trusted stylesheet directly. Keep the asset
// URL working while all newly rendered documents use the Rangka name.
export default defineEventHandler(event => sendRedirect(event, '/rangka-themes/selaras-document.css', 308))
