#!/usr/bin/env node
import c from 'chalk';
import program from 'commander';
import fs from 'fs';
import util from 'util';

import helper from './dgraphHelper';

const { DB_URL: HOST } = process.env;

const print_diff = differences => {
  const conflicts = differences[0];
  const added = differences[1];

  if (conflicts.length > 0) {
    console.log(c.redBright('Can\'t alter schema, there are conflicts.'));
    conflicts.forEach(element => {
      console.log(element);
    });
  } else if (added.length > 0) {
    console.log(c.greenBright('New changes only.'));
    added.forEach(element => {
      console.log(element);
    });
  } else {
    console.log(c.greenBright('Same schema, no alteration required.'));
  }
}

program
  .version('0.0.1')
  .option('-F, --force', 'Used to force alter a schema even if there are conflicts.')
  .action(cmd => {
    const { args } = cmd;
    try {
      if (!fs.existsSync('./schemaa.js')) {
        console.error(c.redBright('File ./schema.js does not exists. It is required to continue.'));
        process.exit(1);
      }
    } catch (error) {
      console.error(error);
    }
    if (args.length === 0) {
      console.log(c.yellowBright('No action specified.'));
    } else {
      console.log(c.yellowBright('Wrong action specified.'));
    }
  });

program.command('get_schema').action(async () => {
  const client = helper.create_client(HOST);
  const fetched_schema = await helper.get_schema(client);
  console.log(util.inspect(fetched_schema, false, null, true));
});

program.command('get_diff').action(async () => {
  const client = helper.create_client();
  const differences = await helper.diff_checker(client);
  print_diff(differences);
});

program.command('alter_schema').action(async () => {
  const force_flag = !!program.force;
  const client = helper.create_client();
  const differences = await helper.diff_checker(client);
  print_diff(differences);
  if (force_flag) {
    console.log(c.bgRedBright(' Forcing schema alteration. '));
    await helper.alter_schema(client);
  } else if (differences[1].length > 0) {
    await helper.alter_schema(client);
  }
});

program.parse(process.argv);
