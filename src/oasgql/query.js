import { GraphQLList, GraphQLString, GraphQLInt, GraphQLInputObjectType } from 'graphql'
import camelcase from 'camelcase'
import fetch from 'node-fetch'
import DataLoader from 'dataloader'

import { types, typeAlias, typeAliasCustom, wrapNonNull, getTypeFromSchema } from './type'
import uri from './uri'

const log = require('debug')('query')
let mapping = {}
let loaders = {}

const IntWhereArgs = new GraphQLInputObjectType({
  name: 'IntWhereArgs',
  fields: { eq: { type: GraphQLInt }, gt: { type: GraphQLInt }, lt: { type: GraphQLInt } }
})

const StringWhereArgs = new GraphQLInputObjectType({
  name: 'StringWhereArgs',
  fields: { eq: { type: GraphQLString }, like: { type: GraphQLString } }
})

// test

const ArrayWhereArgs = new GraphQLInputObjectType({
  name: 'ListWhereArgs',
  fields: { count: { type: IntWhereArgs } }
})

export const mapPropsToFields = (properties, required, typeName) => {
  let fields = {}

  Object.keys(properties).map((key) => {
    let property = properties[key]
    fields[key] = createFieldFromProperty(key, property, typeName)
  })

  return fields
}

export const getValidResponseType = (responses) => {
  if (responses['200'] && responses['200'].schema) {
    return getTypeFromSchema(responses['200'].schema)
  }

  return null
}

export const createWhereArgsForType = (type, def) => {
  // console.log('creating', type + 'WhereArgs')
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
        }
      })
      return args
    }
  })
}

export const createFetchFunction = (verb, pathKey, parameters, afp) => {
  const { protocol, host, basePath, securityHeaders } = uri
  const baseURL = `${protocol}://${host}${basePath}`
  const fetchFunction = ({ operationPath, authHeaders, authSuffix = '' }) => {
    const url = `${baseURL}${operationPath}${authSuffix}`

    // console.log('=== fetch url', url)
    // console.log('auth headers', authHeaders)

    log('fetch url', url)

    return fetch(url, {
      headers: authHeaders
    }).then((res) => {
      log('res.statusText', res.statusText)
      if (res.ok) {
        return res.json()
      } else {
        return new Promise((resolve, reject) => {
          res
            .json()
            .then((error) => {
              // response body is a valid json and probably contains an error message
              let message = 'Unknown error'
              try {
                message = error.error.message
                log('error.message', message)
              } catch (e) {}

              reject(new Error(message))
            })
            .catch(() => {
              log('res.statusText', res.statusText)
              // response body is NOT a valid json and we should extract error message from response status
              reject(new Error(`(` + res.status + ') ' + res.statusText || 'unknown error'))
            })
        })
      }
    })
    // .catch((error) => console.log(error))
  }

  return fetchFunction
}

export const createResolveFunction = (verb, pathKey, parameters, afp, fetchFunction) => {
  return (parent, args, context) => {
    console.log(context.headers)

    const authHeaders = {}
    if (context.headers.authorization) {
      authHeaders.Authorization = context.headers.authorization
    }
    if (context.headers['x-access-token']) {
      authHeaders['x-access-token'] = context.headers['x-access-token']
    }

    console.log('\n\n', context, '\n\n\n')

    // authHeaders.Authorization = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik56YzNRelJHT1VKR1JUaENPREUzUVVFek5VSkVNalUxUWpGRFJFWkZORUk0UlRRd1JVWXdSUSJ9.eyJlbWFpbCI6ImRlbm5pcy5jcm9pdG9ydUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6Ly9hdXRvcGFyay5ldS5hdXRoMC5jb20vIiwic3ViIjoiYXV0aDB8NWE1OGQzYTA1NThmMGEwYzJiMWQ0MTY4IiwiYXVkIjoiQ3B6c24xSEQ4am5TZEc4S3R1elJrSW9Wc0tDSmRtbVEiLCJpYXQiOjE1MTYyMDU5NjIsImV4cCI6MTUxNjI0MTk2MiwiYXRfaGFzaCI6IjdJT2VLY25JeV9DUG5Ud1dJX05pcXciLCJub25jZSI6IlZjdWVqb2IzUHRMdWlmX00uMWNjbjZfVU1Ha2ljMk94In0.C6hL4wGsnv08I56qvuNCZyK3Qrl0re6uzNvpsRAVMoXCOMFvyxhCpj1TRRW-Gp6s9ZmrKInRSr9Rut25b0FbYkIfmR5liVcbciaQPKME064wSFaCbScwr1cF1cqKByKyb7T-03Q_DBgVz-rdHnOd4hVMdgFEjnGomV5q7vLYBo3MmfGCGrNY7lFykGNE7yw5v4IfdqCTSXUn8bOKoiSF4SJmGbs12y49gNW1j_u5j09rLCCTSBHohvFNx8P_8qWucjG6gj9XikZVh1kJ2t5OeJLzhXR3pwI19apoiF7__yDVMEJDPOnzSkiJdfMb0QgtOWo_zZWbhkGqNRYHlRnjzg'

    const operationPath = createOperationPath(pathKey, parameters, args)

    loaders[pathKey] = loaders[pathKey] || createDataLoader(fetchFunction)

    return loaders[pathKey]
      .load({ operationPath, authHeaders })
      .then((res, rej) => {
        log('context loaders final result', res, rej)

        let finalResult = res
        if (args.where) finalResult = applyWhereArgsToResponse(finalResult, args.where, afp.where)
        return Object.assign(finalResult, { parentArgs: args })
      })
      .catch((error) => {
        log('context loaders, error in resolving', error)
        throw new Error(error)
      })
  }
}

export const createFieldFromProperty = (fieldName, property, typeName) => {
  if (property.type) {
    if (property.type === 'array' && property.items && property.items.$ref) {
      if (mapping[typeName] && mapping[typeName][fieldName]) {
        let m = mapping[typeName][fieldName]
        console.log('found mapping ::', typeName + '.' + fieldName, '==>>', m.operationId)
        let op = queries[m.operationId]

        if (op) {
          let afp = {}
          if (op.type && types[op.type + 'WhereArgs']) {
            afp.where = { type: types[op.type + 'WhereArgs'] }
          }

          return {
            type: new GraphQLList(op.type),
            args: afp,
            description: property.description,
            resolve: (parent, args, context) => {
              return Promise.all(
                parent[fieldName].map((obj) => {
                  return op.resolve({}, Object.assign({ userId: 'me' }, m.resolveObject(obj), args), context)
                })
              ).then((resolvedMessagesArray) => {
                if (args.where) {
                  console.log('args where, afp where', args.where, afp.where)
                  return applyWhereArgsToResponse(resolvedMessagesArray, args.where, afp.where)
                } else {
                  return resolvedMessagesArray
                }
              })
            }
          }
        } else {
          console.log('!!! smth wrong with last mapping')
        }
      }

      return { type: new GraphQLList(typeAliasCustom(property.items.$ref)), description: property.description }
    }
    return { type: typeAlias(property.type), description: property.description }
  } else if (property.$ref) {
    return { type: typeAliasCustom(property.$ref) }
  }

  return { type: GraphQLString, resolve: () => 'not supported', description: 'not supported' }
}

export const createQuery = (type, args, resolve, description = 'NO DESCRIPTION') => {
  return {
    type,
    args,
    description,
    resolve
  }
}

export const createQueries = ({ paths }, _mapping = {}) => {
  mapping = _mapping
  let ret = {}
  Object.keys(paths).map((pathKey) => {
    let path = paths[pathKey]

    if (path.get) {
      const verb = 'GET'
      const { operationId, responses, description, parameters = [] } = path.get
      const validOperationId = camelcase(operationId)
      const responseType = getValidResponseType(responses)
      const args = createArgsFromParameters(parameters, responseType)
      const fetchFunction = createFetchFunction(verb, pathKey, parameters, args)

      // console.log(fetchFunction())

      const resolveFunction = createResolveFunction(verb, pathKey, parameters, args, fetchFunction)

      if (validOperationId && responseType) {
        console.log('creating query', validOperationId, '=>', responseType)
        ret[validOperationId] = createQuery(responseType, args, resolveFunction, description)
      }
    }
  })

  queries = ret
  return ret
}

export const createArgsFromParameters = (parameters = [], responseType) => {
  // let args = { userId: { type: GraphQLString }, id: { type: GraphQLString } }
  // console.log('create args from params with type', responseType.ofType, types[responseType + 'WhereArgs'])
  let args = {}
  parameters.map((param) => {
    if (param.schema && param.schema.$ref) {
      // non scalar, i.e., created type
      args[param.name] = {
        type: wrapNonNull(typeAliasCustom(param.schema.$ref, 'Input'), param.required),
        description: param.description
      }
    } else {
      // scalar type (id, int, string...)
      args[param.name] = {
        type: wrapNonNull(typeAlias(param.type), param.required),
        description: param.description
      }
    }
  })

  /**
   * If response type is an array, add where args
   */
  if (responseType && responseType.ofType && types[responseType.ofType + 'WhereArgs']) {
    let { ofType } = responseType
    args['where'] = { type: types[ofType + 'WhereArgs'] }
    //  args['last'] = { type: GraphQLInt, description: 'Last n items' }
  }

  return args
}

export const createOperationPath = (path, parameters, values) => {
  let newPath = path
  let value
  parameters.map((param) => {
    value = values[param.name]
    if (param.in === 'path') {
      newPath = newPath.replace(new RegExp('{' + param.name + '}', 'g'), value)
    } else if (param.in === 'query' && value) {
      newPath = newPath + '?' + param.name + '=' + value
    }
  })

  return newPath
}

export const applyWhereArgsToResponse = (result, whereArgs, argsFromParams) => {
  if (!whereArgs || !argsFromParams) return result

  let where = whereArgs
  let type = argsFromParams.type

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

export const createDataLoader = (fetchFunction) => new DataLoader((keys) => Promise.all(keys.map(fetchFunction)))

let queries = {}
