/**
 * Types for the "Post to EID" workflow (ported from the legacy ng2-amrs
 * `LabOrdersSearchHelperService` / `LabOrderSearchPostComponent`).
 *
 * Only the DNA PCR, Viral Load and CD4 order types are in scope. HPV, which
 * existed in the legacy implementation, is intentionally excluded.
 */

/** The EID order types supported by this port (HPV excluded). */
export type EidOrderType = 'DNAPCR' | 'VL' | 'CD4';

export interface OrderTypeDefinition {
  type: EidOrderType;
  conceptUuid: string;
  display: string;
}

export interface LabLocation {
  name: string;
  value: string;
}

export interface SampleType {
  id: number;
  display: string;
}

export interface IdentifierType {
  uuid: string;
  name: string;
}

export interface Identifier {
  uuid: string;
  identifier: string;
  preferred: boolean;
  identifierType: IdentifierType;
  /** Some backends return a "TypeName=value" string here. */
  display?: string;
}

/** A coded obs value is an object with a uuid; other datatypes are primitives. */
export type EidObsValue = string | number | boolean | { uuid: string; display?: string } | null;

export interface EidObs {
  uuid: string;
  concept: { uuid: string; display?: string };
  value: EidObsValue;
  groupMembers?: Array<EidObs>;
}

export interface EidPerson {
  uuid: string;
  display: string;
  gender: string;
  birthdate: string;
}

export interface EidPatient {
  uuid: string;
  display?: string;
  identifiers: Array<Identifier>;
  person: EidPerson;
}

export interface EidEncounter {
  uuid: string;
  location: { uuid: string };
  obs: Array<EidObs>;
}

/**
 * The subset of an OpenMRS order (fetched with an EID-specific representation)
 * that the payload builders require.
 */
export interface EidOrder {
  uuid: string;
  orderNumber: string;
  dateActivated: string;
  concept: { uuid: string; display?: string };
  orderer: { uuid: string; display?: string; identifier?: string };
  encounter: EidEncounter;
  patient: EidPatient;
}

/**
 * The relevant fields of a single HIV Summary row returned by the ETL
 * `patient/{uuid}/hiv-summary` endpoint.
 */
export interface HivSummary {
  arv_first_regimen_start_date?: string | null;
  arv_start_date?: string | null;
  cur_arv_meds_id?: string | number | null;
  [key: string]: unknown;
}

export interface PregnancyFlags {
  isPregnant: 0 | 1;
  breastfeeding: 0 | 1;
}

export interface IdentifierResolution {
  /** Identifiers the user is allowed to pick from (CCC/HEI filtered). */
  allowedIdentifiers: Array<Identifier>;
  /** The pre-selected default identifier (CCC/HEI priority), if any. */
  defaultIdentifier: Identifier | null;
}

/* -------------------------------------------------------------------------- */
/* Payload shapes                                                             */
/* -------------------------------------------------------------------------- */

export interface Cd4EidPayload {
  type: 'CD4';
  locationUuid: string;
  orderNumber: string;
  providerIdentifier: string;
  patientName: string;
  patientIdentifier: string;
  sex: string;
  birthDate: string;
  dateDrawn: string;
  dateReceived: string;
}

export interface DnaPcrEidPayload {
  type: 'DNAPCR';
  locationUuid: string;
  orderNumber: string;
  providerIdentifier: string;
  patientName: string;
  patientIdentifier: string;
  sex: string;
  birthDate: string;
  infantProphylaxisUuid: Array<string>;
  pmtctInterventionUuid: Array<string>;
  feedingTypeUuid: Array<string>;
  entryPointUuid: Array<string>;
  motherHivStatusUuid: Array<string>;
  dateDrawn: string;
  dateReceived: string;
}

export interface ViralLoadEidPayload {
  type: 'VL';
  locationUuid: string;
  orderNumber: string;
  providerIdentifier: string;
  patientName: string;
  patientIdentifier: string;
  sex: string;
  birthDate: string;
  artStartDateInitial: string;
  artStartDateCurrent: string;
  /** The selected sample type id (1 = Frozen Plasma, 2 = Whole blood, 3 = DBS). */
  sampleType: number;
  artRegimenUuid: string | number | null;
  /**
   * NOTE: the task spec describes this as a "single value", but the legacy
   * source (`findObsValueByConceptUuid`) collects and sends ALL matches as an
   * array. We match the legacy wire format to avoid breaking the EID backend.
   */
  vlJustificationUuid: Array<string>;
  isPregnant: 0 | 1;
  breastfeeding: 0 | 1;
  dateDrawn: string;
  dateReceived: string;
}

export type EidPayload = Cd4EidPayload | DnaPcrEidPayload | ViralLoadEidPayload;

/* -------------------------------------------------------------------------- */
/* Payload builder inputs                                                      */
/* -------------------------------------------------------------------------- */

export interface BaseEidPayloadInput {
  order: EidOrder;
  encounterObs: Array<EidObs>;
  locationUuid: string;
  patientIdentifier: string;
  patientName: string;
  sex: string;
  birthDate: string | Date;
  dateReceived: string | Date;
}

export interface ViralLoadPayloadInput extends BaseEidPayloadInput {
  artStartDateInitial: string | Date | null | undefined;
  artStartDateCurrent: string | Date | null | undefined;
  sampleType: number;
  artRegimenUuid: string | number | null | undefined;
  isPregnant: 0 | 1;
  breastfeeding: 0 | 1;
}

export interface EidValidationInput {
  order: EidOrder | null | undefined;
  orderType: EidOrderType | null | undefined;
  labLocation: string;
  patientIdentifier: string;
  sampleType: number | null | undefined;
  dateReceived: string | Date;
  hivSummary: HivSummary | null | undefined;
}
