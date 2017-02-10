/* eslint-env node, mocha*/
/* eslint no-shadow: 0 */

import { PostgresStore } from '../sql';
import { testSuite } from 'plump';
import * as pg from 'pg';

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
      if (err) throw err;
      client.query(command, (err) => {
        if (err) throw err;
        client.end((err) => {
          if (err) throw err;
          resolve();
        });
      });
    });
  });
}


testSuite({
  describe, it, before, after,
}, {
  ctor: PostgresStore,
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
  before: () => {
    return runSQL('DROP DATABASE if exists plump_test;')
    .then(() => runSQL('CREATE DATABASE plump_test;'))
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
          extended jsonb not null default '{}'::jsonb
        );
        CREATE TABLE parent_child_relationship (parent_id integer not null, child_id integer not null);
        CREATE UNIQUE INDEX children_join on parent_child_relationship (parent_id, child_id);
        CREATE TABLE reactions (parent_id integer not null, child_id integer not null, reaction text not null);
        CREATE UNIQUE INDEX reactions_join on reactions (parent_id, child_id, reaction);
        CREATE TABLE valence_children (parent_id integer not null, child_id integer not null, perm integer not null);
        --CREATE UNIQUE INDEX valence_children_join on valence_children (parent_id, child_id);
      `, { database: 'plump_test' });
    });
  },
  after: (driver) => {
    return driver.teardown()
    .then(() => runSQL('DROP DATABASE plump_test;'));
  },
});
