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

var _queryString = require('./queryString');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var $knex = Symbol('$knex');

function rearrangeData(type, data) {
  var retVal = {
    type: type.$name,
    attributes: {},
    relationships: {},
    id: data[type.$schema.$id]
  };
  for (var attrName in type.$schema.attributes) {
    retVal.attributes[attrName] = data[attrName];
  }
  for (var relName in type.$schema.relationships) {
    retVal.relationships[relName] = data[relName];
  }
  return retVal;
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
    key: 'writeRelationships',
    value: function writeRelationships(t, v, id) {
      var _this2 = this;

      return _bluebird2.default.resolve().then(function () {
        return _bluebird2.default.all(Object.keys(t.$schema.relationships).map(function (relName) {
          if (v.relationships && v.relationships[relName] && v.relationships[relName].length > 0) {
            if (v.relationships[relName][0].op) {
              // deltas
              return _bluebird2.default.all(v.relationships[relName].map(function (delta) {
                if (delta.op === 'add') {
                  return _this2.add(t, id, relName, delta.data.id, delta.data.meta || {});
                } else if (delta.op === 'remove') {
                  return _this2.remove(t, id, relName, delta.data.id);
                } else if (delta.op === 'modify') {
                  return _this2.modifyRelationship(t, id, relName, delta.data.id);
                } else {
                  return null;
                }
              }));
            } else {
              // items rather than deltas
              return _bluebird2.default.all(v.relationships[relName].map(function (item) {
                return _this2.add(t, id, relName, item.id, item.meta || {});
              }));
            }
          } else {
            return null;
          }
        }));
      });
    }
  }, {
    key: 'writeAttributes',
    value: function writeAttributes(t, updateObject, id) {
      var _this3 = this;

      if (id === undefined && this.terminal) {
        return this[$knex](t.$name).insert(updateObject).returning(t.$schema.$id).then(function (createdId) {
          return _this3.read(t, createdId[0]);
        });
      } else if (id !== undefined) {
        return this[$knex](t.$name).where(_defineProperty({}, t.$schema.$id, id)).update(updateObject).then(function () {
          return _this3.read(t, id);
        });
      } else {
        throw new Error('Cannot create new content in a non-terminal store');
      }
    }
  }, {
    key: 'write',
    value: function write(t, v) {
      var _this4 = this;

      var id = v.id;
      var updateObject = {};
      for (var attrName in t.$schema.attributes) {
        if (v.attributes[attrName] !== undefined) {
          // copy from v to the best of our ability
          if (t.$schema.attributes[attrName].type === 'array') {
            updateObject[attrName] = v.attributes[attrName].concat();
          } else if (t.$schema.attributes[attrName].type === 'object') {
            updateObject[attrName] = Object.assign({}, v.attributes[attrName]);
          } else {
            updateObject[attrName] = v.attributes[attrName];
          }
        }
      }
      return this.writeAttributes(t, updateObject, id).then(function (r) {
        if (v.relationships) {
          return _this4.writeRelationships(t, v, r.id).then(function () {
            return r;
          });
        } else {
          return r;
        }
      }).then(function (result) {
        return _this4.notifyUpdate(t, result[t.$schema.$id], result).then(function () {
          return result;
        });
      });
    }
  }, {
    key: 'readAttributes',
    value: function readAttributes(t, id) {
      var query = t.cacheGet(this, 'readAttributes');
      if (query === undefined) {
        query = (0, _queryString.readQuery)(t);
        t.cacheSet(this, 'readAttributes', query);
      }
      return this[$knex].raw(query, id).then(function (o) {
        if (o.rows[0]) {
          return rearrangeData(t, o.rows[0]);
        } else {
          return null;
        }
      });
    }
  }, {
    key: 'bulkRead',
    value: function bulkRead(t, id) {
      var query = t.cacheGet(this, 'bulkRead');
      if (query === undefined) {
        query = (0, _queryString.bulkQuery)(t);
        t.cacheSet(this, 'bulkRead', query);
      }
      return this[$knex].raw(query, id).then(function (o) {
        if (o.rows[0]) {
          var arrangedArray = o.rows.map(function (row) {
            return rearrangeData(t, row);
          });
          var rootItem = arrangedArray.filter(function (it) {
            return it.id === id;
          })[0];
          return {
            data: rootItem,
            included: arrangedArray.filter(function (it) {
              return it.id !== id;
            })
          };
        } else {
          return null;
        }
      });
    }
  }, {
    key: 'readRelationship',
    value: function readRelationship(type, id, relName) {
      var rel = type.$schema.relationships[relName].type;
      var otherRelName = rel.$sides[relName].otherName;
      var sqlData = rel.$storeData.sql;
      var selectBase = '"' + rel.$name + '"."' + sqlData.joinFields[otherRelName] + '" as id';
      var selectExtras = '';
      if (rel.$extras) {
        selectExtras = ', jsonb_build_object(' + Object.keys(rel.$extras).map(function (extra) {
          return '\'' + extra + '\', "' + rel.$name + '"."' + extra + '"';
        }).join(', ') + ') as meta'; // eslint-disable-line max-len
      }

      return this[$knex](rel.$name).where(sqlData.joinFields[relName], id).select(this[$knex].raw('' + selectBase + selectExtras)).then(function (l) {
        return _defineProperty({}, relName, l);
      });
    }
  }, {
    key: 'delete',
    value: function _delete(t, id) {
      return this[$knex](t.$name).where(_defineProperty({}, t.$schema.$id, id)).delete().then(function (o) {
        return o;
      });
    }
  }, {
    key: 'add',
    value: function add(type, id, relName, childId) {
      var _newField,
          _this5 = this;

      var extras = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      var rel = type.$schema.relationships[relName].type;
      var otherRelName = rel.$sides[relName].otherName;
      var sqlData = rel.$storeData.sql;
      var newField = (_newField = {}, _defineProperty(_newField, sqlData.joinFields[otherRelName], childId), _defineProperty(_newField, sqlData.joinFields[relName], id), _newField);
      if (rel.$extras) {
        Object.keys(rel.$extras).forEach(function (extra) {
          newField[extra] = extras[extra];
        });
      }
      return this[$knex](rel.$name).insert(newField).then(function () {
        return _this5.notifyUpdate(type, id, null, relName);
      });
    }
  }, {
    key: 'modifyRelationship',
    value: function modifyRelationship(type, id, relName, childId) {
      var _$knex$where3,
          _this6 = this;

      var extras = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      var rel = type.$schema.relationships[relName].type;
      var otherRelName = rel.$sides[relName].otherName;
      var sqlData = rel.$storeData.sql;
      var newField = {};
      Object.keys(rel.$extras).forEach(function (extra) {
        if (extras[extra] !== undefined) {
          newField[extra] = extras[extra];
        }
      });
      return this[$knex](rel.$name).where((_$knex$where3 = {}, _defineProperty(_$knex$where3, sqlData.joinFields[otherRelName], childId), _defineProperty(_$knex$where3, sqlData.joinFields[relName], id), _$knex$where3)).update(newField).then(function () {
        return _this6.notifyUpdate(type, id, null, relName);
      });
    }
  }, {
    key: 'remove',
    value: function remove(type, id, relName, childId) {
      var _$knex$where4,
          _this7 = this;

      var rel = type.$schema.relationships[relName].type;
      var otherRelName = rel.$sides[relName].otherName;
      var sqlData = rel.$storeData.sql;
      return this[$knex](rel.$name).where((_$knex$where4 = {}, _defineProperty(_$knex$where4, sqlData.joinFields[otherRelName], childId), _defineProperty(_$knex$where4, sqlData.joinFields[relName], id), _$knex$where4)).delete().then(function () {
        return _this7.notifyUpdate(type, id, null, relName);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNxbC5qcyJdLCJuYW1lcyI6WyIka25leCIsIlN5bWJvbCIsInJlYXJyYW5nZURhdGEiLCJ0eXBlIiwiZGF0YSIsInJldFZhbCIsIiRuYW1lIiwiYXR0cmlidXRlcyIsInJlbGF0aW9uc2hpcHMiLCJpZCIsIiRzY2hlbWEiLCIkaWQiLCJhdHRyTmFtZSIsInJlbE5hbWUiLCJQR1N0b3JlIiwib3B0cyIsIm9wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGllbnQiLCJkZWJ1ZyIsImNvbm5lY3Rpb24iLCJ1c2VyIiwiaG9zdCIsInBvcnQiLCJwYXNzd29yZCIsImNoYXJzZXQiLCJwb29sIiwibWF4IiwibWluIiwic3FsIiwiZGVzdHJveSIsInQiLCJ2IiwicmVzb2x2ZSIsInRoZW4iLCJhbGwiLCJrZXlzIiwibWFwIiwibGVuZ3RoIiwib3AiLCJkZWx0YSIsImFkZCIsIm1ldGEiLCJyZW1vdmUiLCJtb2RpZnlSZWxhdGlvbnNoaXAiLCJpdGVtIiwidXBkYXRlT2JqZWN0IiwidW5kZWZpbmVkIiwidGVybWluYWwiLCJpbnNlcnQiLCJyZXR1cm5pbmciLCJjcmVhdGVkSWQiLCJyZWFkIiwid2hlcmUiLCJ1cGRhdGUiLCJFcnJvciIsImNvbmNhdCIsIndyaXRlQXR0cmlidXRlcyIsInIiLCJ3cml0ZVJlbGF0aW9uc2hpcHMiLCJyZXN1bHQiLCJub3RpZnlVcGRhdGUiLCJxdWVyeSIsImNhY2hlR2V0IiwiY2FjaGVTZXQiLCJyYXciLCJvIiwicm93cyIsImFycmFuZ2VkQXJyYXkiLCJyb3ciLCJyb290SXRlbSIsImZpbHRlciIsIml0IiwiaW5jbHVkZWQiLCJyZWwiLCJvdGhlclJlbE5hbWUiLCIkc2lkZXMiLCJvdGhlck5hbWUiLCJzcWxEYXRhIiwiJHN0b3JlRGF0YSIsInNlbGVjdEJhc2UiLCJqb2luRmllbGRzIiwic2VsZWN0RXh0cmFzIiwiJGV4dHJhcyIsImV4dHJhIiwiam9pbiIsInNlbGVjdCIsImwiLCJkZWxldGUiLCJjaGlsZElkIiwiZXh0cmFz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bUJyRSxPQUFuQixDQUhJLEVBRzBCSixFQUgxQixtQkFLTmdGLE1BTE0sR0FNTnRELElBTk0sQ0FNRDtBQUFBLGVBQU0sT0FBSzJCLFlBQUwsQ0FBa0IzRCxJQUFsQixFQUF3Qk0sRUFBeEIsRUFBNEIsSUFBNUIsRUFBa0NJLE9BQWxDLENBQU47QUFBQSxPQU5DLENBQVA7QUFPRDs7OzBCQUVLaUYsQyxFQUFHO0FBQ1AsYUFBTyxtQkFBUzVELE9BQVQsQ0FBaUIsS0FBS2xDLEtBQUwsRUFBWWtFLEdBQVosQ0FBZ0I0QixFQUFFL0IsS0FBbEIsQ0FBakIsRUFDTjVCLElBRE0sQ0FDRCxVQUFDNEQsQ0FBRDtBQUFBLGVBQU9BLEVBQUUzQixJQUFUO0FBQUEsT0FEQyxDQUFQO0FBRUQiLCJmaWxlIjoic3FsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJsdWViaXJkIGZyb20gJ2JsdWViaXJkJztcbmltcG9ydCBrbmV4IGZyb20gJ2tuZXgnO1xuaW1wb3J0IHsgU3RvcmFnZSB9IGZyb20gJ3BsdW1wJztcbmltcG9ydCB7IHJlYWRRdWVyeSwgYnVsa1F1ZXJ5IH0gZnJvbSAnLi9xdWVyeVN0cmluZyc7XG5jb25zdCAka25leCA9IFN5bWJvbCgnJGtuZXgnKTtcblxuZnVuY3Rpb24gcmVhcnJhbmdlRGF0YSh0eXBlLCBkYXRhKSB7XG4gIGNvbnN0IHJldFZhbCA9IHtcbiAgICB0eXBlOiB0eXBlLiRuYW1lLFxuICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgIHJlbGF0aW9uc2hpcHM6IHt9LFxuICAgIGlkOiBkYXRhW3R5cGUuJHNjaGVtYS4kaWRdLFxuICB9O1xuICBmb3IgKGNvbnN0IGF0dHJOYW1lIGluIHR5cGUuJHNjaGVtYS5hdHRyaWJ1dGVzKSB7XG4gICAgcmV0VmFsLmF0dHJpYnV0ZXNbYXR0ck5hbWVdID0gZGF0YVthdHRyTmFtZV07XG4gIH1cbiAgZm9yIChjb25zdCByZWxOYW1lIGluIHR5cGUuJHNjaGVtYS5yZWxhdGlvbnNoaXBzKSB7XG4gICAgcmV0VmFsLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0gPSBkYXRhW3JlbE5hbWVdO1xuICB9XG4gIHJldHVybiByZXRWYWw7XG59XG5cbmV4cG9ydCBjbGFzcyBQR1N0b3JlIGV4dGVuZHMgU3RvcmFnZSB7XG4gIGNvbnN0cnVjdG9yKG9wdHMgPSB7fSkge1xuICAgIHN1cGVyKG9wdHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGNsaWVudDogJ3Bvc3RncmVzJyxcbiAgICAgICAgZGVidWc6IGZhbHNlLFxuICAgICAgICBjb25uZWN0aW9uOiB7XG4gICAgICAgICAgdXNlcjogJ3Bvc3RncmVzJyxcbiAgICAgICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgICAgICBwb3J0OiA1NDMyLFxuICAgICAgICAgIHBhc3N3b3JkOiAnJyxcbiAgICAgICAgICBjaGFyc2V0OiAndXRmOCcsXG4gICAgICAgIH0sXG4gICAgICAgIHBvb2w6IHtcbiAgICAgICAgICBtYXg6IDIwLFxuICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvcHRzLnNxbFxuICAgICk7XG4gICAgdGhpc1ska25leF0gPSBrbmV4KG9wdGlvbnMpO1xuICB9XG5cbiAgLypcbiAgICBub3RlIHRoYXQga25leC5qcyBcInRoZW5cIiBmdW5jdGlvbnMgYXJlbid0IGFjdHVhbGx5IHByb21pc2VzIHRoZSB3YXkgeW91IHRoaW5rIHRoZXkgYXJlLlxuICAgIHlvdSBjYW4gcmV0dXJuIGtuZXguaW5zZXJ0KCkuaW50bygpLCB3aGljaCBoYXMgYSB0aGVuKCkgb24gaXQsIGJ1dCB0aGF0IHRoZW5hYmxlIGlzbid0XG4gICAgYW4gYWN0dWFsIHByb21pc2UgeWV0LiBTbyBpbnN0ZWFkIHdlJ3JlIHJldHVybmluZyBCbHVlYmlyZC5yZXNvbHZlKHRoZW5hYmxlKTtcbiAgKi9cblxuICB0ZWFyZG93bigpIHtcbiAgICByZXR1cm4gdGhpc1ska25leF0uZGVzdHJveSgpO1xuICB9XG5cbiAgd3JpdGVSZWxhdGlvbnNoaXBzKHQsIHYsIGlkKSB7XG4gICAgcmV0dXJuIEJsdWViaXJkLnJlc29sdmUoKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIHJldHVybiBCbHVlYmlyZC5hbGwoT2JqZWN0LmtleXModC4kc2NoZW1hLnJlbGF0aW9uc2hpcHMpLm1hcCgocmVsTmFtZSkgPT4ge1xuICAgICAgICBpZiAodi5yZWxhdGlvbnNoaXBzICYmIHYucmVsYXRpb25zaGlwc1tyZWxOYW1lXSAmJiB2LnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0ubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGlmICh2LnJlbGF0aW9uc2hpcHNbcmVsTmFtZV1bMF0ub3ApIHtcbiAgICAgICAgICAgIC8vIGRlbHRhc1xuICAgICAgICAgICAgcmV0dXJuIEJsdWViaXJkLmFsbCh2LnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0ubWFwKChkZWx0YSkgPT4ge1xuICAgICAgICAgICAgICBpZiAoZGVsdGEub3AgPT09ICdhZGQnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHQsIGlkLCByZWxOYW1lLCBkZWx0YS5kYXRhLmlkLCBkZWx0YS5kYXRhLm1ldGEgfHwge30pO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhLm9wID09PSAncmVtb3ZlJykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJlbW92ZSh0LCBpZCwgcmVsTmFtZSwgZGVsdGEuZGF0YS5pZCk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEub3AgPT09ICdtb2RpZnknKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kaWZ5UmVsYXRpb25zaGlwKHQsIGlkLCByZWxOYW1lLCBkZWx0YS5kYXRhLmlkKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBpdGVtcyByYXRoZXIgdGhhbiBkZWx0YXNcbiAgICAgICAgICAgIHJldHVybiBCbHVlYmlyZC5hbGwodi5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGQodCwgaWQsIHJlbE5hbWUsIGl0ZW0uaWQsIGl0ZW0ubWV0YSB8fCB7fSk7XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH1cblxuICB3cml0ZUF0dHJpYnV0ZXModCwgdXBkYXRlT2JqZWN0LCBpZCkge1xuICAgIGlmICgoaWQgPT09IHVuZGVmaW5lZCkgJiYgKHRoaXMudGVybWluYWwpKSB7XG4gICAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkuaW5zZXJ0KHVwZGF0ZU9iamVjdCkucmV0dXJuaW5nKHQuJHNjaGVtYS4kaWQpXG4gICAgICAudGhlbigoY3JlYXRlZElkKSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlYWQodCwgY3JlYXRlZElkWzBdKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLndoZXJlKHsgW3QuJHNjaGVtYS4kaWRdOiBpZCB9KS51cGRhdGUodXBkYXRlT2JqZWN0KVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5yZWFkKHQsIGlkKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjcmVhdGUgbmV3IGNvbnRlbnQgaW4gYSBub24tdGVybWluYWwgc3RvcmUnKTtcbiAgICB9XG4gIH1cblxuICB3cml0ZSh0LCB2KSB7XG4gICAgY29uc3QgaWQgPSB2LmlkO1xuICAgIGNvbnN0IHVwZGF0ZU9iamVjdCA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ck5hbWUgaW4gdC4kc2NoZW1hLmF0dHJpYnV0ZXMpIHtcbiAgICAgIGlmICh2LmF0dHJpYnV0ZXNbYXR0ck5hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gY29weSBmcm9tIHYgdG8gdGhlIGJlc3Qgb2Ygb3VyIGFiaWxpdHlcbiAgICAgICAgaWYgKHQuJHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS50eXBlID09PSAnYXJyYXknKSB7XG4gICAgICAgICAgdXBkYXRlT2JqZWN0W2F0dHJOYW1lXSA9IHYuYXR0cmlidXRlc1thdHRyTmFtZV0uY29uY2F0KCk7XG4gICAgICAgIH0gZWxzZSBpZiAodC4kc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLnR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdXBkYXRlT2JqZWN0W2F0dHJOYW1lXSA9IE9iamVjdC5hc3NpZ24oe30sIHYuYXR0cmlidXRlc1thdHRyTmFtZV0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVwZGF0ZU9iamVjdFthdHRyTmFtZV0gPSB2LmF0dHJpYnV0ZXNbYXR0ck5hbWVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLndyaXRlQXR0cmlidXRlcyh0LCB1cGRhdGVPYmplY3QsIGlkKVxuICAgIC50aGVuKChyKSA9PiB7XG4gICAgICBpZiAodi5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndyaXRlUmVsYXRpb25zaGlwcyh0LCB2LCByLmlkKS50aGVuKCgpID0+IHIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHI7XG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5ub3RpZnlVcGRhdGUodCwgcmVzdWx0W3QuJHNjaGVtYS4kaWRdLCByZXN1bHQpLnRoZW4oKCkgPT4gcmVzdWx0KTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlYWRBdHRyaWJ1dGVzKHQsIGlkKSB7XG4gICAgbGV0IHF1ZXJ5ID0gdC5jYWNoZUdldCh0aGlzLCAncmVhZEF0dHJpYnV0ZXMnKTtcbiAgICBpZiAocXVlcnkgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcXVlcnkgPSByZWFkUXVlcnkodCk7XG4gICAgICB0LmNhY2hlU2V0KHRoaXMsICdyZWFkQXR0cmlidXRlcycsIHF1ZXJ5KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdLnJhdyhxdWVyeSwgaWQpXG4gICAgLnRoZW4oKG8pID0+IHtcbiAgICAgIGlmIChvLnJvd3NbMF0pIHtcbiAgICAgICAgcmV0dXJuIHJlYXJyYW5nZURhdGEodCwgby5yb3dzWzBdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYnVsa1JlYWQodCwgaWQpIHtcbiAgICBsZXQgcXVlcnkgPSB0LmNhY2hlR2V0KHRoaXMsICdidWxrUmVhZCcpO1xuICAgIGlmIChxdWVyeSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBxdWVyeSA9IGJ1bGtRdWVyeSh0KTtcbiAgICAgIHQuY2FjaGVTZXQodGhpcywgJ2J1bGtSZWFkJywgcXVlcnkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpc1ska25leF0ucmF3KHF1ZXJ5LCBpZClcbiAgICAudGhlbigobykgPT4ge1xuICAgICAgaWYgKG8ucm93c1swXSkge1xuICAgICAgICBjb25zdCBhcnJhbmdlZEFycmF5ID0gby5yb3dzLm1hcCgocm93KSA9PiByZWFycmFuZ2VEYXRhKHQsIHJvdykpO1xuICAgICAgICBjb25zdCByb290SXRlbSA9IGFycmFuZ2VkQXJyYXkuZmlsdGVyKChpdCkgPT4gaXQuaWQgPT09IGlkKVswXTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkYXRhOiByb290SXRlbSxcbiAgICAgICAgICBpbmNsdWRlZDogYXJyYW5nZWRBcnJheS5maWx0ZXIoKGl0KSA9PiBpdC5pZCAhPT0gaWQpLFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICByZWFkUmVsYXRpb25zaGlwKHR5cGUsIGlkLCByZWxOYW1lKSB7XG4gICAgY29uc3QgcmVsID0gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgICBjb25zdCBzcWxEYXRhID0gcmVsLiRzdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IHNlbGVjdEJhc2UgPSBgXCIke3JlbC4kbmFtZX1cIi5cIiR7c3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV19XCIgYXMgaWRgO1xuICAgIGxldCBzZWxlY3RFeHRyYXMgPSAnJztcbiAgICBpZiAocmVsLiRleHRyYXMpIHtcbiAgICAgIHNlbGVjdEV4dHJhcyA9IGAsIGpzb25iX2J1aWxkX29iamVjdCgke09iamVjdC5rZXlzKHJlbC4kZXh0cmFzKS5tYXAoKGV4dHJhKSA9PiBgJyR7ZXh0cmF9JywgXCIke3JlbC4kbmFtZX1cIi5cIiR7ZXh0cmF9XCJgKS5qb2luKCcsICcpfSkgYXMgbWV0YWA7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbWF4LWxlblxuICAgIH1cblxuICAgIHJldHVybiB0aGlzWyRrbmV4XShyZWwuJG5hbWUpXG4gICAgLndoZXJlKHNxbERhdGEuam9pbkZpZWxkc1tyZWxOYW1lXSwgaWQpXG4gICAgLnNlbGVjdCh0aGlzWyRrbmV4XS5yYXcoYCR7c2VsZWN0QmFzZX0ke3NlbGVjdEV4dHJhc31gKSlcbiAgICAudGhlbigobCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgW3JlbE5hbWVdOiBsLFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh0LCBpZCkge1xuICAgIHJldHVybiB0aGlzWyRrbmV4XSh0LiRuYW1lKS53aGVyZSh7IFt0LiRzY2hlbWEuJGlkXTogaWQgfSkuZGVsZXRlKClcbiAgICAudGhlbigobykgPT4gbyk7XG4gIH1cblxuICBhZGQodHlwZSwgaWQsIHJlbE5hbWUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsID0gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgICBjb25zdCBzcWxEYXRhID0gcmVsLiRzdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IG5ld0ZpZWxkID0ge1xuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tvdGhlclJlbE5hbWVdXTogY2hpbGRJZCxcbiAgICAgIFtzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV1dOiBpZCxcbiAgICB9O1xuICAgIGlmIChyZWwuJGV4dHJhcykge1xuICAgICAgT2JqZWN0LmtleXMocmVsLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbC4kbmFtZSlcbiAgICAuaW5zZXJ0KG5ld0ZpZWxkKVxuICAgIC50aGVuKCgpID0+IHRoaXMubm90aWZ5VXBkYXRlKHR5cGUsIGlkLCBudWxsLCByZWxOYW1lKSk7XG4gIH1cblxuICBtb2RpZnlSZWxhdGlvbnNoaXAodHlwZSwgaWQsIHJlbE5hbWUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsID0gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgICBjb25zdCBzcWxEYXRhID0gcmVsLiRzdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IG5ld0ZpZWxkID0ge307XG4gICAgT2JqZWN0LmtleXMocmVsLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICBpZiAoZXh0cmFzW2V4dHJhXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbC4kbmFtZSlcbiAgICAud2hlcmUoe1xuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tvdGhlclJlbE5hbWVdXTogY2hpbGRJZCxcbiAgICAgIFtzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV1dOiBpZCxcbiAgICB9KVxuICAgIC51cGRhdGUobmV3RmllbGQpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbE5hbWUpKTtcbiAgfVxuXG4gIHJlbW92ZSh0eXBlLCBpZCwgcmVsTmFtZSwgY2hpbGRJZCkge1xuICAgIGNvbnN0IHJlbCA9IHR5cGUuJHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLnR5cGU7XG4gICAgY29uc3Qgb3RoZXJSZWxOYW1lID0gcmVsLiRzaWRlc1tyZWxOYW1lXS5vdGhlck5hbWU7XG4gICAgY29uc3Qgc3FsRGF0YSA9IHJlbC4kc3RvcmVEYXRhLnNxbDtcbiAgICByZXR1cm4gdGhpc1ska25leF0ocmVsLiRuYW1lKVxuICAgIC53aGVyZSh7XG4gICAgICBbc3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV1dOiBjaGlsZElkLFxuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tyZWxOYW1lXV06IGlkLFxuICAgIH0pXG4gICAgLmRlbGV0ZSgpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbE5hbWUpKTtcbiAgfVxuXG4gIHF1ZXJ5KHEpIHtcbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSh0aGlzWyRrbmV4XS5yYXcocS5xdWVyeSkpXG4gICAgLnRoZW4oKGQpID0+IGQucm93cyk7XG4gIH1cbn1cbiJdfQ==
