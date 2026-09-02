import app from './app.js'

export default (req, res) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url
  }
  app(req, res, (err) => {
    if (err) {
      res.status(500).json({ error: err.message })
    } else if (!res.headersSent) {
      res.status(404).json({ error: 'Not found' })
    }
  })
}
