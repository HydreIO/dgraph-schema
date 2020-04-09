const { program } = require('commander');
const dgraph = require('dgraph-js');
const grpc = require('grpc');

const util = require('util')

const clientStub = new dgraph.DgraphClientStub(
  'localhost:9080',
  grpc.credentials.createInsecure(),
);
const dgraphClient = new dgraph.DgraphClient(clientStub);
const rawString = `type user {
  uuid
  hash
  desc
}
uuid: string @index(exact) @upsert .
hash: string .
desc: int .
`
// const c = require('chalk');
const { schema, types } = require('./schema');

// - permet de definir un schema
// - d'alter la db avec
// - exit code 1 si ya un conflict non authoriser en printant la diff
// - de force alter la db

const prepareValueString = predicate => {
  const preparedArray = predicate.split(' ');
  if (preparedArray[preparedArray.length - 1] === '.') {
    preparedArray.pop();
  } else {
    throw new Error('Missing . at the end of predicate, or incorrect spacing.');
  }
  return preparedArray;
};

const typeCheck = (type, object) => {
  const normalTypes = ['default', 'bool', 'datetime', 'float', 'geo', 'int', 'password', 'string', 'uid'];
  const listTypes = ['[default]', '[bool]', '[datetime]', '[float]', '[geo]', '[int]', '[string]', '[uid]'];
  const typeIsNotAList = normalTypes.some(value => value === type);
  const typeIsList = listTypes.some(value => value === type);
  if (!typeIsNotAList && !typeIsList) {
    throw new Error('Incorrect or missing type in predicate.');
  } else {
    object.type = type;
  }
  if (typeIsList) {
    object.list = true;
  }
};

const indexCheck = (aValues, object) => {
  const aTokenizer = [];
  const index = aValues.some(value => {
    if (value.includes('@index')) {
      if (value.slice(6, 7) !== '(' || value.slice(-1) !== ')') {
        throw new Error('@index is invalid, missing parenthesis or there are spaces in tokenizer.');
      }
      const fields = value.slice(7, -1).split(',');
      fields.forEach(field => {
        aTokenizer.push(field.trim());
      });
      return true
    }
    return false
  });
  if (index) {
    object.index = index;
    object.tokenizer = aTokenizer;
  }
};

const otherOptions = (aValues, object) => {
  aValues.forEach(value => {
    if (value.includes('@upsert')) {
      object.upsert = true;
    } else if (value.includes('@lang')) {
      object.lang = true;
    }
  })
}

// Create a JSON schema by using our `schema` from our file
const createJsonSchema = () => {
  const jsonSchema = [];
  Object.entries(schema).forEach(([key, value]) => {
    const object = { predicate: key };
    const aValues = prepareValueString(value);
    typeCheck(aValues[0], object);
    aValues.shift();
    indexCheck(aValues, object);
    otherOptions(aValues, object);
    jsonSchema.push(object);
  });
  return jsonSchema;
}

const createJsonTypes = () => {
  const jsonTypes = [];
  Object.entries(types).forEach(([key, value]) => {
    const object = { name: key };
    const fields = [];
    value.forEach(field => {
      fields.push({ name: field })
    });
    object.fields = fields;
    jsonTypes.push(object);
  });
  return jsonTypes;
}

const prepareJson = (sch, typ) => ({
  schema: sch,
  types: typ,
});

const rawSchema = () => {
  let allPredicates = '';
  Object.entries(schema).forEach(([key, value]) => {
    allPredicates += `${key}: ${value}\n`;
  });
  return allPredicates;
}

const rawTypes = () => {
  let allTypes = '';
  Object.entries(types).forEach(([key, value]) => {
    let values = '';
    value.forEach(subValue => {
      values += `\n\t${subValue}`
    })
    allTypes += `\ntype ${key} {${values}\n}`
  });

  return allTypes;
}


program.version('0.0.1');
program.option('-p, --path <string>', 'path of the schema', './schema.js');
program.command('pepeg').action(async () => {
  const op = new dgraph.Operation();
  op.setSchema(rawString)
  await dgraphClient.alter(op);
});
program.command('getSchema').action(async () => {
  const response = await dgraphClient.newTxn().query('schema {}');
  // const { schema, types } = response.getJson()
  console.log(util.inspect(response.getJson(), false, null, true))
});
program.command('createJsonSchema').action(() => {
  const jsonSchema = createJsonSchema();
  const jsonTypes = createJsonTypes();
  const preparedSchema = prepareJson(jsonSchema, jsonTypes);
  console.log(preparedSchema);
});
program.command('createRawSchema').action(async () => {
  const sSchema = rawSchema();
  const sTypes = rawTypes();
  const sRaw = `${sTypes}\n${sSchema}`;
  const op = new dgraph.Operation();
  op.setSchema(sRaw)
  await dgraphClient.alter(op);
  console.log(sRaw);
});
program.parse(process.argv);
