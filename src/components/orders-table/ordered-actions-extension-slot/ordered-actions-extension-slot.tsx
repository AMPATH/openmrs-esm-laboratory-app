import { ExtensionSlot, useConfig } from '@openmrs/esm-framework';
import { type BillInvoice, type BillStatus, type Order } from '../../../types';
import React, { useEffect, useState } from 'react';
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
  const [status, setStatus] = useState<BillStatus>('BLANK');
  const invalidateBills = useInvalidateBills(order?.patient?.uuid);
  const invalidateOrderBill = useInvalidateOrderBill(order?.orderNumber);
  const { enableOdooBilling, blockedPaymentModes } = useConfig<Config>();
  const { orderBill, isLoadingOrderBill } = useOrderBill(order?.orderNumber);
  const { odooBills, isLoadingOdooBills } = useOdooBills(order?.patient?.uuid, enableOdooBilling);

  const mutated = () => {
    invalidateBills();
    invalidateOrderBill();
  };

  useEffect(() => {
    if (!enableOdooBilling) {
      if (!isLoading && !isLoadingOrderBill && !isLoadingPreauthRequests && orderBill && bills) {
        const billUuid = orderBill?.bill_uuid;
        const lineItemUuid = orderBill?.line_item_uuid;
        const bill = bills.find((b) => b.uuid === billUuid);
        const lineItem = bill?.lineItems?.find((i) => i.uuid === lineItemUuid);
        if (lineItem) {
          if (!blockedPaymentModes.includes(lineItem.priceName.toUpperCase())) {
            if (!orderBill.consent_token) {
              setStatus('AWAITING CLAIM VISIT');
              return;
            }
            if (orderBill.requires_preauth) {
              if (preauthRequests && preauthRequests.length) {
                const intervention = preauthRequests.find((r) => r.interventionCode === orderBill.intervention_code);
                if (intervention) {
                  if (intervention.status?.trim()?.toUpperCase() === 'ACTIVE') {
                    setStatus('PENDING PREAUTHORIZATION');
                  }
                  if (intervention.status?.trim()?.toUpperCase() === 'FINALISED') {
                    setStatus('PAID');
                  }
                  if (intervention.status?.trim()?.toUpperCase() === 'REJECTED') {
                    setStatus('PREAUTHORIZATION REJECTED');
                  }
                } else {
                  setStatus('NEEDS PREAUTHORIZATION');
                }
              } else {
                setStatus('NEEDS PREAUTHORIZATION');
              }
            } else {
              setStatus('PAID');
            }
          } else {
            setStatus(lineItem?.status as BillStatus);
          }
        } else {
          setStatus('BLANK');
        }
      }
    } else {
      if (odooBills && odooBills.orders && odooBills.orders[0].order_lines && odooBills.orders[0].order_lines.length) {
        const currentOrder = odooBills.orders[0].order_lines.find((o) => o.openmrs_order_id === order?.uuid);
        if (currentOrder) {
          if (currentOrder.billing_status.toUpperCase() === 'PAID') {
            setStatus('PAID');
          } else {
            setStatus('PENDING');
          }
        }
      }
    }
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

  if (isLoadingOdooBills || isLoading || isLoadingOrderBill) {
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
