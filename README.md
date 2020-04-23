# dgraph-schema
dgraph-schema is node a CLI allowing you to manage your Dgraph schemas with ease.
You can:
- Print your current Dgraph schema
- Print the output between your new schema & the current one
- Alter your Dgraph schema if there are no conflicts

## Requirement
Node v13.12.0 or later

## How to use it
`node --experimental-specifier-resolution=node cli.js` to use the CLI.

You can pass an optional flag to force the alter of you current schema even if there are conflicts by using `-F` or `--force`.

Such as: `node --experimental-specifier-resolution=node cli.js -F`

The CLI also has 3 commands: 
- `get_schema`
- `get_diff`
- `alter_schema`

### get_schema command
`node --experimental-specifier-resolution=node cli.js get_schema` will print the current Dgraph schema.

### get_diff command
` node --experimental-specifier-resolution=node cli.js get_diff` will print the differences between your new schema & the current one.

### alter_schema command
` node --experimental-specifier-resolution=node cli.js alter_schema` will alter your Dgraph schema if there are no conflicts.
You can pass the optional `-F` or `--force` to ignore the conflicts.