import type { Observation } from '../types';

/** Returns distinct UUIDs for result-bearing observations, excluding empty group containers. */
export function getResultObservationUuids(observations: Array<Observation>): Array<string> {
  const uuids = new Set<string>();
  const visit = (items: Array<Observation>) => {
    items.forEach((observation) => {
      const hasResultValue = observation.value !== null && observation.value !== undefined && observation.value !== '';
      if (observation.uuid && hasResultValue) {
        uuids.add(observation.uuid);
      }
      if (observation.groupMembers?.length) {
        visit(observation.groupMembers);
      }
    });
  };

  visit(observations);
  return [...uuids];
}
