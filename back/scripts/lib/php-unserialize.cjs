// Minimal PHP unserialize for WordPress meta (arrays, strings, ints, floats, booleans, null).
// String lengths are byte counts, so parsing works on a UTF-8 Buffer.
function unserialize(input) {
  if (input == null || input === '') return null
  const buf = Buffer.from(String(input), 'utf8')
  let i = 0
  const readUntil = ch => { const start = i; while (i < buf.length && buf[i] !== ch.charCodeAt(0)) i++; const out = buf.toString('utf8', start, i); i++; return out }
  function value() {
    const type = String.fromCharCode(buf[i]); i += 2
    switch (type) {
      case 'N': return null
      case 'b': return readUntil(';') === '1'
      case 'i': return Number(readUntil(';'))
      case 'd': return Number(readUntil(';'))
      case 's': { const len = Number(readUntil(':')); i++; const out = buf.toString('utf8', i, i + len); i += len + 2; return out }
      case 'a': {
        const len = Number(readUntil(':')); i++
        const out = {}
        for (let n = 0; n < len; n++) { const k = value(); out[k] = value() }
        i++
        return out
      }
      default: throw new Error(`Unsupported serialized type ${type}`)
    }
  }
  try { return value() } catch { return null }
}
module.exports = { unserialize }
