import { Fragment } from 'react';
import { ArrowDown, ArrowRight, Eye } from 'lucide-react';
import { Panel } from '@/components/bits';
import './dashboard-workflow.css';

const stages = [
  {
    role: 'Sales',
    title: 'Create Order',
    details: [
      'Receive a customer order.',
      'Provide required materials and order information.',
      'Submit the order to the manager.',
    ],
  },
  {
    role: 'Manager',
    title: 'Feasibility and Risk Review',
    details: [
      'Confirm order feasibility with the factory.',
      'Review AI-assisted customer risk information.',
    ],
  },
  {
    role: 'Factory',
    title: 'Schedule and Produce',
    details: [
      'Schedule production.',
      'Record production-stage data at each major stage.',
      'When production is complete, hand the order to logistics.',
    ],
  },
  {
    role: 'Logistics',
    title: 'Label and Ship',
    details: ['Label and ship the products.'],
  },
  {
    role: 'Customer',
    title: 'Delivery',
    details: ['Receive the products.'],
  },
];

// A read-only process illustration, independent of live order state and permissions.
export default function DashboardWorkflow() {
  return (
    <Panel title="Order-to-delivery workflow" kicker="Process overview · static illustration" className="mt-6">
      <div className="ff-dashboard-workflow" data-testid="dashboard-workflow">
        {stages.map((stage, index) => (
          <Fragment key={stage.role}>
            <div className="ff-workflow-stage">
              <div className="ff-workflow-card">
                <div className="ff-label">{String(index + 1).padStart(2, '0')} · {stage.role}</div>
                <h3 className="mt-2 text-base font-bold leading-snug">{stage.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {stage.details.map(detail => <li key={detail}>{detail}</li>)}
                </ul>
              </div>
              {index === 1 && (
                <div className="ff-workflow-rejected">
                  <div className="ff-workflow-rejection-line" aria-hidden="true" />
                  <div className="flex items-center justify-center gap-1 text-xs font-semibold text-destructive">
                    <ArrowDown size={16} aria-hidden="true" /> Rejected
                  </div>
                  <div className="mt-1 rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2 text-center text-sm font-bold text-destructive">
                    Rejected <span className="ff-mono text-xs font-normal">· End</span>
                  </div>
                </div>
              )}
            </div>
            {index < stages.length - 1 && (
              <div className={`ff-workflow-connector ${index === 1 ? 'ff-workflow-approved' : ''}`}>
                {index === 1 && <span className="ff-mono text-xs font-semibold">Approved</span>}
                <ArrowRight size={22} aria-hidden="true" />
              </div>
            )}
          </Fragment>
        ))}
      </div>
      <p className="flex items-start gap-2 rounded-sm border bg-secondary/50 px-3 py-3 text-sm font-medium">
        <Eye size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        Order and product status is visible to all users throughout the process.
      </p>
    </Panel>
  );
}
