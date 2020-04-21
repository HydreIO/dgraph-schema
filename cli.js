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

const get_diff = async client => helper.diff_checker(client)

const alter_schema = async (client, force_flag) => {
  const DIFFERENCES = await get_diff(client);
  const CONFLICTS = DIFFERENCES[0];
  const ADDED = DIFFERENCES[1];
  if (force_flag) {
    console.log('Force altering schema');
    await helper.alter_schema(client);
  } else if (CONFLICTS.length > 0) {
    console.log('Can\'t alter schema, there are conflicts.');
    CONFLICTS.forEach(element => {
      console.log(element);
    });
  } else if (ADDED.length > 0) {
    console.log('New changes only.');
    ADDED.forEach(element => {
      console.log(element);
    });
    await helper.alter_schema(client);
  } else {
    console.log('Same schema, no alter needed');
  }
}

const main = async () => {
  console.log(c.blue('Dgraph schema CLI'));
  console.log('Please enter en action to continue:')
  console.log('1 - Get dgraph schema')
  console.log('2 - Alter dgraph schema')
  rl.question('What to do next ?', async toDo => {
    if (toDo !== '1' && toDo !== '2' && toDo !== '3') {
      console.log(c.underline.yellow('Incorrect action'))
      main();
    } else if (toDo === '1') {
      get_schema();
    } else if (toDo === '2') {
      const differences = await helper.get_differences();
      console.log(differences);
      if (differences.length > 0) {
        process.exit(1);
      }
    } else if (toDo === '3') {
      const FORCE_FLAG = !!program.force;
      const CLIENT = helper.create_client();
      await helper.diff_checker(CLIENT, FORCE_FLAG);
    }
    rl.close();
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
        console.error(error)
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
  const CONFLICTS = DIFFERENCES[0];
  const ADDED = DIFFERENCES[1];

  if (CONFLICTS.length > 0) {
    console.log('Can\'t alter schema, there are conflicts.');
    CONFLICTS.forEach(element => {
      console.log(element);
    });
  } else if (ADDED.length > 0) {
    console.log('New changes only.');
    ADDED.forEach(element => {
      console.log(element);
    });
  } else {
    console.log('Same schema, no alter needed');
  }
  process.exit(0);
});

program.command('alter_schema').action(async () => {
  const FORCE_FLAG = !!program.force;
  const CLIENT = helper.create_client();
  await alter_schema(CLIENT, FORCE_FLAG);
  process.exit(0);
});

program.parse(process.argv);
