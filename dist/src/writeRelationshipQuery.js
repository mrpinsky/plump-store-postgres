"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function writeRelationshipQuery(schema, relName) {
    var rel = schema.relationships[relName].type;
    var otherRelName = rel.sides[relName].otherName;
    var sqlData = rel.storeData.sql;
    if (rel.extras) {
        var extraArray = Object.keys(rel.extras).concat();
        var insertArray = [
            sqlData.joinFields[otherRelName],
            sqlData.joinFields[relName],
        ].concat(extraArray);
        var insertString = "insert into \"" + sqlData.tableName + "\" (" + insertArray.join(', ') + ")\n      values (" + insertArray.map(function () { return '?'; }).join(', ') + ")\n      on conflict (\"" + sqlData.joinFields[otherRelName] + "\", \"" + sqlData.joinFields[relName] + "\") ";
        return {
            queryString: insertString + " do update set " + extraArray.map(function (v) { return v + " = ?"; }).join(', ') + ";",
            fields: ['child.id', 'item.id'].concat(extraArray).concat(extraArray),
        };
    }
    else {
        var insertArray = [
            sqlData.joinFields[otherRelName],
            sqlData.joinFields[relName],
        ];
        var insertString = "insert into \"" + sqlData.tableName + "\" (" + insertArray.join(', ') + ")\n      values (" + insertArray.map(function () { return '?'; }).join(', ') + ")\n      on conflict (\"" + sqlData.joinFields[otherRelName] + "\", \"" + sqlData.joinFields[relName] + "\") ";
        return {
            queryString: insertString + " do nothing;",
            fields: ['child.id', 'item.id'],
        };
    }
}
exports.writeRelationshipQuery = writeRelationshipQuery;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy93cml0ZVJlbGF0aW9uc2hpcFF1ZXJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBR0EsZ0NBQXVDLE1BQW1CLEVBQUUsT0FBZTtJQUN6RSxJQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQztJQUMvQyxJQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNsRCxJQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQztJQUVsQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNmLElBQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3BELElBQU0sV0FBVyxHQUFHO1lBQ2xCLE9BQU8sQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO1lBQ2hDLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO1NBQzVCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JCLElBQU0sWUFBWSxHQUFHLG1CQUFnQixPQUFPLENBQUMsU0FBUyxZQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUN0RSxXQUFXLENBQUMsR0FBRyxDQUFDLGNBQU0sT0FBQSxHQUFHLEVBQUgsQ0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQ0FDL0IsT0FBTyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsY0FBTyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxTQUFLLENBQUM7UUFDMUYsTUFBTSxDQUFDO1lBQ0wsV0FBVyxFQUFLLFlBQVksdUJBQWtCLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBRyxDQUFDLFNBQU0sRUFBVixDQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQUc7WUFDM0YsTUFBTSxFQUFFLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1NBQ3RFLENBQUM7SUFDSixDQUFDO0lBQUMsSUFBSSxDQUFDLENBQUM7UUFDTixJQUFNLFdBQVcsR0FBRztZQUNsQixPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQztZQUNoQyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztTQUM1QixDQUFDO1FBQ0YsSUFBTSxZQUFZLEdBQUcsbUJBQWdCLE9BQU8sQ0FBQyxTQUFTLFlBQU0sV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMseUJBQ3RFLFdBQVcsQ0FBQyxHQUFHLENBQUMsY0FBTSxPQUFBLEdBQUcsRUFBSCxDQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdDQUMvQixPQUFPLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxjQUFPLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFNBQUssQ0FBQztRQUMxRixNQUFNLENBQUM7WUFDTCxXQUFXLEVBQUssWUFBWSxpQkFBYztZQUMxQyxNQUFNLEVBQUUsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDO1NBQ2hDLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQztBQS9CRCx3REErQkMiLCJmaWxlIjoic3JjL3dyaXRlUmVsYXRpb25zaGlwUXVlcnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNb2RlbFNjaGVtYSB9IGZyb20gJ3BsdW1wJztcbmltcG9ydCB7IFBhcmFtZXRlcml6ZWRRdWVyeSB9IGZyb20gJy4vc2VtaVF1ZXJ5JztcblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlUmVsYXRpb25zaGlwUXVlcnkoc2NoZW1hOiBNb2RlbFNjaGVtYSwgcmVsTmFtZTogc3RyaW5nKTogUGFyYW1ldGVyaXplZFF1ZXJ5IHtcbiAgY29uc3QgcmVsID0gc2NoZW1hLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0udHlwZTtcbiAgY29uc3Qgb3RoZXJSZWxOYW1lID0gcmVsLnNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcbiAgY29uc3Qgc3FsRGF0YSA9IHJlbC5zdG9yZURhdGEuc3FsO1xuXG4gIGlmIChyZWwuZXh0cmFzKSB7XG4gICAgY29uc3QgZXh0cmFBcnJheSA9IE9iamVjdC5rZXlzKHJlbC5leHRyYXMpLmNvbmNhdCgpO1xuICAgIGNvbnN0IGluc2VydEFycmF5ID0gW1xuICAgICAgc3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV0sXG4gICAgICBzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV0sXG4gICAgXS5jb25jYXQoZXh0cmFBcnJheSk7XG4gICAgY29uc3QgaW5zZXJ0U3RyaW5nID0gYGluc2VydCBpbnRvIFwiJHtzcWxEYXRhLnRhYmxlTmFtZX1cIiAoJHtpbnNlcnRBcnJheS5qb2luKCcsICcpfSlcbiAgICAgIHZhbHVlcyAoJHtpbnNlcnRBcnJheS5tYXAoKCkgPT4gJz8nKS5qb2luKCcsICcpfSlcbiAgICAgIG9uIGNvbmZsaWN0IChcIiR7c3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV19XCIsIFwiJHtzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV19XCIpIGA7XG4gICAgcmV0dXJuIHtcbiAgICAgIHF1ZXJ5U3RyaW5nOiBgJHtpbnNlcnRTdHJpbmd9IGRvIHVwZGF0ZSBzZXQgJHtleHRyYUFycmF5Lm1hcCh2ID0+IGAke3Z9ID0gP2ApLmpvaW4oJywgJyl9O2AsXG4gICAgICBmaWVsZHM6IFsnY2hpbGQuaWQnLCAnaXRlbS5pZCddLmNvbmNhdChleHRyYUFycmF5KS5jb25jYXQoZXh0cmFBcnJheSksXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBpbnNlcnRBcnJheSA9IFtcbiAgICAgIHNxbERhdGEuam9pbkZpZWxkc1tvdGhlclJlbE5hbWVdLFxuICAgICAgc3FsRGF0YS5qb2luRmllbGRzW3JlbE5hbWVdLFxuICAgIF07XG4gICAgY29uc3QgaW5zZXJ0U3RyaW5nID0gYGluc2VydCBpbnRvIFwiJHtzcWxEYXRhLnRhYmxlTmFtZX1cIiAoJHtpbnNlcnRBcnJheS5qb2luKCcsICcpfSlcbiAgICAgIHZhbHVlcyAoJHtpbnNlcnRBcnJheS5tYXAoKCkgPT4gJz8nKS5qb2luKCcsICcpfSlcbiAgICAgIG9uIGNvbmZsaWN0IChcIiR7c3FsRGF0YS5qb2luRmllbGRzW290aGVyUmVsTmFtZV19XCIsIFwiJHtzcWxEYXRhLmpvaW5GaWVsZHNbcmVsTmFtZV19XCIpIGA7XG4gICAgcmV0dXJuIHtcbiAgICAgIHF1ZXJ5U3RyaW5nOiBgJHtpbnNlcnRTdHJpbmd9IGRvIG5vdGhpbmc7YCxcbiAgICAgIGZpZWxkczogWydjaGlsZC5pZCcsICdpdGVtLmlkJ10sXG4gICAgfTtcbiAgfVxufVxuIl19
