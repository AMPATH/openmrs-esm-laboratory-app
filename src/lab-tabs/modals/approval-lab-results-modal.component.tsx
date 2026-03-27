import React, { useEffect, useState } from 'react';
import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  type Config,
  ExtensionSlot,
  showNotification,
  showSnackbar,
  useAbortController,
  useConfig,
  type Order,
} from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import {
  setFulfillerStatus,
  updateObservationAndOrder,
  useInvalidateLabOrders,
  useMappedLabConcepts,
} from '../../laboratory.resource';

interface ApproveLabResultsModal {
  closeModal: () => void;
  order: Order;
}

const ApproveLabResultsModal: React.FC<ApproveLabResultsModal> = ({ order, closeModal }) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortController = useAbortController();
  const invalidateLabOrders = useInvalidateLabOrders();
  const { laboratoryOrderTypeUuid } = useConfig<Config>();
  const { completeLabResults, values, mutateResults } = useMappedLabConcepts(order);

  const handleApproval = () => {
    setIsSubmitting(true);
    if (completeLabResults && completeLabResults.length > 0) {
      updateObservationAndOrder(order, 'FINAL', 'COMPLETED', abortController, values, completeLabResults)
        .then(() => {
          setIsSubmitting(false);
          closeModal();
          showSnackbar({
            isLowContrast: true,
            title: t('resultsApproved', 'Results Approved'),
            kind: 'success',
            subtitle: t('labResultsApprovedSuccessfully', 'Lab results have been successfully approved and finalized'),
          });
        })
        .catch((error) => {
          setIsSubmitting(false);
          showNotification({
            title: t('errorApprovingResults', 'Error approving results'),
            kind: 'error',
            critical: true,
            description: error?.message,
          });
        });
      invalidateLabOrders();
    }
    // setFulfillerStatus(order.uuid, 'COMPLETED', abortController).then(
    //   () => {
    //     // invalidateLabOrders();
    //     setIsSubmitting(false);
    //     closeModal();
    //     showSnackbar({
    //       isLowContrast: true,
    //       title: t('resultsApproved', 'Results Approved'),
    //       kind: 'success',
    //       subtitle: t('labResultsApprovedSuccessfully', 'Lab results have been successfully approved and finalized'),
    //     });
    //   },
    //   (error) => {
    //     setIsSubmitting(false);
    //     showNotification({
    //       title: t('errorApprovingResults', 'Error approving results'),
    //       kind: 'error',
    //       critical: true,
    //       description: error?.message,
    //     });
    //   },
    // );
  };

  return (
    <div>
      <ModalHeader closeModal={closeModal} title={t('approveLabResults', 'Approve Lab Results')} />
      <ModalBody>
        <p>
          {t(
            'approveResultsConfirmationText',
            'You are about to approve and finalize these lab results. Once approved, the results will be marked as complete and made available to clinicians. Are you sure you want to proceed?',
          )}
        </p>
        <>
          <ExtensionSlot state={{ order: order }} name="completed-lab-order-results-slot" />
        </>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button type="submit" onClick={handleApproval} disabled={isSubmitting}>
          {t('approveResults', 'Approve Results')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default ApproveLabResultsModal;
