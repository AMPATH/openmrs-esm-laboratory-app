import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import useSWR, { mutate, useSWRConfig } from 'swr';
import {
  openmrsFetch,
  type Order,
  restBaseUrl,
  useAppContext,
  useConfig,
  useSession,
  type FetchResponse,
} from '@openmrs/esm-framework';
import type {
  DateFilterContext,
  Encounter,
  FulfillerStatus,
  LabOrderConcept,
  Observation,
  ObservationStatus,
  ObservationValue,
  QueueEntryResult,
} from './types';
import { type Config } from './config-schema';
import { getEtlBaseUrl } from './utils/utils';
import { getResultObservationUuids } from './lab-results/observation-status.utils';

const useLabOrdersDefaultParams: UseLabOrdersParams = {
  status: null,
  unpickedOrdersOnly: false,
  excludeCanceled: true,
  includePatientId: false,
};

interface UseLabOrdersParams {
  status: FulfillerStatus;
  unpickedOrdersOnly: boolean;
  excludeCanceled: boolean;
  includePatientId: boolean;
}

function isOrderAwaitingPickup({ action, fulfillerStatus }: Order) {
  const isNewOrRevised = action === 'NEW' || action === 'REVISE';
  const hasNotBeenPickedUp = fulfillerStatus === null;

  return isNewOrRevised && hasNotBeenPickedUp;
}

/**
 * Custom hook for retrieving laboratory orders.
 *
 * @param status - The fulfiller status to filter by (e.g. 'IN_PROGRESS', 'COMPLETED')
 * @param unpickedOrdersOnly - Whether to return only unpicked new or revised orders. Filtered client-side.
 * @param excludeCanceled - Whether to exclude canceled, discontinued and expired orders
 * @param includePatientId - Whether to include patient identifiers in the response
 */
export function useLabOrders(params: Partial<UseLabOrdersParams> = useLabOrdersDefaultParams) {
  const definedParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  const { status, unpickedOrdersOnly, excludeCanceled, includePatientId } = {
    ...useLabOrdersDefaultParams,
    ...definedParams,
  };
  const fallbackDateRange = useMemo<[Date, Date]>(() => [dayjs().startOf('day').toDate(), new Date()], []);
  const { dateRange } = useAppContext<DateFilterContext>('laboratory-date-filter') ?? {
    dateRange: fallbackDateRange,
  };
  const { sessionLocation } = useSession();

  const { laboratoryOrderTypeUuid, filterByCurrentLocation } = useConfig<Config>();
  const customRepresentation = `custom:(uuid,orderNumber,patient:(uuid,display,person:(uuid,display,age,birthdate,gender,attributes)${
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

  const { data, error, mutate, isLoading, isValidating } = useSWR<Array<Order>>(`${url}`, fetchAllOrders);

  let filteredOrders = data?.filter((order) => !unpickedOrdersOnly || isOrderAwaitingPickup(order));

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

interface PaginatedOrdersResponse {
  results: Array<Order>;
  links?: Array<{ rel: string; uri: string }>;
}

/**
 * Fetches every page of a paginated order query by following the `next` links returned by the server,
 * so that client-side filtering and pagination operate on the complete set of orders.
 *
 * Keeps a regular useSWR key so the existing filter-based invalidators refresh
 * the complete query. Using useOpenmrsFetchAll would also require updating both
 * invalidation sites to refresh every loaded page across the affected queries.
 */
export async function fetchAllOrders(url: string): Promise<Array<Order>> {
  const orders: Array<Order> = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await openmrsFetch<PaginatedOrdersResponse>(nextUrl);
    orders.push(...(response.data?.results ?? []));
    nextUrl = getNextPageUrl(response.data?.links);
  }

  return orders;
}

function getNextPageUrl(links: PaginatedOrdersResponse['links']): string | null {
  const uri = links?.find((link) => link.rel === 'next')?.uri;
  if (!uri) {
    return null;
  }

  // The server returns an absolute URL; use the current origin so frontend proxies keep working
  const nextUrl = new URL(uri);
  nextUrl.host = window.location.host;
  nextUrl.protocol = window.location.protocol;
  return nextUrl.toString();
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

export type RetestOrder = Partial<Order> & {
  uuid: string;
  encounter?: { uuid?: string; visit?: { uuid: string } };
};

const retestOrderRepresentation =
  'custom:(uuid,orderNumber,patient:(uuid),concept:(uuid),action,careSetting:(uuid),previousOrder,dateActivated,encounter:(uuid,visit:(uuid)),orderer:(uuid),urgency,commentToFulfiller,fulfillerStatus)';

export const usePatientOrders = (order: Order) => {
  const { hivAutoRetestConceptUuids } = useConfig<Config>();
  const conceptUuids = hivAutoRetestConceptUuids?.join(',');
  const encounterUuid = order?.encounter?.uuid;
  const patientUuid = order?.patient?.uuid;
  const { data: encounters, isLoading: isLoadingEncounters } = useSWR<{
    data: {
      uuid: string;
      visit?: { uuid: string };
    };
  }>(encounterUuid ? `${restBaseUrl}/encounter/${encounterUuid}?v=custom:(uuid,visit:(uuid))` : null, openmrsFetch);

  const visitUuid = encounters?.data?.visit?.uuid;
  const { data: orders, isLoading: isLoadingOrders } = useSWR<{
    data: {
      results: Array<RetestOrder>;
    };
  }>(
    patientUuid && visitUuid && conceptUuids
      ? `${restBaseUrl}/order?patient=${patientUuid}&concept=${conceptUuids}&v=${retestOrderRepresentation}`
      : null,
    openmrsFetch,
  );

  const filteredOrders = orders?.data?.results?.filter((patientOrder) => {
    const patientOrderEncounter = patientOrder.encounter as RetestOrder['encounter'];
    return patientOrderEncounter?.visit?.uuid === visitUuid;
  });

  return {
    patientOrders: filteredOrders,
    isLoading: isLoadingEncounters || Boolean(visitUuid && isLoadingOrders),
  };
};

export async function createOrResumeHivRetest(
  originalOrder: Order,
  visitOrders: Array<RetestOrder>,
  laboratoryOrderTypeUuid: string,
  abortController: AbortController,
): Promise<void> {
  const marker = `[AUTO-HIV-RETEST originalOrder=${originalOrder.uuid}]`;
  const existingRetest = visitOrders.find((candidate) => candidate.commentToFulfiller?.includes(marker));
  let retest = existingRetest;

  if (!retest) {
    const encounter = originalOrder.encounter as { uuid: string } | undefined;
    if (
      !encounter?.uuid ||
      !originalOrder.patient?.uuid ||
      !originalOrder.concept?.uuid ||
      !originalOrder.careSetting?.uuid
    ) {
      throw new Error('The original order is missing details required to create a retest.');
    }

    const response = await openmrsFetch<RetestOrder>(`${restBaseUrl}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.signal,
      body: {
        orderType: laboratoryOrderTypeUuid,
        type: 'testorder',
        action: 'NEW',
        urgency: originalOrder.urgency ?? 'ROUTINE',
        careSetting: originalOrder.careSetting.uuid,
        encounter: encounter.uuid,
        patient: originalOrder.patient.uuid,
        concept: originalOrder.concept.uuid,
        orderer: originalOrder.orderer?.uuid,
        commentToFulfiller: marker,
        instructions: marker,
        fulfillerStatus: 'IN_PROGRESS',
      },
    });
    retest = response.data;
  }

  if (!retest.uuid) {
    throw new Error('The retest order was created but its identifier was not returned.');
  }
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
  const { mutate } = useSWRConfig();

  return useCallback(() => {
    mutate(
      (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/order?orderTypes=${laboratoryOrderTypeUuid}`),
      undefined,
      { revalidate: true },
    );
  }, [laboratoryOrderTypeUuid, mutate]);
}

export function useQueueEntries(patientUuid: string = '') {
  const [etlBaseUrl, setEtlBaseUrl] = useState('');
  const { sessionLocation } = useSession();
  const { serviceUuid } = useConfig<Config>();

  useEffect(() => {
    const fetchEtlBaseUrl = async () => {
      const baseUrl = await getEtlBaseUrl();
      setEtlBaseUrl(baseUrl);
    };
    fetchEtlBaseUrl();
  }, []);

  const url = `${etlBaseUrl}/queue-entry?locationUuid=${sessionLocation?.uuid}&serviceUuid=${serviceUuid}`;
  const { data, error, mutate, isLoading, isValidating } = useSWR<{
    data: { data: Array<QueueEntryResult> };
  }>(etlBaseUrl ? `${url}` : null, openmrsFetch);

  let filteredQueueEntries = data?.data?.data;

  if (patientUuid) {
    filteredQueueEntries = filteredQueueEntries?.filter((queueEntry) => queueEntry.patient_uuid === patientUuid);
  }

  return {
    queueEntries: filteredQueueEntries ?? [],
    isLoading,
    isError: error,
    mutate,
    isValidating,
  };
}

const labEncounterRepresentation =
  'custom:(uuid,encounterDatetime,encounterType:(uuid,display),location:(uuid,name),patient:(uuid,display,person:(uuid,display,gender,age)),encounterProviders:(uuid,provider:(uuid,name)),obs:(uuid,obsDatetime,voided,groupMembers:(uuid,concept:(uuid,name:(uuid,name)),value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name)),interpretation),formFieldNamespace,formFieldPath,order:(uuid,display),concept:(uuid,name:(uuid,name)),value:(uuid,display,name:(uuid,name),names:(uuid,conceptNameType,name)),interpretation))';
const labConceptRepresentation =
  'custom:(uuid,display,name,datatype,set,answers,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,' +
  'setMembers:(uuid,display,answers,datatype,hiNormal,hiAbsolute,hiCritical,lowNormal,lowAbsolute,lowCritical,units,allowDecimal,set,setMembers:(uuid)))';
const conceptObsRepresentation =
  'custom:(uuid,display,concept:(uuid,display),groupMembers:(uuid,display,concept:(uuid,display),value,groupMembers:(uuid,display,concept:(uuid,display),value,groupMembers:(uuid,display,concept:(uuid,display),value))),value)';

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

export function useOrderConceptByUuid(uuid: string) {
  const apiUrl = `${restBaseUrl}/concept/${uuid}?v=${labConceptRepresentation}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<LabOrderConcept, Error>(uuid, fetchAllSetMembers);
  /**
   * We are fetching 2 levels of set members at one go.
   */

  const results = useMemo(
    () => ({
      concept: data,
      isLoading,
      error,
      isValidating,
      mutate,
    }),
    [data, error, isLoading, isValidating, mutate],
  );

  return results;
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
  completeLabResults: Array<any>,
) {
  if (completeLabResults.length === 0) {
    throw new Error('No saved lab observations were found to approve');
  }

  const observationUuids = getResultObservationUuids(completeLabResults);
  if (observationUuids.length === 0) {
    throw new Error('No result-bearing observations were found to approve');
  }

  const updateTasks = observationUuids.map((observationUuid) =>
    updateObservation(observationUuid, { status: observationStatus }),
  );
  const updateResults = await Promise.allSettled(updateTasks);
  const failedUpdates = updateResults.flatMap((result, index) =>
    result.status === 'rejected' ? [`${observationUuids[index]}: ${getErrorMessage(result.reason)}`] : [],
  );

  if (failedUpdates.length > 0) {
    throw new Error(`Could not finalize result observation(s): ${failedUpdates.join('; ')}`);
  }

  await setFulfillerStatus(order.uuid, fulfillerStatus, abortController);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}
