/* eslint prefer-template: 0*/

export function blockRead(Type, knex, query) {
  const selects = [];
  const groups = [];
  const basicJoins = [];
  const rawJoins = [];
  const schema = Type.$fields;
  Object.keys(schema).forEach((key) => {
    if (schema[key].type === 'hasMany') {
      const joinName = key.toLowerCase();
      const rel = schema[key].relationship;
      if (rel.$sides[key].self.query) {
        rawJoins.push(rel.$sides[key].self.query.rawJoin);
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
              [`${rel.$name}.${restriction}`, '=', rel.$restrict[restriction].value]
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
          FILTER (WHERE ${joinName}.child_id IS NOT NULL),
          '{}')
        as ${key}`
      ));
    } else {
      selects.push(key);
      groups.push(key);
    }
  });
  const joinedQuery = basicJoins.reduce((q, join) => {
  //   q.leftOuterJoin(join.join[0], function() {
  //     join.where.reduce(function()
  //   })
  //   return join.where.reduce((subQ, where) => subQ.andOn.apply(subQ, where), q.leftOuterJoin.apply(q, join.join));
  // }, knex(Type.$name));
  const evenMoreJoinedQuery = rawJoins.reduce((q, join) => q.joinRaw(join), joinedQuery);
  const selectedQuery = evenMoreJoinedQuery.where(query).select(selects);
  const groupByQuery = selectedQuery.groupBy(groups);
  console.log(groupByQuery.toString());
  return groupByQuery;
}
