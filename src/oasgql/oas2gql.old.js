import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLString,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLID
} from 'graphql'
import rp from 'request-promise'
import { takeRight, orderBy } from 'lodash'
import { TypeComposer } from 'graphql-compose'
import camelcase from 'camelcase'

const types = {}
const typeNotFound = new GraphQLObjectType({ name: 'TYPE_NOT_FOUND' })

const IntWhereArgs = new GraphQLInputObjectType({
  name: 'IntWhereArgs',
  fields: { eq: { type: GraphQLInt }, gt: { type: GraphQLInt }, lt: { type: GraphQLInt } }
})

const StringWhereArgs = new GraphQLInputObjectType({
  name: 'StringWhereArgs',
  fields: { eq: { type: GraphQLString }, like: { type: GraphQLString } }
})

const ArrayWhereArgs = new GraphQLInputObjectType({
  name: 'ListWhereArgs',
  fields: { count: { type: IntWhereArgs } }
})

const OrderByDirection = new GraphQLEnumType({
  name: 'OrderByDirection',
  values: {
    ASC: { value: 'asc' },
    DESC: { value: 'desc' }
  }
})

let protocol = 'https'
let host = ''
let basePath = ''
let queryResolvers = {}
let mutationResolvers = {}

const wrapNonNull = (type, nonNull) => (nonNull ? new GraphQLNonNull(type) : type)

const logOperation = (verb, uri) => console.log(`\n\n=== ${verb}  ${uri}`)

const logResult = (verb, res) => console.log(`\n\n--- ${verb} success\nResult: `, res)

const typeAlias = (type) => {
  switch (type) {
    case 'integer':
      return GraphQLInt
    case 'string':
      return GraphQLString
    case 'array':
      return GraphQLList
    default:
      return GraphQLString
  }
}

const typeAliasCustom = (ref, suffix = '') => {
  let typeName = ref.substring(ref.lastIndexOf('/') + 1) + suffix
  return types[typeName] || { name: 'NOT_FOUND' }
}

const resolveFieldType = (fieldName, fieldType, isRequired) => {
  if (fieldType.type === 'array' && fieldType.operationId) {
    let opid = camelcase(fieldType.operationId)
    let op = queryResolvers[opid]
    let args = {}
    args['last'] = { type: GraphQLInt, description: 'Last n items' }
    if (op.type.ofType) {
      if (types[op.type.ofType + 'WhereArgs']) {
        args['where'] = { type: types[op.type.ofType + 'WhereArgs'] }
      }
      if (types[op.type.ofType + 'OrderByArgs']) {
        args['orderBy'] = { type: types[op.type.ofType + 'OrderByArgs'] }
      }
    }
    return {
      type: op.type,
      args: args,
      resolve: (parent, args, context) => {
        return op.resolve(parent, Object.assign(parent, args))
      }
    }
  }

  if (fieldType.type) return { type: wrapNonNull(typeAlias(fieldType.type), isRequired) }
  else if (fieldType.$ref) {
    return {
      type: wrapNonNull(typeAliasCustom(fieldType.$ref), isRequired),
      resolve: (parent, args, context) => {
        return Object.assign({ id: 0 }, parent[fieldName])
      }
    }
  }
}

const generateFieldsFromProps = (props, required = []) => {
  let fields = { id: { type: new GraphQLNonNull(GraphQLID) } }
  Object.keys(props).map((key) => (fields[key] = resolveFieldType(key, props[key], required.indexOf(key) !== -1)))
  return fields
}

const generateType = (key, def) => {
  console.log('should generate type', key)

  return new GraphQLObjectType({ name: key })
}

const generateTypeFields = (type, def) => {
  type._typeConfig.fields = () => generateFieldsFromProps(def.properties, def.required)
}

const generateTypeWhereArgs = (type, def) => {
  types[type + 'WhereArgs'] = new GraphQLInputObjectType({
    name: type + 'WhereArgs',
    fields: () => {
      let args = {}
      Object.keys(def.properties).map((propName) => {
        let prop = def.properties[propName]
        if (prop.type === 'string') {
          args[propName] = { type: StringWhereArgs }
        } else if (prop.type === 'integer') {
          args[propName] = { type: IntWhereArgs }
        } else if (prop.type === 'array') {
          args[propName] = { type: ArrayWhereArgs }
          // console.log('+++++is array', prop, typeAliasCustom(prop.items.$ref), types[typeAliasCustom(prop.items.$ref) + 'WhereArgs'])
          // if (typeAliasCustom(prop.items.$ref) && types[typeAliasCustom(prop.items.$ref) + 'WhereArgs']) {
          //   args[propName] = { type: types[typeAliasCustom(prop.items.$ref) + 'WhereArgs'] }
          // } else {
          //   args[propName] = { type: ArrayWhereArgs }
          // }
        }
      })
      return args
    }
  })
}

const generateTypeOrderByArgs = (type, def) => {
  const newTypeName = type + 'OrderByArgs'
  const fieldTypeName = type + 'OrderByField'
  console.log('should generate', newTypeName, 'only if', fieldTypeName, 'exists')

  if (types[fieldTypeName] === undefined) {
    console.log('\n\n+++', fieldTypeName, 'is undefined, something went wrong!!!\n\n')
    return
  }

  types[newTypeName] = new GraphQLInputObjectType({
    name: newTypeName,
    fields: {
      field: { type: types[fieldTypeName] },
      direction: { type: OrderByDirection }
    }
  })
}

const generateTypeOrderByField = (type, def) => {
  const newTypeName = type + 'OrderByField'
  console.log('should generate', newTypeName)
  let values = {}
  Object.keys(def.properties).map((propName) => {
    values[propName] = { value: propName }
  })
  types[newTypeName] = new GraphQLEnumType({
    name: newTypeName,
    values: values
  })
}

const argsFromParams = (params = [], responseType) => {
  let args = {}
  params.map((p) => {
    if (p.schema && p.schema.$ref) {
      // non scalar, i.e., generated type
      args[p.name] = {
        type: wrapNonNull(typeAliasCustom(p.schema.$ref, 'Input'), p.required),
        description: p.description
      }
    } else {
      // scalar type (id, int, string...)
      args[p.name] = {
        type: wrapNonNull(typeAlias(p.type), p.required),
        description: p.description
      }
    }
  })

  args['last'] = { type: GraphQLInt, description: 'Last n items' }

  if (responseType && responseType.ofType) {
    if (types[responseType.ofType + 'WhereArgs']) {
      args['where'] = { type: types[responseType.ofType + 'WhereArgs'] }
    }
    if (types[responseType.ofType + 'OrderByArgs']) {
      args['orderBy'] = { type: types[responseType.ofType + 'OrderByArgs'] }
    }
  }

  return args
}

const responseTypeFromSchema = (schema) => {
  if (schema.type === 'array') {
    return new GraphQLList(types[typeAliasCustom(schema.items.$ref)])
  } else {
    return types[typeAliasCustom(schema.$ref)]
  }
}

const applyWhereArgs = (result, where, { type }) => {
  Object.keys(where).map((key) => {
    let typeField = type.getFields()[key]

    if (typeField.type === StringWhereArgs || typeField.type === IntWhereArgs) {
      let { eq, gt, lt, like } = where[key]
      if (eq) result = result.filter((r) => r[key] === eq)
      if (gt) result = result.filter((r) => r[key] > gt)
      if (lt) result = result.filter((r) => r[key] < lt)
      if (like) result = result.filter((r) => r[key].toLowerCase().indexOf(like.toLowerCase()) !== -1)
    }
    if (typeField.type === ArrayWhereArgs) {
      let { count } = where[key]
      if (count) {
        let { eq, gt, lt } = count
        if (eq) result = result.filter((r) => r[key].length === eq)
        if (gt) result = result.filter((r) => r[key].length > gt)
        if (lt) result = result.filter((r) => r[key].length < lt)
      }
    }
  })

  return result
}

const applyOrderByArgs = (result, orderByArgs, { type }) => {
  return orderBy(result, [ orderByArgs.field ], [ orderByArgs.direction ])
}

const generateQueryResolvers = (resolvers, pathKey, path) => {
  if (!path.get) {
    return
  }

  const { operationId, responses, parameters = [], summary } = path.get
  if (!operationId) {
    return
  }
  let validOpId = camelcase(operationId)
  console.log('valid op id === ', validOpId)
  let verb = 'GET'
  console.log('== Generating ', verb, 'for', pathKey)

  const responseType = responseTypeFromSchema(responses['200'].schema)
  const afp = argsFromParams(parameters, responseType)

  resolvers[validOpId] = {
    description: summary,
    type: responseType,
    args: afp,
    resolve: (parent, args, context) => {
      let p = pathKey
      parameters.map((param) => {
        if (param.in === 'path') {
          p = p.replace(new RegExp('{' + param.name + '}', 'g'), args[param.name])
        } else if (param.in === 'query' && args[param.name]) {
          p = p + '?' + param.name + '=' + args[param.name]
        }
      })
      const uri = `${protocol}://${host}${basePath}${p}`

      logOperation(verb, uri)

      // console.log('TOKEN: ', require('./token').default.token)
      // console.log(process.env.access_token)
      let at = require('./token').default.token

      return rp({
        uri,
        headers: {
          'Authorization': `Bearer ${at}`
        }
      }).then((res) => {
        let parsedResult = JSON.parse(res)
        let isArray = Array.isArray(parsedResult)
        let finalResult = parsedResult
        if (args.where) finalResult = applyWhereArgs(finalResult, args.where, afp.where)
        if (args.orderBy) finalResult = applyOrderByArgs(finalResult, args.orderBy, afp.orderBy)
        if (isArray && args.last > 0) finalResult = takeRight(finalResult, args.last)

        // logResult(verb, parsedResult)

        return finalResult
      })
    }
  }
}

const generateMutationForVerb = (verb, pathKey, { responses, parameters, summary }) => {
  console.log('== Generating mutation ', verb, 'for', pathKey)
  return {
    description: summary,
    type: types[typeAliasCustom(responses['200'].schema.$ref)],
    args: argsFromParams(parameters),
    resolve: (parent, args, context) => {
      let p = pathKey
      parameters.map((param) => {
        if (param.in === 'path') {
          p = p.replace(new RegExp('{' + param.name + '}', 'g'), args[param.name])
        } else if (param.in === 'query' && args[param.name]) {
          p = p + '?' + param.name + '=' + args[param.name]
        }
      })
      const uri = `http://${host}${p}`
      logOperation(verb, uri)
      const opts = { method: verb, uri, body: args.body, json: true }
      return rp(opts)
        .then((res) => {
          logResult(verb, res)
          return res
        })
        .catch((err) => {
          console.log(err)
        })
    }
  }
}

const generateMutationResolvers = (resolvers, pathKey, path) => {
  const verbs = [ 'POST', 'DELETE', 'PUT' ]
  verbs.map((verb) => {
    let verbObj = path[verb.toLowerCase()]
    if (verbObj && verbObj.operationId) {
      let validOpId = camelcase(verbObj.operationId)
      resolvers[validOpId] = generateMutationForVerb(verb, pathKey, verbObj)
    }
  })
}

const generateResolvers = ({ paths }, queryResolvers, mutationResolvers) => {
  queryResolvers = queryResolvers || {}
  mutationResolvers = mutationResolvers || {}

  Object.keys(paths).map((key) => {
    generateQueryResolvers(queryResolvers, key, paths[key])
    //generateMutationResolvers(mutationResolvers, key, paths[key])
  })
}

const generateTypes = function ({ definitions }, types) {
  Object.keys(definitions).map((k) => {
    if (definitions[k].anyOf) {
      types[k] = new GraphQLUnionType({
        name: k,
        types: definitions[k].anyOf.map((def) => typeAliasCustom(def.$ref)),
        resolveType: (data) => types[data.type] || typeNotFound
      })
    } else {
      types[k] = generateType(k, definitions[k])
      
      //console.log('/// done generating types\n\n')

      types[k + 'Input'] = TypeComposer.create(types[k]).getInputType()

      //console.log('/// done generating input types\n\n')

      generateTypeFields(types[k], definitions[k])
      // generateTypeWhereArgs(types[k], definitions[k])
      // generateTypeOrderByField(types[k], definitions[k])
      // generateTypeOrderByArgs(types[k], definitions[k])
    }
  })
}

const oas2gql = (oasSchema) => {
  host = oasSchema.host
  basePath = oasSchema.basePath || ''
  queryResolvers = {}
  mutationResolvers = {}

  generateTypes(oasSchema, types)
  generateResolvers(oasSchema, queryResolvers, mutationResolvers)

  // generateTypesAndResolvers(types, queryResolvers, mutationResolvers, oasSchema)

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({ name: 'RootQueryType', fields: () => queryResolvers })
    // mutation: new GraphQLObjectType({ name: 'RootMutationType', fields: () => mutationResolvers })
  })
  return { schema }
}

export default oas2gql
