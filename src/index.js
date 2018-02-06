// es-lint camelcase: off
import express from 'express'
import path from 'path'
import graphqlHTTP from 'express-graphql'
import bodyParser from 'body-parser'
import rp from 'request-promise'
import fs from 'fs'
import cors from 'cors'

import db from './fake-db'
import routes from './routes'
import oasgql from './oasgql'
import token from './oasgql/token'

token.access_token = fs.readFileSync('public/access_token', 'utf8')

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const fleet = {
  oasSchema: require('./schema/vehicle-fleet.json'),
  mapping: require('./schema/vehicle-fleet.map.js').default
}

const gmail = {
  oasSchema: require('./schema/gmail.json'),
  mapping: require('./schema/gmail.map.js').default
}

const restdb = {
  oasSchema: require('./schema/rest-db-autopark.json'),
  mapping: require('./schema/rest-db-autopark.map.js').default
}

const loopback = {
  oasSchema: require('./schema/loopback-autopark.json'),
  mapping: require('./schema/loopback-autopark.map.js').default
}

const active = loopback
const gqlSchema = oasgql(active.oasSchema, active.mapping)
const loaders = {}
app.use(
  '/graphql',
  graphqlHTTP({
    // context: { loaders },
    schema: gqlSchema,
    graphiql: true
  })
)

app.use('/api', routes)

app.use(express.static(path.join(__dirname, 'public')))

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'))
})

app.get('/auth', (req, res) => {
  console.log(req.query.code)
  rp({
    uri: 'https://www.googleapis.com/oauth2/v4/token',
    method: 'POST',
    form: {
      client_id: '470776123175-b8il61dsri8blpqkvj1oriohkmvkejl1.apps.googleusercontent.com',
      client_secret: 'UCg4lPYpWlhTTjTe9IiNWjrG',
      access_type: 'offline',
      redirect_uri: 'http://localhost:4000/auth',
      grant_type: 'authorization_code',
      code: req.query.code
    }
  })
    .then((success, err) => {
      console.log(success, err)
      token.access_token = JSON.parse(success).access_token
      fs.writeFile('public/access_token', token.access_token, (err) => console.log('done!', err))
      console.log(token)

      res.redirect('/graphql')
    })
    .catch((err) => {
      console.log('ERROR', err.message)
      res.send(err.message)
    })
})

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
