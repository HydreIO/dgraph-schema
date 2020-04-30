# dgraph-schema
dgraph-schema is node a CLI allowing you to manage your Dgraph schemas with ease.
You can:
- Print your current Dgraph schema
- Print the output between your new schema & the current one
- Alter your Dgraph schema if there are no conflicts

## Requirement
- Node v13.12.0 or later
- A schema file

## Example of a schema
```javascript
export const SCHEMA = {
  uuid: 'string @index(exact,fulltext) @upsert .',
  hash: 'string .',
  desc: 'int .',
  name: '[string] .',
}

export const TYPES = {
  user: ['uuid', 'hash', 'desc'],
  pets: ['name'],
}
```


## How to use it
The CLI also has 3 commands with options for each of them: 
- `dgraph-schema get_schema`
- `dgraph-schema get_diff`
- `dgraph-schema alter`

If you need to change the Dgraph DB url you can use the `DGRAPH_URL` environment variable or use the `--host` option.


### get_schema command
`dgraph-schema get_schema` will print the current Dgraph schema.
Possible options are:
- `-H, --host <my_host>` This will overwrite the `DGRAPH_URL` environment variable if there are any.

### get_diff command
`dgraph-schema get_diff` will print the differences between your new schema & the current one.
Possible options are:
- `-H, --host <my_host>` This will overwrite the `DGRAPH_URL` environment variable if there are any.
- `-P, --path <file_path>` To specify the path of your schema file, by default it uses `./schema.js` in the current working directory.

### alter command
`dgraph-schema alter` will alter your Dgraph schema if there are no conflicts.
Possible options are:
- `-H, --host <my_host>` This will overwrite the `DGRAPH_URL` environment variable if there are any.
- `-P, --path <file_path>` To specify the path of your schema file, by default it uses `./schema.js` in the current working directory.
- `-F, --force` This flag allows you to ignore any conflicts when trying to alter your schema.