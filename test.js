const dgraph = require('dgraph-js');
const grpc = require('grpc');
const DragphHelper = require('./dgraphUtilities');

const clientStub = new dgraph.DgraphClientStub(
  // addr: optional, default: "localhost:9080"
  'localhost:9080',
  // credentials: optional, default: grpc.credentials.createInsecure()
  grpc.credentials.createInsecure(),
);
const dgraphClient = new dgraph.DgraphClient(clientStub);
const DGRAPH_HELPER = new DragphHelper(dgraphClient);

const schema = {
  user: {
    uuid: 'string @index(exact) @upsert',
    hash: 'string',
    desc: 'int',
  },
  session: { ip: 'string' },
}

const pepeg = async () => {
  const NEW_SCHEMA = DGRAPH_HELPER.prepareSchema(schema);
  const op = new dgraph.Operation();
  op.setSchema(NEW_SCHEMA);
  await dgraphClient.alter(op);
}

//pepeg()

DGRAPH_HELPER.getSchema();
