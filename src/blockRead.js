
export function blockRead(Type, knex, query) {
  const selects = [];
  const groups = [];
  const joins = [];
  const schema = Type.$fields;
  Object.keys(schema).forEach((key) => {
    if (schema[key].type === 'hasMany') {
      const rel = schema[key].relationship;
      const joinName = key.toLowerCase();
      const joinBlock = {
        join: [
          `${rel.$name} as ${joinName}`,
          `${joinName}.${rel.$sides[key].self.field}`,
          '=',
          `${Type.$name}.${Type.$id}`,
        ],
        where: [],
      };
      selects.push(knex.raw(
        `COALESCE(
          array_agg(${joinName}.${rel.$sides[key].other.field})
          FILTER (WHERE ${joinName}.child_id IS NOT NULL),
          '{}')
        as ${key}`
      ));
      if (rel.$sides[key].self.query) {
        joinBlock.where.push(rel.$sides[key].self.query.logic);
      }
      if (rel.$restrict) {
        Object.keys(rel.$restrict).forEach((restriction) => {
          joinBlock.where.push(
            ['where', `${rel.$name}.${restriction}`, '=', rel.$restrict[restriction].value]
          );
        });
      }
      if (rel.$extras) {
        Object.keys(rel.$extras).forEach((extra) => `${joinName}.${extra}`);
      }
      joins.push(joinBlock);
    } else {
      selects.push(key);
      groups.push(key);
    }
  });
  const joinedQuery = joins.reduce((q, join) => q.leftOuterJoin.apply(q, join.join), knex(Type.$name));
  const selectedQuery = joinedQuery.where(query).select(selects);
  const groupByQuery = selectedQuery.groupBy(groups);
  return groupByQuery;
}
