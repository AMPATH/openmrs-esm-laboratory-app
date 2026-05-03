import { ExtensionSlot, useConfig } from '@openmrs/esm-framework';
import { type BillInvoice, type BillStatus, type Order } from '../../../types';
import React, { useEffect, useMemo, useState } from 'react';
import { getOdooBills, getOrderNumberFromHie, useInvalidateBills } from '../../../bill/bill.resource';
import { type Config } from '../../../config-schema';
import { InlineLoading } from '@carbon/react';

interface OrderedActionsExtensionSlotProps {
  order: Order;
  bills: BillInvoice[];
  isLoading: boolean;
}

const OrderedActionsExtensionSlot: React.FC<OrderedActionsExtensionSlotProps> = ({ order, bills, isLoading }) => {
  const [status, setStatus] = useState<BillStatus>('BLANK');
  const [isLoadingOdooBills, setIsLoadingOdooBills] = useState(false);
  const invalidateBills = useInvalidateBills(order?.patient?.uuid);
  const { enableOdooBilling } = useConfig<Config>();

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

    const odooBills = async () => {
      try {
        setIsLoadingOdooBills(true);
        const results = await getOdooBills(order?.patient?.uuid);
        if (results.orders && results.orders[0].order_lines && results.orders[0].order_lines.length) {
          const currentOrder = results.orders[0].order_lines.find((o) => o.openmrs_order_id === order?.uuid);
          if (currentOrder) {
            if (currentOrder.billing_status.toUpperCase() === 'PAID') {
              setStatus('PAID');
            } else {
              setStatus('PENDING');
            }
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingOdooBills(false);
      }
    };

    if (enableOdooBilling) {
      odooBills();
    } else {
      if (order?.orderNumber) {
        getBillStatus();
      }
    }
  }, [order, bills, enableOdooBilling]);

  if (isLoadingOdooBills) {
    return <InlineLoading />;
  }

  return (
    <ExtensionSlot state={{ order: order, billStatus: status, isLoading, mutated }} name="tests-ordered-actions-slot" />
  );
};

export default OrderedActionsExtensionSlot;
