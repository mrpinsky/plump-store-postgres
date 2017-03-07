/* eslint prefer-template: 0*/

function selects(Model) {
  const selectArray = [];
  for (const attrName in Model.$schema.attributes) {
    selectArray.push(`"${Model.$name}"."${attrName}"`);
  }
  for (const relName in Model.$schema.relationships) {
    const rel = Model.$schema.relationships[relName].type;
    const otherName = rel.$sides[relName].otherName;
    const otherFieldName = rel.$storeData.sql.joinFields[otherName];
    const extraAgg = [];
    if (rel.$extras) {
      for (const extra in rel.$extras) {
        extraAgg.push(`'${extra}'`, `"${relName}"."${extra}"`);
      }
    }
    const extraString = `, 'meta', jsonb_build_object(${extraAgg.join(', ')})`;
    selectArray.push(
      `COALESCE(
        array_agg(
          distinct(
            jsonb_build_object(
              'id', "${relName}"."${otherFieldName}"
              ${extraAgg.length ? extraString : ''}
            )
          )
        )
        FILTER (WHERE "${relName}"."${otherFieldName}" IS NOT NULL),
        '{}')
      as "${relName}"`
    );
  }
  return `select ${selectArray.join(', ')}`;
}

function joins(Model) {
  const joinStrings = [];
  for (const relName in Model.$schema.relationships) {
    const rel = Model.$schema.relationships[relName].type;
    const sqlBlock = rel.$storeData.sql;
    if (sqlBlock.joinQuery) {
      joinStrings.push(
        `left outer join ${rel.$name} as "${relName}" ${sqlBlock.joinQuery[relName]}`
      );
    } else {
      joinStrings.push(
        `left outer join ${rel.$name} as "${relName}" `
        + `on "${relName}".${sqlBlock.joinFields[relName]} = ${Model.$name}.${Model.$id}`
      );
    }
  }
  return joinStrings.join('\n');
}

function singleWhere(Model) {
  if (Model.$storeData && Model.$storeData.sql && Model.$storeData.sql.singleQuery) {
    return Model.$storeData.sql.singleQuery;
  } else {
    return `where ${Model.$name}.${Model.$id} = ?`;
  }
}

function bulkWhere(Model) {
  if (Model.$storeData && Model.$storeData.sql && Model.$storeData.sql.bulkQuery) {
    return Model.$storeData.sql.bulkQuery;
  } else if (Model.$storeData && Model.$storeData.sql && Model.$storeData.sql.singleQuery) {
    return Model.$storeData.sql.singleQuery;
  } else {
    return `where ${Model.$name}.${Model.$id} = ?`;
  }
}

function groupBy(Model) {
  return `group by ${Object.keys(Model.$schema.attributes).map((attrName) => `"${attrName}"`).join(', ')}`;
}

export function bulkQuery(Model) {
  return `${selects(Model)} \nfrom ${Model.$name} \n${joins(Model)} \n${bulkWhere(Model)} \n${groupBy(Model)};`;
}

export function readQuery(Model) {
  return `${selects(Model)} \nfrom ${Model.$name} \n${joins(Model)} \n${singleWhere(Model)} \n${groupBy(Model)};`;
}
