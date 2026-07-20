import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import useSWR, { mutate } from 'swr';
import { type BillInvoice } from '../types';
import { getHieBaseUrl, postJson } from '../utils/utils';
import { useCallback } from 'react';

export const useBills = (patientUuid: string = '', billStatus: string = 'PENDING') => {
  const url = `${restBaseUrl}/billing/bill?patientUuid=${patientUuid}&v=custom:(uuid,patient:(uuid),lineItems:(uuid,billableService,quantity,price,item,priceUuid,priceName,lineItemOrder,status),status)`;

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: mutated,
  } = useSWR<{ data: { results: Array<BillInvoice> } }>(url, openmrsFetch, {
    errorRetryCount: 2,
  });

  const results = data?.data?.results ?? [];

  return {
    bills: results,
    error,
    isLoading,
    isValidating,
    mutated,
  };
};

export function useInvalidateBills(patientUuid: string) {
  return useCallback(() => {
    mutate(
      (key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/billing/bill?patientUuid=${patientUuid}`),
      undefined,
      { revalidate: true },
    );
  }, [patientUuid]);
}

export const useOrderBill = (orderNumber: string) => {
  const { hieBaseUrl } = useConfig({
    externalModuleName: '@ampath/esm-dha-workflow-app',
  });
  const url = `${hieBaseUrl}/bill-order?order_no=${orderNumber}`;

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: mutated,
  } = useSWR<{ data: { bill_uuid: string; line_item_uuid: string } }>(url, openmrsFetch);

  const results = data?.data;

  return {
    orderBill: results,
    error,
    isLoadingOrderBill: isLoading,
    isValidating,
    mutated,
  };
};

export function useInvalidateOrderBill(orderNumber: string) {
  const { hieBaseUrl } = useConfig({
    externalModuleName: '@ampath/esm-dha-workflow-app',
  });
  return useCallback(() => {
    const url = `${hieBaseUrl}/bill-order?order_no=${orderNumber}`;
    mutate((key) => typeof key === 'string' && key.startsWith(`${url}`), undefined, { revalidate: true });
  }, [orderNumber, hieBaseUrl]);
}

export const useOdooBills = (patientUuid: string, enableOdooBilling: boolean = false) => {
  const url = enableOdooBilling ? `etl/odoo/billing/patient/${patientUuid}` : null;

  const { data, error, isLoading } = useSWR<{
    data: {
      orders: Array<{
        order_lines: Array<{
          billing_status: string;
          openmrs_order_id: string;
        }>;
      }>;
    };
  }>(url, openmrsFetch);

  const results = data?.data;

  return {
    odooBills: results,
    error,
    isLoadingOdooBills: isLoading,
  };
};
