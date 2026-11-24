import { CONNECTION_LABEL_MAX } from './oauth'

const escape = (value: string) => value
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Styles for the field below; consent pages inline them in their <style>. */
export const connectionNameStyles = `
  label.name{display:grid;gap:.35rem;margin:0 0 1.25rem;padding:0;border:0;cursor:auto}
  label.name span{font-weight:600}
  label.name input{box-sizing:border-box;width:100%;font:inherit;padding:.55rem .7rem;border-radius:.5rem;
    border:1px solid light-dark(#cfc5b2,#3a423e);background:light-dark(#fff,#0f1312);color:inherit}`

/**
 * Clients choose their own name, so two installs of one agent look the same.
 * The owner knows which device or account this is while approving, so the
 * consent pages ask, pre-filled with the client's name.
 */
export function connectionNameField(clientName: string) {
  return `<label class="name" for="connection_name"><span>Connection name</span>
        <input id="connection_name" name="connection_name" type="text" maxlength="${CONNECTION_LABEL_MAX}" value="${escape(clientName)}" autocomplete="off">
        <small>Shown in Settings so you can tell this connection apart, for example by device or account.</small></label>`
}
