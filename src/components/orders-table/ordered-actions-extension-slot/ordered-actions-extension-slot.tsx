import { ExtensionSlot, useConfig } from '@openmrs/esm-framework';
import { type BillInvoice, type BillStatus, type Order } from '../../../types';
import React, { useMemo } from 'react';
import { useInvalidateBills, useInvalidateOrderBill, useOdooBills, useOrderBill } from '../../../bill/bill.resource';
import { type Config } from '../../../config-schema';
import { InlineLoading } from '@carbon/react';
import styles from './ordered-actions-extension-slot.scss';
import { type PreauthRequest } from '../../../bill/bill.types';

interface OrderedActionsExtensionSlotProps {
  order: Order;
  bills: BillInvoice[];
  isLoading: boolean;
  preauthRequests: PreauthRequest[];
  isLoadingPreauthRequests: boolean;
}

const OrderedActionsExtensionSlot: React.FC<OrderedActionsExtensionSlotProps> = ({
  order,
  bills,
  isLoading,
  preauthRequests,
  isLoadingPreauthRequests,
}) => {
  const invalidateBills = useInvalidateBills(order?.patient?.uuid);
  const invalidateOrderBill = useInvalidateOrderBill(order?.orderNumber);
  const { enableOdooBilling, blockedPaymentModes } = useConfig<Config>();
  const { orderBill, isLoadingOrderBill } = useOrderBill(order?.orderNumber);
  const { odooBills, isLoadingOdooBills } = useOdooBills(order?.patient?.uuid, enableOdooBilling);

  const mutated = () => {
    invalidateBills();
    invalidateOrderBill();
  };

  const status = useMemo<BillStatus>(() => {
    if (!enableOdooBilling) {
      if (isLoading || isLoadingOrderBill || isLoadingPreauthRequests || !orderBill || !bills) {
        return 'BLANK';
      }
      const bill = bills.find((b) => b.uuid === orderBill.bill_uuid);
      const lineItem = bill?.lineItems?.find((i) => i.uuid === orderBill.line_item_uuid);
      if (!lineItem) {
        return 'BLANK';
      }
      if (blockedPaymentModes.includes(lineItem.priceName.toUpperCase())) {
        return lineItem.status as BillStatus;
      }
      if (!orderBill.consent_token) {
        return 'AWAITING CLAIM VISIT';
      }
      if (!orderBill.requires_preauth) {
        return 'PAID';
      }
      const intervention = preauthRequests?.find((r) => r.interventionCode === orderBill.intervention_code);
      if (!intervention) {
        return 'NEEDS PREAUTHORIZATION';
      }
      switch (intervention.status?.trim()?.toUpperCase()) {
        case 'ACTIVE':
          return 'PENDING PREAUTHORIZATION';
        case 'FINALISED':
          return 'PAID';
        case 'REJECTED':
          return 'PREAUTHORIZATION REJECTED';
        default:
          return 'NEEDS PREAUTHORIZATION';
      }
    }
    const currentOrder = odooBills?.orders?.[0]?.order_lines?.find((o) => o.openmrs_order_id === order?.uuid);
    if (!currentOrder) {
      return 'BLANK';
    }
    return currentOrder.billing_status.toUpperCase() === 'PAID' ? 'PAID' : 'PENDING';
  }, [
    order,
    isLoading,
    bills,
    odooBills,
    orderBill,
    isLoadingOrderBill,
    blockedPaymentModes,
    enableOdooBilling,
    preauthRequests,
    isLoadingPreauthRequests,
  ]);

  if (isLoadingOdooBills || isLoading || isLoadingOrderBill || isLoadingPreauthRequests) {
    return <InlineLoading />;
  }

  return (
    <ExtensionSlot
      className={styles.actionsSlot}
      state={{ order: order, billStatus: status, isLoading, mutated }}
      name="tests-ordered-actions-slot"
    />
  );
};

export default OrderedActionsExtensionSlot;
