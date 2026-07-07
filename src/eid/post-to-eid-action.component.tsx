import React, { useCallback } from 'react';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { showModal, type Order } from '@openmrs/esm-framework';
import { isEidEligibleOrder } from './eid.utils';
import styles from '../lab-tabs/actions/actions.scss';

interface PostToEidActionProps {
  order: Order;
}

/**
 * Eligibility-gated "Post to EID" button. Rendered into the tests-ordered
 * actions slot; it only shows for DNA PCR, Viral Load and CD4 orders.
 */
const PostToEidAction: React.FC<PostToEidActionProps> = ({ order }) => {
  const { t } = useTranslation();

  const launchPostToEidModal = useCallback(() => {
    const dispose = showModal('post-to-eid-modal', {
      closeModal: () => dispose(),
      order,
    });
  }, [order]);

  if (!isEidEligibleOrder(order)) {
    return null;
  }

  return (
    <Button className={styles.actionButton} size="sm" kind="tertiary" key={order.uuid} onClick={launchPostToEidModal}>
      {t('postToEid', 'Post to EID')}
    </Button>
  );
};

export default PostToEidAction;
