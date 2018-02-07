// es-lint camelcase: off
import express from 'express'
import path from 'path'
import graphqlHTTP from 'express-graphql'
import bodyParser from 'body-parser'
import rp from 'request-promise'
import fs from 'fs'
import cors from 'cors'

import routes from './routes'
import oasgql from './oasgql'

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const loopback = {
  oasSchema: require('./schema/loopback-autopark.json'),
  mapping: require('./schema/loopback-autopark.map.js').default
}

const active = loopback
const gqlSchema = oasgql(active.oasSchema, active.mapping)
app.use(
  '/graphql',
  graphqlHTTP({
    schema: gqlSchema,
    graphiql: true
  })
)

// app.use(express.static(path.join(__dirname, 'public')))

const PORT = process.env.PORT || 4000
app
  .listen(PORT, () => {
    console.log('\n')
    console.log(`Running a GraphQL API server at localhost:${PORT}/graphql`)
    console.log(`Running a REST API server at localhost:${PORT}/api`)
    console.log(`Test status at localhost:${PORT}/api/status`)
    console.log(`Check schema at localhost:${PORT}/schema`)
  })
  .on('error', (err) =>
    console.error(`\n\nCould not start server, port ${PORT} already in use?\n`, 'Error message:', err.message)
  )
