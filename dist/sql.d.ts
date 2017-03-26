/// <reference types="bluebird" />
import * as Bluebird from 'bluebird';
import { Storage, IndefiniteModelData, ModelData, ModelSchema, ModelReference, RelationshipItem } from 'plump';
export declare class PGStore extends Storage {
    private knex;
    private queryCache;
    constructor(opts?: {
        [opt: string]: any;
    });
    teardown(): any;
    cache(value: ModelData): Bluebird<ModelData>;
    cacheAttributes(value: ModelData): Bluebird<ModelData>;
    cacheRelationship(value: ModelData): Bluebird<ModelData>;
    wipe(value: ModelReference, key?: string | string[]): void;
    allocateId(typeName: string): Bluebird<number>;
    addSchema(t: {
        typeName: string;
        schema: ModelSchema;
    }): Bluebird<void>;
    writeAttributes(value: IndefiniteModelData): Bluebird<ModelData>;
    readAttributes(value: ModelReference): Bluebird<ModelData>;
    readRelationship(value: ModelReference, relName: string): Bluebird<ModelData>;
    delete(value: ModelReference): any;
    writeRelationshipItem(value: ModelReference, relName: string, child: RelationshipItem): any;
    deleteRelationshipItem(value: ModelReference, relName: string, child: RelationshipItem): any;
    query(q: any): Bluebird<any>;
}
