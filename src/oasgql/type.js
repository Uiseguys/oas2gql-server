import { GraphQLObjectType, GraphQLUnionType, GraphQLString, GraphQLInt, GraphQLList, GraphQLNonNull } from 'graphql'

import { mapPropsToFields, createWhereArgsForType } from './query'

export const typeNotFound = new GraphQLObjectType({ name: 'TYPE_NOT_FOUND' })

export const wrapNonNull = (type, nonNull) => (nonNull ? new GraphQLNonNull(type) : type)

export const createEmptyType = (name) => new GraphQLObjectType({ name })

export const createUnionType = (name, types, resolveType) => new GraphQLUnionType({ name, types, resolveType })

export const createTypes = ({ definitions }) => {
  let typeDef
  Object.keys(definitions).map((key) => {
    typeDef = definitions[key]
    if (typeDef.anyOf) {
      console.log('creating union type', key)
      types[key] = createUnionType(
        key,
        typeDef.anyOf.map((def) => typeAliasCustom(def.$ref)),
        (data) => types[data.type] || typeNotFound
      )
      // createWhereArgsForType(types[key], definitions[key])
    } else {
      console.log('creating type', key)
      types[key] = createEmptyType(key)
      createTypeFields(types[key], definitions[key])
      createWhereArgsForType(types[key], definitions[key])
    }
  })
}

export const createTypeFields = (type, { properties, required }) => {
  type._typeConfig.fields = () => mapPropsToFields(properties, required, type.name)
}

export const typeAlias = (typeName) => {
  switch (typeName) {
    case 'integer':
      return GraphQLInt
    case 'string':
      return GraphQLString
    // case 'array':
    //   return new GraphQLList()
    default:
      return GraphQLString
  }
}

export const typeAliasCustom = (ref, suffix = '') => {
  let typeName = ref.substring(ref.lastIndexOf('/') + 1) + suffix
  return types[typeName] || { name: 'NOT_FOUND' }
}

export const getTypeFromSchema = (schema) => {
  if (schema.$ref) {
    return typeAliasCustom(schema.$ref)
  } else if (schema.type === 'array' && schema.items && schema.items.$ref) {

    console.log('should return type alias custom for', schema.items.$ref)
    console.log(typeAliasCustom(schema.items.$ref))
    return new GraphQLList(typeAliasCustom(schema.items.$ref))
  }
}

export const types = {}
