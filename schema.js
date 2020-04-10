export const schema = {
  uuid: 'string @index(exact,fulltext) @upsert .',
  hash: '[string] .',
  desc: 'int .',
  name: 'string @index(hash) .',
}

export const types = {
  user: ['uuid', 'hash', 'desc'],
  pepeg: ['name'],
}
