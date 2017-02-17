'use strict';

var _sql = require('../sql');

var _plump = require('plump');

var _pg = require('pg');

var pg = _interopRequireWildcard(_pg);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

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
} /* eslint-env node, mocha*/
/* eslint no-shadow: 0 */

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
    return runSQL('DROP DATABASE if exists plump_test;').then(function () {
      return runSQL('CREATE DATABASE plump_test;');
    }).then(function () {
      return runSQL('\n        CREATE SEQUENCE testid_seq\n          START WITH 1\n          INCREMENT BY 1\n          NO MINVALUE\n          MAXVALUE 2147483647\n          CACHE 1\n          CYCLE;\n        CREATE TABLE tests (\n          id integer not null primary key DEFAULT nextval(\'testid_seq\'::regclass),\n          name text,\n          extended jsonb not null default \'{}\'::jsonb\n        );\n        CREATE TABLE parent_child_relationship (parent_id integer not null, child_id integer not null);\n        CREATE UNIQUE INDEX children_join on parent_child_relationship (parent_id, child_id);\n        CREATE TABLE reactions (parent_id integer not null, child_id integer not null, reaction text not null);\n        CREATE UNIQUE INDEX reactions_join on reactions (parent_id, child_id, reaction);\n        CREATE TABLE valence_children (parent_id integer not null, child_id integer not null, perm integer not null);\n        CREATE TABLE query_children (parent_id integer not null, child_id integer not null, perm integer not null);\n      ', { database: 'plump_test' });
    });
  },
  after: function after(driver) {
    // return driver.teardown()
    // .then(() => runSQL('DROP DATABASE plump_test;'));
  }
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3Qvc3FsLnNwZWMuanMiXSwibmFtZXMiOlsicGciLCJydW5TUUwiLCJjb21tYW5kIiwib3B0cyIsImNvbm5PcHRpb25zIiwiT2JqZWN0IiwiYXNzaWduIiwidXNlciIsImhvc3QiLCJwb3J0IiwiZGF0YWJhc2UiLCJjaGFyc2V0IiwiY2xpZW50IiwiQ2xpZW50IiwiUHJvbWlzZSIsInJlc29sdmUiLCJjb25uZWN0IiwiZXJyIiwicXVlcnkiLCJlbmQiLCJkZXNjcmliZSIsIml0IiwiYmVmb3JlIiwiYWZ0ZXIiLCJjdG9yIiwic3FsIiwiY29ubmVjdGlvbiIsInRlcm1pbmFsIiwibmFtZSIsInRoZW4iLCJkcml2ZXIiXSwibWFwcGluZ3MiOiI7O0FBR0E7O0FBQ0E7O0FBQ0E7O0lBQVlBLEU7Ozs7QUFFWixTQUFTQyxNQUFULENBQWdCQyxPQUFoQixFQUFvQztBQUFBLE1BQVhDLElBQVcsdUVBQUosRUFBSTs7QUFDbEMsTUFBTUMsY0FBY0MsT0FBT0MsTUFBUCxDQUNsQixFQURrQixFQUVsQjtBQUNFQyxVQUFNLFVBRFI7QUFFRUMsVUFBTSxXQUZSO0FBR0VDLFVBQU0sSUFIUjtBQUlFQyxjQUFVLFVBSlo7QUFLRUMsYUFBUztBQUxYLEdBRmtCLEVBU2xCUixJQVRrQixDQUFwQjtBQVdBLE1BQU1TLFNBQVMsSUFBSVosR0FBR2EsTUFBUCxDQUFjVCxXQUFkLENBQWY7QUFDQSxTQUFPLElBQUlVLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQWE7QUFDOUJILFdBQU9JLE9BQVAsQ0FBZSxVQUFDQyxHQUFELEVBQVM7QUFDdEIsVUFBSUEsR0FBSixFQUFTLE1BQU1BLEdBQU47QUFDVEwsYUFBT00sS0FBUCxDQUFhaEIsT0FBYixFQUFzQixVQUFDZSxHQUFELEVBQVM7QUFDN0IsWUFBSUEsR0FBSixFQUFTLE1BQU1BLEdBQU47QUFDVEwsZUFBT08sR0FBUCxDQUFXLFVBQUNGLEdBQUQsRUFBUztBQUNsQixjQUFJQSxHQUFKLEVBQVMsTUFBTUEsR0FBTjtBQUNURjtBQUNELFNBSEQ7QUFJRCxPQU5EO0FBT0QsS0FURDtBQVVELEdBWE0sQ0FBUDtBQVlELEMsQ0FoQ0Q7QUFDQTs7QUFrQ0Esc0JBQVU7QUFDUkssb0JBRFEsRUFDRUMsTUFERixFQUNNQyxjQUROLEVBQ2NDO0FBRGQsQ0FBVixFQUVHO0FBQ0RDLG9CQURDO0FBRURyQixRQUFNO0FBQ0pzQixTQUFLO0FBQ0hDLGtCQUFZO0FBQ1ZoQixrQkFBVSxZQURBO0FBRVZILGNBQU0sVUFGSTtBQUdWQyxjQUFNLFdBSEk7QUFJVkMsY0FBTTtBQUpJO0FBRFQsS0FERDtBQVNKa0IsY0FBVTtBQVROLEdBRkw7QUFhREMsUUFBTSxzQkFiTDtBQWNETixVQUFRLGtCQUFNO0FBQ1osV0FBT3JCLE9BQU8scUNBQVAsRUFDTjRCLElBRE0sQ0FDRDtBQUFBLGFBQU01QixPQUFPLDZCQUFQLENBQU47QUFBQSxLQURDLEVBRU40QixJQUZNLENBRUQsWUFBTTtBQUNWLGFBQU81QixraENBbUJKLEVBQUVTLFVBQVUsWUFBWixFQW5CSSxDQUFQO0FBb0JELEtBdkJNLENBQVA7QUF3QkQsR0F2Q0E7QUF3Q0RhLFNBQU8sZUFBQ08sTUFBRCxFQUFZO0FBQ2pCO0FBQ0E7QUFDRDtBQTNDQSxDQUZIIiwiZmlsZSI6InRlc3Qvc3FsLnNwZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZW52IG5vZGUsIG1vY2hhKi9cbi8qIGVzbGludCBuby1zaGFkb3c6IDAgKi9cblxuaW1wb3J0IHsgUEdTdG9yZSB9IGZyb20gJy4uL3NxbCc7XG5pbXBvcnQgeyB0ZXN0U3VpdGUgfSBmcm9tICdwbHVtcCc7XG5pbXBvcnQgKiBhcyBwZyBmcm9tICdwZyc7XG5cbmZ1bmN0aW9uIHJ1blNRTChjb21tYW5kLCBvcHRzID0ge30pIHtcbiAgY29uc3QgY29ubk9wdGlvbnMgPSBPYmplY3QuYXNzaWduKFxuICAgIHt9LFxuICAgIHtcbiAgICAgIHVzZXI6ICdwb3N0Z3JlcycsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICBkYXRhYmFzZTogJ3Bvc3RncmVzJyxcbiAgICAgIGNoYXJzZXQ6ICd1dGY4JyxcbiAgICB9LFxuICAgIG9wdHNcbiAgKTtcbiAgY29uc3QgY2xpZW50ID0gbmV3IHBnLkNsaWVudChjb25uT3B0aW9ucyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgIGNsaWVudC5jb25uZWN0KChlcnIpID0+IHtcbiAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgIGNsaWVudC5xdWVyeShjb21tYW5kLCAoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgY2xpZW50LmVuZCgoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKGVycikgdGhyb3cgZXJyO1xuICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59XG5cblxudGVzdFN1aXRlKHtcbiAgZGVzY3JpYmUsIGl0LCBiZWZvcmUsIGFmdGVyLFxufSwge1xuICBjdG9yOiBQR1N0b3JlLFxuICBvcHRzOiB7XG4gICAgc3FsOiB7XG4gICAgICBjb25uZWN0aW9uOiB7XG4gICAgICAgIGRhdGFiYXNlOiAncGx1bXBfdGVzdCcsXG4gICAgICAgIHVzZXI6ICdwb3N0Z3JlcycsXG4gICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICBwb3J0OiA1NDMyLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHRlcm1pbmFsOiB0cnVlLFxuICB9LFxuICBuYW1lOiAnUGx1bXAgUG9zdGdyZXMgU3RvcmUnLFxuICBiZWZvcmU6ICgpID0+IHtcbiAgICByZXR1cm4gcnVuU1FMKCdEUk9QIERBVEFCQVNFIGlmIGV4aXN0cyBwbHVtcF90ZXN0OycpXG4gICAgLnRoZW4oKCkgPT4gcnVuU1FMKCdDUkVBVEUgREFUQUJBU0UgcGx1bXBfdGVzdDsnKSlcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gcnVuU1FMKGBcbiAgICAgICAgQ1JFQVRFIFNFUVVFTkNFIHRlc3RpZF9zZXFcbiAgICAgICAgICBTVEFSVCBXSVRIIDFcbiAgICAgICAgICBJTkNSRU1FTlQgQlkgMVxuICAgICAgICAgIE5PIE1JTlZBTFVFXG4gICAgICAgICAgTUFYVkFMVUUgMjE0NzQ4MzY0N1xuICAgICAgICAgIENBQ0hFIDFcbiAgICAgICAgICBDWUNMRTtcbiAgICAgICAgQ1JFQVRFIFRBQkxFIHRlc3RzIChcbiAgICAgICAgICBpZCBpbnRlZ2VyIG5vdCBudWxsIHByaW1hcnkga2V5IERFRkFVTFQgbmV4dHZhbCgndGVzdGlkX3NlcSc6OnJlZ2NsYXNzKSxcbiAgICAgICAgICBuYW1lIHRleHQsXG4gICAgICAgICAgZXh0ZW5kZWQganNvbmIgbm90IG51bGwgZGVmYXVsdCAne30nOjpqc29uYlxuICAgICAgICApO1xuICAgICAgICBDUkVBVEUgVEFCTEUgcGFyZW50X2NoaWxkX3JlbGF0aW9uc2hpcCAocGFyZW50X2lkIGludGVnZXIgbm90IG51bGwsIGNoaWxkX2lkIGludGVnZXIgbm90IG51bGwpO1xuICAgICAgICBDUkVBVEUgVU5JUVVFIElOREVYIGNoaWxkcmVuX2pvaW4gb24gcGFyZW50X2NoaWxkX3JlbGF0aW9uc2hpcCAocGFyZW50X2lkLCBjaGlsZF9pZCk7XG4gICAgICAgIENSRUFURSBUQUJMRSByZWFjdGlvbnMgKHBhcmVudF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBjaGlsZF9pZCBpbnRlZ2VyIG5vdCBudWxsLCByZWFjdGlvbiB0ZXh0IG5vdCBudWxsKTtcbiAgICAgICAgQ1JFQVRFIFVOSVFVRSBJTkRFWCByZWFjdGlvbnNfam9pbiBvbiByZWFjdGlvbnMgKHBhcmVudF9pZCwgY2hpbGRfaWQsIHJlYWN0aW9uKTtcbiAgICAgICAgQ1JFQVRFIFRBQkxFIHZhbGVuY2VfY2hpbGRyZW4gKHBhcmVudF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBjaGlsZF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBwZXJtIGludGVnZXIgbm90IG51bGwpO1xuICAgICAgICBDUkVBVEUgVEFCTEUgcXVlcnlfY2hpbGRyZW4gKHBhcmVudF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBjaGlsZF9pZCBpbnRlZ2VyIG5vdCBudWxsLCBwZXJtIGludGVnZXIgbm90IG51bGwpO1xuICAgICAgYCwgeyBkYXRhYmFzZTogJ3BsdW1wX3Rlc3QnIH0pO1xuICAgIH0pO1xuICB9LFxuICBhZnRlcjogKGRyaXZlcikgPT4ge1xuICAgIC8vIHJldHVybiBkcml2ZXIudGVhcmRvd24oKVxuICAgIC8vIC50aGVuKCgpID0+IHJ1blNRTCgnRFJPUCBEQVRBQkFTRSBwbHVtcF90ZXN0OycpKTtcbiAgfSxcbn0pO1xuIl19
