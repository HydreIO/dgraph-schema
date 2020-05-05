import diff from 'deep-diff'

const compare_types_fields = (field_a, field_b) => {
  const type_a = field_a.name.toUpperCase()
  const type_b = field_b.name.toUpperCase()

  let comparator = 0
  if (type_a > type_b)
    comparator = 1
  else if (type_a < type_b)
    comparator = -1

  return comparator
}

const diff_types_checker = (new_schema, current_schema) => {
  const conflicts = []
  const added = []
  const types_to_check = []
  const missing_types = []

  new_schema.types.forEach(type => {
    type.fields.sort(compare_types_fields)
    types_to_check.push(type.name)
  })
  current_schema.types.forEach(type => {
    type.fields.sort(compare_types_fields)
    if (!types_to_check.includes(type.name))
      missing_types.push(type.name)
  })

  types_to_check.forEach(type => {
    const new_object = new_schema.types.find(object => object.name === type)
    const current_object = current_schema.types
        .find(object => object.name === type)
    const differences = diff(current_object, new_object)
    if (typeof differences !== 'undefined') {
      differences.forEach(difference => {
        if (difference.kind === 'E') {
          conflicts.push({
            message: `This object was edited at path: ${ difference.path[0] }`,
            category: 'types',
            object: {
              ...current_object,
            },
            additional_information: `Expected ${ difference.lhs } 
              found ${ difference.rhs }`,
          })
        } else if (difference.kind === 'N') {
          added.push({
            message: 'This new object was added.',
            category: 'types',
            object: {
              ...new_object,
            },
          })
        } else if (difference.kind === 'A') {
          conflicts.push({
            message: 'Change in the fields in this object.',
            category: 'types',
            object: current_object,
          })
        }
      })
    }
  })

  missing_types.forEach(type => {
    const deleted_object = current_schema.types
        .find(object => object.name === type)

    conflicts.push({
      message: 'This object was deleted.',
      category: 'types',
      object: {
        ...deleted_object,
      },
    })
  })

  return {
    conflicts,
    added,
  }
}

const diff_schema_checker = (new_schema, current_schema) => {
  const conflicts = []
  const added = []
  const predicates_to_check = new_schema.schema.map(({
    predicate,
  }) => predicate)
  const missing_predicates = current_schema.schema
      .filter(({
        predicate,
      }) => !predicates_to_check.includes(predicate))
      .map(({
        predicate,
      }) => predicate)

  predicates_to_check.forEach(predicate => {
    const new_object = new_schema.schema
        .find(object => object.predicate === predicate)
    const current_object = current_schema.schema
        .find(object => object.predicate === predicate)
    const differences = diff(current_object, new_object)
    if (typeof differences !== 'undefined') {
      differences.forEach(difference => {
        if (difference.kind === 'E') {
          conflicts.push({
            message: `This object was edited at path:${ difference.path[0] }`,
            category: 'schema',
            object: {
              ...current_object,
            },
            additional_information: `Expected${ difference.rhs } 
              found ${ difference.lhs }`,
          })
        } else if (difference.kind === 'N') {
          if (typeof current_object === 'undefined') {
            added.push({
              message: 'This object was added.',
              object: {
                ...new_object,
              },
            })
          } else {
            conflicts.push({
              message: 'This object was edited',
              category: 'schema',
              object: {
                ...new_object,
              },
            })
          }
        } else if (difference.kind === 'D' && difference.path[0] === 'list') {
          conflicts.push({
            message: 'This object was edited, should be a list.',
            category: 'schema',
            object: {
              ...new_object,
            },
          })
        } else if (new_object?.index && difference.kind === 'A') {
          conflicts.push({
            message: 'Tokenizer of this objects was edited.',
            category: 'schema',
            object: {
              ...current_object,
            },
          })
        }
      })
    }
  })
  missing_predicates.forEach(predicate => {
    const deleted_object = current_schema.schema
        .find(object => object.predicate === predicate)
    conflicts.push({
      message: 'This object was deleted.',
      object: {
        ...deleted_object,
      },
    })
  })

  return {
    conflicts,
    added,
  }
}


export { diff_types_checker, diff_schema_checker }
