import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import LanguageSelector from '../components/LanguageSelector';

describe('LanguageSelector Component', () => {
  it('renders the language selector component correctly', () => {
    render(<LanguageSelector selectedLanguage="en" onSelectLanguage={vi.fn()} />);
    expect(screen.getByTestId('language-selector')).toBeInTheDocument();
    expect(screen.getByText(/Select Language/i)).toBeInTheDocument();
  });

  it('renders English, Telugu, and Hindi language options', () => {
    render(<LanguageSelector selectedLanguage="en" onSelectLanguage={vi.fn()} />);
    expect(screen.getByTestId('lang-option-en')).toBeInTheDocument();
    expect(screen.getByTestId('lang-option-te')).toBeInTheDocument();
    expect(screen.getByTestId('lang-option-hi')).toBeInTheDocument();
  });

  it('allows English to be selected and invokes callback', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector selectedLanguage="te" onSelectLanguage={handleSelect} />);

    const enOption = screen.getByTestId('lang-option-en');
    await user.click(enOption);
    expect(handleSelect).toHaveBeenCalledWith('en');
  });

  it('allows Telugu to be selected and invokes callback', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector selectedLanguage="en" onSelectLanguage={handleSelect} />);

    const teOption = screen.getByTestId('lang-option-te');
    await user.click(teOption);
    expect(handleSelect).toHaveBeenCalledWith('te');
  });

  it('allows Hindi to be selected and invokes callback', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector selectedLanguage="en" onSelectLanguage={handleSelect} />);

    const hiOption = screen.getByTestId('lang-option-hi');
    await user.click(hiOption);
    expect(handleSelect).toHaveBeenCalledWith('hi');
  });

  it('visually and statefully represents the selected language', () => {
    const { rerender } = render(<LanguageSelector selectedLanguage="en" onSelectLanguage={vi.fn()} />);

    // English selected
    const enOption = screen.getByTestId('lang-option-en');
    expect(enOption).toHaveAttribute('data-selected', 'true');
    expect(enOption).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('lang-check-en')).toBeInTheDocument();

    const teOption = screen.getByTestId('lang-option-te');
    expect(teOption).toHaveAttribute('data-selected', 'false');
    expect(screen.queryByTestId('lang-check-te')).not.toBeInTheDocument();

    // Rerender with Telugu selected
    rerender(<LanguageSelector selectedLanguage="te" onSelectLanguage={vi.fn()} />);
    expect(screen.getByTestId('lang-option-te')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('lang-check-te')).toBeInTheDocument();
    expect(screen.getByTestId('lang-option-en')).toHaveAttribute('data-selected', 'false');
  });

  it('changing language repeatedly does not break the component', async () => {
    function ControlledWrapper() {
      const [lang, setLang] = useState('en');
      return <LanguageSelector selectedLanguage={lang} onSelectLanguage={setLang} />;
    }

    const user = userEvent.setup();
    render(<ControlledWrapper />);

    // 1. Initial English
    expect(screen.getByTestId('lang-option-en')).toHaveAttribute('data-selected', 'true');

    // 2. Select Telugu
    await user.click(screen.getByTestId('lang-option-te'));
    expect(screen.getByTestId('lang-option-te')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('lang-option-en')).toHaveAttribute('data-selected', 'false');

    // 3. Select Hindi
    await user.click(screen.getByTestId('lang-option-hi'));
    expect(screen.getByTestId('lang-option-hi')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('lang-option-te')).toHaveAttribute('data-selected', 'false');

    // 4. Switch back to English
    await user.click(screen.getByTestId('lang-option-en'));
    expect(screen.getByTestId('lang-option-en')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('lang-option-hi')).toHaveAttribute('data-selected', 'false');
  });
});
