import Bluebird from 'bluebird';
import knex from 'knex';
import { Storage } from 'plump';
import { readQuery, bulkQuery } from './queryString';
const $knex = Symbol('$knex');

function rearrangeData(type, data) {
  const retVal = {
    type: type.$name,
    attributes: {},
    relationships: {},
    id: data[type.$schema.$id],
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

  writeRelationships(t, v, id) {
    return Bluebird.resolve()
    .then(() => {
      return Bluebird.all(Object.keys(t.$schema.relationships).map((relName) => {
        if (v.relationships && v.relationships[relName] && v.relationships[relName].length > 0) {
          if (v.relationships[relName][0].op) {
            // deltas
            return Bluebird.all(v.relationships[relName].map((delta) => {
              if (delta.op === 'add') {
                return this.add(t, id, relName, delta.data.id, delta.data.meta || {});
              } else if (delta.op === 'remove') {
                return this.remove(t, id, relName, delta.data.id);
              } else if (delta.op === 'modify') {
                return this.modifyRelationship(t, id, relName, delta.data.id);
              } else {
                return null;
              }
            }));
          } else {
            // items rather than deltas
            return Bluebird.all(v.relationships[relName].map((item) => {
              return this.add(t, id, relName, item.id, item.meta || {});
            }));
          }
        } else {
          return null;
        }
      }));
    });
  }

  writeAttributes(t, updateObject, id) {
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
  }

  write(value) {
    const id = value.id;
    const type = this.getType(value.type);
    const updateObject = {};
    for (const attrName in type.$schema.attributes) {
      if (value.attributes[attrName] !== undefined) {
        // copy from v to the best of our ability
        if (type.$schema.attributes[attrName].type === 'array') {
          updateObject[attrName] = value.attributes[attrName].concat();
        } else if (type.$schema.attributes[attrName].type === 'object') {
          updateObject[attrName] = Object.assign({}, value.attributes[attrName]);
        } else {
          updateObject[attrName] = value.attributes[attrName];
        }
      }
    }
    return Bluebird.resolve()
    .then(() => {
      if (Object.keys(updateObject).length > 0) {
        return this.writeAttributes(type, updateObject, id)
        .then((result) => {
          this.fireWriteUpdate({
            type: value.type,
            id: result.id,
            invalidate: ['attributes'],
          });
          return result;
        });
      } else {
        return value;
      }
    }).then((r) => {
      if (value.relationships && r.id && Object.keys(value.relationships) > 0) {
        return this.writeRelationships(type, value, r.id)
        .then((result) => {
          this.fireWriteUpdate({
            type: value.type,
            id: result.id,
            invalidate: Object.keys(value.relationships),
          });
          return r;
        });
      } else {
        return r;
      }
    });
  }

  readAttributes(typeName, id) {
    const t = this.getType(typeName);
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

  bulkRead(typeName, id) {
    const t = this.getType(typeName);
    let query = t.cacheGet(this, 'bulkRead');
    if (query === undefined) {
      query = bulkQuery(t);
      t.cacheSet(this, 'bulkRead', query);
    }
    return this[$knex].raw(query, id)
    .then((o) => {
      if (o.rows[0]) {
        const arrangedArray = o.rows.map((row) => rearrangeData(t, row));
        const rootItem = arrangedArray.filter((it) => it.id === id)[0];
        return {
          data: rootItem,
          included: arrangedArray.filter((it) => it.id !== id),
        };
      } else {
        return null;
      }
    });
  }

  readRelationship(typeName, id, relName) {
    const type = this.getType(typeName);
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

  delete(typeName, id) {
    const type = this.getType(typeName);
    return this[$knex](typeName).where({ [type.$schema.$id]: id }).delete()
    .then((o) => o);
  }

  add(typeName, id, relName, childId, extras = {}) {
    const type = this.getType(typeName);
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

  modifyRelationship(typeName, id, relName, childId, extras = {}) {
    const type = this.getType(typeName);
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

  remove(typeName, id, relName, childId) {
    const type = this.getType(typeName);
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
