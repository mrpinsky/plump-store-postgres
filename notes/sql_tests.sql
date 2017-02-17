-- holding area for complicated SQL I'm fiddling with --

select "id", "name", "extended",
array_agg(children.child_id) FILTER (WHERE children.child_id IS NOT NULL), '{}') as children,
COALESCE(array_agg(valenceChildren.child_id) FILTER (WHERE valenceChildren.child_id IS NOT NULL), '{}') as valenceChildren
from "tests"
left outer join "parent_child_relationship" as "children" on "children"."parent_id" = "tests"."id"
left outer join "valence_children" as "valencechildren" on "valencechildren"."parent_id" = "tests"."id"
-- where "id" = 1
group by "id", "name", "extended";



select "id", "name", "extended",
          array_agg(children.child_id)
          FILTER (WHERE children.child_id IS NOT NULL)
        as children,
          array_agg(valencechildren.child_id)
          FILTER (WHERE valencechildren.child_id IS NOT NULL)
        as valenceChildren,
          array_agg(parents.parent_id)
          FILTER (WHERE parents.child_id IS NOT NULL)
        as parents,
          array_agg(querychildren.child_id)
          FILTER (WHERE querychildren.child_id IS NOT NULL)
        as queryChildren,
          array_agg(queryparents.parent_id)
          FILTER (WHERE queryparents.child_id IS NOT NULL)
        as queryParents,
          array_agg(valenceparents.parent_id)
          FILTER (WHERE valenceparents.child_id IS NOT NULL)
        as valenceParents,
          array_agg(likers.parent_id)
          FILTER (WHERE likers.child_id IS NOT NULL)
        as likers,
          array_agg(likees.child_id)
          FILTER (WHERE likees.child_id IS NOT NULL)
        as likees,
          array_agg(agreers.parent_id)
          FILTER (WHERE agreers.child_id IS NOT NULL)
        as agreers,
          array_agg(agreees.child_id)
          FILTER (WHERE agreees.child_id IS NOT NULL)
        as agreees from "tests" left outer join "parent_child_relationship" as "children" on "children"."parent_id" = "tests"."id" left outer join "valence_children" as "valencechildren" on "valencechildren"."parent_id" = "tests"."id" left outer join "parent_child_relationship" as "parents" on "parents"."child_id" = "tests"."id" left outer join "query_children" as "querychildren" on "querychildren"."parent_id" = "tests"."id" left outer join "query_children" as "queryparents" on "queryparents"."child_id" = "tests"."id" left outer join "valence_children" as "valenceparents" on "valenceparents"."child_id" = "tests"."id" left outer join "reactions" as "likers" on "likers"."child_id" = "tests"."id" left outer join "reactions" as "likees" on "likees"."parent_id" = "tests"."id" left outer join "reactions" as "agreers" on "agreers"."child_id" = "tests"."id" left outer join "reactions" as "agreees" on "agreees"."parent_id" = "tests"."id" where "id" = 5 group by "id", "name", "extended";
