import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsageMeter, UsageMeterCompact } from '@/components/usage-meter';
import { useUserStore } from '@/stores';

describe('UsageMeter', () => {
  beforeEach(() => {
    // Reset store with default entitlements
    useUserStore.setState({
      user: null,
      tenant: null,
      permissions: [],
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 5,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 1000,
          used: 250,
          remaining: 750,
          unlimited: false,
        },
      },
    });
  });

  it('renders seat usage correctly', () => {
    render(<UsageMeter />);

    expect(screen.getByText('Team Seats')).toBeInTheDocument();
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
  });

  it('renders credit usage correctly', () => {
    render(<UsageMeter />);

    expect(screen.getByText('API Credits')).toBeInTheDocument();
    expect(screen.getByText('750 remaining')).toBeInTheDocument();
    expect(screen.getByText('250 of 1,000 used')).toBeInTheDocument();
  });

  it('shows warning when seats near limit (>=80%)', () => {
    useUserStore.setState({
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 9,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 1000,
          used: 250,
          remaining: 750,
          unlimited: false,
        },
      },
    });

    render(<UsageMeter />);

    expect(
      screen.getByText(/approaching your seat limit/i)
    ).toBeInTheDocument();
  });

  it('shows warning when credits near limit (>=80%)', () => {
    useUserStore.setState({
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 5,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 1000,
          used: 850,
          remaining: 150,
          unlimited: false,
        },
      },
    });

    render(<UsageMeter />);

    expect(
      screen.getByText(/running low on API credits/i)
    ).toBeInTheDocument();
  });

  it('handles unlimited credits', () => {
    useUserStore.setState({
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 5,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 0,
          used: 0,
          remaining: 0,
          unlimited: true,
        },
      },
    });

    render(<UsageMeter />);

    expect(screen.getByText('Unlimited')).toBeInTheDocument();
    expect(screen.getByText(/unlimited API credits/i)).toBeInTheDocument();
    expect(screen.queryByText(/Buy More Credits/i)).not.toBeInTheDocument();
  });

  it('shows add seats button when canAddMore is true', () => {
    render(<UsageMeter />);

    expect(screen.getByRole('button', { name: /add more seats/i })).toBeInTheDocument();
  });

  it('hides add seats button when canAddMore is false', () => {
    useUserStore.setState({
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 5,
          max: 10,
          canAddMore: false,
        },
        credits: {
          allocated: 1000,
          used: 250,
          remaining: 750,
          unlimited: false,
        },
      },
    });

    render(<UsageMeter />);

    expect(screen.queryByRole('button', { name: /add more seats/i })).not.toBeInTheDocument();
  });

  it('renders nothing when entitlements is null', () => {
    useUserStore.setState({ entitlements: null });

    const { container } = render(<UsageMeter />);
    expect(container.firstChild).toBeNull();
  });
});

describe('UsageMeterCompact', () => {
  beforeEach(() => {
    useUserStore.setState({
      user: null,
      tenant: null,
      permissions: [],
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 5,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 1000,
          used: 250,
          remaining: 750,
          unlimited: false,
        },
      },
    });
  });

  it('renders compact seat usage', () => {
    render(<UsageMeterCompact />);

    expect(screen.getByText('Seats')).toBeInTheDocument();
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('renders compact credit usage', () => {
    render(<UsageMeterCompact />);

    expect(screen.getByText('Credits')).toBeInTheDocument();
    expect(screen.getByText('750')).toBeInTheDocument();
  });

  it('shows infinity symbol for unlimited credits', () => {
    useUserStore.setState({
      entitlements: {
        features: {
          configurableDashboards: true,
          webhookSync: true,
          whiteLabel: false,
          apiAccess: true,
        },
        seats: {
          current: 5,
          max: 10,
          canAddMore: true,
        },
        credits: {
          allocated: 0,
          used: 0,
          remaining: 0,
          unlimited: true,
        },
      },
    });

    render(<UsageMeterCompact />);

    expect(screen.getByText('∞')).toBeInTheDocument();
  });

  it('renders nothing when entitlements is null', () => {
    useUserStore.setState({ entitlements: null });

    const { container } = render(<UsageMeterCompact />);
    expect(container.firstChild).toBeNull();
  });
});
