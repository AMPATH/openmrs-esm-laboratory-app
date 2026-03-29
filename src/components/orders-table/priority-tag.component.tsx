import { Tag } from '@carbon/react';
import React, { useMemo } from 'react';
import styles from './priority-tag.scss';

const TYPES = {
  red: 'red',
  magenta: 'magenta',
  purple: 'purple',
  blue: 'blue',
  cyan: 'cyan',
  teal: 'teal',
  green: 'green',
  gray: 'gray',
  'cool-gray': 'cool-gray',
  'warm-gray': 'warm-gray',
  'high-contrast': 'high-contrast',
  outline: 'outline',
  yellow: 'yellow',
} as const;

interface PriorityTagProps {
  status: string;
}

export enum QueueEntryPriority {
  Emergency = 'EMERGENCY',
  Priority = 'PRIORITY',
  NonUrgent = 'NON-URGENT',
}

const PriorityTag: React.FC<PriorityTagProps> = ({ status }) => {
  const tagClassName = useMemo(() => {
    let className = 'gray';
    if (
      status.toUpperCase() === QueueEntryPriority.Emergency ||
      status.toUpperCase() === `${QueueEntryPriority.Emergency} PRIORITY`
    )
      className = 'emergencyTag';
    if (
      status.toUpperCase() === QueueEntryPriority.Priority ||
      status.toUpperCase() === `${QueueEntryPriority.Priority} PRIORITY` ||
      status.toUpperCase() === 'NORMAL PRIORITY' ||
      status.toUpperCase() === 'NOT URGENT'
    )
      className = 'priorityTag';
    if (
      status.toUpperCase() === QueueEntryPriority.NonUrgent ||
      status.toUpperCase() === `${QueueEntryPriority.NonUrgent} PRIORITY`
    )
      className = 'nonUrgentTag';
    return className;
  }, [status]);
  return (
    <Tag size="md" className={styles[tagClassName]}>
      {status}
    </Tag>
  );
};

export default PriorityTag;
