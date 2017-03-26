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
import * as Bluebird from 'bluebird';
import * as knex from 'knex';
import { Storage } from 'plump';
import { readQuery } from './queryString';
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
      an actual promise yet. So instead we're returning Bluebird.resolve(thenable);
    */
    PGStore.prototype.teardown = function () {
        return this.knex.destroy();
    };
    PGStore.prototype.cache = function (value) {
        throw new Error('SQLSTORE is not a cache');
    };
    PGStore.prototype.cacheAttributes = function (value) {
        throw new Error('SQLSTORE is not a cache');
    };
    PGStore.prototype.cacheRelationship = function (value) {
        throw new Error('SQLSTORE is not a cache');
    };
    PGStore.prototype.wipe = function (value, key) {
        throw new Error('SQLSTORE is not a cache');
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
        return Bluebird.resolve()
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
    // bulkRead(typeName, id) {
    //   const t = this.getType(typeName);
    //   let query = t.cacheGet(this, 'bulkRead');
    //   if (query === undefined) {
    //     query = bulkQuery(t);
    //     t.cacheSet(this, 'bulkRead', query);
    //   }
    //   return this.knex.raw(query, id)
    //   .then((o) => {
    //     if (o.rows[0]) {
    //       const arrangedArray = o.rows.map((row) => rearrangeData(t, row));
    //       const rootItem = arrangedArray.filter((it) => it.id === id)[0];
    //       return {
    //         data: rootItem,
    //         included: arrangedArray.filter((it) => it.id !== id),
    //       };
    //     } else {
    //       return null;
    //     }
    //   });
    // }
    PGStore.prototype.readRelationship = function (value, relName) {
        var schema = this.getSchema(value.typeName);
        var rel = schema.relationships[relName].type;
        var otherRelName = rel.sides[relName].otherName;
        var sqlData = rel.storeData.sql;
        var selectBase = "\"" + sqlData.tableName + "\".\"" + sqlData.joinFields[otherRelName] + "\" as id";
        var selectExtras = '';
        if (rel.extras) {
            selectExtras = ", jsonb_build_object(" + Object.keys(rel.extras).map(function (extra) { return "'" + extra + "', \"" + sqlData.tableName + "\".\"" + extra + "\""; }).join(', ') + ") as meta"; // tslint:disable-line max-line-length
        }
        return this.knex(sqlData.tableName)
            .where(sqlData.joinFields[relName], value.id)
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
        return Bluebird.resolve(this.knex.raw(q.query))
            .then(function (d) { return d.rows; });
    };
    return PGStore;
}(Storage));
export { PGStore };

//# sourceMappingURL=data:application/json;charset=utf8;base64,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Q0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFDSCxjQUFDO0FBQUQsQ0FoT0EsQUFnT0MsQ0FoTzRCLE9BQU8sR0FnT25DIiwiZmlsZSI6InNxbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEJsdWViaXJkIGZyb20gJ2JsdWViaXJkJztcbmltcG9ydCAqIGFzIGtuZXggZnJvbSAna25leCc7XG5pbXBvcnQgeyBTdG9yYWdlLCBJbmRlZmluaXRlTW9kZWxEYXRhLCBNb2RlbERhdGEsIE1vZGVsU2NoZW1hLCBNb2RlbFJlZmVyZW5jZSwgUmVsYXRpb25zaGlwSXRlbSB9IGZyb20gJ3BsdW1wJztcbmltcG9ydCB7IHJlYWRRdWVyeSB9IGZyb20gJy4vcXVlcnlTdHJpbmcnO1xuaW1wb3J0IHsgUGFyYW1ldGVyaXplZFF1ZXJ5IH0gZnJvbSAnLi9zZW1pUXVlcnknO1xuaW1wb3J0IHsgd3JpdGVSZWxhdGlvbnNoaXBRdWVyeSB9IGZyb20gJy4vd3JpdGVSZWxhdGlvbnNoaXBRdWVyeSc7XG5cbmZ1bmN0aW9uIHJlYXJyYW5nZURhdGEodHlwZTogTW9kZWxTY2hlbWEsIGRhdGE6IGFueSk6IE1vZGVsRGF0YSB7XG4gIGNvbnN0IHJldFZhbDogTW9kZWxEYXRhID0ge1xuICAgIHR5cGVOYW1lOiB0eXBlLm5hbWUsXG4gICAgYXR0cmlidXRlczoge30sXG4gICAgcmVsYXRpb25zaGlwczoge30sXG4gICAgaWQ6IGRhdGFbdHlwZS5pZEF0dHJpYnV0ZV0sXG4gIH07XG4gIGZvciAoY29uc3QgYXR0ck5hbWUgaW4gdHlwZS5hdHRyaWJ1dGVzKSB7XG4gICAgcmV0VmFsLmF0dHJpYnV0ZXNbYXR0ck5hbWVdID0gZGF0YVthdHRyTmFtZV07XG4gIH1cbiAgZm9yIChjb25zdCByZWxOYW1lIGluIHR5cGUucmVsYXRpb25zaGlwcykge1xuICAgIHJldFZhbC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdID0gZGF0YVtyZWxOYW1lXTtcbiAgfVxuICByZXR1cm4gcmV0VmFsO1xufVxuXG5leHBvcnQgY2xhc3MgUEdTdG9yZSBleHRlbmRzIFN0b3JhZ2Uge1xuXG4gIHByaXZhdGUga25leDtcbiAgcHJpdmF0ZSBxdWVyeUNhY2hlOiB7XG4gICAgW3R5cGVOYW1lOiBzdHJpbmddOiB7XG4gICAgICBhdHRyaWJ1dGVzOiBQYXJhbWV0ZXJpemVkUXVlcnksXG4gICAgICByZWxhdGlvbnNoaXBzOiB7XG4gICAgICAgIFtyZWxOYW1lOiBzdHJpbmddOiBQYXJhbWV0ZXJpemVkUXVlcnksXG4gICAgICB9XG4gICAgfVxuICB9ID0ge307XG5cbiAgY29uc3RydWN0b3Iob3B0czoge1tvcHQ6IHN0cmluZ106IGFueX0gPSB7fSkge1xuICAgIHN1cGVyKG9wdHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKFxuICAgICAge30sXG4gICAgICB7XG4gICAgICAgIGNsaWVudDogJ3Bvc3RncmVzJyxcbiAgICAgICAgZGVidWc6IGZhbHNlLFxuICAgICAgICBjb25uZWN0aW9uOiB7XG4gICAgICAgICAgdXNlcjogJ3Bvc3RncmVzJyxcbiAgICAgICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgICAgICBwb3J0OiA1NDMyLFxuICAgICAgICAgIHBhc3N3b3JkOiAnJyxcbiAgICAgICAgICBjaGFyc2V0OiAndXRmOCcsXG4gICAgICAgIH0sXG4gICAgICAgIHBvb2w6IHtcbiAgICAgICAgICBtYXg6IDIwLFxuICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvcHRzLnNxbFxuICAgICk7XG4gICAgdGhpcy5rbmV4ID0ga25leChvcHRpb25zKTtcbiAgfVxuXG4gIC8qXG4gICAgbm90ZSB0aGF0IGtuZXguanMgXCJ0aGVuXCIgZnVuY3Rpb25zIGFyZW4ndCBhY3R1YWxseSBwcm9taXNlcyB0aGUgd2F5IHlvdSB0aGluayB0aGV5IGFyZS5cbiAgICB5b3UgY2FuIHJldHVybiBrbmV4Lmluc2VydCgpLmludG8oKSwgd2hpY2ggaGFzIGEgdGhlbigpIG9uIGl0LCBidXQgdGhhdCB0aGVuYWJsZSBpc24ndFxuICAgIGFuIGFjdHVhbCBwcm9taXNlIHlldC4gU28gaW5zdGVhZCB3ZSdyZSByZXR1cm5pbmcgQmx1ZWJpcmQucmVzb2x2ZSh0aGVuYWJsZSk7XG4gICovXG5cbiAgdGVhcmRvd24oKSB7XG4gICAgcmV0dXJuIHRoaXMua25leC5kZXN0cm95KCk7XG4gIH1cblxuICBjYWNoZSh2YWx1ZTogTW9kZWxEYXRhKTogQmx1ZWJpcmQ8TW9kZWxEYXRhPiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTUUxTVE9SRSBpcyBub3QgYSBjYWNoZScpO1xuICB9XG4gIGNhY2hlQXR0cmlidXRlcyh2YWx1ZTogTW9kZWxEYXRhKTogQmx1ZWJpcmQ8TW9kZWxEYXRhPiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTUUxTVE9SRSBpcyBub3QgYSBjYWNoZScpO1xuICB9XG4gIGNhY2hlUmVsYXRpb25zaGlwKHZhbHVlOiBNb2RlbERhdGEpOiBCbHVlYmlyZDxNb2RlbERhdGE+IHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1NRTFNUT1JFIGlzIG5vdCBhIGNhY2hlJyk7XG4gIH1cbiAgd2lwZSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIGtleT86IHN0cmluZyB8IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTUUxTVE9SRSBpcyBub3QgYSBjYWNoZScpO1xuICB9XG5cblxuXG4gIGFsbG9jYXRlSWQodHlwZU5hbWU6IHN0cmluZyk6IEJsdWViaXJkPG51bWJlcj4ge1xuICAgIHJldHVybiB0aGlzLmtuZXgucmF3KCdzZWxlY3QgbmV4dHZhbCg/OjpyZWdjbGFzcyk7JywgYCR7dHlwZU5hbWV9X2lkX3NlcWApXG4gICAgLnRoZW4oKGRhdGEpID0+IGRhdGEucm93c1swXS5uZXh0dmFsKTtcbiAgfVxuXG4gIGFkZFNjaGVtYSh0OiB7dHlwZU5hbWU6IHN0cmluZywgc2NoZW1hOiBNb2RlbFNjaGVtYX0pIHtcbiAgICByZXR1cm4gc3VwZXIuYWRkU2NoZW1hKHQpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgdGhpcy5xdWVyeUNhY2hlW3QudHlwZU5hbWVdID0ge1xuICAgICAgICBhdHRyaWJ1dGVzOiByZWFkUXVlcnkodC5zY2hlbWEpLFxuICAgICAgICByZWxhdGlvbnNoaXBzOiB7fVxuICAgICAgfTtcbiAgICAgIE9iamVjdC5rZXlzKHQuc2NoZW1hLnJlbGF0aW9uc2hpcHMpLmZvckVhY2gocmVsTmFtZSA9PiB7XG4gICAgICAgIHRoaXMucXVlcnlDYWNoZVt0LnR5cGVOYW1lXS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdID0gd3JpdGVSZWxhdGlvbnNoaXBRdWVyeSh0LnNjaGVtYSwgcmVsTmFtZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgd3JpdGVBdHRyaWJ1dGVzKHZhbHVlOiBJbmRlZmluaXRlTW9kZWxEYXRhKTogQmx1ZWJpcmQ8TW9kZWxEYXRhPiB7XG4gICAgY29uc3QgdXBkYXRlT2JqZWN0ID0gdGhpcy52YWxpZGF0ZUlucHV0KHZhbHVlKTtcbiAgICBjb25zdCB0eXBlSW5mbyA9IHRoaXMuZ2V0U2NoZW1hKHZhbHVlLnR5cGVOYW1lKTtcbiAgICByZXR1cm4gQmx1ZWJpcmQucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKCh1cGRhdGVPYmplY3QuaWQgPT09IHVuZGVmaW5lZCkgJiYgKHRoaXMudGVybWluYWwpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmtuZXgodHlwZUluZm8uc3RvcmVEYXRhLnNxbC50YWJsZU5hbWUpLmluc2VydCh1cGRhdGVPYmplY3QuYXR0cmlidXRlcykucmV0dXJuaW5nKHR5cGVJbmZvLmlkQXR0cmlidXRlKVxuICAgICAgICAudGhlbigoY3JlYXRlZElkKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZEF0dHJpYnV0ZXMoeyB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsIGlkOiBjcmVhdGVkSWQgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh1cGRhdGVPYmplY3QuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5rbmV4KHVwZGF0ZU9iamVjdC50eXBlTmFtZSkud2hlcmUoeyBbdHlwZUluZm8uaWRBdHRyaWJ1dGVdOiB1cGRhdGVPYmplY3QuaWQgfSkudXBkYXRlKHVwZGF0ZU9iamVjdC5hdHRyaWJ1dGVzKVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZEF0dHJpYnV0ZXMoeyB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsIGlkOiB1cGRhdGVPYmplY3QuaWQgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY3JlYXRlIG5ldyBjb250ZW50IGluIGEgbm9uLXRlcm1pbmFsIHN0b3JlJyk7XG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICB0aGlzLmZpcmVXcml0ZVVwZGF0ZShPYmplY3QuYXNzaWduKHt9LCByZXN1bHQsIHsgaW52YWxpZGF0ZTogWydhdHRyaWJ1dGVzJ10gfSkpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KTtcbiAgfVxuXG4gIHJlYWRBdHRyaWJ1dGVzKHZhbHVlOiBNb2RlbFJlZmVyZW5jZSk6IEJsdWViaXJkPE1vZGVsRGF0YT4ge1xuICAgIHJldHVybiB0aGlzLmtuZXgucmF3KHRoaXMucXVlcnlDYWNoZVt2YWx1ZS50eXBlTmFtZV0uYXR0cmlidXRlcy5xdWVyeVN0cmluZywgdmFsdWUuaWQpXG4gICAgLnRoZW4oKG8pID0+IHtcbiAgICAgIGlmIChvLnJvd3NbMF0pIHtcbiAgICAgICAgcmV0dXJuIHJlYXJyYW5nZURhdGEodGhpcy5nZXRTY2hlbWEodmFsdWUudHlwZU5hbWUpLCBvLnJvd3NbMF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBidWxrUmVhZCh0eXBlTmFtZSwgaWQpIHtcbiAgLy8gICBjb25zdCB0ID0gdGhpcy5nZXRUeXBlKHR5cGVOYW1lKTtcbiAgLy8gICBsZXQgcXVlcnkgPSB0LmNhY2hlR2V0KHRoaXMsICdidWxrUmVhZCcpO1xuICAvLyAgIGlmIChxdWVyeSA9PT0gdW5kZWZpbmVkKSB7XG4gIC8vICAgICBxdWVyeSA9IGJ1bGtRdWVyeSh0KTtcbiAgLy8gICAgIHQuY2FjaGVTZXQodGhpcywgJ2J1bGtSZWFkJywgcXVlcnkpO1xuICAvLyAgIH1cbiAgLy8gICByZXR1cm4gdGhpcy5rbmV4LnJhdyhxdWVyeSwgaWQpXG4gIC8vICAgLnRoZW4oKG8pID0+IHtcbiAgLy8gICAgIGlmIChvLnJvd3NbMF0pIHtcbiAgLy8gICAgICAgY29uc3QgYXJyYW5nZWRBcnJheSA9IG8ucm93cy5tYXAoKHJvdykgPT4gcmVhcnJhbmdlRGF0YSh0LCByb3cpKTtcbiAgLy8gICAgICAgY29uc3Qgcm9vdEl0ZW0gPSBhcnJhbmdlZEFycmF5LmZpbHRlcigoaXQpID0+IGl0LmlkID09PSBpZClbMF07XG4gIC8vICAgICAgIHJldHVybiB7XG4gIC8vICAgICAgICAgZGF0YTogcm9vdEl0ZW0sXG4gIC8vICAgICAgICAgaW5jbHVkZWQ6IGFycmFuZ2VkQXJyYXkuZmlsdGVyKChpdCkgPT4gaXQuaWQgIT09IGlkKSxcbiAgLy8gICAgICAgfTtcbiAgLy8gICAgIH0gZWxzZSB7XG4gIC8vICAgICAgIHJldHVybiBudWxsO1xuICAvLyAgICAgfVxuICAvLyAgIH0pO1xuICAvLyB9XG5cbiAgcmVhZFJlbGF0aW9uc2hpcCh2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZyk6IEJsdWViaXJkPE1vZGVsRGF0YT4ge1xuICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZ2V0U2NoZW1hKHZhbHVlLnR5cGVOYW1lKTtcbiAgICBjb25zdCByZWwgPSBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuICAgIGNvbnN0IG90aGVyUmVsTmFtZSA9IHJlbC5zaWRlc1tyZWxOYW1lXS5vdGhlck5hbWU7XG4gICAgY29uc3Qgc3FsRGF0YSA9IHJlbC5zdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IHNlbGVjdEJhc2UgPSBgXCIke3NxbERhdGEudGFibGVOYW1lfVwiLlwiJHtzcWxEYXRhLmpvaW5GaWVsZHNbb3RoZXJSZWxOYW1lXX1cIiBhcyBpZGA7XG4gICAgbGV0IHNlbGVjdEV4dHJhcyA9ICcnO1xuICAgIGlmIChyZWwuZXh0cmFzKSB7XG4gICAgICBzZWxlY3RFeHRyYXMgPSBgLCBqc29uYl9idWlsZF9vYmplY3QoJHtPYmplY3Qua2V5cyhyZWwuZXh0cmFzKS5tYXAoKGV4dHJhKSA9PiBgJyR7ZXh0cmF9JywgXCIke3NxbERhdGEudGFibGVOYW1lfVwiLlwiJHtleHRyYX1cImApLmpvaW4oJywgJyl9KSBhcyBtZXRhYDsgLy8gdHNsaW50OmRpc2FibGUtbGluZSBtYXgtbGluZS1sZW5ndGhcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5rbmV4KHNxbERhdGEudGFibGVOYW1lKVxuICAgIC53aGVyZShzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV0sIHZhbHVlLmlkKVxuICAgIC5zZWxlY3QodGhpcy5rbmV4LnJhdyhgJHtzZWxlY3RCYXNlfSR7c2VsZWN0RXh0cmFzfWApKVxuICAgIC50aGVuKChsKSA9PiB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsXG4gICAgICAgIGlkOiB2YWx1ZS5pZCxcbiAgICAgICAgcmVsYXRpb25zaGlwczoge1xuICAgICAgICAgIFtyZWxOYW1lXTogbCxcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UpIHtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlTmFtZSk7XG4gICAgcmV0dXJuIHRoaXMua25leChzY2hlbWEuc3RvcmVEYXRhLnNxbC50YWJsZU5hbWUpLndoZXJlKHsgW3NjaGVtYS5pZEF0dHJpYnV0ZV06IHZhbHVlLmlkIH0pLmRlbGV0ZSgpXG4gICAgLnRoZW4oKG8pID0+IHtcbiAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKHsgaWQ6IHZhbHVlLmlkLCB0eXBlTmFtZTogdmFsdWUudHlwZU5hbWUsIGludmFsaWRhdGU6IFsnYXR0cmlidXRlcycsICdyZWxhdGlvbnNoaXBzJ10gfSk7XG4gICAgICByZXR1cm4gbztcbiAgICB9KTtcbiAgfVxuXG4gIHdyaXRlUmVsYXRpb25zaGlwSXRlbSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZywgY2hpbGQ6IFJlbGF0aW9uc2hpcEl0ZW0pIHtcbiAgICBjb25zdCBzdWJRdWVyeSA9IHRoaXMucXVlcnlDYWNoZVt2YWx1ZS50eXBlTmFtZV0ucmVsYXRpb25zaGlwc1tyZWxOYW1lXTtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlTmFtZSk7XG4gICAgY29uc3QgY2hpbGREYXRhID0gc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZS5zaWRlc1tyZWxOYW1lXTtcbiAgICByZXR1cm4gdGhpcy5rbmV4LnJhdyhcbiAgICAgIHN1YlF1ZXJ5LnF1ZXJ5U3RyaW5nLFxuICAgICAgc3ViUXVlcnkuZmllbGRzLm1hcCgoZikgPT4ge1xuICAgICAgICBpZiAoZiA9PT0gJ2l0ZW0uaWQnKSB7XG4gICAgICAgICAgcmV0dXJuIHZhbHVlLmlkO1xuICAgICAgICB9IGVsc2UgaWYgKGYgPT09ICdjaGlsZC5pZCcpIHtcbiAgICAgICAgICByZXR1cm4gY2hpbGQuaWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGNoaWxkLm1ldGFbZl07XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKE9iamVjdC5hc3NpZ24oe30sIHZhbHVlLCB7IGludmFsaWRhdGU6IFtgcmVsYXRpb25zaGlwcy4ke3JlbE5hbWV9YF0gfSkpO1xuICAgICAgdGhpcy5maXJlV3JpdGVVcGRhdGUoe1xuICAgICAgICBpZDogY2hpbGQuaWQsXG4gICAgICAgIHR5cGVOYW1lOiBjaGlsZERhdGEub3RoZXJUeXBlLFxuICAgICAgICBpbnZhbGlkYXRlOiBbYHJlbGF0aW9uc2hpcHMuJHtjaGlsZERhdGEub3RoZXJOYW1lfWBdLFxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBkZWxldGVSZWxhdGlvbnNoaXBJdGVtKHZhbHVlOiBNb2RlbFJlZmVyZW5jZSwgcmVsTmFtZTogc3RyaW5nLCBjaGlsZDogUmVsYXRpb25zaGlwSXRlbSkge1xuICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZ2V0U2NoZW1hKHZhbHVlLnR5cGVOYW1lKTtcbiAgICBjb25zdCByZWwgPSBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuICAgIGNvbnN0IG90aGVyUmVsTmFtZSA9IHJlbC5zaWRlc1tyZWxOYW1lXS5vdGhlck5hbWU7XG4gICAgY29uc3Qgc3FsRGF0YSA9IHJlbC5zdG9yZURhdGEuc3FsO1xuICAgIGNvbnN0IGNoaWxkRGF0YSA9IHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLnR5cGUuc2lkZXNbcmVsTmFtZV07XG4gICAgcmV0dXJuIHRoaXMua25leChzcWxEYXRhLnRhYmxlTmFtZSlcbiAgICAud2hlcmUoe1xuICAgICAgW3NxbERhdGEuam9pbkZpZWxkc1tvdGhlclJlbE5hbWVdXTogY2hpbGQuaWQsXG4gICAgICBbc3FsRGF0YS5qb2luRmllbGRzW3JlbE5hbWVdXTogdmFsdWUuaWQsXG4gICAgfSlcbiAgICAuZGVsZXRlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLmZpcmVXcml0ZVVwZGF0ZShPYmplY3QuYXNzaWduKHt9LCB2YWx1ZSwgeyBpbnZhbGlkYXRlOiBbYHJlbGF0aW9uc2hpcHMuJHtyZWxOYW1lfWBdIH0pKTtcbiAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKHtcbiAgICAgICAgaWQ6IGNoaWxkLmlkLFxuICAgICAgICB0eXBlTmFtZTogY2hpbGREYXRhLm90aGVyVHlwZSxcbiAgICAgICAgaW52YWxpZGF0ZTogW2ByZWxhdGlvbnNoaXBzLiR7Y2hpbGREYXRhLm90aGVyTmFtZX1gXSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcXVlcnkocSkge1xuICAgIHJldHVybiBCbHVlYmlyZC5yZXNvbHZlKHRoaXMua25leC5yYXcocS5xdWVyeSkpXG4gICAgLnRoZW4oKGQpID0+IGQucm93cyk7XG4gIH1cbn1cbiJdfQ==
