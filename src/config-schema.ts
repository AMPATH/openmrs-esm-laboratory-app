import { Type, validators } from '@openmrs/esm-framework';

const allowedLabTableColumns = ['name', 'age', 'dob', 'sex', 'totalOrders', 'action', 'patientId', 'priority'] as const;
type LabTableColumnName = (typeof allowedLabTableColumns)[number];

export const configSchema = {
  laboratoryOrderTypeUuid: {
    _type: Type.String,
    _default: '53eb4768-1359-11df-a1f1-0026b9348838',
    _description: 'UUID for orderType',
  },
  labTableColumns: {
    _type: Type.Array,
    _default: ['name', 'age', 'sex', 'priority', 'totalOrders', 'action'] as Array<LabTableColumnName>,
    _description: 'The columns to display in the lab table. Allowed values: ' + allowedLabTableColumns.join(', '),
    _elements: {
      _type: Type.String,
      _validators: [validators.oneOf(allowedLabTableColumns)],
    },
  },
  patientIdIdentifierTypeUuid: {
    _type: Type.Array,
    _default: [],
    _description: 'Needed if the "id" column of "labTableColumns" is used. Is the OpenMRS ID by default.',
  },
  enableReviewingLabResultsBeforeApproval: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Enable reviewing lab results before final approval. When enabled, lab results will be submitted for review before being approved and finalized.',
  },
  filterByCurrentLocation: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Enable filtering lab requests by current location',
  },
  laboratoryServiceTypedUuid: {
    _type: Type.UUID,
    _default: '5adeb9de-5545-4272-add4-a661005f727e',
    _description: 'Laboratory billable service type',
  },
};

export type Config = {
  enableReviewingLabResultsBeforeApproval: boolean;
  laboratoryOrderTypeUuid: string;
  labTableColumns: Array<LabTableColumnName>;
  patientIdIdentifierTypeUuid: Array<string>;
  filterByCurrentLocation: boolean;
  laboratoryServiceTypedUuid: string;
};
