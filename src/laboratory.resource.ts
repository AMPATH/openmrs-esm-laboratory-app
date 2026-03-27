import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import useSWR, { mutate } from 'swr';
import {
  openmrsFetch,
  type Order,
  restBaseUrl,
  useAppContext,
  useConfig,
  useSession,
  type FetchResponse,
  showSnackbar,
} from '@openmrs/esm-framework';
import type {
  DateFilterContext,
  Encounter,
  FulfillerStatus,
  LabOrderConcept,
  Observation,
  ObservationStatus,
  ObservationValue,
} from './types';
import { type Config } from './config-schema';

const useLabOrdersDefaultParams: UseLabOrdersParams = {
  status: null,
  newOrdersOnly: false,
  excludeCanceled: true,
  includePatientId: false,
};

interface UseLabOrdersParams {
  status: FulfillerStatus;
  newOrdersOnly: boolean;
  excludeCanceled: boolean;
  includePatientId: boolean;
}

/**
 * Custom hook for retrieving laboratory orders.
 *
 * @param status - The fulfiller status to filter by (e.g. 'IN_PROGRESS', 'COMPLETED')
 * @param newOrdersOnly - Whether to return only new orders that haven't been picked (action=NEW, fulfillerStatus=null). Filtered client-side as the REST API doesn't support this query natively.
 * @param excludeCanceled - Whether to exclude canceled, discontinued and expired orders
 * @param includePatientId - Whether to include patient identifiers in the response
 */
export function useLabOrders(params: Partial<UseLabOrdersParams> = useLabOrdersDefaultParams) {
  const definedParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  const { status, newOrdersOnly, excludeCanceled, includePatientId } = {
    ...useLabOrdersDefaultParams,
    ...definedParams,
  };
  const { dateRange } = useAppContext<DateFilterContext>('laboratory-date-filter') ?? {
    dateRange: [dayjs().startOf('day').toDate(), new Date()],
  };
  const { sessionLocation } = useSession();

  const { laboratoryOrderTypeUuid, filterByCurrentLocation } = useConfig<Config>();
  const customRepresentation = `custom:(uuid,orderNumber,patient:(uuid,display,person:(uuid,display,age,birthdate,gender)${
    includePatientId ? ',identifiers' : ''
  }),concept:(uuid,display),action,careSetting:(uuid,display,description,careSettingType,display),previousOrder,dateActivated,scheduledDate,dateStopped,autoExpireDate,encounter:(uuid,display,location:(uuid)),orderer:(uuid,display),orderReason,orderReasonNonCoded,orderType:(uuid,display,name,description,conceptClasses,parent),urgency,instructions,commentToFulfiller,display,fulfillerStatus,fulfillerComment,accessionNumber,specimenSource,laterality,clinicalHistory,frequency,numberOfRepeats)`;
  let url = `${restBaseUrl}/order?orderTypes=${laboratoryOrderTypeUuid}&v=${customRepresentation}`;
  url = status ? url + `&fulfillerStatus=${status}` : url;
  url = excludeCanceled ? `${url}&excludeCanceledAndExpired=true&excludeDiscontinueOrders=true` : url;
  url = dateRange
    ? `${url}&activatedOnOrAfterDate=${dateRange.at(0).toISOString()}&activatedOnOrBeforeDate=${dateRange
        .at(1)
        .toISOString()}`
    : url;

  const { data, error, mutate, isLoading, isValidating } = useSWR<{
    data: { results: Array<Order> };
  }>(`${url}`, openmrsFetch);

  let filteredOrders = data?.data?.results?.filter(
    (order) => !newOrdersOnly || (order?.action === 'NEW' && order?.fulfillerStatus === null),
  );

  if (filterByCurrentLocation) {
    filteredOrders = filteredOrders?.filter((order) => order.encounter?.location?.uuid === sessionLocation?.uuid);
  }

  return {
    labOrders: filteredOrders ?? [],
    isLoading,
    isError: error,
    mutate,
    isValidating,
  };
}

export function setFulfillerStatus(orderId: string, status: FulfillerStatus, abortController: AbortController) {
  return openmrsFetch(`${restBaseUrl}/order/${orderId}/fulfillerdetails/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: { fulfillerStatus: status },
  });
}

export function rejectLabOrder(orderId: string, comment: string, abortController: AbortController) {
  return openmrsFetch(`${restBaseUrl}/order/${orderId}/fulfillerdetails/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      fulfillerStatus: 'DECLINED',
      fulfillerComment: comment,
    },
  });
}

/**
 * Custom hook that returns a function to invalidate and refetch all lab orders.
 * Use this after mutations to ensure the UI reflects the latest data.
 */
export function useInvalidateLabOrders() {
  const { laboratoryOrderTypeUuid } = useConfig<Config>();

  return useCallback(() => {
    mutate(
      (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?orderTypes=${laboratoryOrderTypeUuid}`),
      undefined,
      { revalidate: true },
    );
  }, [laboratoryOrderTypeUuid]);
}

const labEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType:(uuid,display),location:(uuid,name),patient:(uuid,display,person:(uuid,display,gender,age)),encounterProviders:(uuid,provider:(uuid,name)),obs:(uuid,obsDatetime,voided,groupMembers:(uuid,concept:(uuid,name:(uuid,name)),value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name)),interpretation),formFieldNamespace,formFieldPath,order:(uuid,display),concept:(uuid,name:(uuid,name)),value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name)),interpretation))';
const labConceptRepresentation =
  'custom:(uuid,display,name,datatype,set,answers,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,' +
  'setMembers:(uuid,display,answers,datatype,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,set,setMembers:(uuid)))';
const conceptObsRepresentation = 'custom:(uuid,display,concept:(uuid,display),groupMembers,value)';

export function useLabEncounter(encounterUuid: string) {
  const apiUrl = `${restBaseUrl}/encounter/${encounterUuid}?v=${labEncounterRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<Encounter>, Error>(
    apiUrl,
    openmrsFetch,
  );

  return {
    encounter: data?.data,
    isLoading,
    error: error,
    isValidating,
    mutate,
  };
}

export function useObservation(obsUuid: string) {
  const url = `${restBaseUrl}/obs/${obsUuid}?v=${conceptObsRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: Observation }, Error>(
    obsUuid ? url : null,
    openmrsFetch,
  );
  return {
    data: data?.data,
    isLoading,
    error,
    isValidating,
    mutate,
  };
}

export function useObservations(obsUuids: Array<string>) {
  const fetchMultipleObservations = async (): Promise<Array<Observation>> => {
    const results = await Promise.all(
      obsUuids.map(async (uuid) => {
        const url = `${restBaseUrl}/obs/${uuid}?v=${conceptObsRepresentation}`;
        const res = await openmrsFetch(url);
        return res.data;
      }),
    );

    return results;
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR<Observation[], Error>(
    obsUuids && obsUuids.length > 0 ? ['observations', ...obsUuids] : null,
    fetchMultipleObservations,
  );

  return {
    data: data ?? [],
    isLoading,
    error,
    isValidating,
    mutate,
  };
}

export function useCompletedLabResults(order: Order) {
  const {
    encounter,
    isLoading: isLoadingEncounter,
    mutate: mutateLabOrders,
    error: encounterError,
  } = useLabEncounter(order.encounter.uuid);
  const {
    data: observation,
    isLoading: isLoadingObs,
    error: isErrorObs,
    mutate: mutateObs,
  } = useObservation(encounter?.obs.find((obs) => obs?.concept?.uuid === order?.concept?.uuid)?.uuid ?? '');

  return {
    isLoading: isLoadingEncounter || isLoadingObs,
    completeLabResult: observation,
    mutate: () => {
      mutateLabOrders();
      mutateObs();
    },
    error: isErrorObs ?? encounterError,
  };
}

export function useCompletedLabResultsArray(order: Order) {
  const {
    encounter,
    isLoading: isLoadingEncounter,
    mutate: mutateLabOrders,
    error: encounterError,
  } = useLabEncounter(order.encounter.uuid);

  const obsUuids = encounter?.obs.filter((o) => o?.order.uuid === order?.uuid).map((o) => o.uuid);

  const { data: observations, isLoading: isLoadingObs, error: errorObs, mutate: mutateObs } = useObservations(obsUuids);

  return {
    isLoading: isLoadingEncounter || isLoadingObs,
    completeLabResults: observations,
    mutate: () => {
      mutateLabOrders();
      mutateObs();
    },
    error: errorObs ?? encounterError,
  };
}

function getUrlForConcept(conceptUuid: string) {
  return `${restBaseUrl}/concept/${conceptUuid}?v=${labConceptRepresentation}`;
}

async function fetchAllSetMembers(conceptUuid: string): Promise<LabOrderConcept> {
  const conceptResponse = await openmrsFetch<LabOrderConcept>(getUrlForConcept(conceptUuid));
  const concept = conceptResponse.data;
  const secondLevelSetMembers = concept.set
    ? concept.setMembers
        .map((member) => (member.set ? member.setMembers.map((lowerMember) => lowerMember.uuid) : []))
        .flat()
    : [];
  if (secondLevelSetMembers.length > 0) {
    const concepts = await Promise.all(secondLevelSetMembers.map((uuid) => fetchAllSetMembers(uuid)));
    const uuidMap = concepts.reduce((acc, c) => {
      acc[c.uuid] = c;
      return acc;
    }, {} as Record<string, LabOrderConcept>);
    concept.setMembers = concept.setMembers.map((member) => {
      if (member.set) {
        member.setMembers = member.setMembers.map((lowerMember) => uuidMap[lowerMember.uuid]);
      }
      return member;
    });
  }

  return concept;
}

export function useOrderConceptsByUuids(uuids: Array<string>) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Array<LabOrderConcept>, Error>(
    uuids.length ? ['concepts', ...uuids] : null,
    () => Promise.all(uuids.map((uuid) => fetchAllSetMembers(uuid))),
  );

  const results = useMemo(
    () => ({
      concepts: data ?? [],
      isLoading,
      error,
      isValidating,
      mutate,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return results;
}

export function updateObservation(observationUuid: string, payload: Record<string, any>) {
  return openmrsFetch(`${restBaseUrl}/obs/${observationUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export const isCoded = (concept: LabOrderConcept) => concept.datatype?.display === 'Coded';
export const isNumeric = (concept: LabOrderConcept) => concept.datatype?.display === 'Numeric';
export const isPanel = (concept: LabOrderConcept) => concept.setMembers?.length > 0;
export const isText = (concept: LabOrderConcept) => concept.datatype?.display === 'Text';

export function useMappedLabConcepts(order: Order) {
  const [orderConceptUuids, setOrderConceptUuids] = useState([]);
  const {
    isLoading: isLoadingLabResultsArray,
    completeLabResults,
    mutate: mutateResults,
  } = useCompletedLabResultsArray(order);
  const { isLoading: isLoadingResultConcepts, concepts: conceptArray } = useOrderConceptsByUuids(orderConceptUuids);
  const [object, setObject] = useState({});

  useEffect(() => {
    if (Array.isArray(completeLabResults) && completeLabResults.length > 1) {
      const conceptUuids = completeLabResults.map((r) => r.concept.uuid);
      setOrderConceptUuids(conceptUuids);
    }

    const mapLabConcepts = () => {
      if (Array.isArray(conceptArray) && conceptArray.length > 1) {
        conceptArray.forEach((concept, index) => {
          const completeLabResult = completeLabResults.find((r) => r.concept.uuid === concept.uuid);
          if (concept && completeLabResult) {
            if (isCoded(concept) && typeof completeLabResult?.value === 'object' && completeLabResult?.value?.uuid) {
              const v = completeLabResult.value.uuid;
              setObject((obj) => ({ ...obj, [concept.uuid]: v }));
              // object[concept.uuid] = completeLabResult.value.uuid;
              // setValue(concept.uuid, completeLabResult.value.uuid);
            } else if (isNumeric(concept) && completeLabResult?.value) {
              const v = parseFloat(completeLabResult.value as string);
              setObject((obj) => ({ ...obj, [concept.uuid]: v }));
              // object[concept.uuid] = parseFloat(completeLabResult.value as string);
              // setValue(concept.uuid, parseFloat(completeLabResult.value as string));
            } else if (isText(concept) && completeLabResult?.value) {
              const v = completeLabResult?.value;
              setObject((obj) => ({ ...obj, [concept.uuid]: v }));
              // object[concept.uuid] = completeLabResult?.value;
              // setValue(concept.uuid, completeLabResult?.value);
            } else if (isPanel(concept)) {
              concept.setMembers.forEach((member) => {
                const obs = completeLabResult.groupMembers.find((v) => v.concept.uuid === member.uuid);
                let value: ObservationValue;
                if (isCoded(member)) {
                  value = typeof obs?.value === 'object' ? obs.value.uuid : obs?.value;
                } else if (isNumeric(member)) {
                  value = obs?.value ? parseFloat(obs.value as string) : undefined;
                } else if (isText(member)) {
                  value = obs?.value;
                }
                if (value) {
                  const v = value;
                  setObject((obj) => ({ ...obj, [member.uuid]: v }));
                  // object[member.uuid] = value; //setValue(member.uuid, value);
                }
              });
            }
          }
        });
      }
    };

    mapLabConcepts();

    // if (conceptArray) {
    //   mapLabConcepts();
    // }
  }, [completeLabResults, conceptArray]);

  return {
    values: object,
    completeLabResults,
    isLoading: isLoadingLabResultsArray || isLoadingResultConcepts,
    mutateResults,
  };
}

export async function updateObservationAndOrder(
  order: Order,
  observationStatus: ObservationStatus,
  fulfillerStatus: FulfillerStatus,
  abortController: AbortController,
  values,
  completeLabResults: Array<any>,
) {
  // const { completeLabResults, values, mutateResults } = useMappedLabConcepts(order);

  const updateTasks = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([conceptUuid, value]) => {
      let obs = completeLabResults.find((r) => r.concept.uuid === conceptUuid);
      if (!obs) {
        for (const result of completeLabResults) {
          obs = result.groupMembers?.find((m) => m.concept.uuid === conceptUuid);
          if (obs) break;
        }
      }
      const status = observationStatus;
      return updateObservation(obs?.uuid, { value, status });
    });
  const updateResults = await Promise.allSettled(updateTasks);
  const failedObsconceptUuids = updateResults.reduce((prev, curr, index) => {
    if (curr.status === 'rejected') {
      return [...prev, Object.keys(values).at(index)];
    }
    return prev;
  }, []);

  await setFulfillerStatus(order.uuid, fulfillerStatus, abortController);

  // mutateResults();

  const showNotification = (kind: 'error' | 'success', message: string) => {
    showSnackbar({
      title: kind === 'success' ? 'Save lab results' : 'Error saving lab results',
      kind: kind,
      subtitle: message,
    });
  };

  if (failedObsconceptUuids.length) {
    showNotification('error', 'Could not save obs with concept uuids ' + failedObsconceptUuids.join(', '));
  } else {
    showNotification('success', 'Lab results have been successfully updated');
  }
}
