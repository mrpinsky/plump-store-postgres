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

// TestType.$schema.queryChildren.relationship.$sides.queryChildren.self.query.rawJoin =
// 'left outer join query_children as querychildren on querychildren.parent_id = tests.id and querychildren.perm >= 2';
// TestType.$schema.queryParents.relationship.$sides.queryParents.self.query.rawJoin =
// 'left outer join query_children as queryparents on queryparents.child_id = tests.id and queryparents.perm >= 2';
//


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
        var _Object$assign;

        return expect(store.read(_plump.TestType, createdObject.id)).to.eventually.deep.equal(Object.assign({}, sampleObject, (_Object$assign = {}, _defineProperty(_Object$assign, _plump.TestType.$id, createdObject.id), _defineProperty(_Object$assign, 'likers', [{ id: 100 }, { id: 101 }]), _defineProperty(_Object$assign, 'agreers', [{ id: 100 }, { id: 101 }]), _defineProperty(_Object$assign, 'queryChildren', [{ id: 102, perm: 2 }, { id: 103, perm: 3 }]), _defineProperty(_Object$assign, 'queryParents', []), _defineProperty(_Object$assign, 'likees', []), _defineProperty(_Object$assign, 'agreees', []), _defineProperty(_Object$assign, 'valenceChildren', [{ id: 100, perm: 1 }]), _defineProperty(_Object$assign, 'valenceParents', []), _defineProperty(_Object$assign, 'children', []), _defineProperty(_Object$assign, 'parents', []), _Object$assign)));
      });
    });
  });

  after(function () {
    return store.teardown().then(function () {
      return runSQL('DROP DATABASE secondary_plump_test;');
    });
  });
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3Qvc3FsLnNwZWMuanMiXSwibmFtZXMiOlsicGciLCJ1c2UiLCJleHBlY3QiLCJydW5TUUwiLCJjb21tYW5kIiwib3B0cyIsImNvbm5PcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwidXNlciIsImhvc3QiLCJwb3J0IiwiZGF0YWJhc2UiLCJjaGFyc2V0IiwiY2xpZW50IiwiQ2xpZW50IiwiUHJvbWlzZSIsInJlc29sdmUiLCJjb25uZWN0IiwiZXJyIiwicXVlcnkiLCJlbmQiLCJjcmVhdGVEYXRhYmFzZSIsIm5hbWUiLCJ0aGVuIiwiZGVzY3JpYmUiLCJpdCIsImJlZm9yZSIsImFmdGVyIiwiY3RvciIsInNxbCIsImNvbm5lY3Rpb24iLCJ0ZXJtaW5hbCIsImRyaXZlciIsInRlYXJkb3duIiwic2FtcGxlT2JqZWN0IiwiZXh0ZW5kZWQiLCJhY3R1YWwiLCJvdGhlclZhbHVlIiwic3RvcmUiLCJ3cml0ZSIsImNyZWF0ZWRPYmplY3QiLCJhZGQiLCJpZCIsInBlcm0iLCJyZWFkIiwidG8iLCJldmVudHVhbGx5IiwiZGVlcCIsImVxdWFsIiwiJGlkIl0sIm1hcHBpbmdzIjoiOztBQUdBOztBQUNBOztBQUNBOztJQUFZQSxFOztBQUNaOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7Ozs7a05BUkE7QUFDQTs7QUFRQSxlQUFLQyxHQUFMO0FBQ0EsZUFBS0EsR0FBTDtBQUNBLElBQU1DLFNBQVMsZUFBS0EsTUFBcEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBR0EsU0FBU0MsTUFBVCxDQUFnQkMsT0FBaEIsRUFBb0M7QUFBQSxNQUFYQyxJQUFXLHVFQUFKLEVBQUk7O0FBQ2xDLE1BQU1DLGNBQWNDLE9BQU9DLE1BQVAsQ0FDbEIsRUFEa0IsRUFFbEI7QUFDRUMsVUFBTSxVQURSO0FBRUVDLFVBQU0sV0FGUjtBQUdFQyxVQUFNLElBSFI7QUFJRUMsY0FBVSxVQUpaO0FBS0VDLGFBQVM7QUFMWCxHQUZrQixFQVNsQlIsSUFUa0IsQ0FBcEI7QUFXQSxNQUFN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QUQsRUFBdUIsRUFBRUQsSUFBSSxHQUFOLEVBQVdDLE1BQU0sQ0FBakIsRUFBdkIsQ0FKUyxtREFLVixFQUxVLDZDQU1oQixFQU5nQiw4Q0FPZixFQVBlLHNEQVFQLENBQUMsRUFBRUQsSUFBSSxHQUFOLEVBQVdDLE1BQU0sQ0FBakIsRUFBRCxDQVJPLHFEQVNSLEVBVFEsK0NBVWQsRUFWYyw4Q0FXZixFQVhlLG1CQURuQixDQUFQO0FBY0QsT0F2Qk0sQ0FBUDtBQXdCRCxLQTFCTSxDQUFQO0FBMkJELEdBNUJEOztBQThCQWhCLFFBQU0sWUFBTTtBQUNWLFdBQU9XLE1BQU1MLFFBQU4sR0FDTlYsSUFETSxDQUNEO0FBQUEsYUFBTXJCLE9BQU8scUNBQVAsQ0FBTjtBQUFBLEtBREMsQ0FBUDtBQUVELEdBSEQ7QUFJRCxDQXJERCIsImZpbGUiOiJ0ZXN0L3NxbC5zcGVjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWVudiBub2RlLCBtb2NoYSovXG4vKiBlc2xpbnQgbm8tc2hhZG93OiAwICovXG5cbmltcG9ydCB7IFBHU3RvcmUgfSBmcm9tICcuLi9zcWwnO1xuaW1wb3J0IHsgdGVzdFN1aXRlLCBUZXN0VHlwZSB9IGZyb20gJ3BsdW1wJztcbmltcG9ydCAqIGFzIHBnIGZyb20gJ3BnJztcbmltcG9ydCBjaGFpIGZyb20gJ2NoYWknO1xuaW1wb3J0IGNoYWlTdWJzZXQgZnJvbSAnY2hhaS1zdWJzZXQnO1xuaW1wb3J0IGNoYWlBc1Byb21pc2VkIGZyb20gJ2NoYWktYXMtcHJvbWlzZWQnO1xuY2hhaS51c2UoY2hhaVN1YnNldCk7XG5jaGFpLnVzZShjaGFpQXNQcm9taXNlZCk7XG5jb25zdCBleHBlY3QgPSBjaGFpLmV4cGVjdDtcblxuLy8gVGVzdFR5cGUuJGZpZWxkcy5xdWVyeUNoaWxkcmVuLnJlbGF0aW9uc2hpcC4kc2lkZXMucXVlcnlDaGlsZHJlbi5zZWxmLnF1ZXJ5LnJhd0pvaW4gPVxuLy8gJ2xlZnQgb3V0ZXIgam9pbiBxdWVyeV9jaGlsZHJlbiBhcyBxdWVyeWNoaWxkcmVuIG9uIHF1ZXJ5Y2hpbGRyZW4ucGFyZW50X2lkID0gdGVzdHMuaWQgYW5kIHF1ZXJ5Y2hpbGRyZW4ucGVybSA+PSAyJztcbi8vIFRlc3RUeXBlLiRmaWVsZHMucXVlcnlQYXJlbnRzLnJlbGF0aW9uc2hpcC4kc2lkZXMucXVlcnlQYXJlbnRzLnNlbGYucXVlcnkucmF3Sm9pbiA9XG4vLyAnbGVmdCBvdXRlciBqb2luIHF1ZXJ5X2NoaWxkcmVuIGFzIHF1ZXJ5cGFyZW50cyBvbiBxdWVyeXBhcmVudHMuY2hpbGRfaWQgPSB0ZXN0cy5pZCBhbmQgcXVlcnlwYXJlbnRzLnBlcm0gPj0gMic7XG4vL1xuXG5cbmZ1bmN0aW9uIHJ1blNRTChjb21tYW5kLCBvcHRzID0ge30pIHtcbiAgY29uc3QgY29ubk9wdGlvbnMgPSBPYmplY3QuYXNzaWduKFxuICAgIHt9LFxuICAgIHtcbiAgICAgIHVzZXI6ICdwb3N0Z3JlcycsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICBkYXRhYmFzZTogJ3Bvc3RncmVzJyxcbiAgICAgIGNoYXJzZXQ6ICd1dGY4JyxcbiAgICB9LFxuICAgIG9wdHNcbiAgKTtcbiAgY29uc3QgY2xpZW50ID0gbmV3IHBnLkNsaWVudChjb25uT3B0aW9ucyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGNsaWVudC5jb25uZWN0KChlcnIpID0+IHtcbiAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgIGNsaWVudC5xdWVyeShjb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgY2xpZW50LmVuZCgoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURhdGFiYXNlKG5hbWUpIHtcbiAgcmV0dXJuIHJ1blNRTChgRFJPUCBEQVRBQkFTRSBpZiBleGlzdHMgJHtuYW1lfTtgKVxuICAudGhlbigoKSA9PiBydW5TUUwoYENSRUFURSBEQVRBQkFTRSAke25hbWV9O2ApKVxuICAudGhlbigoKSA9PiB7XG4gICAgcmV0dXJuIHJ1blNRTChgXG4gICAgICBDUkVBVEUgU0VRVUVOQ0UgdGVzdGlkX3NlcVxuICAgICAgICBTVEFSVCBXSVRIIDFcbiAgICAgICAgSU5DUkVNRU5UIEJZIDFcbiAgICAgICAgTk8gTUlOVkFMVUVcbiAgICAgICAgTUFYVkFMVUUgMjE0NzQ4MzY0N1xuICAgICAgICBDQUNIRSAxXG4gICAgICAgIENZQ0xFO1xuICAgICAgQ1JFQVRFIFRBQkxFIHRlc3RzIChcbiAgICAgICAgaWQgaW50ZWdlciBub3QgbnVsbCBwcmltYXJ5IGtleSBERUZBVUxUIG5leHR2YWwoJ3Rlc3RpZF9zZXEnOjpyZWdjbGFzcyksXG4gICAgICAgIG5hbWUgdGV4dCxcbiAgICAgICAgZXh0ZW5kZWQganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgKTtcbiAgICAgIENSRUFURSBUQUJMRSBwYXJlbnRfY2hpbGRfcmVsYXRpb25zaGlwIChwYXJlbnRfaWQgaW50ZWdlciBub3QgbnVsbCwgY2hpbGRfaWQgaW50ZWdlciBub3QgbnVsbCk7XG4gICAgICBDUkVBVEUgVU5JUVVFIElOREVYIGNoaWxkcmVuX2pvaW4gb24gcGFyZW50X2NoaWxkX3JlbGF0aW9uc2hpcCAocGFyZW50X2lkLCBjaGlsZF9pZCk7XG4gICAgICBDUkVBVEUgVEFCTEUgcmVhY3Rpb25zIChwYXJlbnRfaWQgaW50ZWdlciBub3QgbnVsbCwgY2hpbGRfaWQgaW50ZWdlciBub3QgbnVsbCwgcmVhY3Rpb24gdGV4dCBub3QgbnVsbCk7XG4gICAgICBDUkVBVEUgVU5JUVVFIElOREVYIHJlYWN0aW9uc19qb2luIG9uIHJlYWN0aW9ucyAocGFyZW50X2lkLCBjaGlsZF9pZCwgcmVhY3Rpb24pO1xuICAgICAgQ1JFQVRFIFRBQkxFIHZhbGVuY2VfY2hpbGRyZW4gKHBhcmVudF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBjaGlsZF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBwZXJtIGludGVnZXIgbm90IG51bGwpO1xuICAgICAgQ1JFQVRFIFRBQkxFIHF1ZXJ5X2NoaWxkcmVuIChwYXJlbnRfaWQgaW50ZWdlciBub3QgbnVsbCwgY2hpbGRfaWQgaW50ZWdlciBub3QgbnVsbCwgcGVybSBpbnRlZ2VyIG5vdCBudWxsKTtcbiAgICBgLCB7IGRhdGFiYXNlOiBuYW1lIH0pO1xuICB9KTtcbn1cblxuXG50ZXN0U3VpdGUoe1xuICBkZXNjcmliZSwgaXQsIGJlZm9yZSwgYWZ0ZXIsXG59LCB7XG4gIGN0b3I6IFBHU3RvcmUsXG4gIG9wdHM6IHtcbiAgICBzcWw6IHtcbiAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgZGF0YWJhc2U6ICdwbHVtcF90ZXN0JyxcbiAgICAgICAgdXNlcjogJ3Bvc3RncmVzJyxcbiAgICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICB9LFxuICAgIH0sXG4gICAgdGVybWluYWw6IHRydWUsXG4gIH0sXG4gIG5hbWU6ICdQbHVtcCBQb3N0Z3JlcyBTdG9yZScsXG4gIGJlZm9yZTogKCkgPT4gY3JlYXRlRGF0YWJhc2UoJ3BsdW1wX3Rlc3QnKSxcbiAgYWZ0ZXI6IChkcml2ZXIpID0+IHtcbiAgICByZXR1cm4gZHJpdmVyLnRlYXJkb3duKClcbiAgICAudGhlbigoKSA9PiBydW5TUUwoJ0RST1AgREFUQUJBU0UgcGx1bXBfdGVzdDsnKSk7XG4gIH0sXG59KTtcblxuY29uc3Qgc2FtcGxlT2JqZWN0ID0ge1xuICBuYW1lOiAncG90YXRvJyxcbiAgZXh0ZW5kZWQ6IHtcbiAgICBhY3R1YWw6ICdydXRhYmFnYScsXG4gICAgb3RoZXJWYWx1ZTogNDIsXG4gIH0sXG59O1xuXG5kZXNjcmliZSgncG9zdGdyZXMtc3BlY2lmaWMgYmVoYXZpb3JzJywgKCkgPT4ge1xuICBsZXQgc3RvcmU7XG4gIGJlZm9yZSgoKSA9PiB7XG4gICAgcmV0dXJuIGNyZWF0ZURhdGFiYXNlKCdzZWNvbmRhcnlfcGx1bXBfdGVzdCcpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgc3RvcmUgPSBuZXcgUEdTdG9yZSh7XG4gICAgICAgIHNxbDoge1xuICAgICAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgICAgIGRhdGFiYXNlOiAnc2Vjb25kYXJ5X3BsdW1wX3Rlc3QnLFxuICAgICAgICAgICAgdXNlcjogJ3Bvc3RncmVzJyxcbiAgICAgICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICAgICAgcG9ydDogNTQzMixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB0ZXJtaW5hbDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBpdCgnUmV0dXJucyBleHRyYSBjb250ZW50cycsICgpID0+IHtcbiAgICByZXR1cm4gc3RvcmUud3JpdGUoVGVzdFR5cGUsIHNhbXBsZU9iamVjdClcbiAgICAudGhlbigoY3JlYXRlZE9iamVjdCkgPT4ge1xuICAgICAgcmV0dXJuIHN0b3JlLmFkZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCwgJ2xpa2VycycsIDEwMClcbiAgICAgIC50aGVuKCgpID0+IHN0b3JlLmFkZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCwgJ2xpa2VycycsIDEwMSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdhZ3JlZXJzJywgMTAwKSlcbiAgICAgIC50aGVuKCgpID0+IHN0b3JlLmFkZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCwgJ2FncmVlcnMnLCAxMDEpKVxuICAgICAgLnRoZW4oKCkgPT4gc3RvcmUuYWRkKFRlc3RUeXBlLCBjcmVhdGVkT2JqZWN0LmlkLCAndmFsZW5jZUNoaWxkcmVuJywgMTAwLCB7IHBlcm06IDEgfSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdxdWVyeUNoaWxkcmVuJywgMTAxLCB7IHBlcm06IDEgfSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdxdWVyeUNoaWxkcmVuJywgMTAyLCB7IHBlcm06IDIgfSkpXG4gICAgICAudGhlbigoKSA9PiBzdG9yZS5hZGQoVGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdxdWVyeUNoaWxkcmVuJywgMTAzLCB7IHBlcm06IDMgfSkpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiBleHBlY3Qoc3RvcmUucmVhZChUZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCkpXG4gICAgICAgIC50by5ldmVudHVhbGx5LmRlZXAuZXF1YWwoT2JqZWN0LmFzc2lnbih7fSwgc2FtcGxlT2JqZWN0LCB7XG4gICAgICAgICAgW1Rlc3RUeXBlLiRpZF06IGNyZWF0ZWRPYmplY3QuaWQsXG4gICAgICAgICAgbGlrZXJzOiBbeyBpZDogMTAwIH0sIHsgaWQ6IDEwMSB9XSxcbiAgICAgICAgICBhZ3JlZXJzOiBbeyBpZDogMTAwIH0sIHsgaWQ6IDEwMSB9XSxcbiAgICAgICAgICBxdWVyeUNoaWxkcmVuOiBbeyBpZDogMTAyLCBwZXJtOiAyIH0sIHsgaWQ6IDEwMywgcGVybTogMyB9XSxcbiAgICAgICAgICBxdWVyeVBhcmVudHM6IFtdLFxuICAgICAgICAgIGxpa2VlczogW10sXG4gICAgICAgICAgYWdyZWVlczogW10sXG4gICAgICAgICAgdmFsZW5jZUNoaWxkcmVuOiBbeyBpZDogMTAwLCBwZXJtOiAxIH1dLFxuICAgICAgICAgIHZhbGVuY2VQYXJlbnRzOiBbXSxcbiAgICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgICAgcGFyZW50czogW10sXG4gICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBhZnRlcigoKSA9PiB7XG4gICAgcmV0dXJuIHN0b3JlLnRlYXJkb3duKClcbiAgICAudGhlbigoKSA9PiBydW5TUUwoJ0RST1AgREFUQUJBU0Ugc2Vjb25kYXJ5X3BsdW1wX3Rlc3Q7JykpO1xuICB9KTtcbn0pO1xuIl19
