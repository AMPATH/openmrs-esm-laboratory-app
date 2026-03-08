import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InlineLoading } from '@carbon/react';
import { launchWorkspace, useConfig, type Order } from '@openmrs/esm-framework';
import styles from './actions.scss';
import { type Config } from '../../config-schema';
import { type BillStatus } from '../../types';

interface GenerateBillRequestActionMenuProps {
  order: Order;
  billStatus: BillStatus;
  isLoading: boolean;
  mutated: () => void;
}

const GenerateBillRequestAction: React.FC<GenerateBillRequestActionMenuProps> = ({
  order,
  billStatus = 'BLANK',
  isLoading,
  mutated,
}) => {
  const { t } = useTranslation();
  const { laboratoryServiceTypedUuid } = useConfig<Config>();

  const launchBillWorkspace = () => {
    launchWorkspace('create-order-bill-form-workspace', {
      workspaceTitle: t('createOrderBill', 'Create order bill form'),
      order,
      quantity: 1,
      serviceTypeUuid: laboratoryServiceTypedUuid,
      mutated,
    });
  };

  return isLoading ? (
    <InlineLoading description="Checking bills" />
  ) : billStatus === 'PENDING' ? (
    <Button className={styles.actionButton} size="sm" kind="secondary" key={order.uuid}>
      {t('pendingPayment', 'Pending payment')}
    </Button>
  ) : billStatus === 'BLANK' ? (
    <Button className={styles.actionButton} size="sm" kind="primary" key={order.uuid} onClick={launchBillWorkspace}>
      {t('generateBill', 'Generate bill')}
    </Button>
  ) : null;
};

export default GenerateBillRequestAction;
