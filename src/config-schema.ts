import { Type, validators } from '@openmrs/esm-framework';

const allowedLabTableColumns = [
  'name',
  'age',
  'dob',
  'sex',
  'totalOrders',
  'action',
  'phoneNumber',
  'patientId',
  'priority',
  'status',
] as const;
type LabTableColumnName = (typeof allowedLabTableColumns)[number];

export const configSchema = {
  laboratoryOrderTypeUuid: {
    _type: Type.String,
    _default: '53eb4768-1359-11df-a1f1-0026b9348838',
    _description: 'UUID for orderType',
  },
  labTableColumns: {
    _type: Type.Array,
    _default: [
      'name',
      'age',
      'sex',
      'phoneNumber',
      'patientId',
      'priority',
      'status',
      'totalOrders',
      'action',
    ] as Array<LabTableColumnName>,
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
  personAttributeTypeUuid: {
    _type: Type.Array,
    _default: ['72a759a8-1359-11df-a1f1-0026b9348838'],
    _description: 'Needed for displaying person attributes',
  },
  enableReviewingLabResultsBeforeApproval: {
    _type: Type.Boolean,
    _default: true,
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
  serviceUuid: {
    _type: Type.UUID,
    _default: '2d4472e2-d7ab-4430-8e0e-a9ffcd809bf4',
    _description: 'Service Uuid for filtering queues',
  },
};

export type Config = {
  enableReviewingLabResultsBeforeApproval: boolean;
  laboratoryOrderTypeUuid: string;
  labTableColumns: Array<LabTableColumnName>;
  personAttributeTypeUuid: Array<string>;
  patientIdIdentifierTypeUuid: Array<string>;
  filterByCurrentLocation: boolean;
  laboratoryServiceTypedUuid: string;
  serviceUuid: string;
};
