import { ParameterizedQuery } from './semiQuery';
import { ModelSchema } from 'plump';
export declare function bulkQuery(schema: ModelSchema): ParameterizedQuery;
export declare function readQuery(schema: ModelSchema): ParameterizedQuery;
