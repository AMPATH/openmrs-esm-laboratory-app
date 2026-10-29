import { createLabResultObservation } from './lab-results-form.utils';
import type { LabOrderConcept } from '../types';
import type { Order } from '@openmrs/esm-framework';
import { getResultObservationUuids } from './observation-status.utils';

const order = {
  uuid: 'order-uuid',
} as Order;

const numericConcept = (uuid: string): LabOrderConcept =>
  ({
    uuid,
    display: uuid,
    set: false,
    datatype: { display: 'Numeric' },
    setMembers: [],
  } as LabOrderConcept);

it('builds nested panel observations and retains zero-valued results', () => {
  const concept: LabOrderConcept = {
    uuid: 'urinalysis-uuid',
    display: 'Urinalysis',
    set: true,
    datatype: { display: 'N/A' },
    setMembers: [
      {
        uuid: 'macroscopy-uuid',
        display: 'Macroscopy',
        set: true,
        datatype: { display: 'N/A' },
        setMembers: [numericConcept('ph-uuid')],
      } as LabOrderConcept,
    ],
  } as LabOrderConcept;

  expect(createLabResultObservation(concept, { 'ph-uuid': 0 }, order)).toEqual({
    concept: { uuid: 'urinalysis-uuid' },
    order: { uuid: 'order-uuid' },
    status: 'PRELIMINARY',
    groupMembers: [
      {
        concept: { uuid: 'macroscopy-uuid' },
        order: { uuid: 'order-uuid' },
        status: 'PRELIMINARY',
        groupMembers: [
          {
            concept: { uuid: 'ph-uuid' },
            order: { uuid: 'order-uuid' },
            status: 'PRELIMINARY',
            value: 0,
          },
        ],
      },
    ],
  });
});

it('collects only result-bearing observation UUIDs recursively for final approval', () => {
  expect(
    getResultObservationUuids([
      {
        uuid: 'root-obs',
        groupMembers: [
          {
            uuid: 'panel-obs',
            groupMembers: [{ uuid: 'result-obs', value: 'positive' } as any],
          } as any,
          { uuid: 'empty-result-obs', value: null } as any,
        ],
      } as any,
    ]),
  ).toEqual(['result-obs']);
});
