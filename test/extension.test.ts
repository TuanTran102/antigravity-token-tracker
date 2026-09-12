import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as extension from '../src/extension';

describe('Extension Lifecycle Entry Point', () => {
  it('should export activate and deactivate functions', () => {
    assert.strictEqual(typeof extension.activate, 'function');
    assert.strictEqual(typeof extension.deactivate, 'function');
  });

  it('should activate without throwing when context is passed', () => {
    const mockContext: any = {
      subscriptions: []
    };
    assert.doesNotThrow(() => {
      extension.activate(mockContext);
    });
    assert.ok(mockContext.subscriptions.length >= 3);
    assert.doesNotThrow(() => {
      extension.deactivate();
    });
  });
});
