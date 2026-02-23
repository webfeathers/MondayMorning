import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureGate, useFeatureGate } from '@/components/feature-gate';
import { useUserStore } from '@/stores';

describe('FeatureGate', () => {
  beforeEach(() => {
    // Reset store before each test
    useUserStore.setState({
      user: null,
      tenant: null,
      permissions: [],
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: false,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 1,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 1000,
          used: 100,
          remaining: 900,
          unlimited: false,
        },
      },
    });
  });

  it('renders children when feature is enabled', () => {
    render(
      <FeatureGate feature="configurableDashboards">
        <div>Protected Content</div>
      </FeatureGate>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Feature Locked')).not.toBeInTheDocument();
  });

  it('renders fallback when feature is disabled and fallback provided', () => {
    render(
      <FeatureGate
        feature="webhookSync"
        fallback={<div>Fallback Content</div>}
      >
        <div>Protected Content</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Fallback Content')).toBeInTheDocument();
  });

  it('renders upgrade prompt when feature is disabled and no fallback', () => {
    render(
      <FeatureGate feature="whiteLabel">
        <div>Protected Content</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Feature Locked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upgrade plan/i })).toBeInTheDocument();
  });

  it('renders custom upgrade message when provided', () => {
    const customMessage = 'Custom upgrade message';
    render(
      <FeatureGate feature="whiteLabel" upgradeMessage={customMessage}>
        <div>Protected Content</div>
      </FeatureGate>
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('handles null entitlements gracefully', () => {
    useUserStore.setState({ entitlements: null });

    render(
      <FeatureGate feature="apiAccess">
        <div>Protected Content</div>
      </FeatureGate>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Feature Locked')).toBeInTheDocument();
  });
});

describe('useFeatureGate hook', () => {
  beforeEach(() => {
    useUserStore.setState({
      user: null,
      tenant: null,
      permissions: [],
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: false,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 1,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 1000,
          used: 100,
          remaining: 900,
          unlimited: false,
        },
      },
    });
  });

  it('returns true for enabled feature', () => {
    let hasFeature: boolean = false;

    function TestComponent() {
      hasFeature = useFeatureGate('apiAccess');
      return <div>Test</div>;
    }

    render(<TestComponent />);
    expect(hasFeature).toBe(true);
  });

  it('returns false for disabled feature', () => {
    let hasFeature: boolean = true;

    function TestComponent() {
      hasFeature = useFeatureGate('webhookSync');
      return <div>Test</div>;
    }

    render(<TestComponent />);
    expect(hasFeature).toBe(false);
  });
});
