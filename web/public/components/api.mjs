/** Consistent local-service errors; financial responses are never cached. */
export async function api(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, cache: 'no-store', credentials: 'same-origin' }); }
  catch { throw new Error('Accounting could not be reached. Check the local launcher and try again.'); }
  let value;
  try { value = await response.json(); }
  catch { throw new Error('Accounting returned an unreadable response. Refresh and try again.'); }
  if (!response.ok) throw Object.assign(new Error(value.error || 'The request could not be completed.'), { status: response.status });
  return value;
}
