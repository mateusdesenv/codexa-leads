require('dotenv').config()

const app = require('./app.cjs')

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
