/* eslint-env node, mocha*/
/* eslint no-shadow: 0 */

import * as pg from 'pg';
import * as chai from 'chai';
// import * as Bluebird from 'bluebird';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';

import { PGStore } from '../src/index';
// import { TestType } from './testType';
import { testSuite } from './storageTests';
chai.use(chaiAsPromised);
// const expect = chai.expect;

// TestType.$schema.queryChildren.relationship.$sides.queryChildren.self.query.rawJoin =
// 'left outer join query_children as querychildren on querychildren.parent_id = tests.id and querychildren.perm >= 2';
// TestType.$schema.queryParents.relationship.$sides.queryParents.self.query.rawJoin =
// 'left outer join query_children as queryparents on queryparents.child_id = tests.id and queryparents.perm >= 2';
//


function runSQL(command, opts = {}) {
  const connOptions = Object.assign(
    {},
    {
      user: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      charset: 'utf8',
    },
    opts
  );
  const client = new pg.Client(connOptions);
  return new Promise((resolve) => {
    client.connect((err) => {
      if (err) {
        throw err;
      }
      client.query(command, (err) => { // tslint:disable-line no-shadowed-variable
        if (err) {
          throw err;
        }
        client.end((err) => { // tslint:disable-line no-shadowed-variable
          if (err) {
            throw err;
          }
          resolve();
        });
      });
    });
  });
}

function createDatabase(name) {
  return runSQL(`DROP DATABASE if exists ${name};`)
  .then(() => runSQL(`CREATE DATABASE ${name};`))
  .then(() => {
    return runSQL(`
      CREATE SEQUENCE testid_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        MAXVALUE 2147483647
        CACHE 1
        CYCLE;
      CREATE TABLE tests (
        id integer not null primary key DEFAULT nextval('testid_seq'::regclass),
        name text,
        "otherName" text,
        extended jsonb not null default '{}'::jsonb
      );
      CREATE TABLE parent_child_relationship (parent_id integer not null, child_id integer not null);
      CREATE UNIQUE INDEX children_join on parent_child_relationship (parent_id, child_id);
      CREATE TABLE valence_children (parent_id integer not null, child_id integer not null, perm integer not null);
      CREATE UNIQUE INDEX valence_children_join on valence_children (parent_id, child_id);
      CREATE TABLE query_children (parent_id integer not null, child_id integer not null, perm integer not null);
      CREATE UNIQUE INDEX query_children_join on query_children (parent_id, child_id);
    `, { database: name });
  });
}


testSuite({
  describe, it, before, after,
}, {
  ctor: PGStore,
  opts: {
    sql: {
      connection: {
        database: 'plump_test',
        user: 'postgres',
        host: 'localhost',
        port: 5432,
      },
    },
    terminal: true,
  },
  name: 'Plump Postgres Store',
  before: () => createDatabase('plump_test'),
  after: (driver) => {
    return driver.teardown()
    .then(() => runSQL('DROP DATABASE plump_test;'));
  },
});

// const sampleObject = {
//   attributes: {
//     name: 'potato',
//     otherName: 'elephantine',
//     extended: {
//       actual: 'rutabaga',
//       otherValue: 42,
//     },
//   },
// };

// describe('postgres-specific behaviors', () => {
//   let store;
//   before(() => {
//     return createDatabase('secondary_plump_test')
//     .then(() => {
//       store = new PGStore({
//         sql: {
//           connection: {
//             database: 'secondary_plump_test',
//             user: 'postgres',
//             host: 'localhost',
//             port: 5432,
//           },
//         },
//         terminal: true,
//       });
//     });
//   });

  // it('Returns extra contents', () => {
  //   return store.write(TestType, sampleObject)
  //   .then((createdObject) => {
  //     return store.add(TestType, createdObject.id, 'valenceChildren', 100, { perm: 1 })
  //     .then(() => store.add(TestType, createdObject.id, 'queryChildren', 101, { perm: 1 }))
  //     .then(() => store.add(TestType, createdObject.id, 'queryChildren', 102, { perm: 2 }))
  //     .then(() => store.add(TestType, createdObject.id, 'queryChildren', 103, { perm: 3 }))
  //     .then(() => {
  //       const resultObject = Object.assign({}, sampleObject);
  //       resultObject.id = createdObject.id;
  //       resultObject.attributes = Object.assign({}, resultObject.attributes, {
  //         [TestType.$id]: createdObject.id,
  //       });
  //       resultObject.type = TestType.$name;
  //       resultObject.relationships = Object.assign({}, resultObject.relationships, {
  //         queryChildren: [
  //           { id: 102, meta: { perm: 2 } },
  //           { id: 103, meta: { perm: 3 } },
  //         ],
  //         queryParents: [],
  //         valenceChildren: [
  //           { id: 100, meta: { perm: 1 } },
  //         ],
  //         valenceParents: [],
  //         children: [],
  //         parents: [],
  //       });
  //       return store.read(TestType, createdObject.id)
  //       .then((res) => {
  //         return expect(res).to.deep.equal(resultObject);
  //       });
  //     });
  //   });
  // });
  //
  // it('supports queries in hasMany relationships', () => {
  //   return store.write(TestType, sampleObject)
  //   .then((createdObject) => {
  //     return store.add(TestType, createdObject.id, 'queryChildren', 101, { perm: 1 })
  //     .then(() => store.add(TestType, createdObject.id, 'queryChildren', 102, { perm: 2 }))
  //     .then(() => store.add(TestType, createdObject.id, 'queryChildren', 103, { perm: 3 }))
  //     .then(() => {
  //       return expect(store.read(TestType, createdObject.id, 'queryChildren'))
  //       .to.eventually.deep.containSubset({
  //         relationships: {
  //           queryChildren: [
  //             {
  //               id: 102,
  //               meta: { perm: 2 },
  //             }, {
  //               id: 103,
  //               meta: { perm: 3 },
  //             },
  //           ],
  //         },
  //       });
  //     });
  //   });
  // });
  //
  // it('returns many objects in a bulk Query', () => {
  //   return Bluebird.all([
  //     store.write(TestType, sampleObject),
  //     store.write(TestType, sampleObject),
  //     store.write(TestType, sampleObject),
  //     store.write(TestType, sampleObject),
  //     store.write(TestType, sampleObject),
  //   ])
  //   .then((created) => {
  //     const createdObject = created[0];
  //     return Bluebird.all(created.map((obj) => {
  //       return Bluebird.all([
  //         store.add(TestType, obj.id, 'children', obj.id * 100 + 1),
  //         store.add(TestType, obj.id, 'children', obj.id * 100 + 2),
  //         store.add(TestType, obj.id, 'children', obj.id * 100 + 3),
  //       ]);
  //     }))
  //     .then(() => store.bulkRead(TestType, createdObject.id))
  //     .then((res) => {
  //       expect(res).to.have.property('included').with.length(4);
  //       res.included.forEach((i) => {
  //         expect(i.relationships.children).to.deep.equal([
  //           { id: i.id * 100 + 1 },
  //           { id: i.id * 100 + 2 },
  //           { id: i.id * 100 + 3 },
  //         ]);
  //       });
  //     });
  //   });
  // });

//   after(() => {
//     return store.teardown()
//     .then(() => runSQL('DROP DATABASE secondary_plump_test;'));
//   });
// });
