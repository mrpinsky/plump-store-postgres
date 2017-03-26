// /* eslint prefer-template: 0*/
//
//
// function deserializeWhereIntoJoin(query, block, joinName, fieldName, knex, Type) {
//   // const car = block[0];
//   // the query uses 'where', but we want to use 'on' instead
//   const cdr = block.slice(1);
//   if (Array.isArray(cdr[0])) {
//     return cdr.reduce((subQuery, subBlock) => {
//       return deserializeWhereIntoJoin(subQuery, subBlock, joinName, fieldName, knex, Type);
//     }, query);
//   } else {
//     cdr[0] = `${joinName}.${cdr[0]}`;
//     if (cdr[2] === '{id}') {
//       cdr[2] = `${Type.$name}.${Type.$id}`;
//     } else {
//       cdr[2] = knex.raw(`'${cdr[2]}'`);
//     }
//     return query.on.apply(query, cdr);
//   }
// }
//
// export function blockRead(Type, knex, query) {
//   const selects = [];
//   const groups = [];
//   const basicJoins = [];
//   const fancyJoins = [];
//   const schema = Type.$schema;
//   for (const attrName in schema.attributes) {
//     selects.push(attrName.toLowerCase());
//     groups.push(attrName.toLowerCase());
//   }
//   for (const relName in schema.relationships) {
//     const joinName = relName.toLowerCase();
//     const rel = schema.relationships[relName].type;
//     if (rel.$sides[relName].self.query) {
//       fancyJoins.push({
//         logic: rel.$sides[relName].self.query.logic,
//         table: `${rel.$name} as ${joinName}`,
//         joinName: joinName,
//         fieldName: rel.$sides[relName].other.field,
//       });
//     } else {
//       const joinBlock = {
//         join: [
//           `${rel.$name} as ${joinName}`,
//           `${joinName}.${rel.$sides[relName].self.field}`,
//           '=',
//           `${Type.$name}.${Type.$id}`,
//         ],
//         where: [],
//       };
//       if (rel.$restrict) {
//         for (const restriction in rel.$restrict) {
//           joinBlock.where.push(
//             [`${joinName}.${restriction}`, '=', knex.raw(`'${rel.$restrict[restriction].value}'`)]
//           );
//         }
//       }
//       basicJoins.push(joinBlock);
//     }
//     const extraAgg = [];
//     if (rel.$extras) {
//       for (const extra in rel.$extras) {
//         extraAgg.push(`'${extra}'`, `${joinName}.${extra}`);
//       }
//     }
//     selects.push(knex.raw(
//       `COALESCE(
//         array_agg(
//           distinct(
//             jsonb_build_object(
//               '${rel.$sides[relName].other.field}', ${joinName}.${rel.$sides[relName].other.field},
//               '${rel.$sides[relName].self.field}', ${joinName}.${rel.$sides[relName].self.field}
//               ${extraAgg.length ? ',' + extraAgg.join(',') : ''}
//             )
//           )
//         )
//         FILTER (WHERE ${joinName}.${rel.$sides[relName].other.field} IS NOT NULL),
//         '{}')
//       as ${relName}`
//     ));
//   }
//   const joinedQuery = basicJoins.reduce((q, join) => {
//     return q.leftOuterJoin(join.join[0], (qb) => {
//       qb.on(join.join[1], join.join[2], join.join[3]);
//       join.where.forEach((where) => qb.andOn.apply(qb, where));
//     });
//   }, knex(Type.$name));
//
//   const evenMoreJoinedQuery = fancyJoins.reduce((q, join) => {
//     return q.leftOuterJoin(join.table, (qb) => {
//       return deserializeWhereIntoJoin(qb, join.logic, join.joinName, join.fieldName, knex, Type);
//     });
//   }, joinedQuery);
//   const selectedQuery = evenMoreJoinedQuery.where(query).select(selects);
//   const groupByQuery = selectedQuery.groupBy(groups);
//   // console.log(groupByQuery.toString());
//   return groupByQuery;
// }

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJsb2NrUmVhZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxpQ0FBaUM7QUFDakMsRUFBRTtBQUNGLEVBQUU7QUFDRixxRkFBcUY7QUFDckYsNkJBQTZCO0FBQzdCLCtEQUErRDtBQUMvRCxnQ0FBZ0M7QUFDaEMsaUNBQWlDO0FBQ2pDLGtEQUFrRDtBQUNsRCw4RkFBOEY7QUFDOUYsaUJBQWlCO0FBQ2pCLGFBQWE7QUFDYix3Q0FBd0M7QUFDeEMsK0JBQStCO0FBQy9CLDhDQUE4QztBQUM5QyxlQUFlO0FBQ2YsMENBQTBDO0FBQzFDLFFBQVE7QUFDUix5Q0FBeUM7QUFDekMsTUFBTTtBQUNOLElBQUk7QUFDSixFQUFFO0FBQ0YsaURBQWlEO0FBQ2pELHdCQUF3QjtBQUN4Qix1QkFBdUI7QUFDdkIsMkJBQTJCO0FBQzNCLDJCQUEyQjtBQUMzQixpQ0FBaUM7QUFDakMsZ0RBQWdEO0FBQ2hELDRDQUE0QztBQUM1QywyQ0FBMkM7QUFDM0MsTUFBTTtBQUNOLGtEQUFrRDtBQUNsRCw4Q0FBOEM7QUFDOUMsc0RBQXNEO0FBQ3RELDRDQUE0QztBQUM1QywwQkFBMEI7QUFDMUIsdURBQXVEO0FBQ3ZELGdEQUFnRDtBQUNoRCw4QkFBOEI7QUFDOUIsc0RBQXNEO0FBQ3RELFlBQVk7QUFDWixlQUFlO0FBQ2YsNEJBQTRCO0FBQzVCLGtCQUFrQjtBQUNsQiwyQ0FBMkM7QUFDM0MsNkRBQTZEO0FBQzdELGlCQUFpQjtBQUNqQix5Q0FBeUM7QUFDekMsYUFBYTtBQUNiLHFCQUFxQjtBQUNyQixXQUFXO0FBQ1gsNkJBQTZCO0FBQzdCLHFEQUFxRDtBQUNyRCxrQ0FBa0M7QUFDbEMscUdBQXFHO0FBQ3JHLGVBQWU7QUFDZixZQUFZO0FBQ1osVUFBVTtBQUNWLG9DQUFvQztBQUNwQyxRQUFRO0FBQ1IsMkJBQTJCO0FBQzNCLHlCQUF5QjtBQUN6QiwyQ0FBMkM7QUFDM0MsK0RBQStEO0FBQy9ELFVBQVU7QUFDVixRQUFRO0FBQ1IsNkJBQTZCO0FBQzdCLG1CQUFtQjtBQUNuQixxQkFBcUI7QUFDckIsc0JBQXNCO0FBQ3RCLGtDQUFrQztBQUNsQyxzR0FBc0c7QUFDdEcsbUdBQW1HO0FBQ25HLG1FQUFtRTtBQUNuRSxnQkFBZ0I7QUFDaEIsY0FBYztBQUNkLFlBQVk7QUFDWixxRkFBcUY7QUFDckYsZ0JBQWdCO0FBQ2hCLHVCQUF1QjtBQUN2QixVQUFVO0FBQ1YsTUFBTTtBQUNOLHlEQUF5RDtBQUN6RCxxREFBcUQ7QUFDckQseURBQXlEO0FBQ3pELGtFQUFrRTtBQUNsRSxVQUFVO0FBQ1YsMEJBQTBCO0FBQzFCLEVBQUU7QUFDRixpRUFBaUU7QUFDakUsbURBQW1EO0FBQ25ELG9HQUFvRztBQUNwRyxVQUFVO0FBQ1YscUJBQXFCO0FBQ3JCLDRFQUE0RTtBQUM1RSx3REFBd0Q7QUFDeEQsNkNBQTZDO0FBQzdDLHlCQUF5QjtBQUN6QixJQUFJIiwiZmlsZSI6ImJsb2NrUmVhZC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIC8qIGVzbGludCBwcmVmZXItdGVtcGxhdGU6IDAqL1xuLy9cbi8vXG4vLyBmdW5jdGlvbiBkZXNlcmlhbGl6ZVdoZXJlSW50b0pvaW4ocXVlcnksIGJsb2NrLCBqb2luTmFtZSwgZmllbGROYW1lLCBrbmV4LCBUeXBlKSB7XG4vLyAgIC8vIGNvbnN0IGNhciA9IGJsb2NrWzBdO1xuLy8gICAvLyB0aGUgcXVlcnkgdXNlcyAnd2hlcmUnLCBidXQgd2Ugd2FudCB0byB1c2UgJ29uJyBpbnN0ZWFkXG4vLyAgIGNvbnN0IGNkciA9IGJsb2NrLnNsaWNlKDEpO1xuLy8gICBpZiAoQXJyYXkuaXNBcnJheShjZHJbMF0pKSB7XG4vLyAgICAgcmV0dXJuIGNkci5yZWR1Y2UoKHN1YlF1ZXJ5LCBzdWJCbG9jaykgPT4ge1xuLy8gICAgICAgcmV0dXJuIGRlc2VyaWFsaXplV2hlcmVJbnRvSm9pbihzdWJRdWVyeSwgc3ViQmxvY2ssIGpvaW5OYW1lLCBmaWVsZE5hbWUsIGtuZXgsIFR5cGUpO1xuLy8gICAgIH0sIHF1ZXJ5KTtcbi8vICAgfSBlbHNlIHtcbi8vICAgICBjZHJbMF0gPSBgJHtqb2luTmFtZX0uJHtjZHJbMF19YDtcbi8vICAgICBpZiAoY2RyWzJdID09PSAne2lkfScpIHtcbi8vICAgICAgIGNkclsyXSA9IGAke1R5cGUuJG5hbWV9LiR7VHlwZS4kaWR9YDtcbi8vICAgICB9IGVsc2Uge1xuLy8gICAgICAgY2RyWzJdID0ga25leC5yYXcoYCcke2NkclsyXX0nYCk7XG4vLyAgICAgfVxuLy8gICAgIHJldHVybiBxdWVyeS5vbi5hcHBseShxdWVyeSwgY2RyKTtcbi8vICAgfVxuLy8gfVxuLy9cbi8vIGV4cG9ydCBmdW5jdGlvbiBibG9ja1JlYWQoVHlwZSwga25leCwgcXVlcnkpIHtcbi8vICAgY29uc3Qgc2VsZWN0cyA9IFtdO1xuLy8gICBjb25zdCBncm91cHMgPSBbXTtcbi8vICAgY29uc3QgYmFzaWNKb2lucyA9IFtdO1xuLy8gICBjb25zdCBmYW5jeUpvaW5zID0gW107XG4vLyAgIGNvbnN0IHNjaGVtYSA9IFR5cGUuJHNjaGVtYTtcbi8vICAgZm9yIChjb25zdCBhdHRyTmFtZSBpbiBzY2hlbWEuYXR0cmlidXRlcykge1xuLy8gICAgIHNlbGVjdHMucHVzaChhdHRyTmFtZS50b0xvd2VyQ2FzZSgpKTtcbi8vICAgICBncm91cHMucHVzaChhdHRyTmFtZS50b0xvd2VyQ2FzZSgpKTtcbi8vICAgfVxuLy8gICBmb3IgKGNvbnN0IHJlbE5hbWUgaW4gc2NoZW1hLnJlbGF0aW9uc2hpcHMpIHtcbi8vICAgICBjb25zdCBqb2luTmFtZSA9IHJlbE5hbWUudG9Mb3dlckNhc2UoKTtcbi8vICAgICBjb25zdCByZWwgPSBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuLy8gICAgIGlmIChyZWwuJHNpZGVzW3JlbE5hbWVdLnNlbGYucXVlcnkpIHtcbi8vICAgICAgIGZhbmN5Sm9pbnMucHVzaCh7XG4vLyAgICAgICAgIGxvZ2ljOiByZWwuJHNpZGVzW3JlbE5hbWVdLnNlbGYucXVlcnkubG9naWMsXG4vLyAgICAgICAgIHRhYmxlOiBgJHtyZWwuJG5hbWV9IGFzICR7am9pbk5hbWV9YCxcbi8vICAgICAgICAgam9pbk5hbWU6IGpvaW5OYW1lLFxuLy8gICAgICAgICBmaWVsZE5hbWU6IHJlbC4kc2lkZXNbcmVsTmFtZV0ub3RoZXIuZmllbGQsXG4vLyAgICAgICB9KTtcbi8vICAgICB9IGVsc2Uge1xuLy8gICAgICAgY29uc3Qgam9pbkJsb2NrID0ge1xuLy8gICAgICAgICBqb2luOiBbXG4vLyAgICAgICAgICAgYCR7cmVsLiRuYW1lfSBhcyAke2pvaW5OYW1lfWAsXG4vLyAgICAgICAgICAgYCR7am9pbk5hbWV9LiR7cmVsLiRzaWRlc1tyZWxOYW1lXS5zZWxmLmZpZWxkfWAsXG4vLyAgICAgICAgICAgJz0nLFxuLy8gICAgICAgICAgIGAke1R5cGUuJG5hbWV9LiR7VHlwZS4kaWR9YCxcbi8vICAgICAgICAgXSxcbi8vICAgICAgICAgd2hlcmU6IFtdLFxuLy8gICAgICAgfTtcbi8vICAgICAgIGlmIChyZWwuJHJlc3RyaWN0KSB7XG4vLyAgICAgICAgIGZvciAoY29uc3QgcmVzdHJpY3Rpb24gaW4gcmVsLiRyZXN0cmljdCkge1xuLy8gICAgICAgICAgIGpvaW5CbG9jay53aGVyZS5wdXNoKFxuLy8gICAgICAgICAgICAgW2Ake2pvaW5OYW1lfS4ke3Jlc3RyaWN0aW9ufWAsICc9Jywga25leC5yYXcoYCcke3JlbC4kcmVzdHJpY3RbcmVzdHJpY3Rpb25dLnZhbHVlfSdgKV1cbi8vICAgICAgICAgICApO1xuLy8gICAgICAgICB9XG4vLyAgICAgICB9XG4vLyAgICAgICBiYXNpY0pvaW5zLnB1c2goam9pbkJsb2NrKTtcbi8vICAgICB9XG4vLyAgICAgY29uc3QgZXh0cmFBZ2cgPSBbXTtcbi8vICAgICBpZiAocmVsLiRleHRyYXMpIHtcbi8vICAgICAgIGZvciAoY29uc3QgZXh0cmEgaW4gcmVsLiRleHRyYXMpIHtcbi8vICAgICAgICAgZXh0cmFBZ2cucHVzaChgJyR7ZXh0cmF9J2AsIGAke2pvaW5OYW1lfS4ke2V4dHJhfWApO1xuLy8gICAgICAgfVxuLy8gICAgIH1cbi8vICAgICBzZWxlY3RzLnB1c2goa25leC5yYXcoXG4vLyAgICAgICBgQ09BTEVTQ0UoXG4vLyAgICAgICAgIGFycmF5X2FnZyhcbi8vICAgICAgICAgICBkaXN0aW5jdChcbi8vICAgICAgICAgICAgIGpzb25iX2J1aWxkX29iamVjdChcbi8vICAgICAgICAgICAgICAgJyR7cmVsLiRzaWRlc1tyZWxOYW1lXS5vdGhlci5maWVsZH0nLCAke2pvaW5OYW1lfS4ke3JlbC4kc2lkZXNbcmVsTmFtZV0ub3RoZXIuZmllbGR9LFxuLy8gICAgICAgICAgICAgICAnJHtyZWwuJHNpZGVzW3JlbE5hbWVdLnNlbGYuZmllbGR9JywgJHtqb2luTmFtZX0uJHtyZWwuJHNpZGVzW3JlbE5hbWVdLnNlbGYuZmllbGR9XG4vLyAgICAgICAgICAgICAgICR7ZXh0cmFBZ2cubGVuZ3RoID8gJywnICsgZXh0cmFBZ2cuam9pbignLCcpIDogJyd9XG4vLyAgICAgICAgICAgICApXG4vLyAgICAgICAgICAgKVxuLy8gICAgICAgICApXG4vLyAgICAgICAgIEZJTFRFUiAoV0hFUkUgJHtqb2luTmFtZX0uJHtyZWwuJHNpZGVzW3JlbE5hbWVdLm90aGVyLmZpZWxkfSBJUyBOT1QgTlVMTCksXG4vLyAgICAgICAgICd7fScpXG4vLyAgICAgICBhcyAke3JlbE5hbWV9YFxuLy8gICAgICkpO1xuLy8gICB9XG4vLyAgIGNvbnN0IGpvaW5lZFF1ZXJ5ID0gYmFzaWNKb2lucy5yZWR1Y2UoKHEsIGpvaW4pID0+IHtcbi8vICAgICByZXR1cm4gcS5sZWZ0T3V0ZXJKb2luKGpvaW4uam9pblswXSwgKHFiKSA9PiB7XG4vLyAgICAgICBxYi5vbihqb2luLmpvaW5bMV0sIGpvaW4uam9pblsyXSwgam9pbi5qb2luWzNdKTtcbi8vICAgICAgIGpvaW4ud2hlcmUuZm9yRWFjaCgod2hlcmUpID0+IHFiLmFuZE9uLmFwcGx5KHFiLCB3aGVyZSkpO1xuLy8gICAgIH0pO1xuLy8gICB9LCBrbmV4KFR5cGUuJG5hbWUpKTtcbi8vXG4vLyAgIGNvbnN0IGV2ZW5Nb3JlSm9pbmVkUXVlcnkgPSBmYW5jeUpvaW5zLnJlZHVjZSgocSwgam9pbikgPT4ge1xuLy8gICAgIHJldHVybiBxLmxlZnRPdXRlckpvaW4oam9pbi50YWJsZSwgKHFiKSA9PiB7XG4vLyAgICAgICByZXR1cm4gZGVzZXJpYWxpemVXaGVyZUludG9Kb2luKHFiLCBqb2luLmxvZ2ljLCBqb2luLmpvaW5OYW1lLCBqb2luLmZpZWxkTmFtZSwga25leCwgVHlwZSk7XG4vLyAgICAgfSk7XG4vLyAgIH0sIGpvaW5lZFF1ZXJ5KTtcbi8vICAgY29uc3Qgc2VsZWN0ZWRRdWVyeSA9IGV2ZW5Nb3JlSm9pbmVkUXVlcnkud2hlcmUocXVlcnkpLnNlbGVjdChzZWxlY3RzKTtcbi8vICAgY29uc3QgZ3JvdXBCeVF1ZXJ5ID0gc2VsZWN0ZWRRdWVyeS5ncm91cEJ5KGdyb3Vwcyk7XG4vLyAgIC8vIGNvbnNvbGUubG9nKGdyb3VwQnlRdWVyeS50b1N0cmluZygpKTtcbi8vICAgcmV0dXJuIGdyb3VwQnlRdWVyeTtcbi8vIH1cbiJdfQ==
