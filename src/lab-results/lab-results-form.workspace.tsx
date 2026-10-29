import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  Button,
  Form,
  InlineLoading,
  NumberInput,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import {
  restBaseUrl,
  showSnackbar,
  useAbortController,
  useLayoutType,
  Workspace2,
  type Order,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { openmrsFetch } from '@openmrs/esm-framework';
import {
  isCoded,
  isNumeric,
  isPanel,
  isText,
  useCompletedLabResultsArray,
  useInvalidateLabOrders,
  useOrderConceptsByUuids,
} from '../laboratory.resource';
import type { LabOrderConcept, Observation, ObservationValue } from '../types';
import { createLabResultObservation, type LabResultFormValues } from './lab-results-form.utils';
import styles from './lab-results-form.scss';

type FormValues = LabResultFormValues;

interface LabResultsFormWorkspaceProps {
  patient: fhir.Patient;
  order: Order;
}

function findObservation(observations: Array<Observation>, conceptUuid: string): Observation | undefined {
  for (const observation of observations) {
    if (observation.concept?.uuid === conceptUuid) {
      return observation;
    }
    const nestedObservation = observation.groupMembers && findObservation(observation.groupMembers, conceptUuid);
    if (nestedObservation) {
      return nestedObservation;
    }
  }
  return undefined;
}

interface ResultConceptFieldsProps {
  concept: LabOrderConcept;
  control: Control<FormValues>;
  isTablet: boolean;
}

const ResultConceptFields: React.FC<ResultConceptFieldsProps> = ({ concept, control, isTablet }) => {
  const { t } = useTranslation();
  const size = isTablet ? 'lg' : 'sm';
  const label = concept.display || concept.name?.display || concept.name?.name || '--';

  if (isPanel(concept)) {
    return (
      <Accordion>
        <AccordionItem title={label} open>
          {concept.setMembers.map((member) => (
            <ResultConceptFields key={member.uuid} concept={member} control={control} isTablet={isTablet} />
          ))}
        </AccordionItem>
      </Accordion>
    );
  }

  if (isNumeric(concept)) {
    return (
      <Controller
        control={control}
        name={concept.uuid}
        render={({ field }) => (
          <NumberInput
            id={concept.uuid}
            label={label}
            allowEmpty
            disableWheel
            step={concept.allowDecimal ? 0.01 : 1}
            min={concept.lowAbsolute ?? undefined}
            max={concept.hiAbsolute ?? undefined}
            size={size}
            value={typeof field.value === 'number' || typeof field.value === 'string' ? field.value : ''}
            onChange={(_, { value }) => field.onChange(value === '' ? undefined : Number(value))}
          />
        )}
      />
    );
  }

  if (isCoded(concept)) {
    return (
      <Controller
        control={control}
        name={concept.uuid}
        render={({ field }) => (
          <Select
            id={concept.uuid}
            labelText={label}
            size={size}
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={field.onChange}
          >
            <SelectItem text={t('chooseAnOption', 'Choose an option')} value="" />
            {concept.answers?.map((answer) => (
              <SelectItem key={answer.uuid} text={answer.display} value={answer.uuid} />
            ))}
          </Select>
        )}
      />
    );
  }

  if (isText(concept)) {
    return (
      <Controller
        control={control}
        name={concept.uuid}
        render={({ field }) => (
          <TextInput
            id={concept.uuid}
            labelText={label}
            size={size}
            value={typeof field.value === 'string' || typeof field.value === 'number' ? field.value : ''}
            onChange={field.onChange}
          />
        )}
      />
    );
  }

  return (
    <div className={styles.invalidConcept}>
      {label}: {t('unsupportedResultType', 'Unsupported result type')}
    </div>
  );
};

const LabResultsFormWorkspace: React.FC<Workspace2DefinitionProps<LabResultsFormWorkspaceProps, object, object>> = ({
  workspaceProps: { order },
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const abortController = useAbortController();
  const invalidateLabOrders = useInvalidateLabOrders();
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { completeLabResults, isLoading: isLoadingResults, mutate: mutateResults } = useCompletedLabResultsArray(order);
  const { concepts, isLoading: isLoadingConcepts } = useOrderConceptsByUuids([order.concept.uuid]);
  const concept = concepts[0];
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty },
  } = useForm<FormValues>({ defaultValues: {} });

  useEffect(() => {
    if (!concept) return;

    const fillSavedValues = (currentConcept: LabOrderConcept) => {
      const savedObservation = findObservation(completeLabResults, currentConcept.uuid);
      if (!savedObservation || savedObservation.value === null || savedObservation.value === undefined) return;
      const value = typeof savedObservation.value === 'object' ? savedObservation.value.uuid : savedObservation.value;
      setValue(currentConcept.uuid, isNumeric(currentConcept) && typeof value === 'string' ? Number(value) : value);
      currentConcept.setMembers?.forEach(fillSavedValues);
    };

    fillSavedValues(concept);
  }, [completeLabResults, concept, setValue]);

  const isLoading = isLoadingConcepts || isLoadingResults;
  const title = useMemo(() => t('enterTestResults', 'Enter test results'), [t]);

  const saveResults = async (values: FormValues) => {
    const hasAnyValue = Object.values(values).some((value) => value !== undefined && value !== null && value !== '');
    if (!hasAnyValue || !concept) {
      showSnackbar({
        title: t('noResultsEntered', 'No results entered'),
        kind: 'warning',
        subtitle: t('enterAtLeastOneResult', 'Enter at least one result before saving'),
      });
      return;
    }

    const obs = createLabResultObservation(concept, values, order);
    if (!obs) return;

    setIsSubmitting(true);
    try {
      const orderDiscontinuationPayload = {
        previousOrder: order.uuid,
        type: 'testorder',
        action: 'DISCONTINUE',
        careSetting: order.careSetting?.uuid,
        encounter: order.encounter.uuid,
        patient: order.patient.uuid,
        concept: order.concept.uuid,
        orderer: order.orderer,
      };

      await openmrsFetch(`${restBaseUrl}/encounter/${order.encounter.uuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: { obs: [obs], orders: [orderDiscontinuationPayload] },
      });
      await openmrsFetch(`${restBaseUrl}/order/${order.uuid}/fulfillerdetails/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: { fulfillerStatus: 'ON_HOLD', fulfillerComment: 'Lab results submitted for review' },
      });

      await mutateResults();
      await mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?orderTypes=`), undefined, {
        revalidate: true,
      });
      invalidateLabOrders();
      closeWorkspace({ discardUnsavedChanges: true });
      showSnackbar({
        isLowContrast: true,
        title: t('labResultsSubmittedForReview', 'Lab results submitted for review'),
        kind: 'success',
        subtitle: t('labResultsAwaitingApproval', 'The results are saved and awaiting approval.'),
      });
    } catch (error) {
      await mutateResults();
      showSnackbar({
        title: t('errorSavingLabResults', 'Error saving lab results'),
        kind: 'error',
        subtitle: (error as Error)?.message ?? t('unknownError', 'An unexpected error occurred'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Workspace2 title={title} hasUnsavedChanges={isDirty}>
      {isLoading ? (
        <InlineLoading status="active" description={t('loadingTestDetails', 'Loading test details')} />
      ) : !concept ? (
        <div className={styles.invalidConcept}>{t('noTestData', 'No test data available')}</div>
      ) : (
        <Form className={styles.form} onSubmit={handleSubmit(saveResults)}>
          <div className={styles.fields}>
            <ResultConceptFields concept={concept} control={control} isTablet={isTablet} />
          </div>
          <div className={styles.footer}>
            <Button kind="secondary" type="button" onClick={() => closeWorkspace({ discardUnsavedChanges: true })}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting ? (
                <InlineLoading description={t('saving', 'Saving')} />
              ) : (
                t('saveAndClose', 'Save and close')
              )}
            </Button>
          </div>
        </Form>
      )}
    </Workspace2>
  );
};

export default LabResultsFormWorkspace;
