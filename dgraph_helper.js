import dgraph from 'dgraph-js'

import {
  prepare_new_schema,
  prepare_current_schema,
} from './utils/prepare_schema'
import {
  diff_schema_checker, diff_types_checker,
} from './utils/diff_checker'

const get_schema = async client =>
  (await client.newTxn().query('schema {}')).getJson()


/* const compare_types_fields = (field_a, field_b) => {
  const type_a = field_a.name.toUpperCase()
  const type_b = field_b.name.toUpperCase()

  let comparator = 0
  if (type_a > type_b)
    comparator = 1
  else if (type_a < type_b)
    comparator = -1

  return comparator
} */

/* const diff_types_checker = (new_schema, current_schema) => {
  const conflicts = []
  const added = []
  const types_to_check = []
  const missing_types = []

  new_schema.types.forEach(type => {
    type.fields.sort(compare_types_fields)
    types_to_check.push(type.name)
  })
  current_schema.types.forEach(type => {
    type.fields.sort(compare_types_fields)
    if (!types_to_check.includes(type.name))
      missing_types.push(type.name)
  })

  types_to_check.forEach(type => {
    const new_object = new_schema.types.find(object => object.name === type)
    const current_object = current_schema.types
        .find(object => object.name === type)
    const differences = diff(current_object, new_object)
    if (typeof differences !== 'undefined') {
      differences.forEach(difference => {
        if (difference.kind === 'E') {
          conflicts.push({
            message: `This object was edited at path: ${ difference.path[0] }`,
            category: 'types',
            object: {
              ...current_object,
            },
            additional_information: `Expected ${ difference.lhs }
            found ${ difference.rhs }`,
          })
        } else if (difference.kind === 'N') {
          added.push({
            message: 'This new object was added.',
            category: 'types',
            object: {
              ...new_object,
            },
          })
        } else if (difference.kind === 'A') {
          conflicts.push({
            message: 'Change in the fields in this object.',
            category: 'types',
            object: current_object,
          })
        }
      })
    }
  })

  missing_types.forEach(type => {
    const deleted_object = current_schema.types
        .find(object => object.name === type)

    conflicts.push({
      message: 'This object was deleted.',
      category: 'types',
      object: {
        ...deleted_object,
      },
    })
  })
  return [conflicts, added]
} */

/* const diff_schema_checker = (new_schema, current_schema) => {
  const conflicts = []
  const added = []
  const predicates_to_check = new_schema.schema.map(({
    predicate,
  }) => predicate)
  const missing_predicates = current_schema.schema
      .filter(({
        predicate,
      }) => !predicates_to_check.includes(predicate))
      .map(({
        predicate,
      }) => predicate)

  predicates_to_check.forEach(predicate => {
    const new_object = new_schema.schema
        .find(object => object.predicate === predicate)
    const current_object = current_schema.schema
        .find(object => object.predicate === predicate)
    const differences = diff(current_object, new_object)
    if (typeof differences !== 'undefined') {
      differences.forEach(difference => {
        if (difference.kind === 'E') {
          conflicts.push({
            message: `This object was edited at path:${ difference.path[0] }`,
            category: 'schema',
            object: {
              ...current_object,
            },
            additional_information: `Expected${ difference.rhs }
            found ${ difference.lhs }`,
          })
        } else if (difference.kind === 'N') {
          if (typeof current_object === 'undefined') {
            added.push({
              message: 'This object was added.',
              object: {
                ...new_object,
              },
            })
          } else {
            conflicts.push({
              message: 'This object was edited',
              category: 'schema',
              object: {
                ...new_object,
              },
            })
          }
        } else if (difference.kind === 'D' && difference.path[0] === 'list') {
          conflicts.push({
            message: 'This object was edited, should be a list.',
            category: 'schema',
            object: {
              ...new_object,
            },
          })
        } else if (new_object?.index && difference.kind === 'A') {
          conflicts.push({
            message: 'Tokenizer of this objects was edited.',
            category: 'schema',
            object: {
              ...current_object,
            },
          })
        }
      })
    }
  })
  missing_predicates.forEach(predicate => {
    const deleted_object = current_schema.schema
        .find(object => object.predicate === predicate)
    conflicts.push({
      message: 'This object was deleted.',
      object: {
        ...deleted_object,
      },
    })
  })
  return [conflicts, added]
} */

const format_to_raw_schema = schema => Object.entries(schema)
    .map(([key, value]) => `${ key }: ${ value }`)
    .join('\n')

const format_to_raw_types = types => Object.entries(types)
    .map(([key, value]) => {
      const values = value.map(sub_value => `\n\t${ sub_value }`).join('')
      return `\ntype ${ key } {${ values }\n}`
    })
    .join('')

const diff_checker = async (client, schema_file) => {
  const new_schema = prepare_new_schema(schema_file)
  const fetched_schema = await get_schema(client)
  const current_schema = prepare_current_schema(fetched_schema)
  const types_differences = diff_types_checker(new_schema, current_schema)
  const schema_differences = diff_schema_checker(new_schema, current_schema)
  const conflicts = [...types_differences[0], ...schema_differences[0]]
  const added = [...types_differences[1], ...schema_differences[1]]

  return {
    conflicts,
    added,
  }
}

const alter_schema = async (client, schema_file) => {
  const {
    schema, types,
  } = schema_file
  const raw_schema_string = format_to_raw_schema(schema)
  const raw_types_string = format_to_raw_types(types)
  const raw_string = `${ raw_types_string }\n${ raw_schema_string }`
  const operation = new dgraph.Operation()
  operation.setSchema(raw_string)
  try {
    await client.alter(operation)
  } catch (error) {
    console.log(error)
  }
}

export default {
  get_schema,
  diff_checker,
  alter_schema,
}