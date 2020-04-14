#!/usr/bin/env node
import c from 'chalk';
import program from 'commander';
import fs from 'fs';
import readline from 'readline';

import DgraphHelper from './dgraphHelper';

const helper = new DgraphHelper();

const { log } = console;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const main = async () => {
  log(c.blue('Dgraph schema CLI'));
  log('Please enter en action to continue:')
  log('1 - Get dgraph schema')
  log('2 - Alter dgraph schema')
  rl.question('What to do next ?', async toDo => {
    if (toDo !== '1' && toDo !== '2') {
      log(c.underline.yellow('Incorrect action'))
      main();
    } else if (toDo === '1') {
      const fetchedSchema = await helper.getSchema();
      log('Response', fetchedSchema)
    } else if (toDo === '2') {
      const differences = await helper.getDifferences();
      console.log(differences);
      if (differences.length > 0) {
        process.exit(1);
      }
    }
    rl.close();
  });
};

const alterSchema = async () => {
  if (program.force) {
    console.log('Forced altering schema...');
  } else {
    console.log('Altering schema...');
    // TODO Check for diff if there log them then exit 1
  }
  // TODO Handle Dgraph error
  await helper.alterSchema();
  log(c.greenBright('Successfully altered Dgraph schema.'));
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
  alterSchema();
});

program.parse(process.argv);
