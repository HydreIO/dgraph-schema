import diff from 'deep-diff';
import dgraph from 'dgraph-js';
import grpc from 'grpc';

import { SCHEMA, TYPES } from './schema';

const DB_URL = process.env.DGRAPH_URL;

const create_client = () => {
  const CLIENT_STUB = new dgraph.DgraphClientStub(DB_URL, grpc.credentials.createInsecure());
  return new dgraph.DgraphClient(CLIENT_STUB);
}

const get_schema = async client => (await client.newTxn().query('schema {}')).getJson();

const prepare_value_string = predicate => {
  const PREPARED_ARRAY = predicate.split(' ');
  if (PREPARED_ARRAY[PREPARED_ARRAY.length - 1] === '.') {
    PREPARED_ARRAY.pop();
  } else {
    throw new Error('Missing . at the end of predicate, or incorrect spacing.');
  }
  return PREPARED_ARRAY;
};

const type_check = (type, object) => {
  const NORMAL_TYPES = ['default', 'bool', 'datetime', 'float', 'geo', 'int', 'password', 'string', 'uid'];
  const LIST_TYPES = ['[default]', '[bool]', '[datetime]', '[float]', '[geo]', '[int]', '[string]', '[uid]'];
  const TYPE_IS_NOT_ALIST = NORMAL_TYPES.some(value => value === type);
  const TYPE_IS_LIST = LIST_TYPES.some(value => value === type);
  if (!TYPE_IS_NOT_ALIST && !TYPE_IS_LIST) {
    throw new Error('Incorrect or missing type in predicate.');
  } else if (TYPE_IS_LIST) {
    object.type = type.slice(1, -1);
  } else {
    object.type = type;
  }
  if (TYPE_IS_LIST) {
    object.list = true;
  }
};

const index_check = (aValues, object) => {
  const TOKENIZER_ARRAY = [];
  const INDEX = aValues.some(value => {
    if (value.includes('@index')) {
      if (value.slice(6, 7) !== '(' || value.slice(-1) !== ')') {
        throw new Error('@index is invalid, missing parenthesis or there are spaces in tokenizer.');
      }
      const FIELDS = value.slice(7, -1).split(',');
      FIELDS.forEach(field => {
        TOKENIZER_ARRAY.push(field.trim());
      });
      return true;
    }
    return false;
  });
  if (INDEX) {
    object.index = INDEX;
    object.tokenizer = TOKENIZER_ARRAY;
  }
};

const other_options = (aValues, object) => {
  aValues.forEach(value => {
    if (value.includes('@upsert')) {
      object.upsert = true;
    } else if (value.includes('@lang')) {
      object.lang = true;
    }
  })
}

// Create a JSON SCHEMA by using our `SCHEMA` from our file
const create_json_schema = () => {
  const JSON_SCHEMA = [];
  Object.entries(SCHEMA).forEach(([key, value]) => {
    const OBJECT = { predicate: key };
    const PREDICATES_ARRAY = prepare_value_string(value);
    try {
      type_check(PREDICATES_ARRAY[0], OBJECT);
    } catch (error) {
      console.error(error);
    }
    PREDICATES_ARRAY.shift();
    try {
      index_check(PREDICATES_ARRAY, OBJECT);
    } catch (error) {
      console.error(error);
    }
    other_options(PREDICATES_ARRAY, OBJECT);
    JSON_SCHEMA.push(OBJECT);
  });
  return JSON_SCHEMA;
}

const create_json_types = () => {
  const JSON_TYPES = [];
  Object.entries(TYPES).forEach(([key, value]) => {
    const OBJECT = { name: key };
    const FIELDS = [];
    value.forEach(field => {
      FIELDS.push({ name: field });
    });
    OBJECT.fields = FIELDS;
    JSON_TYPES.push(OBJECT);
  });
  return JSON_TYPES;
}

// Custom comparator for sorting our schema
const compare_predicate_object = (object_a, object_b) => {
  const PREDICATE_A = object_a.predicate.toUpperCase();
  const PREDICATE_B = object_b.predicate.toUpperCase();

  let comparator = 0;
  if (PREDICATE_A > PREDICATE_B) {
    comparator = 1;
  } else if (PREDICATE_A < PREDICATE_B) {
    comparator = -1;
  }
  return comparator;
}

// Custom comparator for sorting types
const compare_name_object = (object_a, object_b) => {
  const PREDICATE_A = object_a.name.toUpperCase();
  const PREDICATE_B = object_b.name.toUpperCase();

  let comparator = 0;
  if (PREDICATE_A > PREDICATE_B) {
    comparator = 1;
  } else if (PREDICATE_A < PREDICATE_B) {
    comparator = -1;
  }
  return comparator;
}

const prepare_new_schema = () => {
  const SORTED_SCHEMA = create_json_schema().sort(compare_predicate_object);
  const SORTED_TYPES = create_json_types().sort(compare_name_object);
  return {
    schema: SORTED_SCHEMA,
    types: SORTED_TYPES,
  };
}

// ====================================================================================
const remove_dgraph_data = uneprepared_schema => {
  // Removing autogenerated fields by dbgraph
  for (let i = 0; i < uneprepared_schema.schema.length; i++) {
    if (uneprepared_schema.schema[i].predicate === 'dgraph.graphql.schema') {
      uneprepared_schema.schema.splice(i, 1);
      break;
    }
  }
  for (let i = 0; i < uneprepared_schema.schema.length; i++) {
    if (uneprepared_schema.schema[i].predicate === 'dgraph.type') {
      uneprepared_schema.schema.splice(i, 1);
      break;
    }
  }
  // Removing autogenerated types
  for (let i = 0; i < uneprepared_schema.types.length; i++) {
    if (uneprepared_schema.types[i].name === 'dgraph.graphql') {
      uneprepared_schema.types.splice(i, 1);
      break;
    }
  }
  return uneprepared_schema;
}

const prepare_current_schema = async client => {
  const FETECHED_SCHEMA = await get_schema(client);
  const FORMATED_SCHEMA = remove_dgraph_data(FETECHED_SCHEMA);
  FORMATED_SCHEMA.schema.sort(compare_predicate_object);
  FORMATED_SCHEMA.types.sort(compare_name_object);
  return FORMATED_SCHEMA;
}

const compare_types_fields = (field_a, field_b) => {
  const TYPE_A = field_a.name.toUpperCase();
  const TYPE_B = field_b.name.toUpperCase();

  let comparator = 0;
  if (TYPE_A > TYPE_B) {
    comparator = 1;
  } else if (TYPE_A < TYPE_B) {
    comparator = -1;
  }
  return comparator;
}

const diff_types_checker = (new_schema, current_schema) => {
  const CONFLICTS = [];
  const ADDED = [];
  const TYPES_TO_CHECK = [];
  const MISSING_TYPES = [];

  // Get all types in new schema
  new_schema.types.forEach(type => {
    type.fields.sort(compare_types_fields);
    TYPES_TO_CHECK.push(type.name);
  });
  // Checking if dgraph schema has types that are now missing in new
  current_schema.types.forEach(type => {
    type.fields.sort(compare_types_fields);
    if (!TYPES_TO_CHECK.includes(type.name)) {
      MISSING_TYPES.push(type.name);
    }
  });

  // Checking diff for each type if there are any
  TYPES_TO_CHECK.forEach(type => {
    const NEW_OBJECT = new_schema.types.find(object => object.name === type);
    const CURRENT_OBJECT = current_schema.types.find(object => object.name === type);
    const DIFFERENCES = diff(CURRENT_OBJECT, NEW_OBJECT);
    if (typeof DIFFERENCES !== 'undefined') {
      DIFFERENCES.forEach(difference => {
        if (difference.kind === 'E') {
          CONFLICTS.push({
            message: `This object was edited at path: ${difference.path[0]}`,
            category: 'types',
            object: { ...CURRENT_OBJECT },
            additional_information: `Expected ${difference.lhs} found ${difference.rhs}`,
          });
        } else if (difference.kind === 'N') {
          ADDED.push({
            message: 'This new object was added.',
            category: 'types',
            object: { ...NEW_OBJECT },
          });
        } else if (difference.kind === 'A') {
          CONFLICTS.push({
            message: 'Change in the fields in this object.',
            category: 'types',
            object: CURRENT_OBJECT,
          });
        }
      });
    }
  });
  // Printing missing types
  MISSING_TYPES.forEach(type => {
    const DELETED_OBJECT = current_schema.types.find(object => object.name === type);
    CONFLICTS.push({
      message: 'This object was deleted.',
      category: 'types',
      object: { ...DELETED_OBJECT },
    });
  });

  return [CONFLICTS, ADDED];
}

const diff_schema_checker = (new_schema, current_schema) => {
  const CONFLICTS = [];
  const ADDED = [];
  // Arrays of predicates
  const PREDICATES_TO_CHECK = [];
  const MISSING_PREDICATES = [];
  // Get all predicates to check
  new_schema.schema.forEach(element => {
    PREDICATES_TO_CHECK.push(element.predicate);
  });
  // Checking if dgraph schema has types that are now missing in new
  current_schema.schema.forEach(element => {
    if (!PREDICATES_TO_CHECK.includes(element.predicate)) {
      MISSING_PREDICATES.push(element.predicate);
    }
  });
  // Checking diff for each type if there are any
  PREDICATES_TO_CHECK.forEach(predicate => {
    const NEW_OBJECT = new_schema.schema.find(object => object.predicate === predicate);
    const CURRENT_OBJECT = current_schema.schema.find(object => object.predicate === predicate);
    const DIFFERENCES = diff(CURRENT_OBJECT, NEW_OBJECT); // Can have multiple diff for 1 object
    if (typeof DIFFERENCES !== 'undefined') {
      DIFFERENCES.forEach(difference => {
        console.log(difference);
        if (difference.kind === 'E') {
          CONFLICTS.push({
            message: `This object was edited at path:${difference.path[0]}`,
            category: 'schema',
            object: { ...CURRENT_OBJECT },
            additional_information: `Expected${difference.rhs}found${difference.lhs}`,
          });
        } else if (difference.kind === 'N') {
          if (typeof CURRENT_OBJECT === 'undefined') {
            ADDED.push({
              message: 'This object was added.',
              object: { ...NEW_OBJECT },
            });
          } else {
            CONFLICTS.push({
              message: 'This object was edited',
              category: 'schema',
              object: { ...NEW_OBJECT },
            });
          }
        } else if (difference.kind === 'D' && difference.path[0] === 'list') {
          CONFLICTS.push({
            message: 'This object was edited, should be a list.',
            category: 'schema',
            object: { ...NEW_OBJECT },
          });
        } else if (typeof NEW_OBJECT !== 'undefined' && typeof NEW_OBJECT.index !== 'undefined' && NEW_OBJECT.index === true && difference.kind === 'A') {
          CONFLICTS.push({
            message: 'Tokenizer of this objects was edited.',
            category: 'schema',
            object: { ...CURRENT_OBJECT },
          });
        }
      });
    }
  });
  MISSING_PREDICATES.forEach(predicate => {
    const DELETED_OBJECT = current_schema.schema.find(object => object.predicate === predicate);
    CONFLICTS.push({
      message: 'This object was deleted.',
      object: { ...DELETED_OBJECT },
    });
  });

  return [CONFLICTS, ADDED];
}

const raw_schema = () => {
  let raw_predicates = '';
  Object.entries(SCHEMA).forEach(([key, value]) => {
    raw_predicates += `${key}: ${value}\n`;
  });
  return raw_predicates;
}

const raw_types = () => {
  let raw_types_string = '';
  Object.entries(TYPES).forEach(([key, value]) => {
    let values = '';
    value.forEach(sub_value => {
      values += `\n\t${sub_value}`
    });
    raw_types_string += `\ntype ${key} {${values}\n}`;
  });

  return raw_types_string;
}

const alter_schema = async client => {
  const RAW_SCHEMA_STRING = raw_schema();
  const RAW_TYPES_STRING = raw_types();
  const RAW_STRING = `${RAW_TYPES_STRING}\n${RAW_SCHEMA_STRING}`;
  const OPERATION = new dgraph.Operation();
  OPERATION.setSchema(RAW_STRING);
  try {
    await client.alter(OPERATION);
  } catch (error) {
    console.log(error);
  }
}

const diff_checker = async client => {
  // Fetching both schemas
  const NEW_SCHEMA = prepare_new_schema();
  const CURRENT_SCHEMA = await prepare_current_schema(client);

  const TYPES_DIFFERENCES = diff_types_checker(NEW_SCHEMA, CURRENT_SCHEMA);
  const SCHEMA_DIFFERENCES = diff_schema_checker(NEW_SCHEMA, CURRENT_SCHEMA);
  const CONFLICTS = [...TYPES_DIFFERENCES[0], ...SCHEMA_DIFFERENCES[0]];
  const ADDED = [...TYPES_DIFFERENCES[1], ...SCHEMA_DIFFERENCES[1]];

  return [CONFLICTS, ADDED];
}

export default {
  create_client,
  get_schema,
  diff_checker,
  alter_schema,
}
