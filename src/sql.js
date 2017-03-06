import Bluebird from 'bluebird';
import knex from 'knex';
import { Storage } from 'plump';
import { readQuery } from './queryString';
const $knex = Symbol('$knex');

function rearrangeData(type, data) {
  const retVal = {
    type: type.$name,
    attributes: {},
    relationships: {},
  };
  for (const attrName in type.$schema.attributes) {
    retVal.attributes[attrName] = data[attrName];
  }
  for (const relName in type.$schema.relationships) {
    retVal.relationships[relName] = data[relName];
  }
  return retVal;
}

export class PGStore extends Storage {
  constructor(opts = {}) {
    super(opts);
    const options = Object.assign(
      {},
      {
        client: 'postgres',
        debug: false,
        connection: {
          user: 'postgres',
          host: 'localhost',
          port: 5432,
          password: '',
          charset: 'utf8',
        },
        pool: {
          max: 20,
          min: 0,
        },
      },
      opts.sql
    );
    this[$knex] = knex(options);
  }

  /*
    note that knex.js "then" functions aren't actually promises the way you think they are.
    you can return knex.insert().into(), which has a then() on it, but that thenable isn't
    an actual promise yet. So instead we're returning Bluebird.resolve(thenable);
  */

  teardown() {
    return this[$knex].destroy();
  }

  write(t, v) {
    return Bluebird.resolve()
    .then(() => {
      const id = v.id;
      const updateObject = {};
      for (const attrName in t.$schema.attributes) {
        if (v.attributes[attrName] !== undefined) {
          // copy from v to the best of our ability
          if (t.$schema.attributes[attrName].type === 'array') {
            updateObject[attrName] = v.attributes[attrName].concat();
          } else if (t.$schema.attributes[attrName].type === 'object') {
            updateObject[attrName] = Object.assign({}, v.attributes[attrName]);
          } else {
            updateObject[attrName] = v.attributes[attrName];
          }
        }
      }
      if ((id === undefined) && (this.terminal)) {
        return this[$knex](t.$name).insert(updateObject).returning(t.$schema.$id)
        .then((createdId) => {
          return this.read(t, createdId[0]);
        });
      } else if (id !== undefined) {
        return this[$knex](t.$name).where({ [t.$schema.$id]: id }).update(updateObject)
        .then(() => {
          return this.read(t, id);
        });
      } else {
        throw new Error('Cannot create new content in a non-terminal store');
      }
    }).then((result) => {
      return this.notifyUpdate(t, result[t.$schema.$id], result).then(() => result);
    });
  }

  readAttributes(t, id) {
    let query = t.cacheGet(this, 'readAttributes');
    if (query === undefined) {
      query = readQuery(t);
      t.cacheSet(this, 'readAttributes', query);
    }
    return this[$knex].raw(query, id)
    .then((o) => {
      if (o.rows[0]) {
        return rearrangeData(t, o.rows[0]);
      } else {
        return null;
      }
    });
  }

  readRelationship(type, id, relName) {
    const rel = type.$schema.relationships[relName].type;
    const otherRelName = rel.$sides[relName].otherName;
    const sqlData = rel.$storeData.sql;
    const selectBase = `"${rel.$name}"."${sqlData.joinFields[otherRelName]}" as id`;
    let selectExtras = '';
    if (rel.$extras) {
      selectExtras = `, jsonb_build_object(${Object.keys(rel.$extras).map((extra) => `'${extra}', "${rel.$name}"."${extra}"`).join(', ')}) as meta`; // eslint-disable-line max-len
    }

    return this[$knex](rel.$name)
    .where(sqlData.joinFields[relName], id)
    .select(this[$knex].raw(`${selectBase}${selectExtras}`))
    .then((l) => {
      return {
        [relName]: l,
      };
    });
  }

  delete(t, id) {
    return this[$knex](t.$name).where({ [t.$schema.$id]: id }).delete()
    .then((o) => o);
  }

  add(type, id, relName, childId, extras = {}) {
    const rel = type.$schema.relationships[relName].type;
    const otherRelName = rel.$sides[relName].otherName;
    const sqlData = rel.$storeData.sql;
    const newField = {
      [sqlData.joinFields[otherRelName]]: childId,
      [sqlData.joinFields[relName]]: id,
    };
    if (rel.$extras) {
      Object.keys(rel.$extras).forEach((extra) => {
        newField[extra] = extras[extra];
      });
    }
    return this[$knex](rel.$name)
    .insert(newField)
    .then(() => this.notifyUpdate(type, id, null, relName));
  }

  modifyRelationship(type, id, relName, childId, extras = {}) {
    const rel = type.$schema.relationships[relName].type;
    const otherRelName = rel.$sides[relName].otherName;
    const sqlData = rel.$storeData.sql;
    const newField = {};
    Object.keys(rel.$extras).forEach((extra) => {
      if (extras[extra] !== undefined) {
        newField[extra] = extras[extra];
      }
    });
    return this[$knex](rel.$name)
    .where({
      [sqlData.joinFields[otherRelName]]: childId,
      [sqlData.joinFields[relName]]: id,
    })
    .update(newField)
    .then(() => this.notifyUpdate(type, id, null, relName));
  }

  remove(type, id, relName, childId) {
    const rel = type.$schema.relationships[relName].type;
    const otherRelName = rel.$sides[relName].otherName;
    const sqlData = rel.$storeData.sql;
    return this[$knex](rel.$name)
    .where({
      [sqlData.joinFields[otherRelName]]: childId,
      [sqlData.joinFields[relName]]: id,
    })
    .delete()
    .then(() => this.notifyUpdate(type, id, null, relName));
  }

  query(q) {
    return Bluebird.resolve(this[$knex].raw(q.query))
    .then((d) => d.rows);
  }
}
