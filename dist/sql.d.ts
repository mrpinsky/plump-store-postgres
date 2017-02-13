import * as Rx from 'rxjs/Rx';
import * as Bluebird from 'bluebird';
import * as Knex from 'knex';

import { StringIndexed } from '../util.d';

import * as Storage from './storage.d';

export as namespace PGStore;

declare abstract class PGStore extends Storage {
  new (opts: Knex.Config);

  teardown(): Bluebird<void>;
}

export { PGStore };
