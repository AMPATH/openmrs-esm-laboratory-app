import React, { useState } from 'react';
import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  ExtensionSlot,
  showNotification,
  showSnackbar,
  useAbortController,
  type Order,
  showModal,
} from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import {
  updateObservationAndOrder,
  useCompletedLabResultsArray,
  useInvalidateLabOrders,
} from '../../laboratory.resource';
import styles from './approval-lab-results-modal.scss';

interface ApproveLabResultsModal {
  closeModal: () => void;
  order: Order;
}

const ApproveLabResultsModal: React.FC<ApproveLabResultsModal> = ({ order, closeModal }) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortController = useAbortController();
  const invalidateLabOrders = useInvalidateLabOrders();
  const { completeLabResults, isLoading } = useCompletedLabResultsArray(order);

  const handleApproval = async () => {
    if (isLoading || completeLabResults.length === 0) {
      showNotification({
        title: t('cannotApproveResults', 'Cannot approve results'),
        kind: 'error',
        critical: true,
        description: t('noSavedResultsToApprove', 'No saved lab results are available to approve.'),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateObservationAndOrder(order, 'FINAL', 'COMPLETED', abortController, completeLabResults);
      invalidateLabOrders();
      closeModal();
      showSnackbar({
        isLowContrast: true,
        title: t('resultsApproved', 'Results Approved'),
        kind: 'success',
        subtitle: t('labResultsApprovedSuccessfully', 'Lab results have been successfully approved and finalized'),
      });
    } catch (error) {
      showNotification({
        title: t('errorApprovingResults', 'Error approving results'),
        kind: 'error',
        critical: true,
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = () => {
    closeModal();
    setTimeout(() => {
      const dispose = showModal('reject-lab-request-modal', {
        closeModal: () => dispose(),
        order,
      });
    }, 0);
  };

  return (
    <div className={styles.modalContainer}>
      <ModalHeader closeModal={closeModal} title={t('approveLabResults', 'Approve Lab Results')} />
      <ModalBody className={styles.modalBody}>
        <p>
          {t(
            'approveResultsConfirmationText',
            'You are about to approve and finalize these lab results. Once approved, the results will be marked as complete and made available to clinicians. Are you sure you want to proceed?',
          )}
        </p>
        <div className={styles.resultsContainer}>
          <ExtensionSlot state={{ order: order }} name="completed-lab-order-results-slot-1" />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="danger" onClick={handleReject}>
          {t('rejectLabResults', 'Reject lab results')}
        </Button>
        <Button
          type="submit"
          onClick={handleApproval}
          disabled={isSubmitting || isLoading || completeLabResults.length === 0}
        >
          {t('approveResults', 'Approve Results')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default ApproveLabResultsModal;
