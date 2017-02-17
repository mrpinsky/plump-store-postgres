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
            FILTER (WHERE parents.child_id IS NOT NULL),
            '{}')
          as parents, COALESCE(
            array_agg(
              distinct(
                jsonb_build_object(
                  'id', valenceparents.parent_id
                  ,'perm',valenceparents.perm
                )
              )
            )
            FILTER (WHERE valenceparents.child_id IS NOT NULL),
            '{}')
          as valenceParents, COALESCE(
            array_agg(
              distinct(
                jsonb_build_object(
                  'id', likers.parent_id

                )
              )
            )
            FILTER (WHERE likers.child_id IS NOT NULL),
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
            FILTER (WHERE agreers.child_id IS NOT NULL),
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
          as agreees from "tests" left outer join "parent_child_relationship" as "children" on "children"."parent_id" = "tests"."id" left outer join "valence_children" as "valencechildren" on "valencechildren"."parent_id" = "tests"."id" left outer join "parent_child_relationship" as "parents" on "parents"."child_id" = "tests"."id" left outer join "valence_children" as "valenceparents" on "valenceparents"."child_id" = "tests"."id" left outer join "reactions" as "likers" on "likers"."child_id" = "tests"."id" left outer join "reactions" as "likees" on "likees"."parent_id" = "tests"."id" left outer join "reactions" as "agreers" on "agreers"."child_id" = "tests"."id" left outer join "reactions" as "agreees" on "agreees"."parent_id" = "tests"."id" where "field" = 'queryChildren' and "query" = {"logic":["where",["where","parent_id","=","{id}"],["where","perm",">=",2]],"requireLoad":true} and "field" = 'queryParents' and "query" = {"logic":["where",["where","child_id","=","{id}"],["where","perm",">=",2]],"requireLoad":true} and "id" = 1 group by "id", "name", "extended"
