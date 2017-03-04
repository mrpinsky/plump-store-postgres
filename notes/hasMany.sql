select "valence_children"."child_id" as id, jsonb_build_object('perm', "valence_children"."perm") as meta from "valence_children" where parent_id = 6;
