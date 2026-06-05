import { createApi } from './api.js'

const host = '127.0.0.1'
const port = Number(process.env.PPHT_PORT ?? 3737)

createApi().listen(port, host, () => {
  console.log(`PPHT API listening on http://${host}:${port}`)
})
