import { flattenLabResultRows } from './result-rows.utils';
import type { LabOrderConcept, Observation } from '../../types';

const conceptTree = {
  uuid: 'urinalysis',
  display: 'Urinalysis',
  setMembers: [
    {
      uuid: 'macroscopy',
      display: 'Macroscopy panel',
      setMembers: [{ uuid: 'protein', display: 'Protein' }],
    },
    {
      uuid: 'microscopy',
      display: 'Microscopy panel',
      setMembers: [{ uuid: 'rbc', display: 'RBC' }],
    },
  ],
} as LabOrderConcept;
const proteinConcept = conceptTree.setMembers![0].setMembers![0];
const rbcConcept = conceptTree.setMembers![1].setMembers![0];

it('flattens observations nested inside multiple panel levels to their leaf result rows', () => {
  const observation = {
    uuid: 'urinalysis-obs',
    concept: { uuid: 'urinalysis' },
    groupMembers: [
      {
        uuid: 'macroscopy-obs',
        concept: { uuid: 'macroscopy' },
        groupMembers: [{ uuid: 'protein-obs', concept: { uuid: 'protein' }, value: 'Negative' }],
      },
      {
        uuid: 'microscopy-obs',
        concept: { uuid: 'microscopy' },
        groupMembers: [{ uuid: 'rbc-obs', concept: { uuid: 'rbc' }, value: 4 }],
      },
    ],
  } as Observation;

  expect(flattenLabResultRows(conceptTree, observation)).toEqual([
    {
      id: 'protein-obs',
      concept: proteinConcept,
      observation: observation.groupMembers![0].groupMembers![0],
    },
    {
      id: 'rbc-obs',
      concept: rbcConcept,
      observation: observation.groupMembers![1].groupMembers![0],
    },
  ]);
});

it('keeps leaf rows even when their nested observation is absent', () => {
  expect(flattenLabResultRows(conceptTree)).toEqual([
    { id: 'urinalysis:protein', concept: proteinConcept, observation: undefined },
    { id: 'urinalysis:rbc', concept: rbcConcept, observation: undefined },
  ]);
});
