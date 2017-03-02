/* eslint prefer-template: 0*/

function selects(Model) {
  const selectArray = [];
  for (const attrName in Model.$schema.attributes) {
    selectArray.push(`"${attrName}"`);
  }
  for (const relName in Model.$schema.relationships) {
    const rel = Model.$schema.relationships[relName];
    const joinName = relName.toLowerCase();
    const extraAgg = [];
    if (rel.$extras) {
      for (const extra in rel.$extras) {
        extraAgg.push(`'${extra}'`, `${joinName}.${extra}`);
      }
    }
    selectArray.push(
      `COALESCE(
        array_agg(
          distinct(
            jsonb_build_object(
              '${rel.$sides[relName].other.field}', ${joinName}.${rel.$sides[relName].other.field},
              '${rel.$sides[relName].self.field}', ${joinName}.${rel.$sides[relName].self.field}
              ${extraAgg.length ? ',' + extraAgg.join(',') : ''}
            )
          )
        )
        FILTER (WHERE ${joinName}.${rel.$sides[relName].other.field} IS NOT NULL),
        '{}')
      as ${relName}`
    );
  }
  return { string: `select ${selectArray.join(', ')}`, raws: [] };
}

function joins(Model) {
  const joinStrings = [];
  const joinRaws = [];
  for (const relName in Model.$schema.relationships) {
    const rel = Model.$schema.relationships[relName];
    const joinName = relName.toLowerCase();
    const restrictions = [];
    if (rel.$restrict) {
      for (const restriction in rel.$restrict) {
        restrictions.push(` and ${joinName}.${restriction} = ?`);
        joinRaws.push(`${rel.$restrict[restriction].value}`);
      }
    }
    if (rel.$sides[relName].self.query) {
      joinStrings.push('fancyquery');
    } else {
      joinStrings.push(
        `left outer join ${rel.$name} as ${joinName} ` +
        `on ${joinName}.${rel.$sides[relName].self.field} = ${Model.$name}.${Model.$id}`
      );
    }
  }
}

function wheres(Model) { }

function groupBy(Model) { }

export function buildQuery(Model) {
  const s = selects(Model);
  const j = joins(Model);
  const w = wheres(Model);
  const g = groupBy(Model);
  return {
    string: `${s.string} from ${Model.$name} ${j.string} ${w.string} ${g.string};`,
    raws: [].concat(s.raws).concat(j.raws).concat(w.raws).concat(g.raws),
  };
}
