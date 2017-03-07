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
    key: 'write',
    value: function write(t, v) {
      var _this2 = this;

      return _bluebird2.default.resolve().then(function () {
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
        if (id === undefined && _this2.terminal) {
          return _this2[$knex](t.$name).insert(updateObject).returning(t.$schema.$id).then(function (createdId) {
            return _this2.read(t, createdId[0]);
          });
        } else if (id !== undefined) {
          return _this2[$knex](t.$name).where(_defineProperty({}, t.$schema.$id, id)).update(updateObject).then(function () {
            return _this2.read(t, id);
          });
        } else {
          throw new Error('Cannot create new content in a non-terminal store');
        }
      }).then(function (result) {
        return _this2.notifyUpdate(t, result[t.$schema.$id], result).then(function () {
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
          rootItem.included = arrangedArray.filter(function (it) {
            return it.id !== id;
          });
          return rootItem;
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
          _this3 = this;

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
        return _this3.notifyUpdate(type, id, null, relName);
      });
    }
  }, {
    key: 'modifyRelationship',
    value: function modifyRelationship(type, id, relName, childId) {
      var _$knex$where2,
          _this4 = this;

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
      return this[$knex](rel.$name).where((_$knex$where2 = {}, _defineProperty(_$knex$where2, sqlData.joinFields[otherRelName], childId), _defineProperty(_$knex$where2, sqlData.joinFields[relName], id), _$knex$where2)).update(newField).then(function () {
        return _this4.notifyUpdate(type, id, null, relName);
      });
    }
  }, {
    key: 'remove',
    value: function remove(type, id, relName, childId) {
      var _$knex$where3,
          _this5 = this;

      var rel = type.$schema.relationships[relName].type;
      var otherRelName = rel.$sides[relName].otherName;
      var sqlData = rel.$storeData.sql;
      return this[$knex](rel.$name).where((_$knex$where3 = {}, _defineProperty(_$knex$where3, sqlData.joinFields[otherRelName], childId), _defineProperty(_$knex$where3, sqlData.joinFields[relName], id), _$knex$where3)).delete().then(function () {
        return _this5.notifyUpdate(type, id, null, relName);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNxbC5qcyJdLCJuYW1lcyI6WyIka25leCIsIlN5bWJvbCIsInJlYXJyYW5nZURhdGEiLCJ0eXBlIiwiZGF0YSIsInJldFZhbCIsIiRuYW1lIiwiYXR0cmlidXRlcyIsInJlbGF0aW9uc2hpcHMiLCJpZCIsIiRzY2hlbWEiLCIkaWQiLCJhdHRyTmFtZSIsInJlbE5hbWUiLCJQR1N0b3JlIiwib3B0cyIsIm9wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGllbnQiLCJkZWJ1ZyIsImNvbm5lY3Rpb24iLCJ1c2VyIiwiaG9zdCIsInBvcnQiLCJwYXNzd29yZCIsImNoYXJzZXQiLCJwb29sIiwibWF4IiwibWluIiwic3FsIiwiZGVzdHJveSIsInQiLCJ2IiwicmVzb2x2ZSIsInRoZW4iLCJ1cGRhdGVPYmplY3QiLCJ1bmRlZmluZWQiLCJjb25jYXQiLCJ0ZXJtaW5hbCIsImluc2VydCIsInJldHVybmluZyIsImNyZWF0ZWRJZCIsInJlYWQiLCJ3aGVyZSIsInVwZGF0ZSIsIkVycm9yIiwicmVzdWx0Iiwibm90aWZ5VXBkYXRlIiwicXVlcnkiLCJjYWNoZUdldCIsImNhY2hlU2V0IiwicmF3IiwibyIsInJvd3MiLCJhcnJhbmdlZEFycmF5IiwibWFwIiwicm93Iiwicm9vdEl0ZW0iLCJmaWx0ZXIiLCJpdCIsImluY2x1ZGVkIiwicmVsIiwib3RoZXJSZWxOYW1lIiwiJHNpZGVzIiwib3RoZXJOYW1lIiwic3FsRGF0YSIsIiRzdG9yZURhdGEiLCJzZWxlY3RCYXNlIiwiam9pbkZpZWxkcyIsInNlbGVjdEV4dHJhcyIsIiRleHRyYXMiLCJrZXlzIiwiZXh0cmEiLCJqb2luIiwic2VsZWN0IiwibCIsImRlbGV0ZSIsImNoaWxkSWQiLCJleHRyYXMiLCJuZXdGaWVsZCIsImZvckVhY2giLCJxIiwiZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOztBQUNBOzs7Ozs7Ozs7Ozs7QUFDQSxJQUFNQSxRQUFRQyxPQUFPLE9BQVAsQ0FB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RyxVQUFSLENBQW1CeEQsT0FBbkIsQ0FISSxFQUcwQkosRUFIMUIsbUJBS05vRSxNQUxNLEdBTU4xQyxJQU5NLENBTUQ7QUFBQSxlQUFNLE9BQUthLFlBQUwsQ0FBa0I3QyxJQUFsQixFQUF3Qk0sRUFBeEIsRUFBNEIsSUFBNUIsRUFBa0NJLE9BQWxDLENBQU47QUFBQSxPQU5DLENBQVA7QUFPRDs7OzBCQUVLcUUsQyxFQUFHO0FBQ1AsYUFBTyxtQkFBU2hELE9BQVQsQ0FBaUIsS0FBS2xDLEtBQUwsRUFBWW9ELEdBQVosQ0FBZ0I4QixFQUFFakMsS0FBbEIsQ0FBakIsRUFDTmQsSUFETSxDQUNELFVBQUNnRCxDQUFEO0FBQUEsZUFBT0EsRUFBRTdCLElBQVQ7QUFBQSxPQURDLENBQVA7QUFFRCIsImZpbGUiOiJzcWwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xuaW1wb3J0IGtuZXggZnJvbSAna25leCc7XG5pbXBvcnQgeyBTdG9yYWdlIH0gZnJvbSAncGx1bXAnO1xuaW1wb3J0IHsgcmVhZFF1ZXJ5LCBidWxrUXVlcnkgfSBmcm9tICcuL3F1ZXJ5U3RyaW5nJztcbmNvbnN0ICRrbmV4ID0gU3ltYm9sKCcka25leCcpO1xuXG5mdW5jdGlvbiByZWFycmFuZ2VEYXRhKHR5cGUsIGRhdGEpIHtcbiAgY29uc3QgcmV0VmFsID0ge1xuICAgIHR5cGU6IHR5cGUuJG5hbWUsXG4gICAgYXR0cmlidXRlczoge30sXG4gICAgcmVsYXRpb25zaGlwczoge30sXG4gICAgaWQ6IGRhdGFbdHlwZS4kc2NoZW1hLiRpZF0sXG4gIH07XG4gIGZvciAoY29uc3QgYXR0ck5hbWUgaW4gdHlwZS4kc2NoZW1hLmF0dHJpYnV0ZXMpIHtcbiAgICByZXRWYWwuYXR0cmlidXRlc1thdHRyTmFtZV0gPSBkYXRhW2F0dHJOYW1lXTtcbiAgfVxuICBmb3IgKGNvbnN0IHJlbE5hbWUgaW4gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHMpIHtcbiAgICByZXRWYWwucmVsYXRpb25zaGlwc1tyZWxOYW1lXSA9IGRhdGFbcmVsTmFtZV07XG4gIH1cbiAgcmV0dXJuIHJldFZhbDtcbn1cblxuZXhwb3J0IGNsYXNzIFBHU3RvcmUgZXh0ZW5kcyBTdG9yYWdlIHtcbiAgY29uc3RydWN0b3Iob3B0cyA9IHt9KSB7XG4gICAgc3VwZXIob3B0cyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgY2xpZW50OiAncG9zdGdyZXMnLFxuICAgICAgICBkZWJ1ZzogZmFsc2UsXG4gICAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgICB1c2VyOiAncG9zdGdyZXMnLFxuICAgICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICAgICAgcGFzc3dvcmQ6ICcnLFxuICAgICAgICAgIGNoYXJzZXQ6ICd1dGY4JyxcbiAgICAgICAgfSxcbiAgICAgICAgcG9vbDoge1xuICAgICAgICAgIG1heDogMjAsXG4gICAgICAgICAgbWluOiAwLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG9wdHMuc3FsXG4gICAgKTtcbiAgICB0aGlzWyRrbmV4XSA9IGtuZXgob3B0aW9ucyk7XG4gIH1cblxuICAvKlxuICAgIG5vdGUgdGhhdCBrbmV4LmpzIFwidGhlblwiIGZ1bmN0aW9ucyBhcmVuJ3QgYWN0dWFsbHkgcHJvbWlzZXMgdGhlIHdheSB5b3UgdGhpbmsgdGhleSBhcmUuXG4gICAgeW91IGNhbiByZXR1cm4ga25leC5pbnNlcnQoKS5pbnRvKCksIHdoaWNoIGhhcyBhIHRoZW4oKSBvbiBpdCwgYnV0IHRoYXQgdGhlbmFibGUgaXNuJ3RcbiAgICBhbiBhY3R1YWwgcHJvbWlzZSB5ZXQuIFNvIGluc3RlYWQgd2UncmUgcmV0dXJuaW5nIEJsdWViaXJkLnJlc29sdmUodGhlbmFibGUpO1xuICAqL1xuXG4gIHRlYXJkb3duKCkge1xuICAgIHJldHVybiB0aGlzWyRrbmV4XS5kZXN0cm95KCk7XG4gIH1cblxuICB3cml0ZSh0LCB2KSB7XG4gICAgcmV0dXJuIEJsdWViaXJkLnJlc29sdmUoKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIGNvbnN0IGlkID0gdi5pZDtcbiAgICAgIGNvbnN0IHVwZGF0ZU9iamVjdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBhdHRyTmFtZSBpbiB0LiRzY2hlbWEuYXR0cmlidXRlcykge1xuICAgICAgICBpZiAodi5hdHRyaWJ1dGVzW2F0dHJOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gY29weSBmcm9tIHYgdG8gdGhlIGJlc3Qgb2Ygb3VyIGFiaWxpdHlcbiAgICAgICAgICBpZiAodC4kc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLnR5cGUgPT09ICdhcnJheScpIHtcbiAgICAgICAgICAgIHVwZGF0ZU9iamVjdFthdHRyTmFtZV0gPSB2LmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmNvbmNhdCgpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodC4kc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLnR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB1cGRhdGVPYmplY3RbYXR0ck5hbWVdID0gT2JqZWN0LmFzc2lnbih7fSwgdi5hdHRyaWJ1dGVzW2F0dHJOYW1lXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVwZGF0ZU9iamVjdFthdHRyTmFtZV0gPSB2LmF0dHJpYnV0ZXNbYXR0ck5hbWVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKChpZCA9PT0gdW5kZWZpbmVkKSAmJiAodGhpcy50ZXJtaW5hbCkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLmluc2VydCh1cGRhdGVPYmplY3QpLnJldHVybmluZyh0LiRzY2hlbWEuJGlkKVxuICAgICAgICAudGhlbigoY3JlYXRlZElkKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZCh0LCBjcmVhdGVkSWRbMF0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkud2hlcmUoeyBbdC4kc2NoZW1hLiRpZF06IGlkIH0pLnVwZGF0ZSh1cGRhdGVPYmplY3QpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkKHQsIGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjcmVhdGUgbmV3IGNvbnRlbnQgaW4gYSBub24tdGVybWluYWwgc3RvcmUnKTtcbiAgICAgIH1cbiAgICB9KS50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm5vdGlmeVVwZGF0ZSh0LCByZXN1bHRbdC4kc2NoZW1hLiRpZF0sIHJlc3VsdCkudGhlbigoKSA9PiByZXN1bHQpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVhZEF0dHJpYnV0ZXModCwgaWQpIHtcbiAgICBsZXQgcXVlcnkgPSB0LmNhY2hlR2V0KHRoaXMsICdyZWFkQXR0cmlidXRlcycpO1xuICAgIGlmIChxdWVyeSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBxdWVyeSA9IHJlYWRRdWVyeSh0KTtcbiAgICAgIHQuY2FjaGVTZXQodGhpcywgJ3JlYWRBdHRyaWJ1dGVzJywgcXVlcnkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpc1ska25leF0ucmF3KHF1ZXJ5LCBpZClcbiAgICAudGhlbigobykgPT4ge1xuICAgICAgaWYgKG8ucm93c1swXSkge1xuICAgICAgICByZXR1cm4gcmVhcnJhbmdlRGF0YSh0LCBvLnJvd3NbMF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBidWxrUmVhZCh0LCBpZCkge1xuICAgIGxldCBxdWVyeSA9IHQuY2FjaGVHZXQodGhpcywgJ2J1bGtSZWFkJyk7XG4gICAgaWYgKHF1ZXJ5ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHF1ZXJ5ID0gYnVsa1F1ZXJ5KHQpO1xuICAgICAgdC5jYWNoZVNldCh0aGlzLCAnYnVsa1JlYWQnLCBxdWVyeSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzWyRrbmV4XS5yYXcocXVlcnksIGlkKVxuICAgIC50aGVuKChvKSA9PiB7XG4gICAgICBpZiAoby5yb3dzWzBdKSB7XG4gICAgICAgIGNvbnN0IGFycmFuZ2VkQXJyYXkgPSBvLnJvd3MubWFwKChyb3cpID0+IHJlYXJyYW5nZURhdGEodCwgcm93KSk7XG4gICAgICAgIGNvbnN0IHJvb3RJdGVtID0gYXJyYW5nZWRBcnJheS5maWx0ZXIoKGl0KSA9PiBpdC5pZCA9PT0gaWQpWzBdO1xuICAgICAgICByb290SXRlbS5pbmNsdWRlZCA9IGFycmFuZ2VkQXJyYXkuZmlsdGVyKChpdCkgPT4gaXQuaWQgIT09IGlkKTtcbiAgICAgICAgcmV0dXJuIHJvb3RJdGVtO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICByZWFkUmVsYXRpb25zaGlwKHR5cGUsIGlkLCByZWxOYW1lKSB7XG4gICAgY29uc3QgcmVsID0gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgICBjb25zdCBzcWxEYXRhID0gcmVsLiRzdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IHNlbGVjdEJhc2UgPSBgXCIke3JlbC4kbmFtZX1cIi5cIiR7c3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV19XCIgYXMgaWRgO1xuICAgIGxldCBzZWxlY3RFeHRyYXMgPSAnJztcbiAgICBpZiAocmVsLiRleHRyYXMpIHtcbiAgICAgIHNlbGVjdEV4dHJhcyA9IGAsIGpzb25iX2J1aWxkX29iamVjdCgke09iamVjdC5rZXlzKHJlbC4kZXh0cmFzKS5tYXAoKGV4dHJhKSA9PiBgJyR7ZXh0cmF9JywgXCIke3JlbC4kbmFtZX1cIi5cIiR7ZXh0cmF9XCJgKS5qb2luKCcsICcpfSkgYXMgbWV0YWA7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbWF4LWxlblxuICAgIH1cblxuICAgIHJldHVybiB0aGlzWyRrbmV4XShyZWwuJG5hbWUpXG4gICAgLndoZXJlKHNxbERhdGEuam9pbkZpZWxkc1tyZWxOYW1lXSwgaWQpXG4gICAgLnNlbGVjdCh0aGlzWyRrbmV4XS5yYXcoYCR7c2VsZWN0QmFzZX0ke3NlbGVjdEV4dHJhc31gKSlcbiAgICAudGhlbigobCkgPT4ge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgW3JlbE5hbWVdOiBsLFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh0LCBpZCkge1xuICAgIHJldHVybiB0aGlzWyRrbmV4XSh0LiRuYW1lKS53aGVyZSh7IFt0LiRzY2hlbWEuJGlkXTogaWQgfSkuZGVsZXRlKClcbiAgICAudGhlbigobykgPT4gbyk7XG4gIH1cblxuICBhZGQodHlwZSwgaWQsIHJlbE5hbWUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsID0gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgICBjb25zdCBzcWxEYXRhID0gcmVsLiRzdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IG5ld0ZpZWxkID0ge1xuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tvdGhlclJlbE5hbWVdXTogY2hpbGRJZCxcbiAgICAgIFtzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV1dOiBpZCxcbiAgICB9O1xuICAgIGlmIChyZWwuJGV4dHJhcykge1xuICAgICAgT2JqZWN0LmtleXMocmVsLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbC4kbmFtZSlcbiAgICAuaW5zZXJ0KG5ld0ZpZWxkKVxuICAgIC50aGVuKCgpID0+IHRoaXMubm90aWZ5VXBkYXRlKHR5cGUsIGlkLCBudWxsLCByZWxOYW1lKSk7XG4gIH1cblxuICBtb2RpZnlSZWxhdGlvbnNoaXAodHlwZSwgaWQsIHJlbE5hbWUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsID0gdHlwZS4kc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgICBjb25zdCBzcWxEYXRhID0gcmVsLiRzdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IG5ld0ZpZWxkID0ge307XG4gICAgT2JqZWN0LmtleXMocmVsLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICBpZiAoZXh0cmFzW2V4dHJhXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbC4kbmFtZSlcbiAgICAud2hlcmUoe1xuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tvdGhlclJlbE5hbWVdXTogY2hpbGRJZCxcbiAgICAgIFtzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV1dOiBpZCxcbiAgICB9KVxuICAgIC51cGRhdGUobmV3RmllbGQpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbE5hbWUpKTtcbiAgfVxuXG4gIHJlbW92ZSh0eXBlLCBpZCwgcmVsTmFtZSwgY2hpbGRJZCkge1xuICAgIGNvbnN0IHJlbCA9IHR5cGUuJHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLnR5cGU7XG4gICAgY29uc3Qgb3RoZXJSZWxOYW1lID0gcmVsLiRzaWRlc1tyZWxOYW1lXS5vdGhlck5hbWU7XG4gICAgY29uc3Qgc3FsRGF0YSA9IHJlbC4kc3RvcmVEYXRhLnNxbDtcbiAgICByZXR1cm4gdGhpc1ska25leF0ocmVsLiRuYW1lKVxuICAgIC53aGVyZSh7XG4gICAgICBbc3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV1dOiBjaGlsZElkLFxuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tyZWxOYW1lXV06IGlkLFxuICAgIH0pXG4gICAgLmRlbGV0ZSgpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbE5hbWUpKTtcbiAgfVxuXG4gIHF1ZXJ5KHEpIHtcbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSh0aGlzWyRrbmV4XS5yYXcocS5xdWVyeSkpXG4gICAgLnRoZW4oKGQpID0+IGQucm93cyk7XG4gIH1cbn1cbiJdfQ==
