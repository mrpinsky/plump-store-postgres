import Bluebird from 'bluebird';
import knex from 'knex';
import { Storage } from 'plump';
const $knex = Symbol('$knex');

function deserializeWhere(query, block) {
  const car = block[0];
  const cdr = block.slice(1);
  if (Array.isArray(cdr[0])) {
    return cdr.reduce((subQuery, subBlock) => deserializeWhere(subQuery, subBlock), query);
  } else {
    return query[car].apply(query, cdr);
  }
}

function objectToWhereChain(query, block, context) {
  return Object.keys(block).reduce((q, key) => {
    if (Array.isArray(block[key])) {
      return deserializeWhere(query, Storage.massReplace(block[key], context));
    } else {
      return q.where(key, block[key]);
    }
  }, query);
}


export class PostgresStore extends Storage {
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
      const id = v[t.$id];
      const updateObject = {};
      Object.keys(t.$fields).forEach((fieldName) => {
        if (v[fieldName] !== undefined) {
          // copy from v to the best of our ability
          if (
            (t.$fields[fieldName].type === 'array') ||
            (t.$fields[fieldName].type === 'hasMany')
          ) {
            updateObject[fieldName] = v[fieldName].concat();
          } else if (t.$fields[fieldName].type === 'object') {
            updateObject[fieldName] = Object.assign({}, v[fieldName]);
          } else {
            updateObject[fieldName] = v[fieldName];
          }
        }
      });
      if ((id === undefined) && (this.terminal)) {
        return this[$knex](t.$name).insert(updateObject).returning(t.$id)
        .then((createdId) => {
          return this.read(t, createdId[0]);
        });
      } else if (id !== undefined) {
        return this[$knex](t.$name).where({ [t.$id]: id }).update(updateObject)
        .then(() => {
          return this.read(t, id);
        });
      } else {
        throw new Error('Cannot create new content in a non-terminal store');
      }
    }).then((result) => {
      return this.notifyUpdate(t, result[t.$id], result).then(() => result);
    });
  }

  readOne(t, id) {
    return this[$knex](t.$name).where({ [t.$id]: id }).select()
    .then((o) => o[0] || null);
  }

  readMany(type, id, relationshipTitle) {
    const relationshipBlock = type.$fields[relationshipTitle];
    const sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
    let toSelect = [sideInfo.other.field, sideInfo.self.field];
    if (relationshipBlock.relationship.$extras) {
      toSelect = toSelect.concat(Object.keys(relationshipBlock.relationship.$extras));
    }
    const whereBlock = {};
    if (sideInfo.self.query) {
      whereBlock[sideInfo.self.field] = sideInfo.self.query.logic;
    } else {
      whereBlock[sideInfo.self.field] = id;
    }
    if (relationshipBlock.relationship.$restrict) {
      Object.keys(relationshipBlock.relationship.$restrict).forEach((restriction) => {
        whereBlock[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
      });
    }
    return Bluebird.resolve()
    .then(() => {
      if (sideInfo.self.query && sideInfo.self.query.requireLoad) {
        return this.readOne(type, id);
      } else {
        return { id };
      }
    })
    .then((context) => {
      return objectToWhereChain(this[$knex](relationshipBlock.relationship.$name), whereBlock, context)
      .select(toSelect);
    })
    .then((l) => {
      return {
        [relationshipTitle]: l,
      };
    });
  }

  delete(t, id) {
    return this[$knex](t.$name).where({ [t.$id]: id }).delete()
    .then((o) => o);
  }

  add(type, id, relationshipTitle, childId, extras = {}) {
    const relationshipBlock = type.$fields[relationshipTitle];
    const sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
    const newField = {
      [sideInfo.other.field]: childId,
      [sideInfo.self.field]: id,
    };
    if (relationshipBlock.relationship.$restrict) {
      Object.keys(relationshipBlock.relationship.$restrict).forEach((restriction) => {
        newField[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
      });
    }
    if (relationshipBlock.relationship.$extras) {
      Object.keys(relationshipBlock.relationship.$extras).forEach((extra) => {
        newField[extra] = extras[extra];
      });
    }
    return this[$knex](relationshipBlock.relationship.$name)
    .insert(newField)
    .then(() => this.notifyUpdate(type, id, null, relationshipTitle));
  }

  modifyRelationship(type, id, relationshipTitle, childId, extras = {}) {
    const relationshipBlock = type.$fields[relationshipTitle];
    const sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
    const newField = {};
    Object.keys(relationshipBlock.relationship.$extras).forEach((extra) => {
      if (extras[extra] !== undefined) {
        newField[extra] = extras[extra];
      }
    });
    const whereBlock = {
      [sideInfo.other.field]: childId,
      [sideInfo.self.field]: id,
    };
    if (relationshipBlock.relationship.$restrict) {
      Object.keys(relationshipBlock.relationship.$restrict).forEach((restriction) => {
        whereBlock[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
      });
    }
    return objectToWhereChain(this[$knex](relationshipBlock.relationship.$name), whereBlock, { id, childId })
    .update(newField)
    .then(() => this.notifyUpdate(type, id, null, relationshipTitle));
  }

  remove(type, id, relationshipTitle, childId) {
    const relationshipBlock = type.$fields[relationshipTitle];
    const sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
    const whereBlock = {
      [sideInfo.other.field]: childId,
      [sideInfo.self.field]: id,
    };
    if (relationshipBlock.relationship.$restrict) {
      Object.keys(relationshipBlock.relationship.$restrict).forEach((restriction) => {
        whereBlock[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
      });
    }
    return objectToWhereChain(this[$knex](relationshipBlock.relationship.$name), whereBlock).delete()
    .then(() => this.notifyUpdate(type, id, null, relationshipTitle));
  }

  query(q) {
    return Bluebird.resolve(this[$knex].raw(q.query))
    .then((d) => d.rows);
  }
}
