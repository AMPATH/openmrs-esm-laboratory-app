import { type Order } from '@openmrs/esm-framework';
import { isCoded, isPanel } from '../laboratory.resource';
import type { LabOrderConcept, ObservationValue } from '../types';

export type LabResultFormValues = Record<string, ObservationValue>;

function getObservationValue(concept: LabOrderConcept, value: ObservationValue | undefined) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return isCoded(concept) ? { uuid: value } : value;
}

/** Recursively builds grouped OpenMRS observations from a concept tree and form values. */
export function createLabResultObservation(
  concept: LabOrderConcept,
  values: LabResultFormValues,
  order: Order,
): Record<string, unknown> | null {
  const observation = {
    concept: { uuid: concept.uuid },
    order: { uuid: order.uuid },
    status: 'PRELIMINARY',
  };

  if (isPanel(concept)) {
    const groupMembers = concept.setMembers
      .map((member) => createLabResultObservation(member, values, order))
      .filter((member): member is Record<string, unknown> => member !== null);
    return groupMembers.length ? { ...observation, groupMembers } : null;
  }

  const value = getObservationValue(concept, values[concept.uuid]);
  return value === null ? null : { ...observation, value };
}
