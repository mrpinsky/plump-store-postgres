import { ParameterizedQuery } from './semiQuery';
import { ModelSchema } from 'plump';

function selects(schema: ModelSchema) {
  const selectArray = [];
  for (const attrName in schema.attributes) {
    selectArray.push(`"${schema.storeData.sql.tableName}"."${attrName}"`);
  }
  for (const relName in schema.relationships) {
    const rel = schema.relationships[relName].type;
    const otherName = rel.sides[relName].otherName;
    const otherFieldName = rel.storeData.sql.joinFields[otherName];
    const extraAgg = [];
    if (rel.extras) {
      for (const extra in rel.extras) {
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

function joins(schema: ModelSchema) {
  const joinStrings = [];
  for (const relName in schema.relationships) {
    const rel = schema.relationships[relName].type;
    const sqlBlock = rel.storeData.sql;
    if (sqlBlock.joinQuery) {
      joinStrings.push(
        `left outer join ${rel.storeData.sql.tableName} as "${relName}" ${sqlBlock.joinQuery[relName]}`
      );
    } else {
      joinStrings.push(
        `left outer join ${rel.storeData.sql.tableName} as "${relName}" `
        + `on "${relName}".${sqlBlock.joinFields[relName]} = ${schema.storeData.sql.tableName}.${schema.idAttribute}`
      );
    }
  }
  return joinStrings.join('\n');
}

function singleWhere(schema: ModelSchema) {
  if (schema.storeData && schema.storeData.sql && schema.storeData.sql.singleQuery) {
    return schema.storeData.sql.singleQuery;
  } else {
    return `where ${schema.storeData.sql.tableName}.${schema.idAttribute} = ?`;
  }
}

function bulkWhere(schema: ModelSchema) {
  if (schema.storeData && schema.storeData.sql && schema.storeData.sql.bulkQuery) {
    return schema.storeData.sql.bulkQuery;
  } else if (schema.storeData && schema.storeData.sql && schema.storeData.sql.singleQuery) {
    return schema.storeData.sql.singleQuery;
  } else {
    return `where ${schema.storeData.sql.tableName}.${schema.idAttribute} = ?`;
  }
}

function groupBy(schema: ModelSchema) {
  return `group by ${Object.keys(schema.attributes).map((attrName) => `"${attrName}"`).join(', ')}`;
}

export function bulkQuery(schema: ModelSchema): ParameterizedQuery {
  return {
    queryString: `${selects(schema)} \nfrom ${schema.storeData.sql.tableName} \n${joins(schema)} \n${bulkWhere(schema)} \n${groupBy(schema)};`, // tslint:disable-line max-line-length
    fields: ['id']
  };
}

export function readQuery(schema: ModelSchema): ParameterizedQuery {
  return {
    queryString: `${selects(schema)} \nfrom ${schema.storeData.sql.tableName} \n${joins(schema)} \n${singleWhere(schema)} \n${groupBy(schema)};`, // tslint:disable-line max-line-length
    fields: ['id'],
  };
}
