select "id", "name", "extended", COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', children.child_id

              )
            )
          )
          FILTER (WHERE children.child_id IS NOT NULL),
          '{}')
        as children, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', valencechildren.child_id
                ,'perm',valencechildren.perm
              )
            )
          )
          FILTER (WHERE valencechildren.child_id IS NOT NULL),
          '{}')
        as valenceChildren, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', parents.parent_id

              )
            )
          )
          FILTER (WHERE parents.parent_id IS NOT NULL),
          '{}')
        as parents, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', querychildren.child_id
                ,'perm',querychildren.perm
              )
            )
          )
          FILTER (WHERE querychildren.child_id IS NOT NULL),
          '{}')
        as queryChildren, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', queryparents.parent_id
                ,'perm',queryparents.perm
              )
            )
          )
          FILTER (WHERE queryparents.parent_id IS NOT NULL),
          '{}')
        as queryParents, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', valenceparents.parent_id
                ,'perm',valenceparents.perm
              )
            )
          )
          FILTER (WHERE valenceparents.parent_id IS NOT NULL),
          '{}')
        as valenceParents, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', likers.parent_id

              )
            )
          )
          FILTER (WHERE likers.parent_id IS NOT NULL),
          '{}')
        as likers, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', likees.child_id

              )
            )
          )
          FILTER (WHERE likees.child_id IS NOT NULL),
          '{}')
        as likees, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', agreers.parent_id

              )
            )
          )
          FILTER (WHERE agreers.parent_id IS NOT NULL),
          '{}')
        as agreers, COALESCE(
          array_agg(
            distinct(
              jsonb_build_object(
                'id', agreees.child_id

              )
            )
          )
          FILTER (WHERE agreees.child_id IS NOT NULL),
          '{}')
          as agreees from "tests"
          left outer join "parent_child_relationship" as "children" on "children"."parent_id" = "tests"."id"
          left outer join "valence_children" as "valencechildren" on "valencechildren"."parent_id" = "tests"."id"
          left outer join "parent_child_relationship" as "parents" on "parents"."child_id" = "tests"."id"
          left outer join "valence_children" as "valenceparents" on "valenceparents"."child_id" = "tests"."id"
          left outer join "reactions" as "likers" on "likers"."child_id" = "tests"."id" and "likers"."reaction" = 'like'
          left outer join "reactions" as "likees" on "likees"."parent_id" = "tests"."id" and "likees"."reaction" = 'like'
          left outer join "reactions" as "agreers" on "agreers"."child_id" = "tests"."id" and "agreers"."reaction" = 'agree'
          left outer join "reactions" as "agreees" on "agreees"."parent_id" = "tests"."id" and "agreees"."reaction" = 'agree'
          left outer join "query_children" as "querychildren" on "querychildren"."child_id" = "tests"."id" and "querychildren"."perm" >= '2'
          left outer join "query_children" as "queryparents" on "queryparents"."parent_id" = "tests"."id" and "queryparents"."perm" >= '2' where "reply_parents" @> '{1}' group by "id", "name", "extended"
