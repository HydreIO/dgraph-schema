const deepDiff = require('deep-diff');

class DgraphUtilities {
  constructor(dragphClient) {
    this.dragphClient = dragphClient
    this.schema = {}
    this.TYPES = ['list', '']
  }

  async getSchema(preparedSchema) {
    const response = await this.dragphClient.newTxn().query('schema {}');
    // res.getSchemaList(); Not working smh
    this.schema = response.getJson()
    const alterSchema = !(deepDiff(this.schema, preparedSchema) || []).some(({ kind }) => ['N', 'D', 'E'].includes(kind))
    console.log(deepDiff(this.schema, preparedSchema));
  }

  async prepareSchema(schema) {
    const schemaTypes = []
    const schemaPredicates = []
    Object.entries(schema).forEach(([key, value], index) => {
      schemaTypes.push([key, []])
      Object.entries(value).forEach(([subKey, subValue]) => {
        const type = `${key}.${subKey}`
        const pred = `${subValue} .`
        schemaTypes[index][1].push(type)
        schemaPredicates.push([type, pred])
      })
    });
    const typesString = this.createTypeStr(schemaTypes)
    const predicsString = this.createPredicStr(schemaPredicates)
    return this.createSchemaStr(typesString, predicsString);
  }

  static createTypeStr(types) {
    let allTypes = ''
    for (const type of types) {
      let values = ''
      for (let j = 0; j < type[1].length; j++) {
        values += `\n\t${type[1][j]}`
      }
      const formattedType = `\ntype ${type[0]} {${values}\n}`
      allTypes += formattedType
    }
    return allTypes
  }

  static createPredicStr(predics) {
    let allPredicates = ''
    for (const predicate of predics) {
      allPredicates += `\n${predicate[0]}: ${predicate[1]}`
    }
    return allPredicates
  }

  static createSchemaStr(allTypes, allPredicates) {
    this.getSchema(`${allTypes}${allPredicates}`);
    return `${allTypes}${allPredicates}`
  }
}

module.exports = DgraphUtilities;
