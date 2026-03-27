import React from 'react';
import OrdersDataTable from '../../components/orders-table/orders-data-table.component';

const PendingReviewLabRequestsTable: React.FC = () => {
  return <OrdersDataTable fulfillerStatus="ON_HOLD" useFilter={false} excludeCanceledAndDiscontinuedOrders={false} />;
};

export default PendingReviewLabRequestsTable;
