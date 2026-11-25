import React, { useMemo } from 'react';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useLayoutType } from '@openmrs/esm-framework';
import {
  type Order,
  type OBSERVATION_INTERPRETATION,
  ReferenceRangeDisplay,
  useReferenceRanges,
} from '@openmrs/esm-patient-common-lib';
// import { useLabEncounter, useOrderConceptByUuid, useOrderConceptsByUuids } from './lab-results.resource';
import { getConceptUuids, getEffectiveRanges, getInterpretationClass, interpretObservation } from './utils';
import styles from './lab-results.scss';
import { useLabEncounter, useObservations, useOrderConceptByUuid } from '../../laboratory.resource';
import { flattenLabResultRows } from './result-rows.utils';
interface LabResultsProps {
  order: Order;
  /** When provided, reference ranges fetch starts immediately instead of waiting for encounter. Pass from parent when available (e.g. OrderDetailsTable) to avoid request waterfall. */
  patientUuid?: string;
}

const LabResults: React.FC<LabResultsProps> = ({ order, patientUuid: patientUuidProp }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { concept, isLoading: isLoadingTestConcepts } = useOrderConceptByUuid(order?.concept?.uuid);
  const { encounter, isLoading: isLoadingEncounter } = useLabEncounter(order?.encounter?.uuid);
  const obsUuids = useMemo(
    () => encounter?.obs?.filter((obs) => obs.order?.uuid === order.uuid).map((obs) => obs.uuid) ?? [],
    [encounter, order.uuid],
  );
  const { data: testResultObs, isLoading: isLoadingObservations } = useObservations(obsUuids);
  const isLoadingResult = isLoadingEncounter || isLoadingObservations;

  const patientUuid = patientUuidProp ?? order.patient?.uuid;

  const conceptUuids = useMemo(() => getConceptUuids(concept), [concept]);

  // Fetch reference ranges from the API
  const { ranges: referenceRanges, isLoading: isLoadingRanges } = useReferenceRanges(patientUuid, conceptUuids);

  const tableHeaders = useMemo(() => {
    return [
      {
        key: 'testType',
        header: order?.orderType?.display || '',
      },
      {
        key: 'result',
        header: t('result', 'Result'),
      },
      {
        key: 'normalRange',
        header: t('referenceRange', 'Reference range'),
      },
    ];
  }, [t, order?.orderType?.display]);

  const testRows = useMemo(() => {
    if (!concept || !Array.isArray(testResultObs) || testResultObs.length === 0) return [];

    return testResultObs.flatMap((rootObservation) =>
      flattenLabResultRows(concept, rootObservation).map(({ id, concept: resultConcept, observation }) => {
        const ranges = getEffectiveRanges(resultConcept, referenceRanges);
        let result: { value: string; interpretation: OBSERVATION_INTERPRETATION } | React.ReactNode;
        if (isLoadingResult) {
          result = <SkeletonText />;
        } else if (observation) {
          const interpreted = interpretObservation(observation, ranges);
          result = { value: interpreted.displayValue, interpretation: interpreted.interpretation };
        } else {
          result = '--';
        }

        return {
          id,
          testType: resultConcept.display || '--',
          result,
          normalRange: <ReferenceRangeDisplay ranges={ranges} />,
        };
      }),
    );
  }, [concept, isLoadingResult, testResultObs, referenceRanges]);

  if (isLoadingTestConcepts || isLoadingResult || isLoadingRanges) {
    return (
      <>
        <InlineLoading
          status="active"
          iconDescription="Loading"
          description={t('loadinglabresults', 'Loading lab results') + '...'}
        />
        <DataTableSkeleton role="progressbar" size={isTablet ? 'lg' : 'sm'} zebra />
      </>
    );
  }

  if (!concept) {
    return <div className={styles.error}>{t('noTestData', 'No test data available')}</div>;
  }

  return (
    <div className={styles.testOrder}>
      <DataTable rows={testRows} headers={tableHeaders} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
        {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
          <TableContainer {...getTableContainerProps()}>
            <Table {...getTableProps()} className={styles.table} aria-label={t('testOrders', 'Test orders')}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const headerProps = getHeaderProps({ header });
                    return (
                      <TableHeader
                        {...headerProps}
                        className={classNames(headerProps.className, styles[`col-${header.key}`])}
                      >
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })}>
                    {row.cells.map((cell) =>
                      cell.value?.interpretation ? (
                        <TableCell key={cell.id} className={getInterpretationClass(styles, cell.value.interpretation)}>
                          <span>{cell.value.value}</span>
                        </TableCell>
                      ) : (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ),
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

export default LabResults;
