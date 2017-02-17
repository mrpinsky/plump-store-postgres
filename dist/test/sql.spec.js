'use strict';

var _sql = require('../sql');

var _plump = require('plump');

var _pg = require('pg');

var pg = _interopRequireWildcard(_pg);

var _chai = require('chai');

var _chai2 = _interopRequireDefault(_chai);

var _chaiSubset = require('chai-subset');

var _chaiSubset2 = _interopRequireDefault(_chaiSubset);

var _chaiAsPromised = require('chai-as-promised');

var _chaiAsPromised2 = _interopRequireDefault(_chaiAsPromised);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; } /* eslint-env node, mocha*/
/* eslint no-shadow: 0 */

_chai2.default.use(_chaiSubset2.default);
_chai2.default.use(_chaiAsPromised2.default);
var expect = _chai2.default.expect;

_plump.TestType.$fields.queryChildren.relationship.$sides.queryChildren.self.query.rawJoin = 'left outer join query_children as querychildren on querychildren.child_id = tests.id and querychildren.perm >= 2';
_plump.TestType.$fields.queryParents.relationship.$sides.queryParents.self.query.rawJoin = 'left outer join query_children as queryparents on queryparents.parent_id = tests.id and queryparents.perm >= 2';

function runSQL(command) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var connOptions = Object.assign({}, {
    user: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    charset: 'utf8'
  }, opts);
  var client = new pg.Client(connOptions);
  return new Promise(function (resolve) {
    client.connect(function (err) {
      if (err) throw err;
      client.query(command, function (err) {
        if (err) throw err;
        client.end(function (err) {
          if (err) throw err;
          resolve();
        });
      });
    });
  });
}

function createDatabase(name) {
  return runSQL('DROP DATABASE if exists ' + name + ';').then(function () {
    return runSQL('CREATE DATABASE ' + name + ';');
  }).then(function () {
    return runSQL('\n      CREATE SEQUENCE testid_seq\n        START WITH 1\n        INCREMENT BY 1\n        NO MINVALUE\n        MAXVALUE 2147483647\n        CACHE 1\n        CYCLE;\n      CREATE TABLE tests (\n        id integer not null primary key DEFAULT nextval(\'testid_seq\'::regclass),\n        name text,\n        extended jsonb not null default \'{}\'::jsonb\n      );\n      CREATE TABLE parent_child_relationship (parent_id integer not null, child_id integer not null);\n      CREATE UNIQUE INDEX children_join on parent_child_relationship (parent_id, child_id);\n      CREATE TABLE reactions (parent_id integer not null, child_id integer not null, reaction text not null);\n      CREATE UNIQUE INDEX reactions_join on reactions (parent_id, child_id, reaction);\n      CREATE TABLE valence_children (parent_id integer not null, child_id integer not null, perm integer not null);\n      CREATE TABLE query_children (parent_id integer not null, child_id integer not null, perm integer not null);\n    ', { database: name });
  });
}

(0, _plump.testSuite)({
  describe: describe, it: it, before: before, after: after
}, {
  ctor: _sql.PGStore,
  opts: {
    sql: {
      connection: {
        database: 'plump_test',
        user: 'postgres',
        host: 'localhost',
        port: 5432
      }
    },
    terminal: true
  },
  name: 'Plump Postgres Store',
  before: function before() {
    return createDatabase('plump_test');
  },
  after: function after(driver) {
    return driver.teardown().then(function () {
      return runSQL('DROP DATABASE plump_test;');
    });
  }
});

var sampleObject = {
  name: 'potato',
  extended: {
    actual: 'rutabaga',
    otherValue: 42
  }
};

describe('postgres-specific behaviors', function () {
  var store = void 0;
  before(function () {
    return createDatabase('secondary_plump_test').then(function () {
      store = new _sql.PGStore({
        sql: {
          connection: {
            database: 'secondary_plump_test',
            user: 'postgres',
            host: 'localhost',
            port: 5432
          }
        },
        terminal: true
      });
    });
  });

  it('Returns extra contents', function () {
    return store.write(_plump.TestType, sampleObject).then(function (createdObject) {
      return store.add(_plump.TestType, createdObject.id, 'likers', 100).then(function () {
        return store.add(_plump.TestType, createdObject.id, 'likers', 101);
      }).then(function () {
        return store.add(_plump.TestType, createdObject.id, 'agreers', 100);
      }).then(function () {
        return store.add(_plump.TestType, createdObject.id, 'agreers', 101);
      }).then(function () {
        return store.add(_plump.TestType, createdObject.id, 'valenceChildren', 100, { perm: 1 });
      }).then(function () {
        return store.add(_plump.TestType, createdObject.id, 'queryChildren', 101, { perm: 1 });
      }).then(function () {
        return store.add(_plump.TestType, createdObject.id, 'queryChildren', 102, { perm: 2 });
      }).then(function () {
        return store.add(_plump.TestType, createdObject.id, 'queryChildren', 103, { perm: 3 });
      }).then(function () {
        return store.read(_plump.TestType, createdObject.id);
      }).then(function (v) {
        return console.log(JSON.stringify(v, null, 2));
      }).then(function () {
        var _Object$assign;

        return expect(store.read(_plump.TestType, createdObject.id)).to.eventually.deep.equal(Object.assign({}, sampleObject, (_Object$assign = {}, _defineProperty(_Object$assign, _plump.TestType.$id, createdObject.id), _defineProperty(_Object$assign, 'likers', [{ id: 100 }, { id: 101 }]), _defineProperty(_Object$assign, 'agreers', [{ id: 100 }, { id: 101 }]), _defineProperty(_Object$assign, 'queryChildren', [{ id: 102, perm: 2 }, { id: 103, perm: 3 }]), _defineProperty(_Object$assign, 'queryParents', []), _defineProperty(_Object$assign, 'likees', []), _defineProperty(_Object$assign, 'agreees', []), _defineProperty(_Object$assign, 'valenceChildren', [{ id: 100, perm: 1 }]), _defineProperty(_Object$assign, 'valenceParents', []), _defineProperty(_Object$assign, 'children', []), _defineProperty(_Object$assign, 'parents', []), _Object$assign)));
      });
    });
  });

  after(function () {
    // return store.teardown()
    // .then(() => runSQL('DROP DATABASE secondary_plump_test;'));
  });
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3Qvc3FsLnNwZWMuanMiXSwibmFtZXMiOlsicGciLCJ1c2UiLCJleHBlY3QiLCIkZmllbGRzIiwicXVlcnlDaGlsZHJlbiIsInJlbGF0aW9uc2hpcCIsIiRzaWRlcyIsInNlbGYiLCJxdWVyeSIsInJhd0pvaW4iLCJxdWVyeVBhcmVudHMiLCJydW5TUUwiLCJjb21tYW5kIiwib3B0cyIsImNvbm5PcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwidXNlciIsImhvc3QiLCJwb3J0IiwiZGF0YWJhc2UiLCJjaGFyc2V0IiwiY2xpZW50IiwiQ2xpZW50IiwiUHJvbWlzZSIsInJlc29sdmUiLCJjb25uZWN0IiwiZXJyIiwiZW5kIiwiY3JlYXRlRGF0YWJhc2UiLCJuYW1lIiwidGhlbiIsImRlc2NyaWJlIiwiaXQiLCJiZWZvcmUiLCJhZnRlciIsImN0b3IiLCJzcWwiLCJjb25uZWN0aW9uIiwidGVybWluYWwiLCJkcml2ZXIiLCJ0ZWFyZG93biIsInNhbXBsZU9iamVjdCIsImV4dGVuZGVkIiwiYWN0dWFsIiwib3RoZXJWYWx1ZSIsInN0b3JlIiwid3JpdGUiLCJjcmVhdGVkT2JqZWN0IiwiYWRkIiwiaWQiLCJwZXJtIiwicmVhZCIsInYiLCJjb25zb2xlIiwibG9nIiwiSlNPTiIsInN0cmluZ2lmeSIsInRvIiwiZXZlbnR1YWxseSIsImRlZXAiLCJlcXVhbCIsIiRpZCJdLCJtYXBwaW5ncyI6Ijs7QUFHQTs7QUFDQTs7QUFDQTs7SUFBWUEsRTs7QUFDWjs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O2tOQVJBO0FBQ0E7O0FBUUEsZUFBS0MsR0FBTDtBQUNBLGVBQUtBLEdBQUw7QUFDQSxJQUFNQyxTQUFTLGVBQUtBLE1BQXBCOztBQUVBLGdCQUFTQyxPQUFULENBQWlCQyxhQUFqQixDQUErQkMsWUFBL0IsQ0FBNENDLE1BQTVDLENBQW1ERixhQUFuRCxDQUFpRUcsSUFBakUsQ0FBc0VDLEtBQXRFLENBQTRFQyxPQUE1RSxHQUNBLGtIQURBO0FBRUEsZ0JBQVNO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LGNBQWNFLEVBQW5DLENBQU47QUFBQSxPQVJDLEVBU05uQixJQVRNLENBU0QsVUFBQ3NCLENBQUQ7QUFBQSxlQUFPQyxRQUFRQyxHQUFSLENBQVlDLEtBQUtDLFNBQUwsQ0FBZUosQ0FBZixFQUFrQixJQUFsQixFQUF3QixDQUF4QixDQUFaLENBQVA7QUFBQSxPQVRDLEVBVU50QixJQVZNLENBVUQsWUFBTTtBQUFBOztBQUNWLGVBQU83QixPQUFPNEMsTUFBTU0sSUFBTixrQkFBcUJKLGNBQWNFLEVBQW5DLENBQVAsRUFDTlEsRUFETSxDQUNIQyxVQURHLENBQ1FDLElBRFIsQ0FDYUMsS0FEYixDQUNtQjlDLE9BQU9DLE1BQVAsQ0FBYyxFQUFkLEVBQWtCMEIsWUFBbEIsd0RBQ3ZCLGdCQUFTb0IsR0FEYyxFQUNSZCxjQUFjRSxFQUROLDZDQUVoQixDQUFDLEVBQUVBLElBQUksR0FBTixFQUFELEVBQWMsRUFBRUEsSUFBSSxHQUFOLEVBQWQsQ0FGZ0IsOENBR2YsQ0FBQyxFQUFFQSxJQUFJLEdBQU4sRUFBRCxFQUFjLEVBQUVBLElBQUksR0FBTixFQUFkLENBSGUsb0RBSVQsQ0FBQyxFQUFFQSxJQUFJLEdBQU4sRUFBV0MsTUFBTSxDQUFqQixFQUFELEVBQXVCLEVBQUVELElBQUksR0FBTixFQUFXQyxNQUFNLENBQWpCLEVBQXZCLENBSlMsbURBS1YsRUFMVSw2Q0FNaEIsRUFOZ0IsOENBT2YsRUFQZSxzREFRUCxDQUFDLEVBQUVELElBQUksR0FBTixFQUFXQyxNQUFNLENBQWpCLEVBQUQsQ0FSTyxxREFTUixFQVRRLCtDQVVkLEVBVmMsOENBV2YsRUFYZSxtQkFEbkIsQ0FBUDtBQWNELE9BekJNLENBQVA7QUEwQkQsS0E1Qk0sQ0FBUDtBQTZCRCxHQTlCRDs7QUFnQ0FoQixRQUFNLFlBQU07QUFDVjtBQUNBO0FBQ0QsR0FIRDtBQUlELENBdkREIiwiZmlsZSI6InRlc3Qvc3FsLnNwZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZW52IG5vZGUsIG1vY2hhKi9cbi8qIGVzbGludCBuby1zaGFkb3c6IDAgKi9cblxuaW1wb3J0IHsgUEdTdG9yZSB9IGZyb20gJy4uL3NxbCc7XG5pbXBvcnQgeyB0ZXN0U3VpdGUsIFRlc3RUeXBlIH0gZnJvbSAncGx1bXAnO1xuaW1wb3J0ICogYXMgcGcgZnJvbSAncGcnO1xuaW1wb3J0IGNoYWkgZnJvbSAnY2hhaSc7XG5pbXBvcnQgY2hhaVN1YnNldCBmcm9tICdjaGFpLXN1YnNldCc7XG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5jaGFpLnVzZShjaGFpU3Vic2V0KTtcbmNoYWkudXNlKGNoYWlBc1Byb21pc2VkKTtcbmNvbnN0IGV4cGVjdCA9IGNoYWkuZXhwZWN0O1xuXG5UZXN0VHlwZS4kZmllbGRzLnF1ZXJ5Q2hpbGRyZW4ucmVsYXRpb25zaGlwLiRzaWRlcy5xdWVyeUNoaWxkcmVuLnNlbGYucXVlcnkucmF3Sm9pbiA9XG4nbGVmdCBvdXRlciBqb2luIHF1ZXJ5X2NoaWxkcmVuIGFzIHF1ZXJ5Y2hpbGRyZW4gb24gcXVlcnljaGlsZHJlbi5jaGlsZF9pZCA9IHRlc3RzLmlkIGFuZCBxdWVyeWNoaWxkcmVuLnBlcm0gPj0gMic7XG5UZXN0VHlwZS4kZmllbGRzLnF1ZXJ5UGFyZW50cy5yZWxhdGlvbnNoaXAuJHNpZGVzLnF1ZXJ5UGFyZW50cy5zZWxmLnF1ZXJ5LnJhd0pvaW4gPVxuJ2xlZnQgb3V0ZXIgam9pbiBxdWVyeV9jaGlsZHJlbiBhcyBxdWVyeXBhcmVudHMgb24gcXVlcnlwYXJlbnRzLnBhcmVudF9pZCA9IHRlc3RzLmlkIGFuZCBxdWVyeXBhcmVudHMucGVybSA+PSAyJztcblxuXG5cbmZ1bmN0aW9uIHJ1blNRTChjb21tYW5kLCBvcHRzID0ge30pIHtcbiAgY29uc3QgY29ubk9wdGlvbnMgPSBPYmplY3QuYXNzaWduKFxuICAgIHt9LFxuICAgIHtcbiAgICAgIHVzZXI6ICdwb3N0Z3JlcycsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICBkYXRhYmFzZTogJ3Bvc3RncmVzJyxcbiAgICAgIGNoYXJzZXQ6ICd1dGY4JyxcbiAgICB9LFxuICAgIG9wdHNcbiAgKTtcbiAgY29uc3QgY2xpZW50ID0gbmV3IHBnLkNsaWVudChjb25uT3B0aW9ucyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGNsaWVudC5jb25uZWN0KChlcnIpID0+IHtcbiAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgIGNsaWVudC5xdWVyeShjb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgY2xpZW50LmVuZCgoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURhdGFiYXNlKG5hbWUpIHtcbiAgcmV0dXJuIHJ1blNRTChgRFJPUCBEQVRBQkFTRSBpZiBleGlzdHMgJHtuYW1lfTtgKVxuICAudGhlbigoKSA9PiBydW5TUUwoYENSRUFURSBEQVRBQkFTRSAke25hbWV9O2ApKVxuICAudGhlbigoKSA9PiB7XG4gICAgcmV0dXJuIHJ1blNRTChgXG4gICAgICBDUkVBVEUgU0VRVUVOQ0UgdGVzdGlkX3NlcVxuICAgICAgICBTVEFSVCBXSVRIIDFcbiAgICAgICAgSU5DUkVNRU5UIEJZIDFcbiAgICAgICAgTk8gTUlOVkFMVUVcbiAgICAgICAgTUFYVkFMVUUgMjE0NzQ4MzY0N1xuICAgICAgICBDQUNIRSAxXG4gICAgICAgIENZQ0xFO1xuICAgICAgQ1JFQVRFIFRBQkxFIHRlc3RzIChcbiAgICAgICAgaWQgaW50ZWdlciBub3QgbnVsbCBwcmltYXJ5IGtleSBERUZBVUxUIG5leHR2YWwoJ3Rlc3RpZF9zZXEnOjpyZWdjbGFzcyksXG4gICAgICAgIG5hbWUgdGV4dCxcbiAgICAgICAgZXh0ZW5kZWQganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtcbiAgICAgIENSRUFURSBUQUJMRSBwYXJlbnRfY2hpbGRfcmVsYXRpb25zaGlwIChwYXJlbnRfaWQgaW50ZWdlciBub3QgbnVsbCwgY2hpbGRfaWQgaW50ZWdlciBub3QgbnVsbCk7XG4gICAgICBDUkVBVEUgVU5JUVVFIElOREVYIGNoaWxkcmVuX2pvaW4gb24gcGFyZW50X2NoaWxkX3JlbGF0aW9uc2hpcCAocGFyZW50X2lkLCBjaGlsZF9pZCk7XG4gICAgICBDUkVBVEUgVEFCTEUgcmVhY3Rpb25zIChwYXJlbnRfaWQgaW50ZWdlciBub3QgbnVsbCwgY2hpbGRfaWQgaW50ZWdlciBub3QgbnVsbCwgcmVhY3Rpb24gdGV4dCBub3QgbnVsbCk7XG4gICAgICBDUkVBVEUgVU5JUVVFIElOREVYIHJlYWN0aW9uc19qb2luIG9uIHJlYWN0aW9ucyAocGFyZW50X2lkLCBjaGlsZF9pZCwgcmVhY3Rpb24pO1xuICAgICAgQ1JFQVRFIFRBQkxFIHZhbGVuY2VfY2hpbGRyZW4gKHBhcmVudF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBjaGlsZF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBwZXJtIGludGVnZXIgbm90IG51bGwpO1xuICAgICAgQ1JFQVRFIFRBQkxFIHF1ZXJ5X2NoaWxkcmVuIChwYXJlbnRfaWQgaW50ZWdlciBub3QgbnVsbCwgY2hpbGRfaWQgaW50ZWdlciBub3QgbnVsbCwgcGVybSBpbnRlZ2VyIG5vdCBudWxsKTtcbiAgICBgLCB7IGRhdGFiYXNlOiBuYW1lIH0pO1xuICB9KTtcbn1cblxuXG50ZXN0U3VpdGUoe1xuICBkZXNjcmliZSwgaXQsIGJlZm9yZSwgYWZ0ZXIsXG59LCB7XG4gIGN0b3I6IFBHU3RvcmUsXG4gIG9wdHM6IHtcbiAgICBzcWw6IHtcbiAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgZGF0YWJhc2U6ICdwbHVtcF90ZXN0JyxcbiAgICAgICAgdXNlcjogJ3Bvc3RncmVzJyxcbiAgICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICB9LFxuICAgIH0sXG4gICAgdGVybWluYWw6IHRydWUsXG4gIH0sXG4gIG5hbWU6ICdQbHVtcCBQb3N0Z3JlcyBTdG9yZScsXG4gIGJlZm9yZTogKCkgPT4gY3JlYXRlRGF0YWJhc2UoJ3BsdW1wX3Rlc3QnKSxcbiAgYWZ0ZXI6IChkcml2ZXIpID0+IHtcbiAgICByZXR1cm4gZHJpdmVyLnRlYXJkb3duKClcbiAgICAudGhlbigoKSA9PiBydW5TUUwoJ0RST1AgREFUQUJBU0UgcGx1bXBfdGVzdDsnKSk7XG4gIH0sXG59KTtcblxuY29uc3Qgc2FtcGxlT2JqZWN0ID0ge1xuICBuYW1lOiAncG90YXRvJyxcbiAgZXh0ZW5kZWQ6IHtcbiAgICBhY3R1YWw6ICdydXRhYmFnYScsXG4gICAgb3RoZXJWYWx1ZTogNDIsXG4gIH0sXG59O1xuXG5kZXNjcmliZSgncG9zdGdyZXMtc3BlY2lmaWMgYmVoYXZpb3JzJywgKCkgPT4ge1xuICBsZXQgc3RvcmU7XG4gIGJlZm9yZSgoKSA9PiB7XG4gICAgcmV0dXJuIGNyZWF0ZURhdGFiYXNlKCdzZWNvbmRhcnlfcGx1bXBfdGVzdCcpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgc3RvcmUgPSBuZXcgUEdTdG9yZSh7XG4gICAgICAgIHNxbDoge1xuICAgICAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgICAgIGRhdGFiYXNlOiAnc2Vjb25kYXJ5X3BsdW1wX3Rlc3QnLFxuICAgICAgICAgICAgdXNlcjogJ3Bvc3RncmVzJyxcbiAgICAgICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICAgICAgcG9ydDogNTQzMixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB0ZXJtaW5hbDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBpdCgnUmV0dXJucyBleHRyYSBjb250ZW50cycsICgpID0+IHtcbiAgICByZXR1cm4gc3RvcmUud3JpdGUoVGVzdFR5cGUsIHNhbXBsZU9iamVjdClcbiAgICAudGhlbigoY3JlYXRlZE9iamVjdCkgPT4ge1xuICAgICAgcmV0dXJuIHN0b3JlLmFkZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCwgJ2xpa2VycycsIDEwMClcbiAgICAgIC50aGVuKCgpID0+IHN0b3JlLmFkZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCwgJ2xpa2VycycsIDEwMSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdhZ3JlZXJzJywgMTAwKSlcbiAgICAgIC50aGVuKCgpID0+IHN0b3JlLmFkZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCwgJ2FncmVlcnMnLCAxMDEpKVxuICAgICAgLnRoZW4oKCkgPT4gc3RvcmUuYWRkKFRlc3RUeXBlLCBjcmVhdGVkT2JqZWN0LmlkLCAndmFsZW5jZUNoaWxkcmVuJywgMTAwLCB7IHBlcm06IDEgfSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdxdWVyeUNoaWxkcmVuJywgMTAxLCB7IHBlcm06IDEgfSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdxdWVyeUNoaWxkcmVuJywgMTAyLCB7IHBlcm06IDIgfSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdxdWVyeUNoaWxkcmVuJywgMTAzLCB7IHBlcm06IDMgfSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5yZWFkKFRlc3RUeXBlLCBjcmVhdGVkT2JqZWN0LmlkKSlcbiAgICAgIC50aGVuKCh2KSA9PiBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh2LCBudWxsLCAyKSkpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3RvcmUucmVhZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCkpXG4gICAgICAgIC50by5ldmVudHVhbGx5LmRlZXAuZXF1YWwoT2JqZWN0LmFzc2lnbih7fSwgc2FtcGxlT2JqZWN0LCB7XG4gICAgICAgICAgW1Rlc3RUeXBlLiRpZF06IGNyZWF0ZWRPYmplY3QuaWQsXG4gICAgICAgICAgbGlrZXJzOiBbeyBpZDogMTAwIH0sIHsgaWQ6IDEwMSB9XSxcbiAgICAgICAgICBhZ3JlZXJzOiBbeyBpZDogMTAwIH0sIHsgaWQ6IDEwMSB9XSxcbiAgICAgICAgICBxdWVyeUNoaWxkcmVuOiBbeyBpZDogMTAyLCBwZXJtOiAyIH0sIHsgaWQ6IDEwMywgcGVybTogMyB9XSxcbiAgICAgICAgICBxdWVyeVBhcmVudHM6IFtdLFxuICAgICAgICAgIGxpa2VlczogW10sXG4gICAgICAgICAgYWdyZWVlczogW10sXG4gICAgICAgICAgdmFsZW5jZUNoaWxkcmVuOiBbeyBpZDogMTAwLCBwZXJtOiAxIH1dLFxuICAgICAgICAgIHZhbGVuY2VQYXJlbnRzOiBbXSxcbiAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgcGFyZW50czogW10sXG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBhZnRlcigoKSA9PiB7XG4gICAgLy8gcmV0dXJuIHN0b3JlLnRlYXJkb3duKClcbiAgICAvLyAudGhlbigoKSA9PiBydW5TUUwoJ0RST1AgREFUQUJBU0Ugc2Vjb25kYXJ5X3BsdW1wX3Rlc3Q7JykpO1xuICB9KTtcbn0pO1xuIl19
