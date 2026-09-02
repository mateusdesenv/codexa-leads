const serverless = require('serverless-http')
const app = require('./app.cjs')

module.exports = serverless(app)
