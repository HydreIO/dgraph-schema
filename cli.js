#!/usr/bin/env node
import c from 'chalk';
import program from 'commander';
import fs from 'fs';
import readline from 'readline';

import helper from './dgraphHelper';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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
      const fetched_schema = await helper.get_schema();
      console.log('Response', fetched_schema)
    } else if (toDo === '2') {
      const differences = await helper.get_differences();
      console.log(differences);
      if (differences.length > 0) {
        process.exit(1);
      }
    } else if (toDo === '3') {
      // await helper.test();
      const CLIENT = helper.create_client();
      // console.log(await helper.get_schema(CLIENT));
      await helper.diff_checker(CLIENT);
    }
    rl.close();
  });
};

const alter_schema = async () => {
  if (program.force) {
    console.log('Forced altering schema...');
  } else {
    console.log('Altering schema...');
    // TODO Check for diff if there log them then exit 1
  }
  // TODO Handle Dgraph error
  await helper.alter_schema();
  console.log(c.greenBright('Successfully altered Dgraph schema.'));
  process.exit(0);
}

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

program.command('alter').action(async () => {
  alter_schema();
});

program.parse(process.argv);
