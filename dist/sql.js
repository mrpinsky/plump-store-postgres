'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PGStore = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _knex = require('knex');

var _knex2 = _interopRequireDefault(_knex);

var _plump = require('plump');

var _blockRead2 = require('./blockRead');

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

function fixCase(data, schema) {
  Object.keys(schema).forEach(function (key) {
    if (key.toLowerCase() !== key && data[key.toLowerCase()]) {
      data[key] = data[key.toLowerCase()]; // eslint-disable-line no-param-reassign
      delete data[key.toLowerCase()]; // eslint-disable-line no-param-reassign
    }
  });
  console.log(JSON.stringify(data, null, 2));
  return data;
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

var PGStore = exports.PGStore = function (_Storage) {
  _inherits(PGStore, _Storage);

  function PGStore() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, PGStore);

    var _this = _possibleConstructorReturn(this, (PGStore.__proto__ || Object.getPrototypeOf(PGStore)).call(this, opts));

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

  _createClass(PGStore, [{
    key: 'teardown',
    value: function teardown() {
      return this[$knex].destroy();
    }
  }, {
    key: 'write',
    value: function write(t, v) {
      var _this2 = this;

      return _bluebird2.default.resolve().then(function () {
        debugger;
        var id = v[t.$id];
        var updateObject = {};
        Object.keys(t.$fields).forEach(function (fieldName) {
          if (v[fieldName] !== undefined) {
            // copy from v to the best of our ability
            if (t.$fields[fieldName].type === 'array') {
              updateObject[fieldName] = v[fieldName].concat();
            } else if (t.$fields[fieldName].type === 'object') {
              updateObject[fieldName] = Object.assign({}, v[fieldName]);
            } else if (t.$fields[fieldName].type !== 'hasMany') {
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
      return (0, _blockRead2.blockRead)(t, this[$knex], _defineProperty({}, t.$id, id))
      // return this[$knex](t.$name).where({ [t.$id]: id }).select()
      .then(function (o) {
        if (o[0]) {
          return fixCase(o[0], t.$fields);
        } else {
          return null;
        }
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

  return PGStore;
}(_plump.Storage);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNxbC5qcyJdLCJuYW1lcyI6WyIka25leCIsIlN5bWJvbCIsImRlc2VyaWFsaXplV2hlcmUiLCJxdWVyeSIsImJsb2NrIiwiY2FyIiwiY2RyIiwic2xpY2UiLCJBcnJheSIsImlzQXJyYXkiLCJyZWR1Y2UiLCJzdWJRdWVyeSIsInN1YkJsb2NrIiwiYXBwbHkiLCJmaXhDYXNlIiwiZGF0YSIsInNjaGVtYSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwia2V5IiwidG9Mb3dlckNhc2UiLCJjb25zb2xlIiwibG9nIiwiSlNPTiIsInN0cmluZ2lmeSIsIm9iamVjdFRvV2hlcmVDaGFpbiIsImNvbnRleHQiLCJxIiwibWFzc1JlcGxhY2UiLCJ3aGVyZSIsIlBHU3RvcmUiLCJvcHRzIiwib3B0aW9ucyIsImFzc2lnbiIsImNsaWVudCIsImRlYnVnIiwiY29ubmVjdGlvbiIsInVzZXIiLCJob3N0IiwicG9ydCIsInBhc3N3b3JkIiwiY2hhcnNldCIsInBvb2wiLCJtYXgiLCJtaW4iLCJzcWwiLCJkZXN0cm95IiwidCIsInYiLCJyZXNvbHZlIiwidGhlbiIsImlkIiwiJGlkIiwidXBkYXRlT2JqZWN0IiwiJGZpZWxkcyIsImZpZWxkTmFtZSIsInVuZGVmaW5lZCIsInR5cGUiLCJjb25jYXQiLCJ0ZXJtaW5hbCIsIiRuYW1lIiwiaW5zZXJ0IiwicmV0dXJuaW5nIiwiY3JlYXRlZElkIiwicmVhZCIsInVwZGF0ZSIsIkVycm9yIiwicmVzdWx0Iiwibm90aWZ5VXBkYXRlIiwibyIsInJlbGF0aW9uc2hpcFRpdGxlIiwicmVsYXRpb25zaGlwQmxvY2siLCJzaWRlSW5mbyIsInJlbGF0aW9uc2hpcCIsIiRzaWRlcyIsInRvU2VsZWN0Iiwib3RoZXIiLCJmaWVsZCIsInNlbGYiLCIkZXh0cmFzIiwid2hlcmVCbG9jayIsImxvZ2ljIiwiJHJlc3RyaWN0IiwicmVzdHJpY3Rpb24iLCJ2YWx1ZSIsInJlcXVpcmVMb2FkIiwicmVhZE9uZSIsInNlbGVjdCIsImwiLCJkZWxl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QmEsT0FEcEIsaUNBRUhsQixTQUFTTSxJQUFULENBQWNELEtBRlgsRUFFbUIxQixFQUZuQixnQkFBTjtBQUlBLFVBQUlvQixrQkFBa0JFLFlBQWxCLENBQStCUyxTQUFuQyxFQUE4QztBQUM1Q2xFLGVBQU9DLElBQVAsQ0FBWXNELGtCQUFrQkUsWUFBbEIsQ0FBK0JTLFNBQTNDLEVBQXNEaEUsT0FBdEQsQ0FBOEQsVUFBQ2lFLFdBQUQsRUFBaUI7QUFDN0VILHFCQUFXRyxXQUFYLElBQTBCWixrQkFBa0JFLFlBQWxCLENBQStCUyxTQUEvQixDQUF5Q0MsV0FBekMsRUFBc0RDLEtBQWhGO0FBQ0QsU0FGRDtBQUdEO0FBQ0QsYUFBTzNELG1CQUFtQixLQUFLMUIsS0FBTCxFQUFZd0Usa0JBQWtCRSxZQUFsQixDQUErQmIsS0FBM0MsQ0FBbkIsRUFBc0VvQixVQUF0RSxFQUFrRlMsTUFBbEYsR0FDTnZDLElBRE0sQ0FDRDtBQUFBLGVBQU0sT0FBS2tCLFlBQUwsQ0FBa0JYLElBQWxCLEVBQXdCTixFQUF4QixFQUE0QixJQUE1QixFQUFrQ21CLGlCQUFsQyxDQUFOO0FBQUEsT0FEQyxDQUFQO0FBRUQ7OzswQkFFSzNDLEMsRUFBRztBQUNQLGFBQU8sbUJBQVNzQixPQUFULENBQWlCLEtBQUtsRCxLQUFMLEVBQVkrRixHQUFaLENBQWdCbkUsRUFBRXpCLEtBQWxCLENBQWpCLEVBQ05nRCxJQURNLENBQ0QsVUFBQzZDLENBQUQ7QUFBQSxlQUFPQSxFQUFFQyxJQUFUO0FBQUEsT0FEQyxDQUFQO0FBRUQiLCJmaWxlIjoic3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJsdWViaXJkIGZyb20gJ2JsdWViaXJkJztcbmltcG9ydCBrbmV4IGZyb20gJ2tuZXgnO1xuaW1wb3J0IHsgU3RvcmFnZSB9IGZyb20gJ3BsdW1wJztcbmltcG9ydCB7IGJsb2NrUmVhZCB9IGZyb20gJy4vYmxvY2tSZWFkJztcbmNvbnN0ICRrbmV4ID0gU3ltYm9sKCcka25leCcpO1xuXG5mdW5jdGlvbiBkZXNlcmlhbGl6ZVdoZXJlKHF1ZXJ5LCBibG9jaykge1xuICBjb25zdCBjYXIgPSBibG9ja1swXTtcbiAgY29uc3QgY2RyID0gYmxvY2suc2xpY2UoMSk7XG4gIGlmIChBcnJheS5pc0FycmF5KGNkclswXSkpIHtcbiAgICByZXR1cm4gY2RyLnJlZHVjZSgoc3ViUXVlcnksIHN1YkJsb2NrKSA9PiBkZXNlcmlhbGl6ZVdoZXJlKHN1YlF1ZXJ5LCBzdWJCbG9jayksIHF1ZXJ5KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcXVlcnlbY2FyXS5hcHBseShxdWVyeSwgY2RyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaXhDYXNlKGRhdGEsIHNjaGVtYSkge1xuICBPYmplY3Qua2V5cyhzY2hlbWEpLmZvckVhY2goKGtleSkgPT4ge1xuICAgIGlmICgoa2V5LnRvTG93ZXJDYXNlKCkgIT09IGtleSkgJiYgKGRhdGFba2V5LnRvTG93ZXJDYXNlKCldKSkge1xuICAgICAgZGF0YVtrZXldID0gZGF0YVtrZXkudG9Mb3dlckNhc2UoKV07IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgICAgIGRlbGV0ZSBkYXRhW2tleS50b0xvd2VyQ2FzZSgpXTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1wYXJhbS1yZWFzc2lnblxuICAgIH1cbiAgfSk7XG4gIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcbiAgcmV0dXJuIGRhdGE7XG59XG5cbmZ1bmN0aW9uIG9iamVjdFRvV2hlcmVDaGFpbihxdWVyeSwgYmxvY2ssIGNvbnRleHQpIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKGJsb2NrKS5yZWR1Y2UoKHEsIGtleSkgPT4ge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGJsb2NrW2tleV0pKSB7XG4gICAgICByZXR1cm4gZGVzZXJpYWxpemVXaGVyZShxdWVyeSwgU3RvcmFnZS5tYXNzUmVwbGFjZShibG9ja1trZXldLCBjb250ZXh0KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBxLndoZXJlKGtleSwgYmxvY2tba2V5XSk7XG4gICAgfVxuICB9LCBxdWVyeSk7XG59XG5cblxuZXhwb3J0IGNsYXNzIFBHU3RvcmUgZXh0ZW5kcyBTdG9yYWdlIHtcbiAgY29uc3RydWN0b3Iob3B0cyA9IHt9KSB7XG4gICAgc3VwZXIob3B0cyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgY2xpZW50OiAncG9zdGdyZXMnLFxuICAgICAgICBkZWJ1ZzogZmFsc2UsXG4gICAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgICB1c2VyOiAncG9zdGdyZXMnLFxuICAgICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICAgICAgcGFzc3dvcmQ6ICcnLFxuICAgICAgICAgIGNoYXJzZXQ6ICd1dGY4JyxcbiAgICAgICAgfSxcbiAgICAgICAgcG9vbDoge1xuICAgICAgICAgIG1heDogMjAsXG4gICAgICAgICAgbWluOiAwLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG9wdHMuc3FsXG4gICAgKTtcbiAgICB0aGlzWyRrbmV4XSA9IGtuZXgob3B0aW9ucyk7XG4gIH1cblxuICAvKlxuICAgIG5vdGUgdGhhdCBrbmV4LmpzIFwidGhlblwiIGZ1bmN0aW9ucyBhcmVuJ3QgYWN0dWFsbHkgcHJvbWlzZXMgdGhlIHdheSB5b3UgdGhpbmsgdGhleSBhcmUuXG4gICAgeW91IGNhbiByZXR1cm4ga25leC5pbnNlcnQoKS5pbnRvKCksIHdoaWNoIGhhcyBhIHRoZW4oKSBvbiBpdCwgYnV0IHRoYXQgdGhlbmFibGUgaXNuJ3RcbiAgICBhbiBhY3R1YWwgcHJvbWlzZSB5ZXQuIFNvIGluc3RlYWQgd2UncmUgcmV0dXJuaW5nIEJsdWViaXJkLnJlc29sdmUodGhlbmFibGUpO1xuICAqL1xuXG4gIHRlYXJkb3duKCkge1xuICAgIHJldHVybiB0aGlzWyRrbmV4XS5kZXN0cm95KCk7XG4gIH1cblxuICB3cml0ZSh0LCB2KSB7XG4gICAgcmV0dXJuIEJsdWViaXJkLnJlc29sdmUoKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIGRlYnVnZ2VyO1xuICAgICAgY29uc3QgaWQgPSB2W3QuJGlkXTtcbiAgICAgIGNvbnN0IHVwZGF0ZU9iamVjdCA9IHt9O1xuICAgICAgT2JqZWN0LmtleXModC4kZmllbGRzKS5mb3JFYWNoKChmaWVsZE5hbWUpID0+IHtcbiAgICAgICAgaWYgKHZbZmllbGROYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gY29weSBmcm9tIHYgdG8gdGhlIGJlc3Qgb2Ygb3VyIGFiaWxpdHlcbiAgICAgICAgICBpZiAodC4kZmllbGRzW2ZpZWxkTmFtZV0udHlwZSA9PT0gJ2FycmF5Jykge1xuICAgICAgICAgICAgdXBkYXRlT2JqZWN0W2ZpZWxkTmFtZV0gPSB2W2ZpZWxkTmFtZV0uY29uY2F0KCk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0LiRmaWVsZHNbZmllbGROYW1lXS50eXBlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdXBkYXRlT2JqZWN0W2ZpZWxkTmFtZV0gPSBPYmplY3QuYXNzaWduKHt9LCB2W2ZpZWxkTmFtZV0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAodC4kZmllbGRzW2ZpZWxkTmFtZV0udHlwZSAhPT0gJ2hhc01hbnknKSB7XG4gICAgICAgICAgICB1cGRhdGVPYmplY3RbZmllbGROYW1lXSA9IHZbZmllbGROYW1lXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKChpZCA9PT0gdW5kZWZpbmVkKSAmJiAodGhpcy50ZXJtaW5hbCkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLmluc2VydCh1cGRhdGVPYmplY3QpLnJldHVybmluZyh0LiRpZClcbiAgICAgICAgLnRoZW4oKGNyZWF0ZWRJZCkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlYWQodCwgY3JlYXRlZElkWzBdKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGlkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLndoZXJlKHsgW3QuJGlkXTogaWQgfSkudXBkYXRlKHVwZGF0ZU9iamVjdClcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlYWQodCwgaWQpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNyZWF0ZSBuZXcgY29udGVudCBpbiBhIG5vbi10ZXJtaW5hbCBzdG9yZScpO1xuICAgICAgfVxuICAgIH0pLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubm90aWZ5VXBkYXRlKHQsIHJlc3VsdFt0LiRpZF0sIHJlc3VsdCkudGhlbigoKSA9PiByZXN1bHQpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVhZE9uZSh0LCBpZCkge1xuICAgIHJldHVybiBibG9ja1JlYWQodCwgdGhpc1ska25leF0sIHsgW3QuJGlkXTogaWQgfSlcbiAgICAvLyByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkud2hlcmUoeyBbdC4kaWRdOiBpZCB9KS5zZWxlY3QoKVxuICAgIC50aGVuKChvKSA9PiB7XG4gICAgICBpZiAob1swXSkge1xuICAgICAgICByZXR1cm4gZml4Q2FzZShvWzBdLCB0LiRmaWVsZHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICByZWFkTWFueSh0eXBlLCBpZCwgcmVsYXRpb25zaGlwVGl0bGUpIHtcbiAgICBjb25zdCByZWxhdGlvbnNoaXBCbG9jayA9IHR5cGUuJGZpZWxkc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHNpZGVzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBsZXQgdG9TZWxlY3QgPSBbc2lkZUluZm8ub3RoZXIuZmllbGQsIHNpZGVJbmZvLnNlbGYuZmllbGRdO1xuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJGV4dHJhcykge1xuICAgICAgdG9TZWxlY3QgPSB0b1NlbGVjdC5jb25jYXQoT2JqZWN0LmtleXMocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRleHRyYXMpKTtcbiAgICB9XG4gICAgY29uc3Qgd2hlcmVCbG9jayA9IHt9O1xuICAgIGlmIChzaWRlSW5mby5zZWxmLnF1ZXJ5KSB7XG4gICAgICB3aGVyZUJsb2NrW3NpZGVJbmZvLnNlbGYuZmllbGRdID0gc2lkZUluZm8uc2VsZi5xdWVyeS5sb2dpYztcbiAgICB9IGVsc2Uge1xuICAgICAgd2hlcmVCbG9ja1tzaWRlSW5mby5zZWxmLmZpZWxkXSA9IGlkO1xuICAgIH1cbiAgICBpZiAocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRyZXN0cmljdCkge1xuICAgICAgT2JqZWN0LmtleXMocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRyZXN0cmljdCkuZm9yRWFjaCgocmVzdHJpY3Rpb24pID0+IHtcbiAgICAgICAgd2hlcmVCbG9ja1tyZXN0cmljdGlvbl0gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0W3Jlc3RyaWN0aW9uXS52YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKHNpZGVJbmZvLnNlbGYucXVlcnkgJiYgc2lkZUluZm8uc2VsZi5xdWVyeS5yZXF1aXJlTG9hZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZWFkT25lKHR5cGUsIGlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7IGlkIH07XG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbigoY29udGV4dCkgPT4ge1xuICAgICAgcmV0dXJuIG9iamVjdFRvV2hlcmVDaGFpbih0aGlzWyRrbmV4XShyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJG5hbWUpLCB3aGVyZUJsb2NrLCBjb250ZXh0KVxuICAgICAgLnNlbGVjdCh0b1NlbGVjdCk7XG4gICAgfSlcbiAgICAudGhlbigobCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgW3JlbGF0aW9uc2hpcFRpdGxlXTogbCxcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGUodCwgaWQpIHtcbiAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkud2hlcmUoeyBbdC4kaWRdOiBpZCB9KS5kZWxldGUoKVxuICAgIC50aGVuKChvKSA9PiBvKTtcbiAgfVxuXG4gIGFkZCh0eXBlLCBpZCwgcmVsYXRpb25zaGlwVGl0bGUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRmaWVsZHNbcmVsYXRpb25zaGlwVGl0bGVdO1xuICAgIGNvbnN0IHNpZGVJbmZvID0gcmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3QgbmV3RmllbGQgPSB7XG4gICAgICBbc2lkZUluZm8ub3RoZXIuZmllbGRdOiBjaGlsZElkLFxuICAgICAgW3NpZGVJbmZvLnNlbGYuZmllbGRdOiBpZCxcbiAgICB9O1xuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KS5mb3JFYWNoKChyZXN0cmljdGlvbikgPT4ge1xuICAgICAgICBuZXdGaWVsZFtyZXN0cmljdGlvbl0gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0W3Jlc3RyaWN0aW9uXS52YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRleHRyYXMpIHtcbiAgICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kZXh0cmFzKS5mb3JFYWNoKChleHRyYSkgPT4ge1xuICAgICAgICBuZXdGaWVsZFtleHRyYV0gPSBleHRyYXNbZXh0cmFdO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzWyRrbmV4XShyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJG5hbWUpXG4gICAgLmluc2VydChuZXdGaWVsZClcbiAgICAudGhlbigoKSA9PiB0aGlzLm5vdGlmeVVwZGF0ZSh0eXBlLCBpZCwgbnVsbCwgcmVsYXRpb25zaGlwVGl0bGUpKTtcbiAgfVxuXG4gIG1vZGlmeVJlbGF0aW9uc2hpcCh0eXBlLCBpZCwgcmVsYXRpb25zaGlwVGl0bGUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRmaWVsZHNbcmVsYXRpb25zaGlwVGl0bGVdO1xuICAgIGNvbnN0IHNpZGVJbmZvID0gcmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3QgbmV3RmllbGQgPSB7fTtcbiAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJGV4dHJhcykuZm9yRWFjaCgoZXh0cmEpID0+IHtcbiAgICAgIGlmIChleHRyYXNbZXh0cmFdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbmV3RmllbGRbZXh0cmFdID0gZXh0cmFzW2V4dHJhXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCB3aGVyZUJsb2NrID0ge1xuICAgICAgW3NpZGVJbmZvLm90aGVyLmZpZWxkXTogY2hpbGRJZCxcbiAgICAgIFtzaWRlSW5mby5zZWxmLmZpZWxkXTogaWQsXG4gICAgfTtcbiAgICBpZiAocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRyZXN0cmljdCkge1xuICAgICAgT2JqZWN0LmtleXMocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRyZXN0cmljdCkuZm9yRWFjaCgocmVzdHJpY3Rpb24pID0+IHtcbiAgICAgICAgd2hlcmVCbG9ja1tyZXN0cmljdGlvbl0gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0W3Jlc3RyaWN0aW9uXS52YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0VG9XaGVyZUNoYWluKHRoaXNbJGtuZXhdKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kbmFtZSksIHdoZXJlQmxvY2ssIHsgaWQsIGNoaWxkSWQgfSlcbiAgICAudXBkYXRlKG5ld0ZpZWxkKVxuICAgIC50aGVuKCgpID0+IHRoaXMubm90aWZ5VXBkYXRlKHR5cGUsIGlkLCBudWxsLCByZWxhdGlvbnNoaXBUaXRsZSkpO1xuICB9XG5cbiAgcmVtb3ZlKHR5cGUsIGlkLCByZWxhdGlvbnNoaXBUaXRsZSwgY2hpbGRJZCkge1xuICAgIGNvbnN0IHJlbGF0aW9uc2hpcEJsb2NrID0gdHlwZS4kZmllbGRzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBjb25zdCBzaWRlSW5mbyA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kc2lkZXNbcmVsYXRpb25zaGlwVGl0bGVdO1xuICAgIGNvbnN0IHdoZXJlQmxvY2sgPSB7XG4gICAgICBbc2lkZUluZm8ub3RoZXIuZmllbGRdOiBjaGlsZElkLFxuICAgICAgW3NpZGVJbmZvLnNlbGYuZmllbGRdOiBpZCxcbiAgICB9O1xuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KS5mb3JFYWNoKChyZXN0cmljdGlvbikgPT4ge1xuICAgICAgICB3aGVyZUJsb2NrW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RUb1doZXJlQ2hhaW4odGhpc1ska25leF0ocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRuYW1lKSwgd2hlcmVCbG9jaykuZGVsZXRlKClcbiAgICAudGhlbigoKSA9PiB0aGlzLm5vdGlmeVVwZGF0ZSh0eXBlLCBpZCwgbnVsbCwgcmVsYXRpb25zaGlwVGl0bGUpKTtcbiAgfVxuXG4gIHF1ZXJ5KHEpIHtcbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSh0aGlzWyRrbmV4XS5yYXcocS5xdWVyeSkpXG4gICAgLnRoZW4oKGQpID0+IGQucm93cyk7XG4gIH1cbn1cbiJdfQ==
