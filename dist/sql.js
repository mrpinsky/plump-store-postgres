var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import * as knex from 'knex';
import { Storage } from 'plump';
import { readQuery, bulkQuery } from './queryString';
import { writeRelationshipQuery } from './writeRelationshipQuery';
function rearrangeData(type, data) {
    var retVal = {
        typeName: type.name,
        attributes: {},
        relationships: {},
        id: data[type.idAttribute],
    };
    for (var attrName in type.attributes) {
        retVal.attributes[attrName] = data[attrName];
    }
    for (var relName in type.relationships) {
        retVal.relationships[relName] = data[relName];
    }
    return retVal;
}
var PGStore = (function (_super) {
    __extends(PGStore, _super);
    function PGStore(opts) {
        if (opts === void 0) { opts = {}; }
        var _this = _super.call(this, opts) || this;
        _this.queryCache = {};
        var options = Object.assign({}, {
            client: 'postgres',
            debug: false,
            connection: {
                user: 'postgres',
                host: 'localhost',
                port: 5432,
                password: '',
                charset: 'utf8',
            },
            pool: {
                max: 20,
                min: 0,
            },
        }, opts.sql);
        _this.knex = knex(options);
        return _this;
    }
    /*
      note that knex.js "then" functions aren't actually promises the way you think they are.
      you can return knex.insert().into(), which has a then() on it, but that thenable isn't
      an actual promise yet. So instead we're returning Promise.resolve(thenable);
    */
    PGStore.prototype.teardown = function () {
        return this.knex.destroy();
    };
    PGStore.prototype.allocateId = function (typeName) {
        return this.knex.raw('select nextval(?::regclass);', typeName + "_id_seq")
            .then(function (data) { return data.rows[0].nextval; });
    };
    PGStore.prototype.addSchema = function (t) {
        var _this = this;
        return _super.prototype.addSchema.call(this, t)
            .then(function () {
            _this.queryCache[t.typeName] = {
                attributes: readQuery(t.schema),
                bulkRead: bulkQuery(t.schema),
                relationships: {}
            };
            Object.keys(t.schema.relationships).forEach(function (relName) {
                _this.queryCache[t.typeName].relationships[relName] = writeRelationshipQuery(t.schema, relName);
            });
        });
    };
    PGStore.prototype.writeAttributes = function (value) {
        var _this = this;
        var updateObject = this.validateInput(value);
        var typeInfo = this.getSchema(value.typeName);
        return Promise.resolve()
            .then(function () {
            if ((updateObject.id === undefined) && (_this.terminal)) {
                return _this.knex(typeInfo.storeData.sql.tableName).insert(updateObject.attributes).returning(typeInfo.idAttribute)
                    .then(function (createdId) {
                    return _this.readAttributes({ typeName: value.typeName, id: createdId });
                });
            }
            else if (updateObject.id !== undefined) {
                return _this.knex(updateObject.typeName).where((_a = {}, _a[typeInfo.idAttribute] = updateObject.id, _a)).update(updateObject.attributes)
                    .then(function () {
                    return _this.readAttributes({ typeName: value.typeName, id: updateObject.id });
                });
            }
            else {
                throw new Error('Cannot create new content in a non-terminal store');
            }
            var _a;
        })
            .then(function (result) {
            _this.fireWriteUpdate(Object.assign({}, result, { invalidate: ['attributes'] }));
            return result;
        });
    };
    PGStore.prototype.readAttributes = function (value) {
        var _this = this;
        return this.knex.raw(this.queryCache[value.typeName].attributes.queryString, value.id)
            .then(function (o) {
            if (o.rows[0]) {
                return rearrangeData(_this.getSchema(value.typeName), o.rows[0]);
            }
            else {
                return null;
            }
        });
    };
    PGStore.prototype.bulkRead = function (item) {
        var schema = this.getSchema(item.typeName);
        var query = this.queryCache[item.typeName].bulkRead;
        return this.knex.raw(query.queryString, item.id)
            .then(function (o) {
            if (o.rows[0]) {
                var arrangedArray = o.rows.map(function (row) { return rearrangeData(schema, row); });
                var rootItem = arrangedArray.filter(function (it) { return it.id === item.id; })[0];
                return {
                    data: rootItem,
                    included: arrangedArray.filter(function (it) { return it.id !== item.id; }),
                };
            }
            else {
                return null;
            }
        });
    };
    PGStore.prototype.readRelationship = function (value, relRefName) {
        var relName = relRefName.indexOf('relationships.') === 0
            ? relRefName.split('.')[1]
            : relRefName;
        var schema = this.getSchema(value.typeName);
        var rel = schema.relationships[relName].type;
        var otherRelName = rel.sides[relName].otherName;
        var sqlData = rel.storeData.sql;
        var selectBase = "\"" + sqlData.tableName + "\".\"" + sqlData.joinFields[otherRelName] + "\" as id";
        var selectExtras = '';
        if (rel.extras) {
            selectExtras = ", jsonb_build_object(" + Object.keys(rel.extras).map(function (extra) { return "'" + extra + "', \"" + sqlData.tableName + "\".\"" + extra + "\""; }).join(', ') + ") as meta"; // tslint:disable-line max-line-length
        }
        var where = sqlData.where === undefined
            ? (_a = {}, _a[sqlData.joinFields[relName]] = value.id, _a) : this.knex.raw(sqlData.where[relName], value.id);
        return this.knex(sqlData.tableName)
            .as(relName)
            .where(where)
            .select(this.knex.raw("" + selectBase + selectExtras))
            .then(function (l) {
            return {
                typeName: value.typeName,
                id: value.id,
                relationships: (_a = {},
                    _a[relName] = l,
                    _a)
            };
            var _a;
        });
        var _a;
    };
    PGStore.prototype.delete = function (value) {
        var _this = this;
        var schema = this.getSchema(value.typeName);
        return this.knex(schema.storeData.sql.tableName).where((_a = {}, _a[schema.idAttribute] = value.id, _a)).delete()
            .then(function (o) {
            _this.fireWriteUpdate({ id: value.id, typeName: value.typeName, invalidate: ['attributes', 'relationships'] });
            return o;
        });
        var _a;
    };
    PGStore.prototype.writeRelationshipItem = function (value, relName, child) {
        var _this = this;
        var subQuery = this.queryCache[value.typeName].relationships[relName];
        var schema = this.getSchema(value.typeName);
        var childData = schema.relationships[relName].type.sides[relName];
        return this.knex.raw(subQuery.queryString, subQuery.fields.map(function (f) {
            if (f === 'item.id') {
                return value.id;
            }
            else if (f === 'child.id') {
                return child.id;
            }
            else {
                return child.meta[f];
            }
        }))
            .then(function () {
            _this.fireWriteUpdate(Object.assign({}, value, { invalidate: ["relationships." + relName] }));
            _this.fireWriteUpdate({
                id: child.id,
                typeName: childData.otherType,
                invalidate: ["relationships." + childData.otherName],
            });
        });
    };
    PGStore.prototype.deleteRelationshipItem = function (value, relName, child) {
        var _this = this;
        var schema = this.getSchema(value.typeName);
        var rel = schema.relationships[relName].type;
        var otherRelName = rel.sides[relName].otherName;
        var sqlData = rel.storeData.sql;
        var childData = schema.relationships[relName].type.sides[relName];
        return this.knex(sqlData.tableName)
            .where((_a = {},
            _a[sqlData.joinFields[otherRelName]] = child.id,
            _a[sqlData.joinFields[relName]] = value.id,
            _a))
            .delete()
            .then(function () {
            _this.fireWriteUpdate(Object.assign({}, value, { invalidate: ["relationships." + relName] }));
            _this.fireWriteUpdate({
                id: child.id,
                typeName: childData.otherType,
                invalidate: ["relationships." + childData.otherName],
            });
        });
        var _a;
    };
    PGStore.prototype.query = function (q) {
        return Promise.resolve(this.knex.raw(q.query))
            .then(function (d) { return d.rows; });
    };
    return PGStore;
}(Storage));
export { PGStore };

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LEtBQUssQ0FBQyxFQUFFO1lBQzVDLEdBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBRyxLQUFLLENBQUMsRUFBRTtnQkFDdkM7YUFDRCxNQUFNLEVBQUU7YUFDUixJQUFJLENBQUM7WUFDSixLQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLG1CQUFpQixPQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM3RixLQUFJLENBQUMsZUFBZSxDQUFDO2dCQUNuQixFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUU7Z0JBQ1osUUFBUSxFQUFFLFNBQVMsQ0FBQyxTQUFTO2dCQUM3QixVQUFVLEVBQUUsQ0FBQyxtQkFBaUIsU0FBUyxDQUFDLFNBQVcsQ0FBQzthQUNyRCxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQzs7SUFDTCxDQUFDO0lBRUQsdUJBQUssR0FBTCxVQUFNLENBQUM7UUFDTCxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDN0MsSUFBSSxDQUFDLFVBQUMsQ0FBQyxJQUFLLE9BQUEsQ0FBQyxDQUFDLElBQUksRUFBTixDQUFNLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBQ0gsY0FBQztBQUFELENBdk5BLEFBdU5DLENBdk40QixPQUFPLEdBdU5uQyIsImZpbGUiOiJzcWwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBrbmV4IGZyb20gJ2tuZXgnO1xuaW1wb3J0IHsgU3RvcmFnZSwgSW5kZWZpbml0ZU1vZGVsRGF0YSwgTW9kZWxEYXRhLCBNb2RlbFNjaGVtYSwgTW9kZWxSZWZlcmVuY2UsIFJlbGF0aW9uc2hpcEl0ZW0sIFRlcm1pbmFsU3RvcmUgfSBmcm9tICdwbHVtcCc7XG5pbXBvcnQgeyByZWFkUXVlcnksIGJ1bGtRdWVyeSB9IGZyb20gJy4vcXVlcnlTdHJpbmcnO1xuaW1wb3J0IHsgUGFyYW1ldGVyaXplZFF1ZXJ5IH0gZnJvbSAnLi9zZW1pUXVlcnknO1xuaW1wb3J0IHsgd3JpdGVSZWxhdGlvbnNoaXBRdWVyeSB9IGZyb20gJy4vd3JpdGVSZWxhdGlvbnNoaXBRdWVyeSc7XG5cbmZ1bmN0aW9uIHJlYXJyYW5nZURhdGEodHlwZTogTW9kZWxTY2hlbWEsIGRhdGE6IGFueSk6IE1vZGVsRGF0YSB7XG4gIGNvbnN0IHJldFZhbDogTW9kZWxEYXRhID0ge1xuICAgIHR5cGVOYW1lOiB0eXBlLm5hbWUsXG4gICAgYXR0cmlidXRlczoge30sXG4gICAgcmVsYXRpb25zaGlwczoge30sXG4gICAgaWQ6IGRhdGFbdHlwZS5pZEF0dHJpYnV0ZV0sXG4gIH07XG4gIGZvciAoY29uc3QgYXR0ck5hbWUgaW4gdHlwZS5hdHRyaWJ1dGVzKSB7XG4gICAgcmV0VmFsLmF0dHJpYnV0ZXNbYXR0ck5hbWVdID0gZGF0YVthdHRyTmFtZV07XG4gIH1cbiAgZm9yIChjb25zdCByZWxOYW1lIGluIHR5cGUucmVsYXRpb25zaGlwcykge1xuICAgIHJldFZhbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdID0gZGF0YVtyZWxOYW1lXTtcbiAgfVxuICByZXR1cm4gcmV0VmFsO1xufVxuXG5leHBvcnQgY2xhc3MgUEdTdG9yZSBleHRlbmRzIFN0b3JhZ2UgaW1wbGVtZW50cyBUZXJtaW5hbFN0b3JlIHtcblxuICBwcml2YXRlIGtuZXg7XG4gIHByaXZhdGUgcXVlcnlDYWNoZToge1xuICAgIFt0eXBlTmFtZTogc3RyaW5nXToge1xuICAgICAgYXR0cmlidXRlczogUGFyYW1ldGVyaXplZFF1ZXJ5LFxuICAgICAgYnVsa1JlYWQ6IFBhcmFtZXRlcml6ZWRRdWVyeSxcbiAgICAgIHJlbGF0aW9uc2hpcHM6IHtcbiAgICAgICAgW3JlbE5hbWU6IHN0cmluZ106IFBhcmFtZXRlcml6ZWRRdWVyeSxcbiAgICAgIH1cbiAgICB9XG4gIH0gPSB7fTtcblxuICBjb25zdHJ1Y3RvcihvcHRzOiB7W29wdDogc3RyaW5nXTogYW55fSA9IHt9KSB7XG4gICAgc3VwZXIob3B0cyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oXG4gICAgICB7fSxcbiAgICAgIHtcbiAgICAgICAgY2xpZW50OiAncG9zdGdyZXMnLFxuICAgICAgICBkZWJ1ZzogZmFsc2UsXG4gICAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgICB1c2VyOiAncG9zdGdyZXMnLFxuICAgICAgICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgICAgICAgIHBvcnQ6IDU0MzIsXG4gICAgICAgICAgcGFzc3dvcmQ6ICcnLFxuICAgICAgICAgIGNoYXJzZXQ6ICd1dGY4JyxcbiAgICAgICAgfSxcbiAgICAgICAgcG9vbDoge1xuICAgICAgICAgIG1heDogMjAsXG4gICAgICAgICAgbWluOiAwLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG9wdHMuc3FsXG4gICAgKTtcbiAgICB0aGlzLmtuZXggPSBrbmV4KG9wdGlvbnMpO1xuICB9XG5cbiAgLypcbiAgICBub3RlIHRoYXQga25leC5qcyBcInRoZW5cIiBmdW5jdGlvbnMgYXJlbid0IGFjdHVhbGx5IHByb21pc2VzIHRoZSB3YXkgeW91IHRoaW5rIHRoZXkgYXJlLlxuICAgIHlvdSBjYW4gcmV0dXJuIGtuZXguaW5zZXJ0KCkuaW50bygpLCB3aGljaCBoYXMgYSB0aGVuKCkgb24gaXQsIGJ1dCB0aGF0IHRoZW5hYmxlIGlzbid0XG4gICAgYW4gYWN0dWFsIHByb21pc2UgeWV0LiBTbyBpbnN0ZWFkIHdlJ3JlIHJldHVybmluZyBQcm9taXNlLnJlc29sdmUodGhlbmFibGUpO1xuICAqL1xuXG4gIHRlYXJkb3duKCkge1xuICAgIHJldHVybiB0aGlzLmtuZXguZGVzdHJveSgpO1xuICB9XG5cbiAgYWxsb2NhdGVJZCh0eXBlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICByZXR1cm4gdGhpcy5rbmV4LnJhdygnc2VsZWN0IG5leHR2YWwoPzo6cmVnY2xhc3MpOycsIGAke3R5cGVOYW1lfV9pZF9zZXFgKVxuICAgIC50aGVuKChkYXRhKSA9PiBkYXRhLnJvd3NbMF0ubmV4dHZhbCk7XG4gIH1cblxuICBhZGRTY2hlbWEodDoge3R5cGVOYW1lOiBzdHJpbmcsIHNjaGVtYTogTW9kZWxTY2hlbWF9KSB7XG4gICAgcmV0dXJuIHN1cGVyLmFkZFNjaGVtYSh0KVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIHRoaXMucXVlcnlDYWNoZVt0LnR5cGVOYW1lXSA9IHtcbiAgICAgICAgYXR0cmlidXRlczogcmVhZFF1ZXJ5KHQuc2NoZW1hKSxcbiAgICAgICAgYnVsa1JlYWQ6IGJ1bGtRdWVyeSh0LnNjaGVtYSksXG4gICAgICAgIHJlbGF0aW9uc2hpcHM6IHt9XG4gICAgICB9O1xuICAgICAgT2JqZWN0LmtleXModC5zY2hlbWEucmVsYXRpb25zaGlwcykuZm9yRWFjaChyZWxOYW1lID0+IHtcbiAgICAgICAgdGhpcy5xdWVyeUNhY2hlW3QudHlwZU5hbWVdLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0gPSB3cml0ZVJlbGF0aW9uc2hpcFF1ZXJ5KHQuc2NoZW1hLCByZWxOYW1lKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cblxuICB3cml0ZUF0dHJpYnV0ZXModmFsdWU6IEluZGVmaW5pdGVNb2RlbERhdGEpOiBQcm9taXNlPE1vZGVsRGF0YT4ge1xuICAgIGNvbnN0IHVwZGF0ZU9iamVjdCA9IHRoaXMudmFsaWRhdGVJbnB1dCh2YWx1ZSk7XG4gICAgY29uc3QgdHlwZUluZm8gPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlTmFtZSk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKCh1cGRhdGVPYmplY3QuaWQgPT09IHVuZGVmaW5lZCkgJiYgKHRoaXMudGVybWluYWwpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmtuZXgodHlwZUluZm8uc3RvcmVEYXRhLnNxbC50YWJsZU5hbWUpLmluc2VydCh1cGRhdGVPYmplY3QuYXR0cmlidXRlcykucmV0dXJuaW5nKHR5cGVJbmZvLmlkQXR0cmlidXRlKVxuICAgICAgICAudGhlbigoY3JlYXRlZElkKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZEF0dHJpYnV0ZXMoeyB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsIGlkOiBjcmVhdGVkSWQgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh1cGRhdGVPYmplY3QuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5rbmV4KHVwZGF0ZU9iamVjdC50eXBlTmFtZSkud2hlcmUoeyBbdHlwZUluZm8uaWRBdHRyaWJ1dGVdOiB1cGRhdGVPYmplY3QuaWQgfSkudXBkYXRlKHVwZGF0ZU9iamVjdC5hdHRyaWJ1dGVzKVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZEF0dHJpYnV0ZXMoeyB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsIGlkOiB1cGRhdGVPYmplY3QuaWQgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY3JlYXRlIG5ldyBjb250ZW50IGluIGEgbm9uLXRlcm1pbmFsIHN0b3JlJyk7XG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICB0aGlzLmZpcmVXcml0ZVVwZGF0ZShPYmplY3QuYXNzaWduKHt9LCByZXN1bHQsIHsgaW52YWxpZGF0ZTogWydhdHRyaWJ1dGVzJ10gfSkpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KTtcbiAgfVxuXG4gIHJlYWRBdHRyaWJ1dGVzKHZhbHVlOiBNb2RlbFJlZmVyZW5jZSk6IFByb21pc2U8TW9kZWxEYXRhPiB7XG4gICAgcmV0dXJuIHRoaXMua25leC5yYXcodGhpcy5xdWVyeUNhY2hlW3ZhbHVlLnR5cGVOYW1lXS5hdHRyaWJ1dGVzLnF1ZXJ5U3RyaW5nLCB2YWx1ZS5pZClcbiAgICAudGhlbigobykgPT4ge1xuICAgICAgaWYgKG8ucm93c1swXSkge1xuICAgICAgICByZXR1cm4gcmVhcnJhbmdlRGF0YSh0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlTmFtZSksIG8ucm93c1swXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGJ1bGtSZWFkKGl0ZW06IE1vZGVsUmVmZXJlbmNlKSB7XG4gICAgY29uc3Qgc2NoZW1hID0gdGhpcy5nZXRTY2hlbWEoaXRlbS50eXBlTmFtZSk7XG4gICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJ5Q2FjaGVbaXRlbS50eXBlTmFtZV0uYnVsa1JlYWQ7XG4gICAgcmV0dXJuIHRoaXMua25leC5yYXcocXVlcnkucXVlcnlTdHJpbmcsIGl0ZW0uaWQpXG4gICAgLnRoZW4oKG8pID0+IHtcbiAgICAgIGlmIChvLnJvd3NbMF0pIHtcbiAgICAgICAgY29uc3QgYXJyYW5nZWRBcnJheSA9IG8ucm93cy5tYXAoKHJvdykgPT4gcmVhcnJhbmdlRGF0YShzY2hlbWEsIHJvdykpO1xuICAgICAgICBjb25zdCByb290SXRlbSA9IGFycmFuZ2VkQXJyYXkuZmlsdGVyKChpdCkgPT4gaXQuaWQgPT09IGl0ZW0uaWQpWzBdO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IHJvb3RJdGVtLFxuICAgICAgICAgIGluY2x1ZGVkOiBhcnJhbmdlZEFycmF5LmZpbHRlcigoaXQpID0+IGl0LmlkICE9PSBpdGVtLmlkKSxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcmVhZFJlbGF0aW9uc2hpcCh2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIHJlbFJlZk5hbWU6IHN0cmluZyk6IFByb21pc2U8TW9kZWxEYXRhPiB7XG4gICAgY29uc3QgcmVsTmFtZSA9IHJlbFJlZk5hbWUuaW5kZXhPZigncmVsYXRpb25zaGlwcy4nKSA9PT0gMFxuICAgICAgPyByZWxSZWZOYW1lLnNwbGl0KCcuJylbMV1cbiAgICAgIDogcmVsUmVmTmFtZTtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlTmFtZSk7XG4gICAgY29uc3QgcmVsID0gc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgICBjb25zdCBvdGhlclJlbE5hbWUgPSByZWwuc2lkZXNbcmVsTmFtZV0ub3RoZXJOYW1lO1xuICAgIGNvbnN0IHNxbERhdGEgPSByZWwuc3RvcmVEYXRhLnNxbDtcbiAgICBjb25zdCBzZWxlY3RCYXNlID0gYFwiJHtzcWxEYXRhLnRhYmxlTmFtZX1cIi5cIiR7c3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV19XCIgYXMgaWRgO1xuICAgIGxldCBzZWxlY3RFeHRyYXMgPSAnJztcbiAgICBpZiAocmVsLmV4dHJhcykge1xuICAgICAgc2VsZWN0RXh0cmFzID0gYCwganNvbmJfYnVpbGRfb2JqZWN0KCR7T2JqZWN0LmtleXMocmVsLmV4dHJhcykubWFwKChleHRyYSkgPT4gYCcke2V4dHJhfScsIFwiJHtzcWxEYXRhLnRhYmxlTmFtZX1cIi5cIiR7ZXh0cmF9XCJgKS5qb2luKCcsICcpfSkgYXMgbWV0YWA7IC8vIHRzbGludDpkaXNhYmxlLWxpbmUgbWF4LWxpbmUtbGVuZ3RoXG4gICAgfVxuXG4gICAgY29uc3Qgd2hlcmUgPSBzcWxEYXRhLndoZXJlID09PSB1bmRlZmluZWRcbiAgICAgID8geyBbc3FsRGF0YS5qb2luRmllbGRzW3JlbE5hbWVdXTogdmFsdWUuaWQgfVxuICAgICAgOiB0aGlzLmtuZXgucmF3KHNxbERhdGEud2hlcmVbcmVsTmFtZV0sIHZhbHVlLmlkKTtcblxuICAgIHJldHVybiB0aGlzLmtuZXgoc3FsRGF0YS50YWJsZU5hbWUpXG4gICAgLmFzKHJlbE5hbWUpXG4gICAgLndoZXJlKHdoZXJlKVxuICAgIC5zZWxlY3QodGhpcy5rbmV4LnJhdyhgJHtzZWxlY3RCYXNlfSR7c2VsZWN0RXh0cmFzfWApKVxuICAgIC50aGVuKChsKSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsXG4gICAgICAgIGlkOiB2YWx1ZS5pZCxcbiAgICAgICAgcmVsYXRpb25zaGlwczoge1xuICAgICAgICAgIFtyZWxOYW1lXTogbCxcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UpIHtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlTmFtZSk7XG4gICAgcmV0dXJuIHRoaXMua25leChzY2hlbWEuc3RvcmVEYXRhLnNxbC50YWJsZU5hbWUpLndoZXJlKHsgW3NjaGVtYS5pZEF0dHJpYnV0ZV06IHZhbHVlLmlkIH0pLmRlbGV0ZSgpXG4gICAgLnRoZW4oKG8pID0+IHtcbiAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKHsgaWQ6IHZhbHVlLmlkLCB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsIGludmFsaWRhdGU6IFsnYXR0cmlidXRlcycsICdyZWxhdGlvbnNoaXBzJ10gfSk7XG4gICAgICByZXR1cm4gbztcbiAgICB9KTtcbiAgfVxuXG4gIHdyaXRlUmVsYXRpb25zaGlwSXRlbSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZywgY2hpbGQ6IFJlbGF0aW9uc2hpcEl0ZW0pIHtcbiAgICBjb25zdCBzdWJRdWVyeSA9IHRoaXMucXVlcnlDYWNoZVt2YWx1ZS50eXBlTmFtZV0ucmVsYXRpb25zaGlwc1tyZWxOYW1lXTtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlTmFtZSk7XG4gICAgY29uc3QgY2hpbGREYXRhID0gc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZS5zaWRlc1tyZWxOYW1lXTtcbiAgICByZXR1cm4gdGhpcy5rbmV4LnJhdyhcbiAgICAgIHN1YlF1ZXJ5LnF1ZXJ5U3RyaW5nLFxuICAgICAgc3ViUXVlcnkuZmllbGRzLm1hcCgoZikgPT4ge1xuICAgICAgICBpZiAoZiA9PT0gJ2l0ZW0uaWQnKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlLmlkO1xuICAgICAgICB9IGVsc2UgaWYgKGYgPT09ICdjaGlsZC5pZCcpIHtcbiAgICAgICAgICByZXR1cm4gY2hpbGQuaWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGNoaWxkLm1ldGFbZl07XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKE9iamVjdC5hc3NpZ24oe30sIHZhbHVlLCB7IGludmFsaWRhdGU6IFtgcmVsYXRpb25zaGlwcy4ke3JlbE5hbWV9YF0gfSkpO1xuICAgICAgdGhpcy5maXJlV3JpdGVVcGRhdGUoe1xuICAgICAgICBpZDogY2hpbGQuaWQsXG4gICAgICAgIHR5cGVOYW1lOiBjaGlsZERhdGEub3RoZXJUeXBlLFxuICAgICAgICBpbnZhbGlkYXRlOiBbYHJlbGF0aW9uc2hpcHMuJHtjaGlsZERhdGEub3RoZXJOYW1lfWBdLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVSZWxhdGlvbnNoaXBJdGVtKHZhbHVlOiBNb2RlbFJlZmVyZW5jZSwgcmVsTmFtZTogc3RyaW5nLCBjaGlsZDogUmVsYXRpb25zaGlwSXRlbSkge1xuICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZ2V0U2NoZW1hKHZhbHVlLnR5cGVOYW1lKTtcbiAgICBjb25zdCByZWwgPSBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuICAgIGNvbnN0IG90aGVyUmVsTmFtZSA9IHJlbC5zaWRlc1tyZWxOYW1lXS5vdGhlck5hbWU7XG4gICAgY29uc3Qgc3FsRGF0YSA9IHJlbC5zdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IGNoaWxkRGF0YSA9IHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLnR5cGUuc2lkZXNbcmVsTmFtZV07XG4gICAgcmV0dXJuIHRoaXMua25leChzcWxEYXRhLnRhYmxlTmFtZSlcbiAgICAud2hlcmUoe1xuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tvdGhlclJlbE5hbWVdXTogY2hpbGQuaWQsXG4gICAgICBbc3FsRGF0YS5qb2luRmllbGRzW3JlbE5hbWVdXTogdmFsdWUuaWQsXG4gICAgfSlcbiAgICAuZGVsZXRlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLmZpcmVXcml0ZVVwZGF0ZShPYmplY3QuYXNzaWduKHt9LCB2YWx1ZSwgeyBpbnZhbGlkYXRlOiBbYHJlbGF0aW9uc2hpcHMuJHtyZWxOYW1lfWBdIH0pKTtcbiAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKHtcbiAgICAgICAgaWQ6IGNoaWxkLmlkLFxuICAgICAgICB0eXBlTmFtZTogY2hpbGREYXRhLm90aGVyVHlwZSxcbiAgICAgICAgaW52YWxpZGF0ZTogW2ByZWxhdGlvbnNoaXBzLiR7Y2hpbGREYXRhLm90aGVyTmFtZX1gXSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcXVlcnkocSkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5rbmV4LnJhdyhxLnF1ZXJ5KSlcbiAgICAudGhlbigoZCkgPT4gZC5yb3dzKTtcbiAgfVxufVxuIl19
