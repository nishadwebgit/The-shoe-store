import { useState } from 'react';
import { sizeGuide } from '../../data/content';
import type { SizeSystem } from '../../types';
import { Dialog } from '../ui/Dialog';

export function SizeGuide({ open, onClose, system }: { open: boolean; onClose: () => void; system: SizeSystem }) {
  const [tab, setTab] = useState<SizeSystem>(system);
  const table = sizeGuide[tab];
  return (
    <Dialog open={open} onClose={onClose} title="Size guide" variant="drawer-right" size="md">
      <div className="size-guide">
        <div className="segmented" role="tablist" aria-label="Size chart">
          {(['adult', 'kids'] as SizeSystem[]).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={tab === s} className={tab === s ? 'is-active' : ''} onClick={() => setTab(s)}>
              {s === 'adult' ? 'Adults' : 'Kids'}
            </button>
          ))}
        </div>
        <h3 className="size-guide__heading">Measure your foot</h3>
        <ol className="size-guide__steps">
          <li>Stand on a sheet of paper with your heel against a wall.</li>
          <li>Mark the tip of your longest toe and measure from the wall in centimetres.</li>
          <li>Measure both feet in the evening, when they are largest, and use the longer one.</li>
          <li>Find your foot length in the table. If you are between sizes, go up.</li>
        </ol>
        <div className="table-scroll" tabIndex={0} role="region" aria-label={`${tab === 'adult' ? 'Adult' : 'Kids'} size conversion table`}>
          <table className="data-table">
            <thead>
              <tr>
                {table.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row">
                        {cell.replace('K', '')}
                      </th>
                    ) : (
                      <td key={i}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted size-guide__note">
          Not sure? Exchanges for a different size are free within 30 days.
        </p>
      </div>
    </Dialog>
  );
}
