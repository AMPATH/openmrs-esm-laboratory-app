import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, type FetchResponse } from '@openmrs/esm-framework';
import { getEtlBaseUrl } from '../utils/utils';
import { DEFAULT_ETL_BASE_URL } from './eid.constants';
import type { EidOrder, EidPayload, HivSummary } from './eid.types';

const eidOrderRepresentation =
  'custom:(uuid,orderNumber,dateActivated,concept:(uuid,display),orderer:(uuid,display,identifier),' +
  'encounter:(uuid,location:(uuid),obs:(uuid,concept:(uuid,display),value:(uuid,display),' +
  'groupMembers:(uuid,concept:(uuid,display),value:(uuid,display),' +
  'groupMembers:(uuid,concept:(uuid,display),value:(uuid,display))))),' +
  'patient:(uuid,display,identifiers:(uuid,identifier,preferred,identifierType:(uuid,name),display),' +
  'person:(uuid,display,gender,birthdate)))';

/**
 * Fetches an order with the fields required by the EID payload builders
 * (orderer identifier, patient identifiers, encounter obs tree, etc.).
 */
export function useEidOrder(orderUuid: string | null | undefined) {
  const url = orderUuid ? `${restBaseUrl}/order/${orderUuid}?v=${eidOrderRepresentation}` : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FetchResponse<EidOrder>>(url, openmrsFetch);

  return {
    eidOrder: data?.data ?? null,
    isLoading,
    error,
    isValidating,
    mutate,
  };
}

/**
 * Resolves the ETL base URL from the DHA workflow module's configuration.
 * Uses the async `getConfig`-based accessor (like `useQueueEntries`) rather
 * than `useConfig({ externalModuleName })`, which does not reliably return
 * provided values for a module that isn't loaded on this page.
 */
export function useEtlBaseUrl() {
  const [etlBaseUrl, setEtlBaseUrl] = useState<string | null>(null);
  const [isLoadingEtlBaseUrl, setIsLoadingEtlBaseUrl] = useState(true);

  useEffect(() => {
    let active = true;
    getEtlBaseUrl()
      .then((base) => {
        if (active) {
          // `openmrsFetch` prepends `/openmrs`, so a `/etl` base resolves to
          // `/openmrs/etl/...`. Fall back to the default when unconfigured.
          setEtlBaseUrl(base || DEFAULT_ETL_BASE_URL);
        }
      })
      .catch(() => {
        if (active) {
          setEtlBaseUrl(DEFAULT_ETL_BASE_URL);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingEtlBaseUrl(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { etlBaseUrl, isLoadingEtlBaseUrl };
}

/**
 * Fetches the patient's latest HIV Summary from the ETL backend. Required for
 * Viral Load orders (ART start dates and current regimen). Only fires when
 * `enabled` is true and a patient uuid / ETL base URL are available.
 */
export function useHivSummary(patientUuid: string | null | undefined, isHEIActive: boolean, enabled = true) {
  const { etlBaseUrl, isLoadingEtlBaseUrl } = useEtlBaseUrl();

  const url =
    enabled && patientUuid && etlBaseUrl
      ? `${etlBaseUrl}/patient/${patientUuid}/hiv-summary?startIndex=0&limit=20&includeNonClinicalEncounter=false&isHEIActive=${isHEIActive}`
      : null;

  const { data, error, isLoading, isValidating } = useSWR<FetchResponse<{ result: Array<HivSummary> }>>(
    url,
    openmrsFetch,
  );

  const hivSummary = useMemo(() => data?.data?.result?.[0] ?? null, [data]);

  return {
    hivSummary,
    // Keep the caller in a loading state until the base URL resolves and the
    // request settles, so the "unavailable" warning does not flash prematurely.
    isLoading: enabled ? isLoadingEtlBaseUrl || isLoading : false,
    error,
    isValidating,
  };
}

/**
 * Posts a payload to the EID system. The lab `location` is a URL path segment
 * (confirmed against the legacy `LabOrderResourceService`, which builds
 * `{etlBaseUrl}/eid/order/{location}`), not a query param or payload field.
 */
export function postToEid(
  etlBaseUrl: string,
  location: string,
  payload: EidPayload,
  abortController?: AbortController,
) {
  return openmrsFetch(`${etlBaseUrl}/eid/order/${location}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: abortController?.signal,
    body: payload,
  });
}

/** Extracts a human-readable message from an openmrsFetch error. */
export function parseEidError(error: unknown): string {
  const err = error as {
    responseBody?: { error?: { message?: string }; message?: string };
    message?: string;
  };
  return (
    err?.responseBody?.error?.message ??
    err?.responseBody?.message ??
    err?.message ??
    'An unexpected error occurred while posting the order to EID.'
  );
}
