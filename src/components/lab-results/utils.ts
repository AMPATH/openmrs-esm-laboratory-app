import { assessValue, type OBSERVATION_INTERPRETATION, type ReferenceRanges } from '@openmrs/esm-patient-common-lib';
import { type LabOrderConcept, type Observation, type ObservationValue } from '../../types';

export const getInterpretationClass = (
  styles: Record<string, string>,
  interpretation: OBSERVATION_INTERPRETATION,
): string => {
  switch (interpretation) {
    case 'OFF_SCALE_HIGH':
      return styles['off-scale-high'];
    case 'CRITICALLY_HIGH':
      return styles['critically-high'];
    case 'HIGH':
      return styles['high'];
    case 'OFF_SCALE_LOW':
      return styles['off-scale-low'];
    case 'CRITICALLY_LOW':
      return styles['critically-low'];
    case 'LOW':
      return styles['low'];
    case 'NORMAL':
    default:
      return '';
  }
};

export const getEffectiveRanges = (
  concept: LabOrderConcept,
  referenceRangesMap?: Map<string, ReferenceRanges>,
): ReferenceRanges => {
  const apiRange = referenceRangesMap?.get(concept?.uuid);
  if (apiRange) {
    return {
      ...apiRange,
      units: apiRange.units ?? concept?.units ?? undefined,
    };
  }
  return {
    lowNormal: concept?.lowNormal ?? undefined,
    hiNormal: concept?.hiNormal ?? undefined,
    lowCritical: concept?.lowCritical ?? undefined,
    hiCritical: concept?.hiCritical ?? undefined,
    lowAbsolute: concept?.lowAbsolute ?? undefined,
    hiAbsolute: concept?.hiAbsolute ?? undefined,
    units: concept?.units ?? undefined,
  };
};

export function getConceptUuids(concept: LabOrderConcept | undefined): Array<string> {
  if (!concept) {
    return [];
  }
  const uuids = [concept.uuid];
  if (concept.setMembers) {
    concept.setMembers.forEach((member) => uuids.push(member.uuid));
  }
  return uuids;
}

export interface InterpretedResult {
  displayValue: string;
  interpretation: OBSERVATION_INTERPRETATION;
}

export function interpretObservation(obs: Observation, ranges: ReferenceRanges): InterpretedResult {
  const displayValue = getObservationDisplayValue(obs.value ?? obs);
  const numericValue = typeof obs.value === 'number' ? obs.value : parseFloat(displayValue);
  const obsInterpretation = getObsInterpretation(obs.interpretation);
  const interpretation = obsInterpretation ?? (!isNaN(numericValue) ? assessValue(numericValue, ranges) : 'NORMAL');
  const units = ranges.units ?? '';
  const valueIsNumeric = typeof obs.value === 'number';
  const valueWithUnits = valueIsNumeric && units ? `${displayValue} ${units}` : displayValue;
  return { displayValue: valueWithUnits, interpretation };
}

export const getObservationDisplayValue = (value: ObservationValue): string => {
  if (!value) return '--';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (value && typeof value === 'object' && 'display' in value) return value.display;
  return '--';
};

const validInterpretations = new Set<string>([
  'NORMAL',
  'HIGH',
  'CRITICALLY_HIGH',
  'OFF_SCALE_HIGH',
  'LOW',
  'CRITICALLY_LOW',
  'OFF_SCALE_LOW',
]);

export function getObsInterpretation(interpretation?: string): OBSERVATION_INTERPRETATION | undefined {
  if (interpretation && validInterpretations.has(interpretation)) {
    return interpretation as OBSERVATION_INTERPRETATION;
  }
  return undefined;
}
