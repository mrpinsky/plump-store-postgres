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

function fixCase(data, schema) {
  Object.keys(schema).forEach(function (key) {
    if (key.toLowerCase() !== key && data[key.toLowerCase()]) {
      data[key] = data[key.toLowerCase()]; // eslint-disable-line no-param-reassign
      delete data[key.toLowerCase()]; // eslint-disable-line no-param-reassign
    }
  });
  return data;
}

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNxbC5qcyJdLCJuYW1lcyI6WyIka25leCIsIlN5bWJvbCIsImZpeENhc2UiLCJkYXRhIiwic2NoZW1hIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJrZXkiLCJ0b0xvd2VyQ2FzZSIsImRlc2VyaWFsaXplV2hlcmUiLCJxdWVyeSIsImJsb2NrIiwiY2FyIiwiY2RyIiwic2xpY2UiLCJBcnJheSIsImlzQXJyYXkiLCJyZWR1Y2UiLCJzdWJRdWVyeSIsInN1YkJsb2NrIiwiYXBwbHkiLCJvYmplY3RUb1doZXJlQ2hhaW4iLCJjb250ZXh0IiwicSIsIm1hc3NSZXBsYWNlIiwid2hlcmUiLCJQR1N0b3JlIiwib3B0cyIsIm9wdGlvbnMiLCJhc3NpZ24iLCJjbGllbnQiLCJkZWJ1ZyIsImNvbm5lY3Rpb24iLCJ1c2VyIiwiaG9zdCIsInBvcnQiLCJwYXNzd29yZCIsImNoYXJzZXQiLCJwb29sIiwibWF4IiwibWluIiwic3FsIiwiZGVzdHJveSIsInQiLCJ2IiwicmVzb2x2ZSIsInRoZW4iLCJpZCIsIiRpZCIsInVwZGF0ZU9iamVjdCIsIiRmaWVsZHMiLCJmaWVsZE5hbWUiLCJ1bmRlZmluZWQiLCJ0eXBlIiwiY29uY2F0IiwidGVybWluYWwiLCIkbmFtZSIsImluc2VydCIsInJldHVybmluZyIsImNyZWF0ZWRJZCIsInJlYWQiLCJ1cGRhdGUiLCJFcnJvciIsInJlc3VsdCIsIm5vdGlmeVVwZGF0ZSIsIm8iLCJyZWxhdGlvbnNoaXBUaXRsZSIsInJlbGF0aW9uc2hpcEJsb2NrIiwic2lkZUluZm8iLCJyZWxhdGlvbnNoaXAiLCIkc2lkZXMiLCJ0b1NlbGVjdCIsIm90aGVyIiwiZmllbGQiLCJzZWxmIiwiJGV4dHJhcyIsIndoZXJlQmxvY2siLCJsb2dpYyIsIiRyZXN0cmljdCIsInJlc3RyaWN0aW9uIiwidmFsdWUiLCJyZXF1aXJlTG9hZCIsInJlYWRPbmUiLCJzZWxlY3QiLCJsIiwiZGVsZXRlIiwiY2hpbGRJZCIsImV4dHJhcyIsIm5ld0ZpZWxkIiwi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LENBQVk4RCxrQkFBa0JFLFlBQWxCLENBQStCUyxTQUEzQyxFQUFzRHhFLE9BQXRELENBQThELFVBQUN5RSxXQUFELEVBQWlCO0FBQzdFSCxxQkFBV0csV0FBWCxJQUEwQlosa0JBQWtCRSxZQUFsQixDQUErQlMsU0FBL0IsQ0FBeUNDLFdBQXpDLEVBQXNEQyxLQUFoRjtBQUNELFNBRkQ7QUFHRDtBQUNELGFBQU8zRCxtQkFBbUIsS0FBS3RCLEtBQUwsRUFBWW9FLGtCQUFrQkUsWUFBbEIsQ0FBK0JiLEtBQTNDLENBQW5CLEVBQXNFb0IsVUFBdEUsRUFBa0ZTLE1BQWxGLEdBQ052QyxJQURNLENBQ0Q7QUFBQSxlQUFNLE9BQUtrQixZQUFMLENBQWtCWCxJQUFsQixFQUF3Qk4sRUFBeEIsRUFBNEIsSUFBNUIsRUFBa0NtQixpQkFBbEMsQ0FBTjtBQUFBLE9BREMsQ0FBUDtBQUVEOzs7MEJBRUszQyxDLEVBQUc7QUFDUCxhQUFPLG1CQUFTc0IsT0FBVCxDQUFpQixLQUFLOUMsS0FBTCxFQUFZMkYsR0FBWixDQUFnQm5FLEVBQUViLEtBQWxCLENBQWpCLEVBQ05vQyxJQURNLENBQ0QsVUFBQzZDLENBQUQ7QUFBQSxlQUFPQSxFQUFFQyxJQUFUO0FBQUEsT0FEQyxDQUFQO0FBRUQiLCJmaWxlIjoic3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJsdWViaXJkIGZyb20gJ2JsdWViaXJkJztcbmltcG9ydCBrbmV4IGZyb20gJ2tuZXgnO1xuaW1wb3J0IHsgU3RvcmFnZSB9IGZyb20gJ3BsdW1wJztcbmltcG9ydCB7IGJsb2NrUmVhZCB9IGZyb20gJy4vYmxvY2tSZWFkJztcbmNvbnN0ICRrbmV4ID0gU3ltYm9sKCcka25leCcpO1xuXG5mdW5jdGlvbiBmaXhDYXNlKGRhdGEsIHNjaGVtYSkge1xuICBPYmplY3Qua2V5cyhzY2hlbWEpLmZvckVhY2goKGtleSkgPT4ge1xuICAgIGlmICgoa2V5LnRvTG93ZXJDYXNlKCkgIT09IGtleSkgJiYgKGRhdGFba2V5LnRvTG93ZXJDYXNlKCldKSkge1xuICAgICAgZGF0YVtrZXldID0gZGF0YVtrZXkudG9Mb3dlckNhc2UoKV07IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgICAgIGRlbGV0ZSBkYXRhW2tleS50b0xvd2VyQ2FzZSgpXTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1wYXJhbS1yZWFzc2lnblxuICAgIH1cbiAgfSk7XG4gIHJldHVybiBkYXRhO1xufVxuXG5mdW5jdGlvbiBkZXNlcmlhbGl6ZVdoZXJlKHF1ZXJ5LCBibG9jaykge1xuICBjb25zdCBjYXIgPSBibG9ja1swXTtcbiAgY29uc3QgY2RyID0gYmxvY2suc2xpY2UoMSk7XG4gIGlmIChBcnJheS5pc0FycmF5KGNkclswXSkpIHtcbiAgICByZXR1cm4gY2RyLnJlZHVjZSgoc3ViUXVlcnksIHN1YkJsb2NrKSA9PiBkZXNlcmlhbGl6ZVdoZXJlKHN1YlF1ZXJ5LCBzdWJCbG9jayksIHF1ZXJ5KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcXVlcnlbY2FyXS5hcHBseShxdWVyeSwgY2RyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvYmplY3RUb1doZXJlQ2hhaW4ocXVlcnksIGJsb2NrLCBjb250ZXh0KSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhibG9jaykucmVkdWNlKChxLCBrZXkpID0+IHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShibG9ja1trZXldKSkge1xuICAgICAgcmV0dXJuIGRlc2VyaWFsaXplV2hlcmUocXVlcnksIFN0b3JhZ2UubWFzc1JlcGxhY2UoYmxvY2tba2V5XSwgY29udGV4dCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcS53aGVyZShrZXksIGJsb2NrW2tleV0pO1xuICAgIH1cbiAgfSwgcXVlcnkpO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBQR1N0b3JlIGV4dGVuZHMgU3RvcmFnZSB7XG4gIGNvbnN0cnVjdG9yKG9wdHMgPSB7fSkge1xuICAgIHN1cGVyKG9wdHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGNsaWVudDogJ3Bvc3RncmVzJyxcbiAgICAgICAgZGVidWc6IGZhbHNlLFxuICAgICAgICBjb25uZWN0aW9uOiB7XG4gICAgICAgICAgdXNlcjogJ3Bvc3RncmVzJyxcbiAgICAgICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgICAgICBwb3J0OiA1NDMyLFxuICAgICAgICAgIHBhc3N3b3JkOiAnJyxcbiAgICAgICAgICBjaGFyc2V0OiAndXRmOCcsXG4gICAgICAgIH0sXG4gICAgICAgIHBvb2w6IHtcbiAgICAgICAgICBtYXg6IDIwLFxuICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvcHRzLnNxbFxuICAgICk7XG4gICAgdGhpc1ska25leF0gPSBrbmV4KG9wdGlvbnMpO1xuICB9XG5cbiAgLypcbiAgICBub3RlIHRoYXQga25leC5qcyBcInRoZW5cIiBmdW5jdGlvbnMgYXJlbid0IGFjdHVhbGx5IHByb21pc2VzIHRoZSB3YXkgeW91IHRoaW5rIHRoZXkgYXJlLlxuICAgIHlvdSBjYW4gcmV0dXJuIGtuZXguaW5zZXJ0KCkuaW50bygpLCB3aGljaCBoYXMgYSB0aGVuKCkgb24gaXQsIGJ1dCB0aGF0IHRoZW5hYmxlIGlzbid0XG4gICAgYW4gYWN0dWFsIHByb21pc2UgeWV0LiBTbyBpbnN0ZWFkIHdlJ3JlIHJldHVybmluZyBCbHVlYmlyZC5yZXNvbHZlKHRoZW5hYmxlKTtcbiAgKi9cblxuICB0ZWFyZG93bigpIHtcbiAgICByZXR1cm4gdGhpc1ska25leF0uZGVzdHJveSgpO1xuICB9XG5cbiAgd3JpdGUodCwgdikge1xuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICBjb25zdCBpZCA9IHZbdC4kaWRdO1xuICAgICAgY29uc3QgdXBkYXRlT2JqZWN0ID0ge307XG4gICAgICBPYmplY3Qua2V5cyh0LiRmaWVsZHMpLmZvckVhY2goKGZpZWxkTmFtZSkgPT4ge1xuICAgICAgICBpZiAodltmaWVsZE5hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAvLyBjb3B5IGZyb20gdiB0byB0aGUgYmVzdCBvZiBvdXIgYWJpbGl0eVxuICAgICAgICAgIGlmICh0LiRmaWVsZHNbZmllbGROYW1lXS50eXBlID09PSAnYXJyYXknKSB7XG4gICAgICAgICAgICB1cGRhdGVPYmplY3RbZmllbGROYW1lXSA9IHZbZmllbGROYW1lXS5jb25jYXQoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHQuJGZpZWxkc1tmaWVsZE5hbWVdLnR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB1cGRhdGVPYmplY3RbZmllbGROYW1lXSA9IE9iamVjdC5hc3NpZ24oe30sIHZbZmllbGROYW1lXSk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0LiRmaWVsZHNbZmllbGROYW1lXS50eXBlICE9PSAnaGFzTWFueScpIHtcbiAgICAgICAgICAgIHVwZGF0ZU9iamVjdFtmaWVsZE5hbWVdID0gdltmaWVsZE5hbWVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoKGlkID09PSB1bmRlZmluZWQpICYmICh0aGlzLnRlcm1pbmFsKSkge1xuICAgICAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkuaW5zZXJ0KHVwZGF0ZU9iamVjdCkucmV0dXJuaW5nKHQuJGlkKVxuICAgICAgICAudGhlbigoY3JlYXRlZElkKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZCh0LCBjcmVhdGVkSWRbMF0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkud2hlcmUoeyBbdC4kaWRdOiBpZCB9KS51cGRhdGUodXBkYXRlT2JqZWN0KVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZCh0LCBpZCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY3JlYXRlIG5ldyBjb250ZW50IGluIGEgbm9uLXRlcm1pbmFsIHN0b3JlJyk7XG4gICAgICB9XG4gICAgfSkudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5ub3RpZnlVcGRhdGUodCwgcmVzdWx0W3QuJGlkXSwgcmVzdWx0KS50aGVuKCgpID0+IHJlc3VsdCk7XG4gICAgfSk7XG4gIH1cblxuICByZWFkT25lKHQsIGlkKSB7XG4gICAgcmV0dXJuIGJsb2NrUmVhZCh0LCB0aGlzWyRrbmV4XSwgeyBbdC4kaWRdOiBpZCB9KVxuICAgIC8vIHJldHVybiB0aGlzWyRrbmV4XSh0LiRuYW1lKS53aGVyZSh7IFt0LiRpZF06IGlkIH0pLnNlbGVjdCgpXG4gICAgLnRoZW4oKG8pID0+IHtcbiAgICAgIGlmIChvWzBdKSB7XG4gICAgICAgIHJldHVybiBmaXhDYXNlKG9bMF0sIHQuJGZpZWxkcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHJlYWRNYW55KHR5cGUsIGlkLCByZWxhdGlvbnNoaXBUaXRsZSkge1xuICAgIGNvbnN0IHJlbGF0aW9uc2hpcEJsb2NrID0gdHlwZS4kZmllbGRzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBjb25zdCBzaWRlSW5mbyA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kc2lkZXNbcmVsYXRpb25zaGlwVGl0bGVdO1xuICAgIGxldCB0b1NlbGVjdCA9IFtzaWRlSW5mby5vdGhlci5maWVsZCwgc2lkZUluZm8uc2VsZi5maWVsZF07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kZXh0cmFzKSB7XG4gICAgICB0b1NlbGVjdCA9IHRvU2VsZWN0LmNvbmNhdChPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJGV4dHJhcykpO1xuICAgIH1cbiAgICBjb25zdCB3aGVyZUJsb2NrID0ge307XG4gICAgaWYgKHNpZGVJbmZvLnNlbGYucXVlcnkpIHtcbiAgICAgIHdoZXJlQmxvY2tbc2lkZUluZm8uc2VsZi5maWVsZF0gPSBzaWRlSW5mby5zZWxmLnF1ZXJ5LmxvZ2ljO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aGVyZUJsb2NrW3NpZGVJbmZvLnNlbGYuZmllbGRdID0gaWQ7XG4gICAgfVxuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KS5mb3JFYWNoKChyZXN0cmljdGlvbikgPT4ge1xuICAgICAgICB3aGVyZUJsb2NrW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICBpZiAoc2lkZUluZm8uc2VsZi5xdWVyeSAmJiBzaWRlSW5mby5zZWxmLnF1ZXJ5LnJlcXVpcmVMb2FkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlYWRPbmUodHlwZSwgaWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHsgaWQgfTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC50aGVuKChjb250ZXh0KSA9PiB7XG4gICAgICByZXR1cm4gb2JqZWN0VG9XaGVyZUNoYWluKHRoaXNbJGtuZXhdKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kbmFtZSksIHdoZXJlQmxvY2ssIGNvbnRleHQpXG4gICAgICAuc2VsZWN0KHRvU2VsZWN0KTtcbiAgICB9KVxuICAgIC50aGVuKChsKSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBbcmVsYXRpb25zaGlwVGl0bGVdOiBsLFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh0LCBpZCkge1xuICAgIHJldHVybiB0aGlzWyRrbmV4XSh0LiRuYW1lKS53aGVyZSh7IFt0LiRpZF06IGlkIH0pLmRlbGV0ZSgpXG4gICAgLnRoZW4oKG8pID0+IG8pO1xuICB9XG5cbiAgYWRkKHR5cGUsIGlkLCByZWxhdGlvbnNoaXBUaXRsZSwgY2hpbGRJZCwgZXh0cmFzID0ge30pIHtcbiAgICBjb25zdCByZWxhdGlvbnNoaXBCbG9jayA9IHR5cGUuJGZpZWxkc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHNpZGVzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBjb25zdCBuZXdGaWVsZCA9IHtcbiAgICAgIFtzaWRlSW5mby5vdGhlci5maWVsZF06IGNoaWxkSWQsXG4gICAgICBbc2lkZUluZm8uc2VsZi5maWVsZF06IGlkLFxuICAgIH07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpIHtcbiAgICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpLmZvckVhY2goKHJlc3RyaWN0aW9uKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJGV4dHJhcykge1xuICAgICAgT2JqZWN0LmtleXMocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kbmFtZSlcbiAgICAuaW5zZXJ0KG5ld0ZpZWxkKVxuICAgIC50aGVuKCgpID0+IHRoaXMubm90aWZ5VXBkYXRlKHR5cGUsIGlkLCBudWxsLCByZWxhdGlvbnNoaXBUaXRsZSkpO1xuICB9XG5cbiAgbW9kaWZ5UmVsYXRpb25zaGlwKHR5cGUsIGlkLCByZWxhdGlvbnNoaXBUaXRsZSwgY2hpbGRJZCwgZXh0cmFzID0ge30pIHtcbiAgICBjb25zdCByZWxhdGlvbnNoaXBCbG9jayA9IHR5cGUuJGZpZWxkc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHNpZGVzW3JlbGF0aW9uc2hpcFRpdGxlXTtcbiAgICBjb25zdCBuZXdGaWVsZCA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kZXh0cmFzKS5mb3JFYWNoKChleHRyYSkgPT4ge1xuICAgICAgaWYgKGV4dHJhc1tleHRyYV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBuZXdGaWVsZFtleHRyYV0gPSBleHRyYXNbZXh0cmFdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IHdoZXJlQmxvY2sgPSB7XG4gICAgICBbc2lkZUluZm8ub3RoZXIuZmllbGRdOiBjaGlsZElkLFxuICAgICAgW3NpZGVJbmZvLnNlbGYuZmllbGRdOiBpZCxcbiAgICB9O1xuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJHJlc3RyaWN0KS5mb3JFYWNoKChyZXN0cmljdGlvbikgPT4ge1xuICAgICAgICB3aGVyZUJsb2NrW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RUb1doZXJlQ2hhaW4odGhpc1ska25leF0ocmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRuYW1lKSwgd2hlcmVCbG9jaywgeyBpZCwgY2hpbGRJZCB9KVxuICAgIC51cGRhdGUobmV3RmllbGQpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbGF0aW9uc2hpcFRpdGxlKSk7XG4gIH1cblxuICByZW1vdmUodHlwZSwgaWQsIHJlbGF0aW9uc2hpcFRpdGxlLCBjaGlsZElkKSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRmaWVsZHNbcmVsYXRpb25zaGlwVGl0bGVdO1xuICAgIGNvbnN0IHNpZGVJbmZvID0gcmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgd2hlcmVCbG9jayA9IHtcbiAgICAgIFtzaWRlSW5mby5vdGhlci5maWVsZF06IGNoaWxkSWQsXG4gICAgICBbc2lkZUluZm8uc2VsZi5maWVsZF06IGlkLFxuICAgIH07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpIHtcbiAgICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnJlbGF0aW9uc2hpcC4kcmVzdHJpY3QpLmZvckVhY2goKHJlc3RyaWN0aW9uKSA9PiB7XG4gICAgICAgIHdoZXJlQmxvY2tbcmVzdHJpY3Rpb25dID0gcmVsYXRpb25zaGlwQmxvY2sucmVsYXRpb25zaGlwLiRyZXN0cmljdFtyZXN0cmljdGlvbl0udmFsdWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdFRvV2hlcmVDaGFpbih0aGlzWyRrbmV4XShyZWxhdGlvbnNoaXBCbG9jay5yZWxhdGlvbnNoaXAuJG5hbWUpLCB3aGVyZUJsb2NrKS5kZWxldGUoKVxuICAgIC50aGVuKCgpID0+IHRoaXMubm90aWZ5VXBkYXRlKHR5cGUsIGlkLCBudWxsLCByZWxhdGlvbnNoaXBUaXRsZSkpO1xuICB9XG5cbiAgcXVlcnkocSkge1xuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKHRoaXNbJGtuZXhdLnJhdyhxLnF1ZXJ5KSlcbiAgICAudGhlbigoZCkgPT4gZC5yb3dzKTtcbiAgfVxufVxuIl19
