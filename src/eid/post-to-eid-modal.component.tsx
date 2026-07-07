import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  DatePicker,
  DatePickerInput,
  Form,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Stack,
} from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { showSnackbar, useAbortController, type Order } from '@openmrs/esm-framework';
import { useInvalidateLabOrders } from '../laboratory.resource';
import { DEFAULT_EID_LAB_LOCATION, EID_LAB_LOCATIONS, EID_SAMPLE_TYPES } from './eid.constants';
import { parseEidError, postToEid, useEidOrder, useEtlBaseUrl, useHivSummary } from './eid.resource';
import {
  createCD4Payload,
  createDnaPcrPayload,
  createViralLoadPayload,
  derivePregnancyFlags,
  determineEidOrderType,
  isActiveHei,
  resolveEidIdentifiers,
  validateEidSubmission,
} from './eid.utils';
import type { EidPayload } from './eid.types';
import styles from './post-to-eid-modal.scss';

interface PostToEidModalProps {
  order: Order;
  closeModal: () => void;
}

const PostToEidModal: React.FC<PostToEidModalProps> = ({ order, closeModal }) => {
  const { t } = useTranslation();
  const abortController = useAbortController();
  const invalidateLabOrders = useInvalidateLabOrders();
  const { etlBaseUrl } = useEtlBaseUrl();

  const { eidOrder, isLoading: isLoadingOrder, error: orderError } = useEidOrder(order?.uuid);

  const orderType = useMemo(() => determineEidOrderType(eidOrder), [eidOrder]);
  const identifiers = useMemo(() => eidOrder?.patient?.identifiers ?? [], [eidOrder]);
  const person = eidOrder?.patient?.person;

  const { allowedIdentifiers, defaultIdentifier } = useMemo(() => resolveEidIdentifiers(identifiers), [identifiers]);
  const isHEI = useMemo(() => (person ? isActiveHei(identifiers, person.birthdate) : false), [identifiers, person]);
  const { isPregnant, breastfeeding } = useMemo(() => derivePregnancyFlags(eidOrder?.encounter?.obs), [eidOrder]);

  const isViralLoad = orderType === 'VL';
  const {
    hivSummary,
    isLoading: isLoadingHivSummary,
    error: hivSummaryError,
  } = useHivSummary(person?.uuid, isHEI, isViralLoad);

  const [labLocation, setLabLocation] = useState<string>(DEFAULT_EID_LAB_LOCATION);
  const [patientIdentifier, setPatientIdentifier] = useState<string>('');
  const [sampleType, setSampleType] = useState<string>('');
  const [dateReceived, setDateReceived] = useState<Date>(() => new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the identifier from the CCC/HEI resolver once the order loads.
  useEffect(() => {
    if (defaultIdentifier) {
      setPatientIdentifier(defaultIdentifier.identifier);
    }
  }, [defaultIdentifier]);

  const buildPayload = (): EidPayload | null => {
    if (!eidOrder || !orderType || !person) {
      return null;
    }
    const base = {
      order: eidOrder,
      encounterObs: eidOrder.encounter?.obs ?? [],
      locationUuid: eidOrder.encounter?.location?.uuid ?? '',
      patientIdentifier,
      patientName: person.display,
      sex: person.gender,
      birthDate: person.birthdate,
      dateReceived,
    };

    switch (orderType) {
      case 'CD4':
        return createCD4Payload(base);
      case 'DNAPCR':
        return createDnaPcrPayload(base);
      case 'VL':
        return createViralLoadPayload({
          ...base,
          artStartDateInitial: hivSummary?.arv_first_regimen_start_date,
          artStartDateCurrent: hivSummary?.arv_start_date,
          sampleType: Number(sampleType),
          artRegimenUuid: hivSummary?.cur_arv_meds_id,
          isPregnant,
          breastfeeding,
        });
      default:
        return null;
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validationError = validateEidSubmission({
      order: eidOrder,
      orderType,
      labLocation,
      patientIdentifier,
      sampleType: sampleType === '' ? null : Number(sampleType),
      dateReceived,
      hivSummary,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!etlBaseUrl) {
      setError(t('missingEtlBaseUrl', 'ETL base URL is not configured. Please contact your administrator.'));
      return;
    }

    const payload = buildPayload();
    if (!payload) {
      setError(t('unableToBuildPayload', 'Unable to build the EID payload for this order.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await postToEid(etlBaseUrl, labLocation, payload, abortController);
      invalidateLabOrders();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('postToEidSuccessTitle', 'Order posted to EID'),
        subtitle: t('postToEidSuccessMessage', 'Order "{{orderNumber}}" was successfully posted to EID', {
          orderNumber: eidOrder?.orderNumber,
        }),
      });
      closeModal();
    } catch (err) {
      setError(parseEidError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVlSummaryLoading = isViralLoad && isLoadingHivSummary;
  const submitDisabled = isSubmitting || isLoadingOrder || isVlSummaryLoading || !eidOrder || !orderType;

  return (
    <Form onSubmit={handleSubmit}>
      <ModalHeader closeModal={closeModal} title={`${t('postToEid', 'Post to EID')} [${order?.orderNumber ?? ''}]`} />
      <ModalBody>
        {isLoadingOrder ? (
          <InlineLoading description={t('loadingOrderDetails', 'Loading order details') + '...'} />
        ) : orderError || !eidOrder ? (
          <InlineNotification
            lowContrast
            kind="error"
            hideCloseButton
            title={t('errorLoadingOrder', 'Error loading order')}
            subtitle={t('errorLoadingOrderDetails', 'Unable to load the details required to post this order to EID.')}
          />
        ) : !orderType ? (
          <InlineNotification
            lowContrast
            kind="warning"
            hideCloseButton
            title={t('unsupportedOrderType', 'Unsupported order type')}
            subtitle={t('unsupportedOrderTypeMessage', 'This order type cannot be posted to EID.')}
          />
        ) : (
          <Stack gap={5} className={styles.form}>
            <p className={styles.summary}>
              {t('testType', 'Test type')}: <strong>{eidOrder.concept?.display}</strong>
            </p>

            <Select
              id="eid-lab-location"
              labelText={t('labLocation', 'Lab location')}
              value={labLocation}
              onChange={(event) => setLabLocation(event.target.value)}
            >
              {EID_LAB_LOCATIONS.map((location) => (
                <SelectItem key={location.value} value={location.value} text={location.name} />
              ))}
            </Select>

            <Select
              id="eid-patient-identifier"
              labelText={t('patientIdentifier', 'Patient identifier')}
              value={patientIdentifier}
              onChange={(event) => setPatientIdentifier(event.target.value)}
            >
              <SelectItem value="" text={t('selectIdentifier', 'Select an identifier')} />
              {allowedIdentifiers.map((identifier) => (
                <SelectItem
                  key={identifier.uuid}
                  value={identifier.identifier}
                  text={`${identifier.identifierType?.name ?? ''}: ${identifier.identifier}`.trim()}
                />
              ))}
            </Select>

            {isViralLoad && (
              <Select
                id="eid-sample-type"
                labelText={t('sampleType', 'Sample type')}
                value={sampleType}
                onChange={(event) => setSampleType(event.target.value)}
              >
                <SelectItem value="" text={t('selectSampleType', 'Select a sample type')} />
                {EID_SAMPLE_TYPES.map((type) => (
                  <SelectItem key={type.id} value={String(type.id)} text={type.display} />
                ))}
              </Select>
            )}

            <DatePicker
              datePickerType="single"
              dateFormat="Y-m-d"
              value={dateReceived}
              maxDate={new Date()}
              onChange={([date]: Array<Date>) => date && setDateReceived(date)}
            >
              <DatePickerInput
                id="eid-date-received"
                labelText={t('dateReceived', 'Date received')}
                placeholder="YYYY-MM-DD"
                // Carbon's exported type for `pattern` is a stale PropTypes validator signature;
                // the runtime prop is a plain regex string (see DatePickerInput's default value).
                pattern={'\\d{4}-\\d{2}-\\d{2}' as unknown as never}
              />
            </DatePicker>

            {isVlSummaryLoading && (
              <InlineLoading description={t('loadingHivSummary', 'Loading HIV summary') + '...'} />
            )}

            {isViralLoad && !isLoadingHivSummary && (hivSummaryError || !hivSummary) && (
              <InlineNotification
                lowContrast
                kind="warning"
                hideCloseButton
                title={t('hivSummaryUnavailable', 'HIV summary unavailable')}
                subtitle={t(
                  'hivSummaryUnavailableMessage',
                  'The HIV summary required for viral load orders could not be loaded.',
                )}
              />
            )}

            {error && (
              <InlineNotification
                lowContrast
                kind="error"
                title={t('error', 'Error')}
                subtitle={error}
                onClose={() => setError(null)}
              />
            )}
          </Stack>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} type="button">
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="primary" type="submit" disabled={submitDisabled}>
          {isSubmitting ? (
            <InlineLoading description={t('posting', 'Posting') + '...'} />
          ) : (
            t('postToEid', 'Post to EID')
          )}
        </Button>
      </ModalFooter>
    </Form>
  );
};

export default PostToEidModal;
