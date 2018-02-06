import {
  GraphQLSchema,
  GraphQLObjectType
} from 'graphql'

import { createTypes } from './type'
import { createQueries } from './query'
import uri from './uri'

const oas2gql = (oasSchema, mapping) => {
  uri.host = oasSchema.host
  uri.basePath = oasSchema.basePath || ''
  uri.securityHeaders = oasSchema.securityHeaders || {}
  if (oasSchema.schemes && oasSchema.schemes.length) {
    uri.protocol = oasSchema.schemes[0]
  }

  createTypes(oasSchema)

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({ name: 'RootQueryType', fields: () => createQueries(oasSchema, mapping) })
    // mutation: new GraphQLObjectType({ name: 'RootMutationType', fields: () => mutationResolvers })
  })
  return schema
}

export default oas2gql
