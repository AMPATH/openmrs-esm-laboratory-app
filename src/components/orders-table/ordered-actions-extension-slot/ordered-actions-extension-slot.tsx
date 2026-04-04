import { ExtensionSlot } from '@openmrs/esm-framework';
import { type BillInvoice, type BillStatus, type Order } from '../../../types';
import React, { useEffect, useMemo, useState } from 'react';
import { getOrderNumberFromHie, useInvalidateBills } from '../../../bill/bill.resource';

interface OrderedActionsExtensionSlotProps {
  order: Order;
  bills: BillInvoice[];
  isLoading: boolean;
}

const OrderedActionsExtensionSlot: React.FC<OrderedActionsExtensionSlotProps> = ({ order, bills, isLoading }) => {
  const [status, setStatus] = useState<BillStatus>('BLANK');
  const invalidateBills = useInvalidateBills(order?.patient?.uuid);

  const mutated = () => {
    invalidateBills();
  };

  useEffect(() => {
    const getBillStatus = async () => {
      try {
        const response = await getOrderNumberFromHie(order?.orderNumber);
        const billUuid = response.bill_uuid;
        const bill = bills.find((b) => b.uuid === billUuid);
        const lineItem = bill?.lineItems?.find((i) => i.uuid === response?.line_item_uuid);
        if (lineItem) {
          if (lineItem.priceName === 'SHA') {
            setStatus('PAID');
          } else {
            setStatus(lineItem?.paymentStatus as BillStatus);
          }
        } else {
          setStatus('BLANK');
        }
      } catch (error) {
        setStatus('BLANK');
      }
    };

    if (order?.orderNumber) {
      getBillStatus();
    }
  }, [order, bills]);

  return (
    <ExtensionSlot state={{ order: order, billStatus: status, isLoading, mutated }} name="tests-ordered-actions-slot" />
  );
};

export default OrderedActionsExtensionSlot;
