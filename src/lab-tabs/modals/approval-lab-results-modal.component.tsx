import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import {
  ExtensionSlot,
  showNotification,
  showSnackbar,
  useAbortController,
  useConfig,
  type Order,
  showModal,
} from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import {
  createOrResumeHivRetest,
  updateObservationAndOrder,
  useCompletedLabResultsArray,
  useInvalidateLabOrders,
  usePatientOrders,
} from '../../laboratory.resource';
import { type Config } from '../../config-schema';
import { isAutoRetest, isPositiveResult, shouldAutoRetest } from './auto-retest.utils';
import styles from './approval-lab-results-modal.scss';

interface ApproveLabResultsModal {
  closeModal: () => void;
  order: Order;
}

const ApproveLabResultsModal: React.FC<ApproveLabResultsModal> = ({ order, closeModal }) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortController = useAbortController();
  const { enableHivAutoRetest, hivAutoRetestConceptUuids, hivPositiveAnswerUuid, laboratoryOrderTypeUuid } =
    useConfig<Config>();
  const invalidateLabOrders = useInvalidateLabOrders();
  const { completeLabResults, isLoading } = useCompletedLabResultsArray(order);
  const [approved, setApproved] = useState(false);
  const [retestError, setRetestError] = useState<string | null>(null);
  const submissionLock = useRef(false);

  const { patientOrders, isLoading: isLoadingPatientOrders } = usePatientOrders(order);

  const shouldRetest = useMemo(() => {
    const isPositive = isPositiveResult(completeLabResults, hivPositiveAnswerUuid);

    const isRetest = isAutoRetest(order);

    return isPositive && hivAutoRetestConceptUuids.includes(order.concept?.uuid ?? '') && !isRetest;
  }, [completeLabResults, hivPositiveAnswerUuid, hivAutoRetestConceptUuids, order]);

  const createRetest = async () => {
    const visitOrders = patientOrders ?? [];
    const marker = `[AUTO-HIV-RETEST originalOrder=${order.uuid}]`;
    const existingRetest = visitOrders.find((candidate) => candidate.commentToFulfiller?.includes(marker));
    if (existingRetest) {
      await createOrResumeHivRetest(order, visitOrders, laboratoryOrderTypeUuid, abortController);
      invalidateLabOrders();
      return true;
    }

    const shouldCreate = shouldRetest;
    if (shouldCreate) {
      await createOrResumeHivRetest(order, visitOrders, laboratoryOrderTypeUuid, abortController);
    }
    invalidateLabOrders();
    return shouldCreate;
  };

  const handleApproval = async () => {
    if (submissionLock.current) return;
    if (isLoading || completeLabResults.length === 0) {
      showNotification({
        title: t('cannotApproveResults', 'Cannot approve results'),
        kind: 'error',
        critical: true,
        description: t('noSavedResultsToApprove', 'No saved lab results are available to approve.'),
      });
      return;
    }

    submissionLock.current = true;
    setIsSubmitting(true);
    try {
      if (!approved) {
        await updateObservationAndOrder(order, 'FINAL', 'COMPLETED', abortController, completeLabResults);
        setApproved(true);
      }

      if (shouldRetest) {
        try {
          const created = await createRetest();
          if (created) {
            showSnackbar({
              isLowContrast: true,
              title: t('hivRetestCreated', 'HIV retest created'),
              kind: 'success',
              subtitle: t('hivRetestCreatedMessage', 'A new retest order was created and placed in progress.'),
            });
          }
          setRetestError(null);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          setRetestError(message);
          invalidateLabOrders();
          showNotification({
            title: t('hivRetestFailed', 'Results approved, but retest creation failed'),
            kind: 'error',
            critical: true,
            description: message,
          });
          return;
        }
      }

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
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const handleRetryRetest = async () => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    try {
      const created = await createRetest();
      setRetestError(null);
      closeModal();
      showSnackbar({
        isLowContrast: true,
        title: t(created ? 'hivRetestCreated' : 'resultsApproved', created ? 'HIV retest created' : 'Results Approved'),
        kind: 'success',
        subtitle: t(
          created ? 'hivRetestCreatedMessage' : 'labResultsApprovedSuccessfully',
          created
            ? 'A new retest order was created and placed in progress.'
            : 'Lab results have been successfully approved and finalized',
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRetestError(message);
      showNotification({
        title: t('hivRetestFailed', 'Results approved, but retest creation failed'),
        kind: 'error',
        critical: true,
        description: message,
      });
    } finally {
      submissionLock.current = false;
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
        {shouldRetest && (
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={t(
              'hivRetestDisclaimer',
              'A positive initial HIV result will create a new retest order on approval.',
            )}
          />
        )}
        <p>
          {t(
            'approveResultsConfirmationText',
            'You are about to approve and finalize these lab results. Once approved, the results will be marked as complete and made available to clinicians. Are you sure you want to proceed?',
          )}
        </p>
        {retestError && approved && (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('hivRetestRetryPrompt', 'The result is approved, but the retest is not yet available.')}
            subtitle={retestError}
          />
        )}
        <div className={styles.resultsContainer}>
          <ExtensionSlot state={{ order: order }} name="completed-lab-order-results-slot-1" />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="danger" onClick={handleReject}>
          {t('rejectLabResults', 'Reject lab results')}
        </Button>
        {retestError && approved && (
          <Button kind="secondary" onClick={handleRetryRetest} disabled={isSubmitting}>
            {t('retryHivRetest', 'Retry retest creation')}
          </Button>
        )}
        <Button
          type="submit"
          onClick={handleApproval}
          disabled={isSubmitting || isLoading || isLoadingPatientOrders || completeLabResults.length === 0 || approved}
        >
          {t('approveResults', 'Approve Results')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default ApproveLabResultsModal;
