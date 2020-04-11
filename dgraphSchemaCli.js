import program from 'commander'
import diff from 'deep-diff'
import dgraph from 'dgraph-js'
import grpc from 'grpc'
import util from 'util'

import { schema, types } from './schema'

const clientStub = new dgraph.DgraphClientStub(
  'localhost:9080',
  grpc.credentials.createInsecure(),
)
const dgraphClient = new dgraph.DgraphClient(clientStub)

// - allow to define a schema
// - alter the db with it
// - exit code 1 if there is an unauthorized conflict and print the diff
// - allow --force to force alter

const prepareValueString = predicate => {
  const preparedArray = predicate.split(' ')
  if (preparedArray[preparedArray.length - 1] === '.') {
    preparedArray.pop()
  } else {
    throw new Error('Missing . at the end of predicate, or incorrect spacing.')
  }
  return preparedArray
}

const typeCheck = (type, object) => {
  const normalTypes = ['default', 'bool', 'datetime', 'float', 'geo', 'int', 'password', 'string', 'uid']
  const listTypes = ['[default]', '[bool]', '[datetime]', '[float]', '[geo]', '[int]', '[string]', '[uid]']
  const typeIsNotAList = normalTypes.some(value => value === type)
  const typeIsList = listTypes.some(value => value === type)
  if (!typeIsNotAList && !typeIsList) {
    throw new Error('Incorrect or missing type in predicate.')
  } else if (typeIsList) {
    object.type = type.slice(1, -1)
  } else {
    object.type = type
  }
  if (typeIsList) {
    object.list = true
  }
}

const indexCheck = (aValues, object) => {
  const aTokenizer = []
  const index = aValues.some(value => {
    if (value.includes('@index')) {
      if (value.slice(6, 7) !== '(' || value.slice(-1) !== ')') {
        throw new Error('@index is invalid, missing parenthesis or there are spaces in tokenizer.')
      }
      const fields = value.slice(7, -1).split(',')
      fields.forEach(field => {
        aTokenizer.push(field.trim())
      })
      return true
    }
    return false
  })
  if (index) {
    object.index = index
    object.tokenizer = aTokenizer
  }
}

const otherOptions = (aValues, object) => {
  aValues.forEach(value => {
    if (value.includes('@upsert')) {
      object.upsert = true
    } else if (value.includes('@lang')) {
      object.lang = true
    }
  })
}

// Create a JSON schema by using our `schema` from our file
const createJsonSchema = () => {
  const jsonSchema = []
  Object.entries(schema).forEach(([key, value]) => {
    const object = { predicate: key }
    const aValues = prepareValueString(value)
    typeCheck(aValues[0], object)
    aValues.shift()
    indexCheck(aValues, object)
    otherOptions(aValues, object)
    jsonSchema.push(object)
  })
  return jsonSchema
}

const createJsonTypes = () => {
  const jsonTypes = []
  Object.entries(types).forEach(([key, value]) => {
    const object = { name: key }
    const fields = []
    value.forEach(field => {
      fields.push({ name: field })
    })
    object.fields = fields
    jsonTypes.push(object)
  })
  return jsonTypes
}

const prepareJson = (sch, typ) => ({
  schema: sch,
  types: typ,
})

const rawSchema = () => {
  let allPredicates = ''
  Object.entries(schema).forEach(([key, value]) => {
    allPredicates += `${key}: ${value}\n`
  })
  return allPredicates
}

const rawTypes = () => {
  let allTypes = ''
  Object.entries(types).forEach(([key, value]) => {
    let values = ''
    value.forEach(subValue => {
      values += `\n\t${subValue}`
    })
    allTypes += `\ntype ${key} {${values}\n}`
  })

  return allTypes
}

const removeDgraphData = unpreparedSch => {
  // Removing autogenerated fields by dbgraph
  for (let i = 0; i < unpreparedSch.schema.length; i++) {
    if (unpreparedSch.schema[i].predicate === 'dgraph.graphql.schema') {
      unpreparedSch.schema.splice(i, 1)
      break
    }
  }
  for (let i = 0; i < unpreparedSch.schema.length; i++) {
    if (unpreparedSch.schema[i].predicate === 'dgraph.type') {
      unpreparedSch.schema.splice(i, 1)
      break
    }
  }
  // Removing autogenerated types
  for (let i = 0; i < unpreparedSch.types.length; i++) {
    if (unpreparedSch.types[i].name === 'dgraph.graphql') {
      unpreparedSch.types.splice(i, 1)
      break
    }
  }
}

const compareObjectPredicate = (objectA, objectB) => {
  const predicateA = objectA.predicate.toUpperCase()
  const predicateB = objectB.predicate.toUpperCase()

  let comparator = 0
  if (predicateA > predicateB) {
    comparator = 1
  } else if (predicateA < predicateB) {
    comparator = -1
  }
  return comparator
}

const compareObjectName = (objectA, objectB) => {
  const predicateA = objectA.name.toUpperCase()
  const predicateB = objectB.name.toUpperCase()

  let comparator = 0
  if (predicateA > predicateB) {
    comparator = 1
  } else if (predicateA < predicateB) {
    comparator = -1
  }
  return comparator
}


program.version('0.0.1')
program.option('-p, --path <string>', 'path of the schema', './schema.js')
program.command('getSchema').action(async () => {
  const response = await dgraphClient.newTxn().query('schema {}')
  // const { schema, types } = response.getJson()
  console.log(util.inspect(response.getJson(), false, null, true))
})
program.command('createJsonSchema').action(() => {
  const jsonSchema = createJsonSchema()
  const jsonTypes = createJsonTypes()
  return prepareJson(jsonSchema, jsonTypes)
})
program.command('createRawSchema').action(async () => {
  const sSchema = rawSchema()
  const sTypes = rawTypes()
  const sRaw = `${sTypes}\n${sSchema}`
  const op = new dgraph.Operation()
  op.setSchema(sRaw)
  await dgraphClient.alter(op)
})
program.command('diff').action(async () => {
  const jsonSchema = createJsonSchema()
  const jsonTypes = createJsonTypes()
  const newSchema = prepareJson(jsonSchema, jsonTypes)
  const currentSchema = (await dgraphClient.newTxn().query('schema {}')).getJson()
  removeDgraphData(currentSchema)
  newSchema.schema.sort(compareObjectPredicate)
  newSchema.types.sort(compareObjectName)
  const differences = diff(newSchema, currentSchema)
  if (typeof differences !== 'undefined') {
    differences.forEach(difference => {
      /* if (['N', 'D', 'E'].includes(difference.kind)) {
        console.log(difference);
      } */
      console.log(difference)
    })
  } else {
    console.log('No differences between the 2 schemas.')
  }
  /* diff(newSchema, currentSchema).forEach(difference => {
    if (['N', 'D', 'E'].includes(difference.kind)) {
      console.log(difference);
    }
    console.log(difference);
  }) */
})
program.parse(process.argv)
