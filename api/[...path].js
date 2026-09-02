import app from './app.js'

export default (req, res) => {
  console.log('[api] raw', req.method, req.url, req.query)
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url
  }
  app(req, res, (err) => {
    console.log('[api] final', err?.message)
    if (err) {
      res.status(500).json({ error: err.message })
    } else if (!res.headersSent) {
      res.status(404).json({ error: 'Not found' })
    }
  })
}
