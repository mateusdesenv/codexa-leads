import serverless from 'serverless-http'
import app from './app.js'

console.log('[api] handler loaded')

export default serverless(app)
