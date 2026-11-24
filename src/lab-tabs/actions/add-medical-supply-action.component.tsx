import React, { useState } from 'react';
import { Button } from '@carbon/react';
import {
  AddIcon,
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  showNotification,
  type Order,
  type Visit,
  useConfig,
} from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../config-schema';
import styles from './actions.scss';

interface AddMedicalSupplyActionProps {
  order: Order;
}

const AddMedicalSupplyAction: React.FC<AddMedicalSupplyActionProps> = ({ order }) => {
  const { t } = useTranslation();
  const { medicalSupplyOrderTypeUuid } = useConfig<Config>();
  const [isLoading, setIsLoading] = useState(false);

  const addMedicalSupply = async () => {
    if (isLoading) return;
    const patientUuid = order.patient?.uuid;
    if (!patientUuid) {
      showNotification({
        title: t('medicalSupplyOrderBasketError', 'Unable to open medical supply order basket'),
        kind: 'error',
        critical: true,
        description: t('medicalSupplyPatientRequired', 'The lab order does not include a patient.'),
      });
      return;
    }

    setIsLoading(true);
    try {
      const visitsResponse = await openmrsFetch<{ results: Array<Visit> }>(
        `${restBaseUrl}/visit?patient=${patientUuid}&v=default&includeInactive=false`,
      );
      const activeVisit = visitsResponse.data.results?.[0];
      if (!activeVisit) {
        showNotification({
          title: t('medicalSupplyVisitRequired', 'Active visit required'),
          kind: 'error',
          critical: true,
          description: t(
            'medicalSupplyVisitRequiredDescription',
            'An active visit is required to add a medical supply.',
          ),
        });
        return;
      }

      const patient = {
        resourceType: 'Patient',
        id: patientUuid,
        name: order.patient.display ? [{ text: order.patient.display }] : [],
      } as const;

      await launchWorkspace2(
        'order-basket',
        {},
        {
          patientUuid,
          patient,
          visitContext: activeVisit,
          drugOrderWorkspaceName: 'unused-drug-order-workspace',
          labOrderWorkspaceName: 'add-test-order-basket-add-lab-order-workspace',
          generalOrderWorkspaceName: 'lab-medical-supply-add-order-workspace',
          visibleOrderPanels: [medicalSupplyOrderTypeUuid],
        },
        {
          patientUuid,
          patient,
          visitContext: activeVisit,
        },
      );
    } catch (error) {
      showNotification({
        title: t('medicalSupplyOrderBasketError', 'Unable to open medical supply order basket'),
        kind: 'error',
        critical: true,
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.medicalSupplyActionContainer}>
      <Button
        className={styles.medicalSupplyActionButton}
        kind="tertiary"
        renderIcon={() => <AddIcon className={styles.actionButtonIcon} />}
        onClick={addMedicalSupply}
        disabled={isLoading}
        size="sm"
      >
        {t('addMedicalSupply', 'Add medical supply')}
      </Button>
    </div>
  );
};

export default AddMedicalSupplyAction;
