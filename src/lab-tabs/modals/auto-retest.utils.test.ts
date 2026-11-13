import type { Order } from '@openmrs/esm-framework';
import { AUTO_RETEST_MARKER, isPositiveResult, shouldAutoRetest } from './auto-retest.utils';

const config = {
  enableHivAutoRetest: true,
  hivAutoRetestConceptUuids: ['hiv-test-concept'],
  hivPositiveAnswerUuid: 'positive-answer',
};

const initialOrder = {
  uuid: 'initial-order',
  concept: { uuid: 'hiv-test-concept' },
  dateActivated: '2026-01-01T10:00:00Z',
} as Order;

it('detects a configured coded positive answer recursively', () => {
  expect(
    isPositiveResult([{ concept: { uuid: 'result' }, value: { uuid: 'positive-answer' } }], 'positive-answer'),
  ).toBe(true);
  expect(isPositiveResult([{ value: { uuid: 'negative-answer' } }], 'positive-answer')).toBe(false);
});

it('reorders only a positive initial eligible test', () => {
  const positiveResults = [{ value: { uuid: 'positive-answer' } }];
  expect(shouldAutoRetest(initialOrder, positiveResults, config, [initialOrder])).toBe(true);
  expect(shouldAutoRetest(initialOrder, [{ value: { uuid: 'negative-answer' } }], config, [initialOrder])).toBe(false);
  expect(
    shouldAutoRetest(initialOrder, positiveResults, { ...config, enableHivAutoRetest: false }, [initialOrder]),
  ).toBe(false);
});

it('does not retest a marked retest or an earlier same-visit order', () => {
  const positiveResults = [{ value: { uuid: 'positive-answer' } }];
  const retest = {
    ...initialOrder,
    uuid: 'retest-order',
    dateActivated: '2026-01-02T10:00:00Z',
    commentToFulfiller: `${AUTO_RETEST_MARKER} originalOrder=initial-order]`,
  } as Order;
  expect(shouldAutoRetest(retest, positiveResults, config, [initialOrder, retest])).toBe(false);

  const duplicateManualOrder = {
    ...initialOrder,
    uuid: 'earlier-order',
    dateActivated: '2025-12-31T10:00:00Z',
  } as Order;
  expect(shouldAutoRetest(initialOrder, positiveResults, config, [duplicateManualOrder, initialOrder])).toBe(false);
});

it('does not treat an order with missing activation dates as a prior retest', () => {
  const positiveResults = [{ value: { uuid: 'positive-answer' } }];
  const undatedOrder = { ...initialOrder, uuid: 'undated-order', dateActivated: undefined };
  expect(shouldAutoRetest(initialOrder, positiveResults, config, [undatedOrder, initialOrder])).toBe(true);
});
