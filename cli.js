#!/usr/bin/env node
import c from 'chalk';
import program from 'commander';
import fs from 'fs';
import readline from 'readline';
import util from 'util';

import helper from './dgraphHelper';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const get_schema = async () => {
  const CLIENT = helper.create_client();
  const fetched_schema = await helper.get_schema(CLIENT);
  console.log(util.inspect(fetched_schema, false, null, true));
}

const get_diff = async client => helper.diff_checker(client);

const print_diff = differences => {
  const CONFLICTS = differences[0];
  const ADDED = differences[1];

  if (CONFLICTS.length > 0) {
    console.log(c.redBright('Can\'t alter schema, there are conflicts.'));
    CONFLICTS.forEach(element => {
      console.log(element);
    });
  } else if (ADDED.length > 0) {
    console.log(c.greenBright('New changes only.'));
    ADDED.forEach(element => {
      console.log(element);
    });
  } else {
    console.log(c.greenBright('Same schema, no alter needed.'));
  }
}

const alter_schema = async (client, force_flag) => {
  const DIFFERENCES = await get_diff(client);
  print_diff(DIFFERENCES);
  if (force_flag) {
    console.log(c.bgRedBright(' Force altering schema. '));
    await helper.alter_schema(client);
  } else if (DIFFERENCES[1].length > 0) {
    await helper.alter_schema(client);
  }
}

const main = async () => {
  console.log(c.blueBright('\nDgraph schema CLI\n'));
  console.log('Please enter en action to continue:');
  console.log('1 - Get current dgraph schema.');
  console.log('2 - Diff output only.');
  console.log('3 - Alter dgraph schema with diff output.');
  rl.question('\nWhat to do next ? ', async toDo => {
    if (toDo !== '1' && toDo !== '2' && toDo !== '3') {
      console.log(c.underline.yellow('Incorrect action'));
      main();
    } else if (toDo === '1') {
      console.log(c.greenBright('\nCurrent Dgraph schema:'));
      get_schema();
      rl.close();
    } else if (toDo === '2') {
      const CLIENT = helper.create_client();
      const DIFFERENCES = await get_diff(CLIENT);
      print_diff(DIFFERENCES);
      rl.close();
    } else if (toDo === '3') {
      const FORCE_FLAG = !!program.force;
      const CLIENT = helper.create_client();
      await helper.diff_checker(CLIENT, FORCE_FLAG);
      rl.close();
    }
  });
};


program
  .version('0.0.1')
  .option('-F, --force', 'Used to force alter a schema even if there are conflicts.')
  .action(cmd => {
    const { args } = cmd;
    if (args.length === 0) {
      main();
    } else {
      console.log('There are args:', args);
      try {
        if (!fs.existsSync('./schemaa.js')) {
          console.error(c.redBright('File ./schema.js does not exists. It is required to continue.'));
        }
      } catch (error) {
        console.error(error);
      }
      process.exit(0);
    }
  });

program.command('get_schema').action(async () => {
  await get_schema();
  process.exit(0);
});

program.command('get_diff').action(async () => {
  const CLIENT = helper.create_client();
  const DIFFERENCES = await get_diff(CLIENT);
  print_diff(DIFFERENCES);
  process.exit(0);
});

program.command('alter_schema').action(async () => {
  const FORCE_FLAG = !!program.force;
  const CLIENT = helper.create_client();
  await alter_schema(CLIENT, FORCE_FLAG);
  process.exit(0);
});

program.parse(process.argv);
