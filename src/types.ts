import {
  type Order as FrameworkOrder,
  type OrderUrgency,
  type OpenmrsResource,
  type Visit,
} from '@openmrs/esm-framework';

type FrameworkFulfillerStatus = FrameworkOrder['fulfillerStatus'];
export type FulfillerStatus = FrameworkFulfillerStatus | 'DRAFT' | null;
export type ObservationStatus = 'PRELIMINARY' | 'FINAL' | 'AMENDED';

export type Order = Omit<FrameworkOrder, 'fulfillerStatus' | 'fulfillerComment'> & {
  fulfillerStatus?: FulfillerStatus;
  fulfillerComment?: string | null;
};

export interface FlattenedOrder {
  id: string;
  patientUuid: string;
  orderNumber: string;
  display: string;
  dateActivated: string;
  fulfillerStatus: FulfillerStatus;
  urgency: OrderUrgency;
  orderer?: string;
  instructions?: string;
  fulfillerComment?: string;
}

export interface GroupedOrders {
  patientUuid: string;
  patientId?: string;
  patientName?: string;
  patientAge?: number;
  patientDob?: string;
  patientSex?: string;
  totalOrders: number;
  orders: Array<FlattenedOrder>;
  originalOrders: Array<Order>;
}

export type DateFilterContext = {
  dateRange: [Date, Date] | null;
  setDateRange: React.Dispatch<React.SetStateAction<[Date, Date] | null>>;
};

export type BillStatus = 'BLANK' | 'PENDING' | 'PAID' | 'POSTED';

export interface LineItem {
  uuid: string;
  billableService: string;
  quantity: string;
  price: string;
  item: string;
  priceUuid: string;
  priceName: string;
}
export interface BillInvoice {
  uuid: string;
  patient: {
    uuid: string;
  };
  lineItems: LineItem[];
  status: string;
}

export type ObservationValue =
  | OpenmrsResource // coded
  | number // numeric
  | string // text or misc
  | null;

export interface Encounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{
    uuid: string;
    display: string;
    encounterRole: {
      uuid: string;
      display: string;
    };
    provider: {
      uuid: string;
      person: {
        uuid: string;
        display: string;
      };
    };
  }>;
  encounterType: {
    uuid: string;
    display: string;
  };
  visit?: Visit;
  obs: Array<Observation>;
  orders: Array<Order>;
  diagnoses: Array<Diagnosis>;
  patient: OpenmrsResource;
  location: OpenmrsResource;
}

export interface Observation {
  uuid: string;
  display: string;
  concept: {
    uuid: string;
    display: string;
  };
  obsGroup: any;
  obsDatetime: string;
  groupMembers?: Array<Observation>;
  value: ObservationValue;
  interpretation?: string;
  location: OpenmrsResource;
  order: Order;
  status: string;
}

export interface Diagnosis {
  uuid: string;
  display: string;
  diagnosis: {
    coded?: {
      uuid: string;
      display?: string;
    };
    nonCoded?: string;
  };
  certainty: string;
  rank: number;
}

type NullableNumber = number | null | undefined;
export interface LabOrderConcept {
  uuid: string;
  display: string;
  name?: ConceptName;
  datatype: Datatype;
  set: boolean;
  version: string;
  retired: boolean;
  descriptions: Array<Description>;
  mappings?: Array<Mapping>;
  answers?: Array<OpenmrsResource>;
  setMembers?: Array<LabOrderConcept>;
  hiNormal?: NullableNumber;
  hiAbsolute?: NullableNumber;
  hiCritical?: NullableNumber;
  lowNormal?: NullableNumber;
  lowAbsolute?: NullableNumber;
  lowCritical?: NullableNumber;
  allowDecimal?: boolean | null;
  units?: string;
}

export interface ConceptName {
  display: string;
  uuid: string;
  name: string;
  locale: string;
  localePreferred: boolean;
  conceptNameType: string;
}

export interface Datatype {
  uuid: string;
  display: string;
  name: string;
  description: string;
  hl7Abbreviation: string;
  retired: boolean;
  resourceVersion: string;
}

export interface Description {
  display: string;
  uuid: string;
  description: string;
  locale: string;
  resourceVersion: string;
}

export interface Mapping {
  display: string;
  uuid: string;
  conceptReferenceTerm: OpenmrsResource;
  conceptMapType: OpenmrsResource;
  resourceVersion: string;
}
