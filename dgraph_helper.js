import dgraph from 'dgraph-js'

import {
  prepare_new_schema,
  prepare_current_schema,
} from './utils/prepare_schema.js'
import {
  diff_schema_checker,
  diff_types_checker,
} from './utils/diff_checker.js'

const get_schema = async client =>
  (await client.newTxn().query('schema {}')).getJson()
const format_to_raw_schema = schema =>
  Object.entries(schema)
      .map(([key, value]) => `${ key }: ${ value }`)
      .join('\n')
const format_to_raw_types = types =>
  Object.entries(types)
      .map(([key, value]) => {
        const values = value
            .map(sub_value => `\n\t${ sub_value }`)
            .join('')

        return `\ntype ${ key } {${ values }\n}`
      })
      .join('')
const diff_checker = async (client, schema_file) => {
  const new_schema = prepare_new_schema(schema_file)
  const fetched_schema = await get_schema(client)
  const current_schema = prepare_current_schema(fetched_schema)
  const types_differences = diff_types_checker(
      new_schema,
      current_schema,
  )
  const schema_differences = diff_schema_checker(
      new_schema,
      current_schema,
  )
  const conflicts = [
    ...types_differences.conflicts, ...schema_differences.conflicts,
  ]
  const added = [
    ...types_differences.added, ...schema_differences.added,
  ]

  return {
    conflicts,
    added,
  }
}
const alter_schema = async (client, schema_file) => {
  const { schema, types } = schema_file
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
