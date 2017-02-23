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
  Object.keys(schema.attributes).concat(Object.keys(schema.relationships)).forEach(function (key) {
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
        var id = v[t.$schema.$id];
        var updateObject = {};
        for (var attrName in t.$schema.attributes) {
          if (v[attrName] !== undefined) {
            // copy from v to the best of our ability
            if (t.$schema.attributes[attrName].type === 'array') {
              updateObject[attrName.toLowerCase()] = v[attrName].concat();
            } else if (t.$schema.attributes[attrName].type === 'object') {
              updateObject[attrName.toLowerCase()] = Object.assign({}, v[attrName]);
            } else {
              updateObject[attrName.toLowerCase()] = v[attrName];
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
    key: 'readOne',
    value: function readOne(t, id) {
      return (0, _blockRead2.blockRead)(t, this[$knex], _defineProperty({}, t.$schema.$id, id)).then(function (o) {
        if (o[0]) {
          debugger;
          return fixCase(o[0], t.$schema);
        } else {
          return null;
        }
      });
    }
  }, {
    key: 'readMany',
    value: function readMany(type, id, relationshipTitle) {
      var _this3 = this;

      var relationshipBlock = type.$schema.relationships[relationshipTitle];
      var sideInfo = relationshipBlock.type.$sides[relationshipTitle];
      var toSelect = [sideInfo.other.field, sideInfo.self.field];
      if (relationshipBlock.type.$extras) {
        toSelect = toSelect.concat(Object.keys(relationshipBlock.type.$extras));
      }
      var whereBlock = {};
      if (sideInfo.self.query) {
        whereBlock[sideInfo.self.field] = sideInfo.self.query.logic;
      } else {
        whereBlock[sideInfo.self.field] = id;
      }
      if (relationshipBlock.type.$restrict) {
        Object.keys(relationshipBlock.type.$restrict).forEach(function (restriction) {
          whereBlock[restriction] = relationshipBlock.type.$restrict[restriction].value;
        });
      }
      return _bluebird2.default.resolve().then(function () {
        if (sideInfo.self.query && sideInfo.self.query.requireLoad) {
          return _this3.readOne(type, id);
        } else {
          return { id: id };
        }
      }).then(function (context) {
        return objectToWhereChain(_this3[$knex](relationshipBlock.type.$name), whereBlock, context).select(toSelect);
      }).then(function (l) {
        return _defineProperty({}, relationshipTitle, l);
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
    value: function add(type, id, relationshipTitle, childId) {
      var _newField,
          _this4 = this;

      var extras = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      var relationshipBlock = type.$schema.relationships[relationshipTitle];
      var sideInfo = relationshipBlock.type.$sides[relationshipTitle];
      var newField = (_newField = {}, _defineProperty(_newField, sideInfo.other.field, childId), _defineProperty(_newField, sideInfo.self.field, id), _newField);
      if (relationshipBlock.type.$restrict) {
        Object.keys(relationshipBlock.type.$restrict).forEach(function (restriction) {
          newField[restriction] = relationshipBlock.type.$restrict[restriction].value;
        });
      }
      if (relationshipBlock.type.$extras) {
        Object.keys(relationshipBlock.type.$extras).forEach(function (extra) {
          newField[extra] = extras[extra];
        });
      }
      return this[$knex](relationshipBlock.type.$name).insert(newField).then(function () {
        return _this4.notifyUpdate(type, id, null, relationshipTitle);
      });
    }
  }, {
    key: 'modifyRelationship',
    value: function modifyRelationship(type, id, relationshipTitle, childId) {
      var _whereBlock,
          _this5 = this;

      var extras = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      var relationshipBlock = type.$schema.relationships[relationshipTitle];
      var sideInfo = relationshipBlock.type.$sides[relationshipTitle];
      var newField = {};
      Object.keys(relationshipBlock.type.$extras).forEach(function (extra) {
        if (extras[extra] !== undefined) {
          newField[extra] = extras[extra];
        }
      });
      var whereBlock = (_whereBlock = {}, _defineProperty(_whereBlock, sideInfo.other.field, childId), _defineProperty(_whereBlock, sideInfo.self.field, id), _whereBlock);
      if (relationshipBlock.type.$restrict) {
        Object.keys(relationshipBlock.type.$restrict).forEach(function (restriction) {
          whereBlock[restriction] = relationshipBlock.type.$restrict[restriction].value;
        });
      }
      return objectToWhereChain(this[$knex](relationshipBlock.type.$name), whereBlock, { id: id, childId: childId }).update(newField).then(function () {
        return _this5.notifyUpdate(type, id, null, relationshipTitle);
      });
    }
  }, {
    key: 'remove',
    value: function remove(type, id, relationshipTitle, childId) {
      var _whereBlock2,
          _this6 = this;

      var relationshipBlock = type.$schema.relationships[relationshipTitle];
      var sideInfo = relationshipBlock.type.$sides[relationshipTitle];
      var whereBlock = (_whereBlock2 = {}, _defineProperty(_whereBlock2, sideInfo.other.field, childId), _defineProperty(_whereBlock2, sideInfo.self.field, id), _whereBlock2);
      if (relationshipBlock.type.$restrict) {
        Object.keys(relationshipBlock.type.$restrict).forEach(function (restriction) {
          whereBlock[restriction] = relationshipBlock.type.$restrict[restriction].value;
        });
      }
      return objectToWhereChain(this[$knex](relationshipBlock.type.$name), whereBlock).delete().then(function () {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNxbC5qcyJdLCJuYW1lcyI6WyIka25leCIsIlN5bWJvbCIsImZpeENhc2UiLCJkYXRhIiwic2NoZW1hIiwiT2JqZWN0Iiwia2V5cyIsImF0dHJpYnV0ZXMiLCJjb25jYXQiLCJyZWxhdGlvbnNoaXBzIiwiZm9yRWFjaCIsImtleSIsInRvTG93ZXJDYXNlIiwiZGVzZXJpYWxpemVXaGVyZSIsInF1ZXJ5IiwiYmxvY2siLCJjYXIiLCJjZHIiLCJzbGljZSIsIkFycmF5IiwiaXNBcnJheSIsInJlZHVjZSIsInN1YlF1ZXJ5Iiwic3ViQmxvY2siLCJhcHBseSIsIm9iamVjdFRvV2hlcmVDaGFpbiIsImNvbnRleHQiLCJxIiwibWFzc1JlcGxhY2UiLCJ3aGVyZSIsIlBHU3RvcmUiLCJvcHRzIiwib3B0aW9ucyIsImFzc2lnbiIsImNsaWVudCIsImRlYnVnIiwiY29ubmVjdGlvbiIsInVzZXIiLCJob3N0IiwicG9ydCIsInBhc3N3b3JkIiwiY2hhcnNldCIsInBvb2wiLCJtYXgiLCJtaW4iLCJzcWwiLCJkZXN0cm95IiwidCIsInYiLCJyZXNvbHZlIiwidGhlbiIsImlkIiwiJHNjaGVtYSIsIiRpZCIsInVwZGF0ZU9iamVjdCIsImF0dHJOYW1lIiwidW5kZWZpbmVkIiwidHlwZSIsInRlcm1pbmFsIiwiJG5hbWUiLCJpbnNlcnQiLCJyZXR1cm5pbmciLCJjcmVhdGVkSWQiLCJyZWFkIiwidXBkYXRlIiwiRXJyb3IiLCJyZXN1bHQiLCJub3RpZnlVcGRhdGUiLCJvIiwicmVsYXRpb25zaGlwVGl0bGUiLCJyZWxhdGlvbnNoaXBCbG9jayIsInNpZGVJbmZvIiwiJHNpZGVzIiwidG9TZWxlY3QiLCJvdGhlciIsImZpZWxkIiwic2VsZiIsIiRleHRyYXMiLCJ3aGVyZUJsb2NrIiwibG9naWMiLCIkcmVzdHJpY3QiLCJyZXN0cmljdGlvbiIsInZhbHVlIiwicmVxdWlyZUxvYWQiLCJyZWFkT25lIiwic2VsZWN0IiwibCIsImRlbGV0ZSIsImNoaWxkSWQiLCJleHRyYXMiLCJuZXdGaWVsZCIsImV4dHJhIiwicmF3IiwiZCIsInJvd3MiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7Ozs7Ozs7Ozs7O0FBQ0EsSUFBTUEsUUFBUUMsT0FBTyxPQUFQLENBQWQ7O0FBRUEsU0FBU0MsT0FBVCxDQUFpQkMsSUFBakIsRUFBdUJDLE1BQXZCLEVBQStCO0FBQzdCQyxTQUFPQyxJQUFQLENBQVlGLE9BQU9HLFVBQW5CLEVBQStCQyxNQUEvQixDQUFzQ0gsT0FBT0MsSUFBUCxDQUFZRixPQUFPSyxhQUFuQixDQUF0QyxFQUF5RUMsT0FBekUsQ0FBaUYsVUFBQ0MsR0FBRCxFQUFTO0FBQ3hGLFFBQUtBLElBQUlDLFdBQUosT0FBc0JELEdBQXZCLElBQWdDUixLQUFLUSxJQUFJQyxXQUFKLEVBQUwsQ0FBcEMsRUFBOEQ7QUFDNURULFdBQUtRLEdBQUwsSUFBWVIsS0FBS1EsSUFBSUMsV0FBSixFQUFMLENBQVosQ0FENEQsQ0FDdkI7QUFDckMsYUFBT1QsS0FBS1EsSUFBSUMsV0FBSixFQUFMLENBQVAsQ0FGNEQsQ0FFNUI7QUFDakM7QUFDRixHQUxEO0FBTUEsU0FBT1QsSUFBUDtBQUNEOztBQUVELFNBQVNVLGdCQUFULENBQTBCQyxLQUExQixFQUFpQ0MsS0FBakMsRUFBd0M7QUFDdEMsTUFBTUMsTUFBTUQsTUFBTSxDQUFOLENBQVo7QUFDQSxNQUFNRSxNQUFNRixNQUFNRyxLQUFOLENBQVksQ0FBWixDQUFaO0FBQ0EsTUFBSUMsTUFBTUMsT0FBTixDQUFjSCxJQUFJLENBQUosQ0FBZCxDQUFKLEVBQTJCO0FBQ3pCLFdBQU9BLElBQUlJLE1BQUosQ0FBVyxVQUFDQyxRQUFELEVBQVdDLFFBQVg7QUFBQSxhQUF3QlYsaUJBQWlCUyxRQUFqQixFQUEyQkMsUUFBM0IsQ0FBeEI7QUFBQSxLQUFYLEVBQXlFVCxLQUF6RSxDQUFQO0FBQ0QsR0FGRCxNQUVPO0FBQ0wsV0FBT0EsTUFBTUUsR0FBTixFQUFXUSxLQUFYLENBQWlCVixLQUFqQixFQUF3QkcsR0FBeEIsQ0FBUDtBQUNEO0FBQ0Y7O0FBRUQsU0FBU1Esa0JBQVQsQ0FBNEJYLEtBQTVCLEVBQW1DQyxLQUFuQyxFQUEwQ1csT0FBMUMsRUFBbUQ7QUFDakQsU0FBT3JCLE9BQU9DLElBQVAsQ0FBWVMsS0FBWixFQUFtQk0sTUFBbkIsQ0FBMEIsVUFBQ00sQ0FBRCxFQUFJaEIsR0FBSixFQUFZO0FBQzNDLFFBQUlRLE1BQU1DLE9BQU4sQ0FBY0wsTUFBTUosR0FBTixDQUFkLENBQUosRUFBK0I7QUFDN0IsYUFBT0UsaUJBQWlCQyxLQUFqQixFQUF3QixlQUFRYyxXQUFSLENBQW9CYixNQUFNSixHQUFOLENBQXBCLEVBQWdDZSxPQUFoQyxDQUF4QixDQUFQO0FBQ0QsS0FGRCxNQUVPO0FBQ0wsYUFBT0MsRUFBRUUsS0FBRixDQUFRbEIsR0FBUixFQUFhSSxNQUFNSixHQUFOLENBQWIsQ0FBUDtBQUNEO0FBQ0YsR0FOTSxFQU1KRyxLQU5JLENBQVA7QUFPRDs7SUFHWWdCLE8sV0FBQUEsTzs7O0FBQ1gscUJBQXVCO0FBQUEsUUFBWEMsSUFBVyx1RUFBSixFQUFJOztBQUFBOztBQUFBLGtIQUNmQSxJQURlOztBQUVyQixRQUFNQyxVQUFVM0IsT0FBTzRCLE1BQVAsQ0FDZCxFQURjLEVBRWQ7QUFDRUMsY0FBUSxVQURWO0FBRUVDLGFBQU8sS0FGVDtBQUdFQyxrQkFBWTtBQUNWQyxjQUFNLFVBREk7QUFFVkMsY0FBTSxXQUZJO0FBR1ZDLGNBQU0sSUFISTtBQUlWQyxrQkFBVSxFQUpBO0FBS1ZDLGlCQUFTO0FBTEMsT0FIZDtBQVVFQyxZQUFNO0FBQ0pDLGFBQUssRUFERDtBQUVKQyxhQUFLO0FBRkQ7QUFWUixLQUZjLEVBaUJkYixLQUFLYyxHQWpCUyxDQUFoQjtBQW1CQSxVQUFLN0MsS0FBTCxJQUFjLG9CQUFLZ0MsT0FBTCxDQUFkO0FBckJxQjtBQXNCdEI7O0FBRUQ7Ozs7Ozs7OytCQU1XO0FBQ1QsYUFBTyxLQUFLaEMsS0FBTCxFQUFZOEMsT0FBWixFQUFQO0FBQ0Q7OzswQkFFS0MsQyxFQUFHQyxDLEVBQUc7QUFBQTs7QUFDVixhQUFPLG1CQUFTQyxPQUFULEdBQ05DLElBRE0sQ0FDRCxZQUFNO0FBQ1YsWUFBTUMsS0FBS0gsRUFBRUQsRUFBRUssT0FBRixDQUFVQyxHQUFaLENBQVg7QUFDQSxZQUFNQyxlQUFlLEVBQXJCO0FBQ0EsYUFBSyxJQUFNQyxRQUFYLElBQXVCUixFQUFFSyxPQUFGLENBQVU3QyxVQUFqQyxFQUE2QztBQUMzQyxjQUFJeUMsRUFBRU8sUUFBRixNQUFnQkMsU0FBcEIsRUFBK0I7QUFDN0I7QUFDQSxnQkFBSVQsRUFBRUssT0FBRixDQUFVN0MsVUFBVixDQUFxQmdELFFBQXJCLEVBQStCRSxJQUEvQixLQUF3QyxPQUE1QyxFQUFxRDtBQUNuREgsMkJBQWFDLFNBQVMzQyxXQUFULEVBQWIsSUFBdUNvQyxFQUFFTyxRQUFGLEVBQVkvQyxNQUFaLEVBQXZDO0FBQ0QsYUFGRCxNQUVPLElBQUl1QyxFQUFFSyxPQUFGLENBQVU3QyxVQUFWLENBQXFCZ0QsUUFBckIsRUFBK0JFLElBQS9CLEtBQXdDLFFBQTVDLEVBQXNEO0FBQzNESCwyQkFBYUMsU0FBUzNDLFdBQVQsRUFBYixJQUF1Q1AsT0FBTzRCLE1BQVAsQ0FBYyxFQUFkLEVBQWtCZSxFQUFFTyxRQUFGLENBQWxCLENBQXZDO0FBQ0QsYUFGTSxNQUVBO0FBQ0xELDJCQUFhQyxTQUFTM0MsV0FBVCxFQUFiLElBQXVDb0MsRUFBRU8sUUFBRixDQUF2QztBQUNEO0FBQ0Y7QUFDRjtBQUNELFlBQUtKLE9BQU9LLFNBQVIsSUFBdUIsT0FBS0UsUUFBaEMsRUFBMkM7QUFDekMsaUJBQU8sT0FBSzFELEtBQUwsRUFBWStDLEVBQUVZLEtBQWQsRUFBcUJDLE1BQXJCLENBQTRCTixZQUE1QixFQUEwQ08sU0FBMUMsQ0FBb0RkLEVBQUVLLE9BQUYsQ0FBVUMsR0FBOUQsRUFDTkgsSUFETSxDQUNELFVBQUNZLFNBQUQsRUFBZTtBQUNuQixtQkFBTyxPQUFLQyxJQUFMLENBQVVoQixDQUFWLEVBQWFlLFVBQVUsQ0FBVixDQUFiLENBQVA7QUFDRCxXQUhNLENBQVA7QUFJRCxTQUxELE1BS08sSUFBSVgsT0FBT0ssU0FBWCxFQUFzQjtBQUMzQixpQkFBTyxPQUFLeEQsS0FBTCxFQUFZK0MsRUFBRVksS0FBZCxFQUFxQjlCLEtBQXJCLHFCQUE4QmtCLEVBQUVLLE9BQUYsQ0FBVUMsR0FBeEMsRUFBOENGLEVBQTlDLEdBQW9EYSxNQUFwRCxDQUEyRFYsWUFBM0QsRUFDTkosSUFETSxDQUNELFlBQU07QUFDVixtQkFBTyxPQUFLYSxJQUFMLENBQVVoQixDQUFWLEVBQWFJLEVBQWIsQ0FBUDtBQUNELFdBSE0sQ0FBUDtBQUlELFNBTE0sTUFLQTtBQUNMLGdCQUFNLElBQUljLEtBQUosQ0FBVSxtREFBVixDQUFOO0FBQ0Q7QUFDRixPQTdCTSxFQTZCSmYsSUE3QkksQ0E2QkMsVUFBQ2dCLE1BQUQsRUFBWTtBQUNsQixlQUFPLE9BQUtDLFlBQUwsQ0FBa0JwQixDQUFsQixFQUFxQm1CLE9BQU9uQixFQUFFSyxPQUFGLENBQVVDLEdBQWpCLENBQXJCLEVBQTRDYSxNQUE1QyxFQUFvRGhCLElBQXBELENBQXlEO0FBQUEsaUJBQU1nQixNQUFOO0FBQUEsU0FBekQsQ0FBUDtBQUNELE9BL0JNLENBQVA7QUFnQ0Q7Ozs0QkFFT25CLEMsRUFBR0ksRSxFQUFJO0FBQ2IsYUFBTywyQkFBVUosQ0FBVixFQUFhLEtBQUsvQyxLQUFMLENBQWIsc0JBQTZCK0MsRUFBRUssT0FBRixDQUFVQyxHQUF2QyxFQUE2Q0YsRUFBN0MsR0FDTkQsSUFETSxDQUNELFVBQUNrQixDQUFELEVBQU87QUFDWCxZQUFJQSxFQUFFLENBQUYsQ0FBSixFQUFVO0FBQ1I7QUFDQSxpQkFBT2xFLFFBQVFrRSxFQUFFLENBQUYsQ0FBUixFQUFjckIsRUFBRUssT0FBaEIsQ0FBUDtBQUNELFNBSEQsTUFHTztBQUNMLGlCQUFPLElBQVA7QUFDRDtBQUNGLE9BUk0sQ0FBUDtBQVNEOzs7NkJBRVFLLEksRUFBTU4sRSxFQUFJa0IsaUIsRUFBbUI7QUFBQTs7QUFDcEMsVUFBTUMsb0JBQW9CYixLQUFLTCxPQUFMLENBQWEzQyxhQUFiLENBQTJCNEQsaUJBQTNCLENBQTFCO0FBQ0EsVUFBTUUsV0FBV0Qsa0JBQWtCYixJQUFsQixDQUF1QmUsTUFBdkIsQ0FBOEJILGlCQUE5QixDQUFqQjtBQUNBLFVBQUlJLFdBQVcsQ0FBQ0YsU0FBU0csS0FBVCxDQUFlQyxLQUFoQixFQUF1QkosU0FBU0ssSUFBVCxDQUFjRCxLQUFyQyxDQUFmO0FBQ0EsVUFBSUwsa0JBQWtCYixJQUFsQixDQUF1Qm9CLE9BQTNCLEVBQW9DO0FBQ2xDSixtQkFBV0EsU0FBU2pFLE1BQVQsQ0FBZ0JILE9BQU9DLElBQVAsQ0FBWWdFLGtCQUFrQmIsSUFBbEIsQ0FBdUJvQixPQUFuQyxDQUFoQixDQUFYO0FBQ0Q7QUFDRCxVQUFNQyxhQUFhLEVBQW5CO0FBQ0EsVUFBSVAsU0FBU0ssSUFBVCxDQUFjOUQsS0FBbEIsRUFBeUI7QUFDdkJnRSxtQkFBV1AsU0FBU0ssSUFBVCxDQUFjRCxLQUF6QixJQUFrQ0osU0FBU0ssSUFBVCxDQUFjOUQsS0FBZCxDQUFvQmlFLEtBQXREO0FBQ0QsT0FGRCxNQUVPO0FBQ0xELG1CQUFXUCxTQUFTSyxJQUFULENBQWNELEtBQXpCLElBQWtDeEIsRUFBbEM7QUFDRDtBQUNELFVBQUltQixrQkFBa0JiLElBQWxCLENBQXVCdUIsU0FBM0IsRUFBc0M7QUFDcEMzRSxlQUFPQyxJQUFQLENBQVlnRSxrQkFBa0JiLElBQWxCLENBQXVCdUIsU0FBbkMsRUFBOEN0RSxPQUE5QyxDQUFzRCxVQUFDdUUsV0FBRCxFQUFpQjtBQUNyRUgscUJBQVdHLFdBQVgsSUFBMEJYLGtCQUFrQmIsSUFBbEIsQ0FBdUJ1QixTQUF2QixDQUFpQ0MsV0FBakMsRUFBOENDLEtBQXhFO0FBQ0QsU0FGRDtBQUdEO0FBQ0QsYUFBTyxtQkFBU2pDLE9BQVQsR0FDTkMsSUFETSxDQUNELFlBQU07QUFDVixZQUFJcUIsU0FBU0ssSUFBVCxDQUFjOUQsS0FBZCxJQUF1QnlELFNBQVNLLElBQVQsQ0FBYzlELEtBQWQsQ0FBb0JxRSxXQUEvQyxFQUE0RDtBQUMxRCxpQkFBTyxPQUFLQyxPQUFMLENBQWEzQixJQUFiLEVBQW1CTixFQUFuQixDQUFQO0FBQ0QsU0FGRCxNQUVPO0FBQ0wsaUJBQU8sRUFBRUEsTUFBRixFQUFQO0FBQ0Q7QUFDRixPQVBNLEVBUU5ELElBUk0sQ0FRRCxVQUFDeEIsT0FBRCxFQUFhO0FBQ2pCLGVBQU9ELG1CQUFtQixPQUFLekIsS0FBTCxFQUFZc0Usa0JBQWtCYixJQUFsQixDQUF1QkUsS0FBbkMsQ0FBbkIsRUFBOERtQixVQUE5RCxFQUEwRXBELE9BQTFFLEVBQ04yRCxNQURNLENBQ0NaLFFBREQsQ0FBUDtBQUVELE9BWE0sRUFZTnZCLElBWk0sQ0FZRCxVQUFDb0MsQ0FBRCxFQUFPO0FBQ1gsbUNBQ0dqQixpQkFESCxFQUN1QmlCLENBRHZCO0FBR0QsT0FoQk0sQ0FBUDtBQWlCRDs7OzRCQUVNdkMsQyxFQUFHSSxFLEVBQUk7QUFDWixhQUFPLEtBQUtuRCxLQUFMLEVBQVkrQyxFQUFFWSxLQUFkLEVBQXFCOUIsS0FBckIscUJBQThCa0IsRUFBRUssT0FBRixDQUFVQyxHQUF4QyxFQUE4Q0YsRUFBOUMsR0FBb0RvQyxNQUFwRCxHQUNOckMsSUFETSxDQUNELFVBQUNrQixDQUFEO0FBQUEsZUFBT0EsQ0FBUDtBQUFBLE9BREMsQ0FBUDtBQUVEOzs7d0JBRUdYLEksRUFBTU4sRSxFQUFJa0IsaUIsRUFBbUJtQixPLEVBQXNCO0FBQUE7QUFBQTs7QUFBQSxVQUFiQyxNQUFhLHVFQUFKLEVBQUk7O0FBQ3JELFVBQU1uQixvQkFBb0JiLEtBQUtMLE9BQUwsQ0FBYTNDLGFBQWIsQ0FBMkI0RCxpQkFBM0IsQ0FBMUI7QUFDQSxVQUFNRSxXQUFXRCxrQkFBa0JiLElBQWxCLENBQXVCZSxNQUF2QixDQUE4QkgsaUJBQTlCLENBQWpCO0FBQ0EsVUFBTXFCLHVEQUNIbkIsU0FBU0csS0FBVCxDQUFlQyxLQURaLEVBQ29CYSxPQURwQiw4QkFFSGpCLFNBQVNLLElBQVQsQ0FBY0QsS0FGWCxFQUVtQnhCLEVBRm5CLGFBQU47QUFJQSxVQUFJbUIsa0JBQWtCYixJQUFsQixDQUF1QnVCLFNBQTNCLEVBQXNDO0FBQ3BDM0UsZUFBT0MsSUFBUCxDQUFZZ0Usa0JBQWtCYixJQUFsQixDQUF1QnVCLFNBQW5DLEVBQThDdEUsT0FBOUMsQ0FBc0QsVUFBQ3VFLFdBQUQsRUFBaUI7QUFDckVTLG1CQUFTVCxXQUFULElBQXdCWCxrQkFBa0JiLElBQWxCLENBQXVCdUIsU0FBdkIsQ0FBaUNDLFdBQWpDLEVBQThDQyxLQUF0RTtBQUNELFNBRkQ7QUFHRDtBQUNELFVBQUlaLGtCQUFrQmIsSUFBbEIsQ0FBdUJvQixPQUEzQixFQUFvQztBQUNsQ3hFLGVBQU9DLElBQVAsQ0FBWWdFLGtCQUFrQmIsSUFBbEIsQ0FBdUJvQixPQUFuQyxFQUE0Q25FLE9BQTVDLENBQW9ELFVBQUNpRixLQUFELEVBQVc7QUFDN0RELG1CQUFTQyxLQUFULElBQWtCRixPQUFPRSxLQUFQLENBQWxCO0FBQ0QsU0FGRDtBQUdEO0FBQ0QsYUFBTyxLQUFLM0YsS0FBTCxFQUFZc0Usa0JBQWtCYixJQUFsQixDQUF1QkUsS0FBbkMsRUFDTkMsTUFETSxDQUNDOEIsUUFERCxFQUVOeEMsSUFGTSxDQUVEO0FBQUEsZUFBTSxPQUFLaUIsWUFBTCxDQUFrQlYsSUFBbEIsRUFBd0JOLEVBQXhCLEVBQTRCLElBQTVCLEVBQWtDa0IsaUJBQWxDLENBQU47QUFBQSxPQUZDLENBQVA7QUFHRDs7O3VDQUVrQlosSSxFQUFNTixFLEVBQUlrQixpQixFQUFtQm1CLE8sRUFBc0I7QUFBQTtBQUFBOztBQUFBLFVBQWJDLE1BQWEsdUVBQUosRUFBSTs7QUFDcEUsVUFBTW5CLG9CQUFvQmIsS0FBS0wsT0FBTCxDQUFhM0MsYUFBYixDQUEyQjRELGlCQUEzQixDQUExQjtBQUNBLFVBQU1FLFdBQVdELGtCQUFrQmIsSUFBbEIsQ0FBdUJlLE1BQXZCLENBQThCSCxpQkFBOUIsQ0FBakI7QUFDQSxVQUFNcUIsV0FBVyxFQUFqQjtBQUNBckYsYUFBT0MsSUFBUCxDQUFZZ0Usa0JBQWtCYixJQUFsQixDQUF1Qm9CLE9BQW5DLEVBQTRDbkUsT0FBNUMsQ0FBb0QsVUFBQ2lGLEtBQUQsRUFBVztBQUM3RCxZQUFJRixPQUFPRSxLQUFQLE1BQWtCbkMsU0FBdEIsRUFBaUM7QUFDL0JrQyxtQkFBU0MsS0FBVCxJQUFrQkYsT0FBT0UsS0FBUCxDQUFsQjtBQUNEO0FBQ0YsT0FKRDtBQUtBLFVBQU1iLDZEQUNIUCxTQUFTRyxLQUFULENBQWVDLEtBRFosRUFDb0JhLE9BRHBCLGdDQUVIakIsU0FBU0ssSUFBVCxDQUFjRCxLQUZYLEVBRW1CeEIsRUFGbkIsZUFBTjtBQUlBLFVBQUltQixrQkFBa0JiLElBQWxCLENBQXVCdUIsU0FBM0IsRUFBc0M7QUFDcEMzRSxlQUFPQyxJQUFQLENBQVlnRSxrQkFBa0JiLElBQWxCLENBQXVCdUIsU0FBbkMsRUFBOEN0RSxPQUE5QyxDQUFzRCxVQUFDdUUsV0FBRCxFQUFpQjtBQUNyRUgscUJBQVdHLFdBQVgsSUFBMEJYLGtCQUFrQmIsSUFBbEIsQ0FBdUJ1QixTQUF2QixDQUFpQ0MsV0FBakMsRUFBOENDLEtBQXhFO0FBQ0QsU0FGRDtBQUdEO0FBQ0QsYUFBT3pELG1CQUFtQixLQUFLekIsS0FBTCxFQUFZc0Usa0JBQWtCYixJQUFsQixDQUF1QkUsS0FBbkMsQ0FBbkIsRUFBOERtQixVQUE5RCxFQUEwRSxFQUFFM0IsTUFBRixFQUFNcUMsZ0JBQU4sRUFBMUUsRUFDTnhCLE1BRE0sQ0FDQzBCLFFBREQsRUFFTnhDLElBRk0sQ0FFRDtBQUFBLGVBQU0sT0FBS2lCLFlBQUwsQ0FBa0JWLElBQWxCLEVBQXdCTixFQUF4QixFQUE0QixJQUE1QixFQUFrQ2tCLGlCQUFsQyxDQUFOO0FBQUEsT0FGQyxDQUFQO0FBR0Q7OzsyQkFFTVosSSxFQUFNTixFLEVBQUlrQixpQixFQUFtQm1CLE8sRUFBUztBQUFBO0FBQUE7O0FBQzNDLFVBQU1sQixvQkFBb0JiLEtBQUtMLE9BQUwsQ0FBYTNDLGFBQWIsQ0FBMkI0RCxpQkFBM0IsQ0FBMUI7QUFDQSxVQUFNRSxXQUFXRCxrQkFBa0JiLElBQWxCLENBQXVCZSxNQUF2QixDQUE4QkgsaUJBQTlCLENBQWpCO0FBQ0EsVUFBTVMsK0RBQ0hQLFNBQVNHLEtBQVQsQ0FBZUMsS0FEWixFQUNvQmEsT0FEcEIsaUNBRUhqQixTQUFTSyxJQUFULENBQWNELEtBRlgsRUFFbUJ4QixFQUZuQixnQkFBTjtBQUlBLFVBQUltQixrQkFBa0JiLElBQWxCLENBQXVCdUIsU0FBM0IsRUFBc0M7QUFDcEMzRSxlQUFPQyxJQUFQLENBQVlnRSxrQkFBa0JiLElBQWxCLENBQXVCdUIsU0FBbkMsRUFBOEN0RSxPQUE5QyxDQUFzRCxVQUFDdUUsV0FBRCxFQUFpQjtBQUNyRUgscUJBQVdHLFdBQVgsSUFBMEJYLGtCQUFrQmIsSUFBbEIsQ0FBdUJ1QixTQUF2QixDQUFpQ0MsV0FBakMsRUFBOENDLEtBQXhFO0FBQ0QsU0FGRDtBQUdEO0FBQ0QsYUFBT3pELG1CQUFtQixLQUFLekIsS0FBTCxFQUFZc0Usa0JBQWtCYixJQUFsQixDQUF1QkUsS0FBbkMsQ0FBbkIsRUFBOERtQixVQUE5RCxFQUEwRVMsTUFBMUUsR0FDTnJDLElBRE0sQ0FDRDtBQUFBLGVBQU0sT0FBS2lCLFlBQUwsQ0FBa0JWLElBQWxCLEVBQXdCTixFQUF4QixFQUE0QixJQUE1QixFQUFrQ2tCLGlCQUFsQyxDQUFOO0FBQUEsT0FEQyxDQUFQO0FBRUQ7OzswQkFFSzFDLEMsRUFBRztBQUNQLGFBQU8sbUJBQVNzQixPQUFULENBQWlCLEtBQUtqRCxLQUFMLEVBQVk0RixHQUFaLENBQWdCakUsRUFBRWIsS0FBbEIsQ0FBakIsRUFDTm9DLElBRE0sQ0FDRCxVQUFDMkMsQ0FBRDtBQUFBLGVBQU9BLEVBQUVDLElBQVQ7QUFBQSxPQURDLENBQVA7QUFFRCIsImZpbGUiOiJzcWwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQmx1ZWJpcmQgZnJvbSAnYmx1ZWJpcmQnO1xuaW1wb3J0IGtuZXggZnJvbSAna25leCc7XG5pbXBvcnQgeyBTdG9yYWdlIH0gZnJvbSAncGx1bXAnO1xuaW1wb3J0IHsgYmxvY2tSZWFkIH0gZnJvbSAnLi9ibG9ja1JlYWQnO1xuY29uc3QgJGtuZXggPSBTeW1ib2woJyRrbmV4Jyk7XG5cbmZ1bmN0aW9uIGZpeENhc2UoZGF0YSwgc2NoZW1hKSB7XG4gIE9iamVjdC5rZXlzKHNjaGVtYS5hdHRyaWJ1dGVzKS5jb25jYXQoT2JqZWN0LmtleXMoc2NoZW1hLnJlbGF0aW9uc2hpcHMpKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBpZiAoKGtleS50b0xvd2VyQ2FzZSgpICE9PSBrZXkpICYmIChkYXRhW2tleS50b0xvd2VyQ2FzZSgpXSkpIHtcbiAgICAgIGRhdGFba2V5XSA9IGRhdGFba2V5LnRvTG93ZXJDYXNlKCldOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG4gICAgICBkZWxldGUgZGF0YVtrZXkudG9Mb3dlckNhc2UoKV07IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZGF0YTtcbn1cblxuZnVuY3Rpb24gZGVzZXJpYWxpemVXaGVyZShxdWVyeSwgYmxvY2spIHtcbiAgY29uc3QgY2FyID0gYmxvY2tbMF07XG4gIGNvbnN0IGNkciA9IGJsb2NrLnNsaWNlKDEpO1xuICBpZiAoQXJyYXkuaXNBcnJheShjZHJbMF0pKSB7XG4gICAgcmV0dXJuIGNkci5yZWR1Y2UoKHN1YlF1ZXJ5LCBzdWJCbG9jaykgPT4gZGVzZXJpYWxpemVXaGVyZShzdWJRdWVyeSwgc3ViQmxvY2spLCBxdWVyeSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHF1ZXJ5W2Nhcl0uYXBwbHkocXVlcnksIGNkcik7XG4gIH1cbn1cblxuZnVuY3Rpb24gb2JqZWN0VG9XaGVyZUNoYWluKHF1ZXJ5LCBibG9jaywgY29udGV4dCkge1xuICByZXR1cm4gT2JqZWN0LmtleXMoYmxvY2spLnJlZHVjZSgocSwga2V5KSA9PiB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYmxvY2tba2V5XSkpIHtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZVdoZXJlKHF1ZXJ5LCBTdG9yYWdlLm1hc3NSZXBsYWNlKGJsb2NrW2tleV0sIGNvbnRleHQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHEud2hlcmUoa2V5LCBibG9ja1trZXldKTtcbiAgICB9XG4gIH0sIHF1ZXJ5KTtcbn1cblxuXG5leHBvcnQgY2xhc3MgUEdTdG9yZSBleHRlbmRzIFN0b3JhZ2Uge1xuICBjb25zdHJ1Y3RvcihvcHRzID0ge30pIHtcbiAgICBzdXBlcihvcHRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gT2JqZWN0LmFzc2lnbihcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBjbGllbnQ6ICdwb3N0Z3JlcycsXG4gICAgICAgIGRlYnVnOiBmYWxzZSxcbiAgICAgICAgY29ubmVjdGlvbjoge1xuICAgICAgICAgIHVzZXI6ICdwb3N0Z3JlcycsXG4gICAgICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICAgICAgcG9ydDogNTQzMixcbiAgICAgICAgICBwYXNzd29yZDogJycsXG4gICAgICAgICAgY2hhcnNldDogJ3V0ZjgnLFxuICAgICAgICB9LFxuICAgICAgICBwb29sOiB7XG4gICAgICAgICAgbWF4OiAyMCxcbiAgICAgICAgICBtaW46IDAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgb3B0cy5zcWxcbiAgICApO1xuICAgIHRoaXNbJGtuZXhdID0ga25leChvcHRpb25zKTtcbiAgfVxuXG4gIC8qXG4gICAgbm90ZSB0aGF0IGtuZXguanMgXCJ0aGVuXCIgZnVuY3Rpb25zIGFyZW4ndCBhY3R1YWxseSBwcm9taXNlcyB0aGUgd2F5IHlvdSB0aGluayB0aGV5IGFyZS5cbiAgICB5b3UgY2FuIHJldHVybiBrbmV4Lmluc2VydCgpLmludG8oKSwgd2hpY2ggaGFzIGEgdGhlbigpIG9uIGl0LCBidXQgdGhhdCB0aGVuYWJsZSBpc24ndFxuICAgIGFuIGFjdHVhbCBwcm9taXNlIHlldC4gU28gaW5zdGVhZCB3ZSdyZSByZXR1cm5pbmcgQmx1ZWJpcmQucmVzb2x2ZSh0aGVuYWJsZSk7XG4gICovXG5cbiAgdGVhcmRvd24oKSB7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdLmRlc3Ryb3koKTtcbiAgfVxuXG4gIHdyaXRlKHQsIHYpIHtcbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgY29uc3QgaWQgPSB2W3QuJHNjaGVtYS4kaWRdO1xuICAgICAgY29uc3QgdXBkYXRlT2JqZWN0ID0ge307XG4gICAgICBmb3IgKGNvbnN0IGF0dHJOYW1lIGluIHQuJHNjaGVtYS5hdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmICh2W2F0dHJOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgLy8gY29weSBmcm9tIHYgdG8gdGhlIGJlc3Qgb2Ygb3VyIGFiaWxpdHlcbiAgICAgICAgICBpZiAodC4kc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLnR5cGUgPT09ICdhcnJheScpIHtcbiAgICAgICAgICAgIHVwZGF0ZU9iamVjdFthdHRyTmFtZS50b0xvd2VyQ2FzZSgpXSA9IHZbYXR0ck5hbWVdLmNvbmNhdCgpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodC4kc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLnR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB1cGRhdGVPYmplY3RbYXR0ck5hbWUudG9Mb3dlckNhc2UoKV0gPSBPYmplY3QuYXNzaWduKHt9LCB2W2F0dHJOYW1lXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVwZGF0ZU9iamVjdFthdHRyTmFtZS50b0xvd2VyQ2FzZSgpXSA9IHZbYXR0ck5hbWVdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKChpZCA9PT0gdW5kZWZpbmVkKSAmJiAodGhpcy50ZXJtaW5hbCkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLmluc2VydCh1cGRhdGVPYmplY3QpLnJldHVybmluZyh0LiRzY2hlbWEuJGlkKVxuICAgICAgICAudGhlbigoY3JlYXRlZElkKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZCh0LCBjcmVhdGVkSWRbMF0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdGhpc1ska25leF0odC4kbmFtZSkud2hlcmUoeyBbdC4kc2NoZW1hLiRpZF06IGlkIH0pLnVwZGF0ZSh1cGRhdGVPYmplY3QpXG4gICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkKHQsIGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjcmVhdGUgbmV3IGNvbnRlbnQgaW4gYSBub24tdGVybWluYWwgc3RvcmUnKTtcbiAgICAgIH1cbiAgICB9KS50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm5vdGlmeVVwZGF0ZSh0LCByZXN1bHRbdC4kc2NoZW1hLiRpZF0sIHJlc3VsdCkudGhlbigoKSA9PiByZXN1bHQpO1xuICAgIH0pO1xuICB9XG5cbiAgcmVhZE9uZSh0LCBpZCkge1xuICAgIHJldHVybiBibG9ja1JlYWQodCwgdGhpc1ska25leF0sIHsgW3QuJHNjaGVtYS4kaWRdOiBpZCB9KVxuICAgIC50aGVuKChvKSA9PiB7XG4gICAgICBpZiAob1swXSkge1xuICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgcmV0dXJuIGZpeENhc2Uob1swXSwgdC4kc2NoZW1hKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcmVhZE1hbnkodHlwZSwgaWQsIHJlbGF0aW9uc2hpcFRpdGxlKSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay50eXBlLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgbGV0IHRvU2VsZWN0ID0gW3NpZGVJbmZvLm90aGVyLmZpZWxkLCBzaWRlSW5mby5zZWxmLmZpZWxkXTtcbiAgICBpZiAocmVsYXRpb25zaGlwQmxvY2sudHlwZS4kZXh0cmFzKSB7XG4gICAgICB0b1NlbGVjdCA9IHRvU2VsZWN0LmNvbmNhdChPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRleHRyYXMpKTtcbiAgICB9XG4gICAgY29uc3Qgd2hlcmVCbG9jayA9IHt9O1xuICAgIGlmIChzaWRlSW5mby5zZWxmLnF1ZXJ5KSB7XG4gICAgICB3aGVyZUJsb2NrW3NpZGVJbmZvLnNlbGYuZmllbGRdID0gc2lkZUluZm8uc2VsZi5xdWVyeS5sb2dpYztcbiAgICB9IGVsc2Uge1xuICAgICAgd2hlcmVCbG9ja1tzaWRlSW5mby5zZWxmLmZpZWxkXSA9IGlkO1xuICAgIH1cbiAgICBpZiAocmVsYXRpb25zaGlwQmxvY2sudHlwZS4kcmVzdHJpY3QpIHtcbiAgICAgIE9iamVjdC5rZXlzKHJlbGF0aW9uc2hpcEJsb2NrLnR5cGUuJHJlc3RyaWN0KS5mb3JFYWNoKChyZXN0cmljdGlvbikgPT4ge1xuICAgICAgICB3aGVyZUJsb2NrW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnR5cGUuJHJlc3RyaWN0W3Jlc3RyaWN0aW9uXS52YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKHNpZGVJbmZvLnNlbGYucXVlcnkgJiYgc2lkZUluZm8uc2VsZi5xdWVyeS5yZXF1aXJlTG9hZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZWFkT25lKHR5cGUsIGlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB7IGlkIH07XG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbigoY29udGV4dCkgPT4ge1xuICAgICAgcmV0dXJuIG9iamVjdFRvV2hlcmVDaGFpbih0aGlzWyRrbmV4XShyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRuYW1lKSwgd2hlcmVCbG9jaywgY29udGV4dClcbiAgICAgIC5zZWxlY3QodG9TZWxlY3QpO1xuICAgIH0pXG4gICAgLnRoZW4oKGwpID0+IHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIFtyZWxhdGlvbnNoaXBUaXRsZV06IGwsXG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlKHQsIGlkKSB7XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHQuJG5hbWUpLndoZXJlKHsgW3QuJHNjaGVtYS4kaWRdOiBpZCB9KS5kZWxldGUoKVxuICAgIC50aGVuKChvKSA9PiBvKTtcbiAgfVxuXG4gIGFkZCh0eXBlLCBpZCwgcmVsYXRpb25zaGlwVGl0bGUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay50eXBlLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3QgbmV3RmllbGQgPSB7XG4gICAgICBbc2lkZUluZm8ub3RoZXIuZmllbGRdOiBjaGlsZElkLFxuICAgICAgW3NpZGVJbmZvLnNlbGYuZmllbGRdOiBpZCxcbiAgICB9O1xuICAgIGlmIChyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRyZXN0cmljdCkge1xuICAgICAgT2JqZWN0LmtleXMocmVsYXRpb25zaGlwQmxvY2sudHlwZS4kcmVzdHJpY3QpLmZvckVhY2goKHJlc3RyaWN0aW9uKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW3Jlc3RyaWN0aW9uXSA9IHJlbGF0aW9uc2hpcEJsb2NrLnR5cGUuJHJlc3RyaWN0W3Jlc3RyaWN0aW9uXS52YWx1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAocmVsYXRpb25zaGlwQmxvY2sudHlwZS4kZXh0cmFzKSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNbJGtuZXhdKHJlbGF0aW9uc2hpcEJsb2NrLnR5cGUuJG5hbWUpXG4gICAgLmluc2VydChuZXdGaWVsZClcbiAgICAudGhlbigoKSA9PiB0aGlzLm5vdGlmeVVwZGF0ZSh0eXBlLCBpZCwgbnVsbCwgcmVsYXRpb25zaGlwVGl0bGUpKTtcbiAgfVxuXG4gIG1vZGlmeVJlbGF0aW9uc2hpcCh0eXBlLCBpZCwgcmVsYXRpb25zaGlwVGl0bGUsIGNoaWxkSWQsIGV4dHJhcyA9IHt9KSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay50eXBlLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3QgbmV3RmllbGQgPSB7fTtcbiAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRleHRyYXMpLmZvckVhY2goKGV4dHJhKSA9PiB7XG4gICAgICBpZiAoZXh0cmFzW2V4dHJhXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIG5ld0ZpZWxkW2V4dHJhXSA9IGV4dHJhc1tleHRyYV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3Qgd2hlcmVCbG9jayA9IHtcbiAgICAgIFtzaWRlSW5mby5vdGhlci5maWVsZF06IGNoaWxkSWQsXG4gICAgICBbc2lkZUluZm8uc2VsZi5maWVsZF06IGlkLFxuICAgIH07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnR5cGUuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRyZXN0cmljdCkuZm9yRWFjaCgocmVzdHJpY3Rpb24pID0+IHtcbiAgICAgICAgd2hlcmVCbG9ja1tyZXN0cmljdGlvbl0gPSByZWxhdGlvbnNoaXBCbG9jay50eXBlLiRyZXN0cmljdFtyZXN0cmljdGlvbl0udmFsdWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdFRvV2hlcmVDaGFpbih0aGlzWyRrbmV4XShyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRuYW1lKSwgd2hlcmVCbG9jaywgeyBpZCwgY2hpbGRJZCB9KVxuICAgIC51cGRhdGUobmV3RmllbGQpXG4gICAgLnRoZW4oKCkgPT4gdGhpcy5ub3RpZnlVcGRhdGUodHlwZSwgaWQsIG51bGwsIHJlbGF0aW9uc2hpcFRpdGxlKSk7XG4gIH1cblxuICByZW1vdmUodHlwZSwgaWQsIHJlbGF0aW9uc2hpcFRpdGxlLCBjaGlsZElkKSB7XG4gICAgY29uc3QgcmVsYXRpb25zaGlwQmxvY2sgPSB0eXBlLiRzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgc2lkZUluZm8gPSByZWxhdGlvbnNoaXBCbG9jay50eXBlLiRzaWRlc1tyZWxhdGlvbnNoaXBUaXRsZV07XG4gICAgY29uc3Qgd2hlcmVCbG9jayA9IHtcbiAgICAgIFtzaWRlSW5mby5vdGhlci5maWVsZF06IGNoaWxkSWQsXG4gICAgICBbc2lkZUluZm8uc2VsZi5maWVsZF06IGlkLFxuICAgIH07XG4gICAgaWYgKHJlbGF0aW9uc2hpcEJsb2NrLnR5cGUuJHJlc3RyaWN0KSB7XG4gICAgICBPYmplY3Qua2V5cyhyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRyZXN0cmljdCkuZm9yRWFjaCgocmVzdHJpY3Rpb24pID0+IHtcbiAgICAgICAgd2hlcmVCbG9ja1tyZXN0cmljdGlvbl0gPSByZWxhdGlvbnNoaXBCbG9jay50eXBlLiRyZXN0cmljdFtyZXN0cmljdGlvbl0udmFsdWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdFRvV2hlcmVDaGFpbih0aGlzWyRrbmV4XShyZWxhdGlvbnNoaXBCbG9jay50eXBlLiRuYW1lKSwgd2hlcmVCbG9jaykuZGVsZXRlKClcbiAgICAudGhlbigoKSA9PiB0aGlzLm5vdGlmeVVwZGF0ZSh0eXBlLCBpZCwgbnVsbCwgcmVsYXRpb25zaGlwVGl0bGUpKTtcbiAgfVxuXG4gIHF1ZXJ5KHEpIHtcbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSh0aGlzWyRrbmV4XS5yYXcocS5xdWVyeSkpXG4gICAgLnRoZW4oKGQpID0+IGQucm93cyk7XG4gIH1cbn1cbiJdfQ==
