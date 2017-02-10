'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PostgresStore = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _knex = require('knex');

var _knex2 = _interopRequireDefault(_knex);

var _plump = require('plump');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var $knex = Symbol('$knex');

function deserializeWhere(query, block) {
  var car = block[0];
  var cdr = block.slice(1);
  if (Array.isArray(cdr[0])) {
    return cdr.reduce(function (subQuery, subBlock) {
      return deserializeWhere(subQuery, subBlock);
    }, query);
  } else {
    return query[car].apply(query, cdr);
  }
}

function objectToWhereChain(query, block, context) {
  return Object.keys(block).reduce(function (q, key) {
    if (Array.isArray(block[key])) {
      return deserializeWhere(query, _plump.Storage.massReplace(block[key], context));
    } else {
      return q.where(key, block[key]);
    }
  }, query);
}

var PostgresStore = exports.PostgresStore = function (_Storage) {
  _inherits(PostgresStore, _Storage);

  function PostgresStore() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, PostgresStore);

    var _this = _possibleConstructorReturn(this, (PostgresStore.__proto__ || Object.getPrototypeOf(PostgresStore)).call(this, opts));

    var options = Object.assign({}, {
      client: 'postgres',
      debug: false,
      connection: {
        user: 'postgres',
        host: 'localhost',
        port: 5432,
        password: '',
        charset: 'utf8'
      },
      pool: {
        max: 20,
        min: 0
      }
    }, opts.sql);
    _this[$knex] = (0, _knex2.default)(options);
    return _this;
  }

  /*
    note that knex.js "then" functions aren't actually promises the way you think they are.
    you can return knex.insert().into(), which has a then() on it, but that thenable isn't
    an actual promise yet. So instead we're returning Bluebird.resolve(thenable);
  */

  _createClass(PostgresStore, [{
    key: 'teardown',
    value: function teardown() {
      return this[$knex].destroy();
    }
  }, {
    key: 'write',
    value: function write(t, v) {
      var _this2 = this;

      return _bluebird2.default.resolve().then(function () {
        var id = v[t.$id];
        var updateObject = {};
        Object.keys(t.$fields).forEach(function (fieldName) {
          if (v[fieldName] !== undefined) {
            // copy from v to the best of our ability
            if (t.$fields[fieldName].type === 'array' || t.$fields[fieldName].type === 'hasMany') {
              updateObject[fieldName] = v[fieldName].concat();
            } else if (t.$fields[fieldName].type === 'object') {
              updateObject[fieldName] = Object.assign({}, v[fieldName]);
            } else {
              updateObject[fieldName] = v[fieldName];
            }
          }
        });
        if (id === undefined && _this2.terminal) {
          return _this2[$knex](t.$name).insert(updateObject).returning(t.$id).then(function (createdId) {
            return _this2.read(t, createdId[0]);
          });
        } else if (id !== undefined) {
          return _this2[$knex](t.$name).where(_defineProperty({}, t.$id, id)).update(updateObject).then(function () {
            return _this2.read(t, id);
          });
        } else {
          throw new Error('Cannot create new content in a non-terminal store');
        }
      }).then(function (result) {
        return _this2.notifyUpdate(t, result[t.$id], result).then(function () {
          return result;
        });
      });
    }
  }, {
    key: 'readOne',
    value: function readOne(t, id) {
      return this[$knex](t.$name).where(_defineProperty({}, t.$id, id)).select().then(function (o) {
        return o[0] || null;
      });
    }
  }, {
    key: 'readMany',
    value: function readMany(type, id, relationshipTitle) {
      var _this3 = this;

      var relationshipBlock = type.$fields[relationshipTitle];
      var sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
      var toSelect = [sideInfo.other.field, sideInfo.self.field];
      if (relationshipBlock.relationship.$extras) {
        toSelect = toSelect.concat(Object.keys(relationshipBlock.relationship.$extras));
      }
      var whereBlock = {};
      if (sideInfo.self.query) {
        whereBlock[sideInfo.self.field] = sideInfo.self.query.logic;
      } else {
        whereBlock[sideInfo.self.field] = id;
      }
      if (relationshipBlock.relationship.$restrict) {
        Object.keys(relationshipBlock.relationship.$restrict).forEach(function (restriction) {
          whereBlock[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
        });
      }
      return _bluebird2.default.resolve().then(function () {
        if (sideInfo.self.query && sideInfo.self.query.requireLoad) {
          return _this3.readOne(type, id);
        } else {
          return { id: id };
        }
      }).then(function (context) {
        return objectToWhereChain(_this3[$knex](relationshipBlock.relationship.$name), whereBlock, context).select(toSelect);
      }).then(function (l) {
        return _defineProperty({}, relationshipTitle, l);
      });
    }
  }, {
    key: 'delete',
    value: function _delete(t, id) {
      return this[$knex](t.$name).where(_defineProperty({}, t.$id, id)).delete().then(function (o) {
        return o;
      });
    }
  }, {
    key: 'add',
    value: function add(type, id, relationshipTitle, childId) {
      var _newField,
          _this4 = this;

      var extras = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      var relationshipBlock = type.$fields[relationshipTitle];
      var sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
      var newField = (_newField = {}, _defineProperty(_newField, sideInfo.other.field, childId), _defineProperty(_newField, sideInfo.self.field, id), _newField);
      if (relationshipBlock.relationship.$restrict) {
        Object.keys(relationshipBlock.relationship.$restrict).forEach(function (restriction) {
          newField[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
        });
      }
      if (relationshipBlock.relationship.$extras) {
        Object.keys(relationshipBlock.relationship.$extras).forEach(function (extra) {
          newField[extra] = extras[extra];
        });
      }
      return this[$knex](relationshipBlock.relationship.$name).insert(newField).then(function () {
        return _this4.notifyUpdate(type, id, null, relationshipTitle);
      });
    }
  }, {
    key: 'modifyRelationship',
    value: function modifyRelationship(type, id, relationshipTitle, childId) {
      var _whereBlock,
          _this5 = this;

      var extras = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      var relationshipBlock = type.$fields[relationshipTitle];
      var sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
      var newField = {};
      Object.keys(relationshipBlock.relationship.$extras).forEach(function (extra) {
        if (extras[extra] !== undefined) {
          newField[extra] = extras[extra];
        }
      });
      var whereBlock = (_whereBlock = {}, _defineProperty(_whereBlock, sideInfo.other.field, childId), _defineProperty(_whereBlock, sideInfo.self.field, id), _whereBlock);
      if (relationshipBlock.relationship.$restrict) {
        Object.keys(relationshipBlock.relationship.$restrict).forEach(function (restriction) {
          whereBlock[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
        });
      }
      return objectToWhereChain(this[$knex](relationshipBlock.relationship.$name), whereBlock, { id: id, childId: childId }).update(newField).then(function () {
        return _this5.notifyUpdate(type, id, null, relationshipTitle);
      });
    }
  }, {
    key: 'remove',
    value: function remove(type, id, relationshipTitle, childId) {
      var _whereBlock2,
          _this6 = this;

      var relationshipBlock = type.$fields[relationshipTitle];
      var sideInfo = relationshipBlock.relationship.$sides[relationshipTitle];
      var whereBlock = (_whereBlock2 = {}, _defineProperty(_whereBlock2, sideInfo.other.field, childId), _defineProperty(_whereBlock2, sideInfo.self.field, id), _whereBlock2);
      if (relationshipBlock.relationship.$restrict) {
        Object.keys(relationshipBlock.relationship.$restrict).forEach(function (restriction) {
          whereBlock[restriction] = relationshipBlock.relationship.$restrict[restriction].value;
        });
      }
      return objectToWhereChain(this[$knex](relationshipBlock.relationship.$name), whereBlock).delete().then(function () {
        return _this6.notifyUpdate(type, id, null, relationshipTitle);
      });
    }
  }, {
    key: 'query',
    value: function query(q) {
      return _bluebird2.default.resolve(this[$knex].raw(q.query)).then(function (d) {
        return d.rows;
      });
    }
  }]);

  return PostgresStore;
}(_plump.Storage);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNxbC5qcyJdLCJuYW1lcyI6WyIka25leCIsIlN5bWJvbCIsImRlc2VyaWFsaXplV2hlcmUiLCJxdWVyeSIsImJsb2NrIiwiY2FyIiwiY2RyIiwic2xpY2UiLCJBcnJheSIsImlzQXJyYXkiLCJyZWR1Y2UiLCJzdWJRdWVyeSIsInN1YkJsb2NrIiwiYXBwbHkiLCJvYmplY3RUb1doZXJlQ2hhaW4iLCJjb250ZXh0IiwiT2JqZWN0Iiwia2V5cyIsInEiLCJrZXkiLCJtYXNzUmVwbGFjZSIsIndoZXJlIiwiUG9zdGdyZXNTdG9yZSIsIm9wdHMiLCJvcHRpb25zIiwiYXNzaWduIiwiY2xpZW50IiwiZGVidWciLCJjb25uZWN0aW9uIiwidXNlciIsImhvc3QiLCJwb3J0IiwicGFzc3dvcmQiLCJjaGFyc2V0IiwicG9vbCIsIm1heCIsIm1pbiIsInNxbCIsImRlc3Ryb3kiLCJ0IiwidiIsInJlc29sdmUiLCJ0aGVuIiwiaWQiLCIkaWQiLCJ1cGRhdGVPYmplY3QiLCIkZmllbGRzIiwiZm9yRWFjaCIsImZpZWxkTmFtZSIsInVuZGVmaW5lZCIsInR5cGUiLCJjb25jYXQiLCJ0ZXJtaW5hbCIsIiRuYW1lIiwiaW5zZXJ0IiwicmV0dXJuaW5nIiwiY3JlYXRlZElkIiwicmVhZCIsInVwZGF0ZSIsIkVycm9yIiwicmVzdWx0Iiwibm90aWZ5VXBkYXRlIiwic2VsZWN0IiwibyIsInJlbGF0aW9uc2hpcFRpdGxlIiwicmVsYXRpb25zaGlwQmxvY2siLCJzaWRlSW5mbyIsInJlbGF0aW9uc2hpcCIsIiRzaWRlcyIsInRvU2VsZWN0Iiwib3RoZXIiLCJmaWVsZCIsInNlbGYiLCIkZXh0cmFzIiwid2hlcmVCbG9jayIsImxvZ2ljIiwiJHJlc3RyaWN0IiwicmVzdHJpY3Rpb24iLCJ2YWx1ZSIsInJlcXVpcmVMb2FkIiwicmVhZE9uZSIsImwiLCJkZWxldGUiLCJjaGlsZElkIiwiZXh0cmFzIiwibmV3RmllbGQiLCJleHRyYSIsInJhdyIsImQiLCJyb3dzIl0sIm1hcHBpbmdz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QUNOdUMsSUFETSxDQUNELFVBQUM4QyxDQUFEO0FBQUEsZUFBT0EsRUFBRUMsSUFBVDtBQUFBLE9BREMsQ0FBUDtBQUVEIiwiZmlsZSI6InNxbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCbHVlYmlyZCBmcm9tICdibHVlYmlyZCc7XG5pbXBvcnQga25leCBmcm9tICdrbmV4JztcbmltcG9ydCB7IFN0b3JhZ2UgfSBmcm9tICdwbHVtcCc7XG5jb25zdCAka25leCA9IFN5bWJvbCgnJGtuZXgnKTtcblxuZnVuY3Rpb24gZGVzZXJpYWxpemVXaGVyZShxdWVyeSwgYmxvY2spIHtcbiAgY29uc3QgY2FyID0gYmxvY2tbMF07XG4gIGNvbnN0IGNkciA9IGJsb2NrLnNsaWNlKDEpO1xuICBpZiAoQXJyYXkuaXNBcnJheShjZHJbMF0pKSB7XG4gICAgcmV0dXJuIGNkci5yZWR1Y2UoKHN1YlF1ZXJ5LCBzdWJCbG9jaykgPT4gZGVzZXJpYWxpemVXaGVyZShzdWJRdWVyeSwgc3ViQmxvY2spLCBxdWVyeSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHF1ZXJ5W2Nhcl0uYXBwbHkocXVlcnksIGNkcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gb2JqZWN0VG9XaGVyZUNoYWluKHF1ZXJ5LCBibG9jaywgY29udGV4dCkge1xuICByZXR1cm4gT2JqZWN0LmtleXMoYmxvY2spLnJlZHVjZSgocSwga2V5KSA9PiB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYmxvY2tba2V5XSkpIHtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZVdoZXJlKHF1ZXJ5LCBTdG9yYWdlLm1hc3NSZXBsYWNlKGJsb2NrW2tleV0sIGNvbnRleHQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHEud2hlcmUoa2V5LCBibG9ja1trZXldKTtcbiAgICB9XG4gIH0sIHF1ZXJ5KTtcbn1cblxuXG5leHBvcnQgY2xhc3MgUG9zdGdyZXNTdG9yZSBleHRlbmRzIFN0b3JhZ2Uge1xuICBjb25zdHJ1Y3RvcihvcHRzID0ge30pIHtcbiAgICBzdXBlcihvcHRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gT2JqZWN0LmFzc2lnbihcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBjbGllbnQ6ICdwb3N0Z3JlcycsXG4gICAgICAgIGRlYnVnOiBmYWxzZSxcbiAgICAgICAgY29ubmVjdGlvbjoge1xuICAgICAgICAgIHVzZXI6ICdwb3N0Z3JlcycsXG4gICAgICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICAgICAgcG9ydDogNTQzMixcbiAgICAgICAgICBwYXNzd29yZDogJycsXG4gICAgICAgICAgY2hhcnNldDogJ3V0ZjgnLFxuICAgICAgICB9LFxuICAgICAgICBwb29sOiB7XG4gICAgICAgICAgbWF4OiAyMCxcbiAgICAgICAgICBtaW46IDAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgb3B0cy5zcWxcbiAgICApO1xuICAgIHRoaXNbJGtuZXhdID0ga25leChvcHRpb25zKTtcbiAgfVxuXG4gIC8qXG4gICAgbm90ZSB0aGF0IGtuZXguanMgXCJ0aGVuXCIgZnVuY3Rpb25zIGFyZW4ndCBhY3R1YWxseSBwcm9taXNlcyB0aGUgd2F5IHlvdSB0aGluayB0aGV5IGFyZS5cbiAgICB5b3UgY2FuIHJldHVybiBrbmV4Lmluc2VydCgpLmludG8oKSwgd2hpY2ggaGFzIGEgdGhlbigpIG9uIGl0LCBidXQgdGhhdCB0aGVuYWJsZSBpc24ndFxuICAgIGFuIGFjdHVhbCBwcm9taXNlIHlldC4gU28gaW5zdGVhZCB3ZSdyZSByZXR1cm5pbmcgQmx1ZWJpcmQucmVzb2x2ZSh0aGVuYWJsZSk7XG4gICovXG5cbiAgdGVhcmRvd24oKSB7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHdyaXRlKHQsIHYpIHtcbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgY29uc3QgaWQgPSB2W3QuJGlkXTtcbiAgICAgIGNvbnN0IHVwZGF0ZU9iamVjdCA9IHt9O1xuICAgICAgT2JqZWN0LmtleXModC4kZmllbGRzKS5mb3JFYWNoKChmaWVsZE5hbWUpID0+IHtcbiAgICAgICAgaWYgKHZbZmllbGROYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gY29weSBmcm9tIHYgdG8gdGhlIGJlc3Qgb2Ygb3VyIGFiaWxpdHlcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAodC4kZmllbGRzW2ZpZWxkTmFtZV0udHlwZSA9PT0gJ2FycmF5JykgfHxcbiAgICAgICAgICAgICh0LiRmaWVsZHNbZmllbGROYW1lXS50eXBlID09PSAnaGFzTWFueScpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB1cGRhdGVPYmplY3RbZmllbGROYW1lXSA9IHZbZmllbGROYW1lXS5jb25jYXQoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHQuJGZpZWxkc1tmaWVsZE5hbWVdLnR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB1cGRhdGVPYmplY3RbZmllbGROYW1lXSA9IE9iamVjdC5hc3NpZ24oe30sIHZbZmllbGROYW1lXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVwZGF0ZU9iamVjdFtmaWVsZE5hbWVdID0gdltmaWVsZE5hbWVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoKGlkID09PSB1bmRlZmluZWQpICYmICh0aGlzLnRlcm1pbmFsKSkge1xuICAgICAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkuaW5zZXJ0KHVwZGF0ZU9iamVjdCkucmV0dXJuaW5nKHQuJGlkKVxuICAgICAgICAudGhlbigoY3JlYXRlZElkKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZCh0LCBjcmVhdGVkSWRbMF0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkud2hlcmUoeyBbdC4kaWRdOiBpZCB9KS51cGRhdGUodXBkYXRlT2JqZWN0KVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZCh0LCBpZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY3JlYXRlIG5ldyBjb250ZW50IGluIGEgbm9uLXRlcm1pbmFsIHN0b3JlJyk7XG4gICAgICB9XG4gICAgfSkudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5ub3RpZnlVcGRhdGUodCwgcmVzdWx0W3QuJGlkXSwgcmVzdWx0KS50aGVuKCgpID0+IHJlc3VsdCk7XG4gICAgfSk7XG4gIH1cblxuICByZWFkT25lKHQsIGlkKSB7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLndoZXJlKHsgW3QuJGlkXTogaWQgfSkuc2VsZWN0KClcbiAgICAudGhlbigobykgPT4gb1swXSB8fCBudWxsKTtcbiAgfVxuXG4gIHJlYWRNYW55KHR5cGUsIGlkLCByZWxhdGlvbnNoaXBUaXRsZSkge1xuICAgIGNvbnN0IHJlbGF0aW9uc2hpcEJsb2NrID0gdHlwZS4kZmllbGRzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBjb25zdCBzaWRlSW5mbyA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kc2lkZXNbcmVsYXRpb25zaGlwVGl0bGVdO1xuICAgIGxldCB0b1NlbGVjdCA9IFtzaWRlSW5mby5vdGhlci5maWVsZCwgc2lkZUluZm8uc2VsZi5maWVsZF07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kZXh0cmFzKSB7XG4gICAgICB0b1NlbGVjdCA9IHRvU2VsZWN0LmNvbmNhdChPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJGV4dHJhcykpO1xuICAgIH1cbiAgICBjb25zdCB3aGVyZUJsb2NrID0ge307XG4gICAgaWYgKHNpZGVJbmZvLnNlbGYucXVlcnkpIHtcbiAgICAgIHdoZXJlQmxvY2tbc2lkZUluZm8uc2VsZi5maWVsZF0gPSBzaWRlSW5mby5zZWxmLnF1ZXJ5LmxvZ2ljO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aGVyZUJsb2NrW3NpZGVJbmZvLnNlbGYuZmllbGRdID0gaWQ7XG4gICAgfVxuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KS5mb3JFYWNoKChyZXN0cmljdGlvbikgPT4ge1xuICAgICAgICB3aGVyZUJsb2NrW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICBpZiAoc2lkZUluZm8uc2VsZi5xdWVyeSAmJiBzaWRlSW5mby5zZWxmLnF1ZXJ5LnJlcXVpcmVMb2FkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlYWRPbmUodHlwZSwgaWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHsgaWQgfTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC50aGVuKChjb250ZXh0KSA9PiB7XG4gICAgICByZXR1cm4gb2JqZWN0VG9XaGVyZUNoYWluKHRoaXNbJGtuZXhdKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kbmFtZSksIHdoZXJlQmxvY2ssIGNvbnRleHQpXG4gICAgICAuc2VsZWN0KHRvU2VsZWN0KTtcbiAgICB9KVxuICAgIC50aGVuKChsKSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBbcmVsYXRpb25zaGlwVGl0bGVdOiBsLFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh0LCBpZCkge1xuICAgIHJldHVybiB0aGlzWyRrbmV4XSh0LiRuYW1lKS53aGVyZSh7IFt0LiRpZF06IGlkIH0pLmRlbGV0ZSgpXG4gICAgLnRoZW4oKG8pID0+IG8pO1xuICB9XG5cbiAgYWRkKHR5cGUsIGlkLCByZWxhdGlvbnNoaXBUaXRsZSwgY2hpbGRJZCwgZXh0cmFzID0ge30pIHtcbiAgICBjb25zdCByZWxhdGlvbnNoaXBCbG9jayA9IHR5cGUuJGZpZWxkc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHNpZGVzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBjb25zdCBuZXdGaWVsZCA9IHtcbiAgICAgIFtzaWRlSW5mby5vdGhlci5maWVsZF06IGNoaWxkSWQsXG4gICAgICBbc2lkZUluZm8uc2VsZi5maWVsZF06IGlkLFxuICAgIH07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpIHtcbiAgICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpLmZvckVhY2goKHJlc3RyaWN0aW9uKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJGV4dHJhcykge1xuICAgICAgT2JqZWN0LmtleXMocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kbmFtZSlcbiAgICAuaW5zZXJ0KG5ld0ZpZWxkKVxuICAgIC50aGVuKCgpID0+IHRoaXMubm90aWZ5VXBkYXRlKHR5cGUsIGlkLCBudWxsLCByZWxhdGlvbnNoaXBUaXRsZSkpO1xuICB9XG5cbiAgbW9kaWZ5UmVsYXRpb25zaGlwKHR5cGUsIGlkLCByZWxhdGlvbnNoaXBUaXRsZSwgY2hpbGRJZCwgZXh0cmFzID0ge30pIHtcbiAgICBjb25zdCByZWxhdGlvbnNoaXBCbG9jayA9IHR5cGUuJGZpZWxkc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHNpZGVzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBjb25zdCBuZXdGaWVsZCA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kZXh0cmFzKS5mb3JFYWNoKChleHRyYSkgPT4ge1xuICAgICAgaWYgKGV4dHJhc1tleHRyYV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBuZXdGaWVsZFtleHRyYV0gPSBleHRyYXNbZXh0cmFdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IHdoZXJlQmxvY2sgPSB7XG4gICAgICBbc2lkZUluZm8ub3RoZXIuZmllbGRdOiBjaGlsZElkLFxuICAgICAgW3NpZGVJbmZvLnNlbGYuZmllbGRdOiBpZCxcbiAgICB9O1xuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KS5mb3JFYWNoKChyZXN0cmljdGlvbikgPT4ge1xuICAgICAgICB3aGVyZUJsb2NrW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RUb1doZXJlQ2hhaW4odGhpc1ska25leF0ocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRuYW1lKSwgd2hlcmVCbG9jaywgeyBpZCwgY2hpbGRJZCB9KVxuICAgIC51cGRhdGUobmV3RmllbGQpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbGF0aW9uc2hpcFRpdGxlKSk7XG4gIH1cblxuICByZW1vdmUodHlwZSwgaWQsIHJlbGF0aW9uc2hpcFRpdGxlLCBjaGlsZElkKSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRmaWVsZHNbcmVsYXRpb25zaGlwVGl0bGVdO1xuICAgIGNvbnN0IHNpZGVJbmZvID0gcmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgd2hlcmVCbG9jayA9IHtcbiAgICAgIFtzaWRlSW5mby5vdGhlci5maWVsZF06IGNoaWxkSWQsXG4gICAgICBbc2lkZUluZm8uc2VsZi5maWVsZF06IGlkLFxuICAgIH07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpIHtcbiAgICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpLmZvckVhY2goKHJlc3RyaWN0aW9uKSA9PiB7XG4gICAgICAgIHdoZXJlQmxvY2tbcmVzdHJpY3Rpb25dID0gcmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRyZXN0cmljdFtyZXN0cmljdGlvbl0udmFsdWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdFRvV2hlcmVDaGFpbih0aGlzWyRrbmV4XShyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJG5hbWUpLCB3aGVyZUJsb2NrKS5kZWxldGUoKVxuICAgIC50aGVuKCgpID0+IHRoaXMubm90aWZ5VXBkYXRlKHR5cGUsIGlkLCBudWxsLCByZWxhdGlvbnNoaXBUaXRsZSkpO1xuICB9XG5cbiAgcXVlcnkocSkge1xuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKHRoaXNbJGtuZXhdLnJhdyhxLnF1ZXJ5KSlcbiAgICAudGhlbigoZCkgPT4gZC5yb3dzKTtcbiAgfVxufVxuIl19
