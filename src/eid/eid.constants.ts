import type { LabLocation, OrderTypeDefinition, SampleType } from './eid.types';

/**
 * Concept UUIDs identifying each EID-eligible order type. Matched against
 * `order.concept.uuid`. HPV (`a8a46fd6-1350-11df-a1f1-0026b9348838`) is
 * intentionally excluded from this port.
 */
export const EID_ORDER_TYPES: ReadonlyArray<OrderTypeDefinition> = [
  { type: 'DNAPCR', conceptUuid: 'a898fe80-1350-11df-a1f1-0026b9348838', display: 'DNA PCR' },
  { type: 'VL', conceptUuid: 'a8982474-1350-11df-a1f1-0026b9348838', display: 'Viral Load' },
  { type: 'CD4', conceptUuid: 'a896cce6-1350-11df-a1f1-0026b9348838', display: 'CD4 Panel' },
];

/** DNA PCR obs concept UUIDs (values collected as arrays of concept uuids). */
export const DNA_PCR_OBS_CONCEPTS = {
  infantProphylaxis: 'a89addfe-1350-11df-a1f1-0026b9348838',
  pmtctIntervention: 'a898bdc6-1350-11df-a1f1-0026b9348838',
  feedingType: 'a89abee6-1350-11df-a1f1-0026b9348838',
  entryPoint: 'a8a17e48-1350-11df-a1f1-0026b9348838',
  motherHivStatus: 'a8afb80a-1350-11df-a1f1-0026b9348838',
} as const;

/** Viral load justification obs concept. */
export const VL_JUSTIFICATION_CONCEPT_UUID = '0a98f01f-57f1-44b7-aacf-e1121650a967';

/** PMTCT category obs concept and its pregnant / breastfeeding value uuids. */
export const PMTCT_CATEGORY_CONCEPT_UUID = 'a89eea66-1350-11df-a1f1-0026b9348838';
export const PREGNANT_VALUE_UUID = 'a89d109c-1350-11df-a1f1-0026b9348838';
export const BREASTFEEDING_VALUE_UUID = 'a8a18208-1350-11df-a1f1-0026b9348838';

/** Identifier types used by the CCC/HEI-priority resolver. */
export const CCC_IDENTIFIER_TYPE_UUID = 'f2d6ff1a-8440-4d35-a150-1d4b5a930c5e';
export const HEI_IDENTIFIER_TYPE_UUID = 'ead42a8f-203e-4b11-a942-df03a460d617';

/** Lab locations (ported verbatim from legacy). The `value` is the ETL path segment. */
export const EID_LAB_LOCATIONS: ReadonlyArray<LabLocation> = [
  { name: 'Alupe', value: 'alupe' },
  { name: 'Ampath', value: 'ampath' },
  { name: 'Busia', value: 'busia' },
];

export const DEFAULT_EID_LAB_LOCATION = 'ampath';

/** Sample types (ported verbatim). The `id` is what gets submitted for VL. */
export const EID_SAMPLE_TYPES: ReadonlyArray<SampleType> = [
  { id: 1, display: 'Frozen Plasma' },
  { id: 2, display: 'Whole blood' },
  { id: 3, display: 'DBS' },
];

/** External module that provides the ETL base URL configuration. */
export const DHA_WORKFLOW_MODULE = '@ampath/esm-dha-workflow-app';

/**
 * Fallback ETL base path used when the DHA workflow config is unavailable.
 * `openmrsFetch` prepends the OpenMRS SPA base (`/openmrs`), so this resolves
 * to `/openmrs/etl/...`.
 */
export const DEFAULT_ETL_BASE_URL = '/etl';
