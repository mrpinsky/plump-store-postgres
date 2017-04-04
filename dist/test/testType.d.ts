import { ModelSchema, RelationshipSchema, Model } from 'plump';
export declare const ChildrenSchema: RelationshipSchema;
export declare const ValenceChildrenSchema: RelationshipSchema;
export declare const QueryChildrenSchema: RelationshipSchema;
export declare const TestSchema: ModelSchema;
export declare class TestType extends Model {
    static typeName: string;
    static schema: ModelSchema;
}
