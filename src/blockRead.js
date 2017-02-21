/* eslint prefer-template: 0*/


function deserializeWhereIntoJoin(query, block, joinName, fieldName, knex, Type) {
  // const car = block[0];
  // the query uses 'where', but we want to use 'on' instead
  const cdr = block.slice(1);
  if (Array.isArray(cdr[0])) {
    return cdr.reduce((subQuery, subBlock) => {
      return deserializeWhereIntoJoin(subQuery, subBlock, joinName, fieldName, knex, Type);
    }, query);
  } else {
    cdr[0] = `${joinName}.${cdr[0]}`;
    if (cdr[2] === '{id}') {
      cdr[2] = `${Type.$name}.${Type.$id}`;
    } else {
      cdr[2] = knex.raw(`'${cdr[2]}'`);
    }
    return query.on.apply(query, cdr);
  }
}

export function blockRead(Type, knex, query) {
  const selects = [];
  const groups = [];
  const basicJoins = [];
  const fancyJoins = [];
  const schema = Type.$fields;
  Object.keys(schema).forEach((key) => {
    if (schema[key].type === 'hasMany') {
      const joinName = key.toLowerCase();
      const rel = schema[key].relationship;
      if (rel.$sides[key].self.query) {
        fancyJoins.push({
          logic: rel.$sides[key].self.query.logic,
          table: `${rel.$name} as ${joinName}`,
          joinName: joinName,
          fieldName: rel.$sides[key].other.field,
        });
      } else {
        const joinBlock = {
          join: [
            `${rel.$name} as ${joinName}`,
            `${joinName}.${rel.$sides[key].self.field}`,
            '=',
            `${Type.$name}.${Type.$id}`,
          ],
          where: [],
        };
        if (rel.$restrict) {
          Object.keys(rel.$restrict).forEach((restriction) => {
            joinBlock.where.push(
              [`${joinName}.${restriction}`, '=', knex.raw(`'${rel.$restrict[restriction].value}'`)]
            );
          });
        }
        basicJoins.push(joinBlock);
      }
      const extraAgg = [];
      if (rel.$extras) {
        Object.keys(rel.$extras).forEach((extra) => {
          extraAgg.push(`'${extra}'`, `${joinName}.${extra}`);
        });
      }
      selects.push(knex.raw(
        `COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', ${joinName}.${rel.$sides[key].other.field}
                ${extraAgg.length ? ',' + extraAgg.join(',') : ''}
              )
            )
          )
          FILTER (WHERE ${joinName}.${rel.$sides[key].other.field} IS NOT NULL),
          '{}')
        as ${key}`
      ));
    } else {
      selects.push(key);
      groups.push(key);
    }
  });
  const joinedQuery = basicJoins.reduce((q, join) => {
    return q.leftOuterJoin(join.join[0], (qb) => {
      qb.on(join.join[1], join.join[2], join.join[3]);
      join.where.forEach((where) => qb.andOn.apply(qb, where));
    });
  }, knex(Type.$name));

  const evenMoreJoinedQuery = fancyJoins.reduce((q, join) => {
    return q.leftOuterJoin(join.table, (qb) => {
      return deserializeWhereIntoJoin(qb, join.logic, join.joinName, join.fieldName, knex, Type);
    });
  }, joinedQuery);
  const selectedQuery = evenMoreJoinedQuery.where(query).select(selects);
  const groupByQuery = selectedQuery.groupBy(groups);
  // console.log(groupByQuery.toString());
  return groupByQuery;
}
