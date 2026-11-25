import { Type, validators } from '@openmrs/esm-framework';

const allowedLabTableColumns = [
  'name',
  'urgency',
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
  medicalSupplyOrderTypeUuid: {
    _type: Type.UUID,
    _default: '58ea528c-8f62-45f0-86a2-f7d1327b8c56',
    _description: 'Order type UUID used by the Medical Supply order basket panel.',
  },
  labTableColumns: {
    _type: Type.Array,
    _default: [
      'name',
      'urgency',
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
    _default: ['e88dc246-3614-4ee3-8141-1f2a83054e72', '58a47054-1359-11df-a1f1-0026b9348838'],
    _description: 'Needed if the "id" column of "labTableColumns" is used. Is the OpenMRS ID by default.',
  },
  usePreferredPatientIdentifier: {
    _type: Type.Boolean,
    _default: false,
    _description:
      "When true (default), the patientId column shows an identifier only when it is both preferred and matches patientIdIdentifierTypeUuid. When false, any identifier of the configured type is shown regardless of preferred status, with a fallback to the patient's preferred identifier of any type.",
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
  enableHivAutoRetest: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Automatically reorder configured HIV tests after a positive initial result is approved.',
  },
  hivAutoRetestConceptUuids: {
    _type: Type.Array,
    _default: ['a8999dfe-1350-11df-a1f1-0026b9348838'],
    _description: 'Concept UUIDs eligible for automatic HIV retesting. Configure per environment.',
    _elements: { _type: Type.String },
  },
  hivPositiveAnswerUuid: {
    _type: Type.String,
    _default: 'a896f3a6-1350-11df-a1f1-0026b9348838',
    _description: 'UUID of the coded answer representing a positive HIV result. Configure per environment.',
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
  enableOdooBilling: {
    _type: Type.Boolean,
    _default: false,
    _description: 'Enable Odoo billing',
  },
  blockedPaymentModes: {
    _type: Type.Array,
    _default: ['MPESA', 'CASH'],
    _description: 'Payment modes that require bill generation before picking an order',
  },
};

export type Config = {
  enableReviewingLabResultsBeforeApproval: boolean;
  enableHivAutoRetest: boolean;
  hivAutoRetestConceptUuids: Array<string>;
  hivPositiveAnswerUuid: string;
  laboratoryOrderTypeUuid: string;
  medicalSupplyOrderTypeUuid: string;
  labTableColumns: Array<LabTableColumnName>;
  personAttributeTypeUuid: Array<string>;
  patientIdIdentifierTypeUuid: Array<string>;
  usePreferredPatientIdentifier: boolean;
  filterByCurrentLocation: boolean;
  laboratoryServiceTypedUuid: string;
  serviceUuid: string;
  enableOdooBilling: boolean;
  blockedPaymentModes: Array<string>;
};
