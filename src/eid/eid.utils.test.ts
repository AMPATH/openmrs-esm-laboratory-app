import {
  BREASTFEEDING_VALUE_UUID,
  CCC_IDENTIFIER_TYPE_UUID,
  DNA_PCR_OBS_CONCEPTS,
  HEI_IDENTIFIER_TYPE_UUID,
  PMTCT_CATEGORY_CONCEPT_UUID,
  PREGNANT_VALUE_UUID,
  VL_JUSTIFICATION_CONCEPT_UUID,
} from './eid.constants';
import type { EidObs, EidOrder, Identifier } from './eid.types';
import {
  createCD4Payload,
  createDnaPcrPayload,
  createViralLoadPayload,
  derivePregnancyFlags,
  determineEidOrderType,
  findObsByConceptUuid,
  findObsValueByConceptUuid,
  formatDate,
  isActiveHei,
  isEidEligibleOrder,
  resolveEidIdentifiers,
  validateEidSubmission,
} from './eid.utils';

const CD4_CONCEPT = 'a896cce6-1350-11df-a1f1-0026b9348838';
const VL_CONCEPT = 'a8982474-1350-11df-a1f1-0026b9348838';
const DNAPCR_CONCEPT = 'a898fe80-1350-11df-a1f1-0026b9348838';
const HPV_CONCEPT = 'a8a46fd6-1350-11df-a1f1-0026b9348838';

const codedObs = (uuid: string, conceptUuid: string, valueUuid: string): EidObs => ({
  uuid,
  concept: { uuid: conceptUuid },
  value: { uuid: valueUuid },
});

const baseOrder = (conceptUuid: string): EidOrder => ({
  uuid: 'order-1',
  orderNumber: 'ORD-1',
  dateActivated: '2026-01-15T10:00:00.000+0300',
  concept: { uuid: conceptUuid, display: 'Test' },
  orderer: { uuid: 'orderer-1', display: 'Dr. Who', identifier: 'PROV-123' },
  encounter: { uuid: 'enc-1', location: { uuid: 'loc-1' }, obs: [] },
  patient: {
    uuid: 'pt-1',
    display: 'Jane Doe',
    identifiers: [],
    person: { uuid: 'person-1', display: 'Jane Doe', gender: 'F', birthdate: '1990-05-20' },
  },
});

const identifier = (overrides: Partial<Identifier> & { typeUuid?: string }): Identifier => ({
  uuid: overrides.uuid ?? 'id-uuid',
  identifier: overrides.identifier ?? 'VALUE',
  preferred: overrides.preferred ?? false,
  identifierType: { uuid: overrides.typeUuid ?? 'some-type', name: overrides.identifierType?.name ?? 'Some Type' },
  display: overrides.display,
});

describe('formatDate', () => {
  it('formats a valid date as YYYY-MM-DD', () => {
    expect(formatDate('2026-01-15T10:00:00.000+0300')).toBe('2026-01-15');
  });

  it('returns empty string for invalid/empty dates', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('order type identification', () => {
  it('resolves supported types', () => {
    expect(determineEidOrderType(baseOrder(CD4_CONCEPT))).toBe('CD4');
    expect(determineEidOrderType(baseOrder(VL_CONCEPT))).toBe('VL');
    expect(determineEidOrderType(baseOrder(DNAPCR_CONCEPT))).toBe('DNAPCR');
  });

  it('returns null for unsupported types (incl. HPV)', () => {
    expect(determineEidOrderType(baseOrder(HPV_CONCEPT))).toBeNull();
    expect(determineEidOrderType(baseOrder('random'))).toBeNull();
  });

  it('isEidEligibleOrder gates HPV and unknowns out', () => {
    expect(isEidEligibleOrder({ concept: { uuid: CD4_CONCEPT } })).toBe(true);
    expect(isEidEligibleOrder({ concept: { uuid: HPV_CONCEPT } })).toBe(false);
    expect(isEidEligibleOrder(null)).toBe(false);
    expect(isEidEligibleOrder({})).toBe(false);
  });
});

describe('recursive obs search', () => {
  const obsTree: Array<EidObs> = [
    codedObs('o1', 'concept-a', 'val-a1'),
    {
      uuid: 'group-1',
      concept: { uuid: 'group-concept' },
      value: null,
      groupMembers: [
        codedObs('o2', 'concept-b', 'val-b1'),
        {
          uuid: 'group-2',
          concept: { uuid: 'nested-group' },
          value: null,
          groupMembers: [codedObs('o3', 'concept-b', 'val-b2')],
        },
      ],
    },
  ];

  it('collects all matches across nested group members', () => {
    const found = findObsByConceptUuid(obsTree, 'concept-b');
    expect(found.map((o) => o.uuid)).toEqual(['o2', 'o3']);
  });

  it('returns empty array for missing concept or empty input', () => {
    expect(findObsByConceptUuid(obsTree, 'nope')).toEqual([]);
    expect(findObsByConceptUuid(null, 'concept-a')).toEqual([]);
    expect(findObsByConceptUuid(obsTree, undefined)).toEqual([]);
  });

  it('findObsValueByConceptUuid returns coded value uuids as an array', () => {
    expect(findObsValueByConceptUuid(obsTree, 'concept-b')).toEqual(['val-b1', 'val-b2']);
  });

  it('findObsValueByConceptUuid stringifies primitive values and skips empties', () => {
    const obs: Array<EidObs> = [
      { uuid: 'n1', concept: { uuid: 'num' }, value: 42 },
      { uuid: 'n2', concept: { uuid: 'num' }, value: '' },
      { uuid: 'n3', concept: { uuid: 'num' }, value: null },
    ];
    expect(findObsValueByConceptUuid(obs, 'num')).toEqual(['42']);
  });
});

describe('derivePregnancyFlags', () => {
  it('flags pregnant', () => {
    const obs = [codedObs('p1', PMTCT_CATEGORY_CONCEPT_UUID, PREGNANT_VALUE_UUID)];
    expect(derivePregnancyFlags(obs)).toEqual({ isPregnant: 1, breastfeeding: 0 });
  });

  it('flags breastfeeding', () => {
    const obs = [codedObs('p1', PMTCT_CATEGORY_CONCEPT_UUID, BREASTFEEDING_VALUE_UUID)];
    expect(derivePregnancyFlags(obs)).toEqual({ isPregnant: 0, breastfeeding: 1 });
  });

  it('returns zeros when no pmtct category obs is present', () => {
    expect(derivePregnancyFlags([])).toEqual({ isPregnant: 0, breastfeeding: 0 });
    expect(derivePregnancyFlags(null)).toEqual({ isPregnant: 0, breastfeeding: 0 });
  });
});

describe('resolveEidIdentifiers', () => {
  it('returns empty resolution for no identifiers', () => {
    expect(resolveEidIdentifiers([])).toEqual({ allowedIdentifiers: [], defaultIdentifier: null });
  });

  it('restricts to CCC identifiers when CCC present and HEI absent', () => {
    const ccc = identifier({ uuid: 'ccc', identifier: 'CCC-1', typeUuid: CCC_IDENTIFIER_TYPE_UUID });
    const other = identifier({ uuid: 'other', identifier: 'OTHER-1' });
    const { allowedIdentifiers, defaultIdentifier } = resolveEidIdentifiers([ccc, other]);
    expect(allowedIdentifiers).toEqual([ccc]);
    expect(defaultIdentifier).toEqual(ccc);
  });

  it('restricts to HEI identifiers when HEI present and CCC absent', () => {
    const hei = identifier({ uuid: 'hei', identifier: 'HEI-1', typeUuid: HEI_IDENTIFIER_TYPE_UUID });
    const other = identifier({ uuid: 'other', identifier: 'OTHER-1', preferred: true });
    const { allowedIdentifiers, defaultIdentifier } = resolveEidIdentifiers([hei, other]);
    expect(allowedIdentifiers).toEqual([hei]);
    expect(defaultIdentifier).toEqual(hei);
  });

  it('lets HEI override CCC as the default (matches legacy source)', () => {
    const ccc = identifier({ uuid: 'ccc', identifier: 'CCC-1', typeUuid: CCC_IDENTIFIER_TYPE_UUID });
    const hei = identifier({ uuid: 'hei', identifier: 'HEI-1', typeUuid: HEI_IDENTIFIER_TYPE_UUID });
    const { allowedIdentifiers, defaultIdentifier } = resolveEidIdentifiers([ccc, hei]);
    // both types present -> no filtering
    expect(allowedIdentifiers).toEqual([ccc, hei]);
    expect(defaultIdentifier).toEqual(hei);
  });

  it('falls back to a preferred identifier when neither CCC nor HEI exists', () => {
    const a = identifier({ uuid: 'a', identifier: 'A' });
    const pref = identifier({ uuid: 'b', identifier: 'B', preferred: true });
    const { defaultIdentifier } = resolveEidIdentifiers([a, pref]);
    expect(defaultIdentifier).toEqual(pref);
  });
});

describe('isActiveHei', () => {
  const asOf = new Date('2026-01-01T00:00:00Z');

  it('is true for an infant (<=18 months) with no CCC and a non-CCC first identifier', () => {
    const ids = [identifier({ typeUuid: HEI_IDENTIFIER_TYPE_UUID })];
    expect(isActiveHei(ids, '2025-06-01', asOf)).toBe(true);
  });

  it('is false when the patient has a CCC number', () => {
    const ids = [
      identifier({ uuid: 'a', typeUuid: HEI_IDENTIFIER_TYPE_UUID }),
      identifier({ uuid: 'b', typeUuid: CCC_IDENTIFIER_TYPE_UUID }),
    ];
    expect(isActiveHei(ids, '2025-06-01', asOf)).toBe(false);
  });

  it('is false when the first identifier is CCC type', () => {
    const ids = [identifier({ typeUuid: CCC_IDENTIFIER_TYPE_UUID })];
    expect(isActiveHei(ids, '2025-06-01', asOf)).toBe(false);
  });

  it('is false for patients older than 18 months', () => {
    const ids = [identifier({ typeUuid: HEI_IDENTIFIER_TYPE_UUID })];
    expect(isActiveHei(ids, '2000-01-01', asOf)).toBe(false);
  });
});

describe('payload builders', () => {
  const commonInput = {
    locationUuid: 'loc-1',
    patientIdentifier: 'ID-123',
    patientName: 'Jane Doe',
    sex: 'F',
    birthDate: '1990-05-20',
    dateReceived: '2026-01-20',
  };

  it('createCD4Payload maps the flat fields', () => {
    const order = baseOrder(CD4_CONCEPT);
    const payload = createCD4Payload({ ...commonInput, order, encounterObs: [] });
    expect(payload).toEqual({
      type: 'CD4',
      locationUuid: 'loc-1',
      orderNumber: 'ORD-1',
      providerIdentifier: 'PROV-123',
      patientName: 'Jane Doe',
      patientIdentifier: 'ID-123',
      sex: 'F',
      birthDate: '1990-05-20',
      dateDrawn: '2026-01-15',
      dateReceived: '2026-01-20',
    });
  });

  it('createDnaPcrPayload sends raw concept uuid arrays for each obs field', () => {
    const order = baseOrder(DNAPCR_CONCEPT);
    const encounterObs: Array<EidObs> = [
      codedObs('a', DNA_PCR_OBS_CONCEPTS.infantProphylaxis, 'proph-uuid'),
      codedObs('b', DNA_PCR_OBS_CONCEPTS.motherHivStatus, 'mother-uuid'),
      codedObs('c', DNA_PCR_OBS_CONCEPTS.feedingType, 'feed-uuid'),
    ];
    const payload = createDnaPcrPayload({ ...commonInput, order, encounterObs });
    expect(payload.type).toBe('DNAPCR');
    expect(payload.infantProphylaxisUuid).toEqual(['proph-uuid']);
    expect(payload.motherHivStatusUuid).toEqual(['mother-uuid']);
    expect(payload.feedingTypeUuid).toEqual(['feed-uuid']);
    expect(payload.pmtctInterventionUuid).toEqual([]);
    expect(payload.entryPointUuid).toEqual([]);
    expect(payload.dateDrawn).toBe('2026-01-15');
  });

  it('createViralLoadPayload maps ART dates, sample type, regimen and pmtct flags', () => {
    const order = baseOrder(VL_CONCEPT);
    const encounterObs = [codedObs('vl', VL_JUSTIFICATION_CONCEPT_UUID, 'just-uuid')];
    const payload = createViralLoadPayload({
      ...commonInput,
      order,
      encounterObs,
      artStartDateInitial: '2020-03-01',
      artStartDateCurrent: '2021-04-01',
      sampleType: 2,
      artRegimenUuid: 999,
      isPregnant: 1,
      breastfeeding: 0,
    });
    expect(payload.type).toBe('VL');
    expect(payload.artStartDateInitial).toBe('2020-03-01');
    expect(payload.artStartDateCurrent).toBe('2021-04-01');
    expect(payload.sampleType).toBe(2);
    expect(payload.artRegimenUuid).toBe(999);
    expect(payload.vlJustificationUuid).toEqual(['just-uuid']);
    expect(payload.isPregnant).toBe(1);
    expect(payload.breastfeeding).toBe(0);
  });

  it('createViralLoadPayload coerces missing ART dates to empty strings and null regimen', () => {
    const order = baseOrder(VL_CONCEPT);
    const payload = createViralLoadPayload({
      ...commonInput,
      order,
      encounterObs: [],
      artStartDateInitial: null,
      artStartDateCurrent: undefined,
      sampleType: 1,
      artRegimenUuid: undefined,
      isPregnant: 0,
      breastfeeding: 1,
    });
    expect(payload.artStartDateInitial).toBe('');
    expect(payload.artStartDateCurrent).toBe('');
    expect(payload.artRegimenUuid).toBeNull();
    expect(payload.vlJustificationUuid).toEqual([]);
  });
});

describe('validateEidSubmission', () => {
  const validVl = {
    order: baseOrder(VL_CONCEPT),
    orderType: 'VL' as const,
    labLocation: 'ampath',
    patientIdentifier: 'ID-1',
    sampleType: 1,
    dateReceived: '2026-01-20',
    hivSummary: { arv_start_date: '2020-01-01' },
  };

  it('returns null for valid input', () => {
    expect(validateEidSubmission(validVl)).toBeNull();
  });

  it('requires an order', () => {
    expect(validateEidSubmission({ ...validVl, order: null })).toMatch(/order information/i);
  });

  it('requires a lab location', () => {
    expect(validateEidSubmission({ ...validVl, labLocation: '' })).toMatch(/lab location/i);
  });

  it('requires a patient identifier', () => {
    expect(validateEidSubmission({ ...validVl, patientIdentifier: '' })).toMatch(/identifier/i);
  });

  it('requires a sample type only for VL', () => {
    expect(validateEidSubmission({ ...validVl, sampleType: null })).toMatch(/sample type/i);
    const cd4 = { ...validVl, orderType: 'CD4' as const, sampleType: null, hivSummary: null };
    expect(validateEidSubmission(cd4)).toBeNull();
  });

  it('requires a valid date received', () => {
    expect(validateEidSubmission({ ...validVl, dateReceived: 'nope' })).toMatch(/date received/i);
  });

  it('requires HIV summary for VL only', () => {
    expect(validateEidSubmission({ ...validVl, hivSummary: null })).toMatch(/hiv summary/i);
  });
});
