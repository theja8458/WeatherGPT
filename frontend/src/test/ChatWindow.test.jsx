import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import api from '../services/api';

describe('ChatWindow Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithRouter = (ui) => {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  };

  it('renders correctly with header, messages container, and chat input', () => {
    renderWithRouter(<ChatWindow />);

    expect(screen.getByTestId('chat-window')).toBeInTheDocument();
    expect(screen.getAllByText(/WeatherGPT Assistant/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('messages-container')).toBeInTheDocument();

    const input = screen.getByTestId('chat-input');
    expect(input).toBeInTheDocument();
    expect(input).toBeVisible();

    const sendBtn = screen.getByTestId('send-button');
    expect(sendBtn).toBeInTheDocument();
  });

  it('allows user to enter a message and updates input state', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ChatWindow />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'What is the temperature in Hyderabad?');
    expect(input).toHaveValue('What is the temperature in Hyderabad?');
  });

  it('triggers send action and renders mocked API response', async () => {
    const mockSendChat = vi.spyOn(api, 'sendChat').mockResolvedValueOnce({
      answer: 'Current temperature in Hyderabad is 31.5°C with mostly clear skies.',
      intent: 'current_weather',
      data_cards: [],
      follow_up_suggestions: ['Will it rain tomorrow?'],
    });

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow />);

    const input = screen.getByTestId('chat-input');
    const sendBtn = screen.getByTestId('send-button');

    await user.type(input, 'Weather in Hyderabad');
    await user.click(sendBtn);

    // User message is rendered in the chat
    expect(screen.getByText('Weather in Hyderabad')).toBeInTheDocument();

    // Input is cleared
    expect(input).toHaveValue('');

    // Wait for assistant response to render
    await waitFor(() => {
      expect(
        screen.getByText(/Current temperature in Hyderabad is 31\.5°C/i)
      ).toBeInTheDocument();
    });

    expect(mockSendChat).toHaveBeenCalledTimes(1);
  });

  it('displays loading indicator while waiting for response', async () => {
    let resolvePromise;
    const slowResponsePromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(api, 'sendChat').mockReturnValueOnce(slowResponsePromise);

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow />);

    const input = screen.getByTestId('chat-input');
    const sendBtn = screen.getByTestId('send-button');

    await user.type(input, 'Is it going to rain?');
    await user.click(sendBtn);

    // Loading indicator is visible
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(
      screen.getByText(/Consulting MoES & IMD meteorological models/i)
    ).toBeInTheDocument();

    // Resolve response
    resolvePromise({
      answer: 'No rain expected today.',
      data_cards: [],
    });

    // Loading indicator disappears
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    expect(screen.getByText('No rain expected today.')).toBeInTheDocument();
  });

  it('handles error state safely without crashing or exposing internals', async () => {
    vi.spyOn(api, 'sendChat').mockRejectedValueOnce(new Error('Network connection timeout'));

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'Hyderabad weather update');
    await user.click(screen.getByTestId('send-button'));

    // Safe error banner and message rendered
    await waitFor(() => {
      expect(screen.getByTestId('chat-error-banner')).toBeInTheDocument();
    });

    expect(
      screen.getAllByText(/Could not reach WeatherGPT engine\. Please check connection or try again\./i).length
    ).toBeGreaterThanOrEqual(1);

    // Verify raw error or stack trace is NOT shown
    expect(screen.queryByText(/Network connection timeout/i)).not.toBeInTheDocument();
  });

  it('renders English response correctly', async () => {
    vi.spyOn(api, 'sendChat').mockResolvedValueOnce({
      answer: 'Today in Hyderabad: Expect maximum temperature around 33°C with light south-westerly winds.',
      data_cards: [],
    });

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow selectedLanguage="en" />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'How is the day looking?');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() => {
      expect(screen.getByText(/Today in Hyderabad: Expect maximum temperature around 33°C/i)).toBeInTheDocument();
    });
  });

  it('renders Telugu response correctly', async () => {
    const teluguResponse = 'హైదరాబాద్‌లో ప్రస్తుత ఉష్ణోగ్రత 32°C. ఆకాశం సాధారణంగా నిర్మలంగా ఉంది, వర్ష సూచన లేదు.';
    vi.spyOn(api, 'sendChat').mockResolvedValueOnce({
      answer: teluguResponse,
      language: 'te',
      data_cards: [],
    });

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow selectedLanguage="te" />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'హైదరాబాద్ వాతావరణం ఎలా ఉంది?');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() => {
      expect(screen.getByText(teluguResponse)).toBeInTheDocument();
    });
  });

  it('renders Hindi response correctly', async () => {
    const hindiResponse = 'हैदराबाद में वर्तमान तापमान 32°C है और बारिश की कोई संभावना नहीं है।';
    vi.spyOn(api, 'sendChat').mockResolvedValueOnce({
      answer: hindiResponse,
      language: 'hi',
      data_cards: [],
    });

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow selectedLanguage="hi" />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'हैदराबाद का मौसम कैसा है?');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() => {
      expect(screen.getByText(hindiResponse)).toBeInTheDocument();
    });
  });

  it('renders structured weather and data cards when present in API response', async () => {
    vi.spyOn(api, 'sendChat').mockResolvedValueOnce({
      answer: 'Here is the current weather observation for Kurnool.',
      data_cards: [
        {
          card_type: 'current_weather',
          type: 'current_weather',
          data: {
            place_name: 'Kurnool, Andhra Pradesh',
            temperature: 34.2,
            feels_like: 36.0,
            humidity: 45,
            wind_speed: 12.5,
            weather_description: 'Sunny and warm',
            weather_icon: 'sun',
          },
        },
        {
          card_type: 'alert',
          type: 'alert',
          title: 'Heatwave Advisory',
          severity: 'yellow',
          description: 'Stay hydrated during peak afternoon hours.',
        },
      ],
    });

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'Show Kurnool weather card');
    await user.click(screen.getByTestId('send-button'));

    // Wait for card container
    await waitFor(() => {
      expect(screen.getByTestId('data-cards-container')).toBeInTheDocument();
    });

    // Check CurrentWeatherCard rendered
    expect(screen.getByText('Live Observation')).toBeInTheDocument();
    expect(screen.getByText('Kurnool, Andhra Pradesh')).toBeInTheDocument();
    expect(screen.getByText('34°C')).toBeInTheDocument();

    // Check AlertBannerCard rendered
    expect(screen.getByText('Heatwave Advisory')).toBeInTheDocument();
    expect(screen.getByText('Stay hydrated during peak afternoon hours.')).toBeInTheDocument();
  });

  it('verifies no internal API keys, secrets, or raw credentials are displayed', async () => {
    // Simulate a buggy response trying to leak API key or DB string
    vi.spyOn(api, 'sendChat').mockResolvedValueOnce({
      answer: 'Weather data ok. Key: AIzaSyD3x920FakeKeySecret12345678901 and mongodb+srv://admin:pass@cluster.mongodb.net/prod',
      data_cards: [],
    });

    const user = userEvent.setup();
    renderWithRouter(<ChatWindow />);

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'Dump secrets');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() => {
      expect(screen.getByText(/Weather data ok/i)).toBeInTheDocument();
    });

    // Sensitive patterns MUST NOT appear in the rendered document
    expect(screen.queryByText(/AIzaSyD3x920/)).not.toBeInTheDocument();
    expect(screen.queryByText(/mongodb\+srv:\/\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin:pass/)).not.toBeInTheDocument();
    expect(screen.getByText(/\[REDACTED_API_KEY\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[REDACTED_DB_URI\]/)).toBeInTheDocument();
  });
});
