import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AlertBanner from '../components/AlertBanner';

describe('AlertBanner Component', () => {
  it('renders normal / no-alert state when alert is null or green', () => {
    // When alert is null and showNormalState is false -> renders nothing
    const { container, rerender } = render(<AlertBanner alert={null} showNormalState={false} />);
    expect(container.firstChild).toBeNull();

    // When showNormalState is true -> renders normal status
    rerender(<AlertBanner alert={null} showNormalState={true} />);
    expect(screen.getByTestId('alert-banner-normal')).toBeInTheDocument();
    expect(screen.getByText(/Normal Conditions/i)).toBeInTheDocument();

    // When alert has green severity
    rerender(<AlertBanner alert={{ id: 'a1', severity: 'green', title: 'Clear Sky' }} showNormalState={true} />);
    expect(screen.getByTestId('alert-banner-normal')).toBeInTheDocument();
  });

  it('renders warning alert with yellow/orange styling and label', () => {
    const yellowAlert = {
      id: 'alert-yellow-1',
      title: 'Moderate Rainfall Warning',
      description: 'Localized waterlogging expected in low-lying areas.',
      severity: 'yellow',
    };

    render(<AlertBanner alert={yellowAlert} />);
    const banner = screen.getByTestId('alert-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('data-severity', 'yellow');

    const severity = screen.getByTestId('alert-severity');
    expect(severity).toHaveTextContent(/Yellow Watch/i);

    expect(screen.getByTestId('alert-title')).toHaveTextContent('Moderate Rainfall Warning');
    expect(screen.getByTestId('alert-message')).toHaveTextContent('Localized waterlogging expected');
  });

  it('renders severe/critical alert with orange and red styling', () => {
    const redAlert = {
      id: 'alert-red-1',
      title: 'Cyclone Impact Alert',
      description: 'Extremely heavy downpour with wind gusts reaching 90 km/h.',
      severity: 'red',
    };

    const { rerender } = render(<AlertBanner alert={redAlert} />);
    const banner = screen.getByTestId('alert-banner');
    expect(banner).toHaveAttribute('data-severity', 'red');

    const severity = screen.getByTestId('alert-severity');
    expect(severity).toHaveTextContent(/Red Warning \(Critical\)/i);
    expect(screen.getByTestId('alert-title')).toHaveTextContent('Cyclone Impact Alert');

    // Test Orange alert
    const orangeAlert = {
      id: 'alert-orange-1',
      title: 'Very Heavy Rainfall Alert',
      description: 'Continuous heavy rainfall expected for next 24 hours.',
      severity: 'orange',
    };
    rerender(<AlertBanner alert={orangeAlert} />);
    expect(screen.getByTestId('alert-severity')).toHaveTextContent(/Orange Alert \(Severe\)/i);
  });

  it('renders multilingual alert content in Telugu and Hindi when supported', () => {
    const multilingualAlert = {
      id: 'alert-multi-1',
      title: 'Severe Thunderstorm Warning',
      description: 'Lightning strikes and gusty winds anticipated.',
      severity: 'orange',
      translations: {
        te: {
          title: 'తీవ్రమైన ఉరుములతో కూడిన వర్షం హెచ్చరిక',
          description: 'పిడుగుపాటు మరియు బలమైన గాలులు వీచే అవకాశం ఉంది.',
        },
        hi: {
          title: 'भीषण आंधी-तूफान की चेतावनी',
          description: 'बिजली गिरने और तेज हवाएं चलने की संभावना है।',
        },
      },
    };

    // 1. Telugu language rendering
    const { rerender } = render(<AlertBanner alert={multilingualAlert} language="te" />);
    expect(screen.getByTestId('alert-title')).toHaveTextContent('తీవ్రమైన ఉరుములతో కూడిన వర్షం హెచ్చరిక');
    expect(screen.getByTestId('alert-message')).toHaveTextContent('పిడుగుపాటు మరియు బలమైన గాలులు');

    // 2. Hindi language rendering
    rerender(<AlertBanner alert={multilingualAlert} language="hi" />);
    expect(screen.getByTestId('alert-title')).toHaveTextContent('भीषण आंधी-तूफान की चेतावनी');
    expect(screen.getByTestId('alert-message')).toHaveTextContent('बिजली गिरने और तेज हवाएं');

    // 3. English fallback
    rerender(<AlertBanner alert={multilingualAlert} language="en" />);
    expect(screen.getByTestId('alert-title')).toHaveTextContent('Severe Thunderstorm Warning');
  });

  it('provides dismiss/close behavior and invokes onDismiss callback', async () => {
    const handleDismiss = vi.fn();
    const user = userEvent.setup();
    const alert = {
      id: 'alert-dismiss-1',
      title: 'Flash Flood Watch',
      description: 'River discharge levels rising rapidly.',
      severity: 'orange',
    };

    render(<AlertBanner alert={alert} onDismiss={handleDismiss} />);
    const dismissBtn = screen.getByTestId('alert-dismiss-btn');
    expect(dismissBtn).toBeInTheDocument();

    await user.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledWith('alert-dismiss-1');

    // Banner is dismissed from DOM
    expect(screen.queryByTestId('alert-banner')).not.toBeInTheDocument();
  });

  it('safely renders when alert data is missing or incomplete without crashing', () => {
    // Completely empty object
    const { rerender } = render(<AlertBanner alert={{}} />);
    expect(screen.getByTestId('alert-banner')).toBeInTheDocument();
    expect(screen.getByTestId('alert-title')).toHaveTextContent('Weather Advisory');
    expect(screen.getByTestId('alert-message')).toHaveTextContent('No additional details provided');
    expect(screen.getByTestId('alert-severity')).toBeInTheDocument();

    // Missing description and severity
    rerender(<AlertBanner alert={{ title: 'Heat Advisory' }} />);
    expect(screen.getByTestId('alert-title')).toHaveTextContent('Heat Advisory');
    expect(screen.getByTestId('alert-message')).toHaveTextContent('No additional details provided');

    // Missing title
    rerender(<AlertBanner alert={{ description: 'Winds 40 km/h', severity: 'yellow' }} />);
    expect(screen.getByTestId('alert-title')).toHaveTextContent('Weather Advisory');
    expect(screen.getByTestId('alert-message')).toHaveTextContent('Winds 40 km/h');
  });
});
