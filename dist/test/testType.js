"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var plump_1 = require("plump");
exports.ChildrenSchema = {
    sides: {
        parents: { otherType: 'tests', otherName: 'children' },
        children: { otherType: 'tests', otherName: 'parents' },
    },
    storeData: {
        sql: {
            tableName: 'parent_child_relationship',
            joinFields: {
                parents: 'child_id',
                children: 'parent_id',
            },
        },
    }
};
exports.ValenceChildrenSchema = {
    sides: {
        valenceParents: { otherType: 'tests', otherName: 'valenceChildren' },
        valenceChildren: { otherType: 'tests', otherName: 'valenceParents' },
    },
    storeData: {
        sql: {
            tableName: 'valence_children',
            joinFields: {
                valenceParents: 'child_id',
                valenceChildren: 'parent_id',
            },
        },
    },
    extras: {
        perm: {
            type: 'number',
        },
    },
};
exports.QueryChildrenSchema = {
    sides: {
        queryParents: { otherType: 'tests', otherName: 'queryChildren' },
        queryChildren: { otherType: 'tests', otherName: 'queryParents' },
    },
    storeData: {
        sql: {
            tableName: 'query_children',
            joinFields: {
                queryParents: 'child_id',
                queryChildren: 'parent_id',
            },
            joinQuery: {
                queryParents: 'on "tests"."id" = "queryParents"."child_id" and "queryParents"."perm" >= 2',
                queryChildren: 'on "tests"."id" = "queryChildren"."parent_id" and "queryChildren"."perm" >= 2',
            },
            where: {
                queryParents: '"query_children"."child_id" = ? and "query_children"."perm" >= 2',
                queryChildren: '"query_children"."parent_id" = ? and "query_children"."perm" >= 2',
            },
        },
    },
    extras: {
        perm: {
            type: 'number',
        },
    },
};
exports.TestSchema = {
    name: 'tests',
    idAttribute: 'id',
    attributes: {
        id: { type: 'number', readOnly: true },
        name: { type: 'string', readOnly: false },
        otherName: { type: 'string', default: '', readOnly: false },
        extended: { type: 'object', default: {}, readOnly: false },
    },
    relationships: {
        children: { type: exports.ChildrenSchema },
        parents: { type: exports.ChildrenSchema },
        valenceChildren: { type: exports.ValenceChildrenSchema },
        valenceParents: { type: exports.ValenceChildrenSchema },
        queryChildren: { type: exports.QueryChildrenSchema, readOnly: true },
        queryParents: { type: exports.QueryChildrenSchema, readOnly: true },
    },
    storeData: {
        sql: {
            tableName: 'tests',
            bulkQuery: 'where "tests"."id" >= ?',
        },
    }
};
var TestType = (function (_super) {
    __extends(TestType, _super);
    function TestType() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return TestType;
}(plump_1.Model));
TestType.typeName = 'tests';
TestType.schema = exports.TestSchema;
exports.TestType = TestType;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LDZCQUFxQixFQUFFO1FBQy9DLGFBQWEsRUFBRSxFQUFFLElBQUksRUFBRSwyQkFBbUIsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO1FBQzVELFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSwyQkFBbUIsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO0tBQzVEO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsR0FBRyxFQUFFO1lBQ0gsU0FBUyxFQUFFLE9BQU87WUFDbEIsU0FBUyxFQUFFLHlCQUF5QjtTQUNyQztLQUNGO0NBQ0YsQ0FBQztBQUVGO0lBQThCLDRCQUFLO0lBQW5DOztJQUdBLENBQUM7SUFBRCxlQUFDO0FBQUQsQ0FIQSxBQUdDLENBSDZCLGFBQUs7QUFDMUIsaUJBQVEsR0FBRyxPQUFPLENBQUM7QUFDbkIsZUFBTSxHQUFnQixrQkFBVSxDQUFDO0FBRjdCLDRCQUFRIiwiZmlsZSI6InRlc3QvdGVzdFR5cGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNb2RlbFNjaGVtYSwgUmVsYXRpb25zaGlwU2NoZW1hLCBNb2RlbCB9IGZyb20gJ3BsdW1wJztcblxuZXhwb3J0IGNvbnN0IENoaWxkcmVuU2NoZW1hOiBSZWxhdGlvbnNoaXBTY2hlbWEgPSB7XG4gIHNpZGVzOiB7XG4gICAgcGFyZW50czogeyBvdGhlclR5cGU6ICd0ZXN0cycsIG90aGVyTmFtZTogJ2NoaWxkcmVuJyB9LFxuICAgIGNoaWxkcmVuOiB7IG90aGVyVHlwZTogJ3Rlc3RzJywgb3RoZXJOYW1lOiAncGFyZW50cycgfSxcbiAgfSxcbiAgc3RvcmVEYXRhOiB7XG4gICAgc3FsOiB7XG4gICAgICB0YWJsZU5hbWU6ICdwYXJlbnRfY2hpbGRfcmVsYXRpb25zaGlwJyxcbiAgICAgIGpvaW5GaWVsZHM6IHtcbiAgICAgICAgcGFyZW50czogJ2NoaWxkX2lkJyxcbiAgICAgICAgY2hpbGRyZW46ICdwYXJlbnRfaWQnLFxuICAgICAgfSxcbiAgICB9LFxuICB9XG59O1xuXG5leHBvcnQgY29uc3QgVmFsZW5jZUNoaWxkcmVuU2NoZW1hOiBSZWxhdGlvbnNoaXBTY2hlbWEgPSB7XG4gIHNpZGVzOiB7XG4gICAgdmFsZW5jZVBhcmVudHM6IHsgb3RoZXJUeXBlOiAndGVzdHMnLCBvdGhlck5hbWU6ICd2YWxlbmNlQ2hpbGRyZW4nIH0sXG4gICAgdmFsZW5jZUNoaWxkcmVuOiB7IG90aGVyVHlwZTogJ3Rlc3RzJywgb3RoZXJOYW1lOiAndmFsZW5jZVBhcmVudHMnIH0sXG4gIH0sXG4gIHN0b3JlRGF0YToge1xuICAgIHNxbDoge1xuICAgICAgdGFibGVOYW1lOiAndmFsZW5jZV9jaGlsZHJlbicsXG4gICAgICBqb2luRmllbGRzOiB7XG4gICAgICAgIHZhbGVuY2VQYXJlbnRzOiAnY2hpbGRfaWQnLFxuICAgICAgICB2YWxlbmNlQ2hpbGRyZW46ICdwYXJlbnRfaWQnLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBleHRyYXM6IHtcbiAgICBwZXJtOiB7XG4gICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICB9LFxuICB9LFxufTtcblxuZXhwb3J0IGNvbnN0IFF1ZXJ5Q2hpbGRyZW5TY2hlbWE6IFJlbGF0aW9uc2hpcFNjaGVtYSA9IHtcblxuICBzaWRlczoge1xuICAgIHF1ZXJ5UGFyZW50czogeyBvdGhlclR5cGU6ICd0ZXN0cycsIG90aGVyTmFtZTogJ3F1ZXJ5Q2hpbGRyZW4nIH0sXG4gICAgcXVlcnlDaGlsZHJlbjogeyBvdGhlclR5cGU6ICd0ZXN0cycsIG90aGVyTmFtZTogJ3F1ZXJ5UGFyZW50cycgfSxcbiAgfSxcbiAgc3RvcmVEYXRhOiB7XG4gICAgc3FsOiB7XG4gICAgICB0YWJsZU5hbWU6ICdxdWVyeV9jaGlsZHJlbicsXG4gICAgICBqb2luRmllbGRzOiB7XG4gICAgICAgIHF1ZXJ5UGFyZW50czogJ2NoaWxkX2lkJyxcbiAgICAgICAgcXVlcnlDaGlsZHJlbjogJ3BhcmVudF9pZCcsXG4gICAgICB9LFxuICAgICAgam9pblF1ZXJ5OiB7XG4gICAgICAgIHF1ZXJ5UGFyZW50czogJ29uIFwidGVzdHNcIi5cImlkXCIgPSBcInF1ZXJ5UGFyZW50c1wiLlwiY2hpbGRfaWRcIiBhbmQgXCJxdWVyeVBhcmVudHNcIi5cInBlcm1cIiA+PSAyJyxcbiAgICAgICAgcXVlcnlDaGlsZHJlbjogJ29uIFwidGVzdHNcIi5cImlkXCIgPSBcInF1ZXJ5Q2hpbGRyZW5cIi5cInBhcmVudF9pZFwiIGFuZCBcInF1ZXJ5Q2hpbGRyZW5cIi5cInBlcm1cIiA+PSAyJyxcbiAgICAgIH0sXG4gICAgICB3aGVyZToge1xuICAgICAgICBxdWVyeVBhcmVudHM6ICdcInF1ZXJ5X2NoaWxkcmVuXCIuXCJjaGlsZF9pZFwiID0gPyBhbmQgXCJxdWVyeV9jaGlsZHJlblwiLlwicGVybVwiID49IDInLFxuICAgICAgICBxdWVyeUNoaWxkcmVuOiAnXCJxdWVyeV9jaGlsZHJlblwiLlwicGFyZW50X2lkXCIgPSA/IGFuZCBcInF1ZXJ5X2NoaWxkcmVuXCIuXCJwZXJtXCIgPj0gMicsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIGV4dHJhczoge1xuICAgIHBlcm06IHtcbiAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgIH0sXG4gIH0sXG59O1xuXG5leHBvcnQgY29uc3QgVGVzdFNjaGVtYTogTW9kZWxTY2hlbWEgPSB7XG4gIG5hbWU6ICd0ZXN0cycsXG4gIGlkQXR0cmlidXRlOiAnaWQnLFxuICBhdHRyaWJ1dGVzOiB7XG4gICAgaWQ6IHsgdHlwZTogJ251bWJlcicsIHJlYWRPbmx5OiB0cnVlIH0sXG4gICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJywgcmVhZE9ubHk6IGZhbHNlIH0sXG4gICAgb3RoZXJOYW1lOiB7IHR5cGU6ICdzdHJpbmcnLCBkZWZhdWx0OiAnJywgcmVhZE9ubHk6IGZhbHNlIH0sXG4gICAgZXh0ZW5kZWQ6IHsgdHlwZTogJ29iamVjdCcsIGRlZmF1bHQ6IHt9LCByZWFkT25seTogZmFsc2UgfSxcbiAgfSxcbiAgcmVsYXRpb25zaGlwczoge1xuICAgIGNoaWxkcmVuOiB7IHR5cGU6IENoaWxkcmVuU2NoZW1hIH0sXG4gICAgcGFyZW50czogeyB0eXBlOiBDaGlsZHJlblNjaGVtYSB9LFxuICAgIHZhbGVuY2VDaGlsZHJlbjogeyB0eXBlOiBWYWxlbmNlQ2hpbGRyZW5TY2hlbWEgfSxcbiAgICB2YWxlbmNlUGFyZW50czogeyB0eXBlOiBWYWxlbmNlQ2hpbGRyZW5TY2hlbWEgfSxcbiAgICBxdWVyeUNoaWxkcmVuOiB7IHR5cGU6IFF1ZXJ5Q2hpbGRyZW5TY2hlbWEsIHJlYWRPbmx5OiB0cnVlIH0sXG4gICAgcXVlcnlQYXJlbnRzOiB7IHR5cGU6IFF1ZXJ5Q2hpbGRyZW5TY2hlbWEsIHJlYWRPbmx5OiB0cnVlIH0sXG4gIH0sXG4gIHN0b3JlRGF0YToge1xuICAgIHNxbDoge1xuICAgICAgdGFibGVOYW1lOiAndGVzdHMnLFxuICAgICAgYnVsa1F1ZXJ5OiAnd2hlcmUgXCJ0ZXN0c1wiLlwiaWRcIiA+PSA/JyxcbiAgICB9LFxuICB9XG59O1xuXG5leHBvcnQgY2xhc3MgVGVzdFR5cGUgZXh0ZW5kcyBNb2RlbCB7XG4gIHN0YXRpYyB0eXBlTmFtZSA9ICd0ZXN0cyc7XG4gIHN0YXRpYyBzY2hlbWE6IE1vZGVsU2NoZW1hID0gVGVzdFNjaGVtYTtcbn1cbiJdfQ==
