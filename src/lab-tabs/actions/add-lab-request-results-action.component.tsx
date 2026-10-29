import React from 'react';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { AddIcon, launchWorkspace2 } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-framework';
import styles from './actions.scss';

interface AddLabRequestResultsActionProps {
  order: Order;
}

const AddLabRequestResultsAction: React.FC<AddLabRequestResultsActionProps> = ({ order }) => {
  const { t } = useTranslation();

  const launchTestResultsWorkspace = () => {
    launchWorkspace2('lab-app-test-results-form-workspace', {
      patient: order.patient,
      order,
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
