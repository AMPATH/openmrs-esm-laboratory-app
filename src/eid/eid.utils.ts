import dayjs from 'dayjs';
import {
  BREASTFEEDING_VALUE_UUID,
  CCC_IDENTIFIER_TYPE_UUID,
  DNA_PCR_OBS_CONCEPTS,
  EID_ORDER_TYPES,
  HEI_IDENTIFIER_TYPE_UUID,
  PMTCT_CATEGORY_CONCEPT_UUID,
  PREGNANT_VALUE_UUID,
  VL_JUSTIFICATION_CONCEPT_UUID,
} from './eid.constants';
import type {
  BaseEidPayloadInput,
  Cd4EidPayload,
  DnaPcrEidPayload,
  EidObs,
  EidOrder,
  EidOrderType,
  EidValidationInput,
  Identifier,
  IdentifierResolution,
  OrderTypeDefinition,
  PregnancyFlags,
  ViralLoadEidPayload,
  ViralLoadPayloadInput,
} from './eid.types';

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Formats a date as `YYYY-MM-DD`, returning an empty string (NOT null) for
 * invalid/empty dates. Ported exactly from the legacy `formatDate`.
 */
export function formatDate(date: string | number | Date | null | undefined): string {
  if (date === null || date === undefined || date === '') {
    return '';
  }
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

/* -------------------------------------------------------------------------- */
/* Order type identification                                                   */
/* -------------------------------------------------------------------------- */

/** Returns the EID order-type definition for a concept uuid, or null. */
export function getOrderTypeByConceptUuid(conceptUuid: string | null | undefined): OrderTypeDefinition | null {
  if (!conceptUuid) {
    return null;
  }
  return EID_ORDER_TYPES.find((t) => t.conceptUuid === conceptUuid) ?? null;
}

/** Returns the EID order type for an order, or null when not eligible. */
export function determineEidOrderType(order: Pick<EidOrder, 'concept'> | null | undefined): EidOrderType | null {
  return getOrderTypeByConceptUuid(order?.concept?.uuid)?.type ?? null;
}

/**
 * Whether an order can be posted to EID. True only for DNA PCR, VL and CD4;
 * everything else (including HPV) returns false.
 */
export function isEidEligibleOrder(order: { concept?: { uuid?: string } } | null | undefined): boolean {
  return getOrderTypeByConceptUuid(order?.concept?.uuid) !== null;
}

/* -------------------------------------------------------------------------- */
/* Recursive obs search                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Recursively walks a (possibly nested/grouped) obs tree and collects EVERY obs
 * whose concept matches `conceptUuid`. A matched node is not descended into
 * further, mirroring the legacy recursion. Results are de-duplicated by uuid.
 */
export function findObsByConceptUuid(
  obs: EidObs | Array<EidObs> | null | undefined,
  conceptUuid: string | null | undefined,
): Array<EidObs> {
  if (!obs || !conceptUuid) {
    return [];
  }

  const found: Array<EidObs> = [];

  const walk = (node: EidObs | Array<EidObs> | null | undefined): void => {
    if (!node) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.concept?.uuid === conceptUuid) {
      found.push(node);
      return;
    }
    if (Array.isArray(node.groupMembers) && node.groupMembers.length > 0) {
      node.groupMembers.forEach(walk);
    }
  };

  walk(obs);

  const seen = new Set<string>();
  return found.filter((o) => {
    if (seen.has(o.uuid)) {
      return false;
    }
    seen.add(o.uuid);
    return true;
  });
}

/**
 * Resolves obs values for a concept to an array of strings: coded values yield
 * `value.uuid`, other datatypes yield their stringified value. Empty values are
 * skipped. Ported from the legacy `findObsValueByConceptUuid`.
 */
export function findObsValueByConceptUuid(
  obs: EidObs | Array<EidObs> | null | undefined,
  conceptUuid: string | null | undefined,
): Array<string> {
  return findObsByConceptUuid(obs, conceptUuid)
    .filter((o) => o.value !== null && o.value !== undefined && o.value !== '')
    .map((o) => (typeof o.value === 'object' && o.value?.uuid ? o.value.uuid : String(o.value)));
}

/**
 * Derives pregnant / breastfeeding flags from the PMTCT category obs. Returns
 * `1`/`0` (not booleans) to match the payload shape.
 */
export function derivePregnancyFlags(obs: Array<EidObs> | null | undefined): PregnancyFlags {
  const [pmtctCategory] = findObsByConceptUuid(obs, PMTCT_CATEGORY_CONCEPT_UUID);
  const valueUuid = pmtctCategory && typeof pmtctCategory.value === 'object' ? pmtctCategory.value?.uuid : undefined;

  return {
    isPregnant: valueUuid === PREGNANT_VALUE_UUID ? 1 : 0,
    breastfeeding: valueUuid === BREASTFEEDING_VALUE_UUID ? 1 : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Identifier resolution                                                       */
/* -------------------------------------------------------------------------- */

function hasIdentifierType(identifiers: Array<Identifier>, typeUuid: string): boolean {
  return identifiers.some((i) => i.identifierType?.uuid === typeUuid);
}

/**
 * Resolves which identifiers the user may pick and the pre-selected default,
 * using CCC/HEI-priority logic (the "submission" flow). The redundant legacy
 * display-only lookup (`searchIdentifiers`) is intentionally not ported — the
 * value it produced never reached the submitted payload.
 *
 * - CCC present but not HEI  -> only CCC-type identifiers are selectable.
 * - HEI present but not CCC  -> only HEI-type identifiers are selectable.
 * - Default selection follows the legacy `selectDefaultIdentifier`, where HEI
 *   overrides CCC, then a preferred identifier is used only when neither
 *   CCC nor HEI exists. (The task prose says "CCC > HEI"; the legacy source
 *   actually resolves HEI > CCC > preferred — we match the source.)
 */
export function resolveEidIdentifiers(identifiers: Array<Identifier> | null | undefined): IdentifierResolution {
  const all = identifiers ?? [];
  if (all.length === 0) {
    return { allowedIdentifiers: [], defaultIdentifier: null };
  }

  const hasCcc = hasIdentifierType(all, CCC_IDENTIFIER_TYPE_UUID);
  const hasHei = hasIdentifierType(all, HEI_IDENTIFIER_TYPE_UUID);

  let allowedIdentifiers = all;
  if (hasCcc && !hasHei) {
    allowedIdentifiers = all.filter((i) => i.identifierType?.uuid === CCC_IDENTIFIER_TYPE_UUID);
  } else if (hasHei && !hasCcc) {
    allowedIdentifiers = all.filter((i) => i.identifierType?.uuid === HEI_IDENTIFIER_TYPE_UUID);
  }

  let ccc: Identifier | undefined;
  let hei: Identifier | undefined;
  let preferred: Identifier | undefined;
  allowedIdentifiers.forEach((i) => {
    if (i.identifierType?.uuid === CCC_IDENTIFIER_TYPE_UUID) {
      ccc = i;
    }
    if (i.identifierType?.uuid === HEI_IDENTIFIER_TYPE_UUID) {
      hei = i;
    }
    if (i.preferred) {
      preferred = i;
    }
  });

  let defaultIdentifier: Identifier | null = null;
  if (ccc) {
    defaultIdentifier = ccc;
  }
  if (hei) {
    defaultIdentifier = hei;
  }
  if (!ccc && !hei && preferred) {
    defaultIdentifier = preferred;
  }

  return { allowedIdentifiers, defaultIdentifier };
}

/**
 * Whether the patient is an "active HEI": age <= 18 months AND the patient's
 * first identifier is NOT of CCC type AND they have no CCC number at all.
 * `asOf` defaults to now; pass a fixed date for deterministic tests.
 */
export function isActiveHei(
  identifiers: Array<Identifier> | null | undefined,
  birthdate: string | Date,
  asOf?: Date,
): boolean {
  const all = identifiers ?? [];
  const ageInMonths = dayjs(asOf).diff(dayjs(birthdate), 'month');
  const firstIsCcc = all[0]?.identifierType?.uuid === CCC_IDENTIFIER_TYPE_UUID;

  if (ageInMonths <= 18 && !firstIsCcc) {
    return !hasIdentifierType(all, CCC_IDENTIFIER_TYPE_UUID);
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Payload builders                                                            */
/* -------------------------------------------------------------------------- */

export function createCD4Payload(input: BaseEidPayloadInput): Cd4EidPayload {
  const { order, locationUuid, patientIdentifier, patientName, sex, birthDate, dateReceived } = input;
  return {
    type: 'CD4',
    locationUuid,
    orderNumber: order.orderNumber,
    providerIdentifier: order.orderer?.identifier ?? '',
    patientName,
    patientIdentifier,
    sex,
    birthDate: formatDate(birthDate),
    dateDrawn: formatDate(order.dateActivated),
    dateReceived: formatDate(dateReceived),
  };
}

export function createDnaPcrPayload(input: BaseEidPayloadInput): DnaPcrEidPayload {
  const { order, encounterObs, locationUuid, patientIdentifier, patientName, sex, birthDate, dateReceived } = input;
  return {
    type: 'DNAPCR',
    locationUuid,
    orderNumber: order.orderNumber,
    providerIdentifier: order.orderer?.identifier ?? '',
    patientName,
    patientIdentifier,
    sex,
    birthDate: formatDate(birthDate),
    infantProphylaxisUuid: findObsValueByConceptUuid(encounterObs, DNA_PCR_OBS_CONCEPTS.infantProphylaxis),
    pmtctInterventionUuid: findObsValueByConceptUuid(encounterObs, DNA_PCR_OBS_CONCEPTS.pmtctIntervention),
    feedingTypeUuid: findObsValueByConceptUuid(encounterObs, DNA_PCR_OBS_CONCEPTS.feedingType),
    entryPointUuid: findObsValueByConceptUuid(encounterObs, DNA_PCR_OBS_CONCEPTS.entryPoint),
    motherHivStatusUuid: findObsValueByConceptUuid(encounterObs, DNA_PCR_OBS_CONCEPTS.motherHivStatus),
    dateDrawn: formatDate(order.dateActivated),
    dateReceived: formatDate(dateReceived),
  };
}

export function createViralLoadPayload(input: ViralLoadPayloadInput): ViralLoadEidPayload {
  const {
    order,
    encounterObs,
    locationUuid,
    patientIdentifier,
    patientName,
    sex,
    birthDate,
    dateReceived,
    artStartDateInitial,
    artStartDateCurrent,
    sampleType,
    artRegimenUuid,
    isPregnant,
    breastfeeding,
  } = input;

  return {
    type: 'VL',
    locationUuid,
    orderNumber: order.orderNumber,
    providerIdentifier: order.orderer?.identifier ?? '',
    patientName,
    patientIdentifier,
    sex,
    birthDate: formatDate(birthDate),
    artStartDateInitial: formatDate(artStartDateInitial),
    artStartDateCurrent: formatDate(artStartDateCurrent),
    sampleType,
    artRegimenUuid: artRegimenUuid ?? null,
    vlJustificationUuid: findObsValueByConceptUuid(encounterObs, VL_JUSTIFICATION_CONCEPT_UUID),
    isPregnant,
    breastfeeding,
    dateDrawn: formatDate(order.dateActivated),
    dateReceived: formatDate(dateReceived),
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Validates the user input prior to submission. Returns an error message, or
 * `null` when the input is valid. Combines the legacy `isUserInputValid` and
 * `hasLoadingTimeRequiredInputs` checks.
 */
export function validateEidSubmission(input: EidValidationInput): string | null {
  const { order, orderType, labLocation, patientIdentifier, sampleType, dateReceived, hivSummary } = input;

  if (!order) {
    return 'Order information is required. Please try again.';
  }
  if (!orderType) {
    return 'Unsupported order type.';
  }
  if (!labLocation) {
    return 'Lab location is required.';
  }
  if (!patientIdentifier) {
    return 'Patient identifier is required.';
  }
  if (orderType === 'VL' && (sampleType === null || sampleType === undefined)) {
    return 'Sample type is required.';
  }
  if (!dayjs(dateReceived).isValid()) {
    return 'Date received is required.';
  }
  if (orderType === 'VL' && !hivSummary) {
    return 'HIV Summary information is required. Please try again.';
  }

  return null;
}
