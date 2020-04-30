#!/usr/bin/env node --harmony
import c from 'chalk'
import program from 'commander'
import util from 'util'

import helper from './dgraph_helper'

const host_option = ['-H, --host <address>',
  'The host address of your Dgraph DB']
const path_option = ['-P, --path <schema_path>', 'The path to your schema.']

const print_diff = differences => {
  const {
    conflicts, added,
  } = differences

  if (conflicts.length > 0) {
    console.log(c.redBright('Can\'t alter schema, there are conflicts.'))
    conflicts.forEach(element => {
      console.log(element)
    })
  } else if (added.length > 0) {
    console.log(c.greenBright('New changes only.'))
    added.forEach(element => {
      console.log(element)
    })
  } else
    console.log(c.greenBright('Same schema, no alteration required.'))
}

program
    .version('1.0.0')
    .description('A CLI to manage your Dgraph schemas with ease.')

program
    .command('get_schema')
    .description('Get the current Dgraph schema.')
    .option(host_option[0], host_option[1])
    .action(async cmd => {
      const host = cmd.host ? cmd.host : process.env.DB_URL
      const client = helper.create_client(host)
      const fetched_schema = await helper.get_schema(client)
      console.log(util.inspect(fetched_schema, false, null, true))
    })
program
    .command('get_diff')
    .description('Prints the differences between the new & current schema.')
    .option(host_option[0], host_option[1])
    .option(path_option[0], path_option[1])
    .action(async cmd => {
      const host = cmd.host ? cmd.host : process.env.DB_URL
      const schema_file = await helper.get_schema_from_path(cmd.path)
      if (!schema_file) {
        console.log(c.bgRedBright('Schema file does not exists !'))
        process.exit(1)
      }
      const client = helper.create_client(host)
      const differences = await helper.diff_checker(client, schema_file)
      print_diff(differences)
    })
program
    .command('alter')
    .description('Alter your Dgraph schema if there are no conflicts')
    .option(host_option[0], host_option[1])
    .option(path_option[0], path_option[1])
    .option('-F, --force', 'Forcing schema alteration.')
    .action(async cmd => {
      const host = cmd.host ? cmd.host : process.env.DB_URL
      const schema_file = await helper.get_schema_from_path(cmd.path)
      if (!schema_file) {
        console.log(c.bgRedBright('Schema file does not exists !'))
        process.exit(1)
      }
      const force_flag = !!cmd.force
      const client = helper.create_client(host)
      const differences = await helper.diff_checker(client, schema_file)
      print_diff(differences)
      if (force_flag) {
        console.log(c.bgRedBright(' Forcing schema alteration. '))
        await helper.alter_schema(client, schema_file)
      } else if (differences[1].length > 0)
        await helper.alter_schema(client, schema_file)
    })

program.parseAsync(process.argv)
