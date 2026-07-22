/**
 * Basic tests for EntriesContext provider structure.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EntriesProvider, useEntries } from '../EntriesContext';

// Test component
function TestConsumer() {
  const { entries, isLoading } = useEntries();
  return (
    <div>
      <div data-testid="entry-count">{entries.length}</div>
      <div data-testid="loading">{isLoading.toString()}</div>
    </div>
  );
}

describe('EntriesProvider', () => {
  it('provides initial state within provider', () => {
    render(
      <EntriesProvider>
        <TestConsumer />
      </EntriesProvider>
    );

    expect(screen.getByTestId('entry-count').textContent).toBe('0');
    expect(screen.getByTestId('loading').textContent).toBe('true');
  });
});
