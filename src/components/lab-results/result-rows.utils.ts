import type { LabOrderConcept, Observation } from '../../types';

export interface LabResultRowData {
  id: string;
  concept: LabOrderConcept;
  observation?: Observation;
}

/** Flattens nested panel concepts and their matching observation groups into displayable leaf rows. */
export function flattenLabResultRows(
  concept: LabOrderConcept,
  observation?: Observation,
  parentId = concept.uuid,
): Array<LabResultRowData> {
  if (!concept.setMembers?.length) {
    return [
      {
        id: observation?.uuid ?? `${parentId}:${concept.uuid}`,
        concept,
        observation,
      },
    ];
  }

  return concept.setMembers.flatMap((member) => {
    const memberObservation = observation?.groupMembers?.find(
      (groupMember) => groupMember.concept?.uuid === member.uuid,
    );
    return flattenLabResultRows(member, memberObservation, observation?.uuid ?? parentId);
  });
}
