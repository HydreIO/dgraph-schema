import fs from 'fs'
import dgraph from 'dgraph-js'
import grpc from 'grpc'

const create_client = host => {
  const client_stub = new dgraph.DgraphClientStub(host,
      grpc.credentials.createInsecure())
  return new dgraph.DgraphClient(client_stub)
}
const check_file_exists = file_path => {
  try {
    if (fs.existsSync(file_path))
      return true

    return false
  } catch (error) {
    return console.error(error)
  }
}
const get_schema_from_path = path => {
  if (path) {
    console.log('Now using file at path:', path)
    if (check_file_exists(path))
      return import(path)

    return false
  }

  const file_path = `${ process.cwd() }/schema.js`
  if (check_file_exists(file_path))
    return import(file_path)

  return false
}

export default {
  create_client,
  get_schema_from_path,
}
