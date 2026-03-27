import React, { useEffect, useState } from 'react';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { AddIcon, launchWorkspace2, restBaseUrl, useAbortController, useConfig } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-framework';
import { type Config } from '../../config-schema';
import styles from './actions.scss';
import { updateObservationAndOrder, useMappedLabConcepts } from '../../laboratory.resource';

interface AddLabRequestResultsActionProps {
  order: Order;
}

const AddLabRequestResultsAction: React.FC<AddLabRequestResultsActionProps> = ({ order }) => {
  const { t } = useTranslation();
  const { laboratoryOrderTypeUuid } = useConfig<Config>();
  const abortController = useAbortController();
  const { completeLabResults, values, mutateResults } = useMappedLabConcepts(order);

  useEffect(() => {
    if (completeLabResults && completeLabResults.length > 0) {
      updateObservationAndOrder(order, 'PRELIMINARY', 'ON_HOLD', abortController, values, completeLabResults);
      invalidateLabOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeLabResults, order, values, abortController]);

  function invalidateLabOrders() {
    mutate(
      (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?orderTypes=${laboratoryOrderTypeUuid}`),
    );
  }

  const mutated = () => {
    mutateResults();
  };

  const launchTestResultsWorkspace = () => {
    launchWorkspace2('lab-app-test-results-form-workspace', {
      patient: order.patient,
      order,
      invalidateLabOrders: mutated,
    });
  };

  return (
    <Button
      className={styles.actionButton}
      kind="primary"
      renderIcon={() => <AddIcon className={styles.actionButtonIcon} />}
      iconDescription={t('addLabResult', 'Add lab results')}
      onClick={launchTestResultsWorkspace}
      size="sm"
    >
      {t('addLabResult', 'Add lab results')}
    </Button>
  );
};

export default AddLabRequestResultsAction;
