import { ExtensionSlot, useConfig } from '@openmrs/esm-framework';
import { type BillInvoice, type BillStatus, type Order } from '../../../types';
import React, { useEffect, useState } from 'react';
import { useInvalidateBills, useOdooBills, useOrderBill } from '../../../bill/bill.resource';
import { type Config } from '../../../config-schema';
import { InlineLoading } from '@carbon/react';

interface OrderedActionsExtensionSlotProps {
  order: Order;
  bills: BillInvoice[];
  isLoading: boolean;
}

const OrderedActionsExtensionSlot: React.FC<OrderedActionsExtensionSlotProps> = ({ order, bills, isLoading }) => {
  const [status, setStatus] = useState<BillStatus>('BLANK');
  const invalidateBills = useInvalidateBills(order?.patient?.uuid);
  const { enableOdooBilling, blockedPaymentModes } = useConfig<Config>();
  const { orderBill, isLoadingOrderBill } = useOrderBill(order?.orderNumber);
  const { odooBills, isLoadingOdooBills } = useOdooBills(order?.patient?.uuid, enableOdooBilling);

  const mutated = () => {
    invalidateBills();
  };

  useEffect(() => {
    if (!enableOdooBilling) {
      if (!isLoading && !isLoadingOrderBill && orderBill) {
        const billUuid = orderBill?.bill_uuid;
        const lineItemUuid = orderBill?.line_item_uuid;
        const bill = bills.find((b) => b.uuid === billUuid);
        const lineItem = bill?.lineItems?.find((i) => i.uuid === lineItemUuid);
        if (lineItem) {
          if (!blockedPaymentModes.includes(lineItem.priceName.toUpperCase())) {
            setStatus('PAID');
          } else {
            setStatus(lineItem?.paymentStatus as BillStatus);
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
  }, [order, isLoading, bills, odooBills, orderBill, isLoadingOrderBill, blockedPaymentModes, enableOdooBilling]);

  if (isLoadingOdooBills || isLoading || isLoadingOrderBill) {
    return <InlineLoading />;
  }

  return (
    <ExtensionSlot state={{ order: order, billStatus: status, isLoading, mutated }} name="tests-ordered-actions-slot" />
  );
};

export default OrderedActionsExtensionSlot;
