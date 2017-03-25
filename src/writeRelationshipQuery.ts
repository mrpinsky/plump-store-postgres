import { ModelSchema } from 'plump';
import { ParameterizedQuery } from './semiQuery';

export function writeRelationshipQuery(schema: ModelSchema, relName: string): ParameterizedQuery {
  const rel = schema.relationships[relName].type;
  const otherRelName = rel.sides[relName].otherName;
  const sqlData = rel.storeData.sql;

  const insertArray = [
    sqlData.joinFields[otherRelName],
    sqlData.joinFields[relName],
  ];
  const insertString = `insert into "${sqlData.tableName}" (${insertArray.join(', ')})
    values (${insertArray.map(() => '?').join(', ')})
    on conflict ("${sqlData.joinFields[otherRelName]}", "${sqlData.joinFields[relName]}") `;
  if (rel.extras) {
    const extraArray = Object.keys(rel.extras).concat();
    return {
      queryString: `${insertString} do update set ${extraArray.map(v => `${v} = ?`).join(', ')};`,
      fields: ['item.id', 'child.id'].concat(extraArray).concat(extraArray),
    };
  } else {
    return {
      queryString: `${insertString} do nothing;`,
      fields: ['item.id', 'child.id'],
    };
  }
}
