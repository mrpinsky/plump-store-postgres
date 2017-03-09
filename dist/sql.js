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
      return _bluebird2.default.resolve().then(function () {
        if (Object.keys(updateObject).length > 0) {
          return _this4.writeAttributes(t, updateObject, id);
        } else {
          return v;
        }
      }).then(function (r) {
        if (v.relationships && r.id) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNxbC5qcyJdLCJuYW1lcyI6WyIka25leCIsIlN5bWJvbCIsInJlYXJyYW5nZURhdGEiLCJ0eXBlIiwiZGF0YSIsInJldFZhbCIsIiRuYW1lIiwiYXR0cmlidXRlcyIsInJlbGF0aW9uc2hpcHMiLCJpZCIsIiRzY2hlbWEiLCIkaWQiLCJhdHRyTmFtZSIsInJlbE5hbWUiLCJQR1N0b3JlIiwib3B0cyIsIm9wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGllbnQiLCJkZWJ1ZyIsImNvbm5lY3Rpb24iLCJ1c2VyIiwiaG9zdCIsInBvcnQiLCJwYXNzd29yZCIsImNoYXJzZXQiLCJwb29sIiwibWF4IiwibWluIiwic3FsIiwiZGVzdHJveSIsInQiLCJ2IiwicmVzb2x2ZSIsInRoZW4iLCJhbGwiLCJrZXlzIiwibWFwIiwibGVuZ3RoIiwib3AiLCJkZWx0YSIsImFkZCIsIm1ldGEiLCJyZW1vdmUiLCJtb2RpZnlSZWxhdGlvbnNoaXAiLCJpdGVtIiwidXBkYXRlT2JqZWN0IiwidW5kZWZpbmVkIiwidGVybWluYWwiLCJpbnNlcnQiLCJyZXR1cm5pbmciLCJjcmVhdGVkSWQiLCJyZWFkIiwid2hlcmUiLCJ1cGRhdGUiLCJFcnJvciIsImNvbmNhdCIsIndyaXRlQXR0cmlidXRlcyIsInIiLCJ3cml0ZVJlbGF0aW9uc2hpcHMiLCJyZXN1bHQiLCJub3RpZnlVcGRhdGUiLCJxdWVyeSIsImNhY2hlR2V0IiwiY2FjaGVTZXQiLCJyYXciLCJvIiwicm93cyIsImFycmFuZ2VkQXJyYXkiLCJyb3ciLCJyb290SXRlbSIsImZpbHRlciIsIml0IiwiaW5jbHVkZWQiLCJyZWwiLCJvdGhlclJlbE5hbWUiLCIkc2lkZXMiLCJvdGhlck5hbWUiLCJzcWxEYXRhIiwiJHN0b3JlRGF0YSIsInNlbGVjdEJhc2UiLCJqb2luRmllbGRzIiwic2VsZWN0RXh0cmFzIiwiJGV4dHJhcyIsImV4dHJhIiwiam9pbiIsInNlbGVjdCIsImwiLCJkZWxldGUiLCJjaGlsZElkIiwiZXh0cmFz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RSxPQUFYLEVBQW9CaUUsU0FBekM7QUFDQSxVQUFNQyxVQUFVSixJQUFJSyxVQUFKLENBQWVsRCxHQUEvQjtBQUNBLGFBQU8sS0FBSzlCLEtBQUwsRUFBWTJFLElBQUlyRSxLQUFoQixFQUNOZ0QsS0FETSxxREFFSnlCLFFBQVFHLFVBQVIsQ0FBbUJOLFlBQW5CLENBRkksRUFFK0JjLE9BRi9CLGtDQUdKWCxRQUFRRyxVQUFSLENBQW1CckUsT0FBbkIsQ0FISSxFQUcwQkosRUFIMUIsbUJBS05nRixNQUxNLEdBTU50RCxJQU5NLENBTUQ7QUFBQSxlQUFNLE9BQUsyQixZQUFMLENBQWtCM0QsSUFBbEIsRUFBd0JNLEVBQXhCLEVBQTRCLElBQTVCLEVBQWtDSSxPQUFsQyxDQUFOO0FBQUEsT0FOQyxDQUFQO0FBT0Q7OzswQkFFS2lGLEMsRUFBRztBQUNQLGFBQU8sbUJBQVM1RCxPQUFULENBQWlCLEtBQUtsQyxLQUFMLEVBQVlrRSxHQUFaLENBQWdCNEIsRUFBRS9CLEtBQWxCLENBQWpCLEVBQ041QixJQURNLENBQ0QsVUFBQzRELENBQUQ7QUFBQSxlQUFPQSxFQUFFM0IsSUFBVDtBQUFBLE9BREMsQ0FBUDtBQUVEIiwiZmlsZSI6InNxbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCbHVlYmlyZCBmcm9tICdibHVlYmlyZCc7XG5pbXBvcnQga25leCBmcm9tICdrbmV4JztcbmltcG9ydCB7IFN0b3JhZ2UgfSBmcm9tICdwbHVtcCc7XG5pbXBvcnQgeyByZWFkUXVlcnksIGJ1bGtRdWVyeSB9IGZyb20gJy4vcXVlcnlTdHJpbmcnO1xuY29uc3QgJGtuZXggPSBTeW1ib2woJyRrbmV4Jyk7XG5cbmZ1bmN0aW9uIHJlYXJyYW5nZURhdGEodHlwZSwgZGF0YSkge1xuICBjb25zdCByZXRWYWwgPSB7XG4gICAgdHlwZTogdHlwZS4kbmFtZSxcbiAgICBhdHRyaWJ1dGVzOiB7fSxcbiAgICByZWxhdGlvbnNoaXBzOiB7fSxcbiAgICBpZDogZGF0YVt0eXBlLiRzY2hlbWEuJGlkXSxcbiAgfTtcbiAgZm9yIChjb25zdCBhdHRyTmFtZSBpbiB0eXBlLiRzY2hlbWEuYXR0cmlidXRlcykge1xuICAgIHJldFZhbC5hdHRyaWJ1dGVzW2F0dHJOYW1lXSA9IGRhdGFbYXR0ck5hbWVdO1xuICB9XG4gIGZvciAoY29uc3QgcmVsTmFtZSBpbiB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwcykge1xuICAgIHJldFZhbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdID0gZGF0YVtyZWxOYW1lXTtcbiAgfVxuICByZXR1cm4gcmV0VmFsO1xufVxuXG5leHBvcnQgY2xhc3MgUEdTdG9yZSBleHRlbmRzIFN0b3JhZ2Uge1xuICBjb25zdHJ1Y3RvcihvcHRzID0ge30pIHtcbiAgICBzdXBlcihvcHRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gT2JqZWN0LmFzc2lnbihcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBjbGllbnQ6ICdwb3N0Z3JlcycsXG4gICAgICAgIGRlYnVnOiBmYWxzZSxcbiAgICAgICAgY29ubmVjdGlvbjoge1xuICAgICAgICAgIHVzZXI6ICdwb3N0Z3JlcycsXG4gICAgICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICAgICAgcG9ydDogNTQzMixcbiAgICAgICAgICBwYXNzd29yZDogJycsXG4gICAgICAgICAgY2hhcnNldDogJ3V0ZjgnLFxuICAgICAgICB9LFxuICAgICAgICBwb29sOiB7XG4gICAgICAgICAgbWF4OiAyMCxcbiAgICAgICAgICBtaW46IDAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgb3B0cy5zcWxcbiAgICApO1xuICAgIHRoaXNbJGtuZXhdID0ga25leChvcHRpb25zKTtcbiAgfVxuXG4gIC8qXG4gICAgbm90ZSB0aGF0IGtuZXguanMgXCJ0aGVuXCIgZnVuY3Rpb25zIGFyZW4ndCBhY3R1YWxseSBwcm9taXNlcyB0aGUgd2F5IHlvdSB0aGluayB0aGV5IGFyZS5cbiAgICB5b3UgY2FuIHJldHVybiBrbmV4Lmluc2VydCgpLmludG8oKSwgd2hpY2ggaGFzIGEgdGhlbigpIG9uIGl0LCBidXQgdGhhdCB0aGVuYWJsZSBpc24ndFxuICAgIGFuIGFjdHVhbCBwcm9taXNlIHlldC4gU28gaW5zdGVhZCB3ZSdyZSByZXR1cm5pbmcgQmx1ZWJpcmQucmVzb2x2ZSh0aGVuYWJsZSk7XG4gICovXG5cbiAgdGVhcmRvd24oKSB7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHdyaXRlUmVsYXRpb25zaGlwcyh0LCB2LCBpZCkge1xuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gQmx1ZWJpcmQuYWxsKE9iamVjdC5rZXlzKHQuJHNjaGVtYS5yZWxhdGlvbnNoaXBzKS5tYXAoKHJlbE5hbWUpID0+IHtcbiAgICAgICAgaWYgKHYucmVsYXRpb25zaGlwcyAmJiB2LnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0gJiYgdi5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBpZiAodi5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdWzBdLm9wKSB7XG4gICAgICAgICAgICAvLyBkZWx0YXNcbiAgICAgICAgICAgIHJldHVybiBCbHVlYmlyZC5hbGwodi5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLm1hcCgoZGVsdGEpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGRlbHRhLm9wID09PSAnYWRkJykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZCh0LCBpZCwgcmVsTmFtZSwgZGVsdGEuZGF0YS5pZCwgZGVsdGEuZGF0YS5tZXRhIHx8IHt9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChkZWx0YS5vcCA9PT0gJ3JlbW92ZScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZW1vdmUodCwgaWQsIHJlbE5hbWUsIGRlbHRhLmRhdGEuaWQpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhLm9wID09PSAnbW9kaWZ5Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1vZGlmeVJlbGF0aW9uc2hpcCh0LCBpZCwgcmVsTmFtZSwgZGVsdGEuZGF0YS5pZCk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaXRlbXMgcmF0aGVyIHRoYW4gZGVsdGFzXG4gICAgICAgICAgICByZXR1cm4gQmx1ZWJpcmQuYWxsKHYucmVsYXRpb25zaGlwc1tyZWxOYW1lXS5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKHQsIGlkLCByZWxOYW1lLCBpdGVtLmlkLCBpdGVtLm1ldGEgfHwge30pO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9XG5cbiAgd3JpdGVBdHRyaWJ1dGVzKHQsIHVwZGF0ZU9iamVjdCwgaWQpIHtcbiAgICBpZiAoKGlkID09PSB1bmRlZmluZWQpICYmICh0aGlzLnRlcm1pbmFsKSkge1xuICAgICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLmluc2VydCh1cGRhdGVPYmplY3QpLnJldHVybmluZyh0LiRzY2hlbWEuJGlkKVxuICAgICAgLnRoZW4oKGNyZWF0ZWRJZCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5yZWFkKHQsIGNyZWF0ZWRJZFswXSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGlkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0aGlzWyRrbmV4XSh0LiRuYW1lKS53aGVyZSh7IFt0LiRzY2hlbWEuJGlkXTogaWQgfSkudXBkYXRlKHVwZGF0ZU9iamVjdClcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVhZCh0LCBpZCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY3JlYXRlIG5ldyBjb250ZW50IGluIGEgbm9uLXRlcm1pbmFsIHN0b3JlJyk7XG4gICAgfVxuICB9XG5cbiAgd3JpdGUodCwgdikge1xuICAgIGNvbnN0IGlkID0gdi5pZDtcbiAgICBjb25zdCB1cGRhdGVPYmplY3QgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHJOYW1lIGluIHQuJHNjaGVtYS5hdHRyaWJ1dGVzKSB7XG4gICAgICBpZiAodi5hdHRyaWJ1dGVzW2F0dHJOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIGNvcHkgZnJvbSB2IHRvIHRoZSBiZXN0IG9mIG91ciBhYmlsaXR5XG4gICAgICAgIGlmICh0LiRzY2hlbWEuYXR0cmlidXRlc1thdHRyTmFtZV0udHlwZSA9PT0gJ2FycmF5Jykge1xuICAgICAgICAgIHVwZGF0ZU9iamVjdFthdHRyTmFtZV0gPSB2LmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmNvbmNhdCgpO1xuICAgICAgICB9IGVsc2UgaWYgKHQuJHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS50eXBlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHVwZGF0ZU9iamVjdFthdHRyTmFtZV0gPSBPYmplY3QuYXNzaWduKHt9LCB2LmF0dHJpYnV0ZXNbYXR0ck5hbWVdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1cGRhdGVPYmplY3RbYXR0ck5hbWVdID0gdi5hdHRyaWJ1dGVzW2F0dHJOYW1lXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKE9iamVjdC5rZXlzKHVwZGF0ZU9iamVjdCkubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gdGhpcy53cml0ZUF0dHJpYnV0ZXModCwgdXBkYXRlT2JqZWN0LCBpZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdjtcbiAgICAgIH1cbiAgICB9KS50aGVuKChyKSA9PiB7XG4gICAgICBpZiAodi5yZWxhdGlvbnNoaXBzICYmIHIuaWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud3JpdGVSZWxhdGlvbnNoaXBzKHQsIHYsIHIuaWQpLnRoZW4oKCkgPT4gcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcjtcbiAgICAgIH1cbiAgICB9KVxuICAgIC50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm5vdGlmeVVwZGF0ZSh0LCByZXN1bHRbdC4kc2NoZW1hLiRpZF0sIHJlc3VsdCkudGhlbigoKSA9PiByZXN1bHQpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVhZEF0dHJpYnV0ZXModCwgaWQpIHtcbiAgICBsZXQgcXVlcnkgPSB0LmNhY2hlR2V0KHRoaXMsICdyZWFkQXR0cmlidXRlcycpO1xuICAgIGlmIChxdWVyeSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBxdWVyeSA9IHJlYWRRdWVyeSh0KTtcbiAgICAgIHQuY2FjaGVTZXQodGhpcywgJ3JlYWRBdHRyaWJ1dGVzJywgcXVlcnkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpc1ska25leF0ucmF3KHF1ZXJ5LCBpZClcbiAgICAudGhlbigobykgPT4ge1xuICAgICAgaWYgKG8ucm93c1swXSkge1xuICAgICAgICByZXR1cm4gcmVhcnJhbmdlRGF0YSh0LCBvLnJvd3NbMF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBidWxrUmVhZCh0LCBpZCkge1xuICAgIGxldCBxdWVyeSA9IHQuY2FjaGVHZXQodGhpcywgJ2J1bGtSZWFkJyk7XG4gICAgaWYgKHF1ZXJ5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHF1ZXJ5ID0gYnVsa1F1ZXJ5KHQpO1xuICAgICAgdC5jYWNoZVNldCh0aGlzLCAnYnVsa1JlYWQnLCBxdWVyeSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzWyRrbmV4XS5yYXcocXVlcnksIGlkKVxuICAgIC50aGVuKChvKSA9PiB7XG4gICAgICBpZiAoby5yb3dzWzBdKSB7XG4gICAgICAgIGNvbnN0IGFycmFuZ2VkQXJyYXkgPSBvLnJvd3MubWFwKChyb3cpID0+IHJlYXJyYW5nZURhdGEodCwgcm93KSk7XG4gICAgICAgIGNvbnN0IHJvb3RJdGVtID0gYXJyYW5nZWRBcnJheS5maWx0ZXIoKGl0KSA9PiBpdC5pZCA9PT0gaWQpWzBdO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IHJvb3RJdGVtLFxuICAgICAgICAgIGluY2x1ZGVkOiBhcnJhbmdlZEFycmF5LmZpbHRlcigoaXQpID0+IGl0LmlkICE9PSBpZCksXG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHJlYWRSZWxhdGlvbnNoaXAodHlwZSwgaWQsIHJlbE5hbWUpIHtcbiAgICBjb25zdCByZWwgPSB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuICAgIGNvbnN0IG90aGVyUmVsTmFtZSA9IHJlbC4kc2lkZXNbcmVsTmFtZV0ub3RoZXJOYW1lO1xuICAgIGNvbnN0IHNxbERhdGEgPSByZWwuJHN0b3JlRGF0YS5zcWw7XG4gICAgY29uc3Qgc2VsZWN0QmFzZSA9IGBcIiR7cmVsLiRuYW1lfVwiLlwiJHtzcWxEYXRhLmpvaW5GaWVsZHNbb3RoZXJSZWxOYW1lXX1cIiBhcyBpZGA7XG4gICAgbGV0IHNlbGVjdEV4dHJhcyA9ICcnO1xuICAgIGlmIChyZWwuJGV4dHJhcykge1xuICAgICAgc2VsZWN0RXh0cmFzID0gYCwganNvbmJfYnVpbGRfb2JqZWN0KCR7T2JqZWN0LmtleXMocmVsLiRleHRyYXMpLm1hcCgoZXh0cmEpID0+IGAnJHtleHRyYX0nLCBcIiR7cmVsLiRuYW1lfVwiLlwiJHtleHRyYX1cImApLmpvaW4oJywgJyl9KSBhcyBtZXRhYDsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBtYXgtbGVuXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbC4kbmFtZSlcbiAgICAud2hlcmUoc3FsRGF0YS5qb2luRmllbGRzW3JlbE5hbWVdLCBpZClcbiAgICAuc2VsZWN0KHRoaXNbJGtuZXhdLnJhdyhgJHtzZWxlY3RCYXNlfSR7c2VsZWN0RXh0cmFzfWApKVxuICAgIC50aGVuKChsKSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBbcmVsTmFtZV06IGwsXG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlKHQsIGlkKSB7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLndoZXJlKHsgW3QuJHNjaGVtYS4kaWRdOiBpZCB9KS5kZWxldGUoKVxuICAgIC50aGVuKChvKSA9PiBvKTtcbiAgfVxuXG4gIGFkZCh0eXBlLCBpZCwgcmVsTmFtZSwgY2hpbGRJZCwgZXh0cmFzID0ge30pIHtcbiAgICBjb25zdCByZWwgPSB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuICAgIGNvbnN0IG90aGVyUmVsTmFtZSA9IHJlbC4kc2lkZXNbcmVsTmFtZV0ub3RoZXJOYW1lO1xuICAgIGNvbnN0IHNxbERhdGEgPSByZWwuJHN0b3JlRGF0YS5zcWw7XG4gICAgY29uc3QgbmV3RmllbGQgPSB7XG4gICAgICBbc3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV1dOiBjaGlsZElkLFxuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tyZWxOYW1lXV06IGlkLFxuICAgIH07XG4gICAgaWYgKHJlbC4kZXh0cmFzKSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWwuJGV4dHJhcykuZm9yRWFjaCgoZXh0cmEpID0+IHtcbiAgICAgICAgbmV3RmllbGRbZXh0cmFdID0gZXh0cmFzW2V4dHJhXTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpc1ska25leF0ocmVsLiRuYW1lKVxuICAgIC5pbnNlcnQobmV3RmllbGQpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbE5hbWUpKTtcbiAgfVxuXG4gIG1vZGlmeVJlbGF0aW9uc2hpcCh0eXBlLCBpZCwgcmVsTmFtZSwgY2hpbGRJZCwgZXh0cmFzID0ge30pIHtcbiAgICBjb25zdCByZWwgPSB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuICAgIGNvbnN0IG90aGVyUmVsTmFtZSA9IHJlbC4kc2lkZXNbcmVsTmFtZV0ub3RoZXJOYW1lO1xuICAgIGNvbnN0IHNxbERhdGEgPSByZWwuJHN0b3JlRGF0YS5zcWw7XG4gICAgY29uc3QgbmV3RmllbGQgPSB7fTtcbiAgICBPYmplY3Qua2V5cyhyZWwuJGV4dHJhcykuZm9yRWFjaCgoZXh0cmEpID0+IHtcbiAgICAgIGlmIChleHRyYXNbZXh0cmFdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbmV3RmllbGRbZXh0cmFdID0gZXh0cmFzW2V4dHJhXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdGhpc1ska25leF0ocmVsLiRuYW1lKVxuICAgIC53aGVyZSh7XG4gICAgICBbc3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV1dOiBjaGlsZElkLFxuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tyZWxOYW1lXV06IGlkLFxuICAgIH0pXG4gICAgLnVwZGF0ZShuZXdGaWVsZClcbiAgICAudGhlbigoKSA9PiB0aGlzLm5vdGlmeVVwZGF0ZSh0eXBlLCBpZCwgbnVsbCwgcmVsTmFtZSkpO1xuICB9XG5cbiAgcmVtb3ZlKHR5cGUsIGlkLCByZWxOYW1lLCBjaGlsZElkKSB7XG4gICAgY29uc3QgcmVsID0gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgICBjb25zdCBzcWxEYXRhID0gcmVsLiRzdG9yZURhdGEuc3FsO1xuICAgIHJldHVybiB0aGlzWyRrbmV4XShyZWwuJG5hbWUpXG4gICAgLndoZXJlKHtcbiAgICAgIFtzcWxEYXRhLmpvaW5GaWVsZHNbb3RoZXJSZWxOYW1lXV06IGNoaWxkSWQsXG4gICAgICBbc3FsRGF0YS5qb2luRmllbGRzW3JlbE5hbWVdXTogaWQsXG4gICAgfSlcbiAgICAuZGVsZXRlKClcbiAgICAudGhlbigoKSA9PiB0aGlzLm5vdGlmeVVwZGF0ZSh0eXBlLCBpZCwgbnVsbCwgcmVsTmFtZSkpO1xuICB9XG5cbiAgcXVlcnkocSkge1xuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKHRoaXNbJGtuZXhdLnJhdyhxLnF1ZXJ5KSlcbiAgICAudGhlbigoZCkgPT4gZC5yb3dzKTtcbiAgfVxufVxuIl19
