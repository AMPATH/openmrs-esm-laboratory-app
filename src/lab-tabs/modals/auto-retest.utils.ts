import type { Order } from '@openmrs/esm-framework';

export const AUTO_RETEST_MARKER = '[AUTO-HIV-RETEST';

export interface AutoRetestConfig {
  enableHivAutoRetest: boolean;
  hivAutoRetestConceptUuids: Array<string>;
  hivPositiveAnswerUuid: string;
}

export type RetestCandidate = Partial<Pick<Order, 'uuid' | 'concept' | 'dateActivated' | 'commentToFulfiller'>> & {
  uuid: string;
};

function containsAnswer(value: unknown, answerUuid: string): boolean {
  if (value === answerUuid) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsAnswer(item, answerUuid));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return record.uuid === answerUuid || Object.values(record).some((item) => containsAnswer(item, answerUuid));
  }
  return false;
}

export function isPositiveResult(results: Array<unknown>, positiveAnswerUuid: string): boolean {
  return Boolean(positiveAnswerUuid) && containsAnswer(results, positiveAnswerUuid);
}

export function isAutoRetest(order: Order): boolean {
  return Boolean(order.commentToFulfiller?.includes(AUTO_RETEST_MARKER));
}

export function shouldAutoRetest(
  order: Order,
  results: Array<unknown>,
  config: AutoRetestConfig,
  encounterOrders: Array<RetestCandidate>,
): boolean {
  if (
    !config.enableHivAutoRetest ||
    !config.hivPositiveAnswerUuid ||
    !config.hivAutoRetestConceptUuids.includes(order.concept?.uuid ?? '') ||
    !isPositiveResult(results, config.hivPositiveAnswerUuid) ||
    isAutoRetest(order)
  ) {
    return false;
  }

  // A prior order for this concept in the same encounter is a conservative fallback
  // for legacy retests that predate the explicit marker.
  return !encounterOrders.some((candidate) => {
    if (
      candidate.uuid === order.uuid ||
      candidate.concept?.uuid !== order.concept?.uuid ||
      !candidate.dateActivated ||
      !order.dateActivated
    ) {
      return false;
    }

    const candidateDate = Date.parse(candidate.dateActivated);
    const currentOrderDate = Date.parse(order.dateActivated);
    return Number.isFinite(candidateDate) && Number.isFinite(currentOrderDate) && candidateDate < currentOrderDate;
  });
}
